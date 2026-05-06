# Phase 5 — Planner

**Status:** ready to start (drafted 2026-05-06, immediately after Phase 4 merge / PR #5)
**Goal:** A unified, read-only calendar at `/planner` that aggregates every dated event across the four shipped modules — incidents (occurred), inspections (started + completed), CAPA due dates, asset preventive-maintenance dates, investigation due dates, and active regulatory deadlines — into a single Month / Week / Day view. The user filters by site, event type, and date range; clicking any event deep-links to its source record. No event creation from the planner — it's strictly an observability surface that ties the five modules together at the timeline level.
**Estimated duration:** ~1 week
**Depends on:** Phase 4 (shipped 2026-05-06, PR #5). All prior data sources are already in place; this phase ships pure read aggregation + UI. No schema changes.

> **What this phase ships of the Planner module:**
> - Schema: **none**. Pure aggregator over existing tables.
> - Permissions: 1 new key `planner:read` (granted to all 4 default roles), gating sidebar visibility + the route.
> - `/planner` (single page with view toggle); URL state `?view=month|week|day&date=YYYY-MM-DD&site=&type=`.
> - 6 event sources unified into one `PlannerEvent` shape: incident · inspection_started · inspection_completed · capa_due · asset_pm_due · investigation_due · regulatory_deadline.
> - App-level aggregator in `lib/planner/aggregate.ts` — one focused query per source, merged in TS, sorted by date. (Postgres union view alternative considered and **deferred to v2** — see SPEC §15 entry; the JS aggregator is easier to extend and lets each source carry its own permission filter.)
> - 3 view components: `<PlannerMonth>` (calendar grid, current month centered), `<PlannerWeek>` (7-day vertical lanes, hour-coarse), `<PlannerDay>` (chronological list).
> - `<EventChip>` — color-coded by source kind, with severity-colored variant for incidents and overdue-coloring for `capa_due` / `asset_pm_due`.
> - `<PlannerFilters>` — site picker (defaults to current site), event-type multi-toggle, "today" jump button.
> - Sidebar entry "Planner" between Documents and Reports.
> - 2 new RegTooltips (planner aggregation rule, "click jumps to source") — 27 → 29 total.
> - `docs/smoke-test-phase5.md` — 8-step ~5-minute walkthrough.
> - `docs/ui-flow.md` §13 row already covers the page; Phase 5 just delivers it.

> **Not in this phase (intentional v1 trade-offs):**
> - **No drag-to-reschedule** — would require write-back across 4 different tables (incidents.occurred_at, capas.due_date, assets.next_pm_at, investigations.due_date) and per-source permission gating. Deferred to v2.
> - **No event creation from the planner** — every shipped module already has its own create flow (Report Wizard, CAPA-create modal, asset edit, etc.). Adding a "New event" form here would just duplicate them.
> - **No iCal / Google Calendar export** — deferred to v2 alongside the report-export ITA submission story.
> - **No recurring-inspection materialization** — same family as the cron we deferred from Phase 3. Until that lands, the planner shows only inspections that have a `started_at` (in_progress / completed / abandoned). Active assignments DO surface as a thin "scheduled" lane on the day view IF `next_run_at` is computed from the schedule (see Open Question 4).
> - **No team / user lane** — events aren't grouped by assignee in v1. The detail page each event links to shows the owner.
> - **No timezone-aware multi-day events** — every event is treated as point-in-time at the ISO timestamp; the user's browser locale renders it. Site-local timezone display is a v2 polish.
> - **No conflict detection** — e.g. forklift PM scheduled on a day a CAPA on the same forklift is due. The information is visible side-by-side; no automated callout.
> - **No printable view** — deferred.
> - **No mobile-optimized layout** — Phase 5 ships desktop-first; sm-breakpoint collapse to Day view for narrow screens is good enough for v1.

---

## Definition of done

A stakeholder dropping in unannounced after Phase 5 sees:

1. **Sidebar entry renders.** Sign in as `admin@demo.local` → sidebar now lists **Planner** between Documents and Reports. Visible iff the user holds `planner:read` (granted to every default role). Worker through site_admin all see it.
2. **Default view: month.** Click Planner → `/planner` lands on the month containing today. Header shows month name + year, prev/next/today buttons, view toggle (Month / Week / Day), site picker (defaults to current), and event-type chips.
3. **Month grid renders.** 7-column grid (Sun → Sat). Each cell shows the date number and up to **3 event chips**, with a "+N more" link when truncated. The "today" cell has a brand-purple outline. Cells outside the current month are dimmed.
4. **Six event sources surface.** From the seeded data, the month view shows at minimum: 2 seeded incidents (occurred), 1 in-progress inspection (started today), 1 completed inspection (yesterday), 2 CAPA due-dates (one overdue, one upcoming), 1 asset PM-due (conveyor, overdue red), 1 investigation due-date, plus any active regulatory notification with a deadline. Color tokens per `<EventChip>` legend (see §design tokens).
5. **Click event → deep-link.** Clicking any chip routes to its source record: incident → `/incidents/[id]`, inspection_started/completed → `/inspections/[id]`, capa_due → `/capa/[id]`, asset_pm_due → `/resources/assets/[id]`, investigation_due → `/investigations/[id]`, regulatory_deadline → the matching notification's deep-link target (existing `notification.incident_id` or `notification.capa_id`). The chip is a `<Link>`, never opens a modal.
6. **Week view works.** Click "Week" toggle → `?view=week&date=YYYY-MM-DD`. 7 columns (one per weekday), each showing a chronological list of events. Hour banding is **coarse** (just AM / PM separator); we don't render a 24-hour timeline grid.
7. **Day view works.** Click "Day" → `?view=day&date=YYYY-MM-DD`. Single chronological list of all events on that date. Header shows date + site + event count. Useful for the dashboard "today's events" deep-link entry.
8. **Filters update the URL.** Click an event-type chip → toggles in the URL params. Clicking the site picker → `?site=` updates. The "today" button jumps `?date=` to today. Copy/paste a planner URL → recipient lands on the same view.
9. **Sandbox + soft-deleted excluded.** Sandbox incidents (`is_sandbox=true`) don't surface unless the viewer is the reporter or a `site:configure` admin. Soft-deleted rows (`deleted_at IS NOT NULL`) never appear on any view.
10. **Permission resolver is correct.** Each event source query goes through the existing per-table RLS plus a final `can()` check at the source level. A worker on Houston only sees events at Houston. An EHS manager with `include_children=true` on Houston sees events at Houston + Building A. A site admin on Manchester does NOT see Houston events.
11. **2 new RegTooltips.** (1) On the page header next to "Planner": *"Planner aggregates every dated event across modules — it's read-only. Edit each event from its source record."* (2) On the first event chip in the month grid: *"Click any event to jump to its source record. Use the URL to share a specific date or filter."*
12. **`pnpm dev` console clean.** No hydration warnings, no `'use cache'` errors, no Cache Components runtime errors, no RLS noise.
13. **Smoke test passes** per `docs/smoke-test-phase5.md`.

Phase 5 explicitly does **not** include: drag-to-reschedule; event creation from the planner; iCal export; recurring-inspection materialization (no scheduled-only lane that lacks `started_at`); team / user lanes; timezone-aware multi-day rendering; conflict detection; printable view; mobile-optimized week view.

---

## Task list (ordered)

### A. Schema deltas + RBAC additions

#### 1. Migration: `phase5_planner_permission`

```sql
-- Net-new perm key (1)
insert into permissions (key, description) values
  ('planner:read', 'View the unified Planner calendar')
on conflict (key) do nothing;

-- Grant to all 4 default roles in every existing org
insert into role_permissions (role_id, permission_key)
  select r.id, 'planner:read'
    from roles r
   where r.is_default = true
on conflict do nothing;
```

Plus a one-line addition to `seed_default_roles()` (worker / supervisor / ehs_manager grant blocks each get `(v_role_id, 'planner:read')`; site_admin already gets it via the catch-all). And add `'planner:read'` to `lib/rbac/permissions.ts`.

**Why a new perm and not just rely on existing reads?** A future "executive view" that aggregates across orgs (post-v1) will key off this same perm at a different scope. Costs nothing now; future-proofs the gate.

### B. Aggregator + types

#### 2. `lib/planner/types.ts`

```ts
export const PLANNER_EVENT_KINDS = [
  'incident',
  'inspection_started',
  'inspection_completed',
  'capa_due',
  'asset_pm_due',
  'investigation_due',
  'regulatory_deadline',
] as const;
export type PlannerEventKind = (typeof PLANNER_EVENT_KINDS)[number];

export type PlannerEvent = {
  id: string;                     // composite "<kind>:<source_id>"
  kind: PlannerEventKind;
  date: string;                   // ISO; events are point-in-time in v1
  title: string;                  // short; rendered on the chip
  href: string;                   // deep-link to the source record
  site_id: string;
  site_name: string | null;
  // Source-specific metadata for the chip's tone:
  severity?: 'S1'|'S2'|'S3'|'S4'|'S5' | null; // incidents only
  is_overdue?: boolean;           // capa_due / asset_pm_due / investigation_due
  is_failed?: boolean;            // inspection_completed only
};
```

Plus `PLANNER_EVENT_LABEL` and `PLANNER_EVENT_TONE` color-token maps.

#### 3. `lib/planner/aggregate.ts`

```ts
export type AggregateInput = {
  start: Date;
  end: Date;
  siteIds: string[];
  kinds?: PlannerEventKind[];     // empty / undefined = all
};

export async function aggregatePlannerEvents(
  input: AggregateInput,
): Promise<PlannerEvent[]>;
```

Implementation: 6 parallel server queries (one per kind; skipped when `kinds` filter excludes it), each filtered by `[start, end]` window + `siteIds`. Results merged into a single sorted-by-date array. Lives in `lib/planner/` so it can be reused by future features (dashboard "next 7 days" widget, executive heatmap).

Per-source SELECT details (each is a focused query that reads through the existing per-table RLS):

| Source | Table | Date column | Title format | Filter |
|---|---|---|---|---|
| `incident` | incidents | `occurred_at` | `${ref_code} · ${title}` | `deleted_at IS NULL`, sandbox unless reporter/admin (existing RLS) |
| `inspection_started` | inspections | `started_at` | `${ref_code} · ${title}` | `deleted_at IS NULL` |
| `inspection_completed` | inspections | `completed_at` | `${ref_code} · ${title}${is_failed ? ' (failed)' : ''}` | `deleted_at IS NULL`, `completed_at IS NOT NULL` |
| `capa_due` | capas | `due_date` | `${ref_code} · ${title}` | `deleted_at IS NULL`, `status NOT IN ('verified','closed')` |
| `asset_pm_due` | assets | `next_pm_at` | `${kind} · ${name}` | `deleted_at IS NULL`, `status='active'`, `next_pm_at IS NOT NULL` |
| `investigation_due` | investigations | `due_date` | `${ref_code} · ${incident.title}` | `deleted_at IS NULL`, `status NOT IN ('closed')` |
| `regulatory_deadline` | notifications | `deadline_at` | `${title}` | `resolved_at IS NULL`, `deadline_at IS NOT NULL` |

#### 4. `lib/planner/range.ts` — date-range utilities

`monthRange(date)` returns `{start, end}` covering the visible month grid (always start on the first of the month's leading Sunday and end on the last of the trailing Saturday — 35 or 42 days). `weekRange(date)` returns Sun → Sat. `dayRange(date)` returns midnight to midnight. All use `date-fns` (already a dep).

### C. Pages

#### 5. `/planner/page.tsx` (server component)

Reads `searchParams: ?view=month|week|day&date=&site=&type=`, resolves the date range via `lib/planner/range.ts`, calls `aggregatePlannerEvents`, then renders the matching view component.

Layout:
```
<Header — title + tooltip + view toggle + site picker + event-type chips + "today" button />
<PlannerMonth | PlannerWeek | PlannerDay events={events} />
```

Default `view=month`, `date=today()`, `site=currentSiteId`. Site picker offers user's accessible sites + "All sites" option.

#### 6. `<PlannerMonth>` (server component)

Renders a 7-column grid covering the visible month. Each cell:
- Date number (top-left). Today highlighted with brand-purple outline.
- Up to 3 event chips. 4th+ collapse into a "+N more" link that routes to `?view=day&date=<that-day>`.
- Cells outside current month: dimmed `text-muted-foreground/50`, but still clickable.

#### 7. `<PlannerWeek>` (server component)

7 columns (one per weekday), each rendering events vertically in chronological order. Coarse hour banding (AM / PM separator only) — we don't render a continuous 24h grid. Each event is a full-width chip variant with an extra time-of-day label.

#### 8. `<PlannerDay>` (server component)

Single chronological list. Each row: time (left), chip (full width). Empty state: "No events scheduled."

#### 9. `<EventChip>` (server component)

```ts
type EventChipProps = { event: PlannerEvent; size?: 'sm'|'md' };
```

Renders a colored pill or row depending on `size`. Tone map:
- `incident`: severity-colored (S1 destructive → S5 success, mirrors `<SeverityBadge>` from Phase 1)
- `inspection_started`: brand-purple subtle
- `inspection_completed`: green if pass, destructive red if `is_failed`
- `capa_due`: amber when upcoming, destructive when `is_overdue`
- `asset_pm_due`: amber when upcoming, destructive when overdue
- `investigation_due`: brand-purple, destructive when overdue
- `regulatory_deadline`: brand-purple bold (existing banner color from Phase 2)

Always wraps in `<Link href={event.href}>` — the chip is the click target.

#### 10. `<PlannerFilters>` (client component)

URL-driven multi-toggle for event kinds (chips like the existing /templates/browse industry chips). Site picker reads from server-passed list. "Today" button does `?date=YYYY-MM-DD` (today) and preserves view + filters. View toggle is its own segment.

### D. Sidebar + tooltips

#### 11. `nav-config.ts`

```ts
{ href: "/planner", label: "Planner", icon: CalendarDays, permission: "planner:read" },
```

Insert between `/resources/documents` and `/reports`.

#### 12. RegTooltips

Append 2 entries to `docs/onboarding.md` §9.1 + `lib/constants/tooltips.ts`:
- `planner_aggregation_rule`: "Planner aggregates every dated event across modules — it's read-only. Edit each event from its source record."
- `planner_url_share`: "Click any event to jump to its source record. Use the URL to share a specific date or filter."

### E. Smoke test

#### 13. `docs/smoke-test-phase5.md`

8-step walkthrough:
1. Sign in as `admin@demo.local` → sidebar shows Planner → click → land on month view, today centered.
2. Confirm at least 6 chips render across the month from the seeded data (2 incidents, 2 inspections, 2 CAPAs, 1 asset PM, etc.).
3. Verify the conveyor PM-overdue chip is destructive-red. The seeded "Update lockout/tagout SOP" CAPA (overdue −2 days) shows destructive too.
4. Click the conveyor PM chip → routes to `/resources/assets/[id]` (conveyor). Back.
5. Toggle the event-type chips: turn off `incident` → those chips disappear; URL shows `?type=inspection_started,inspection_completed,capa_due,asset_pm_due,investigation_due,regulatory_deadline` (or however we represent the toggle, see Open Q5).
6. Switch to Week view → 7 columns; today's column highlights. Switch to Day view.
7. Sign in as `worker@demo.local` (Houston only) → planner shows events only at Houston + child sites the worker is a member of with include_children. Manchester events absent.
8. Console clean.

### F. Wrap

#### 14. CLAUDE.md status bump
"Phase 5 merged 20XX-XX-XX (PR #X) — Planner module shipped. Read-only month / week / day calendar at `/planner` aggregating 6 event sources (incident · inspection_started · inspection_completed · capa_due · asset_pm_due · investigation_due · regulatory_deadline); URL-driven filters by site + event type; click jumps to source. App-level aggregator in `lib/planner/aggregate.ts` — Postgres union view deferred to v2. 1 new perm (`planner:read`), 2 new RegTooltips (29 total). No schema changes; pure read aggregation. **All 5 modules shipped — V1 demo complete.**"

#### 15. SPEC.md updates

Append two §15 entries:
- "Phase 5 ships an app-level aggregator over 6 sources, NOT a Postgres union view. Trade-off: per-source perm filtering is easier in TS and date-range index hits stay clean per source. v2 may add a `planner_events` materialized view if dashboard widgets need the same shape."
- "Phase 5 is read-only by design. Event creation, drag-to-reschedule, iCal export, conflict detection, and team-lane grouping are all deferred. The planner is observability over the existing 4 modules — every dated artefact already has a create flow at its source, and we don't duplicate it here."

#### 16. PR

Per `.claude/rules/github-workflow.md`: branch `feat/phase-5-planner`, PR title `feat: phase 5 — planner`. Squash on merge.

---

## Open questions (raise before code)

1. **App-level aggregator vs. Postgres union view.** Plan: app-level (one query per source, merged in TS). Trade-off: easier to extend + the existing per-source RLS does the perm filtering for free; downside is N=6 round trips per render. For seed-scale data (dozens of events per month) this is well under the cache window. View alternative tracked as v2 if we ever need a single-query dashboard widget. Confirm.
2. **Event-type filter representation in the URL.** Two options: (a) `?type=incident,capa_due` (CSV — fewer toggles render = shorter URL); (b) `?incident=1&capa_due=1` (verbose but each chip self-documents). Plan: (a). Confirm.
3. **"All sites" site filter.** Plan: site picker offers each accessible site + an "All accessible sites" option. The existing site picker (used elsewhere) only does single-site; this is a small extension and kept local to the planner. Confirm.
4. **Should we render scheduled inspections (`template_assignments` with no `started_at` yet)?** Plan: NO for Phase 5 — until the recurring-inspection cron lands (deferred from Phase 3), the only honest "future inspection" date is one a user manually picked. Showing a phantom row that says "Forklift Daily 06:00" every weekday before the run exists feels wrong. Open to revisit if user disagrees.
5. **Color tokens for the chips.** Plan: incident severity colors mirror `<SeverityBadge>` (Phase 1); other kinds use brand-purple + amber + destructive per the `PLANNER_EVENT_TONE` map. No new tokens introduced. Confirm.
6. **What goes in the chip label when truncated?** Month view cells are tight (~120 px wide). Plan: chips show only `${kind icon} ${truncated title}` (no ref code). Hover tooltip shows the full label + date + site. Confirm.
7. **Worker visibility.** Plan: workers see all events at sites they're members of, including incidents reported by others (per existing `incidents_read` RLS). Confirm — vs. restricting workers to only their own incidents on the planner (matches `/incidents` worker-default `?tab=mine` filtering).
