# Phase 19a — Org Dashboard Foundation

> **For agentic workers:** REQUIRED SUB-SKILL — `superpowers:executing-plans` (or `superpowers:subagent-driven-development`). Steps use checkbox (`- [ ]`) syntax.

**Status:** drafted 2026-05-12 — informed by `docs/superpowers/specs/2026-05-12-org-dashboard-design.md`
**Goal:** Flip `/dashboard` from site-scoped to org-scoped: hide the topbar SiteSwitcher on `/dashboard` only, refactor the 4 existing KPIs to roll up across the org, add a 5th **Active sites** KPI, extend the 4 Argus tile aggregators to accept `siteId: null` (= org-wide fan-out), and add an empty `/sites/[id]` route shell that later plans will fill in.
**Estimated duration:** ~1 day (one Client wrapper + one route stub + 4 aggregator extensions + KPI refactor).
**Depends on:** Phase 9a closed (`isArgusAvailable`, `argus_enabled`, tile aggregators) · Phase 13 closed (`sites.setup_completed_at`) · Phase 17 closed (`orgCan('org:configure')`).
**Branch:** `feat/phase-19a-org-dashboard-foundation`
**PR target:** `main`
**New deps:** none.
**Schema migration:** **none**.

> **What this PR ships:**
> - Topbar SiteSwitcher hidden on `/dashboard` only (via a small Client wrapper that reads `usePathname()`).
> - `/dashboard` KPI strip flips to org-scoped queries; 5th card **Active sites** added with brand-purple accent.
> - 4 Argus tile aggregators (`overdue-investigations` / `stop-work-active` / `reportability-uncertain` / `capa-overdue`) accept `siteId: null` and return an org-wide payload when null.
> - Existing site-scoped **Recent incidents** block on `/dashboard` removed (returns reshaped in 19e). `LatestBulletinsCard` kept (already org-scoped).
> - New `/sites/[id]/page.tsx` route shell: site name + a "Site dashboard coming in Phase 19f" placeholder. Acts as the click target for the map pins shipping in 19b. Existing `/admin/sites/[id]` is untouched.

> **Not in this PR (deferred):**
> - **No sites map.** Lands in 19b.
> - **No quick actions row or module cards grid.** Lands in 19c.
> - **No trends charts.** Lands in 19d.
> - **No recent activity / drafts / assets / documents row.** Lands in 19e.
> - **No real per-site dashboard.** The `/sites/[id]` page is a placeholder until 19f.

---

## Why this scope

Foundation has to land first because every later plan assumes (a) the topbar selector behavior is settled, (b) `/dashboard`'s queries are org-shaped, and (c) the `/sites/[id]` route exists as a navigation target. Doing it all in one PR keeps the dashboard from spending time in a half-broken in-between state where some KPIs are site-scoped and some are org-scoped.

Argus tile aggregators are extended here (rather than in 19c with the module cards) because they're already mounted on today's `/dashboard` — flipping them to org-wide in the same PR that flips the KPIs avoids a regression window.

---

## Pre-flight deps

