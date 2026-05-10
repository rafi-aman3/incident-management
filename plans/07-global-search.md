# Phase 7 — Global search (demo-grade)

**Status:** drafted 2026-05-11
**Goal:** Hydrate the Phase 6l search shell with a working ⌘K palette that searches across all 9 module entities and lets the user jump to any record. Demo-grade: no full-text-search infrastructure, no telemetry, no recent-visits tracking. ILIKE fan-out + cmdk + localStorage. Ship fast.
**Branch:** `feat/global-search` (off `main`)
**PR target:** `main`
**New deps:** `cmdk` (~20 kB) — gives us keyboard-nav, grouping, filtering for free.
**Schema migration:** none. RLS already gates each table; the search route is just a fan-out of `.ilike()` reads.

> **What this PR ships:**
> - A working `⌘K` / `Ctrl+K` global search palette, replacing the "Coming soon" placeholder body in `components/app-shell/search-trigger.tsx`.
> - Empty state shows **module shortcuts** (7 quick-jump rows linking to module list pages) + a **Recent searches** row backed by localStorage (last 5 queries).
> - Typed state fans out across 9 entities — Incidents, Investigations, CAPAs, Inspections, Templates, Assets, Documents, Sites, Members — and groups results by module.
> - One server route `app/api/search/route.ts` returns `{ groups: Array<{ module, items: SearchHit[] }> }`. Each branch is `.ilike()` on the obvious text columns, `LIMIT 5` per group. RLS handles visibility (no extra permission code).
> - Hit Enter (or click) → router push to the entity detail page; the modal closes.
> - 200 ms debounce, AbortController on every new keystroke. No server-side caching.

> **Not in this PR (deferred):**
> - **No `to_tsvector` / GIN / `pg_trgm`** — ILIKE is fast enough for demo data; FTS upgrade is a one-migration follow-up if we ever want fuzziness or rank.
> - **No "recently viewed" tracking** — only "recent searches" (the queries themselves). Tracking which records the user opened needs a server-side store (or a heavier client-side write on every detail page) and is out of scope.
> - **No permission-aware result filtering above what RLS does.** Worker users will see fewer rows, but we don't visually annotate "you can't see X" — they just don't see it.
> - **No search analytics / telemetry**, no result click-throughs logged.
> - **No Argus integration.** The search palette does not call the model — it's pure SQL. Argus stays in the side-panel + magic wands.
> - **No advanced filters (by site, by date, by status).** Just plain text → grouped hits. Filters deferred to v2.
> - **No empty-result CTA** beyond the "No matches" text. We don't suggest creating an incident from the search bar.

---

## Why this scope

Phase 6l shipped the search trigger + dialog shell with a hardcoded "Coming soon" body. That shell parked the topbar geometry and gave Phase 7 a known mount point. We now wire the actual search.

The user explicitly asked for a **demo-grade** implementation — the goal is "the search bar works and feels like a real SaaS palette," not "production search infrastructure." That eliminates the temptation to build:

- A `search_index` materialized view with triggers on every entity
- A `tsvector` column on each table with GIN indexes
- A ranking function that weights `title` matches above `description`
- Edge Function + pgroonga for fuzzy
- Algolia / Meilisearch / external service

All of those are correct for production but wrong for this milestone. ILIKE on a few columns × `LIMIT 5` × 9 tables in parallel returns in well under 100 ms on a seeded demo org with hundreds of rows. We can revisit when scale demands it.

The two design choices the user locked in:

- **All 9 modules** (Incidents · Investigations · CAPAs · Inspections · Templates · Assets · Documents · Sites · Members) — gives the demo "global" feel.
- **Empty state = module shortcuts + recent searches** — the modal is useful immediately on open, not a blank input waiting for keystrokes.

---

## Audit — what's there now

`components/app-shell/search-trigger.tsx` (66 lines, client):
- Renders `<Dialog>` with two trigger variants (`input` for md+, `icon` for mobile).
- Body is a hardcoded `<DialogDescription>` + dashed-border placeholder card.
- The `⌘K` `<kbd>` badge in the trigger is decorative — the keyboard shortcut is **not wired**.

Mounted in `components/app-shell/topbar.tsx` lines 39–45 (both variants, opposite responsive wrappers).

No `cmdk` dep, no `<Command>` shadcn component, no `app/api/search/` route.

---

## Architecture

### One route, fan-out, parallel

`app/api/search/route.ts` (GET):

