import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { trir, dart, severityRate, formatKpi, isDartCase } from "@/lib/format/kpi";
import { deriveOsha300Row, type Osha300SourceRow } from "@/lib/format/osha300";
import { AnnualHoursForm } from "@/components/reports/annual-hours-form";
import { PrintButton } from "@/components/reports/print-button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { InfoTooltip } from "@/components/info-tooltip";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Osha300APage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, currentSiteId } = await requireUser();

  const yearParam = typeof sp.year === "string" ? Number(sp.year) : NaN;
  const year = Number.isFinite(yearParam) ? yearParam : new Date().getFullYear();

  const canRead = currentSiteId
    ? await can("incident:read_site", currentSiteId)
    : false;
  const canEditHours = currentSiteId
    ? await can("report:edit_hours", currentSiteId)
    : false;

  let siteName = "—";
  let address: string | null = null;
  let establishmentId: string | null = null;
  let naics: string | null = null;
  let hoursWorked: number | null = null;
  let cases: Osha300SourceRow[] = [];

  if (canRead && currentSiteId) {
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    const [siteRes, hoursRes, casesRes] = await Promise.all([
      supabase
        .from("sites")
        .select("name, address, osha_establishment_id, naics_code")
        .eq("id", currentSiteId)
        .single(),
      supabase
        .from("site_annual_hours")
        .select("hours_worked")
        .eq("site_id", currentSiteId)
        .eq("year", year)
        .maybeSingle(),
      supabase
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
        .lt("occurred_at", yearEnd),
    ]);

    if (siteRes.data) {
      siteName = siteRes.data.name;
      address = siteRes.data.address;
      establishmentId = siteRes.data.osha_establishment_id;
      naics = siteRes.data.naics_code;
    }
    hoursWorked = hoursRes.data?.hours_worked ?? null;

    cases = (casesRes.data ?? []).flatMap((inc) =>
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

  const log = cases.map(deriveOsha300Row);

  // Counts grid
  const totalCases = log.length;
  const casesWithDaysAway = log.filter((r) => r.daysAway).length;
  const casesWithRestriction = log.filter((r) => r.jobTransferOrRestriction).length;
  const casesOtherRecordable = log.filter((r) => r.otherRecordable).length;
  const totalDaysAway = log.reduce((s, r) => s + r.numDaysAway, 0);
  const totalDaysRestricted = log.reduce((s, r) => s + r.numDaysRestricted, 0);
  const deaths = log.filter((r) => r.death).length;

  // 6 injury-type counts (matches OSHA 300A injury-type buckets)
  const typeCounts = [0, 0, 0, 0, 0, 0];
  log.forEach((r) => (typeCounts[r.classification - 1] += 1));

  // DART numerator
  const dartCases = cases.filter((c) =>
    isDartCase({
      days_away: c.injured.days_away,
      days_restricted: c.injured.days_restricted,
    })
  ).length;

  const trirValue = trir(totalCases, hoursWorked);
  const dartValue = dart(dartCases, hoursWorked);
  const severityValue = severityRate(totalDaysAway + totalDaysRestricted, hoursWorked);

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Reports
          </Link>
          <h1 className="mt-1 flex items-center text-2xl font-semibold">
            OSHA 300A Annual Summary — {year}
            <InfoTooltip tip="osha_300a_posting" />
          </h1>
          <p className="flex flex-wrap items-center text-sm text-muted-foreground">
            Posting period: Feb 1 – Apr 30 the following year. ITA submission
            deadline: March 2.
            <InfoTooltip tip="ita_deadline" />
          </p>
        </div>
        <PrintButton />

      </div>

      {/* Establishment info */}
      <div className="rounded-md border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Establishment
        </p>
        <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <Kv label="Name" value={siteName} />
          <Kv label="Address" value={address ?? "—"} />
          <Kv label="OSHA establishment ID" value={establishmentId ?? "(unset)"} />
          <Kv label="NAICS code" value={naics ?? "(unset)"} />
        </div>
      </div>

      {/* Counts grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <CountCard label="Total cases" value={totalCases} />
        <CountCard label="Cases with days away" value={casesWithDaysAway} />
        <CountCard label="Cases with restriction or transfer" value={casesWithRestriction} />
        <CountCard label="Other recordable cases" value={casesOtherRecordable} />
        <CountCard label="Total days away from work" value={totalDaysAway} />
        <CountCard label="Total days restricted" value={totalDaysRestricted} />
      </div>

      {/* Injury type counts */}
      <div className="rounded-md border bg-card p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Injury / illness type counts
        </p>
        <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {[
            "1 — Injuries",
            "2 — Skin disorders",
            "3 — Respiratory conditions",
            "4 — Poisonings",
            "5 — Hearing loss",
            "6 — Other illnesses",
          ].map((label, i) => (
            <div key={label} className="flex items-baseline justify-between rounded bg-muted/30 px-3 py-2">
              <span className="text-xs">{label}</span>
              <span className="text-base font-semibold tabular-nums">{typeCounts[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Annual hours editor */}
      {canRead && currentSiteId && (
        <div className="rounded-md border bg-card p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Annual hours worked
          </p>
          <AnnualHoursForm
            siteId={currentSiteId}
            year={year}
            initialHours={hoursWorked}
            readOnly={!canEditHours}
          />
        </div>
      )}

      {/* Computed KPIs */}
      <p className="flex items-center text-xs uppercase tracking-wide text-muted-foreground">
        Computed KPIs
        <InfoTooltip tip="trir_dart_formula" />
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        <KpiCard
          label="TRIR"
          value={formatKpi(trirValue)}
          hint={
            hoursWorked
              ? `${totalCases} recordable / ${hoursWorked.toLocaleString()} hr`
              : "Set annual hours above"
          }
        />
        <KpiCard
          label="DART rate"
          value={formatKpi(dartValue)}
          hint={
            hoursWorked
              ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}`
              : "Set annual hours above"
          }
        />
        <KpiCard
          label="Severity rate"
          value={formatKpi(severityValue)}
          hint={
            hoursWorked
              ? `${totalDaysAway + totalDaysRestricted} lost workdays`
              : "Set annual hours above"
          }
        />
      </div>

      {/* Death count callout */}
      {deaths > 0 && (
        <div className="rounded-md border-l-4 border-destructive bg-destructive/5 p-3 text-sm">
          <p className="font-medium">{deaths} fatality{deaths === 1 ? "" : "ies"}</p>
          <p className="text-[11px] text-muted-foreground">
            Fatalities count toward TRIR and must be reported separately on the 300A.
          </p>
        </div>
      )}

      {/* Certification placeholder (digital sign-off deferred to v1.5) */}
      <div className="rounded-md border-2 border-dashed bg-card p-4 text-sm">
        <p className="font-semibold">Certification (deferred to v1.5)</p>
        <p className="mt-1 text-xs text-muted-foreground">
          A company executive certifies the summary by signing the printed copy.
          Digital sign-off lands in v1.5.
        </p>
      </div>
    </div>
    </TooltipProvider>
  );
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}
