import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { Osha301Pdf } from "@/lib/pdf/Osha301Pdf";
import type { Osha301Source } from "@/lib/format/osha301";

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
      `id, ref_code, occurred_at, area, location, description, osha_recordable,
       site:site_id ( name, address ),
       reporter:reporter_id ( full_name, email ),
       injured_persons (
         name, job_title, department, body_parts, injury_nature, object_substance,
         treatment, days_away, days_restricted, fatality, date_of_death
       )`
    )
    .eq("id", incidentId)
    .is("deleted_at", null)
    .single();

  if (error || !incident || !incident.site) {
    return new NextResponse("Incident not found", { status: 404 });
  }
  if (!incident.osha_recordable) {
    return new NextResponse("Incident is not OSHA-recordable", { status: 400 });
  }

  const ip = (incident.injured_persons ?? [])[0];
  const source: Osha301Source = {
    incident: {
      ref_code: incident.ref_code,
      occurred_at: incident.occurred_at,
      area: incident.area,
      location: incident.location,
      description: incident.description,
    },
    site: incident.site,
    injured: {
      name: ip?.name ?? null,
      job_title: ip?.job_title ?? null,
      department: ip?.department ?? null,
      body_parts: ip?.body_parts ?? null,
      injury_nature: ip?.injury_nature ?? null,
      object_substance: ip?.object_substance ?? null,
      treatment: ip?.treatment ?? null,
      days_away: ip?.days_away ?? null,
      days_restricted: ip?.days_restricted ?? null,
      fatality: ip?.fatality ?? false,
      date_of_death: ip?.date_of_death ?? null,
    },
    reporter: incident.reporter ?? null,
  };

  const buffer = await renderToBuffer(<Osha301Pdf source={source} />);
  const fileName = `osha-301-${incident.ref_code ?? incident.id}.pdf`;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
