# Phase 6i — Planner polish

**Status:** re-audited 2026-05-08 against shipped reality on `main` (replaces the 2026-05-06 stub which was written before the page existed). Phase 6 module 9 of 10.
**Goal:** The Planner is the smallest module by route count (1 page) but the densest by data shape — it merges 6 event sources into one calendar. Polish focus: complete state coverage (loading / error / empty branches), calendar-grid keyboard a11y, chip-level a11y + tooltips, mobile collapse strategy (the page currently overflows below tablet), per-source failure visibility, edge-case empty states (no accessible sites, all kinds disabled, currentSite missing).
**Branch:** `feat/phase-6-planner-polish`
**PR target:** `main`
**Pages covered:** `/planner` (one route)

> **What this PR ships:**
> - 10-item polish checklist applied to `/planner` (audit table below).
> - State coverage: new `loading.tsx` (calendar shell skeleton) + `error.tsx` (brand error card with retry) at `app/(app)/planner/`.
> - Drop the `Module 5` eyebrow above the page title (matches the eyebrow drops on 6b/6c/6d/6e/6f/6g/6h).
> - Empty-state differentiation: org-fresh / filtered-down / all-kinds-disabled / no-accessible-sites all get distinct copy + recovery affordances. `<PlannerDay>`'s "No events scheduled" stays as-is (it already covers the day-view leaf case).
> - **Chip discoverability:** event-type chips gain `title=` tooltips ("Click to hide / show <kind> events"). Chip rendered text already self-documents under `aria-pressed`.
> - **EventChip a11y:** add explicit `aria-label` (full label including time + site, mirroring the existing mouse-only `title=`). The chip stays a `<Link>` (the click target).
> - **Calendar-grid a11y:** wrap the month grid in `role="grid"` + per-row `role="row"` + per-cell `role="gridcell"` with `aria-label` per cell ("Tuesday, May 12, 3 events"). View toggle migrates to WAI-ARIA radiogroup (single-select filter pattern; mirrors the 6f Templates industry-filter precedent — radiogroup, not tablist, for filters that don't swap panels).
> - **Native date input** gets an `aria-label` ("Calendar date").
> - **Site-picker hardening:** fix the edge case where `currentSiteId` is null but `siteParam === ""` (the Select renders `value="current"` with no matching `<SelectItem>`, throwing a runtime warning). Falls back to `value="all"` when no current site exists.
> - **Mobile collapse:** wrap month + week grids in `overflow-x-auto` with a min-width threshold so they horizontally scroll instead of cramming into a sub-tablet viewport. Filter row already wraps via `flex-wrap` and is fine. Day view is mobile-friendly as-is. Per `docs/design.md` §8: "data tables: full → priority columns + horizontal scroll" — same family.
> - **Per-source failure visibility:** aggregator promoted from `Promise<PlannerEvent[]>` to `Promise<{ events: PlannerEvent[]; failedKinds: PlannerEventKind[] }>`. Per-source fetcher still returns `[]` on error (existing "swallow + continue" contract preserved) but also names the kind in `failedKinds`. Page renders a quiet warning pill above the calendar when `failedKinds.length > 0`: "1 source failed to load (CAPA due) — refresh to retry". No retry button (the only sensible recovery is a full page reload — synthesizing a per-source retry without rebuilding the page-level data flow isn't worth the complexity for a v1 read-only surface).
> - **Day view header:** add the site name (when one site is selected) and a "← Back to Month" link that preserves `?date=` + filters (mirrors the `+N more` URL-builder pattern).
> - Smoke test (`docs/smoke-test-phase5.md`): extend with the new polish checkpoints.

> **Not in this PR (intentional v1 boundaries — already deferred in `plans/05-planner.md`):**
> - **No drag-to-reschedule.** v2.
> - **No event creation from the planner.** v2.
> - **No iCal / Google Calendar export.** v2.
> - **No conflict detection.** v2.
> - **No team / user lanes.** v2.
> - **No timezone-aware multi-day events.** v2.
> - **No recurring-inspection materialization preview** (active assignments showing as "scheduled" lanes ahead of `started_at`). The Phase 5 stub left this as a follow-up; recurring cron itself is a v2 item.
> - **No printable view.** v2.
> - **No mobile-optimized week view.** Phase 5 plan locked "sm-breakpoint collapse to Day view is good enough"; `overflow-x-auto` is the lighter v1 fix.
> - **No keyboard arrow-key navigation between calendar cells.** Discussed in §Open Q1 — recommend deferring (proper grid-keyboard nav requires `tabindex="-1"` roving + `aria-rowindex` + custom keydown handler; the chip Tab order already covers the day-by-day reading order). Logging in SPEC §15 if we ship without it.
> - **No "Show sandbox" admin toggle.** Aggregator currently relies on per-table RLS for sandbox isolation. RLS already returns sandbox incidents to the reporter + admins, so they leak through into the planner — but per SPEC §6 sandbox events surfacing on the planner *for the people who can already see them* is the intended behavior. Adding a UI toggle would be net-new feature work; logged as v2 alongside the broader sandbox-mode polish.

---

## Audit table — `/planner`

| # | Dimension | Status | Finding (against shipped code) | Fix in this PR |
|---|---|---|---|---|
| 1 | Visual fidelity | ⚠️ | `Module 5` eyebrow still on title (6b/6c/6d/6e/6f/6g/6h all dropped theirs). Otherwise tokens are clean — `bg-brand`, `bg-brand-soft`, `bg-warning`, `bg-destructive`, `bg-success`, `bg-sev-1..5` all in use; today highlighted with `bg-brand text-white` outline; out-of-month cells dimmed via `bg-muted/20`. | Drop the `Module 5` eyebrow. No other token changes. |
| 2 | Empty state | ❌ | One generic empty pill renders below month/week views: "No events in this window. Try a different date or toggle on more event types." Doesn't distinguish (a) org-fresh / no events anywhere, (b) filtered-down by chips, (c) ALL chips disabled, (d) no accessible sites. PlannerDay's "No events scheduled" is fine (terminal leaf). | Branch the empty-state copy on `enabledKinds.length`, `accessibleSites.length`, and whether any kind is disabled. Add a "Clear filters" chip to (b)/(c) that strips `?<kind>=0` params; add a "You have no accessible sites" callout to (d) pointing the user at /admin/sites. |
| 3 | Loading state | ❌ | No `loading.tsx` — page navigations (date stepper, view toggle, kind toggle) momentarily blank the calendar. | Add `app/(app)/planner/loading.tsx`: header band + filter row skeleton + month-grid skeleton (7×6 tiles with chip placeholders). |
| 4 | Error state | ❌ | No `error.tsx`. The aggregator swallows per-source errors but `requireUser()` / sites query / cookie store throws bubble up to the framework default. | Add `app/(app)/planner/error.tsx`: brand destructive-bordered card with a Retry button that calls `reset()`. Aggregator-level swallowing stays — this catches the *outside* shell. |
| 5 | Responsive | ⚠️ | Filter row wraps fine via `flex-wrap`. Month + week grids are 7 fixed columns (`grid-cols-7`) with `min-h-[88px]` / `min-h-[280px]` cells — at <640px the grid forces horizontal overflow on the body, triggering page-level horizontal scroll. | Wrap the month + week grid containers in `overflow-x-auto` with a parent `min-w-[640px]` on the grid itself. Page body stops scrolling horizontally; the calendar gets its own scroll context. (Forcing Day view at sm was considered — adds a class of "where did my month go" surprise without buying much; horizontal scroll is the lighter, more discoverable fix.) |
| 6 | A11y / keyboard | ❌ | (a) Month grid: pure nested `<div>`s — no `role="grid"`, no per-cell role/label. (b) View toggle: 3 raw `<button>`s without group semantics — should be a `radiogroup` (single-select filter, no panel swap). (c) Date input: no label or aria-label. (d) EventChip: `title=` only (mouse-hover) — no `aria-label`; screen readers fall back to inner text (icon + truncated title), losing the date + site. (e) Event-type chips: `aria-pressed` already in place ✓. (f) "+N more" link reads as bare "+3 more" — no context. | (a) Add `role="grid"` + `role="row"` (per-row wrappers) + `role="gridcell"` + `aria-label="<weekday>, <full date>, <N> events"` per cell. (b) Migrate view toggle to `role="radiogroup"` + per-button `role="radio"` + `aria-checked` (mirrors 6f Templates industry-filter pattern). (c) Add `aria-label="Calendar date"` to the date input. (d) EventChip gets `aria-label={fullLabel}` (existing `title=` value). (e) Keep. (f) "+N more" link gets an `aria-label="View all N events on <full date>"`. |
| 7 | Form-error UX | n/a | No forms — URL is the state vehicle. | — |
| 8 | Copy | ⚠️ | Generic empty copy (covered by #2). Site picker reads "Current site · Houston" / "All accessible sites" — fine. View toggle labels Month/Week/Day — fine. Chip labels "Incident", "Inspection started", "Inspection completed", "CAPA due", "Asset PM", "Investigation due", "Regulatory deadline" — fine. | Empty-state copy rewrite (covered in #2). Add `title="Click to hide <kind> events"` / `title="Click to show <kind> events"` on chip buttons (the rendered label is the kind name, so the tooltip explains the *toggle action*). |
| 9 | Dark mode | ✅ | `bg-brand`, `bg-brand-soft/30`, `bg-muted/20`, severity tokens (sev-1..5), warning/destructive/success — all token-driven; explicit `text-white` only on severity bands and brand-bold (intentional — those are dark backgrounds in both themes, matches `<SeverityBadge>`). | No change. |
| 10 | Cache Components | ✅ | `searchParams` is `Promise<...>` and awaited (line 96). No `'use cache'` boundaries — correct: every read is user-scoped via `requireUser` + RLS, no caching candidate. No `runtime` export. | No change. |

---

## Per-component fixes (concrete)

### `app/(app)/planner/page.tsx`

1. Drop the `Module 5` eyebrow (`<p>Module 5</p>` → removed).
2. Site-picker edge case: if `currentSiteId === null` and `siteParam === ""`, set the `<Select value=>` to `"all"` instead of `"current"`. (Today the Select gets `value="current"` and there's no matching `<SelectItem>` to render — radix-ui logs a warning and the trigger goes blank.)
3. No-accessible-sites branch: if `accessibleSites.length === 0` (rare but possible for newly invited users not yet attached to a site), render a dedicated empty card pointing at `/admin/sites` (`site_admin` viewers) or "Ask your admin to add you to a site" (other viewers). Skip the calendar render entirely.
4. Plumb the new aggregator return shape (`{ events, failedKinds }`) and render the per-source-failure pill (see new component below).
5. Branch the bottom empty pill into the 4 distinct copy variants from audit row #2.

### `lib/planner/aggregate.ts`

1. Promote return type from `PlannerEvent[]` to `{ events: PlannerEvent[]; failedKinds: PlannerEventKind[] }`.
2. Each `fetch*` helper currently returns `[]` on error. Refactor to return `{ kind, events, failed }` and let the orchestrator collect `failedKinds` from those that report `failed: true`. Same per-source isolation; one extra signal exposed.
3. No new SQL, no new tables.

### `components/planner/planner-month.tsx`

1. Add `role="grid"` to the outer cells container (line 53).
2. Wrap each row of 7 cells in a `role="row"` div — currently every cell is a sibling of all 35/42 cells, which means no row context for ATs.
3. Per cell: `role="gridcell"` + `aria-label="<EEEE>, <PPP>, <N> event<s>"` (e.g. "Tuesday, May 12, 2026, 3 events").
4. "+N more" link: add `aria-label="View all <total> events on <PPP>"`.
5. Wrap the entire grid in `<div className="overflow-x-auto"><div className="min-w-[640px]">…</div></div>` so sub-tablet widths get horizontal scroll instead of a body-level overflow.

### `components/planner/planner-week.tsx`

1. Same `overflow-x-auto` + `min-w-[640px]` wrapper as the month grid.
2. No grid-role pass for week (it's a 7-column lane layout, not a calendar grid — `role="grid"` would mislead). Per-day cell still gets `aria-label="<EEEE> <d MMM>, <N> events"`.

### `components/planner/planner-day.tsx`

1. Add a "← Back to Month" link in the header that builds `/planner?view=month&date=<same date>&<preserved filters>`. Preserves the user's mental thread when they drilled in via "+N more".
2. Add the site name to the header when `siteParam` resolves to a single site (fall through `accessibleSites` to find the name; thread the resolved `siteName` from page.tsx as a prop).

### `components/planner/planner-filters.tsx`

1. View toggle: migrate to `role="radiogroup"` + per-button `role="radio"` + `aria-checked={view === v.value}` + `aria-label="Calendar view"` on the group.
2. Date input: `aria-label="Calendar date"`.
3. Site picker `<SelectTrigger>`: keep `aria-label="Site filter"` (already present).
4. Event-type chips: add `title="Click to {hide|show} <PLANNER_EVENT_LABEL[kind]> events"`. Keep `aria-pressed`.
5. Today button: keep `aria-label="Jump to today"`-style tooltip — actually visible label "Today" is fine without an aria-label.

### `components/planner/event-chip.tsx`

1. Add `aria-label={fullLabel}` to both `size="sm"` and `size="md"` variants. The existing `title=` (mouse-only tooltip) becomes the same string for parity. Inner content stays the same — the icon + truncated title still render visually; the aria-label gives screen readers the full sentence.

### NEW: `components/planner/source-failure-pill.tsx`

```tsx
import { AlertTriangle } from "lucide-react";
import { PLANNER_EVENT_LABEL, type PlannerEventKind } from "@/lib/planner/types";

export function SourceFailurePill({ failedKinds }: { failedKinds: PlannerEventKind[] }) {
  if (failedKinds.length === 0) return null;
  const label = failedKinds.map((k) => PLANNER_EVENT_LABEL[k]).join(", ");
  return (
    <div role="status" className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-foreground">
      <AlertTriangle className="h-3.5 w-3.5 text-warning" aria-hidden />
      <span>
        {failedKinds.length === 1 ? "1 source" : `${failedKinds.length} sources`} failed to load ({label}) — refresh to retry.
      </span>
    </div>
  );
}
```

### NEW: `app/(app)/planner/loading.tsx`

Calendar shell skeleton: header band + filter row skeleton bars + month-grid placeholder (7×6 tiles, each with 1–2 chip-shaped pulses).

### NEW: `app/(app)/planner/error.tsx`

```tsx
"use client";

export default function PlannerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-6 text-sm">
      <h2 className="text-base font-semibold text-destructive">Couldn&apos;t load the planner</h2>
      <p className="mt-1 text-muted-foreground">
        Something went wrong while reading your planner data. Try again, or head back to the dashboard if the issue persists.
      </p>
      {error.digest ? <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">Ref: {error.digest}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => reset()} className="rounded-md bg-brand px-3 py-1.5 text-xs font-medium text-white hover:brightness-95">
          Try again
        </button>
        <a href="/dashboard" className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted">
          Back to dashboard
        </a>
      </div>
    </div>
  );
}
```

---

## Definition of done — 6i PR

1. 10-item checklist passes — all 4 ❌ rows fixed, all 3 ⚠️ rows resolved, ✅ rows untouched.
2. State coverage: `loading.tsx` + `error.tsx` ship at `/planner`. Page navigations show skeleton; thrown shell errors show the brand card with Retry.
3. `Module 5` eyebrow dropped (matches 6b–6h precedent).
4. Empty state branches on the four distinct conditions; "Clear filters" chip removes all `?<kind>=0` params; no-accessible-sites branch skips the calendar entirely.
5. Calendar-grid a11y: month grid uses `role="grid"` / `role="row"` / `role="gridcell"`. Per-cell `aria-label` includes weekday + full date + event count. View toggle is a radiogroup. Date input + EventChip carry `aria-label`. "+N more" carries a descriptive label.
6. Mobile: at 320–639px the calendar gets its own horizontal scroll (no body-level overflow). Filter row wraps gracefully (already does).
7. Per-source failure pill renders quietly above the grid when `failedKinds.length > 0`. Aggregator return shape evolves to `{ events, failedKinds }`; per-source error swallowing preserved.
8. Day view: "← Back to Month" link + (when single-site) site name in header.
9. Site-picker `currentSiteId === null` edge case handled (falls back to "all").
10. Smoke test (`docs/smoke-test-phase5.md`) extended with new polish checkpoints (calendar a11y; empty-state variants; per-source failure pill; loading + error shells; mobile scroll).
11. `pnpm tsc --noEmit` clean.
12. `pnpm lint` matches the 42/16 baseline established at the end of 6h (no new warnings beyond the standard "setState in effect on dialog-open" pattern unless explicitly justified).

---

## Open questions — resolve before §implementation

1. **Calendar-cell arrow-key navigation (the original stub's bullet point #6).** Proper grid-keyboard nav (roving tabindex + `aria-rowindex` + arrow handlers + cell focus restore) is a real effort — closer to a small feature than a polish bullet. Recommend **defer to v2** + log in `docs/SPEC.md` §15. The chip Tab order already covers the day-by-day reading order (Tab walks chip → chip → "+N more" linearly through the month). Counter-argument: the page is the unified observability surface and screen-reader users would benefit. **Recommendation: defer**, add `role="grid"` shell now (which is the load-bearing a11y bit) and ship the keyboard handler in a follow-up if the v2 cadence calls for it. ✅/❌
2. **"Show sandbox" admin toggle.** Currently sandbox events leak through to viewers who can already see them via RLS (reporter, admins) — not a leak per se, but no UI signal that a planner chip *is* a sandbox event. Two options: (a) defer entirely (v2); (b) add a `is_sandbox` flag to `PlannerEvent` and a subtle dotted-border treatment on `<EventChip>` for sandbox events. Recommend **(a) defer** — sandbox UX is a cross-cutting v2 polish item across all 5 modules and shouldn't land piecemeal on the planner first. ✅/❌
3. **"+N more" link behavior — drawer vs. day-view route.** Stub proposed a side drawer; shipped behavior routes to `/planner?view=day&date=…`. Recommend **keep the route** — drawer adds client state + animation work for a UX that's already URL-shareable and back-button-friendly. The audit's `aria-label` add is the only fix needed. ✅/❌
4. **Per-source failure pill — retry button or not.** Aggregator failures are page-load-time per-source; the only sensible recovery is a full reload. Synthesizing a "retry just this source" requires a client component + a server action that re-runs one fetcher and merges its events into existing client state. Out of scope for polish. Recommend **no retry button** in the pill — the copy says "refresh to retry" and the user uses the browser. ✅/❌
5. **Mobile collapse strategy — horizontal scroll vs. forced Day view at sm.** Stub proposed forcing Day view; current shipped code does neither and overflows. Recommend **horizontal scroll** (lighter; preserves the user's selected view; no surprise collapse). ✅/❌
6. **Empty-state recovery copy for "all kinds disabled".** Two options: (a) "All event types hidden — click a chip to show" (passive); (b) auto-render a "Show all" button that strips every `?<kind>=0` (active recovery). Recommend **(b)** — saves the user from finding the chip again, mirrors the "Clear filters" precedent set by 6c (filter-chip patterns). ✅/❌

---

## Smoke-test additions (`docs/smoke-test-phase5.md`)

Append a new **Polish (Phase 6i)** section with these checkpoints:

1. Sign in → /planner → confirm no `Module 5` eyebrow above the title.
2. Disable Wi-Fi mid-load (or throttle DevTools) → calendar grid skeleton appears between transitions; Today button + filter row stay interactive.
3. Force a query failure (e.g. revoke `incidents` SELECT briefly) → page renders normally with a warning pill above the calendar listing the failed source(s).
4. Force a shell-level error (throw inside `requireUser` mock) → brand error card renders with Try again button; clicking reset reloads.
5. Toggle every event-type chip off → empty state reads "All event types hidden" with a Show all button; clicking restores every kind.
6. Toggle ½ the chips off → empty state (when no events match) reads "No events match the active filters" with a Clear filters link.
7. Sign in as a brand-new user with no site memberships → planner shows the no-accessible-sites empty card, calendar skipped entirely.
8. Resize to 375px (iPhone SE) → page body has no horizontal scroll; the calendar gets its own scroll context.
9. Tab through the planner → view toggle reads as a radio group (Month / Week / Day); chips read with `aria-pressed`; calendar cells have `aria-label` per cell ("Tuesday, May 12, 2026, 3 events").
10. Click "+N more" on a busy day → land on day view; "← Back to Month" link appears in header; clicking returns with `?date=` preserved.
11. Click an event chip in JAWS / VoiceOver → screen reader announces the full label (kind, ref code, title, date+time, site).
