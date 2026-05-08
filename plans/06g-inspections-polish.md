# Phase 6g — Inspections polish

**Status:** re-audited 2026-05-08 (replaces the 2026-05-06 TBD stub) — same precedent as 6c/6d/6e/6f on kickoff.
**Goal:** Inspections is the **only mobile-first surface in V1**. The runner must work cleanly on a 375px viewport with one thumb, photo upload must tolerate per-file errors without nuking the batch, the signature pad needs labels and a name input that screen readers can find, and tap targets across the runner must hit the 44px mobile spec from `docs/design.md` §8.1. Plus the same state-coverage + a11y baseline as every other Phase 6 module.
**Branch:** `feat/phase-6-inspections-polish`
**PR target:** `main`
**Pages covered:** `/inspections`, `/inspections/[id]` (dual-mode runner OR completed report), `/inspections/[id]/findings/[findingId]`

> **What this PR ships:**
> - `loading.tsx` + `error.tsx` at all 3 routes (none exist — verified 2026-05-08); `not-found.tsx` at `/inspections/[id]`.
> - **Photo upload resilience**: per-file error handling so one bad file no longer aborts the batch (real bug at `media-uploader.tsx:62`); `AbortController` per-file + 30s timeout; batch-count progress feedback ("3 of 5 uploaded").
> - **Save debounce on answer commits**: `saveInspectionAnswer()` is fire-and-forget on every keystroke today (`inspection-runner.tsx:140, 185`); add a 1s debounce so a typing user doesn't fire a request per keystroke.
> - **Network indicator in the runner topbar with last-saved timestamp** (resolved per Q2): tracks `lastSavedAt` + watches `navigator.onLine` via the standard `online` / `offline` window events; renders compact pill cycling between "Saving…" / "Saved 12s ago" / "Offline — last saved 2m ago" / "Offline" (never-saved). Mobile-first: lives in the existing sticky topbar at 375px without breaking the progress-bar row.
> - **`<AlertDialog>` confirm on Mark Resolved** in `FindingActionsCard` (resolved per Q4): wraps the action with the optional notes textarea inline in the dialog body. Matches the destructive-action precedent from 6c/6f.
> - **Signature pad a11y**: name input gains a `<label htmlFor>`; canvas gains `aria-label="Signature drawing area"`; clear button aria-label confirmed.
> - **Tap targets ≥44px on mobile** for the runner's primary action buttons + `MediaUploader` Camera / Upload buttons (currently `py-1.5` ≈ 28px total, below spec).
> - **Icon-only buttons** in `MediaUploader` (Camera, Upload, Remove) get `aria-label`.
> - **`<AlertDialog>` confirm on Escalate-to-Incident** in `FindingActionsCard` — destructive (creates a new incident row) but currently fire-and-forget. Reuse the 6c primitive at `components/ui/alert-dialog.tsx`.
> - **"Module 5" eyebrow drop** on `/inspections` (matches 6b/6c/6d/6e/6f sequencing).
> - **List-page filter form** (resolved per Q5): status select + search auto-submit on change. The "Apply" button is dropped to match every other 6c/6d/6f filter strip — URL-driven via `useRouter().push()`.
> - **List `aria-label`s** on the inspections table + findings panel on the dual-mode detail.
> - **Already-resolved finding redirect**: when a finding is marked resolved or escalated, redirect to the parent inspection (Mark Resolved → `/inspections/[id]`) or to the new incident (Escalate → `/incidents/[newId]`) rather than staying on the finding page.

> **Not in this PR (deferred to v2 with §15 entry as needed):**
> - **No PWA / native-offline mode.** Online-with-tolerance only — the AbortController + per-file error handling + network indicator above are the v1 ceiling. Full offline queue (IndexedDB-backed retry on reconnect) is v2.
> - **No per-file upload progress %.** Supabase JS doesn't expose native upload progress for the storage client; the polish here is batch-count ("3 of 5"), not a per-file progress bar (would require switching to XHR + signed-URL uploads — that's a refactor).
> - **No GPS / geo-tagging on photos.** Per `IMS_PLANNING.md` §15.5.4.
> - **No live multi-inspector collaboration.** Single user per inspection.
> - **No linked-CAPA surfacing on the finding detail.** Out of scope — would query `capas` for records linked to this finding and render an inline link. Worth scoping post-PR if it ships fast.
> - **No section-header sticky-on-scroll** in the runner. Long checklists do scroll headers out of view, but adding `sticky top-[3.5rem]` interacts with the existing sticky topbar and needs design validation against the 375px viewport before shipping.
> - **No "Save & exit" CTA.** Auto-save stays silent (per Q1) — adding a CTA would suggest the back arrow does NOT save, which is misleading.
> - **No SaveIndicator in the runner topbar** (per Q1). The new network indicator (per Q2) carries the save-state signal — no separate SaveIndicator needed.

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
| "Save & exit" / network indicator | No explicit affordance. Auto-save stays silent (per Q1). **Network indicator with last-saved timestamp ships** (per Q2): lives in the existing sticky topbar; tracks `navigator.onLine` + last successful-save timestamp. | New small component `components/inspections/runner/network-indicator.tsx`: subscribes to `online` + `offline` window events, accepts `lastSavedAt: Date | null` + `status: SaveStatus` from the runner, renders the cycling pill. Updates the relative-time label every 15s via `setInterval` while mounted. |
| Double-submit guard | Submit button disables while `submitting` (line 226). ✅ Two-tab race: server RPC `complete_inspection_v1` is idempotent — second call rejects silently. Acceptable. | — |

