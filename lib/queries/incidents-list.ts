/**
 * /incidents page queries — RLS-bound, no service-role key.
 *
 * SiteScope:
 *   - single = pinned to one site (URL ?site=<id>)
 *   - all    = all sites the user has access to (RLS handles it)
 *
 * Per-table RLS still applies; passing an empty siteIds list to a query
 * means "don't filter by site" — RLS restricts the rows.
 */

import type { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";
import {
  trir,
  dart,
  ltifr,
  trifr,
  isDartCase,
} from "@/lib/format/kpi";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type IncidentRow = Database["public"]["Tables"]["incidents"]["Row"];
type IncidentStatus = Database["public"]["Enums"]["incident_status"];
type IncidentType = Database["public"]["Enums"]["incident_type"];
type Severity = Database["public"]["Enums"]["severity"];
type Track = Database["public"]["Enums"]["track"];

export type SiteScope =
  | { kind: "single"; siteId: string; country: "US" | "GB" }
  | { kind: "all"; siteIds: string[] };

// ---------------------------------------------------------------------------
// 1. KPI counts (row 1: Total / High-Critical / Under Investigation / This Month)
// ---------------------------------------------------------------------------

export type KpiCounts = {
  total: number;
  highCritical: number;
  underInvestigation: number;
  thisMonth: number;
  prevMonth: number;
  daysSinceLast: number | null; // null = no incidents on record
};

export async function getKpiCounts(
  supabase: SupabaseServerClient,
  scope: SiteScope,
): Promise<KpiCounts> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const monthStartIso = monthStart.toISOString();
  const prevMonthStartIso = prevMonthStart.toISOString();

  const base = () =>
    applySiteFilter(
      supabase
        .from("incidents")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
        .eq("is_sandbox", false),
      scope,
    );

  const [
    totalRes,
    highCriticalRes,
    underInvestigationRes,
    thisMonthRes,
    prevMonthRes,
    lastRes,
  ] = await Promise.all([
    base(),
    base().in("severity", ["S1", "S2"]).neq("status", "closed"),
    base().eq("status", "under_investigation"),
    base().gte("occurred_at", monthStartIso),
    base().gte("occurred_at", prevMonthStartIso).lt("occurred_at", monthStartIso),
    applySiteFilter(
      supabase
        .from("incidents")
        .select("occurred_at")
        .is("deleted_at", null)
        .eq("is_sandbox", false)
        .order("occurred_at", { ascending: false })
        .limit(1),
      scope,
    ),
  ]);

  const lastRow = (lastRes.data ?? [])[0] as { occurred_at: string | null } | undefined;
  const daysSinceLast = lastRow?.occurred_at
    ? Math.floor((now.getTime() - new Date(lastRow.occurred_at).getTime()) / 86_400_000)
    : null;

  return {
    total: totalRes.count ?? 0,
    highCritical: highCriticalRes.count ?? 0,
    underInvestigation: underInvestigationRes.count ?? 0,
    thisMonth: thisMonthRes.count ?? 0,
    prevMonth: prevMonthRes.count ?? 0,
    daysSinceLast,
  };
}

// ---------------------------------------------------------------------------
// 2. Frequency rates (row 2: Days Since + per-site rate selection)
// ---------------------------------------------------------------------------

export type FrequencyRates = {
  // OSHA (US)
  trir: number | null;
  dart: number | null;
  // RIDDOR (GB)
  ltifr: number | null;
  trifr: number | null;
  // Inputs
  hours: number | null;
  recordableCount: number;
  dartCount: number;
};

export async function getFrequencyRates(
  supabase: SupabaseServerClient,
  scope: SiteScope,
): Promise<FrequencyRates> {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  // Hours sum across the in-scope sites for the current year.
  let hoursQuery = supabase
    .from("site_annual_hours")
    .select("hours_worked, site_id")
    .eq("year", year);
  hoursQuery = applySiteFilterRaw(hoursQuery, scope, "site_id");

  const [recordableRes, hoursRes] = await Promise.all([
    applySiteFilter(
      supabase
        .from("incidents")
        .select("id, injured_persons(days_away, days_restricted, fatality)")
        .eq("osha_recordable", true)
        .eq("is_sandbox", false)
        .is("deleted_at", null)
        .gte("occurred_at", yearStart)
        .lt("occurred_at", yearEnd),
      scope,
    ),
    hoursQuery,
  ]);

  const incidents = recordableRes.data ?? [];
  const recordableCount = incidents.length;
  const dartCount = incidents.filter((row) =>
    (row.injured_persons ?? []).some((p) =>
      isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted }),
    ),
  ).length;

  const hours =
    (hoursRes.data ?? []).reduce(
      (sum, row) => sum + (row.hours_worked ?? 0),
      0,
    ) || null;

  // LTI count for GB rates: at least one day_away (lost time).
  const ltiCount = incidents.filter((row) =>
    (row.injured_persons ?? []).some((p) => (p.days_away ?? 0) > 0),
  ).length;

  return {
    trir: trir(recordableCount, hours),
    dart: dart(dartCount, hours),
    ltifr: ltifr(ltiCount, hours),
    trifr: trifr(recordableCount, hours),
    hours,
    recordableCount,
    dartCount,
  };
}

// ---------------------------------------------------------------------------
// 3. Monthly trend (12 buckets, missing months = 0)
// ---------------------------------------------------------------------------

export type MonthlyTrendPoint = {
  bucket: string; // ISO yyyy-mm-01
  label: string; // "Jun 25"
  count: number;
};

