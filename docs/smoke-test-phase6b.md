# Phase 6b smoke test — Incidents redesign + polish

Run after every Phase 6b-touching merge. Re-run `docs/smoke-test-phase2.md` capture section in addition to this guide.

## Prerequisites

- Local dev server running (`pnpm dev`).
- Demo seed loaded (`pnpm db:seed`). UCB org with Houston (US) + Manchester (GB) sites populated.
- Sign in as `site_admin@ucb.demo` (full perms across both sites).

## 1. /incidents — list page redesign

### 1a. Layout, ≥ 1280px desktop

1. Navigate to `/incidents`.
2. Confirm in order:
   - Header band: destructive-tinted icon + "Incident Management" title + ISO subtitle + "Report incident →" CTA on the right.
   - **KPI row 1 (4 tiles)**: Total Incidents · High / Critical · Under investigation · This Month.
   - This-month tile shows a bottom-right trend pill (`↗ N vs last mo`, `↘ N vs last mo`, or `— same vs last mo`).
   - **KPI row 2 (3 tiles, default)**: Days since last incident · TRIR · DART (because the cookie-selected site is US).
   - **Trend chart**: 12-month area chart with destructive stroke + gradient fill, integer y-axis, hover shows month + count.
   - **Breakdown row (4 cards)**: By Type · By Severity (donut) · By Track · Top Sites.
   - **Status pipeline**: 4 stage cards (Reported · Investigating · Action Required · Closed) with proportional progress bars and percentages.
   - **List surface**: search filter chips + table at the bottom. Filter chips operate on the table only (KPIs are scoped, not filtered).

### 1b. Per-site rate selection

1. Topbar SiteSwitcher → switch to Manchester (GB).
2. Confirm KPI row 2 changes to: Days since last · LTIFR · TRIFR (3 tiles, no DART).
3. Visit `/incidents?site=all` → KPI row 2 expands to 4 tiles: Days since · TRIR · LTIFR · TRIFR (DART intentionally omitted in all-sites mode).

### 1c. Empty / zero data

1. Sign in as a worker on a brand-new site (zero incidents).
2. `/incidents` should still render every tile and chart — each with its own empty-state copy ("—", "No incidents yet."). No page-level empty card.
3. Days since last incident → "Sustained" copy.

### 1d. Filters + URL share

1. Click the "S1" chip → URL gains `?severity=S1`. Table filters to S1 only. KPIs do not change.
2. Copy the URL, paste into a new tab → same filter state.
3. Click "All" chip → returns to base.

### 1e. Sandbox toggle gating

1. As `site_admin` → "Show sandbox" link visible at the right of the filter row (has `site:configure`).
2. Sign in as a worker (no `site:configure`) → toggle hidden.

### 1f. Loading state

1. Throttle the network to "Slow 3G" in DevTools.
2. Reload `/incidents` — confirm the skeletons in `loading.tsx` match the post-load layout (7 KPI skeletons, chart skeleton, 4 breakdown skeletons, pipeline skeleton, table skeleton). No layout shift on hydration.

### 1g. Mobile / responsive

1. Resize to 1024px → KPI row 1 collapses to 2-col, breakdowns to 2-col.
2. Resize to 640px → all rows collapse to 1-col. No horizontal body scroll.
3. Trend chart remains responsive (recharts handles its own width).

## 2. Wizard polish

### 2a. Header treatment

1. Click "Report incident" from `/incidents` → land on `/incidents/new/1`.
2. Confirm header: destructive-tinted icon + "Report Incident" title + "Complete all three steps…" subtitle + breadcrumb above.
3. Wizard progress shows three pills with `ChevronRight` between them. Active pill has a green border + green-tinted bg.

### 2b. Future-date validation (Step 1)

1. On Step 1, set `Date and time` to tomorrow.
2. Click Continue → field-level error: "Occurred time can't be in the future."

### 2c. Witness carryover helper (Step 2)

1. Advance to Step 2.
2. Confirm helper text under the Witnesses heading: "Statements you record here will carry over to the assigned investigator once the report is finalized."

### 2d. Step 3 finalize copy + save-and-exit

1. Advance to Step 3.
2. Footer should show **three** elements: ← Back · Save draft & exit · Finalize report.
3. Submit button reads "Finalize report" (not "Submit incident"); transient label is "Finalizing…" while pending.
4. Below the button: "Starts the regulatory clock and notifies anyone configured for Track <X> events at this site."
5. Click "Save draft & exit" → land on `/incidents` with the draft incident visible (after toggling sandbox if it's a sandbox draft).

### 2e. Idempotent finalize

1. Open Step 3 of an unfinalized draft.
2. Double-click "Finalize report" rapidly.
3. Confirm only one incident is created (refresh the list, count rows).

## 3. Detail page polish

### 3a. Soft-deleted incident → notice card

1. Pick a finalized incident's UUID. In Supabase SQL, run `update incidents set deleted_at = now() where id = '<uuid>';`.
2. Visit `/incidents/<uuid>`.
3. Confirm the page renders the "This incident was deleted" card (not 404, not a raw error). Copy mentions retention + ref code + ← Back to incidents link.
4. Restore: `update incidents set deleted_at = null where id = '<uuid>';`.

### 3b. Severity-override audit history

1. Pick a finalized incident. Override its severity at least twice via the triage modal.
2. Reload the detail page → aside "Severity" card now shows a `<details>` block "Override history (N)" with the latest entry pre-rendered + a "Show all" affordance. Expand it → confirm full reverse-chrono list with from→to / by-whom / when / reason for each.

### 3c. Parallel queries

1. Open the Network panel → reload an incident detail page.
2. Confirm the four secondary queries (overrides, investigation, attachments, site members) fire roughly concurrently after the incident query, not sequentially.

### 3d. Dark mode

1. Toggle `class="dark"` on `<html>` (or system theme).
2. Visit `/incidents` and a detail page → spot-check every badge (Severity, Track, Status). No raw `text-white` on a non-saturated background; "Draft" status badge uses the warning token (no Tailwind amber literals).

## 4. Cross-cutting

- **Permissions**: Sign in as a worker → `/incidents` renders with KPIs + chart + breakdowns + pipeline (RLS scopes data to their site). Sandbox toggle hidden. Filter chips work.
- **Brand purple `#735CDD`** appears only on primary CTAs (Report incident, This-month KPI accent, Top-sites bar fill). Success green appears on Track-C bar fill, status-pipeline Closed card, "Days since last" KPI.
- **No console warnings** in `pnpm dev` console while navigating.

## Pass criteria

All sections above pass without manual workaround. If anything drifts, file under `Phase 6b — followups` and link the row.
