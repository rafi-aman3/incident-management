# Phase 6f — Templates polish

**Status:** re-audited 2026-05-08 (replaces the 2026-05-06 TBD stub) — same precedent set by 6c/6d/6e on kickoff.
**Goal:** Templates is the largest surface in V1 (7 routes, 1 client-heavy 3-column builder). Bring it up to the bar set by 6b–6e: every route gets `loading.tsx` + `error.tsx`; every interactive surface gets correct ARIA semantics; the builder's autosave + publish loop is hardened against silent data loss; the destructive button on the tree gets a real confirm; the "Unsupported in v1" yellow placeholder renders consistently.
**Branch:** `feat/phase-6-templates-polish`
**PR target:** `main`
**Pages covered:** `/templates`, `/templates/browse`, `/templates/browse/[id]`, `/templates/new`, `/templates/[id]`, `/templates/[id]/edit`, `/templates/[id]/assign`

> **What this PR ships:**
> - `loading.tsx` + `error.tsx` at every route (none exist today — verified 2026-05-08).
> - Builder a11y: tab semantics on Body/Title-page switcher, `aria-current` on selected tree node, `aria-expanded` on collapse chevrons, real `aria-label` on the GripVertical icon, `aria-current="page"` on the active version row in the viewer.
> - Builder destructive guard: tree Delete button is currently fire-and-forget (line 487 in `template-editor.tsx`) — wrap with `AlertDialog` (the primitive shipped in 6c) for any item with children, plain confirm copy for leaves.
> - Autosave hardening: add `AbortController` so a publish click cancels any in-flight draft save, and so rapid edits don't queue overlapping requests.
> - ChangeSummaryDialog auto-suggestion: pre-fill the textarea with a computed diff summary ("Added 3 items, removed 1, renamed 2 sections") that the user can edit before publishing — the user types over it instead of from a blank.
> - Tab-strip migration: builder Body/Header switcher and `/templates/[id]` version panel both adopt the `role="tablist" + role="tab" + aria-current` shape used by 6c/6d.
> - Empty-state pass: `/templates`, `/templates/[id]` (org-fresh + brand-new draft), assign form's "no sites available" branch.
> - `/templates/[id]/assign` polish: `<table>`-shaped active assignments list (currently div soup, line 297-ish in `assign-form.tsx`), and a confirm on the Remove button (currently fire-and-forget like the tree delete).
> - Reuse the 6e PdfErrorBanner pattern? No PDFs in templates. Skip.

> **Not in this PR (deferred to v2 with §15 entry as needed):**
> - **No new MVP item types.** 8 are locked: section / category / information / question / text / datetime / signature / media. The 7 deferred types stay deferred (yellow placeholder).
> - **No pointer/touch drag-reorder via @dnd-kit.** Verified: editor has no `@dnd-kit` import; reorder is via per-row ↑/↓ buttons (lines 469–484). Adding pointer DnD plus keyboard Alt+up/down is a half-day of work and a behavior change, not a polish. Either we accept ↑/↓ as the v1 affordance (recommend) or split it into a separate sub-PR.
> - **No live multi-editor conflict warning.** RLS prevents data loss; the silent 403 is acceptable for v1 (single-editor org workflow).
> - **No template-import-from-CSV.** Preset → org clone only.
> - **No live answer-set-color preview in canvas.** Canvas already shows item shape + label; SafetyCulture-style colored response chips can wait.
> - **No recurring-inspection auto-create cron.** Schedule fields are stored but unused (verified — line ~297 in `assign-form.tsx` and `seed.ts` simulates manually). Already a known v1→v2 gap; no action here, but assign page should not advertise "next 5 runs" copy that isn't real (the existing 06f stub suggested it; we're dropping that suggestion).

---

## Audit (verified 2026-05-08 against shipped surfaces)

