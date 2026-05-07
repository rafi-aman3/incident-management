# Phase 6b — Incidents redesign + polish

**Status:** drafted 2026-05-06; audit refreshed 2026-05-07; **expanded 2026-05-07** to include `/incidents` redesign per stakeholder mock + prompt
**Goal:** Replace `/incidents` with the rich Incident-Management layout from `assets/incident-management.png` (KPIs + 12-month trend + breakdowns sit on top of the existing search/filter/table). Polish the 3-step wizard visually + functionally without restructuring it. Polish the detail page.
**Branch:** `feat/phase-6-incidents-polish` (in flight; current commit `96cf900` carries the refreshed audit plan)
**PR target:** `main`
**Pages affected:** `/incidents` (redesign), `/incidents/new/[step]` (visual + UX polish), `/incidents/[id]` (polish)

> **What this PR ships:**
> - **`/incidents` redesign** per `assets/incident-management.png` + the prompt: header band → 4-tile KPI row (Total / High-Critical / Under Investigation / This Month-with-trend-pill) → 3-or-4-tile rate row (Days Since Last + per-site-rate-selection: TRIR/DART for US, LTIFR/TRIFR for GB, all-three when "All sites") → 12-month area trend chart → 4 breakdown cards (By Type · By Severity donut · By Track · Top Sites) → existing search + filter chips + table at the bottom, polished alongside.
> - **Wizard visual polish** matching `assets/incident-reporting{,-2,-3}.png`: header treatment (icon + title + subtitle + breadcrumb), tab-pill style for the step indicator, "Saved Xh ago" right-rail indicator, "All changes saved" footer, witness card layout (relationship-to-incident dropdown + accuracy checkbox).
> - **Wizard UX polish** (from the 6b audit): save-and-exit on Step 3, future-date validation on Step 1, "Finalize report" copy + explainer with notification recipient list, witness-carryover helper text under the Witnesses block.
> - **Detail polish** (from the 6b audit): Suspense boundaries + parallelized queries, soft-deleted incident → "deleted notice" card (not 404), full severity-override audit history (not just latest), dark-mode token sweep on `badges.tsx` + linked-asset card + `StatusBadge`.
> - **Cross-cutting**: copy standardization across the three surfaces ("Report incident" → wizard "Finalize report" → modal "Override severity"); sandbox toggle on `/incidents` gated by `can("site:configure")`.
> - No new schema, no new RPCs, no new perm keys.

> **Not in this PR (deferred to specific phases):**
> - **No "Generate with Argus" button** on `/incidents` or in the wizard. Argus = our equivalent of the references' ARIA, planned as **Phase 09** (`plans/09-argus-ai-assistant.md` — stub dropped alongside this plan).
> - **No Safety Bulletin step** in the wizard (the references' Step 3). It's a real feature — bulletin metadata, alert categorization, distribution list, ideally PDF render. Planned as **Phase 10** (no plan file yet).
> - **No 3→4 step wizard restructure**. Without Safety Bulletin the references' Step 3 has no anchor (Witnesses → ??? → Photos doesn't justify itself). Restructure rides on top of Phase 10 once the bulletin lands; until then 3 steps is the right structure and the "Review and finalize" Step 3 stays — its severity / track / notification preview is a UX win the references lose.
> - ~~No status pipeline cards~~ → **Included** per stakeholder confirmation 2026-05-07: 4-card status-counter row sits above the list table — Reported / Investigating / Action Required / Closed with proportional progress bar fills. Maps onto our `incidents.status` enum: `reported`/`draft` → "Reported", `triaged`/`investigating` → "Investigating", `awaiting_capa`/`capa_in_progress` → "Action Required", `closed` → "Closed".
> - **No CSV export button** in the list filter bar. The list is already URL-shareable; CSV export is its own affordance, logged as v2.
> - **No approval tabs** (Draft / Under Review / Approved / Rejected) — our state machine doesn't have an approval workflow; status is exposed via the existing status filter chips.
> - **No live-data realtime push** on the KPI tiles (Supabase Realtime channels). Server-rendered numbers + on-navigation refresh is sufficient for v1.

---

## Why this scope

