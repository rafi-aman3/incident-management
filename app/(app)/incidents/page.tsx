import { TrendingUp, Flame, Clock, CheckCircle, Activity, MapPin } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { INCIDENT_TYPE_META, INCIDENT_TYPES } from "@/lib/incidents/types";
import type { Database } from "@/lib/supabase/types";

type IncidentStatus = Database["public"]["Enums"]["incident_status"];
type Severity = Database["public"]["Enums"]["severity"];
import { formatKpi } from "@/lib/format/kpi";
import {
  getKpiCounts,
  getFrequencyRates,
  getMonthlyTrend,
  getBreakdowns,
  getStatusPipeline,
  type SiteScope,
} from "@/lib/queries/incidents-list";
import { IncidentsPageHeader } from "@/components/incidents/list/page-header";
import { KpiCard } from "@/components/incidents/list/kpi-card";
import { computeMonthOverMonthTrend } from "@/components/incidents/list/trend-pill";
import { IncidentsOverTime } from "@/components/incidents/list/incidents-over-time";
import { BreakdownCard } from "@/components/incidents/list/breakdown-card";
import { DonutBreakdown } from "@/components/incidents/list/donut-breakdown";
import { StatusPipelineRow } from "@/components/incidents/list/status-pipeline";
import {
  IncidentsListSurface,
  type ListRow,
  type ListFilters,
} from "@/components/incidents/list/list-surface";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TRACK_LABEL: Record<"A" | "B" | "C", string> = {
  A: "Track A — Full investigation",
  B: "Track B — Lite investigation",
  C: "Track C — Log & close",
};

