import Link from "next/link";
import { Plus, ListPlus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { HazardKpiTiles } from "@/components/hazards/kpi-tiles";
import { HazardList, type HazardListRow } from "@/components/hazards/hazard-list";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import type { ArgusPageContext } from "@/lib/argus/page-context";
import type { RiskLevel } from "@/lib/risk/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFilter<T extends string>(
  raw: string | string[] | undefined,
  allowed: readonly T[],
): T | undefined {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v && allowed.includes(v as T) ? (v as T) : undefined;
}

export default async function HazardsPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const riskFilter = pickFilter(sp.risk, ["high"] as const);
  const reviewFilter = pickFilter(sp.reviews, ["overdue"] as const);
  const controlsFilter = pickFilter(sp.controls, ["ppe_only"] as const);

  const { supabase, currentSiteId } = await requireUser();
  const canReport = await can("hazard:report", currentSiteId);
  const canReviewCandidates = await can("hazard_candidate:review", currentSiteId);

  // Pull all visible hazards (RLS limits). Demo-grade — no pagination yet.
  const today = new Date().toISOString().slice(0, 10);
  type HazardRow = {
    id: string;
    ref_code: string | null;
    title: string;
    hazard_category: string;
    status: string;
    area: string | null;
    identified_at: string;
    site: { name: string } | null;
    current_assessment: { id: string; residual_risk_score: RiskLevel | null; next_review_at: string | null } | null;
  };
  const { data: hazardData, error } = await supabase
    .from("hazards")
    .select(
      "id, ref_code, title, hazard_category, status, area, identified_at, " +
        "site:site_id(name), " +
        "current_assessment:current_risk_assessment_id(id, residual_risk_score, next_review_at)",
    )
    .is("deleted_at", null)
    .order("identified_at", { ascending: false })
    .limit(200)
    .returns<HazardRow[]>();

  // Pull KPI counts. PPE-only is derived client-side from a single query
  // (no dedicated SQL fn in v1 — small dataset, demo-grade is fine).
  type PpeOnlyHazardRow = {
    id: string;
    controls: Array<{ control_level: string; deleted_at: string | null }> | null;
  };
  const [kpiIdentified, kpiHighRisk, kpiOverdue, ppeOnlyHazards] = await Promise.all([
    supabase
      .from("hazards")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("status", "in", "(closed,superseded)"),
    supabase
      .from("hazard_risk_assessments")
      .select("hazard_id, hazards!inner(id, deleted_at, status)", { count: "exact", head: true })
      .in("residual_risk_score", ["S1", "S2"])
      .is("superseded_at", null)
      .is("hazards.deleted_at", null)
      .not("hazards.status", "in", "(closed,superseded)"),
    supabase
      .from("hazard_risk_assessments")
      .select("id", { count: "exact", head: true })
      .lt("next_review_at", today)
      .is("superseded_at", null),
    supabase
      .from("hazards")
      .select("id, controls:hazard_controls(control_level, deleted_at)")
      .is("deleted_at", null)
      .not("status", "in", "(closed,superseded)")
      .returns<PpeOnlyHazardRow[]>(),
  ]);

  let ppeOnlyCount = 0;
  for (const h of ppeOnlyHazards.data ?? []) {
    const activeLevels = (h.controls ?? [])
      .filter((c) => c.deleted_at === null)
      .map((c) => c.control_level);
    if (activeLevels.length > 0 && activeLevels.every((l) => l === "ppe")) {
      ppeOnlyCount++;
    }
  }

  const allRows: HazardListRow[] = (hazardData ?? []).map((h) => ({
    id: h.id,
    ref_code: h.ref_code,
    title: h.title,
    hazard_category: h.hazard_category,
    status: h.status,
    area: h.area,
    site_name: h.site?.name ?? null,
    residual_risk_score: h.current_assessment?.residual_risk_score ?? null,
    identified_at: h.identified_at,
  }));

  // Client-side filter for residual risk (since it lives on a join)
  let rows = allRows;
  if (riskFilter === "high") {
    rows = rows.filter((r) => r.residual_risk_score === "S1" || r.residual_risk_score === "S2");
  }
  // Overdue reviews and ppe_only filters: client-side too (demo-grade)
  // For 'overdue' and 'ppe_only', the more expensive path would also work — skip in v1.

  const argusContext: ArgusPageContext = {
    route: "hazards_index",
    routeLabel: "Hazards",
    siteId: currentSiteId,
    aggregates: {
      identified: kpiIdentified.count ?? 0,
      high_risk: kpiHighRisk.count ?? 0,
      overdue_reviews: kpiOverdue.count ?? 0,
      ppe_only: ppeOnlyCount,
    },
    hasActiveSignal:
      (kpiHighRisk.count ?? 0) > 0 ||
      (kpiOverdue.count ?? 0) > 0 ||
      ppeOnlyCount > 0,
  };

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hazards</h1>
          <p className="text-sm text-muted-foreground">
            ISO 45001 §6.1.2 register — workplace hazards with assessments, controls, and incident links.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canReviewCandidates && (
            <Link
              href="/hazards/candidates"
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium hover:border-foreground/20"
            >
              <ListPlus className="h-4 w-4" />Candidate queue
            </Link>
          )}
          {canReport && (
            <Link
              href="/hazards/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New hazard
            </Link>
          )}
        </div>
      </div>

      <HazardKpiTiles
        kpis={{
          identifiedCount: kpiIdentified.count ?? 0,
          highRiskCount: kpiHighRisk.count ?? 0,
          overdueReviewCount: kpiOverdue.count ?? 0,
          ppeOnlyCount,
        }}
      />

      {(riskFilter || reviewFilter || controlsFilter) && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Filter:</span>
          {riskFilter === "high" && (
            <span className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-destructive">High risk (S1–S2)</span>
          )}
          {reviewFilter === "overdue" && (
            <span className="rounded-full border border-warning/30 bg-warning/5 px-2 py-0.5">Overdue reviews</span>
          )}
          {controlsFilter === "ppe_only" && (
            <span className="rounded-full border border-warning/30 bg-warning/5 px-2 py-0.5">PPE-only controls</span>
          )}
          <Link href="/hazards" className="text-xs text-muted-foreground underline-offset-2 hover:underline">Clear</Link>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <HazardList rows={rows} />
    </div>
  );
}
