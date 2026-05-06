# Phase 5 — Smoke test

> Run before merging Phase 5 to confirm the Planner module is shippable
> end-to-end. ~5 minutes. Re-run after any change that touches
> `/planner`, the planner aggregator, or any of the 6 source tables
> (`incidents`, `inspections`, `capas`, `assets`, `investigations`,
> `notifications`) in a way that affects their `occurred_at` /
> `started_at` / `completed_at` / `due_date` / `next_pm_at` /
> `deadline_at` columns.

## Setup
1. `pnpm install`
2. `pnpm db:push` — applies all migrations through `20260510120000_phase5_planner_permission.sql`
3. `pnpm db:types` — regenerates `lib/supabase/types.ts`
4. `pnpm db:seed` — Phase 4 seed already populates every source the
   planner reads (incidents with `occurred_at`, in-flight + completed
   inspections, CAPAs with `due_date`, conveyor with `next_pm_at`
   in the past, investigations, regulatory notifications). Phase 5
   adds **no new seed rows** — it's pure read aggregation.
5. `pnpm dev`

Demo accounts (password `Demo!2026`):
- `admin@demo.local` — Site Admin (Houston + Manchester, full perms)
- `ehs@demo.local`   — EHS Manager
- `supervisor@demo.local`
- `worker@demo.local` — Worker (Houston only)

## Step 1 — Sidebar nav + landing

1. Sign in as `admin@demo.local`.
2. Confirm sidebar now lists **Planner** between Documents and Reports.
3. Click **Planner** → URL becomes `/planner` (no params).
4. Page renders with:
   - Header `Planner` + Module 5 eyebrow + brand `CalendarDays` icon
   - Two `?` info-tooltips (planner_aggregation_rule + planner_url_share)
   - Header date label = current month name + year (e.g. `May 2026`)
   - View toggle (Month / Week / Day) with `Month` selected
   - Native date input + `Today` button
   - Site picker showing `Current site · Houston`
   - 7 event-type chips (all on, brand-soft tone)

## Step 2 — Month grid populated

1. The grid is 7 cols × 5 or 6 rows; today's date number is a brand-purple pill.
2. Cells outside the current month (leading + trailing) are dimmed.
3. **At minimum 6 chips render across the month** from the seeded data:
   - 2 incident chips (severity-colored — S1 red, S2 orange, etc.)
   - 1 inspection_started chip (brand-soft, today, in-progress forklift run)
   - 1 inspection_completed chip (success-green pass OR destructive-red if `is_failed`)
   - 1 capa_due chip — `Update lockout/tagout SOP` (overdue, **destructive-red**)
   - 1 capa_due chip — upcoming (amber)
   - 1 asset_pm_due chip — conveyor (overdue, **destructive-red**)
4. Hover any chip → browser title tooltip shows `${title} — ${date} · ${site_name}`.
5. If a single day has 4+ events, the cell shows `+N more` linking to the day view for that date.

## Step 3 — Click jumps to source

1. Click the conveyor PM chip → routes to `/resources/assets/<id>` (conveyor detail).
2. Browser back → planner state preserved.
3. Click an incident chip → routes to `/incidents/<id>`.
4. Click a CAPA chip → routes to `/capa/<id>`.
5. Click an inspection chip → routes to `/inspections/<id>`.

## Step 4 — Filters update the URL (verbose shape)

1. Click off the **Incident** chip → URL gains `?incident=0`. Incident chips disappear from the grid.
2. Click off **CAPA due** as well → URL becomes `?incident=0&capa_due=0`. Both kinds gone.
3. Click **Incident** back on → `incident=0` is removed from the URL (verbose: absence = enabled).
4. Use the site picker → switch to **All accessible sites** → `?...&site=all`. Both Houston and Manchester events render.
5. Switch to a specific site (e.g. `Manchester`) → `?...&site=<manchester_id>`. Only Manchester events.
6. Click **Today** → `?date=YYYY-MM-DD` set to today's ISO date. The current month re-anchors.
7. Copy the full URL into a new tab — same view renders for the same user (URL is the truth).

## Step 5 — Week + Day views

1. Click **Week** → `?view=week&date=...`.
2. 7 columns (one per weekday); today's column has a brand-soft tinted background.
3. Each day splits into **Morning** / **Afternoon / Evening** bands (coarse, not a 24h grid).
4. Days with no events show "No events" italic placeholder.
5. Click **Day** → `?view=day`. Single chronological list of today's events with full date heading + event count footer.
6. Empty day → "No events scheduled."

## Step 6 — Permission scoping

1. Sign out → sign in as `worker@demo.local` (Houston only).
2. Sidebar → **Planner** still visible (worker holds `planner:read`).
3. `/planner` lands on Houston-only events. Manchester chips absent.
4. Site picker → only Houston + any include_children descendants appear; no Manchester option.
5. Sign out → sign in as `supervisor@demo.local`. Confirm sidebar visibility + planner loads.

## Step 7 — Sandbox + soft-deleted exclusion

1. Sign in as `admin@demo.local`. Open `/admin/demo` (if exposed in this build) and trigger a sandbox banner / sandbox incident.
2. Reload `/planner` → sandbox incidents should NOT appear unless the viewer is the reporter or a `site:configure` admin (confirm via existing `incidents` RLS — admin does see them).
3. Soft-delete a CAPA via SQL (`update capas set deleted_at = now() where ref_code = ...`) → reload planner → that chip is gone.
4. (Restore the CAPA after testing if you want the demo state intact.)

## Step 8 — Console hygiene

1. Open DevTools console.
2. Click through Month → Week → Day; toggle filters; switch sites.
3. **No** hydration warnings, **no** Cache Components runtime errors, **no** RLS error rows surfaced from the aggregator's silent-fail branches.
4. Network panel: each view change fires the planner page request; up to 6 supabase REST queries (one per active source) per render.

---

If any step fails, stop and fix before proceeding. Phase 5 has no
schema migrations after the perm key, so failures here typically mean
either (a) the aggregator query shape needs adjusting, (b) the URL
filter parsing diverged from the verbose shape, or (c) one of the
source tables changed columns since `lib/planner/aggregate.ts` was
written.
