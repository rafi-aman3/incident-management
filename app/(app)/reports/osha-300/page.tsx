import Link from "next/link";
import { Download, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  deriveOsha300Row,
  classificationLabel,
  type Osha300SourceRow,
} from "@/lib/format/osha300";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function Osha300Page({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, currentSiteId } = await requireUser();

  const yearParam = typeof sp.year === "string" ? Number(sp.year) : NaN;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();
  const monthParam = typeof sp.month === "string" ? Number(sp.month) : NaN;
  const month = Number.isFinite(monthParam) && monthParam >= 1 && monthParam <= 12
    ? monthParam : null;

  const canRead = currentSiteId
    ? await can("incident:read_site", currentSiteId)
    : false;
  const canExport = currentSiteId ? await can("report:export", currentSiteId) : false;

  let rows: Osha300SourceRow[] = [];
  let establishmentId: string | null = null;
  let naics: string | null = null;
  let siteName = "";
  let queryError: string | null = null;

  if (canRead && currentSiteId) {
    const { data: site } = await supabase
      .from("sites")
      .select("name, osha_establishment_id, naics_code")
      .eq("id", currentSiteId)
      .single();
    if (site) {
      siteName = site.name;
      establishmentId = site.osha_establishment_id;
      naics = site.naics_code;
    }

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
      const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
      q = q.gte("occurred_at", mStart).lt("occurred_at", nextMonth);
    }

    const { data, error } = await q;
    if (error) {
      queryError = error.message;
    } else {
      // One log row per injured_person (a single incident may span multiple)
      rows = (data ?? []).flatMap((inc) =>
        (inc.injured_persons ?? []).map((ip) => ({
          case_number: inc.ref_code,
          occurred_at: inc.occurred_at,
          area: inc.area,
          location: inc.location,
          description: inc.description,
          injured: ip,
        }))
      );
    }
  }

  const logRows = rows.map(deriveOsha300Row);

  const totals = logRows.reduce(
    (acc, r) => ({
      death: acc.death + (r.death ? 1 : 0),
      daysAway: acc.daysAway + (r.daysAway ? 1 : 0),
      restricted: acc.restricted + (r.jobTransferOrRestriction ? 1 : 0),
      other: acc.other + (r.otherRecordable ? 1 : 0),
      numDaysAway: acc.numDaysAway + r.numDaysAway,
      numDaysRestricted: acc.numDaysRestricted + r.numDaysRestricted,
    }),
    { death: 0, daysAway: 0, restricted: 0, other: 0, numDaysAway: 0, numDaysRestricted: 0 }
  );

  const csvHref =
    `/api/reports/osha-300/csv?year=${year}` + (month !== null ? `&month=${month}` : "");

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div>
        <Link
          href="/reports"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Reports
        </Link>
        <h1 className="mt-1 flex items-center text-2xl font-semibold">
          OSHA 300 Log — {year}
          <InfoTooltip tip="osha_300_vs_301" />
        </h1>
        <p className="text-sm text-muted-foreground">
          Running log of recordable injuries and illnesses. Sandbox rows excluded.
        </p>
      </div>

      <div className="grid gap-3 rounded-md border bg-card p-3 text-sm sm:grid-cols-3">
        <KvRow label="Establishment" value={siteName} />
        <KvRow label="OSHA establishment ID" value={establishmentId ?? "(unset)"} />
        <KvRow label="NAICS code" value={naics ?? "(unset)"} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <YearMonthFilters year={year} month={month} />
        {canExport && (
          <a
            href={csvHref}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-accent"
            download
          >
            <Download className="h-3 w-3" /> Export ITA CSV
          </a>
        )}
      </div>

      {queryError && <p className="text-sm text-destructive">{queryError}</p>}

      {logRows.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          No recordable cases for {month !== null ? `${MONTHS[month - 1]} ` : ""}{year}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">A</TableHead>
                <TableHead>B</TableHead>
                <TableHead>C</TableHead>
                <TableHead>D</TableHead>
                <TableHead>E</TableHead>
                <TableHead>F</TableHead>
                <TableHead className="text-center">G</TableHead>
                <TableHead className="text-center">H</TableHead>
                <TableHead className="text-center">I</TableHead>
                <TableHead className="text-center">J</TableHead>
                <TableHead className="text-right">K</TableHead>
                <TableHead className="text-right">L</TableHead>
                <TableHead className="text-center">M</TableHead>
              </TableRow>
              <TableRow className="text-[10px] uppercase tracking-wide text-muted-foreground">
                <TableHead className="font-normal">Case #</TableHead>
                <TableHead className="font-normal">Employee</TableHead>
                <TableHead className="font-normal">Date</TableHead>
                <TableHead className="font-normal">Location</TableHead>
                <TableHead className="font-normal">Description</TableHead>
                <TableHead className="font-normal">Class</TableHead>
                <TableHead className="text-center font-normal">Death</TableHead>
                <TableHead className="text-center font-normal">Days away</TableHead>
                <TableHead className="text-center font-normal">Restricted</TableHead>
                <TableHead className="text-center font-normal">Other</TableHead>
                <TableHead className="text-right font-normal">N days away</TableHead>
                <TableHead className="text-right font-normal">N days restr</TableHead>
                <TableHead className="text-center font-normal">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logRows.map((r, i) => (
                <TableRow key={`${r.caseNumber}-${i}`}>
                  <TableCell className="font-mono text-[11px]">{r.caseNumber}</TableCell>
                  <TableCell className="text-xs">{r.employee}</TableCell>
                  <TableCell className="tabular-nums text-xs text-muted-foreground">
                    {new Date(r.date).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-xs">{r.location}</TableCell>
                  <TableCell className="max-w-md text-xs">{r.description}</TableCell>
                  <TableCell className="text-xs">{classificationLabel(r.classification)}</TableCell>
                  <TableCell className="text-center text-xs">{r.death ? "✓" : ""}</TableCell>
                  <TableCell className="text-center text-xs">{r.daysAway ? "✓" : ""}</TableCell>
                  <TableCell className="text-center text-xs">
                    {r.jobTransferOrRestriction ? "✓" : ""}
                  </TableCell>
                  <TableCell className="text-center text-xs">{r.otherRecordable ? "✓" : ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.numDaysAway || ""}</TableCell>
                  <TableCell className="text-right tabular-nums text-xs">{r.numDaysRestricted || ""}</TableCell>
                  <TableCell className="text-center text-xs">{r.typeCode}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30 font-medium">
                <TableCell colSpan={6} className="text-right text-xs">
                  Totals
                </TableCell>
                <TableCell className="text-center text-xs tabular-nums">{totals.death}</TableCell>
                <TableCell className="text-center text-xs tabular-nums">{totals.daysAway}</TableCell>
                <TableCell className="text-center text-xs tabular-nums">{totals.restricted}</TableCell>
                <TableCell className="text-center text-xs tabular-nums">{totals.other}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{totals.numDaysAway}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">{totals.numDaysRestricted}</TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

function KvRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}

function YearMonthFilters({ year, month }: { year: number; month: number | null }) {
  const now = new Date().getFullYear();
  const years = [now, now - 1, now - 2, now - 3];
  return (
    <>
      <div className="flex items-center gap-1 rounded-md border p-0.5 text-xs">
        {years.map((y) => (
          <Link
            key={y}
            href={`/reports/osha-300?year=${y}`}
            className={`rounded px-2 py-1 font-medium tabular-nums ${
              y === year ? "bg-primary text-primary-foreground" : "hover:bg-accent"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 rounded-md border p-0.5 text-xs">
        <Link
          href={`/reports/osha-300?year=${year}`}
          className={`rounded px-2 py-1 font-medium ${
            month === null ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          All
        </Link>
        {MONTHS.map((m, i) => {
          const mNum = i + 1;
          return (
            <Link
              key={m}
              href={`/reports/osha-300?year=${year}&month=${mNum}`}
              className={`rounded px-2 py-1 font-medium ${
                month === mNum ? "bg-primary text-primary-foreground" : "hover:bg-accent"
              }`}
            >
              {m}
            </Link>
          );
        })}
      </div>
    </>
  );
}