### 1. `/templates` (org-imported list, industry-grouped)
**File:** `app/(app)/templates/page.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 1. Visual fidelity | Card grid with industry section headers; brand purple "Browse system presets" CTA. ✅ | — |
| 2. Empty state | Org-fresh empty state exists with browse + create CTAs. ✅ | — |
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton matching the post-load layout (industry section header + 2-col card row). |
| 4. Error state | ❌ Errors render as plain `<p className="text-destructive">`. | Add `error.tsx` with brand error card + Try-again (resets boundary) + Browse-system-presets fallback link. |
| 5. Responsive | sm: cards collapse to single column. ✅ | — |
| 6. A11y / keyboard | ❌ Filter chips render as plain `<Link>` — no `role="tablist"` / `aria-current`. ❌ Sort by-updated-at has no reverse-direction toggle (one-way only). | Migrate filter strip to the 6c/6d `role="tablist"` shape. Add asc/desc affordance (icon-toggle) on the sort link. |
| 7. Form-error UX | n/a (read-only list). | — |
| 8. Copy | "Module 4" eyebrow not present (matches 6b–6d sequencing). ✅ Card body has version pill + last-published date. ✅ | — |
| 9. Dark mode | Tokens consistent; no raw hex. ✅ | — |
| 10. Cache Components | `searchParams` awaited (line 20). ✅ Per-org reads cache at the right boundary. | — |

### 2. `/templates/browse` (system-preset library)
**File:** `app/(app)/templates/browse/page.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (4 featured chips placeholder + 6-card grid skeleton). |
| 4. Error state | ❌ Errors render as plain text (line ~112). ❌ No `error.tsx`. | Add `error.tsx`. |
| 6. A11y | Featured chips render as plain `<Link>` row. Card grid uses `<div>` not `<article>`. | Featured row → `role="tablist"` + `aria-current` if active filter. Cards stay div for now; add `aria-label` to cover-icon-only buttons inside the card if any. |
| 8. Copy | Card sublabel: industry + question count. ✅ "Imported by N orgs" not tracked — drop from the original stub's wishlist. | — |

### 3. `/templates/browse/[id]` (preset detail)
**File:** `app/(app)/templates/browse/[id]/page.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton. |
| 4. Error / not-found | ✅ `notFound()` wired (line ~42). ❌ No `error.tsx`. ❌ No `not-found.tsx` brand variant — falls back to default Next.js page. | Add both. `not-found.tsx` mirrors the 6e Reports `not-found` pattern (brand card + back-to-Browse link). |
| 8. Copy | Import CTA. ✅ Already-imported state surfaces correctly. ✅ | — |

### 4. `/templates/new` (blank create form)
**File:** `app/(app)/templates/new/page.tsx` + `components/templates/new-template-form.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (centered card form shell). |
| 4. Error state | ❌ No `error.tsx`. | Add. |
| 6. A11y | Required fields marked with red asterisk. ✅ `useActionState` wired. ✅ | — |
| 7. Form-error UX | Pending state renders "Creating…". ✅ Error toasted. ✅ | — |

