import { NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { deriveOsha300Row, type Osha300SourceRow } from "@/lib/format/osha300";
import { serializeItaCsv, type ItaCaseRow } from "@/lib/format/itaCsv";

/**
 * Streams ITA-format CSV for the requested year (and optional month) on
 * the user's current site. Real OSHA ITA submissions are uploaded by the
 * user via the OSHA portal — we generate the file, the user uploads it.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const yearParam = Number(url.searchParams.get("year"));
  const monthParam = Number(url.searchParams.get("month"));
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  const month =
    Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
      ? monthParam
      : null;

  const { supabase, currentSiteId } = await requireUser();
  if (!currentSiteId) {
    return new NextResponse("No active site", { status: 400 });
  }
  if (!(await can("report:export", currentSiteId))) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const { data: site } = await supabase
    .from("sites")
    .select("name, osha_establishment_id, naics_code")
    .eq("id", currentSiteId)
    .single();

  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  let q = supabase
    .from("incidents")
    .select(
      `id, ref_code, occurred_at, area, location, description,
       injured_persons (
         name, job_title, body_parts, injury_nature, object_substance,
         days_away, days_restricted, fatality, treatment
       )`
    )
    .eq("site_id", currentSiteId)
    .eq("osha_recordable", true)
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", yearStart)
    .lt("occurred_at", yearEnd)
    .order("occurred_at", { ascending: true });

  if (month !== null) {
    const mStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const nextMonth =
      month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    q = q.gte("occurred_at", mStart).lt("occurred_at", nextMonth);
  }

  const { data, error } = await q;
  if (error) {
    return new NextResponse(error.message, { status: 500 });
  }

  const sourceRows: Osha300SourceRow[] = (data ?? []).flatMap((inc) =>
    (inc.injured_persons ?? []).map((ip) => ({
      case_number: inc.ref_code,
      occurred_at: inc.occurred_at,
      area: inc.area,
      location: inc.location,
      description: inc.description,
      injured: ip,
    }))
  );

  const itaRows: ItaCaseRow[] = sourceRows.map((src) => ({
    establishmentId: site?.osha_establishment_id ?? null,
    naics: site?.naics_code ?? null,
    year,
    log: deriveOsha300Row(src),
  }));

  const csv = serializeItaCsv(itaRows);
  // Excel-on-Windows misreads non-ASCII column values without a UTF-8 BOM.
  const bom = "﻿";

  // Filename includes the establishment slug when set so multi-establishment
  // orgs don't clobber files on download.
  const slug = (site?.osha_establishment_id ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const monthSuffix = month !== null ? `-${String(month).padStart(2, "0")}` : "";
  const fileName = slug
    ? `osha-300-${slug}-${year}${monthSuffix}.csv`
    : `osha-300-${year}${monthSuffix}.csv`;

  return new NextResponse(bom + csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}"`,
      "cache-control": "no-store",
    },
  });
}
