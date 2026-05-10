# Phase 9e — Argus Global Side Panel + Insight Tiles

**Status:** scoped 2026-05-10. Closes Phase 9.
**Goal:**

1. **Promote the empty side-panel shell from 9a into a page-context-aware Argus workspace.** The Sheet that opens from the topbar Sparkles avatar already streams a single ping turn (9a). 9e teaches it the route it was opened from + the records visible on that route, pre-loads a system block, and offers a small "Suggested questions" set scoped to the page. Same `argus:use` gate, same SSE wire — the upgrade is the *system block* and the *suggestion chips*, not the wire.
2. **Drop a single reusable `<ArgusInsightTile>` on the four index pages where Argus can summarise without committing.** Four cards on `/dashboard` (Overdue investigations · Stop-work active · Reportability uncertain · CAPA cluster overdue), one tile each on `/capa`, `/inspections`, `/reports`. Read-only in the same sense as 9d's Reportability pane — no Accept / Edit / Reject, just a verdict with a citation back into the underlying records.

**Branch:** `feat/phase-9e-argus-panel-and-tiles`
**PR target:** `main`
**Depends on:** 9a (foundation: `argus_suggestions`, `activity_events.actor_kind`, `argus:use`, `lib/argus/llm/`, gates, budget, ratelimit, redactor, side-panel shell), 9b (Copilot route — for the panel's Compose lane), 9c (Investigator route + per-section confirm pattern — only as design precedent), 9d (provider abstraction + `<ArgusMagicWand>` + `<SuggestionCard>` patterns + `app/api/argus/wand/route.ts`).
**Master plan:** `plans/09-argus-ai-assistant.md` → 9e row.

---

## Context — what 9e is and what it isn't

**Is:**
- The "make Argus *globally useful*" phase. Until 9e, Argus only appeared inline on the surface a human had already opened (Wizard, Investigation tab, CAPA modal, Reports). 9e gives Argus a *foothold on every page* via the topbar Sheet, and *first-class summarisation tiles* on the index pages where overview is the entire job.
- A *page-context* phase. The side panel learns the route + (when applicable) the record under the cursor. Pages opt in via a small `<ArgusContext>` provider (server component reads route params + a couple of cheap aggregates → renders a hidden `<ArgusContextPayload>` element → the side panel reads it from the DOM on open).
- A *summarisation* phase. Tiles read aggregate state — counts, dates, maybe up to 5 row IDs — never PII-laden free text. They render a one-paragraph summary + a single recommended action *link* into the existing flow ("3 investigations are overdue → Open list").

**Isn't:**
- A persistence phase. Side-panel turns are still ephemeral within a session; 9.1+ if we want history.
- A new write path. Tiles never call wand surfaces or commit anything. The recommended action is a `<Link>`, not a server action.
- A multi-turn agentic surface. The side-panel `Compose` lane re-uses 9b's `streamText` shape (single user turn, optional tool calls), but the only tools it can call are read-only summary tools — same shape as 9b's `log_observation` tool, but they query Postgres and return text, never mutate.
- A new-permission phase. `argus:use` covers everything; tiles surface only when the underlying read permission for that index page passes (`investigation:read`, `capa:read`, `inspection:read`, `report:read`).
- A new-schema phase. `argus_suggestions` covers the audit log; the panel's `target_kind` is `null` (page-context) or the visible record's id; the tile's `target_kind` is `'page'` with `target_id` storing the route key (e.g. `'dashboard'`). The `surface` text column gets four new values: `panel_chat`, `tile_overdue_investigations`, `tile_stop_work`, `tile_reportability_uncertain`, `tile_capa_overdue`, `tile_capa_index`, `tile_inspections_due`, `tile_reports_pending`.

The panel and the tiles share the same provider (Gemini), the same gates (`runArgusGates`), the same redactor, and the same `<SuggestionCard>` visual language even though tiles never offer Accept — the rationale row, the cyan border, the Sparkles glyph all carry forward so users learn one Argus shape.

---

## Hard rules carried forward (zero new ones)

- **Rule 1 — assistive, not authoritative.** Tiles never auto-act. Side panel never gets to call wand tools (those still gate on the surface's underlying write permission and are user-initiated). The "Open list" link on a tile is just navigation.
- **Rule 4 — no auto-classify, no auto-route, no auto-close.** The panel's read-only summary tools (e.g. `summarise_capa_cluster`) are read-only by construction — they `SELECT`, never `INSERT/UPDATE`.
- **Rule 5 — PII redaction.** The page-context payload sent into the system block is built server-side and runs through `redactText()` before egress. Tiles only ever send aggregate text (counts + dates + reference codes) to the model; raw incident descriptions stay on the server.
- **Rule 6 — cost guardrails.** Tiles auto-load on first paint with a **24h cache keyed on a tile-specific freshness signal** (per-tile `lastModifiedAt` aggregate). Subsequent renders within the cache window hit `argus_suggestions` and skip the model. Re-assess link forces fresh. Light bucket on the panel (10/min/user); tile auto-loads bypass the user rate limit (counted under a separate `tile` bucket: 20/min/user across all tiles, since first-paint can fan out).
- **CLAUDE.md "Argus is assistive, not authoritative"** + **"Every Argus interaction is logged"** unchanged. Tile auto-loads write `argus_suggestions` rows with `outcome='pending'`; no outcome flip ever happens (tiles aren't Accept/Edit/Reject), so a daily expirer flips stale `pending` rows to `expired` after 24h to keep the audit table tidy. (Implementation: a `pg_cron` job is overkill for v1 — flip lazily inside the tile route handler when we hit a stale row.)

---

## Architecture

### Page-context plumbing — `lib/argus/page-context.ts`

A small contract every (app)-routed page can opt into:

```ts
export type ArgusPageContext = {
  route: string;                       // canonical key, e.g. 'dashboard' | 'incident_detail' | 'capa_index'
  routeLabel: string;                  // human label, e.g. 'Dashboard' | 'Incident IR-014'
  siteId: string | null;
  records?: {
    kind: 'incident' | 'investigation' | 'capa' | 'inspection' | 'report';
    id: string;
    refCode: string | null;            // e.g. 'IR-014'
    title: string | null;              // already redacted
  }[];
  aggregates?: Record<string, number>; // small counts for the system block, e.g. { open: 12, overdue: 3 }
};
```

Wire: Server component renders `<ArgusContextPayload context={ctx} />` somewhere in the page tree. Client `<ArgusSidePanel>` reads it on open via a tiny React context (`useArgusPageContext()`). The provider wraps the (app) layout once; pages fill in via:

```tsx
// app/(app)/incidents/[id]/page.tsx (server)
<ArgusContextPayload context={{
  route: 'incident_detail',
  routeLabel: `Incident ${incident.ref_code}`,
  siteId: incident.site_id,
  records: [{ kind: 'incident', id: incident.id, refCode: incident.ref_code, title: redact(incident.title) }],
  aggregates: { investigations: invs.length, openCapas: openCapas },
}} />
```

Pages that don't render the component fall back to a default context (route='unknown', records=[]). The panel still works — it just lacks the system block specialisation.

### Side panel upgrade — `components/argus/argus-side-panel.tsx`

Existing shell stays; three additions:

1. **Header chip** — small route badge: `Dashboard · UCB Houston (US)` shows the user what the panel is grounded on. Clears any worry that Argus is hallucinating which page they're on.
2. **Suggested questions** — three chips below the header, derived per-route from a small static map keyed on `ArgusPageContext.route`:
   ```ts
   const PANEL_SUGGESTIONS: Record<string, string[]> = {
     dashboard: [
       'What needs my attention this week?',
       'Are any incidents at risk of missing the OSHA 8hr clock?',
       'Summarise this site\'s safety trends.',
     ],
     incident_detail: [
       'Walk me through this incident\'s classification path.',
       'What CAPAs typically follow this hazard category?',
       'Is this likely OSHA-recordable?',
     ],
     // ... per-route entries
   };
   ```
   Tap a chip → fills the textarea + auto-submits.
3. **Persistent compose lane** — the existing form already streams the response. Refactor to keep the conversation visible (one user turn + one Argus turn) within a single panel session; closing the Sheet clears it. No multi-turn (Q1 below).

The panel still POSTs to `/api/argus/stream` with `surface: 'panel_chat'` (new value, replacing the 9a `'ping'` placeholder). The route handler builds the system prompt using `buildPanelSystemPrompt(ctx)` which:
- Reads the `route` + `routeLabel` + `aggregates` directly into the system block.
- Pulls the redacted record summaries from `records[]` (already redacted client-side before posting; double-redacted server-side defence-in-depth).
- Appends "If you don't know, say 'I'd need to look at the underlying records' and stop." (anti-hallucination rule).

`'panel_chat'` is added to `ArgusSurface` and `TIER_BY_SURFACE` (= `'fast'` — Flash is plenty for one-paragraph page summaries).

### Insight tiles — `components/argus/argus-insight-tile.tsx`

One reusable component:

```ts
type ArgusInsightTileProps = {
  tile: 'overdue_investigations' | 'stop_work_active' | 'reportability_uncertain' | 'capa_overdue'
      | 'capa_index_summary' | 'inspections_due_summary' | 'reports_pending_summary';
  payload: { siteId: string; aggregates: Record<string, number>; recordRefs?: string[] };
  href: string;        // navigation target for the recommended-action link
  hrefLabel: string;
};
```

Renders:

```
┌─ ✨ Argus insight ─────────────────────────────── confidence 88% ─┐
│  3 investigations are overdue (LTI-12, LTI-08, LTI-22).            │
│  Two are missing 5-Why; LTI-22 has no assigned investigator.       │
│  Suggested next step:  Open overdue list →                          │
└────────────────────────────────────────────────────────────────────┘
```

Visuals:
- Cyan left-border (`#00D4FF`), Sparkles icon, "Argus insight" eyebrow at 11px uppercase.
- Body: ≤ 2 sentences (~280 chars max — enforced by tool schema `maxLength: 280`).
- One inline `<Link>` (`hrefLabel` → `href`).
- Skeleton state on first paint → final card on resolve.
- Empty state ("Nothing to flag right now — Argus is watching.") when the tool returns `nothing_to_flag: true`.
- Error state ("Argus couldn't generate this — try again later.") collapses to muted; never blocks the page.
- Dark mode: cyan on dark surface, exact same pattern as 9d's wand suggestion-card.

Auto-load on first paint via `useArgusInsightTile(tile, payload)` — POST to `/api/argus/tile` with the tile key + payload, return the cached row when `target_id = tileCacheKey(tile, payload)` and `created_at >= cacheCutoff(tile)`. Otherwise fresh model call, write `argus_suggestions`, return the rendered card. SWR-style: stale data shows immediately while a revalidation runs in the background.

### Tile data plumbing

Each tile owns a server-side aggregator that produces its `payload`. These live in `lib/argus/tiles/` so the route handler and the tile's enclosing server component can share them:

```
lib/argus/tiles/
  overdue-investigations.ts   # SELECT count + top-5 ref_codes WHERE overdue
  stop-work-active.ts         # SELECT count + top-5 incident ref_codes WHERE stop_work AND NOT acknowledged
  reportability-uncertain.ts  # SELECT incidents whose latest reportability suggestion has confidence < 0.7
  capa-overdue.ts             # SELECT count + top-5 ref_codes WHERE due_at < now() AND status NOT closed
  capa-index-summary.ts       # SELECT cluster heuristic (most-frequent root_cause this month)
  inspections-due-summary.ts  # SELECT count + top-5 templates due in next 7 days
  reports-pending-summary.ts  # SELECT count of OSHA-recordable + RIDDOR-reportable incidents lacking filed reports
```

Each aggregator returns `{ siteId, aggregates, recordRefs?, freshnessKey }`. `freshnessKey` is the tile's cache key — for `overdue_investigations` it's `max(updated_at) over the rows`, for `stop_work_active` it's `max(stop_work_raised_at) over active rows`, etc. The cache is hit when a row exists in `argus_suggestions` with matching `target_id = sha1(tile + freshnessKey)` and `created_at` within the tile's TTL.

TTL per tile (Q3 below):

| Tile | TTL | Why |
|---|---|---|
| `overdue_investigations` | 24h | Aggregates change daily as clocks tick |
| `stop_work_active` | 1h | High-stakes; under-cached is fine |
| `reportability_uncertain` | 24h | Tied to `incident.updated_at` |
| `capa_overdue` | 24h | Daily clock |
| `capa_index_summary` | 24h | Trend-style |
| `inspections_due_summary` | 24h | Daily clock |
| `reports_pending_summary` | 24h | Trend-style |

The `freshnessKey` does most of the work — TTL is just a backstop for "nothing changed but we should re-look anyway."

### Tile route handler — `app/api/argus/tile/route.ts`

POST `{ tile, payload }`. Server flow:

1. `runArgusGates('tile_<key>')` — uses the *tile bucket* (20/min/user across tiles).
2. `argus:use` + the tile's enclosing read permission.
3. Compute `cacheKey = sha1(tile + JSON.stringify(payload.aggregates) + (payload.freshnessKey ?? ''))`.
4. SELECT `argus_suggestions` WHERE `surface = 'tile_<key>'` AND `target_kind = 'page'` AND `target_id = cacheKey` AND `created_at >= now() - TTL[tile]`. If hit, return its `payload.output` directly.
5. Build redacted user prompt from `payload.aggregates` + (if present) `payload.recordRefs` (`['IR-014','IR-022',…]`).
6. `getLLM().generateStructured({ surface: 'tile_<key>', tier: 'smart', tool: TILE_TOOLS[tile], thinking: 'off' })` — Pro for the better prose, thinking off for cost (Q4 below).
7. Validate output with Zod mirror.
8. `INSERT argus_suggestions` (target_kind='page', target_id=cacheKey, payload={kind:'tile', output, freshnessKey}, outcome='pending').
9. `INSERT activity_events` (verb='argus.tile_generated', actor_kind='argus').
10. Return `{ ok: true, suggestionId, output }`.

**Non-streaming.** ~2–6s on Pro with thinking off.

### Tools — `lib/argus/tools/`

Seven new structured-output tools. Each returns the same envelope shape so `<ArgusInsightTile>` is provider-agnostic:

```ts
type TileOutput = {
  summary: string;            // <= 280 chars
  rationale: string;          // <= 400 chars
  confidence: number;         // 0..1
  nothing_to_flag?: boolean;
  recommended_action_label?: string;  // overrides hrefLabel; falls back to default
};
```

```
lib/argus/tools/tile-overdue-investigations.ts
lib/argus/tools/tile-stop-work-active.ts
lib/argus/tools/tile-reportability-uncertain.ts
lib/argus/tools/tile-capa-overdue.ts
lib/argus/tools/tile-capa-index-summary.ts
lib/argus/tools/tile-inspections-due-summary.ts
lib/argus/tools/tile-reports-pending-summary.ts
```

Add `TILE_TOOLS` map in `lib/argus/tools/index.ts` (alongside `WAND_TOOLS`, `COPILOT_TOOLS`, `INVESTIGATOR_TOOLS`).

### System prompts — `lib/argus/system-prompts/`

Seven new files, ≤ 25 lines each:

- `tile-overdue-investigations.md` — encodes "overdue = open investigation past target date OR Track A with no 5-Why after 14d"; required to cite specific ref_codes from the input.
- `tile-stop-work-active.md` — encodes "an unacknowledged stop-work is the single highest-priority signal on the platform"; formats the count + names.
- `tile-reportability-uncertain.md` — pulls the 9d reportability rubric; flags the count where the latest assessment had confidence < 0.7.
- `tile-capa-overdue.md` — encodes CAPA SLA tiers; rationale includes how many days past due.
- `tile-capa-index-summary.md` — surface a *cluster* heuristic ("4 of the last 10 CAPAs are tagged 'PPE — slip resistance' — consider a category-level control").
- `tile-inspections-due-summary.md` — surface count + top-5 templates due in next 7d.
- `tile-reports-pending-summary.md` — surface OSHA-recordable / RIDDOR-reportable incidents that have no filed report yet.

All prompts include the global anti-hallucination rule from the panel system prompt.

### Side-panel route handler reuse — `app/api/argus/stream/route.ts`

The 9a "ping" endpoint stays — its surface set widens to include `'panel_chat'`. The handler builds the system prompt from the request body's `pageContext` field (validated with a Zod schema). Wire format unchanged: `event: token` deltas, `event: usage` at end, `event: done`.

```ts
type StreamBody = {
  surface: 'panel_chat' | 'ping';
  prompt: string;
  pageContext?: ArgusPageContext;
};
```

When `surface = 'panel_chat'`, the handler uses `buildPanelSystemPrompt(ctx)`; when `'ping'`, the existing static prompt. Server-side double-redacts `pageContext` before the model call.

### Topbar Argus button — already done in 9a, refined here

- Move to `right of notification bell` per master plan (currently sits *between* Help and Bell — a one-line reorder in `components/app-shell/topbar.tsx`).
- Tooltip stays "Ask Argus."
- Add a small dot indicator when the current page has tiles with active flags (a single boolean prop wired from page server components — same `<ArgusContextPayload>`).

### Component tree

```
components/argus/
  argus-side-panel.tsx              ← upgrade: page-context, suggestion chips, conversation pane
  argus-context.tsx                  ← NEW: <ArgusContextPayload> + useArgusPageContext()
  argus-insight-tile.tsx             ← NEW: read-only summary card
  use-argus-insight-tile.ts          ← NEW: SWR-style fetch hook (POST → JSON envelope, no SSE)
  panel-suggestion-chip.tsx          ← NEW: tiny chip used by the panel header
  panel-conversation-pane.tsx        ← NEW: extracted from the existing single-turn UI
```

### Page integration — additions only

```
app/(app)/dashboard/page.tsx                     (4 ArgusInsightTile cards: overdue / stop-work / reportability / capa-overdue)
app/(app)/capa/page.tsx                          (1 ArgusInsightTile: capa_index_summary)
app/(app)/inspections/page.tsx                   (1 ArgusInsightTile: inspections_due_summary)
app/(app)/reports/page.tsx                       (1 ArgusInsightTile: reports_pending_summary)
app/(app)/incidents/[id]/page.tsx                (mount <ArgusContextPayload> for the panel; no tile)
app/(app)/investigations/[id]/page.tsx           (mount <ArgusContextPayload>; no tile)
app/(app)/capa/[id]/page.tsx                     (mount <ArgusContextPayload>; no tile)
app/(app)/inspections/[id]/page.tsx              (mount <ArgusContextPayload>; no tile)
app/(app)/layout.tsx                              (wrap children in <ArgusContextProvider> once)
components/app-shell/topbar.tsx                   (reorder Argus button → right of bell; pass tile-flag dot)
```

No detail-page tiles in 9e — overview only. Detail pages get the side-panel context, not their own tile.

### Server actions

None. All reads are SELECTs done in route handlers or page server components. No new write paths.

### Schema

**Zero migration.** Re-uses 9a tables:

- `argus_suggestions.surface` accepts new strings (`panel_chat`, `tile_<key>`).
- `argus_suggestions.target_kind` accepts a new string `'page'`. (The column is `text`, no enum check.)
- `activity_events.verb` accepts `argus.tile_generated`.

A *small* RLS confirmation pass needed: tile rows store `target_kind='page'` and `target_id=sha1(...)`. The existing site-membership-via-`user_can_access_site` rule still gates SELECT; INSERT writes the org_id from `gate.orgId` so any site member of the org can read a cached row, which is the desired behaviour (a CAPA-overdue tile rendered for one site_admin should hit the cache for the next).

### Permissions

**No new permission keys.**

| Surface | Visibility | Action |
|---|---|---|
| Side panel | `argus_enabled` + `argus:use` | Same as 9a |
| Dashboard tile (overdue investigations) | `argus:use` + `investigation:read` on currentSiteId | Link to `/investigations?status=overdue` |
| Dashboard tile (stop-work active) | `argus:use` + `incident:read_site` | Link to `/incidents?stop_work=active` |
| Dashboard tile (reportability uncertain) | `argus:use` + `report:read` | Link to `/reports?reportability=uncertain` |
| Dashboard tile (capa overdue) | `argus:use` + `capa:read` | Link to `/capa?status=overdue` |
| `/capa` tile | `argus:use` + `capa:read` | Link to `/capa?cluster=<root_cause>` |
| `/inspections` tile | `argus:use` + `inspection:read` | Link to `/inspections?due=7d` |
| `/reports` tile | `argus:use` + `report:read` | Link to `/reports?status=pending` |

A user without `argus:use` (turn it off in role admin) sees no panel, no tiles, no Sparkles avatar — and the index pages render exactly as they did pre-9e.

---

## UX flow (per-surface mockups)

### Side panel — opened from `/dashboard`

```
┌─ Sheet ──────────────────────────────────────────┐
│  ✨ Argus                                         │
│  [ Dashboard · UCB Houston (US) ] ←chip           │
│  Your AI safety co-pilot. Argus suggests…         │
│                                                   │
│  Try one:                                          │
│  [ What needs my attention this week? ]            │
│  [ Any OSHA 8hr clocks at risk?         ]          │
│  [ Site safety trend?                   ]          │
│                                                   │
│  ─ conversation ─────────────────────────────── │
│  > What needs my attention this week?             │
│  ✨ 3 investigations are overdue (LTI-12, …),     │
│     1 stop-work is active on Bay 3, and 4 OSHA-   │
│     reportable incidents have no filed report.    │
│     Open Insights →                               │
│                                                   │
│  [ textarea: Ask Argus…                       ]    │
│  [ Send ]                                          │
└──────────────────────────────────────────────────┘
```

### Dashboard — 4 tiles

```
┌─ Argus insight ───────────── confidence 88% ─┐  ┌─ Argus insight ─── confidence 96% ─┐
│ ✨ 3 investigations overdue (LTI-12, LTI-08,   │  │ ✨ 1 stop-work active on Bay 3      │
│    LTI-22). Two missing 5-Why.                 │  │    raised by JS at 09:42 today.     │
│ Open overdue list →                            │  │ Acknowledge →                        │
└────────────────────────────────────────────────┘  └─────────────────────────────────────┘

┌─ Argus insight ───────────── confidence 71% ─┐  ┌─ Argus insight ─── confidence 84% ─┐
│ ✨ 2 incidents have uncertain reportability.   │  │ ✨ 4 CAPAs overdue. Top: CAPA-031   │
│    Latest call confidence < 0.7.               │  │    18d past due.                    │
│ Re-assess →                                    │  │ Open overdue list →                 │
└────────────────────────────────────────────────┘  └─────────────────────────────────────┘
```

### Empty state (one of the tiles has nothing to flag)

```
┌─ Argus insight ────────────────────────────────┐
│ ✨ Nothing to flag right now — Argus is watching.│
└────────────────────────────────────────────────┘
```

Tile collapses to a one-line muted card so the dashboard doesn't bloat with empty noise.

---

## File deltas

**New**

```
lib/argus/page-context.ts
lib/argus/tiles/overdue-investigations.ts
lib/argus/tiles/stop-work-active.ts
lib/argus/tiles/reportability-uncertain.ts
lib/argus/tiles/capa-overdue.ts
lib/argus/tiles/capa-index-summary.ts
lib/argus/tiles/inspections-due-summary.ts
lib/argus/tiles/reports-pending-summary.ts
lib/argus/tiles/index.ts                          # cache key, TTL map, dispatcher
lib/argus/tools/tile-overdue-investigations.ts
lib/argus/tools/tile-stop-work-active.ts
lib/argus/tools/tile-reportability-uncertain.ts
lib/argus/tools/tile-capa-overdue.ts
lib/argus/tools/tile-capa-index-summary.ts
lib/argus/tools/tile-inspections-due-summary.ts
lib/argus/tools/tile-reports-pending-summary.ts
lib/argus/system-prompts/panel.md
lib/argus/system-prompts/tile-overdue-investigations.md
lib/argus/system-prompts/tile-stop-work-active.md
lib/argus/system-prompts/tile-reportability-uncertain.md
lib/argus/system-prompts/tile-capa-overdue.md
lib/argus/system-prompts/tile-capa-index-summary.md
lib/argus/system-prompts/tile-inspections-due-summary.md
lib/argus/system-prompts/tile-reports-pending-summary.md
app/api/argus/tile/route.ts
components/argus/argus-context.tsx
components/argus/argus-insight-tile.tsx
components/argus/use-argus-insight-tile.ts
components/argus/panel-suggestion-chip.tsx
components/argus/panel-conversation-pane.tsx
```

**Modified**

```
lib/argus/models.ts                    # +'panel_chat' surface; +tile_* surfaces; tier map updated
lib/argus/gates.ts                     # +tile bucket (20/min/user across tile_* surfaces)
lib/argus/ratelimit.ts                 # +'tile' bucket
lib/argus/log.ts                       # accept target_kind='page' rows
app/api/argus/stream/route.ts          # add panel_chat branch + page-context system block
components/argus/argus-side-panel.tsx  # context chip, suggestion chips, conversation pane refactor
components/app-shell/topbar.tsx        # reorder Argus → right of NotificationBell; tile-flag dot
app/(app)/layout.tsx                   # wrap children in <ArgusContextProvider>
app/(app)/dashboard/page.tsx           # 4 tile mounts + ArgusContextPayload
app/(app)/capa/page.tsx                # 1 tile mount + ArgusContextPayload
app/(app)/inspections/page.tsx         # 1 tile mount + ArgusContextPayload
app/(app)/reports/page.tsx             # 1 tile mount + ArgusContextPayload
app/(app)/incidents/[id]/page.tsx      # ArgusContextPayload (record-aware panel)
app/(app)/investigations/[id]/page.tsx # ArgusContextPayload
app/(app)/capa/[id]/page.tsx           # ArgusContextPayload
app/(app)/inspections/[id]/page.tsx    # ArgusContextPayload
docs/SPEC.md                           # §16 add panel page-context + tile section
docs/ui-flow.md                        # add tile placement on each affected index page
docs/BUILD_STATUS.md                   # Phase 9e entry on merge
CLAUDE.md                              # build-status one-liner: "Phase 9 — COMPLETE"
```

**Memory (on merge)**

- New: `project_phase_9e_argus_panel_and_tiles.md`
- Update: `project_overview.md` (state line: 9e shipped, Phase 9 closed)
- Update: `MEMORY.md` index

---

## Definition of Done

**Side panel — page context**
- `<ArgusContextProvider>` wraps `(app)` layout; `useArgusPageContext()` returns the registered context or a sensible default.
- `<ArgusContextPayload>` mounted on `/dashboard`, `/incidents/[id]`, `/investigations/[id]`, `/capa/[id]`, `/inspections/[id]`, `/capa`, `/inspections`, `/reports`. Every other route uses the default.
- Opening the panel on `/incidents/IR-014` → header chip reads `Incident IR-014 · UCB Houston (US)`; suggestion chips are the `incident_detail` set; the request body's `pageContext.records` contains the redacted incident summary.
- Closing the panel clears the local conversation; reopening starts fresh.
- DevTools network on a panel turn shows redacted names (initials only) in the body.
- `argus_suggestions` row written per turn with `surface='panel_chat'`, `target_kind` matching the route's primary record (`'incident'` for incident detail, `'page'` for dashboard).
- `pnpm build` clean.

**Insight tiles**
- Four tiles render on `/dashboard`; one tile on `/capa`, `/inspections`, `/reports`.
- Skeleton on first paint → final card resolves within 6s on Pro (thinking off).
- Tile with nothing to flag collapses to the muted one-line empty state.
- Tile with a model error renders muted error text, never a 500 or page-level fallback.
- Cache hit on second view within TTL → no model call (verify in network panel; <100ms response).
- `[Re-assess]` link on each tile (small text-button at the right of the rationale row) forces a fresh call; new `argus_suggestions` row.
- Recommended-action link navigates correctly per the Permissions table above.
- Every tile generation writes `argus_suggestions` (`outcome='pending'`) + one `activity_events` row (`actor_kind='argus'`, `verb='argus.tile_generated'`).
- Tile bucket rate limit (20/min/user) enforced; 21st triggers a graceful muted error on the offending tile.
- Org daily token budget at 100% → all tiles render the "AI is offline today" state; existing dashboard data still loads.
- Without `argus:use`, no tile renders and the page layout is identical to pre-9e.
- Dark mode: cyan accent on dark surface; identical styling pattern to wand suggestion-card.
- `pnpm build` clean.

---

## Smoke test (run before opening PR)

**Page context**
- [ ] Open the panel on `/dashboard` → header chip "Dashboard · UCB Houston (US)"; ask "What needs my attention?" → answer cites at least one ref-code from the records list.
- [ ] Open the panel on `/incidents/<id>` for an incident with a known witness name "John Smith" → DevTools body shows `JS`, not `John Smith`.
- [ ] Open the panel on a route with no `<ArgusContextPayload>` (e.g. `/settings`) → header chip reads "Argus" only; suggestion chips fall back to a generic set.
- [ ] Suggestion chip click auto-fills + auto-submits.
- [ ] Two consecutive turns within one session show stacked.
- [ ] Closing + reopening clears the conversation pane.
- [ ] PII regression: redact a known witness name across two pages; confirm both panel turns send initials only.

**Tiles — dashboard**
- [ ] All four dashboard tiles render skeletons on first paint.
- [ ] Each resolves within 6s; cyan border, Sparkles, body ≤ 280 chars.
- [ ] Open dashboard a second time within 24h → all four hit cache (network < 100ms).
- [ ] Force a stop-work raise on a test incident → next dashboard load (after the 1h TTL window or via `[Re-assess]`) updates the stop-work tile.
- [ ] Disable `argus:use` on the role → no tiles, no Sparkles avatar.
- [ ] `argus_enabled=false` on the org → same.

**Tiles — index pages**
- [ ] `/capa`, `/inspections`, `/reports` each render exactly one tile above their existing list/table.
- [ ] On `/reports` with no recordable open incidents → tile collapses to "Nothing to flag right now."
- [ ] `/capa` cluster summary cites at least one root-cause string from the recent CAPAs.

**Foundation regression (must still pass)**
- [ ] 9b smoke (Copilot in `/incidents/new/1`) — unchanged.
- [ ] 9c smoke (Investigator on `/investigations/[id]?tab=ai`) — unchanged.
- [ ] 9d smoke — at least one wand on each of the four shipped surfaces.
- [ ] Topbar reorder: Argus button is right of NotificationBell.

**Cost / safety**
- [ ] Org daily token budget at 80% → side panel shows soft warn; tiles render normally.
- [ ] Org budget at 100% → side panel + tiles show "AI is offline today."
- [ ] Trigger 21 tile auto-loads in 60s → 21st triggers a friendly muted error on the offending tile.
- [ ] Cache Components: no Suspense errors; no `runtime` exports on the new route handler.

---

## Risks

1. **Page-context plumbing leaks PII.** The whole point of redacting incident titles in `<ArgusContextPayload>` is to keep names off the wire — but a developer adding a new context payload elsewhere could forget to redact. Mitigation: `redact()` is the only public way to set `records[].title`; lint rule (Q5 below) flagging raw `incident.title` passed to the component.
2. **Tile fan-out cost.** Four tiles × first paint × 100 daily-active users = 400 Pro calls/day at minimum. At ~$0.0015/call that's ~$0.60/day per active org → fine for v1. The 24h cache caps it; without the cache, opening dashboard 10× a day per user would 10× the cost.
3. **Cache invalidation on stop-work raise.** A stop-work raised at 09:00 with a 1h TTL means the dashboard tile won't refresh until 10:00. Mitigation: `freshnessKey` on `stop_work_active` is `max(stop_work_raised_at) + count(active)`, so the moment a new raise lands, the cache key changes and the next dashboard load forces a fresh call.
4. **Tile becomes wallpaper.** If a user sees the same "3 investigations overdue" tile every day, they stop reading. Mitigation: confidence + recommended-action link ensure each render does *something* useful; track impression-vs-click and iterate in 9.1 if click-through < 10%.
5. **Side-panel multi-turn drift.** Even single-session multi-turn could let a user walk Argus into hallucination. Mitigation: cap at 6 turns/session (Q1); the system prompt's "if you don't know, say so" rule.
6. **Reportability tile vs OSHA-300 row pane.** Two surfaces, one source of truth (`argus_suggestions` rows). The dashboard tile reads the count; the per-row pane in 9d reads the verdict. Both should agree. Test: change one incident's `updated_at`, verify the per-row pane re-fetches AND the next dashboard load sees the updated count after its own TTL/freshness change.
7. **Side panel system prompt size growth.** Page-context with `records[]` of 5 incidents could push the system prompt over 1500 tokens. Net cost is fine on Flash, but watch `argus_suggestions.prompt_tokens` aggregates the first week.
8. **`<ArgusContextPayload>` rendering inside a Suspense boundary.** Cache Components default to streaming; a context payload rendered behind a slow database read could mount *after* a user opens the panel. Mitigation: render the payload at the top of the page tree, not inside the slow Suspense boundary.
9. **Index-page tile re-renders on every list filter change.** If `/capa` filters change and the page re-fetches, the tile shouldn't fire a fresh model call. Mitigation: tile payload aggregates are computed once per page render and key the cache; filter-only changes don't bump aggregates → cache hits.
10. **Topbar reorder breaks an unrelated test.** `<NotificationBell>` was right-most pre-9e; Argus shifts it. Mitigation: grep tests for explicit DOM order assertions; none exist as of 2026-05-10.

---

## Open questions to confirm before implementing

1. **Side-panel multi-turn — yes / no, and if yes, what cap?** The master plan implied single-turn; user reading suggests multi-turn would be more useful for follow-ups ("OK now show me the second one"). Recommend: **yes, cap at 6 turns/session, no persistence across panel close**. Captures the value with low risk.
2. **Insight tile vs side-panel suggestion chips on index pages.** A user on `/capa` could use either to ask "summarise my overdue cluster." Recommend: **both — tile auto-loads above the list; suggestion chip in the panel for follow-ups**. Tile is the discovery surface; panel is the deep-dive.
3. **Tile TTL — 24h default or per-tile.** Recommend: **per-tile per the table above**; stop-work gets 1h, the rest 24h.
4. **`thinking: 'auto' | 'off'` for tile calls.** Recommend: **off**. Pro without thinking is fine for one-paragraph summaries; thinking adds 2–5s of latency that's *visible* on first paint.
5. **Lint rule for raw incident text in `<ArgusContextPayload>`.** Recommend: **defer to 9.1**. A code-review checklist line is enough for v1. If we see PII leakage in `argus_suggestions.payload`, escalate.
6. **Tile placement on detail pages.** Master plan only mentions index pages — nothing for `/incidents/[id]`, `/capa/[id]`, etc. Recommend: **stay index-only**. Detail pages get the side-panel context, not their own tile. Wand on Step 2 already covers severity-class signals on incident detail.
7. **"Recent activity" tile on dashboard?** Five tiles instead of four would add a "What changed in the last 24h?" summary. Recommend: **defer to 9.1**. The four flagged tiles cover risk; recent-activity is a different shape (chronology, not classification).
8. **Re-assess link visible always or only when stale?** Recommend: **always**. Cheap, easy to explain, lets a paranoid auditor force a fresh call.
9. **Side-panel `target_kind` on incident-detail page.** When the panel is opened on `/incidents/IR-014`, `argus_suggestions.target_kind = 'incident'` and `target_id = incident.id`? Or `target_kind='page'` and the incident reference goes in `payload`? Recommend: **`'incident'` + `target_id`**. Joins the audit table to existing record-key patterns.
10. **Tile auto-load on initial paint vs after first user interaction.** Recommend: **auto-load**. The cache makes the marginal cost of "they didn't look at it" ~zero, and discovery is the whole job.
11. **Side-panel header chip on routes without context.** Recommend: **show "Argus" only** (no second segment). Avoids a misleading "Unknown page" label.
12. **Does the `tile_reportability_uncertain` count include incidents whose reportability has *never* been assessed?** Recommend: **no — count only those with a most-recent suggestion at confidence < 0.7**. Never-assessed is a different signal; we'd surface it via a different tile in 9.1 if needed.

---

## Out of scope (deferred to 9.1+)

- Conversation persistence across panel sessions.
- Multi-turn refinement on tiles (Re-assess is the only refresh path).
- Detail-page tiles (incident / investigation / CAPA / inspection).
- Recent-activity tile on dashboard.
- Argus-driven creation of incidents, findings, or CAPAs from the panel.
- Cross-org learning / cross-site benchmarks ("your CAPA closure rate is below industry peers").
- Mobile push-notification surfacing of tile signals (works on dashboard view).
- Tile drill-in: clicking a ref_code in a tile takes you straight to that record (currently the link goes to the filtered list).
- Per-user dashboard customisation (which tiles render, in what order).
- Tile localisation (English-only).
- Streaming JSON deltas for tiles (non-streaming JSON is fine for one-paragraph payloads).
- Multi-provider runtime — abstraction is in place from 9d; v1 stays Gemini-only.

---

## Verification

```bash
pnpm install              # no new deps in 9e
pnpm dev                  # GEMINI_API_KEY required
# walk Definition of Done → Side panel → Tiles → Foundation regression → Cost/safety
```

PR title: `feat: phase 9e — argus global panel + insight tiles`. Squash-merge into `main` per `.claude/rules/github-workflow.md`. After merge: update `docs/BUILD_STATUS.md`, `CLAUDE.md` build-status one-liner ("Phase 9 — COMPLETE"), `docs/SPEC.md` §16, write memory `project_phase_9e_argus_panel_and_tiles.md`, update `project_overview.md`, retire any 9-phase-in-progress notes.
