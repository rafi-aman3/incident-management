# Phase 6h — Resources polish (Assets + Documents)

**Status:** re-audited 2026-05-08 (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e/6f/6g on kickoff.
**Goal:** Resources is the cross-cutting plumbing — every other module mounts `<DocumentLinkPicker>`, `<AssetTypeaheadField>`, or reads from `documents` / `document_links`. Polish here ripples everywhere. The shipped surfaces are functional but missing route-level state files (zero `loading.tsx` / `error.tsx` / `not-found.tsx` under the entire `/resources` subtree); the cross-cutting picker has an upload→link orphan path; `<AssetTypeaheadField>` loses wizard state when the user clicks "+ Register a new asset" mid-Step-2.
**Branch:** `feat/phase-6-resources-polish`
**PR target:** `main`
**Pages covered:** `/resources/assets`, `/resources/assets/new`, `/resources/assets/[id]`, `/resources/assets/[id]/edit`, `/resources/documents`, `/resources/documents/new`, `/resources/documents/[id]`

> **What this PR ships:**
> - **State coverage:** `loading.tsx` + `error.tsx` at the 4 list/detail routes (`/resources/assets`, `/resources/assets/[id]`, `/resources/documents`, `/resources/documents/[id]`); `not-found.tsx` at the 2 `[id]` detail routes; lightweight `loading.tsx` at the 3 form/edit routes (`new`, `[id]/edit`).
> - **"Module 4 · Resources" eyebrow drop** on `/resources/assets` (line 168) and `/resources/documents` (line 265) — matches 6b–6g sequencing.
> - **Asset detail tab nav** (`/resources/assets/[id]` lines 171–179) migrated to `<nav role="tablist">` + per-tab `role="tab"` + `aria-selected` + `aria-controls` pointing at the panel id; tab contents wrapped in `role="tabpanel"` + `aria-labelledby`. Mirrors 6f templates editor tab pattern.
> - **List-table a11y:** `aria-label` on `<Table>` (assets list line 43, documents list line 220-ish) + `<TableHead scope="col">` on every column header. Matches 6f's `<th scope="row">` precedent on the assignments table.
> - **AssetActions dropdown** (`asset-actions.tsx:78`) gets `aria-label="Change asset condition"` on the trigger button (icon-only ChevronDown is purely decorative now).
> - **AssetTypeaheadField hardening** (`components/assets/asset-typeahead-field.tsx`):
>   - Real combobox ARIA: `role="combobox"` on the input + `aria-expanded` + `aria-controls` + `aria-haspopup="listbox"` + `aria-activedescendant`; results list `role="listbox"` + per-row `role="option"` + `aria-selected`.
>   - ESC closes the dropdown without dismissing the parent wizard.
>   - **"+ Register a new asset" no longer navigates away** — opens a `<Dialog>` containing a slimmed `<AssetForm>` so the wizard's Step 2 state is preserved (per Q1 — recommend modal-in-place). On create-success the new asset is auto-selected via the existing typeahead's `onSelect` path.
> - **AssetForm inline field errors** (`asset-form.tsx`): server `fieldErrors` (already returned from the action via `ActionResult` shape) wired up — `aria-invalid` + `aria-describedby` per field + per-field error text below the input. Mirrors 6f's `assignTemplate` shape.
> - **DocumentLinkPicker hardening** (`components/documents/document-link-picker.tsx`):
>   - Upload tab: form state resets on success (`file` / `name` / `type` / `expiry` / `notes` cleared) so a second submit doesn't silently re-upload the same file.
>   - **Upload-then-link orphan recovery** (per Q2): if `createDocument` succeeds but `linkDocument` fails, the picker surfaces a warning toast naming the orphaned doc + a "View in /resources/documents" CTA so the user can clean it up (recommend over a hard rollback — the doc may legitimately be useful even if this particular link failed).
>   - Library tab: archived docs (those with `archived_at IS NOT NULL`) render disabled with a strikethrough + "Archived — restore in /resources/documents/[id]" tooltip, instead of allowing the link to be created against an archived doc.
>   - `aria-label="Open document picker"` on the trigger button (line 107).
> - **DocumentDetailActions edit-metadata** (`document-detail-actions.tsx:186-283`): form state resets on dialog close (Cancel or backdrop) so a re-open shows the live `initial` snapshot, not the previously-edited (then-cancelled) values.
> - **`/resources/documents/[id]` per-parent-type label fetch** (page.tsx lines 115–209): the 7 sequential queries (incidents / investigations / capas / assets / sites / inspections / findings) parallelize via `Promise.all`. No new RPC, no schema change — just `await` shape fix. Cuts cold-load time on a heavily-linked document by ~6× the per-query latency.
> - **Asset detail per-tab error** (lines 295, 356, 434): bare `<p className="text-destructive">` on Supabase error replaced with a small inline `<Alert variant="destructive">` matching the 6f/6g brand-card pattern.
> - **Empty-state copy refinements:**
>   - `assets/page.tsx`: distinguish cold-empty ("No assets yet — register your first asset to get started") vs. filtered-zero ("No assets match these filters. Adjust the filters to see more.") via `rows.length === 0 && noFilters` branching in `<AssetList>`.
>   - `documents/[id]/page.tsx` linked-from sidebar (lines 329–331): replace technical "Pickers across the app reference this document by id." with "This document hasn't been linked to any records yet. Use the picker on an incident, asset, CAPA, or inspection to link it."

> **Not in this PR (deferred to v2 with §15 entry as needed):**
> - **No document versioning.** Per `IMS_PLANNING.md` §16 (Document Control deep) — already a v2 commitment.
> - **No approvals / e-signatures / forced ack.** Same v2 commitment.
> - **No SDS Manager API integration.** v2.
> - **No asset PM cron auto-trigger.** v2 — the `next_pm_at` column is rendered with overdue highlighting today, but no scheduled job creates inspections from it.
> - **No asset hierarchy / parent-child.** v2.
> - **No bulk actions** on either list (bulk-archive on documents, bulk-condition-update on assets). Out of scope; current single-row affordances cover the demo path.
> - **No `'use cache'` migration** on tab-fetch queries. Caching cross-tab Supabase calls keyed by asset_id is a net-positive but interacts with revalidation paths the polish PR shouldn't touch in 6h.
> - **No Asset Inspections-tab population** (currently shows site-wide inspections rather than asset-linked ones — there's no `inspections.asset_id` FK in V1). The empty-state copy stays factual: "No inspections recorded at this site yet."
> - **No multi-file upload** in `document-upload-form.tsx` or DocumentLinkPicker upload tab. One file at a time stays the v1 contract.

---

## Audit (verified 2026-05-08 against shipped surfaces)

### 1. `/resources/assets` (site-grouped table)
**File:** `app/(app)/resources/assets/page.tsx` (181 lines) + `components/assets/asset-list.tsx` (138) + `asset-list-filters.tsx` (120)

| Dimension | Finding | Fix |
|---|---|---|
| 1. Visual fidelity | "Module 4 · Resources" eyebrow at line 167–168 — drops to match 6b–6g. | Drop. |
| 2. Empty state | `<AssetList>` shows "No assets match these filters." regardless of whether filters are active. ❌ Cold-empty case reads as if the user mis-filtered. | Branch on filter state — cold-empty CTA vs. filtered-zero hint. |
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (header + filter strip + 8-row table placeholder). |
| 4. Error state | ❌ No `error.tsx`. Page-level query error at line 141 only handles in-page failure. | Add `error.tsx` brand card with Try-again. |
| 5. Responsive | sm: stacks via `<AssetList>`. ✅ | — |
| 6. A11y / keyboard | ❌ `<Table>` has no `aria-label`. ❌ `<TableHead>` lacks `scope="col"`. | Add both. |
| 7. Form-error UX | Filter strip is URL-driven auto-submit (lines 42–44, 68–105). ✅ | — |
| 8. Copy | "Register asset" CTA top-right when canCreate. ✅ | — |
| 10. Cache Components | `searchParams` awaited (line 25). ✅ | — |

### 2. `/resources/assets/new` and `/resources/assets/[id]/edit` (shared form)
**Files:** `app/(app)/resources/assets/new/page.tsx` (55) + `[id]/edit/page.tsx` (96) + `components/assets/asset-form.tsx` (257)

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add a lightweight skeleton (form-shape: 6 input rows + 2 button row). |
| 4. Error state | Permission-gated branches render inline copy ✅. ❌ No `error.tsx`. | Add `error.tsx` + `not-found.tsx` at `[id]/edit` (the loader can `notFound()` on missing). |
| 6. A11y | DocumentSelectField is keyboard-operable ✅. | — |
| 7. Form-error UX | ❌ Server `fieldErrors` not surfaced inline — `useActionState` (line 56) toasts the top-level error but per-field validation messages don't render under each input. The action *does* return Zod errors via `ActionResult.fieldErrors`. | Wire `fieldErrors` through to per-field `<p>` + `aria-invalid` + `aria-describedby`. |
| 8. Copy | Date helper-text: clarify "Last inspected" vs. "Next PM" relative semantics. | One-liner under each label: "(when this asset was last walked)" / "(next preventive-maintenance date)". |

### 3. `/resources/assets/[id]` (4-tab detail)
**File:** `app/(app)/resources/assets/[id]/page.tsx` (532)

| Dimension | Finding | Fix |
|---|---|---|
| 1. Visual fidelity | Tab nav (line 171) renders as `<nav>` with anchor Links — no ARIA. | Add `role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls`; wrap each tab body in `role="tabpanel"` + `aria-labelledby`. |
| 2. Empty state | Per-tab empties read well (lines 299, 360, 501). ✅ | — |
| 3. Loading | ❌ No `loading.tsx`. | Add tab-shaped skeleton (header + tab strip + body grid). |
| 4. Error state | ❌ Per-tab Supabase errors render as bare `<p className="text-destructive">` (lines 295, 356, 434). | Replace with `<Alert variant="destructive">` inline per tab. ❌ No route-level `error.tsx` either — add. ❌ No `not-found.tsx` — add (loader uses `notFound()` on bad id). |
| 6. A11y / keyboard | Tab Links are keyboard-reachable but `aria-current` is not set on the active one. AssetActions popover trigger has no `aria-label`. | `aria-current="page"` (or `aria-selected="true"` once we adopt the tablist pattern, not both). `aria-label="Change asset condition"` on the dropdown trigger. |
| 7. Form-error UX | "Mark inspected" fires fire-and-forget; toasts on success/error. ✅ | — |
| 8. Copy | Unsafe-transition CTA wires `/incidents/new/1?asset=...&type=unsafe_condition`. ✅ | — |
| 10. Cache Components | All 4 tabs query Supabase on each render. Acceptable for v1 demo; `'use cache'` migration deferred. | — |

### 4. `/resources/documents` (card grid + table toggle)
**File:** `app/(app)/resources/documents/page.tsx` (279) + `components/documents/document-list-filters.tsx` (151)

| Dimension | Finding | Fix |
|---|---|---|
| 1. Visual fidelity | "Module 4 · Resources" eyebrow at line 264–265 — drops to match 6b–6g. | Drop. |
| 2. Empty state | "No documents match these filters." + conditional "Upload your first document" CTA (lines 154–163). ✅ | — |
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton — branch on `?view=cards|table` if practical, else show the cards-shape (smaller diff and matches the default view). |
| 4. Error state | ❌ No `error.tsx`. | Add. |
| 5. Responsive | Cards view stacks at sm; table view may horizontal-scroll. ✅ acceptable. | — |
| 6. A11y / keyboard | ❌ Table view (lines 212–220) headers have no `scope="col"`; the `<Table>` itself has no `aria-label`. View-toggle buttons are reachable. | Add aria-label + scope="col". |
| 7. Form-error UX | Filter strip URL-driven auto-submit (lines 38–40, 64–102). ✅ | — |
| 10. Cache Components | `searchParams` awaited; bulk link-count fetch is one query (lines 114–126) — efficient. ✅ | — |

### 5. `/resources/documents/new` (upload form)
**File:** `app/(app)/resources/documents/new/page.tsx` (71) + `components/documents/document-upload-form.tsx` (217)

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add lightweight skeleton. |
| 4. Error state | ❌ No `error.tsx`. | Add. |
| 6. A11y | Drop zone keyboard-operable ✅. | — |
| 7. Form-error UX | Form state persists after submit, but page redirects on success (line 79) — no leak. ✅ | — |
| 8. Copy | `?type=` query param pre-fills the type chip on page load (lines 30–34). Nice deep-link UX from `<DocumentSelectField>`. ✅ | — |

### 6. `/resources/documents/[id]` (file preview + linked-from + actions)
**File:** `app/(app)/resources/documents/[id]/page.tsx` (381) + `components/documents/document-detail-actions.tsx` (351) + `linked-documents-section.tsx` (222) + `file-preview.tsx` (110)

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add (preview placeholder + sidebar skeleton). |
| 4. Error state | ❌ No `error.tsx`. ❌ No `not-found.tsx`. The page calls `notFound()` on missing doc. | Add both. |
| 6. A11y | `<FilePreview>` `<img>` uses `alt={fileName}`; PDFs render in `<iframe>`. Action cluster (Replace / Edit / Archive) is reachable. ✅ | — |
| 7. Form-error UX | ❌ Edit-metadata dialog (`document-detail-actions.tsx:186–283`) form state is initialized once from `initial` (line 79–83) but isn't reset on dialog close — opening the dialog after a Cancel shows the previously-edited (then-cancelled) values, not the live snapshot. | On `onOpenChange(false)` (Cancel / backdrop / ESC), reset `form` to `initial`. |
| 8. Copy | Linked-from empty: "Not linked yet. Pickers across the app reference this document by id." (lines 329–331) is technical. | Rewrite to "This document hasn't been linked to any records yet. Use the picker on an incident, asset, CAPA, or inspection to link it." |
| **Real perf** | ❌ Per-parent-type label-fetch loop (lines 115–209) issues 7 sequential Supabase queries. On a heavily-linked doc, that's 7× the round-trip latency. | Parallelize with `Promise.all` — no shape change to the rendered output. |

### Cross-cutting — `<DocumentLinkPicker>` (`components/documents/document-link-picker.tsx`, 540 lines)

| Concern | Finding | Fix |
|---|---|---|
| Modal a11y | Built on shadcn `<Dialog>` (radix under the hood) — focus trap + ESC + backdrop dismiss come for free. ✅ Trigger button at line 107 has no `aria-label`. | Add `aria-label="Open document picker"` (or accept the visible label if there is one — confirm during impl). |
| Library tab — archived docs | ❌ No filter on `archived_at IS NULL`; archived docs appear in the list and `linkDocument` is called against them. | Filter the query (or add visual disabled state + tooltip if we want to keep them visible for context). |
| Library tab — per-link error | `toast.error` on failure (line 266); the row stays clickable so the user can retry. ✅ | — |
| Upload tab — form reset | ❌ `setBusy(false)` at line 430 but `file` / `name` / `type` / `expiry` / `notes` persist; second submit re-uploads the same file. | Reset all form state on success. |
| Upload tab — orphan path | ❌ 3-step flow upload→createDocument→linkDocument (lines 405–424). If step 3 fails (RLS, transient, etc.) the doc orphans in `/resources/documents`. | Surface a warning toast naming the orphan + CTA to `/resources/documents` so the user can decide whether to keep or archive. (Per Q2 — recommend over a hard rollback.) |

### Cross-cutting — `<AssetTypeaheadField>` (`components/assets/asset-typeahead-field.tsx`, 170 lines)

| Concern | Finding | Fix |
|---|---|---|
| Combobox ARIA | ❌ Input has no `role="combobox"` / `aria-expanded` / `aria-controls` / `aria-haspopup`. Results list has no `role="listbox"` / per-row `role="option"`. | Add the full WAI-ARIA combobox 1.2 pattern. |
| ESC handling | ❌ No keydown handler — clicking outside closes (lines 45–53), but ESC doesn't. In the wizard context this is a real foot-gun (ESC escalates to dismissing the wizard dialog). | Add an ESC handler scoped to the input. |
| Wizard state on inline-create | ❌ "+ Register a new asset" (line 125–131) is an `<a href="/resources/assets/new">` — clicking it triggers a navigation that destroys the in-progress wizard form state. | Replace the anchor with a `<Dialog>` containing a slimmed `<AssetForm>` (no SDS picker, since we're inside another modal); on success, auto-select the new asset via the field's `onSelect` path. (Per Q1 — recommend modal-in-place.) |

---

## Cross-cutting work

- **State files added:** 4 list/detail `loading.tsx` + 4 list/detail `error.tsx` + 2 detail `not-found.tsx` + 3 form-route lightweight `loading.tsx` = **13 new state files**.
- **No new perm keys.** Existing `asset:read_site` / `asset:edit` / `document:read_site` / `document:upload` / `document:edit` / `document:archive` / `document:link` cover everything.
- **No schema migration.**
- **No new RPCs.**
- **One existing RPC behavior verified, not changed**: `archive_document_v1`'s `force` parameter still drives the active-link override — the dialog already passes it correctly.
- **Reuses `<AlertDialog>`** (shipped 6c) for the delete-orphan affordance if Q2 lands on hard-rollback instead of soft-warning.

## Definition of done — Resources PR

1. 10-item checklist passes for all 7 pages, with `n/a`s explained inline.
2. Every list + detail route has `loading.tsx` + `error.tsx`; both `[id]` detail routes have `not-found.tsx`.
3. "Module 4 · Resources" eyebrow dropped on both list pages.
4. Asset detail tab nav passes the WAI-ARIA tablist pattern (`role="tablist"` + `role="tab"` + `aria-selected` + `aria-controls` + `tabpanel` + `aria-labelledby`).
5. Asset list + Documents table view both have `<Table aria-label>` and per-column `<TableHead scope="col">`.
6. AssetActions dropdown trigger has `aria-label`.
7. AssetTypeaheadField passes the combobox ARIA pattern + ESC closes + "+ Register a new asset" opens an in-place dialog rather than navigating away.
8. AssetForm renders server `fieldErrors` inline per field with `aria-invalid` + `aria-describedby`.
9. DocumentLinkPicker upload tab resets form state on success.
10. DocumentLinkPicker library tab disables (or hides) archived docs.
11. DocumentLinkPicker upload-then-link orphan path surfaces a warning toast + CTA (per Q2).
12. DocumentDetailActions edit-metadata dialog resets form state on Cancel / backdrop / ESC.
13. `/resources/documents/[id]` per-parent-type label fetch parallelizes via `Promise.all`.
14. Empty-state copy refinements ship for cold-empty assets list + linked-from sidebar.
15. `pnpm tsc --noEmit` clean.
16. Smoke-test: extend `docs/smoke-test-phase4.md` with N new 6h checkpoints (loading/error coverage at all routes, eyebrow drop, tab a11y, table a11y, AssetTypeaheadField combobox + ESC + modal create-flow, DocumentLinkPicker form-reset + archived-disabled + orphan-warning, edit-metadata reset, perf/parallelization sanity).
17. PR description includes:
    - Picker mount-point gallery (1 screenshot per of the 5 mount points: Wizard Step 2, incident detail, investigation evidence, CAPA evidence, asset detail Documents tab).
    - 30s recording of the AssetTypeaheadField inline-create flow (open the wizard, click "+ Register a new asset", create asset in modal, observe wizard state preserved + new asset auto-selected).
    - Before/after screenshots for tab nav a11y (DOM tree showing role/aria attributes) + the cold-empty assets state.

---

## Open questions — all resolved 2026-05-08

| # | Question | Resolution |
|---|---|---|
| 1 | AssetTypeaheadField inline-create | **Modal-in-place.** Open a `<Dialog>` containing a slimmed `<AssetForm>` (no SDS picker, since we'd be modal-in-modal). Wizard state survives, new asset auto-selects via the existing `onSelect` path. |
| 2 | DocumentLinkPicker upload→link orphan | **Soft-warning + CTA.** Warning toast naming the orphan + "View in /resources/documents" CTA. The doc may legitimately still be useful; user decides whether to keep or archive. Matches 6g per-file resilience. |
| 3 | AssetForm field-level errors | **Full Zod `fieldErrors`.** Wire all `ActionResult.fieldErrors` keys to per-field `<p>` + `aria-invalid` + `aria-describedby`. Mirrors 6f's `assignTemplate` shape. |
| 4 | Document detail per-parent-type fetch | **`Promise.all` parallelize.** One-line shape fix — wrap the 7 queries in `Promise.all`. ~6× latency win on cold load; no schema/RPC change. |
| 5 | Asset detail "Mark inspected" | **Keep fire-and-forget.** Single click sets `last_inspected_at = now()`. Undo-able via `/resources/assets/[id]/edit`. Note-capture lands in v2 alongside asset-inspection FK. |
| 6 | Documents list `loading.tsx` shape | **Cards-shape.** Cards is the default + visually distinctive; `?view=table` cold-load briefly mismatches but actual paint takes over within the window. |

---

**Plan author note:** the original 06h stub from 2026-05-06 has been wholly replaced by this re-audit. All 17 DoD items above replace the 8 in the prior version. All 6 open questions resolved 2026-05-08; coding can start.
