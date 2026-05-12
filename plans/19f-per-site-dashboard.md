# Phase 19f — Per-Site Dashboard `/sites/[id]`

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans`.

**Status:** drafted 2026-05-12 — spec: `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Replace the `/sites/[id]` placeholder shipped in 19a with the real per-site dashboard — a mirror of `/dashboard` scoped to one site. Reuses every component built in 19c / 19d / 19e via their `siteId` parameter. Also adds a site-scoped KPI strip and re-enables the site-scoped Argus tiles.
**Estimated duration:** ~1 day (queries + composition; little new logic since the sub-components are reusable).
**Depends on:** **19a closed** (route shell, org plumbing) · **19c closed** (module cards + quick actions accept `siteId`) · **19d closed** (charts accept `siteId`) · **19e closed** (activity + bottom row accept `siteId`). 19b's sites-map is **not** mounted here — a single-site map is just one pin.
**Branch:** `feat/phase-19f-per-site-dashboard`
**PR target:** `main`
**New deps:** none.
**Schema migration:** **none**.

> **What this PR ships:**
> - Full implementation of `app/(app)/sites/[id]/page.tsx` replacing the 19a stub.
> - `components/dashboard/site-kpi-strip.tsx` — site-scoped KPI strip (Open · S1/S2 · TRIR · DART, no Active sites card).
> - Same Quick actions row (site context known, no picker) · Module cards · Argus tiles · Trends · Activity row · Bottom row, all passing `siteId` instead of `null`.
> - Site setup nudge banner when `setup_completed_at IS NULL`.
> - "Back to org dashboard" affordance at the top.

> **Not in this PR:**
> - No site-level Argus features beyond what 9b–9e already shipped.
> - No "Site posture summary" Argus tile org-rollup variant — site-scoped path is already what 9b–9e built.
> - No editing affordances on this page; site config still lives in `/admin/sites/[id]` and `/admin/site-setup`.

---

## File map

```
app/(app)/sites/[id]/page.tsx                         ← modified (full implementation)
components/dashboard/site-kpi-strip.tsx               ← new (site-scoped KPI strip)
```

That's it — everything else is reused.

---

## Task 1 — `<SiteKpiStrip>` component

The org dashboard's KPI strip is inlined inside `app/(app)/dashboard/page.tsx`. Extract a reusable site-scoped variant (4 KPIs, no Active sites card since we're already on a site) for `/sites/[id]`.

**Files:**
- Create: `components/dashboard/site-kpi-strip.tsx`

- [ ] **Step 1.1 — Write the component**