### 5. `/templates/[id]` (read-only viewer + versions panel)
**File:** `app/(app)/templates/[id]/page.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 2. Empty state | ❌ Brand-new template (zero items) renders the ChecklistPreview as a near-blank page; no "Add your first item in the editor" pointer. | Detect zero items + zero header items; render an EmptyState card with an "Open editor" CTA. |
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton. |
| 4. Error state | ✅ `notFound()` on missing template. ❌ No `error.tsx`. ❌ No `not-found.tsx` brand variant. | Add both. |
| 6. A11y | Version sidebar items render with `bg-primary/5` highlight on the active row but no `aria-current="page"`. History icon has no `aria-label`. ❌ No `<nav>` wrapper. | Wrap version list in `<nav aria-label="Version history">`; add `aria-current="page"` to the active row link; `aria-label` on the History header icon. |
| 8. Copy | "Running inspections still on v1.1" callout absent — surface only when at least one inspection's `template_version_id` doesn't match the displayed version. | Add the snapshot-rule callout (a single-line info card with count + "View running inspections" deep-link to `/inspections?status=in_progress&template=<id>`). |

### 6. `/templates/[id]/edit` (3-column builder — biggest screen in V1)
**Files:** `app/(app)/templates/[id]/edit/page.tsx`, `components/templates/editor/template-editor.tsx` (913 lines), `components/templates/editor/change-summary-dialog.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 2. Empty state | ✅ Tree empty-state copy: "No items yet. Add a section to get started." (lines 292–296). | — |
| 3. Loading | ❌ No `loading.tsx`. ❌ Editor mounts blank during the initial server fetch. | Add `loading.tsx` skeleton at route level (3-column shell + autosave indicator placeholder). |
| 4. Error state | ❌ No `error.tsx`; the page bootstrap returns inline `<div>` error blocks (lines 68–73, 85–89, 98–104). Autosave failure surfaces via toast only — if the user dismisses it they lose the signal. | Add `error.tsx`. SaveIndicator already renders "Save failed" (lines 383–397); add a sticky **Retry** button next to it (mirrors the 6c 5-Why retry pattern). |
| 6. A11y | ❌ Body / Title-page tab switcher (lines 267–285) is plain `<button>` — no `role="tab"`, `aria-selected`, `aria-controls`. ❌ Collapse chevrons (lines 439–449) lack `aria-expanded`. ❌ GripVertical icon (line 454) is decorative — give it `aria-hidden="true"` (it's purely visual; reorder is via the ↑/↓ buttons which already have `aria-label`). ❌ Tree-node selection has no `aria-current`. ❌ Top-bar name input has no visible label or `aria-label` (relies on visual context). | Migrate Body/Title-page strip to the 6c `role="tablist" + role="tab"`. Add `aria-expanded` to chevrons. `aria-hidden="true"` on GripVertical. `aria-current="true"` on the selected tree button. Add `aria-label="Template name"` to the inline title input. |
| 7. Form-error UX | ✅ `saveDraftVersion` returns `{ ok, error, data: { saved_at } }`. ✅ Publish gated on `canPublish && items.length > 0`. ❌ ChangeSummaryDialog (full file 117 lines) is a free-text textarea with placeholder example only — user types from blank into 10-char min. | Compute a draft-vs-published diff: `addedCount`, `removedCount`, `renamedSectionCount`, `typeChangedCount` from comparing `templateData.items` between draft + last published version snapshot. Pre-fill the textarea with a one-line summary like "Added 3 items, renamed 2 sections" the user can edit. Keep the 10-char minimum + 2000-char max. |
| Autosave race | Lines 143–167. `useEffect` schedules a 1000ms `setTimeout`; cleanup `window.clearTimeout(t)` cancels the pending timer on rapid edits. ❌ But once the timer fires, the in-flight `await saveDraftVersion(...)` is fire-and-forget — a publish click during the in-flight save can race (the publish RPC and the save action both touch the same `template_versions` row). | Hoist an `AbortController` ref. Cancel any in-flight save on cleanup AND on publish click. `saveDraftVersion` action already returns `{ok,error}`; an aborted call resolves as a no-op (handler ignores result if `signal.aborted`). |
| Destructive guard | Tree Delete button (line 487, calls `onRemove(item_id)` → `handleRemove` line 193) deletes immediately with no confirm. Removing a section silently deletes all child items. | Wrap with `AlertDialog` (primitive shipped in 6c at `components/ui/alert-dialog.tsx`): plain "Delete this item?" for leaves; "Delete this section and all <N> items inside?" for sections with children. Cancel default; brand purple confirm. |
| 9. Dark mode | ✅ 3-column tokens consistent. | — |
| 10. Cache Components | ✅ `params` awaited. Editor is fully dynamic — no `'use cache'`. ✅ | — |

**Builder items deliberately deferred:**
- **Pointer drag-reorder via @dnd-kit + keyboard Alt+up/down** — recommend leaving the ↑/↓ buttons as the v1 affordance (consistent with how the project already used @dnd-kit only on the investigation Kanban board, not in form-builder contexts). Open question for the user before kickoff.
- **CanvasPreview live answer-set colors** — the canvas shows label + type + required indicator, which is enough for "what will this question look like." Adding live response-color rendering crosses into runner-parity territory; out of scope for polish.
- **Multi-editor conflict warning** — single-editor v1; silent 403 from RLS is acceptable.

### 7. `/templates/[id]/assign`
**Files:** `app/(app)/templates/[id]/assign/page.tsx`, `components/templates/assign-form.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton. |
| 4. Error state | ❌ No `error.tsx`. ✅ "Publish first" warning shown if template not yet published (line 122). | Add `error.tsx`. |
| 6. A11y | ✅ Site checkboxes use `<label>` wrapping `<input>` (line 197) — valid pattern. ❌ Active assignments list is div soup (line ~297), not a `<table>` or structured list — bad SR experience. ❌ "Assign to every site I manage" checkbox has good label structure (line 168). | Convert active-assignments div block to a real `<table>` with `<thead>` (Site / Schedule / include_children / Actions) + per-row Remove with `aria-label="Remove assignment from <site name>"`. |
| 7. Form-error UX | ✅ `useTransition` blocks button. ✅ Per-site permission loop in action. ❌ Action returns flat error string; no `fieldErrors` shape. | Action returns `{ok,error,fieldErrors?}` with field-level messages for cron expression + start_time_local sanity. Render under the field, not just toast. |
| 8. Copy | ❌ Original 06f stub asked for "preview next 5 runs" — but recurring auto-create is deferred to v2 (verified — schedule is stored but never used by any cron). Drop the "next runs" preview from the polish; it would mislead. Keep schedule storage as-is. | Surface a small italic note: "Schedules are stored for future automation; v1 inspections are started manually from the Inspections page." (One sentence, no preview block.) |
| Destructive guard | Per-row Remove button on active assignments (`handleUnassign` line 137) is fire-and-forget. | Wrap with `AlertDialog`: "Remove this assignment? Site <name> will no longer have <template> available to start." Cancel default; destructive variant confirm. |

---

## Cross-cutting work

- **6 new `loading.tsx` files** (one per route except `/templates/[id]/edit` where the route-level one is enough — the editor itself is client and renders its own state).
- **6 new `error.tsx` files** (template across all 7 routes; `/templates/browse/[id]` also gets `not-found.tsx`; `/templates/[id]` also gets `not-found.tsx`).
- **Reuse `<AlertDialog>` from `components/ui/alert-dialog.tsx`** (primitive shipped in 6c) at the 2 destructive sites: tree-item delete + assignment remove.
- **Reuse `role="tablist" + role="tab" + aria-current` shape** from `components/investigations/detail/detail-tabs.tsx` (6c) at: filter strip in `/templates`, featured-chips in `/templates/browse`, Body/Title-page switcher in builder, version sidebar in `/templates/[id]`.
- **No new perm keys.** Audit confirmed the existing 13 template/inspection perms cover every gate.
- **No schema migration.** Verified no schema gap surfaces under polish scope.

## Diff-summary helper (for ChangeSummaryDialog auto-suggestion)

New file: `lib/templates/diff-summary.ts` (pure, ~30 lines). Inputs: draft `items[]` + `header[]` + `templateData` and the last-published version's same fields. Output: a one-sentence string built from non-zero counters:

- `addedCount` — items in draft not in published (matched by `item_id`)
- `removedCount` — items in published not in draft
- `renamedCount` — same `item_id`, different `label`
- `typeChangedCount` — same `item_id`, different `type` (rare; flagged separately because it's potentially data-corrupting)
- `optionsChangedCount` — same `item_id`, different `options`/`answer_set_id`/etc.

If all counters are zero (e.g., user opened the dialog without changes) → empty string and the textarea stays blank with the placeholder. Edge case: if the template has never been published (first publish), the suggestion is the literal "Initial version of <template name>" — no diff to compute against.

---

## Definition of done — Templates PR

1. 10-item checklist passes for all 7 pages, with `n/a`s explained inline.
2. Every route has `loading.tsx` + `error.tsx` (and `not-found.tsx` where applicable).
3. Builder tab semantics + `aria-current` migrated; all 5 a11y gaps in route 6 above closed.
4. Tree Delete + Assignment Remove both gated behind `<AlertDialog>` confirms.
5. Autosave + publish guarded by an `AbortController` — verified by manual test (rapid edits during a publish click never produce a server-side overwrite).
6. ChangeSummaryDialog pre-fills with computed diff summary the user can edit.
7. `/templates/[id]/assign` active-assignment list is a real `<table>` with screen-reader-friendly row labels.
8. `pnpm tsc --noEmit` clean.
9. Smoke-test guide: extend `docs/smoke-test-phase3.md` with 6 new checkpoints (loading skeleton at /edit, error.tsx retry on /templates, ChangeSummaryDialog auto-suggestion populated, AlertDialog confirm on tree delete, AlertDialog confirm on assignment remove, version row `aria-current`).
10. PR description includes:
    - Before/after screenshots for builder tab a11y + ChangeSummaryDialog auto-suggestion + tree delete confirm.
    - 1-min screen recording: open /edit → make 3 edits → click Publish → observe diff suggestion → publish.
    - Keyboard-only walkthrough of builder (Tab through topbar → switch Body/Title-page with arrow keys → focus tree → ↑/↓ buttons reorder).

---

## Open questions for the user (resolve before coding)

1. **Drag-reorder via @dnd-kit + keyboard Alt+up/down**: ship in this PR or defer? Recommend **defer** — adds @dnd-kit-everywhere risk (Kanban-only today) and the ↑/↓ buttons already work and are accessible. If we want it, it's a separate sub-PR `feat/phase-6-templates-dnd` after this lands.
2. **ChangeSummaryDialog diff auto-suggestion**: pre-filled-and-editable (recommend) vs. read-only-with-toggle vs. side-by-side detailed diff list? The richer the diff the more it duplicates Git semantics — pre-fill keeps it human.
3. **Snapshot-rule callout on `/templates/[id]`**: count-only ("3 inspections still on v1.1") vs. linkified count ("3 inspections still on v1.1 →") vs. full table of inspection IDs? Recommend linkified count → `/inspections?template_version=<id>`.
4. **Assignment "next 5 runs" preview**: drop entirely (recommend) vs. show as a v2-stub disabled box vs. compute-from-cron-without-actually-running? Computing without running misleads the user; recommend just dropping.
5. **`/templates/new` flow on success**: hard redirect to editor (current) vs. soft toast + stay on /templates with the new card highlighted? Current is fine; flagging in case the user has a preference.
6. **`/templates/browse/[id]` "already imported" CTA**: current shows "Imported — view yours" → navigates to the org template. Should we additionally surface a diff if the org's imported copy has drifted from the latest preset version (e.g., presets get bumped)? Recommend **defer** — presets are static in v1.

---

**Plan author note:** the original 06f stub from 2026-05-06 has been wholly replaced by this re-audit. The Definition-of-Done above replaces the 9-item DoD in the prior version. No coding starts until the user signals direction on the 6 open questions above (most importantly Q1 — the drag-reorder scope decision).