```
GET /api/search?q=<query>
→ { groups: [
    { module: 'incidents',      label: 'Incidents',      items: SearchHit[] },
    { module: 'investigations', label: 'Investigations', items: SearchHit[] },
    { module: 'capa',           label: 'CAPAs',          items: SearchHit[] },
    { module: 'inspections',    label: 'Inspections',    items: SearchHit[] },
    { module: 'templates',      label: 'Templates',      items: SearchHit[] },
    { module: 'assets',         label: 'Assets',         items: SearchHit[] },
    { module: 'documents',      label: 'Documents',      items: SearchHit[] },
    { module: 'sites',          label: 'Sites',          items: SearchHit[] },
    { module: 'members',        label: 'Members',        items: SearchHit[] },
  ]}

SearchHit = {
  id: string,
  title: string,        // primary display string
  subtitle?: string,    // ref_code · site name · email · etc.
  href: string,         // /incidents/[id], /capa/[id], …
}
```

Behavior:
- Trim + early-return `{ groups: [] }` when `q.length < 2`.
- Run all 9 SELECTs via `Promise.all` on the SSR Supabase client (cookies-aware). RLS auto-applies.
- Each branch: `.select('id, <title>, <subtitle parts>').ilike('<col>', `%${q}%`).limit(5)`. For multi-column matches (e.g. incidents — title OR ref_code OR description) use Supabase's `.or('title.ilike.%q%,ref_code.ilike.%q%')` syntax. Escape `%` and `_` and commas in `q` before interpolation (one helper, used by all branches).
- Drop empty groups from the response (so the UI only shows modules with matches).
- Total latency target: < 150 ms p50 on the seeded org.

### Per-entity column choices

| Module | Search columns | Title | Subtitle | Route |
|---|---|---|---|---|
| Incidents | `title`, `ref_code`, `description` | `title` | `ref_code · site_name` | `/incidents/{id}` |
| Investigations | (joined) `incident.title`, `incident.ref_code` | incident title | `Investigation · {ref_code}` | `/investigations/{id}` |
| CAPAs | `title`, `description` | `title` | `Owner · {owner_name}` | `/capa/{id}` |
| Inspections | `title`, `ref_code` | `title` | `ref_code · site_name` | `/inspections/{id}` |
| Templates | `name`, `description` | `name` | `{industry_type} · v{latest_version}` | `/templates/{id}` |
| Assets | `name`, `ref_code`, `location_text` | `name` | `ref_code · site_name` | `/resources/assets/{id}` |
| Documents | `name`, `description` | `name` | `{mime_type} · {site_name or 'Org'}` | `/resources/documents/{id}` |
| Sites | `name`, `external_ref` | `name` | `{country_code} · {parent.name or 'Top-level'}` | `/admin/sites/{id}` |
| Members | `profiles.full_name`, `profiles.email` | `full_name` | `email` | `/admin/members/{profile_id}` |

Investigations are searched indirectly via their parent incident (no first-class title field on the row). Members are searched via the `profiles` table joined to org membership. Both branches need a small select-with-join — keep it straightforward, don't over-engineer.

### Client — palette with `cmdk`

Replace the body of `components/app-shell/search-trigger.tsx`:

1. Install `cmdk`, paste the standard shadcn `<Command>` primitive into `components/ui/command.tsx` (one-shot copy from shadcn registry — pure presentation, no surprises).
2. Inside the dialog, render `<Command shouldFilter={false}>` (server filters, not cmdk) with:
   - `<CommandInput value={query} onValueChange={setQuery} placeholder="Search incidents, CAPAs, sites, people…" />`
   - When `query.trim().length < 2`: render `<CommandGroup heading="Modules">` with 7 `<CommandItem>` rows (one per top-level module, lucide icon + name → `router.push` on select), then `<CommandGroup heading="Recent">` if localStorage has any (`onSelect` re-runs the search with that query).
   - When `query.trim().length >= 2` and loading: render a `<CommandLoading>` skeleton (3 rows).
   - When results land: render one `<CommandGroup heading="…">` per non-empty `groups[i]`, each item shows icon · title · subtitle. `onSelect` → `router.push(href)` + close dialog + push query into recent-searches localStorage (front, dedupe, cap 5).
   - When `query.trim().length >= 2` and the response has zero groups: `<CommandEmpty>No matches for "{query}".</CommandEmpty>`