- **Phase 9a closed (PR #27, 2026-05-10)** — `lib/argus/availability.ts`, `lib/argus/tiles/*`, `argus_enabled` on `orgs`, `argus:use` permission key.
- **Phase 13 closed (PR #26, 2026-05-09)** — `sites.setup_completed_at` exists; used by the Active sites KPI.
- **Phase 17 closed (PR #44, 2026-05-12)** — `lib/auth/orgCan.ts` + `org:configure` permission key.
- **Phase 18 closed (PR #45, 2026-05-12)** — Get-Started widget mounted on `/dashboard` between the yellow banner and the greeting; remains untouched here.

---

## File map

```
app/(app)/dashboard/
  page.tsx                                           ← modified

app/(app)/sites/
  [id]/page.tsx                                      ← new (stub)

components/app-shell/
  site-switcher-slot.tsx                             ← new (Client wrapper)
  topbar.tsx                                         ← modified (use the slot wrapper)

lib/argus/tiles/
  overdue-investigations.ts                          ← modified (siteId null = org-wide)
  stop-work-active.ts                                ← modified
  reportability-uncertain.ts                         ← modified
  capa-overdue.ts                                    ← modified

lib/argus/page-context.ts                            ← modified (route: "dashboard" with siteId null is valid)
```

---

## Task 1 — `<SiteSwitcherSlot>` Client wrapper

The topbar is a server component. To hide the SiteSwitcher on `/dashboard` only, we need a tiny Client wrapper that reads `usePathname()` and gates the render. The wrapper preserves the same `lg:flex hidden` responsive behavior (mobile still uses the in-sheet SiteSwitcher mounted from `<AppSidebar>`).

**Files:**
- Create: `components/app-shell/site-switcher-slot.tsx`
- Modify: `components/app-shell/topbar.tsx`

- [ ] **Step 1.1 — Create the wrapper**

```tsx
// components/app-shell/site-switcher-slot.tsx
"use client";

import { usePathname } from "next/navigation";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";

const HIDDEN_PATHS = new Set<string>(["/dashboard"]);

export function SiteSwitcherSlot({
  sites,
  currentSiteId,
  canCreateSite,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
}) {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname ?? "")) return null;
  return (
    <SiteSwitcher sites={sites} currentSiteId={currentSiteId} canCreateSite={canCreateSite} />
  );
}
```

- [ ] **Step 1.2 — Swap the topbar to use the slot**

`components/app-shell/topbar.tsx` — replace the direct `<SiteSwitcher>` import + render with the slot wrapper.

```tsx
// at the top
import { SiteSwitcherSlot } from "./site-switcher-slot";
import type { SwitcherSite } from "./site-switcher";

// inside the JSX, replace the existing block:
<div className="hidden lg:flex">
  <SiteSwitcherSlot
    sites={sites}
    currentSiteId={currentSiteId}
    canCreateSite={canCreateSite}
  />
</div>
```

The `hidden lg:flex` wrapper stays as-is so the mobile breakpoint still drops the slot regardless of the path check.

- [ ] **Step 1.3 — Smoke test**

```bash
pnpm dev
```

Open `http://localhost:3000/dashboard` — the SiteSwitcher disappears from the top-left of the topbar. Navigate to `/incidents` or `/inspections` — it returns. On `< lg` widths, the mobile sheet's in-sheet SiteSwitcher (mounted from `<AppSidebar>`) is unaffected.

- [ ] **Step 1.4 — Commit**

```bash
git add components/app-shell/site-switcher-slot.tsx components/app-shell/topbar.tsx
git commit -m "$(cat <<'EOF'
feat(phase19a): hide topbar SiteSwitcher on /dashboard only

Adds a Client wrapper that reads usePathname() and renders null when
the route is /dashboard. Mobile in-sheet SiteSwitcher unaffected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 — Org-scoped KPI queries + Active sites KPI

Today's `/dashboard` (line 112 onward) only queries when `currentSiteId` is non-null. Flip the queries to use `org_id = profile.org_id` and rely on RLS for cross-site fan-out. Add a 5th KPI **Active sites** (sites with `setup_completed_at IS NOT NULL`). Mark the first card with brand-purple accent (per spec).

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 2.1 — Replace the site-scoped Promise.all batch**

Replace the existing `if (canReadSite && currentSiteId)` block (lines 112-164) with an unconditional org-scoped batch. Note: the `canReadSite` gate goes away — RLS already enforces per-site access, so a user with zero accessible sites sees zero counts.

```tsx
// inside DashboardPage, replacing the site-scoped block:
const orgId = profile.org_id;
const [recentRes, openRes, s1s2Res, recordableRes, sitesRes] = await Promise.all([
  supabase
    .from("incidents")
    .select("id, ref_code, type, title, severity, track, status, occurred_at")
    .eq("org_id", orgId)
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(5),
  supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .neq("status", "closed"),
  supabase
    .from("incidents")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .in("severity", ["S1", "S2"])
    .neq("status", "closed"),
  supabase
    .from("incidents")
    .select("id, injured_persons(days_away, days_restricted, fatality), site_id")
    .eq("org_id", orgId)
    .eq("osha_recordable", true)
    .eq("is_sandbox", false)
    .is("deleted_at", null)
    .gte("occurred_at", yearStart)
    .lt("occurred_at", yearEnd),
  supabase
    .from("sites")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId)
    .not("setup_completed_at", "is", null),
]);
recentIncidents = recentRes.data ?? [];
openCount = openRes.count ?? 0;
s1s2Count = s1s2Res.count ?? 0;
const incs = recordableRes.data ?? [];
recordableCases = incs.length;
dartCases = incs.filter((inc) =>
  (inc.injured_persons ?? []).some((p) =>
    isDartCase({ days_away: p.days_away, days_restricted: p.days_restricted }),
  ),
).length;
const activeSitesCount = sitesRes.count ?? 0;

// TRIR/DART hours-worked is now the SUM across all sites in the org
// that have an annual-hours row for the current year.
const hoursRes = await supabase
  .from("site_annual_hours")
  .select("hours_worked, site:sites!inner(org_id)")
  .eq("year", year)
  .eq("site.org_id", orgId);
hoursWorked = (hoursRes.data ?? []).reduce(
  (sum, row) => sum + (row.hours_worked ?? 0),
  0,
) || null;
```

Also remove the now-unused `canReadSite` and `currentSiteId` gating around the recent-incidents block (we keep `recentIncidents` for now in case 19e wants to reuse; or remove if you prefer — we'll remove in Step 2.4).

- [ ] **Step 2.2 — Add Active sites as the first KPI card**

Update the `kpiCards` array — prepend Active sites:

```tsx
const kpiCards: Array<{
  label: string;
  value: string;
  tip: TooltipKey | null;
  hint: string;
  emphasis?: boolean;
}> = [
  {
    label: "Active sites",
    value: String(activeSitesCount),
    tip: null,
    hint: activeSitesCount === 0 ? "Create your first site" : "Setup completed",
    emphasis: true,
  },
  {
    label: "Open incidents",
    value: String(openCount),
    tip: null,
    hint: "Not yet closed",
  },
  {
    label: "S1 / S2 open",
    value: String(s1s2Count),
    tip: "severity_codes",
    hint: "Track A — full investigation",
  },
  {
    label: `TRIR (${year})`,
    value: formatKpi(trir(recordableCases, hoursWorked)),
    tip: "trir_dart_formula",
    hint: hoursWorked
      ? `${recordableCases} recordable / ${(hoursWorked / 1000).toFixed(0)}k hr`
      : "No annual hours set on any site",
  },
  {
    label: `DART (${year})`,
    value: formatKpi(dart(dartCases, hoursWorked)),
    tip: "trir_dart_formula",
    hint: hoursWorked ? `${dartCases} DART case${dartCases === 1 ? "" : "s"}` : "No annual hours set on any site",
  },
];
```

- [ ] **Step 2.3 — Render 5 cards with brand-purple accent on the first**

Replace the existing `<div className="grid grid-cols-2 gap-3 md:grid-cols-4">` block with a 5-up grid that emphasizes the first card:

```tsx
<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
  {kpiCards.map((c) => (
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
```

> **Brand accent rule:** uses `text-primary` / `bg-primary/5` / `border-primary/30` — NOT `bg-brand` (see `[[feedback-bg-brand-not-a-utility]]` in CLAUDE.md memory).

- [ ] **Step 2.4 — Remove the recent-incidents `<section>`**

Delete lines 324-379 of today's `app/(app)/dashboard/page.tsx` (the `canReadSite && (` block that renders the Recent incidents card). It returns reshaped (org-wide activity) in 19e. `LatestBulletinsCard` (line 381) stays.

Also delete the now-dead `recentIncidents` declaration and its query — the only thing that still uses it is the ArgusContextPayload `records` field; pass `[]` for now and let 19c repopulate from module aggregators.

- [ ] **Step 2.5 — Drop the worker "Reporting starts here" empty state**

Lines 383-396 (`!canReadSite && canReportIncident && ( … )`) are now redundant — with org-scope, every user with `incident:report` will see the new quick-actions row in 19c. Remove this block. The remaining `!currentSiteId` empty state (lines 398-411 "No sites yet") stays as-is for genuinely empty orgs.

- [ ] **Step 2.6 — Verify in the browser**

```bash
pnpm dev
```

Open `/dashboard`. Expected:
- 5 KPI cards in a row at `lg+`. First card "Active sites" with purple accent.
- KPI counts no longer change when you switch sites via the SiteSwitcher (since SiteSwitcher is now hidden anyway on /dashboard).
- TRIR/DART pulls together (sum of recordables across all sites, divided by sum of annual hours across all sites).
- "Recent incidents" card is gone. Latest bulletins card is still there.

- [ ] **Step 2.7 — Commit**

```bash
git add app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19a): org-scoped KPIs + Active sites + drop site recent-incidents

KPI strip rolls up across all sites the caller can access. Adds a 5th
'Active sites' KPI with brand-purple accent. TRIR/DART now sums
recordables and annual hours across sites. Removes the site-scoped
Recent incidents card (returns in 19e as org-wide activity).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 — Argus tile aggregators accept `siteId: null`

The four tile aggregators currently return `null` when called with `siteId: null` — we want them to instead query org-wide (relying on RLS for the per-site access scope).

**Files:**
- Modify: `lib/argus/tiles/overdue-investigations.ts`
- Modify: `lib/argus/tiles/stop-work-active.ts`
- Modify: `lib/argus/tiles/reportability-uncertain.ts`
- Modify: `lib/argus/tiles/capa-overdue.ts`

- [ ] **Step 3.1 — Generalize `overdue-investigations.ts`**

Replace the early `if (!siteId) return null;` guard with a conditional filter:

```ts
export async function getOverdueInvestigationsTilePayload(
  supabase: SupabaseClient<Database>,
  siteId: string | null,
): Promise<TileAggregatorPayload | null> {
  const today = new Date().toISOString().slice(0, 10);

  let q = supabase
    .from("investigations")
    .select("id, ref_code, due_date, updated_at, status")
    .is("deleted_at", null)
    .neq("status", "closed")
    .lt("due_date", today)
    .order("due_date", { ascending: true })
    .limit(20);
  if (siteId) q = q.eq("site_id", siteId);

  const { data, error } = await q;
  if (error || !data) return null;
  // ... rest unchanged
}
```

Crucially the function now returns a payload (count: 0) when there are no overdue investigations org-wide, instead of `null`. The dashboard render-gate that hides the tile when payload is null still works — it now hides only when the query errored, not when siteId is null.

- [ ] **Step 3.2 — Apply the same pattern to the other 3 tiles**

`stop-work-active.ts`, `reportability-uncertain.ts`, `capa-overdue.ts` — same change: replace the early null guard with a conditional `.eq("site_id", siteId)` filter.

- [ ] **Step 3.3 — Update the dashboard render to use the new behavior**

In `app/(app)/dashboard/page.tsx`, update the tile-block render to no longer require `currentSiteId`. Replace the `argusAvailable && currentSiteId && (...)` block with just `argusAvailable && (...)`:

```tsx
{argusAvailable && (
  <div className="grid gap-3 md:grid-cols-2">
    {canInvestigationRead && overdueInvPayload && (
      <ArgusInsightTile
        tile="overdue_investigations"
        payload={{ ...overdueInvPayload, siteId: null }}
      />
    )}
    {/* ... other 3 tiles, same pattern */}
  </div>
)}
```

The permission gates (`canInvestigationRead`, `canReadSite`, etc.) need to flip from `can(perm, currentSiteId)` to `orgCan(perm)` — when checking org-wide tile visibility we ask "does the user have this perm on ANY site in the org," which is what `orgCan` does today.

Update lines 73-79 of `dashboard/page.tsx`:

```tsx
const [
  argusAvailable,
  canInvestigationRead,
  canCapaRead,
  canReportRead,
  overdueInvPayload,
  stopWorkPayload,
  reportabilityPayload,
  capaOverduePayload,
  isOrgAdmin,
  checklistState,
] = await Promise.all([
  isArgusAvailable(profile.org_id),
  orgCan("investigation:lead"),
  orgCan("capa:complete"),
  orgCan("report:read"),
  getOverdueInvestigationsTilePayload(supabase, null),
  getStopWorkActiveTilePayload(supabase, null),
  getReportabilityUncertainTilePayload(supabase, null),
  getCapaOverdueTilePayload(supabase, null),
  orgCan("org:configure"),
  getChecklistState({ orgId: profile.org_id, userId: profile.id }),
]);
```

> **Note on `orgCan` vs `can`:** `orgCan(perm)` returns true if the user has `perm` on *any* site they're a member of (it's the org-scope availability check, see `lib/auth/orgCan.ts`). That's the right gate for "should we render this tile org-wide?" because the tile's data is filtered by RLS to only the rows the user can see.

- [ ] **Step 3.4 — Smoke test**

Open `/dashboard`. The 4 Argus tiles should render (assuming `argus_enabled` is on for the org and the user has `argus:use`). Each tile's "Analyse" button still works as before (idle by default per `[[feedback-argus-tiles-manual-analyse]]`). The count above each tile now reflects the org-wide rollup, not a single site.

- [ ] **Step 3.5 — Commit**

```bash
git add lib/argus/tiles/*.ts app/(app)/dashboard/page.tsx
git commit -m "$(cat <<'EOF'
feat(phase19a): Argus tile aggregators support org-wide rollup

When siteId is null, the four tile aggregators (overdue investigations,
stop-work active, reportability uncertain, CAPA overdue) drop the
site_id filter and fan org-wide via RLS. Dashboard render switches to
orgCan() permission gates.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 — `/sites/[id]` route stub

The map pins shipping in 19b need a navigation target. Land a thin stub now so the route exists; 19f replaces the stub body with the real per-site dashboard.

**Files:**
- Create: `app/(app)/sites/[id]/page.tsx`

- [ ] **Step 4.1 — Write the stub**

```tsx
// app/(app)/sites/[id]/page.tsx
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Construction } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";

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

  return (
    <div className="space-y-6">
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
        {!site.setup_completed_at && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Site setup not yet finished.{" "}
            <Link href="/admin/site-setup" className="font-medium underline">
              Finish setup →
            </Link>
          </p>
        )}
      </div>

      <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
        <Construction className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Site dashboard coming in Phase 19f</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Soon you&apos;ll see this site&apos;s KPIs, recent incidents, module tiles,
          and Argus signals on this page.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/incidents"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            View incidents →
          </Link>
          <Link
            href="/inspections"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            View inspections →
          </Link>
          <Link
            href={`/admin/sites/${siteId}`}
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Manage site →
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4.2 — Smoke test**

Open `/sites/<an-existing-site-uuid>` in the browser. Expected: the site name header + the placeholder card. Permission gate: a user without `incident:read_site` on that site is redirected to `/dashboard`. A bogus UUID returns 404. The topbar SiteSwitcher is visible here (since the path isn't `/dashboard`).

- [ ] **Step 4.3 — Commit**

```bash
git add "app/(app)/sites/[id]/page.tsx"
git commit -m "$(cat <<'EOF'
feat(phase19a): /sites/[id] route stub for per-site dashboard

Lands the public per-site route as a navigation target for the map
pins shipping in 19b. Body is a placeholder; 19f replaces it with the
real site dashboard.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 — Self-verification + PR

- [ ] **Step 5.1 — Lint + build**

```bash
pnpm lint
pnpm build
```

Expected: both clean. Build may print warnings about the larger `/dashboard` bundle from the now-richer KPI data — that's fine.

- [ ] **Step 5.2 — Manual smoke checklist**

Open the dev server and walk through:

1. `/dashboard` — SiteSwitcher hidden in the topbar. KPI strip has 5 cards, first one purple, "Active sites" count matches `select count(*) from sites where setup_completed_at is not null and org_id = '<your-org>'`.
2. Switch the URL to `/incidents` — SiteSwitcher returns in the topbar.
3. On mobile width (< lg), open the sidebar sheet — the in-sheet SiteSwitcher still appears on every route (including `/dashboard`). This is intentional; the hide rule is desktop-only.
4. `/dashboard` with `argus_enabled=true` and `argus:use` granted — 4 Argus tiles render, each with an "Analyse" button.
5. `/sites/<valid-site-id>` — site name header + Phase 19f placeholder card.
6. `/sites/<random-uuid>` — 404.
7. `/sites/<a-site-the-user-cannot-read>` — redirects to `/dashboard`.

- [ ] **Step 5.3 — Push branch + open PR**

```bash
git push -u origin feat/phase-19a-org-dashboard-foundation

gh pr create --title "feat: phase 19a — org dashboard foundation" --body "$(cat <<'EOF'
## Summary
- Hide topbar SiteSwitcher on `/dashboard` only (Client wrapper).
- Flip `/dashboard` KPIs from site-scoped to org-scoped; add a 5th **Active sites** KPI with brand-purple accent.
- Extend the 4 Argus tile aggregators to accept `siteId: null` (= org-wide).
- Remove site-scoped recent-incidents card from `/dashboard` (returns reshaped in 19e).
- Add `/sites/[id]` route stub as the map click target (real page lands in 19f).

## Changes
- `components/app-shell/site-switcher-slot.tsx` — new Client wrapper
- `components/app-shell/topbar.tsx` — use the slot
- `app/(app)/dashboard/page.tsx` — org-scoped queries + Active sites KPI
- `lib/argus/tiles/*.ts` — siteId null = org-wide
- `app/(app)/sites/[id]/page.tsx` — new stub

## Test Plan
- [ ] `/dashboard` shows 5 KPIs, SiteSwitcher hidden
- [ ] `/incidents` still shows SiteSwitcher
- [ ] Argus tiles roll up org-wide; "Analyse" still gated per `[[feedback-argus-tiles-manual-analyse]]`
- [ ] `/sites/<valid-id>` shows the placeholder; `/sites/<bogus>` is 404
- [ ] `pnpm lint` + `pnpm build` clean

Closes Phase 19a.
🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5.4 — Append to `docs/BUILD_STATUS.md` on merge**

Once the squash lands on main, append a Phase 19a entry to `docs/BUILD_STATUS.md` following the standing convention (per `[[feedback-build-status-canonical-location]]`).

---

## Self-review

- Spec coverage: ✓ §Architecture & routing locked. ✓ Active sites KPI (5th). ✓ Argus tile org-wide pivot. ✗ Map (defer 19b), ✗ quick actions (19c), ✗ charts (19d), ✗ activity/drafts/assets/docs (19e), ✗ real per-site dashboard (19f). Out-of-scope items are tracked in their respective plan files.
- Placeholder scan: no TBD / TODO / "appropriate error handling" — verified.
- Type consistency: `SiteSwitcherSlot` props match `SiteSwitcher` props. Argus tile signature change (`siteId: null` semantically meaningful) consistent across all 4 files.