Phase 6 is "polish" but the user's reference + prompt for `/incidents` is a redesign — keeping the rest of the polish work moving forward inside the same PR is cheaper than splitting branches because (a) most of the original list-page audit findings (Suspense, sm-breakpoint card-list, sandbox gate, copy) get **superseded** when we rewrite the page from scratch, and (b) the wizard + detail polish are independent of the list rebuild and ride alongside without coupling. One review window, one branch, one merge.

The wizard and detail pages **stay structurally as they are** — only visuals + UX gaps change. Restructure is a Phase 10+ concern once Safety Bulletin gives Step 3 a reason to exist.

---

## Audit findings carried over (from `96cf900`)

The 2026-05-07 audit identified 15 gaps. **5 are obsoleted by the `/incidents` redesign** (no Suspense on list — fixed by `loading.tsx`; no sm card-list collapse — fixed by new layout; copy inconsistency on list — fixed by header rewrite; raw `error.message` on list — fixed by branded error card; sandbox toggle visibility — fixed by gate). **10 remain as polish work in this PR**:

| Surface | Gap | Fix |
|---|---|---|
| Wizard Step 1 | No future-date validation | Zod `.refine((v) => new Date(v) <= new Date(), "Cannot report future events")` |
| Wizard Step 2 | Witnesses block has no carryover helper | Helper text under the Witnesses heading: "Statements will be available to the assigned investigator." |
| Wizard Step 3 | **No save-and-exit affordance** | `Save draft & exit` link → `/incidents` (draft already persisted) |
| Wizard Step 3 | "Submit incident" → no explainer | Rename to "Finalize report" + helper "Starts the regulatory clock and notifies <N> people" + recipient list |
| Wizard (all) | Header is plain; no draft-saved indicator; no "All changes saved" footer | Match reference treatment in `wizard-shell.tsx` |
| Detail | Sequential `await` blocks render | `Promise.all()` + Suspense around aside cards |
| Detail | Soft-deleted hits 404 with no notice | Branch on `error?.code === "PGRST116"` → "Access denied"; on `deleted_at IS NOT NULL` → "This incident was deleted by an admin." |
| Detail | Severity-override audit shows only latest | Render full reverse-chrono list (collapsible past 3 entries) |
| Detail | Dark-mode literals (`text-white`, raw `dark:bg-amber-950`) | Replace with tokens; verify badge contrast in dark mode |
| Detail | Override modal focus-trap untested | Audit Radix Dialog + ESC behavior |

The **C-tier items from the original audit** (type-card arrow-key nav, body-map arrow-key nav) are **dropped from this PR** — keyboard-power-user polish that's better addressed in a dedicated a11y pass. Logged for v2.

---

## `/incidents` redesign spec

### Layout (desktop ≥ 1280px)

