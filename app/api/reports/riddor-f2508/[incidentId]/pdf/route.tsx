import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
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
  const { supabase } = await requireUser();

  const { data: incident, error } = await supabase
    .from("incidents")
    .select(
      `id, site_id, ref_code, occurred_at, area, location, description,
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
    redirect(`/reports?pdf_error=not_found`);
  }
  if (incident.site.country !== "GB") {
    redirect(`/reports?pdf_error=not_riddor_jurisdiction`);
  }
  if (!(await can("report:export", incident.site_id))) {
    redirect(`/reports/riddor-f2508/${incident.id}?pdf_error=forbidden`);
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

  try {
    const buffer = await renderToBuffer(<RiddorF2508Pdf source={source} />);
    const fileName = `riddor-f2508-${incident.ref_code ?? incident.id}.pdf`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${fileName}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    redirect(`/reports/riddor-f2508/${incident.id}?pdf_error=render_failed`);
  }
}
