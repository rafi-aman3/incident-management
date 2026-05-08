# Phase 6g — Inspections polish

**Status:** re-audited 2026-05-08 (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e/6f on kickoff.
**Goal:** Inspections is the **only mobile-first surface in V1**. The runner must work cleanly on a 375px viewport with one thumb, photo upload must tolerate per-file errors without nuking the batch, the signature pad needs labels and a name input that screen readers can find, and tap targets across the runner must hit the 44px mobile spec from `docs/design.md` §8.1. Plus the same state-coverage + a11y baseline as every other Phase 6 module.
**Branch:** `feat/phase-6-inspections-polish`
**PR target:** `main`
**Pages covered:** `/inspections`, `/inspections/[id]` (dual-mode runner OR completed report), `/inspections/[id]/findings/[findingId]`

> **What this PR ships:**
> - `loading.tsx` + `error.tsx` at all 3 routes (none exist — verified 2026-05-08).
> - **Photo upload resilience**: per-file error handling so one bad file no longer aborts the batch (real bug at `media-uploader.tsx:62`); `AbortController` per-file + 30s timeout; batch-count progress feedback ("3 of 5 uploaded").
> - **Save debounce on answer commits**: `saveInspectionAnswer()` is fire-and-forget on every keystroke today (`inspection-runner.tsx:140, 185`); add a 1s debounce so a typing user doesn't fire a request per keystroke.
> - **Signature pad a11y**: name input gains a `<label htmlFor>`; canvas gains `aria-label="Signature drawing area"`; clear button aria-label confirmed.
> - **Tap targets ≥44px on mobile** for the runner's primary action buttons + `MediaUploader` Camera / Upload buttons (currently `py-1.5` ≈ 28px total, below spec).
> - **Icon-only buttons** in `MediaUploader` (Camera, Upload, Remove) get `aria-label`.
> - **`<AlertDialog>` confirm on Escalate-to-Incident** in `FindingActionsCard` — destructive (creates a new incident row) but currently fire-and-forget. Reuse the 6c primitive at `components/ui/alert-dialog.tsx`.
> - **"Module 5" eyebrow drop** on `/inspections` (matches 6b/6c/6d/6e/6f sequencing).
> - **List-page filter form**: status select + search auto-submit on change (currently the form has an "Apply" button that has no clear submit semantics; the filters should behave like every other 6c/6d/6f filter strip — URL-driven, no Apply button).
> - **List `aria-label`s** on the inspections table + findings panel on the dual-mode detail.
> - **Already-resolved finding redirect**: when a finding is marked resolved or escalated, redirect to the parent inspection detail rather than staying on the finding page (the action's revalidation re-fetches but the URL stays — small UX gap).

> **Not in this PR (deferred to v2 with §15 entry as needed):**
> - **No PWA / native-offline mode.** Online-with-tolerance only — the AbortController + per-file error handling above is the v1 ceiling. Full offline queue (IndexedDB-backed retry on reconnect) is v2.
> - **No per-file upload progress %.** Supabase JS doesn't expose native upload progress for the storage client; the polish here is batch-count ("3 of 5"), not a per-file progress bar (would require switching to XHR + signed-URL uploads — that's a refactor).
> - **No GPS / geo-tagging on photos.** Per `IMS_PLANNING.md` §15.5.4.
> - **No live multi-inspector collaboration.** Single user per inspection.
> - **No auto-redirect-after-Mark-Resolved scroll-to-CAPA.** Surfacing a linked CAPA on the finding page (when one was created from this finding) is a nice-to-have but not the polish bar — will scope post-PR if it ships fast.
> - **No section-header sticky-on-scroll** in the runner. Long checklists do scroll headers out of view, but adding `sticky top-[3.5rem]` interacts with the existing sticky topbar and needs design validation against the 375px viewport before shipping.
> - **No "Save & exit" CTA.** Auto-save is transparent; the back arrow exits silently. Adding a confirm or a toast-on-first-save is judgment-call territory — open question below.

---

## Audit (verified 2026-05-08 against shipped surfaces)

### 1. `/inspections` (list with filters + Start picker)
**File:** `app/(app)/inspections/page.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 1. Visual fidelity | "Module 5" eyebrow at line 148 (drop — matches 6b–6f). Card list renders 200 rows max via `InspectionList`. ✅ Status pill + due-date OK. | Drop eyebrow. |
| 2. Empty state | List empty: helpful copy. ✅ Start picker: "No templates assigned…" branch ships in `start-inspection-dialog.tsx`. ✅ | — |
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (header + 6-row table placeholder). |
| 4. Error state | ❌ `listError` (line 174) renders as bare `<p className="text-destructive">`. ❌ No `error.tsx`. | Throw on query error → catch in `error.tsx` brand card with Try-again. |
| 5. Responsive | sm: cards stack via `InspectionList`. ✅ Filter chips wrap. ✅ | — |
| 6. A11y / keyboard | ❌ Filters form has an "Apply" button (line ~210) — every other 6c/6d/6f filter strip is URL-driven + auto-submits on change. Inconsistent. ❌ Inspections table has no container `aria-label`. | Migrate filters to URL-driven (mirror `template-library-filters.tsx` shape — search debounce on blur + status select onChange). Wrap table in `<section aria-label="Inspections">`. |
| 7. Form-error UX | Start picker uses `useTransition()` ✅; redirect on success. ❌ Per-row "Resume" vs. "Start" affordance not distinct (both routes the same way). | Status-aware label on the per-row CTA (Resume for `in_progress`, Start for `scheduled`/null). |
| 8. Copy | "Start inspection" button. ✅ | — |
| 10. Cache Components | `searchParams` awaited (line 53). ✅ `?template=<uuid>` filter shipped via 6f. ✅ | — |

### 2. `/inspections/[id]` (dual-mode runner OR completed report)
**Files:** `app/(app)/inspections/[id]/page.tsx`, `components/inspections/runner/inspection-runner.tsx` (~679 lines), `media-uploader.tsx`, `signature-canvas.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add a branched skeleton — runner-mode (sticky topbar + content rows) vs. report-mode (header + sections + findings panel). Render the runner-shape if URL has `?mode=run`-ish hint, otherwise the safer report skeleton. |
| 4. Error state | ❌ No `error.tsx`. ✅ `notFound()` wired (lines 81, 84). ❌ No brand `not-found.tsx` for the inspection-id-not-found branch. | Add both. `not-found.tsx` mirrors the 6e Reports / 6f Templates pattern. |
| 6. A11y (report mode) | Findings list at lines 189–210 lacks container `aria-label`. ❌ Findings count copy at line 163 reads `{N} finding(s)` — should be `{N} finding{N === 1 ? "" : "s"}`. **Audit corrected: actually shipped correctly (already uses ternary). No fix needed.** | Add `aria-label="Findings from this inspection"` to the findings section. |

#### Runner mode — `inspection-runner.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| Save debounce | ❌ `saveInspectionAnswer({...})` fired immediately on every change (lines 112, 140, 185 — no debounce, no AbortController). On a slow mobile network, every textarea keystroke fires a network round-trip. | Wrap commits in a 1s debounce (per-`item_id` keyed) — cancels via cleanup if the user keeps typing. Keep the unconditional flush on Submit. |
| Photo upload (`media-uploader.tsx`) | ❌ `for (file of files)` loop: `if (!res.ok) throw new Error(res.error)` at line 62 — one bad file aborts the entire batch and discards previously-successful uploads in that batch. ❌ No `AbortController` so a network drop stalls forever. ❌ No batch-count feedback — only a binary "Uploading…" spinner. | Refactor the loop to gather `successes[]` + `failures[]`. AbortController per file + 30s `setTimeout(controller.abort, 30_000)`. After the loop, fire one success toast (`Uploaded N of M`) + per-failure error toasts. |
| Tap targets | ❌ `MediaUploader` Camera + Upload buttons (lines 119, 127): `px-3 py-1.5 text-xs` ≈ 28px tall. Runner Submit button (line 227): same shape. **Below the 44px mobile spec** in `docs/design.md` §8.1. | Bump padding on the runner's primary actions to `py-2.5 sm:py-1.5` (matches min-44px on mobile while keeping desktop tighter). For media-uploader, same. Wrapper div may be needed to hit exactly 44px without breaking the visual scale. |
| MediaUploader a11y | ❌ Camera button (line 119) has no `aria-label` (text inside is "Camera" so it's fine, actually). ❌ Trash button on uploaded photos has `aria-label="Remove"` ✅. ❌ Hidden file input + button-as-trigger pattern is fine. **Audit corrected: aria-labels are mostly OK; only the Camera-vs-Upload distinction could be more explicit.** | Add `aria-label="Capture photo from camera"` (currently just "Camera") and `aria-label="Upload images from device"` (currently just "Upload") so the screen reader hint is unambiguous. |
| Signature pad a11y (`signature-canvas.tsx`) | ❌ Canvas has no `aria-label` (line ~134). ❌ Name input (line ~125) has no `<label htmlFor>` — relies on visual context. | Add `<label htmlFor="sig-name">Printed name</label>` + `aria-label="Signature drawing area"` on the canvas. |
| Required-fields modal | Lists missing item labels. Two buttons: "Back to inspection" + "Submit anyway" (lines 286–325). ✅ Functional. | "Back to inspection" could scroll the first missing item into view on close — small win. Defer if it expands the diff too much. |
| Flagged-items wizard | Per-item textarea, scrollable list, Back + Submit (lines 327–386). ✅ Functional for ≤5 flagged items. | Acceptable as-is. If we want a per-item stepper, it's its own polish unit — defer. |
| Mode dispatch | Server-side at line 107: status `in_progress` / `draft` → runner; else report. Perm-gated. ✅ | — |
| Sticky progress bar | `sticky top-0 z-10` (line 206). ✅ | — |
| Section headers | Not sticky. Long checklists scroll headers off. | **Defer** (interacts with the existing sticky topbar at 375px; needs design validation). |
| "Save & exit" / network indicator | No explicit affordance. Auto-save is silent. No online/offline indicator. | Open question — see Q3 below. |
| Double-submit guard | Submit button disables while `submitting` (line 226). ✅ Two-tab race: server RPC `complete_inspection_v1` is idempotent — second call rejects silently. Acceptable. | — |

### 3. `/inspections/[id]/findings/[findingId]`
**Files:** `app/(app)/inspections/[id]/findings/[findingId]/page.tsx`, `components/inspections/finding-actions-card.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (header + content grid + sidebar action card). |
| 4. Error state | ❌ No `error.tsx`. ✅ `notFound()` wired (line 46). | Add `error.tsx`. |
| 6. A11y | ✅ Resolution-notes textarea has `<label htmlFor>` (line ~58). ❌ Mark Resolved + Escalate buttons (`finding-actions-card.tsx:72–89`) lack descriptive `aria-label`. | Add `aria-label="Mark this finding resolved with optional notes"` + `aria-label="Escalate this finding to a new incident"`. |
| 7. Form-error UX | `useTransition()` guards pending state ✅. ❌ Escalate is destructive (creates a new incident row + redirects) with no confirm modal. ❌ Already-resolved branch surfaces a finalized pill (lines 144–152) — correct. | Wrap Escalate in `<AlertDialog>`: "Create a new incident from this finding? A draft incident ref will be generated and you'll land on the new incident's detail page." Cancel default; brand-purple confirm. |
| Post-action navigation | After `resolveFinding` or `escalateFindingToIncident`, the page stays on the finding URL (action revalidates but browser doesn't redirect). User has to use browser back. | After Mark Resolved: redirect to the parent `/inspections/[id]` (the inspection's findings panel). After Escalate: redirect to `/incidents/[newId]` (server action already returns the incident id; just `redirect(...)` after the RPC). |

---

## Cross-cutting work

- **6 new state files** (`loading.tsx` + `error.tsx` at all 3 routes; `not-found.tsx` at `/inspections/[id]`).
- **Reuse `<AlertDialog>`** from `components/ui/alert-dialog.tsx` (shipped 6c) at the Escalate-to-Incident site.
- **No new perm keys.** The 4 inspection-related keys (`inspection:read_site`, `inspection:start`, `inspection:edit_own`, `inspection:edit_any`) cover every action.
- **No schema migration.**
- **No new RPCs.**

## New helper: per-file upload result type (`media-uploader.tsx`)

Refactor the upload loop to return:

```ts
type UploadOutcome =
  | { ok: true; uploadId: string; fileName: string }
  | { ok: false; fileName: string; error: string };
```

After the loop:
- count successes/failures
- toast.success("Uploaded N of M") if any succeeded
- toast.error("<filename>: <error>") for each failure

This is ~30 lines of refactor inside the existing component; no new file needed.

---

## Definition of done — Inspections PR

1. 10-item checklist passes for all 3 pages, with `n/a`s explained inline.
2. Every route has `loading.tsx` + `error.tsx` (and `not-found.tsx` at `/inspections/[id]`).
3. Photo upload tolerates per-file failure: a 5-file upload where file 3 fails reports "Uploaded 4 of 5" + 1 error toast; the 4 successes are persisted.
4. AbortController per-file with a 30s timeout fires on stalled uploads.
5. `saveInspectionAnswer` debounced 1s; verified by typing "asdf" into a text-response question and observing only one network request after the typing settles.
6. Signature canvas has `aria-label`; name input has `<label htmlFor>`.
7. Runner Submit + media-uploader Camera/Upload buttons hit ≥44px on mobile (verified at 375px viewport).
8. Escalate-to-Incident gated by `<AlertDialog>` confirm.
9. Mark Resolved redirects to parent inspection; Escalate redirects to new incident.
10. List-page filters auto-submit on change (no "Apply" button).
11. "Module 5" eyebrow dropped from `/inspections`.
12. `pnpm tsc --noEmit` clean.
13. Smoke-test: extend `docs/smoke-test-phase3.md` with 8 new 6g checkpoints (loading skeletons / error retry / per-file upload error / AbortController stall recovery / save debounce / signature a11y / Escalate confirm / post-action redirects).
14. PR description includes:
    - 30s screen recording of runner on 375px viewport (one-thumb scroll + photo capture + signature + complete).
    - Network-drop demo: Network throttle to "Slow 3G" mid-upload → AbortController fires after 30s → batch reports failure for that file but succeeds for the others.
    - Before/after screenshots for tap-target sizes + signature a11y.

---

## Open questions for the user (resolve before coding)

1. **"Save & exit" CTA + auto-save indicator.** Today the runner's autosave is silent and the back arrow exits without a confirm. Do we (a) **leave it silent** (recommend — fire-and-forget saves work; user trust comes from durability not chrome), (b) add a one-time toast on first save ("Changes saved automatically"), or (c) add a small "Saved" indicator near the topbar that mirrors the Templates editor's `SaveIndicator`?
2. **Network indicator (online/offline pill in the runner topbar).** `navigator.onLine` is cheap. (a) **Drop entirely** (recommend — without offline-queue support, an offline pill just communicates a problem we don't fix), (b) add a passive "Offline" pill that shows when `navigator.onLine === false`, (c) full network indicator with last-saved timestamp.
3. **Per-file upload progress UI.** Supabase JS doesn't expose native upload progress; getting per-file % requires switching to XHR + signed-URL uploads (substantive refactor). (a) **Batch count only** (recommend — "3 of 5 uploaded" is honest about what we can measure), (b) refactor to XHR + signed URLs to surface real per-file %, (c) skip the indicator entirely.
4. **Confirmation modal on Mark Resolved.** Today resolveFinding fires immediately when the user clicks. Notes textarea is optional. (a) **Add `<AlertDialog>` confirm with the notes textarea inline** (recommend — matches the destructive-action pattern set by 6c/6f), (b) keep current (notes are optional and resolve is reversible by editing the row), (c) make notes required + click-to-confirm.
5. **List-page filter Apply-button removal.** The current "Apply" button is inconsistent with every other 6c/6d/6f filter strip. (a) **Remove + auto-submit on change** (recommend — matches precedent), (b) keep the Apply button and just make it work consistently, (c) deferred — it works today, polish is cosmetic.
6. **"Save & exit" → preserves state.** Whether we add an explicit "Save & exit" CTA. Today the back arrow leaves silently and the auto-save preserves state, so "Save & exit" is functionally identical to back. (a) **Skip** (recommend — adding one would suggest the back arrow does NOT save, which is misleading), (b) add it for explicit reassurance, (c) repurpose the back arrow's behavior to confirm-then-exit.

---

**Plan author note:** the original 06g stub from 2026-05-06 has been wholly replaced by this re-audit. All 14 DoD items above replace the 10 in the prior version (key adds: per-file upload, save debounce, signature a11y, tap targets, post-action redirects). Coding pauses until the user answers Q1–Q6 above. Recommended defaults are flagged so the user can rubber-stamp.
