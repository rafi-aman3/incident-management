import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { RiddorF2508Pdf } from "@/lib/pdf/RiddorF2508Pdf";
import type { F2508Source } from "@/lib/format/riddorF2508";

// Note: Next 16's Cache Components mode disallows per-route runtime config;
// route handlers default to nodejs anyway, which @react-pdf/renderer needs.
type Params = Promise<{ incidentId: string }>;

export async function GET(_req: Request, { params }: { params: Params }) {
  const { incidentId } = await params;
  const { supabase, currentSiteId } = await requireUser();

  if (!currentSiteId) return new NextResponse("No active site", { status: 400 });
  if (!(await can("report:export", currentSiteId))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: incident, error } = await supabase
    .from("incidents")
    .select(
      `id, ref_code, occurred_at, area, location, description,
       dangerous_occurrence_kind, riddor_reportable,
       site:site_id ( name, address, country ),
       injured_persons (
         name, job_title, employment_status, body_parts, injury_nature,
         riddor_specified_injury, fatality, date_of_death, days_away
       )`
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .single();

  if (error || !incident || !incident.site) {
    return new NextResponse("Incident not found", { status: 404 });
  }
  if (incident.site.country !== "GB") {
    return new NextResponse("RIDDOR is UK-only", { status: 404 });
  }

  const ip = (incident.injured_persons ?? [])[0];
  const source: F2508Source = {
    incident: {
      ref_code: incident.ref_code,
      occurred_at: incident.occurred_at,
      area: incident.area,
      location: incident.location,
      description: incident.description,
      dangerous_occurrence_kind: incident.dangerous_occurrence_kind,
    },
    site: {
      name: incident.site.name,
      address: incident.site.address ?? null,
    },
    injured: {
      name: ip?.name ?? null,
      job_title: ip?.job_title ?? null,
      employment_status: ip?.employment_status ?? null,
      body_parts: ip?.body_parts ?? null,
      injury_nature: ip?.injury_nature ?? null,
      riddor_specified_injury: ip?.riddor_specified_injury ?? null,
      fatality: ip?.fatality ?? false,
      date_of_death: ip?.date_of_death ?? null,
      days_away: ip?.days_away ?? null,
    },
  };

  const buffer = await renderToBuffer(<RiddorF2508Pdf source={source} />);
  const fileName = `riddor-f2508-${incident.ref_code ?? incident.id}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