function pickFirst(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

function daysSinceLabel(days: number | null): string {
  if (days === null) return "Sustained";
  if (days <= 7) return "Recent — under review";
  if (days <= 30) return "Watching";
  return "Sustained";
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, memberships, currentSiteId, currentMembership } =
    await requireUser();

  // ----- gates -----
  const canReportIncident = currentSiteId
    ? await can("incident:report", currentSiteId)
    : false;
  const canViewSandbox = currentSiteId
    ? await can("site:configure", currentSiteId)
    : false;

  // ----- resolve site scope (mirrors planner pattern) -----
  // ?site=all     → all accessible sites
  // ?site=<uuid>  → that one
  // (default)     → current cookie-selected site, else all-accessible
  const siteParam = pickFirst(sp.site);
  const accessibleSiteIds = memberships.map((m) => m.site_id);
  let scope: SiteScope;
  if (siteParam === "all") {
    scope = { kind: "all", siteIds: accessibleSiteIds };
  } else if (
    siteParam !== "" &&
    memberships.some((m) => m.site_id === siteParam)
  ) {
    const m = memberships.find((mm) => mm.site_id === siteParam);
    scope = {
      kind: "single",
      siteId: siteParam,
      country: (m?.site?.country ?? "US") as "US" | "GB",
    };
  } else if (currentSiteId) {
    scope = {
      kind: "single",
      siteId: currentSiteId,
      country: (currentMembership?.site?.country ?? "US") as "US" | "GB",
    };
  } else {
    scope = { kind: "all", siteIds: accessibleSiteIds };
  }

  // ----- list filters from URL (apply to bottom table only, not KPIs) -----
  const filters: ListFilters = {
    type: typeof sp.type === "string" ? sp.type : null,
    status: typeof sp.status === "string" ? sp.status : null,
    severity: typeof sp.severity === "string" ? sp.severity : null,
    showSandbox: sp.sandbox === "1" && canViewSandbox,
  };

  // ----- fetch in parallel -----
  const [counts, rates, trend, breakdowns, pipeline, listResult] =
    await Promise.all([
      getKpiCounts(supabase, scope),
      getFrequencyRates(supabase, scope),
      getMonthlyTrend(supabase, scope),
      getBreakdowns(supabase, scope),
      getStatusPipeline(supabase, scope),
      fetchListRows(supabase, scope, filters),
    ]);

  const trendPill = computeMonthOverMonthTrend(counts.thisMonth, counts.prevMonth);
  const hoursLabel = rates.hours
    ? `(${rates.recordableCount} recordable × ${
        scope.kind === "single" && scope.country === "GB" ? "1M" : "200k"
      }) ÷ ${(rates.hours / 1000).toFixed(0)}k hrs`
    : "Set annual hours on the 300A";
  const dartFormulaLabel = rates.hours
    ? `(${rates.dartCount} DART × 200k) ÷ ${(rates.hours / 1000).toFixed(0)}k hrs`
    : "Set annual hours on the 300A";

  return (
    <div className="space-y-4">
      <IncidentsPageHeader canReportIncident={canReportIncident} />

      {/* KPI row 1 — site-wide totals */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          accent="destructive"
          icon={TrendingUp}
          label="Total incidents"
          value={String(counts.total)}
          sub="All time"
        />
        <KpiCard
          accent="warning"
          icon={Flame}
          label="High / Critical"
          value={String(counts.highCritical)}
          sub="Needs attention"
        />
        <KpiCard
          accent="amber"
          icon={Clock}
          label="Under investigation"
          value={String(counts.underInvestigation)}
          sub="Active cases"
        />
        <KpiCard
          accent="brand"
          icon={CheckCircle}
          label="This month"
          value={String(counts.thisMonth)}
          sub="MTD"
          trend={trendPill}
        />
      </div>

      {/* KPI row 2 — Days since last + per-site rate selection */}
      <div
        className={
          scope.kind === "all"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
            : "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        }
      >
        <KpiCard
          accent="success"
          icon={CheckCircle}
          label="Days since last incident"
          value={counts.daysSinceLast === null ? "—" : String(counts.daysSinceLast)}
          sub={daysSinceLabel(counts.daysSinceLast)}
        />
        {scope.kind === "single" && scope.country === "US" ? (
          <>
            <KpiCard
              accent="warning"
              icon={Flame}
              label="TRIR"
              value={formatKpi(rates.trir)}
              sub="Total Recordable Incident Rate"
              formula={hoursLabel}
            />
            <KpiCard
              accent="brand"
              icon={Activity}
              label="DART"
              value={formatKpi(rates.dart)}
              sub="Days Away, Restricted, Transferred"
              formula={dartFormulaLabel}
            />
          </>
        ) : scope.kind === "single" && scope.country === "GB" ? (
          <>
            <KpiCard
              accent="warning"
              icon={Flame}
              label="LTIFR"
              value={formatKpi(rates.ltifr)}
              sub="Lost Time Injury Frequency Rate"
              formula={hoursLabel}
            />
            <KpiCard
              accent="brand"
              icon={TrendingUp}
              label="TRIFR"
              value={formatKpi(rates.trifr)}
              sub="Total Recordable Incident Frequency Rate"
              formula={hoursLabel}
            />
          </>
        ) : (
          <>
            <KpiCard
              accent="warning"
              icon={Flame}
              label="TRIR"
              value={formatKpi(rates.trir)}
              sub="Total Recordable Incident Rate"
              formula={hoursLabel}
            />
            <KpiCard
              accent="amber"
              icon={Flame}
              label="LTIFR"
              value={formatKpi(rates.ltifr)}
              sub="Lost Time Injury Frequency Rate"
              formula={hoursLabel}
            />
            <KpiCard
              accent="brand"
              icon={TrendingUp}
              label="TRIFR"
              value={formatKpi(rates.trifr)}
              sub="Total Recordable Incident Frequency Rate"
              formula={hoursLabel}
            />
          </>
        )}
      </div>

      {/* Trend chart */}
      <IncidentsOverTime data={trend} />

      {/* Breakdown row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <BreakdownCard
          title="By Type"
          topAnnotation={breakdowns.byType.length > 0 ? `top ${breakdowns.byType.length}` : undefined}
          rows={breakdowns.byType.map((row, i) => ({
            key: row.key,
            label: INCIDENT_TYPE_META[row.key]?.label ?? row.key,
            count: row.count,
            barClass: i === 0 ? "bg-sev-3" : "bg-muted-foreground/40",
          }))}
        />
        <DonutBreakdown rows={breakdowns.bySeverity} />
        <BreakdownCard
          title="By Track"
          rows={breakdowns.byTrack.map((row) => ({
            key: row.key,
            label: TRACK_LABEL[row.key],
            count: row.count,
            barClass:
              row.key === "A"
                ? "bg-destructive"
                : row.key === "B"
                ? "bg-warning"
                : "bg-success",
          }))}
        />
        <BreakdownCard
          title="Top Sites"
          icon={<MapPin className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          topAnnotation={breakdowns.topSites.length > 0 ? `top ${breakdowns.topSites.length}` : undefined}
          rows={breakdowns.topSites.map((row) => ({
            key: row.siteId,
            label: row.name,
            count: row.count,
            barClass: "bg-primary",
          }))}
        />
      </div>

      {/* Status pipeline */}
      <StatusPipelineRow pipeline={pipeline} />

      {/* List + filters + table */}
      <IncidentsListSurface
        rows={listResult}
        filters={filters}
        canViewSandbox={canViewSandbox}
      />
    </div>
  );
}

async function fetchListRows(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  scope: SiteScope,
  filters: ListFilters,
): Promise<ListRow[]> {
  let query = supabase
    .from("incidents")
    .select(
      "id, ref_code, type, title, severity, track, status, occurred_at, is_sandbox, reporter:reporter_id(full_name, email), site:sites(name)",
    )
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);

  if (scope.kind === "single") query = query.eq("site_id", scope.siteId);
  else if (scope.siteIds.length > 0) query = query.in("site_id", scope.siteIds);

  if (!filters.showSandbox) query = query.eq("is_sandbox", false);
  if (filters.type && (INCIDENT_TYPES as readonly string[]).includes(filters.type)) {
    query = query.eq("type", filters.type as (typeof INCIDENT_TYPES)[number]);
  }
  if (filters.status) query = query.eq("status", filters.status as IncidentStatus);
  if (filters.severity) query = query.eq("severity", filters.severity as Severity);

  const { data } = await query;
  return (data ?? []) as unknown as ListRow[];
}