export async function getMonthlyTrend(
  supabase: SupabaseServerClient,
  scope: SiteScope,
): Promise<MonthlyTrendPoint[]> {
  const now = new Date();
  // Start of the bucket 11 months back (12 total including current month).
  const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);

  const res = await applySiteFilter(
    supabase
      .from("incidents")
      .select("occurred_at")
      .is("deleted_at", null)
      .eq("is_sandbox", false)
      .gte("occurred_at", start.toISOString())
      .order("occurred_at", { ascending: true }),
    scope,
  );

  const counts = new Map<string, number>();
  for (const row of res.data ?? []) {
    if (!row.occurred_at) continue;
    const d = new Date(row.occurred_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  // Build the dense 12-month series.
  const series: MonthlyTrendPoint[] = [];
  const monthLabels = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  for (let i = 0; i < 12; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    series.push({
      bucket: key,
      label: `${monthLabels[d.getMonth()]} ${String(d.getFullYear()).slice(-2)}`,
      count: counts.get(key) ?? 0,
    });
  }
  return series;
}

// ---------------------------------------------------------------------------
// 4. Breakdowns (4 cards: by type / severity / track / top sites)
// ---------------------------------------------------------------------------

export type Breakdowns = {
  byType: Array<{ key: IncidentType; count: number }>; // top 5 desc
  bySeverity: Array<{ key: Severity; count: number }>; // S1..S5
  byTrack: Array<{ key: Track; count: number }>; // A, B, C
  topSites: Array<{ siteId: string; name: string; count: number }>; // top 5 desc
};

export async function getBreakdowns(
  supabase: SupabaseServerClient,
  scope: SiteScope,
): Promise<Breakdowns> {
  const res = await applySiteFilter(
    supabase
      .from("incidents")
      .select("type, severity, track, site_id, site:sites(id, name)")
      .is("deleted_at", null)
      .eq("is_sandbox", false),
    scope,
  );

  const rows =
    (res.data ?? []) as Array<
      Pick<IncidentRow, "type" | "severity" | "track" | "site_id"> & {
        site: { id: string; name: string } | null;
      }
    >;

  const tally = <K extends string>(getKey: (row: (typeof rows)[number]) => K | null) => {
    const m = new Map<K, number>();
    for (const r of rows) {
      const k = getKey(r);
      if (k == null) continue;
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  };

  const typeMap = tally((r) => r.type as IncidentType | null);
  const sevMap = tally((r) => r.severity as Severity | null);
  const trackMap = tally((r) => r.track as Track | null);

  const siteMap = new Map<string, { name: string; count: number }>();
  for (const r of rows) {
    if (!r.site_id) continue;
    const name = r.site?.name ?? "—";
    const cur = siteMap.get(r.site_id) ?? { name, count: 0 };
    cur.count += 1;
    siteMap.set(r.site_id, cur);
  }

  return {
    byType: [...typeMap.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
    bySeverity: (["S1", "S2", "S3", "S4", "S5"] as Severity[]).map((key) => ({
      key,
      count: sevMap.get(key) ?? 0,
    })),
    byTrack: (["A", "B", "C"] as Track[]).map((key) => ({
      key,
      count: trackMap.get(key) ?? 0,
    })),
    topSites: [...siteMap.entries()]
      .map(([siteId, v]) => ({ siteId, name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  };
}

// ---------------------------------------------------------------------------
// 5. Status pipeline (Reported / Investigating / Action Required / Closed)
// ---------------------------------------------------------------------------

export type StatusPipeline = {
  reported: number; // draft + submitted
  investigating: number; // classified + under_investigation
  actionRequired: number; // awaiting_capa
  closed: number; // closed
  total: number;
};

const STATUS_BUCKETS: Record<IncidentStatus, keyof Omit<StatusPipeline, "total">> = {
  draft: "reported",
  submitted: "reported",
  classified: "investigating",
  under_investigation: "investigating",
  awaiting_capa: "actionRequired",
  closed: "closed",
};

export async function getStatusPipeline(
  supabase: SupabaseServerClient,
  scope: SiteScope,
): Promise<StatusPipeline> {
  const res = await applySiteFilter(
    supabase
      .from("incidents")
      .select("status")
      .is("deleted_at", null)
      .eq("is_sandbox", false),
    scope,
  );

  const counts: StatusPipeline = {
    reported: 0,
    investigating: 0,
    actionRequired: 0,
    closed: 0,
    total: 0,
  };
  for (const row of res.data ?? []) {
    const bucket = STATUS_BUCKETS[row.status as IncidentStatus];
    if (!bucket) continue;
    counts[bucket] += 1;
    counts.total += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Apply site filter to an incidents query (column = site_id).
function applySiteFilter<Q extends { eq: (col: string, v: string) => Q; in: (col: string, v: string[]) => Q }>(
  q: Q,
  scope: SiteScope,
): Q {
  return applySiteFilterRaw(q, scope, "site_id");
}

// Generic site-column filter. Empty all-scope siteIds = no filter (RLS only).
function applySiteFilterRaw<Q extends { eq: (col: string, v: string) => Q; in: (col: string, v: string[]) => Q }>(
  q: Q,
  scope: SiteScope,
  column: string,
): Q {
  if (scope.kind === "single") return q.eq(column, scope.siteId);
  if (scope.siteIds.length > 0) return q.in(column, scope.siteIds);
  return q;
}