3. Debounce the fetch by 200 ms (`useEffect` + `setTimeout` + cleanup). Wrap each fetch in an `AbortController` so superseded requests don't race.
4. Wire the global `⌘K` / `Ctrl+K` keybinding: a single `useEffect` registering a `keydown` listener on `window`, calling `setOpen(o => !o)` when `e.key === 'k' && (e.metaKey || e.ctrlKey)`. Match the standard SaaS pattern.

The `variant="input" | "icon"` split in the trigger stays — both still render the same dialog, only the trigger differs.

### localStorage shape — recent searches

Key: `argus.search.recent` (we already namespace with `argus.` for some other client state — keeps the bucket consistent).
Value: `JSON.stringify(string[])` capped to 5, MRU first. Clear on sign-out via the existing sign-out hook (one-line addition; if the hook doesn't exist, we just skip — stale recent searches across logins are harmless on this device-trusted demo).

---

## Component changes

### 1. `package.json` (edit)
Add `cmdk: "^1.0.0"` to dependencies. `pnpm install` updates the lockfile.

### 2. `components/ui/command.tsx` (new, ~150 lines)
Standard shadcn `<Command>` primitives wrapping cmdk. Pasted from the shadcn registry verbatim, adjusted only to match our existing import paths (`@/lib/utils`, `@/components/ui/dialog`).

### 3. `components/app-shell/search-trigger.tsx` (rewrite body, ~180 lines total)
- Triggers (input + icon variants) unchanged in markup, except: `aria-keyshortcuts="Meta+K Control+K"` added.
- Dialog body: replace placeholder card with `<Command>` palette (see Architecture).
- Add `useGlobalShortcut` effect for `⌘K`/`Ctrl+K`.
- Add `useDebouncedSearch(query, 200)` hook (inline, ~25 lines): debounces, manages AbortController, returns `{ groups, loading }`.
- Recent searches: `useRecentSearches()` (inline, ~20 lines) reading/writing `localStorage`.

### 4. `app/api/search/route.ts` (new, ~150 lines)
- `export async function GET(request: Request)`. No `runtime` export (Cache Components forbids it on route handlers — see CLAUDE.md hard rules).
- `'use cache'` is **not** appropriate here — every search is per-user and per-query. Skip caching directives.
- Parse `q` from URL. Trim. Reject `length < 2` with `{ groups: [] }`. Reject `length > 100` with 400 (basic abuse guard).
- Get the SSR Supabase client (`createClient()` from `lib/supabase/server.ts`).
- Get current user; redirect to login if absent (`return NextResponse.json({ error: 'unauthorized' }, { status: 401 })` — the modal won't be reachable by anonymous users anyway, but defence-in-depth).
- 9 SELECTs in `Promise.all`. Each returns the shape needed for `SearchHit`.
- Map each result set to `{ module, label, items }`, drop empty groups, return JSON.

### 5. `lib/search/escape.ts` (new, ~10 lines)
One helper: `escapeIlike(q: string): string` — escapes `%`, `_`, `,`, and `\` so user-supplied text can't break the `.or('a.ilike.%q%')` filter syntax. Tested with three inputs in a sibling co-located vitest? — no, we don't have vitest set up. Document the contract in JSDoc and hand-test in the smoke walkthrough.

### 6. `components/app-shell/search-trigger.tsx` accessibility tweaks
- Dialog gets `aria-label="Global search"`.
- `<CommandItem>` rows get the route they navigate to surfaced in the visible text (already covered by subtitle).
- Esc closes the dialog (cmdk does this for free via Radix Dialog).

---

## Acceptance criteria

- [ ] Pressing `⌘K` (mac) or `Ctrl+K` (win/linux) anywhere in the `(app)` shell opens the palette.
- [ ] Clicking the topbar search trigger (input variant on md+, icon on < md) opens the same palette.
- [ ] Empty palette shows 7 module shortcut rows. Clicking one (or pressing Enter on it) navigates to the module list page and closes the palette.
- [ ] If the user has previous searches in localStorage, a "Recent" group appears below "Modules" (max 5, MRU first). Clicking a recent re-runs the search.
- [ ] Typing 2+ chars triggers a debounced (~200 ms) `/api/search` fetch.
- [ ] Results group by module heading. Each row shows icon · title · subtitle. Pressing Enter (or click) navigates to the entity detail page and closes the palette.
- [ ] After navigating from a search result, the typed query lands in the front of `argus.search.recent` localStorage.
- [ ] Zero matches → `<CommandEmpty>No matches for "…".</CommandEmpty>`.
- [ ] An RLS-restricted user (e.g. a worker) does **not** see incidents from sites they're not a member of. (Verified by signing in as the seeded worker and searching for a known site-Manchester incident from a Houston-only worker account.)
- [ ] No regressions on the topbar geometry, no z-index collision with the side panel or notification bell.
- [ ] No console errors on rapid typing (AbortController kills superseded fetches cleanly).
- [ ] Total search latency p50 < 250 ms in `pnpm dev`, p99 < 600 ms.

---

## Smoke test (will write `docs/smoke-test-phase7.md` during execution)

1. Sign in as `site_admin` of seeded UCB org. Press ⌘K → palette opens with 7 module rows, no "Recent".
2. Type `IR-` → after 200 ms, "Incidents" group appears with the 5 most recent ref-code matches. Arrow-down twice, Enter → navigates to that incident detail. Re-open palette → "Recent: IR-" appears.
3. Type `osha` → expect groups in Incidents (titles mentioning OSHA), Templates (the OSHA preset), and possibly Documents. Click a Documents row → opens detail.
4. Type `manchester` → Sites group surfaces the Manchester top-level site; Members group surfaces members assigned to Manchester only if their full_name/email matches.
5. Type `aaaaaaaa` (no matches) → `<CommandEmpty>` renders.
6. Type 1 char → no fetch, palette stays in "Modules + Recent" state. Clear → state restores.
7. Type `incident'); DROP TABLE--` → escape helper makes this a literal substring search; nothing executes; either renders zero results or whatever rows happen to contain the substring. **No 500.**
8. Type `100%` (literal `%` in query) → escape helper escapes the wildcard; results are limited to rows containing the substring `100%`, not all rows.
9. Sign out, sign in as a worker scoped to UCB Houston only. ⌘K → search for Manchester-only resources → expect zero results in the affected groups (RLS enforced).
10. Resize to phone width (< md) → topbar shows search icon; tap icon → same palette opens. Tap a module row → navigates, palette closes.
11. Press Esc → palette closes from any state.
12. Open palette, type a query, click outside → palette closes; query is discarded.
13. Verify the cyan-dot Argus indicator on the topbar still works and doesn't collide with the search icon at narrow widths.

---

## Out of scope (revisit in v2 / Phase 7.5)

- **Full-text search** with `tsvector` + GIN, `pg_trgm` for fuzzy matching, ts_rank for ordering across modules.
- **Recently viewed** entities tracked server-side (own table) — surfaces the records the user actually clicked into, not just queries they typed.
- **Site / status / date filters** in the palette ("Search incidents at Houston in the last 30 days").
- **Inline previews** — hovering a result shows a peek panel with the first paragraph.
- **Argus search** — natural-language queries like "show me overdue CAPAs at Manchester" that the model translates into structured filters. Belongs in Phase 9-something, not 7.
- **Search analytics** — log query + selected hit position in `activity_events` for product-quality measurement.
- **Permission gating per result** — currently RLS just hides un-readable rows; we could add a "🔒 X results hidden by permissions" hint. Low value, skip.

---

## Risks

- **`.or('a.ilike.%q%,b.ilike.%q%')` injection** if `q` isn't escaped. Mitigated by the `escapeIlike` helper. Verify with the apostrophe + `%` smoke tests above.
- **N+1 joins on Investigations and Members** — they need parent-record data (`incidents` for investigations, `profiles.full_name + email` for members). Use a single embedded select (`select('*, incident:incidents(title, ref_code)')`) — Supabase resolves these in one round-trip. Acceptance: each of the 9 fan-out branches is exactly one DB call.
- **Latency cliff at 9 parallel queries on a cold connection** — all 9 hit Supabase via the SSR client which uses one PG connection pool. If we see > 500 ms p50, drop to a sequential 3-batch fan-out or trim to the 5 most-used modules. Don't optimize prematurely.
- **localStorage write on every keystroke** would balloon the recent list. We only write on **successful navigation from a result**, not on every input change.
- **cmdk's default fuzzy filter conflicts with our server-side filter.** Pass `shouldFilter={false}` on `<Command>` so cmdk renders our items as-is. Standard pattern; documented in cmdk README.
- **Z-index collision with the Argus side panel** (Phase 9e): the panel is `z-40`, dialog is `z-50` — palette wins. Confirm visually in smoke step 13.
- **Cmd+K already bound** in any embedded editor (none today, but if Argus copilot textarea grows shortcuts in a future phase). The keybinding only fires when `e.target` is not an input/textarea/contentEditable. Add the standard guard.
