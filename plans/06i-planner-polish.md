# Phase 6i — Planner polish

**Status:** drafted 2026-05-06 (Phase 6 module 9 of 10)
**Goal:** The Planner is the smallest module by route count (1 page) but the densest by data shape — it merges 6 event sources into one calendar. Polish focus: filter UX (verbose `?<kind>=0` URL shape must be discoverable), event-chip clarity (color encoding consistent with each module's own conventions), Month/Week/Day view parity, deep-link correctness on every chip click.
**Branch:** `feat/phase-6-planner-polish`
**PR target:** `main`
**Pages covered:** `/planner`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist.
> - EventChip variants polished: incident severity color, capa overdue red, asset PM red, inspection green, investigation neutral, regulatory deadline red.
> - URL filter shape cleanup: chips display "X" when disabled, "✓" when enabled; URL absence-of-key = enabled (per `CLAUDE.md` shipped behavior).
> - Month grid: "+N more" affordance opens day-view drawer (not a modal).
> - Week view: AM/PM banding clarity.
> - Day view: chronological list with event-source icons.
> - Site picker hierarchy expansion (`include_children` BFS) verified with seeded data.
> - Empty-state on filtered-down month: "No events match these filters" + "Clear filters".

> **Not in this PR:**
> - **No drag-to-reschedule.** v2 (per `CLAUDE.md`).
> - **No event creation from planner.** v2.
> - **No iCal export.** v2.
> - **No conflict detection.** v2.
> - **No team / user lanes.** v2.
> - **No timezone-aware multi-day events.** Browser-locale point-in-time only in v1.
> - **No printable view.** v2.
> - **No mobile-optimized week view.** sm collapses to Day view per shipped behavior.

---

## Page

### 1. `/planner`

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Calendar grid; today highlighted with brand-purple outline; out-of-month cells dimmed | |
| 2. Empty state | TBD | (a) Org-fresh: "Nothing scheduled yet — file an incident or run an inspection to start populating" with deep-link CTAs. (b) Filtered-down: "No events match" + "Clear filters" link | |
| 3. Loading state | TBD | Calendar skeleton; site picker remains | |
| 4. Error state | TBD | Per-source query failure: NEVER blanks the calendar (per shipped contract); show a small "1 source failed to load — retry" subtle pill | |
| 5. Responsive | TBD | sm: forces Day view; view toggle hidden | |
| 6. A11y / keyboard | TBD | Calendar grid: arrow-key navigation between cells; Enter opens day drawer; chips Tab-reachable; aria-label on each chip ("Incident occurred 12 May, severity S2, click to view") | |
| 7. Form-error UX | n/a | URL filters; no form | |
| 8. Copy | TBD | Filter chip labels match each module's own copy (Incidents / Inspections started / Inspections completed / CAPA due / Asset PM due / Investigation due / Regulatory deadline) | |
| 9. Dark mode | TBD | EventChip variants in dark; "today" brand outline | |
| 10. Cache Components | TBD | Aggregator `lib/planner/aggregate.ts` runs queries in parallel through per-table RLS; cache shape: per-user + per-month + per-filter-set; revalidate on writes from any source | |

**Likely small gaps:**

- **Filter chip discoverability:** the URL convention (absence = enabled) is non-obvious. Ensure each chip has a tooltip explaining "Click to hide <kind> events from view". When ALL chips disabled, show empty state with copy: "All event types hidden — click a chip to show".
- **"+N more" affordance:** per shipped behavior, month-cell shows up to 3 chips + "+N more" link. Clicking "+N more" should open a side drawer with the full day's list (not a modal — drawer keeps month context visible).
- **Today button:** instantly jumps `?date=` to today; visible on all 3 views.
- **View toggle keyboard nav:** arrow-key between Month / Week / Day per WAI-ARIA tabs.
- **Site picker:** "All accessible sites" option; multi-select if user belongs to multiple via `site_members`. Hierarchy expansion only kicks in for `include_children = true` memberships.
- **Sandbox events:** excluded by default (per shipped contract); admins with `site:configure` see a "Show sandbox" toggle.
- **EventChip click → deep-link:** verify each kind routes correctly:
  - incident → `/incidents/[id]`
  - inspection_started / inspection_completed → `/inspections/[id]`
  - capa_due → `/capa/[id]`
  - asset_pm_due → `/resources/assets/[id]`
  - investigation_due → `/investigations/[id]`
  - regulatory_deadline → matching notification's deep-link target
- **Color encoding consistency:** chips use each module's own color language (severity colors for incidents, status pill colors for inspections, due-date red for overdue items). Don't introduce a planner-specific palette.
- **AM/PM banding on Week view:** keep coarse per shipped contract; explicit horizontal divider with "AM" / "PM" labels.
- **Day view header:** date + site + event count + breadcrumb "← Back to Month".
- **URL share-correctness:** copy-paste a planner URL → recipient lands on identical view (date + view-kind + filters + site). Verify with seeded data.
- **2 RegTooltips already shipped:** (a) "Planner aggregates every dated event across modules — read-only, edit from source." (b) "Click any event to jump to its source record. Use the URL to share." Confirm placement is on the right elements.
- **Per-source query failure UX:** shipped contract is "swallow + continue". In dev, log to console; in user-facing UI, show a subtle "1 source failed to load — retry" pill (clicking retry re-runs only that source).

---

## Definition of done — Planner PR

1. 10-item checklist passes.
2. All 6 event sources surface correctly under seeded data (verified per shipped smoke-test §3 step 4).
3. Each chip kind deep-links to its source page.
4. URL filter shape works: copy-paste preserves view; chip tooltip explains the toggle behavior.
5. Empty states differentiate "org-fresh" vs. "filtered-down".
6. Per-source failure does NOT blank the calendar — shows the retry pill instead.
7. Site picker `include_children` expansion verified with seeded data.
8. Smoke-test (`docs/smoke-test-phase5.md`) re-runs green.
9. PR description includes:
    - Before/after for any chip-color swap.
    - URL share demo: copy a filtered+date URL, paste in fresh tab, verify identical render.
    - 30s recording of "+N more" drawer.
