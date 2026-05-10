# Phase 7 smoke test — Global search palette

Run after pulling `feat/global-search`. Assumes seeded UCB org + `pnpm dev` running on `http://localhost:3000`.

## 1. Trigger + keyboard shortcut

- [ ] Sign in as a `site_admin`. Land on the dashboard.
- [ ] Click the centred topbar search button (md+) → palette opens.
- [ ] Press `Esc` → palette closes.
- [ ] Press `⌘K` (mac) or `Ctrl+K` (win/linux) anywhere in the `(app)` shell → palette opens. Press again → closes.
- [ ] Click outside the dialog → palette closes.

## 2. Empty state — module shortcuts + recent

- [ ] Open palette. Confirm "Jump to" group lists 8 rows: Dashboard, Incidents, Investigations, CAPAs, Inspections, Templates, Resources, Sites.
- [ ] Arrow-down through the rows; Enter on **Incidents** → routes to `/incidents` and palette closes.
- [ ] Re-open palette. Confirm no "Recent searches" group yet (no queries performed).

## 3. Typed results

- [ ] Open palette. Type `IR-` → after ~200ms, an "Incidents" group appears with up to 5 ref-code matches. Each row shows the incident title (top) + `IR-### · {site name}` subtitle.
- [ ] Arrow-down, Enter on a result → navigates to `/incidents/{id}` and palette closes.
- [ ] Re-open palette. "Recent searches" group now shows `IR-` as the top entry.
- [ ] Click `IR-` in Recent → query restores, results render.

## 4. Cross-module results

- [ ] Type `osha` → expect groups in any of: Incidents (titles), Templates (the OSHA preset), Documents. Each group capped at 5 rows.
- [ ] Type `manchester` → Sites group surfaces the Manchester top-level site; People group surfaces members named "Manchester" if any.
- [ ] Type `ucb` → expect People + Templates + possibly Documents.

## 5. Empty result + edge cases

- [ ] Type `zzzzzzzz` (no matches) → renders "No matches for "zzzzzzzz"".
- [ ] Type 1 char `z` → no fetch fires, palette stays in "Jump to + Recent" state.
- [ ] Delete query → state restores to "Jump to + Recent".

## 6. Escape + SQL-safety

- [ ] Type `100%` (literal `%`) → search runs with `%` escaped; results limited to rows containing the substring `100%`. No JS error in DevTools.
- [ ] Type `o, p` (literal comma) → no syntax error; results match the substring.
- [ ] Type `incident'); DROP TABLE--` → renders as a literal substring search; no 500 in the Network tab.

## 7. Permission-aware results (RLS)

- [ ] Sign out, sign in as a `worker` scoped to UCB Houston only (no Manchester access).
- [ ] Open palette. Type `manchester` → Sites/People groups should be empty (RLS hides Manchester rows from this user). The non-matching modules still render their hits if any.

## 8. Responsive + mobile

- [ ] Resize browser to `< md` (~600px) → topbar shows the search icon button instead of the centred bar.
- [ ] Tap the icon → same palette opens.
- [ ] Tap a "Jump to" row → navigates and palette closes.

## 9. Rapid typing + AbortController

- [ ] Open palette. Type rapidly: `i n c i d e n t` → no console errors. The Network tab should show in-flight `/api/search` requests being aborted/superseded; only the final result renders.

## 10. Cross-feature regression

- [ ] Confirm the Argus side-panel Sparkles button still sits to the right of the notification bell and opens its drawer (z-index above the search dialog should be fine — palette and panel never co-render).
- [ ] Confirm `⌘K` does NOT fire when typing in the Argus copilot input or any other textarea on the page (it only opens the palette from a textarea if the cursor is already inside `[data-slot="command"]`).

---

Known limitations (by design):

- ILIKE substring match only — no fuzzy / typo tolerance. Searching `incidnt` will not surface incidents.
- No ranking across modules — group order is fixed (Incidents → Investigations → CAPAs → Inspections → Templates → Assets → Documents → Sites → People).
- No "recently viewed" — only "recent searches" (the query strings, not the records you opened).
- No filter chips (site / status / date).
- Recent searches stored in localStorage; clearing browser storage wipes them.