### 3. `/inspections/[id]/findings/[findingId]`
**Files:** `app/(app)/inspections/[id]/findings/[findingId]/page.tsx`, `components/inspections/finding-actions-card.tsx`

| Dimension | Finding | Fix |
|---|---|---|
| 3. Loading | ❌ No `loading.tsx`. | Add skeleton (header + content grid + sidebar action card). |
| 4. Error state | ❌ No `error.tsx`. ✅ `notFound()` wired (line 46). | Add `error.tsx`. |
| 6. A11y | ✅ Resolution-notes textarea has `<label htmlFor>` (line ~58). ❌ Mark Resolved + Escalate buttons (`finding-actions-card.tsx:72–89`) lack descriptive `aria-label`. | Add `aria-label="Mark this finding resolved with optional notes"` + `aria-label="Escalate this finding to a new incident"`. |
| 7. Form-error UX | `useTransition()` guards pending state ✅. ❌ Escalate is destructive (creates a new incident row + redirects) with no confirm modal. ❌ Mark Resolved fires immediately with no confirm — per Q4 we add a confirm with the optional notes inline. ❌ Already-resolved branch surfaces a finalized pill (lines 144–152) — correct. | Wrap Escalate in `<AlertDialog>`: "Create a new incident from this finding? A draft incident ref will be generated and you'll land on the new incident's detail page." Cancel default; brand-purple confirm. Wrap Mark Resolved in a separate `<AlertDialog>` whose body contains the existing "Resolution notes (optional)" textarea — keeps the optional-notes flow but adds the destructive-action precedent. |
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
6. **Network indicator** in the runner topbar shows the right state across (a) online + saving, (b) online + saved with relative timestamp, (c) offline + last-saved-Nm-ago, (d) offline + never-saved. Updates every 15s while mounted.
7. Signature canvas has `aria-label`; name input has `<label htmlFor>`.
8. Runner Submit + media-uploader Camera/Upload buttons hit ≥44px on mobile (verified at 375px viewport).
9. Escalate-to-Incident gated by `<AlertDialog>` confirm.
10. **Mark Resolved gated by `<AlertDialog>` confirm** with the optional notes textarea inline in the dialog body.
11. Mark Resolved redirects to parent inspection; Escalate redirects to new incident.
12. List-page filters auto-submit on change (no "Apply" button).
13. "Module 5" eyebrow dropped from `/inspections`.
14. `pnpm tsc --noEmit` clean.
15. Smoke-test: extend `docs/smoke-test-phase3.md` with 9 new 6g checkpoints (loading skeletons / error retry / per-file upload error / AbortController stall recovery / save debounce / network indicator state cycling / signature a11y / Mark Resolved + Escalate confirms / post-action redirects).
16. PR description includes:
    - 30s screen recording of runner on 375px viewport (one-thumb scroll + photo capture + signature + complete + observe the network indicator across save states).
    - Network-drop demo: throttle to "Offline" mid-upload → AbortController fires after 30s → batch reports failure for that file but succeeds for the others; runner topbar pill flips to "Offline — last saved Xs ago".
    - Before/after screenshots for tap-target sizes + signature a11y.

---

## Open questions — all resolved 2026-05-08

| # | Question | Resolution |
|---|---|---|
| 1 | "Save & exit" CTA + autosave indicator | **Leave silent.** No SaveIndicator in the runner topbar; back arrow keeps current silent-exit behavior (autosave preserves state). |
| 2 | Network indicator | **Full indicator with last-saved timestamp.** New `components/inspections/runner/network-indicator.tsx` cycles "Saving…" / "Saved 12s ago" / "Offline — last saved Nm ago" / "Offline" (never-saved). Lives in the existing sticky topbar; updates every 15s while mounted. |
| 3 | Per-file upload progress UI | **Batch count only** ("3 of 5 uploaded" + per-failure toasts). No XHR refactor. |
| 4 | Confirmation modal on Mark Resolved | **AlertDialog with notes inline** in the dialog body (notes stay optional). Matches 6c/6f destructive-action precedent. |
| 5 | List-page filter Apply-button removal | **Remove + auto-submit on change.** Matches every other 6c/6d/6f filter strip. |
| 6 | Explicit "Save & exit" CTA | **Skip.** Adding one would suggest the back arrow does NOT save — misleading. |

---

**Plan author note:** the original 06g stub from 2026-05-06 has been wholly replaced by this re-audit. All 16 DoD items above replace the 10 in the prior version. All 6 open questions resolved 2026-05-08; coding can start.