```tsx
// components/dashboard/site-kpi-strip.tsx
import { createClient } from "@/lib/supabase/server";
import { trir, dart, formatKpi, isDartCase } from "@/lib/format/kpi";
import { InfoTooltip } from "@/components/info-tooltip";
import type { TooltipKey } from "@/lib/constants/tooltips";

export async function SiteKpiStrip({ siteId }: { siteId: string }) {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year + 1}-01-01`;

  const [openRes, s1s2Res, recordableRes, hoursRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("site_id", siteId)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .in("severity", ["S1", "S2"])
      .neq("status", "closed"),
    supabase
      .from("incidents")
      .select("id, injured_persons(days_away, days_restricted, fatality)")
      .eq("site_id", siteId)
      .eq("osha_recordable", true)
      .eq("is_sandbox", false)
      .is("deleted_at", null)
      .gte("occurred_at", yearStart)
      .lt("occurred_at", yearEnd),
    supabase
      .from("site_annual_hours")
      .select("hours_worked")
      .eq("site_id", siteId)
      .eq("year", year)
      .maybeSingle(),
  ]);

  const openCount = openRes.count ?? 0;
  const s1s2Count = s1s2Res.count ?? 0;
  const incs = recordableRes.data ?? [];
  const recordableCases = incs.length;
  const dartCases = incs.filter((i) =>
    (i.injured_persons ?? []).some((p) =>
      isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted }),
    ),
  ).length;
  const hoursWorked = hoursRes.data?.hours_worked ?? null;

  const cards: Array<{
    label: string;
    value: string;
    tip: TooltipKey | null;
    hint: string;
    emphasis?: boolean;
  }> = [
    { label: "Open incidents", value: String(openCount), tip: null, hint: "Not yet closed", emphasis: true },
    { label: "S1 / S2 open", value: String(s1s2Count), tip: "severity_codes", hint: "Track A — full investigation" },
    {
      label: `TRIR (${year})`,
      value: formatKpi(trir(recordableCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked
        ? `${recordableCases} recordable / ${(hoursWorked / 1000).toFixed(0)}k hr`
        : "Set annual hours on the 300A",
    },
    {
      label: `DART (${year})`,
      value: formatKpi(dart(dartCases, hoursWorked)),
      tip: "trir_dart_formula",
      hint: hoursWorked
        ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}`
        : "Set annual hours on the 300A",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className={
            c.emphasis
              ? "rounded-md border border-primary/30 bg-primary/5 p-4"
              : "rounded-md border bg-card p-4"
          }
        >
          <div className="flex items-center text-xs uppercase tracking-wide text-muted-foreground">
            {c.label}
            {c.tip && <InfoTooltip tip={c.tip} />}
          </div>
          <div
            className={
              c.emphasis
                ? "mt-2 text-2xl font-semibold tabular-nums text-primary"
                : "mt-2 text-2xl font-semibold tabular-nums"
            }
          >
            {c.value}
          </div>
          <div className="text-xs text-muted-foreground">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 1.2 — Commit**

```bash
git add components/dashboard/site-kpi-strip.tsx
git commit -m "$(cat <<'EOF'
feat(phase19f): SiteKpiStrip — site-scoped Open/S1S2/TRIR/DART

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Full `/sites/[id]` implementation

**Files:**
- Modify: `app/(app)/sites/[id]/page.tsx` (replace the 19a stub)

- [ ] **Step 2.1 — Replace the file contents**

```tsx
// app/(app)/sites/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
import { isArgusAvailable } from "@/lib/argus/availability";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import { ArgusInsightTile } from "@/components/argus/argus-insight-tile";
import { getOverdueInvestigationsTilePayload } from "@/lib/argus/tiles/overdue-investigations";
import { getStopWorkActiveTilePayload } from "@/lib/argus/tiles/stop-work-active";
import { getReportabilityUncertainTilePayload } from "@/lib/argus/tiles/reportability-uncertain";
import { getCapaOverdueTilePayload } from "@/lib/argus/tiles/capa-overdue";
import { SiteKpiStrip } from "@/components/dashboard/site-kpi-strip";
import { QuickActionsRow } from "@/components/dashboard/quick-actions-row";
import { ModuleCardsGrid } from "@/components/dashboard/module-cards-grid";
import { TrendsSection } from "@/components/dashboard/trends-section";
import { ActivityRow } from "@/components/dashboard/activity-row";
import { BottomRow } from "@/components/dashboard/bottom-row";
import type { ArgusPageContext } from "@/lib/argus/page-context";

type Params = Promise<{ id: string }>;

export default async function SiteDashboardPage({ params }: { params: Params }) {
  const { id: siteId } = await params;
  const { supabase, profile } = await requireUser();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, org_id, setup_completed_at")
    .eq("id", siteId)
    .maybeSingle();
  if (!site || site.org_id !== profile.org_id) notFound();

  const canRead = await can("incident:read_site", siteId);
  if (!canRead) redirect("/dashboard");

  // Permission gates for Quick actions + tile reads. Site-scoped via can().
  const [
    canReport, canInspect, canHazard, canCapa, canJsa, canBulletin,
    canInvestigationRead, canCapaRead, canReportRead,
    argusAvailable,
    overdueInv, stopWork, reportability, capaOverdue,
  ] = await Promise.all([
    can("incident:report", siteId),
    can("inspection:run", siteId),
    can("hazard:create", siteId),
    can("capa:create", siteId),
    can("jsa:create", siteId),
    orgCan("bulletin:create"),
    can("investigation:lead", siteId),
    can("capa:complete", siteId),
    can("report:read", siteId),
    isArgusAvailable(profile.org_id),
    getOverdueInvestigationsTilePayload(supabase, siteId),
    getStopWorkActiveTilePayload(supabase, siteId),
    getReportabilityUncertainTilePayload(supabase, siteId),
    getCapaOverdueTilePayload(supabase, siteId),
  ]);

  const firstName =
    profile.full_name?.split(" ")[0] ?? profile.email.split("@")[0] ?? "there";

  const activeSignal =
    (overdueInv?.aggregates?.count ?? 0) > 0 ||
    (stopWork?.aggregates?.count ?? 0) > 0 ||
    (reportability?.aggregates?.count ?? 0) > 0 ||
    (capaOverdue?.aggregates?.count ?? 0) > 0;

  const argusContext: ArgusPageContext = {
    route: "site",
    routeLabel: `Site · ${site.name}`,
    siteId,
    siteLabel: site.name,
    aggregates: {},
    records: [],
    hasActiveSignal: argusAvailable && activeSignal,
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <ArgusContextPayload context={argusContext} />

        <div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Back to org dashboard
          </Link>
          <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
            Site dashboard
          </p>
          <h1 className="text-2xl font-semibold">{site.name}</h1>
          <p className="text-sm text-muted-foreground">
            Hi {firstName} — here&apos;s what&apos;s happening at this site.
          </p>
        </div>

        {!site.setup_completed_at && (
          <div className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <div className="flex-1">
              <strong className="font-semibold">Site setup in progress:</strong>{" "}
              <span className="text-muted-foreground">
                {site.name} hasn&apos;t finished site setup yet.
              </span>{" "}
              <Link href="/admin/site-setup" className="font-medium text-primary hover:underline">
                Finish setup →
              </Link>
            </div>
          </div>
        )}

        <QuickActionsRow
          perms={{
            reportIncident: canReport,
            startInspection: canInspect,
            addHazard: canHazard,
            createCapa: canCapa,
            createJsa: canJsa,
            createBulletin: canBulletin,
          }}
          sites={[]}
          currentSiteId={siteId}
        />

        <SiteKpiStrip siteId={siteId} />

        {argusAvailable && (
          <div className="grid gap-3 md:grid-cols-2">
            {canInvestigationRead && overdueInv && (
              <ArgusInsightTile tile="overdue_investigations" payload={{ ...overdueInv, siteId }} />
            )}
            {canRead && stopWork && (
              <ArgusInsightTile tile="stop_work_active" payload={{ ...stopWork, siteId }} />
            )}
            {canReportRead && reportability && (
              <ArgusInsightTile tile="reportability_uncertain" payload={{ ...reportability, siteId }} />
            )}
            {canCapaRead && capaOverdue && (
              <ArgusInsightTile tile="capa_overdue" payload={{ ...capaOverdue, siteId }} />
            )}
          </div>
        )}

        <ModuleCardsGrid orgId={profile.org_id} siteId={siteId} />

        <TrendsSection orgId={profile.org_id} siteId={siteId} />

        <ActivityRow orgId={profile.org_id} siteId={siteId} />

        <BottomRow orgId={profile.org_id} siteId={siteId} userId={profile.id} />
      </div>
    </TooltipProvider>
  );
}
```

> **Argus tile permission notes:** site-scoped tiles use `can(perm, siteId)` (site-bound) rather than `orgCan(perm)` (any-site) since we know which site we're viewing.
>
> **QuickActionsRow `sites={[]}`** — when `currentSiteId` is non-null the sheet picker never opens, so the `sites` prop is unused; passing `[]` keeps the component happy. (Could also be `sites={undefined}` if the prop is made optional later — leave as is for now.)

- [ ] **Step 2.2 — Smoke test**

```bash
pnpm dev
```

Visit `/sites/<your-site-id>`:
1. Back-to-org-dashboard link at the top.
2. Site name + greeting.
3. Setup-incomplete banner appears for sites with NULL `setup_completed_at`.
4. Quick actions row: same buttons, no picker — they pre-fill `?site=<this-id>` directly.
5. KPI strip — 4 cards, Open Incidents accented purple.
6. Argus tiles render site-scoped (same path as today's prior-Phase 19 behavior).
7. Module cards grid, Trends, Activity row, Bottom row — all show site-scoped data.
8. Topbar SiteSwitcher is visible here (unlike `/dashboard`). Picking another site in the switcher should navigate to `/sites/<other-id>`; this requires the SiteSwitcher's onChange to use the route path. **If today's SiteSwitcher only updates the cookie and stays on the same route, that's already the right behavior** — the page re-renders site-scoped because the URL `[id]` decides which site we show. Confirm in the browser that switching the cookie *also* re-navigates; if it doesn't, the SiteSwitcher on `/sites/[id]` needs a small tweak. See Step 2.3.

- [ ] **Step 2.3 — (Maybe) tweak SiteSwitcher behavior on `/sites/[id]`**

Read `components/app-shell/site-switcher.tsx`. If the existing onChange just sets the cookie and triggers a `router.refresh()` (which means the URL doesn't change), add a path-aware branch: when on `/sites/[id]`, after setting the cookie, `router.push('/sites/<new-id>')` so the URL parameter updates. Skip if the existing behavior already navigates.

- [ ] **Step 2.4 — Commit**

```bash
git add "app/(app)/sites/[id]/page.tsx" components/app-shell/site-switcher.tsx
git commit -m "$(cat <<'EOF'
feat(phase19f): real per-site dashboard at /sites/[id]

Mirror of /dashboard scoped to one site: site KPI strip, quick actions
(no picker), Argus tiles, module cards, trends, activity, bottom row.
SiteSwitcher tweaked to navigate /sites/[id] when on a /sites/* route.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Verification + PR

- [ ] **Step 3.1 — Lint + build**

```bash
pnpm lint && pnpm build
```

- [ ] **Step 3.2 — Manual checklist**

- [ ] `/sites/<id>` renders fully populated for a site with data.
- [ ] `/sites/<id>` renders cleanly with empty states for a brand-new site.
- [ ] Setup-incomplete banner shows when `setup_completed_at IS NULL` and hides when set.
- [ ] Topbar SiteSwitcher visible on `/sites/[id]` (Phase 19a hide is `/dashboard`-only).
- [ ] Switching site via SiteSwitcher updates the URL `[id]`.
- [ ] Quick actions never open the Sheet picker on this page; they go straight to the wizard with `?site=<this-id>`.
- [ ] Argus tiles render site-scoped, not org-scoped.
- [ ] Map (from 19b) is *not* on `/sites/[id]` — that's intentional.
- [ ] A user without `incident:read_site` for the site is redirected to `/dashboard`.
- [ ] A bogus UUID returns 404.

- [ ] **Step 3.3 — PR**

```bash
git push -u origin feat/phase-19f-per-site-dashboard
gh pr create --title "feat: phase 19f — per-site dashboard /sites/[id]" --body "$(cat <<'EOF'
## Summary
- Real per-site dashboard at `/sites/[id]`, replacing the 19a stub.
- Mirror of `/dashboard` scoped to one site: site-scoped KPI strip, Quick actions row (no picker), Argus tiles, module cards, trends, activity row, bottom row.
- Site-setup nudge banner when `setup_completed_at` is null.

## Changes
- `app/(app)/sites/[id]/page.tsx` — full implementation
- `components/dashboard/site-kpi-strip.tsx` — new
- `components/app-shell/site-switcher.tsx` — (maybe) path-aware navigation on /sites/[id]

## Test Plan
- [ ] /sites/<id> renders the full dashboard
- [ ] Permission gate redirects unauthorized users to /dashboard
- [ ] Setup banner shows/hides correctly
- [ ] SiteSwitcher navigates between sites
- [ ] Quick actions skip the picker; Argus tiles are site-scoped
- [ ] `pnpm lint` + `pnpm build` clean

Builds on Phase 19a + 19c + 19d + 19e. (Phase 19b is independent of this work.)
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3.4 — On merge, log Phase 19 complete in `docs/BUILD_STATUS.md`**

This is the closing PR for Phase 19. Append a "Phase 19 complete" summary entry covering 19a → 19f (or one entry per sub-phase, matching the convention used in past multi-PR phases).

---

## Self-review

- Spec coverage: ✓ §`/sites/[id]` mirror of `/dashboard`. ✓ All sub-components from 19a–19e reused. ✓ Argus tiles site-scoped. ✓ No site map (single site). ✓ No site-scoped Active sites card.
- Placeholder scan: clean. Only intentional caveat is the SiteSwitcher navigation tweak (verify before adding).
- Type consistency: All component props match the 19a–19e interfaces verbatim — no shape drift.
