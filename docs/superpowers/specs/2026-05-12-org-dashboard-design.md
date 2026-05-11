# Phase 19 — Org-Level Dashboard + Per-Site Dashboard

- **Status:** Design approved 2026-05-12, ready for plan decomposition
- **Owner:** rafi (SDS Manager EHS platform)
- **Inspiration:** `assets/dashboard.png` (layout cues only, not literal content)

## Context

Today's `/dashboard` is site-scoped: KPIs, Argus tiles, recent incidents all pivot on the topbar's currently-selected site. The user experience is "pick a site, then see that site's posture." For org admins and EHS managers responsible for multiple sites, this forces a tab-and-switch dance just to get a cross-site picture.

This phase flips `/dashboard` to **org-level** by default, hides the site selector on that route only, and introduces a new public per-site route at `/sites/[id]` that mirrors the org dashboard's shape but is scoped to one site. Map pins on the org dashboard click through to the per-site dashboard.

The work is ambitious in surface area but additive in data — no schema changes, no new RBAC keys. Everything pivots on existing tables, existing permissions, and existing aggregators that get a "null site means org-wide" code path.

## Goals

- `/dashboard` becomes org-wide: KPIs, tiles, charts, activity, drafts all roll up across every site the caller can access (via RLS).
- Topbar SiteSwitcher hidden on `/dashboard` route only; visible everywhere else (including the new `/sites/[id]`).
- New `/sites/[id]` public route is the per-site dashboard — mirrors the org dashboard's sections, scoped to one site.
- Visual sites map (Leaflet + OpenStreetMap) on the org dashboard; pins click through to `/sites/[id]`.
- Six small plans (19a–19f), each independently shippable as one PR.

## Non-goals

- No real-time updates (no websockets on KPIs or activity feed).
- No Mapbox/Google tile upgrade; Leaflet + OSM is sufficient until a customer asks otherwise.
- No acknowledgement / dismissal UX on the activity feed; it's a read-only stream.
- No incident heatmap or hazard overlay on the map; pins only.
- No worker-only redirect logic — workers see the same `/dashboard`, just with RLS-filtered data.

## Architecture & routing

### Routes

| Route | Audience | SiteSwitcher | Notes |
|---|---|---|---|
| `/dashboard` | everyone | **hidden** | Org-level rollup |
| `/sites/[id]` | everyone with `incident:read_site` on that site | visible | New route — per-site dashboard |
| `/admin/sites/[id]` | `org:configure` holders | visible | Unchanged — members, archive, danger zone |

The sidebar logo / "Home" link continues to point at `/dashboard` (no change today). The SiteSwitcher, when used on `/sites/[id]`, replaces the URL's `[id]` with the picked site so the user hops between site dashboards without going back to `/dashboard`.

### Data scoping rules