```
┌── Header band ─────────────────────────────────────────────────┐
│ Home > Incidents          [destructive icon] Incidents   [Report incident →] │
│                            ISO 45001 · ISO 45002 · RIDDOR · Near Miss        │
└────────────────────────────────────────────────────────────────┘
┌── KPI row 1 (4 tiles, 16px gap) ───────────────────────────────┐
│ Total Incidents │ High / Critical │ Under Investigation │ This Month (trend) │
└────────────────────────────────────────────────────────────────┘
┌── KPI row 2 (3 or 4 tiles depending on site scope) ────────────┐
│ Days Since Last │ TRIR │ DART  (single US site)                 │
│ Days Since Last │ LTIFR │ TRIFR (single GB site)                │
│ Days Since Last │ TRIR │ LTIFR │ TRIFR  (all sites)             │
└────────────────────────────────────────────────────────────────┘
┌── Trend chart ─────────────────────────────────────────────────┐
│ INCIDENTS OVER TIME · Monthly count — last 12 months           │
│                                                                 │
│         ╱╲                                                      │
│        ╱  ╲___╱╲___╱─────                                       │
└────────────────────────────────────────────────────────────────┘
┌── Breakdown row (4 cards) ─────────────────────────────────────┐
│ By Type   │ By Severity (donut) │ By Track   │ Top Sites        │
└────────────────────────────────────────────────────────────────┘
┌── Existing list surface (search + filter chips + table) ───────┐
│ search… │ All Categories ▾ │ All Severities ▾ │ All Statuses ▾ │
│ chip chip chip                                                 │
│ ┌─Table───────────────────────────────────────────────────────┐ │
│ │ ref · type · severity · status · track · occurred_at · …    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**Mobile collapse**: KPI rows → 2-col below `md`, 1-col below `sm`. Trend chart full-width always (recharts handles its own width). Breakdown cards → 2-col below `md`, 1-col below `sm`. Search + filters wrap.

### New components

All under `components/incidents/list/`:

- **`page-header.tsx`** — breadcrumb + title + subtitle + Report-incident CTA. Server component.
- **`kpi-card.tsx`** — primitive matching the prompt's spec: 4px colored left border, uppercase tracking-wide label, big tabular value, sub-line, optional formula line, optional trend pill, right-aligned color-tinted icon. Accent prop `'destructive' | 'warning' | 'amber' | 'brand' | 'success' | 'info'` maps to `{ borderLeftColor, iconBg (8% alpha tint), iconFg, valueFg }` — all OKLch tokens from `docs/design.md`, no hex literals. Server component (no client logic).
- **`trend-pill.tsx`** — small bottom-right badge: `↗ N vs last mo` / `↘ N vs last mo` / `— same vs last mo`. Tone is `destructive` if direction `up` (more incidents = bad), `success` if down, `muted` if flat. Server component.
- **`incidents-over-time.tsx`** — recharts `<AreaChart>`, 12 month buckets (`MMM YY`), single destructive-colored area + gradient fill from 25% to transparent, integer y-ticks starting at 0, max = `ceil(maxCount × 1.2)`, hover tooltip month + count, empty months = 0. Client component (recharts).
- **`breakdown-card.tsx`** — list-style: header (uppercase label + optional "top N"), then horizontal bar list. Used for By Type, By Track, Top Sites. Empty state copy "No incidents yet." or equivalent. Server component (CSS-only bars).
- **`donut-breakdown.tsx`** — recharts donut for By Severity, color per `docs/design.md` §13 severity palette, center label = total count, legend below. Client component.

### New queries

`lib/queries/incidents-list.ts` — typed functions, all RLS-bound (no service-role), return serializable shapes:

- `getKpiCounts(scope: SiteScope) → { total, highCritical, underInvestigation, thisMonth, prevMonth, daysSinceLast }`
- `getFrequencyRates(scope) → { trir, dart, ltifr, trifr, hours, countersByKind }` — pulls per-site `site_annual_hours` for the current year; returns `null` rates when hours not set.
- `getMonthlyTrend(scope) → Array<{ bucket: Date, count: number }>` (12 entries; left-join against generated 12-month series so missing months = 0)
- `getBreakdowns(scope) → { byType, bySeverity, byTrack, topSites }`

`SiteScope = { kind: 'single', siteId: string } | { kind: 'all', siteIds: string[] }`. Read from session — default = all sites the user can see (RLS); URL param `?site=<id>` narrows to one site.

### Format helpers

`lib/format/kpi.ts` extends with **`ltifr(numerator, hours)`** and **`trifr(numerator, hours)`** matching the existing `trir` / `dart` signatures. Multiplier is `1_000_000` (vs `200_000` for OSHA rates). Same zero-hours guard (`return 0` not `NaN`/`Infinity`). Tests in `lib/format/kpi.test.ts` cover: zero hours, normal case, very small denominator. New tests added next to existing trir/dart tests.

### Per-site rate selection logic

In `getFrequencyRates`, branch on the scope's site countries:
- `single US site` → return `{ trir, dart }`, omit ltifr/trifr
- `single GB site` → return `{ ltifr, trifr }`, omit trir/dart
- `all sites` → return `{ trir, ltifr, trifr }` (skip DART because it's US-only and the all-sites view shouldn't claim a US metric across all rows)

Page reads which fields are present and renders the matching tile set (3 or 4 tiles in row 2).

### Empty state

If `total === 0` for the current scope, **still render every tile and chart** but each shows its own empty state ("—", "No incidents yet."). Don't fold the page to a single "no data" card — the layout itself is the demo.

### `loading.tsx`

`app/(app)/incidents/loading.tsx` (NEW) renders skeletons matching the post-load layout exactly: 7 KPI tile skeletons, 360px chart skeleton, 4 breakdown skeletons, search bar skeleton, table skeleton with ~5 rows. Uses shadcn `Skeleton` with widths matching the real cards.

### Page rewrite

`app/(app)/incidents/page.tsx` becomes a server component with one `Promise.all` batch at the top hitting all four query functions, then renders `<PageHeader/>`, `<KpiRow1/>`, `<KpiRow2/>`, `<IncidentsOverTime/>`, `<BreakdownRow/>`, `<ListSurface/>` (the existing search + filter + table, extracted into a client component). Existing URL-driven filter logic (`?type=...`, `?severity=...`, etc.) is preserved verbatim — no breaking change to bookmarked URLs.

---

## Wizard visual + UX polish

### `components/incidents/wizard/wizard-shell.tsx` (new or rework existing layout)

- Header: destructive-tinted icon + "Report Incident" title + subtitle "Complete all three steps to create a full investigation package" + breadcrumb above.
- Right rail: "Saved Xh ago" indicator (computed from `incidents.updated_at` of the draft row).
- Footer: left = ← Back / right = Next or Submit / right of right = "All changes saved" green-dot indicator.
- Tab pills: matching reference's green-bordered active pill style, gray-bordered inactive pills.

### `components/incidents/wizard/step-1-what-happened.tsx`

- Add Zod `.refine((v) => new Date(v) <= new Date(), "Cannot report future events")` on `occurred_at`.
- Visual touches: cleaner card borders, type-card icons sized consistently.

### `components/incidents/wizard/step-2-details.tsx`

- Witnesses block: add helper text below heading ("Statements will be available to the assigned investigator.").
- Witness card layout match: relationship-to-incident dropdown (already a field; just visual), accuracy checkbox at the bottom of each witness card ("Witness has confirmed this statement is accurate to the best of their knowledge").

### `components/incidents/wizard/step-3-review.tsx`

- Footer changes: add a third element — `Save draft & exit` link routed to `/incidents` (draft already persisted; no save-action call needed).
- Submit button: rename to **"Finalize report"**.
- Add explainer below button: "Starts the regulatory clock and notifies <N> people: <names…>". Recipient list comes from a new `getNotificationRecipients(incidentDraftId)` helper in `lib/workflow/notifications.ts` that returns the same list the engine *would* dispatch on finalize, **without** dispatching. Just a server query — no schema change.

---

## Detail page polish

`app/(app)/incidents/[id]/page.tsx`:

- Wrap each aside card in `<Suspense fallback={<CardSkeleton />}>`.
- Convert sequential `await` chain (lines 19–75) into `Promise.all`.
- Branch on no-row case: if Supabase returned `error?.code === "PGRST116"` → render "Access denied" card; else if `deleted_at IS NOT NULL` lookup matches → render "This incident was deleted by an admin." card.
- Severity-override card: render full reverse-chrono list. Collapse past 3 entries behind a "Show all (N)" toggle. Each row: previous severity → new severity, reason, by-whom, at-when.
- Severity-override modal (`components/incidents/triage-modals.tsx`): keyboard walkthrough — verify Radix Dialog focus trap holds, ESC closes, focus returns to trigger.
- Dark mode: replace `text-white` literals in `components/incidents/badges.tsx` (lines 5–9) with `dark:text-foreground` or token-aware contrast; replace raw `dark:bg-amber-950` in `StatusBadge` (line 68) with a token; linked-asset card `bg-muted/30` already token-based but verify in dark mode.

---

## Acceptance criteria

1. `/incidents` renders with all KPI tiles, trend chart, and breakdowns at desktop ≥ 1280px matching the prompt's structure.
2. With seed data the page lights up real numbers; with empty data each tile shows its empty-state copy and the page still renders without errors.
3. Per-site rate selection works: switch site in topbar → rate row reflects US (TRIR/DART), GB (LTIFR/TRIFR), or all-sites (3-rate row).
4. `loading.tsx` renders skeletons matching the post-load layout — no layout shift on hydration.
5. Mobile collapses cleanly to 1-col below `sm`, 2-col between `sm` and `md`.
6. No hex literals in any new component; all colors via tokens.
7. Wizard: Save-and-exit from Step 3 lands on `/incidents` with draft visible. Future-date rejected on Step 1. "Finalize report" button shows recipient names below it.
8. Wizard refresh-survives between steps (kill tab on Step 2, reopen, land on Step 2 with state intact).
9. Wizard finalize is idempotent (double-click → one report).
10. Detail: soft-deleted incident → notice card, not 404. Override audit shows full reverse-chrono history. Dark mode passes spot check on every badge.
11. Sandbox toggle hidden for users without `site:configure`.
12. Smoke test (`docs/smoke-test-phase2.md` capture section) re-runs green.
13. PR description includes before/after screenshots for `/incidents` redesign + wizard header treatment + detail dark mode.

---

## Smoke test additions (will draft `docs/smoke-test-phase6b.md` during execution)

- Sign in as site_admin → `/incidents` → confirm 7 tiles + trend + 4 breakdowns + list table render.
- Switch site to GB → row 2 changes to LTIFR/TRIFR (no DART tile).
- Switch site to "All sites" → row 2 expands to 4 tiles.
- Set `site_annual_hours = 0` in seed → rates render `0.00` not NaN/Infinity.
- Sign in as worker → `/incidents` → page renders with same tiles (RLS-bound). Sandbox toggle hidden.
- Click "Report incident" → wizard Step 1 → fill → "← Back" → returns to `/incidents` → Save-and-exit on Step 3 round-trip works.
- Pick tomorrow as `occurred_at` → Step 1 rejects with field error.
- Submit a draft → notification recipient list rendered before submit. After submit → land on detail page.
- Detail page: soft-delete an incident via SQL → visit `/incidents/<id>` → "deleted" notice card.
- Toggle `class="dark"` on `<html>` → spot-check every badge + linked-asset card.

---

## File list

**New:**
- `app/(app)/incidents/loading.tsx`
- `components/incidents/list/page-header.tsx`
- `components/incidents/list/kpi-card.tsx`
- `components/incidents/list/trend-pill.tsx`
- `components/incidents/list/incidents-over-time.tsx`
- `components/incidents/list/breakdown-card.tsx`
- `components/incidents/list/donut-breakdown.tsx`
- `components/incidents/wizard/wizard-shell.tsx` (or extend the existing layout if one exists; verify during execution)
- `lib/queries/incidents-list.ts`
- `docs/smoke-test-phase6b.md`

**Rewritten:**
- `app/(app)/incidents/page.tsx`

**Edited:**
- `app/(app)/incidents/[id]/page.tsx`
- `components/incidents/wizard/step-1-what-happened.tsx`
- `components/incidents/wizard/step-2-details.tsx`
- `components/incidents/wizard/step-3-review.tsx`
- `components/incidents/wizard/wizard-progress.tsx` (tab pill style)
- `components/incidents/badges.tsx` (dark-mode tokens)
- `components/incidents/triage-modals.tsx` (focus-trap audit; likely no code change)
- `lib/format/kpi.ts` (extend with `ltifr`, `trifr`)
- `lib/format/kpi.test.ts` (extend tests)
- `lib/workflow/notifications.ts` (add `getNotificationRecipients` query helper, no dispatch)

---

## Confirmed decisions (2026-05-07)

1. **Status pipeline** — included. Renders as a 4-card row above the list table with proportional progress fills (each card shows count + share-of-total).
2. **"Days Since Last Incident" thresholds** — ≤7 → "Recent — under review", ≤30 → "Watching", else "Sustained" (UX cadence, not regulatory).
3. **`SiteScope`** — default = all sites the user has membership on (per `site_members` + `include_children` BFS, same logic Planner uses); `?site=<id>` URL param narrows to one site.
4. **`KPICard` accent `amber`** — maps to severity-S3 amber token from `docs/design.md` §2 / `globals.css` (`bg-sev-3` foreground, 8% alpha background tint).