- `/dashboard` queries: filtered only by `org_id = current_org()` plus RLS. RLS already enforces per-site `site_members` membership, so an EHS manager scoped to two sites sees a rollup of two sites only — no extra app-layer gate needed.
- `/sites/[id]` queries: filtered by `site_id = $1`. Route guard with `can('incident:read_site', siteId)` before render (same pattern as `/dashboard`'s line 53 today).

### Audience behavior

- Workers see `/dashboard` like anyone else; with single-site access their org dashboard effectively becomes a one-site view. WorkerWelcomeCard / RoleWelcomeCard still render on first visit.
- Get-Started widget stays admin-only via existing `org:configure` gate.

## Page content — top to bottom

```
+-----------------------------------------------------------------+
| (a) Get Started widget        (admin-only, exists today)        |
+-----------------------------------------------------------------+
| (b) Setup-incomplete banner   (yellow, exists today)            |
+-----------------------------------------------------------------+
| (c)  Greeting only — "Hi, <first>" + subtitle                    |
+-----------------------------------------------------------------+
| (c.1) Quick actions row  (horizontal, wraps on mobile)           |
|   [+ Report incident]  [Start inspection]  [+ Add hazard]        |
|   [+ New CAPA]  [+ New JSA]  [+ New bulletin]                    |
|   - Each button gated by its create permission                    |
|   - Report incident = primary brand purple, others = outline      |
|   - On /dashboard a "Choose a site" Step-0 modal opens before    |
|     the wizard. On /sites/[id] the site is known, no modal.       |
+-----------------------------------------------------------------+
| (d) KPI strip — 5 cards                                          |
|   Active sites | Open inc. | S1/S2 open | TRIR YTD | DART YTD    |
|   First card (Active sites) accents in bg-primary brand purple   |
+-----------------------------------------------------------------+
| (e) Sites map (full width, ~360px tall, fit-bounds on load)      |
|   Pin color: green (clean) · amber (S1/S2 open) · red (stop-work)|
|   Click pin -> /sites/[id]                                         |
|   Empty state when no site has coords: "Add coordinates in       |
|   site setup" with deep link to /admin/site-setup.                |
+-----------------------------------------------------------------+
| (f) Argus insight tiles  (only if argus_enabled + argus:use)     |
|   2x2 grid — overdue inv. / stop-work / reportability / capa     |
|   Tile aggregators extend to accept siteId=null and fan org-wide |
|   Tiles stay idle-by-default with explicit "Analyse" button      |
+-----------------------------------------------------------------+
| (g) Module cards grid — 3x2                                       |
|   Incidents | Inspections | Hazards                              |
|   JSA       | CAPA        | Investigations                       |
|   Each card: icon + 1-line tagline + 2 rolled-up numbers +       |
|   "View all ->" CTA. Per-card permission gate; card omitted if    |
|   user has no read perm for that module.                          |
+-----------------------------------------------------------------+
| (h) Trends — 2-col on lg+                                         |
|   Left: incidents per month, last 12 mo, stacked by severity     |
|         (recharts line, S1-red / S2-amber / S3-yellow / S4-green)|
|   Right: severity distribution donut YTD                          |
+-----------------------------------------------------------------+
| (i) Recent activity | Latest bulletins  (2-col)                   |
|   activity_events org-wide (10 latest) | existing LatestBulletins |
+-----------------------------------------------------------------+
| (j) Bottom row — 3-col                                            |
|   My drafts | Recent assets | Recent documents                    |
+-----------------------------------------------------------------+
| (k) Worker / role welcome card (first visit, exists today)        |
+-----------------------------------------------------------------+
```

### Section semantics

- **Active sites KPI** (new): `count(*) from sites where org_id = current_org() and setup_completed_at is not null`.
- **Sites map empty state:** when zero sites in the org have `latitude IS NOT NULL AND longitude IS NOT NULL`, render a stub with a CTA to `/admin/site-setup`. When some have coords and some don't, render the map with the available pins and a footnote: "N site(s) hidden — missing coordinates."
- **My drafts** (j-left): union of three queries scoped to `created_by = me` (or `assignee = me` for inspections):
  - `incidents` where `status = 'draft'`
  - `inspections` where `status = 'in_progress'` and the user is in `inspection_assignees`
  - `template_versions` where `status = 'draft'` and the user authored it
  Each row shows a "Resume →" link to the right wizard step.
- **Recent assets** (j-middle): top 5 by `created_at desc` from `assets` (note: table is `assets`, not `resources`).
- **Recent documents** (j-right): top 5 by `created_at desc` from `documents`.

## Implementation surface

### Schema deltas

**None required.** Audit:

- `sites.latitude` / `sites.longitude` — already exist (Phase 13), Step 1 of the site-setup wizard already captures them.
- `sites.setup_completed_at` — already exists; drives the Active sites KPI and the map's empty-state heuristic.
- `activity_events` — already exists (Phase 9a); feeds Recent activity.
- `incidents.status = 'draft'` — already exists; feeds My Drafts.
- All module rollup queries are `count('exact', { head: true })` against existing tables.
- No new RBAC permission keys; everything reuses today's `*:read_site`, `*:create`, `org:configure`, `argus:use`.

### Per-section data sources

One server-side function per box, all under `lib/dashboard/org/<section>.ts`:

| Section | Source tables | Aggregation |
|---|---|---|
| KPI strip | `incidents`, `site_annual_hours`, `sites` | `count(*)` filtered by `org_id`; TRIR/DART = Σ recordables ÷ Σ hours × 200,000 |
| Sites map | `sites` (rows with lat+lng) left-joined to `incidents` for open S1/S2 count + active stop-work (any incident with stop-work flag set and not lifted) | One query, capped at ~50 sites for any realistic customer |
| Argus tiles | existing aggregators in `lib/argus/tiles/*` | Each extended to accept `siteId: null` and fan org-wide |
| Module cards | `incidents`, `inspections`, `hazards`, `jsas`, `capas`, `investigations` | One Promise.all batch of head-only counts |
| Trends line | `incidents` grouped by `date_trunc('month', occurred_at)` + severity | Last 12 months, server-side SQL grouping; recharts client |
| Severity donut | `incidents` filtered YTD by severity | Single grouped query |
| Recent activity | `activity_events` order by `created_at desc` limit 10 | No site filter |
| Latest bulletins | existing `LatestBulletinsCard` component | Already org-scoped, no change |
| My drafts | union of: `incidents (status='draft', created_by=me)`, `inspections (status='in_progress', inspection_assignees.user_id=me)`, `template_versions (status='draft', created_by=me)` | 3 small queries, max 5 rows each |
| Recent assets | `assets` order by `created_at desc` | Top 5 |
| Recent documents | `documents` order by `created_at desc` | Top 5 |

### Hard rules preserved (from CLAUDE.md)

- Argus tiles stay idle-by-default with explicit Analyse button (per `[[feedback-argus-tiles-manual-analyse]]`).
- Argus tile route handlers still require a named human for any commit; no auto-classification.
- `/dashboard` is part of the `(app)` shell so the StopWorkBanner mounts above it.
- Use `bg-primary` not `bg-brand` for the brand-purple KPI accent and primary CTA (per `[[feedback-bg-brand-not-a-utility]]`).
- All quick-action destinations land on existing wizard routes; no new wizard surfaces — we just expose entry points.

### Net new dependencies

- `leaflet` (~40 KB gzip)
- `react-leaflet` (~10 KB)
- `@types/leaflet` (devDependency)

Map component must be `dynamic(() => import('./sites-map'), { ssr: false })` because Leaflet touches `window` on import. `recharts` is already in the dependency tree.

## Plan decomposition

Six plans, sequenced. 19a is the only hard prerequisite — after it lands, 19b–19f can ship in any order or in parallel because they touch disjoint sections of the page.

### 19a — Foundation: topbar + org KPIs + `/sites/[id]` stub

- Hide SiteSwitcher on `/dashboard` route only (topbar inspects `usePathname()`).
- Add `/sites/[id]/page.tsx` empty shell: site name header + "Site dashboard coming in 19f" placeholder. Acts as the map click target.
- Refactor existing 4 KPIs to org-scoped: drop `.eq('site_id', currentSiteId)` and rely on `org_id` + RLS.
- Add 5th KPI: **Active sites** (count of sites with `setup_completed_at IS NOT NULL`).
- Argus tile aggregators (`getOverdueInvestigationsTilePayload`, `getStopWorkActiveTilePayload`, `getReportabilityUncertainTilePayload`, `getCapaOverdueTilePayload`) accept `siteId: null` and fan org-wide when null.
- Remove today's site-scoped recent-incidents block from `/dashboard` (returns reshaped in 19e).
- Welcome cards, Get-Started widget, LatestBulletinsCard, setup-incomplete banner unchanged.

### 19b — Sites map

- Install `react-leaflet` + `leaflet` + `@types/leaflet`.
- New `<SitesMap />` component with dynamic import (`ssr: false`).
- `lib/dashboard/org/sites-map.ts` aggregator pulls sites with `latitude IS NOT NULL` + open S1/S2 count + active stop-work flag (rolled up from `incidents`).
- Pin color: green (clean), amber (S1/S2 open), red (stop-work).
- Click handler navigates to `/sites/[id]`.
- Empty state when zero sites have coordinates; partial-coverage footnote when some are hidden.
- Mounted as full-width section between (d) KPI strip and (f) Argus tiles.

### 19c — Quick actions row + Module cards grid

- Quick actions row (c.1) component with 6 permission-gated buttons.
- "Choose a site" Step-0 modal for create-wizard entry from `/dashboard` (org mode); skipped on `/sites/[id]`.
- Module cards grid (3×2) with Incidents / Inspections / Hazards / JSA / CAPA / Investigations.
- Per-module aggregator functions in `lib/dashboard/org/modules/<module>.ts`, each returning `{ primaryCount, secondaryCount, secondaryLabel, drillIn }`.
- Per-card permission gating: skip card entirely if user has no read perm for that module.

### 19d — Trends section (charts)

- Server-side aggregators: incidents-per-month (last 12, stacked by severity) and severity-distribution YTD.
- recharts line chart + donut chart, 2-col on lg+.
- Empty states: "No incidents yet" with a soft illustration / muted copy.

### 19e — Recent activity + bottom row (Drafts · Assets · Documents)

- Org-wide `activity_events` feed (top 10) paired 2-col with existing `LatestBulletinsCard`.
- 3-col bottom row: My Drafts (union query) · Recent assets · Recent documents.
- All four cards are small aggregators that don't depend on each other beyond layout; ship as one batch to avoid five tiny PRs.

### 19f — Per-site dashboard `/sites/[id]`

- Replaces the 19a stub with the real page.
- Mirror of `/dashboard` scoped to one site:
  - Same KPI strip (site-scoped queries).
  - Map removed (single site, no map needed).
  - Quick actions row (site already known, no picker).
  - Module cards (site-scoped).
  - Charts (site-scoped).
  - Recent activity (site-scoped).
  - My drafts + Recent assets + Recent documents (site-scoped where applicable).
  - Argus tiles (today's existing site-scoped path).
- All components from 19a–19e are designed reusably so this PR is mostly "pass siteId instead of null" + a route.

## Open questions / risks

- **Choose-a-site picker UX:** for the org-mode quick-actions row, the picker can be a small `<Sheet>` modal showing the user's accessible sites, or a one-step `/incidents/new/0` "pick a site" page. To be decided in 19c. Default: sheet modal — fewer URL hops.
- **OSM tile traffic:** Leaflet + OSM is fine at our current scale, but the OSM Foundation's tile usage policy is "be reasonable." If a customer's dashboard becomes high-traffic enough that we exceed casual use, we'll need a paid tile host (Mapbox, Stadia, MapTiler). Tracked but not blocking.
- **Activity feed RLS:** verify `activity_events` RLS already filters by `org_id` and by the caller's accessible sites. If not, the query needs an explicit join through `sites` / `site_members`.
- **Drafts schema for template_versions:** confirm `created_by` exists on `template_versions` (versus just on `templates`). If not, the My Drafts union covers incidents + inspections only.

## Decisions log

- 2026-05-12 — Per-site dashboard goes at `/sites/[id]` (new public route), not folded into `/admin/sites/[id]`.
- 2026-05-12 — Layout is stacked single-column (matches asset, matches existing app shell).
- 2026-05-12 — Module cards grid = Incidents, Inspections, Hazards, JSA, CAPA, Investigations (3×2).
- 2026-05-12 — Map provider = Leaflet + OpenStreetMap (no API key, no vendor account).
- 2026-05-12 — Drafts section = "My drafts" (resume-where-I-left-off), not org-wide admin oversight.
- 2026-05-12 — Quick actions row includes New Bulletin for admins (`bulletin:create` gate).
- 2026-05-12 — Six-plan decomposition (19a–19f); 19a is the only hard prerequisite.
