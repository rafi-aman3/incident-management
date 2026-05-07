# Phase 6d — CAPA polish

**Status:** drafted 2026-05-06 · re-audited 2026-05-08 against shipped surfaces (Phase 6 module 4 of 10)
**Goal:** Tighten the most regulator-facing screen in the product. The 60/40 detail layout, 4-outcome verification flow, and follow-up CAPA chain are already wired correctly — the gaps are missing route-level loading/error files, a leftover "Module 3" eyebrow, tab-strip semantics, a silent progress-promotion that should toast, and a partial-effective verification that fires without warning the verifier on-screen first.
**Branch:** `feat/phase-6-capa-polish`
**PR target:** `main`
**Pages covered:** `/capa`, `/capa/[id]`

> **What this PR ships:**
> - 10-item shared checklist applied to both routes; concrete findings + fixes below.
> - List: `loading.tsx` + `error.tsx`; "Module 3" eyebrow dropped (matches 6b/6c); tab strip migrates to `role=tablist` + `aria-current="page"` semantics; per-tab empty-state copy that explains what each tab is for; filter-chip a11y (`aria-pressed`).
> - Detail: `loading.tsx` + `error.tsx`; progress auto-promotion fires a toast ("CAPA started") on the silent `created → in_progress` transition; partial-effective outcome shows a pre-submit info card explaining the auto-spawn before the verifier commits; reassign-verifier button gets the secondary-button tier; verification radio group gets `aria-describedby` linking each outcome's consequence text; activity timeline gains a notifications fetch so the 2-source merge fulfils what's promised in spec §11.
> - All raw amber/100/950 sandbox literals (if any new ones surfaced) migrate to the `warning/15 + warning` token pair (one carry-over check from 6c).
>
> **Not in this PR (deferred or n/a):**
> - No new verification outcome (4 are locked: `effective / partially_effective / not_effective / too_early_to_verify`).
> - No new verification method (5 are locked: `inspection / monitoring / audit_trend / re_interview / document_review`).
> - No new CAPA status. State machine stays `created → in_progress → pending_verification → verified → closed` (with `not_effective` returning to `in_progress`).
> - **No change to the owner-cannot-verify enforcement.** UI hides the verification form entirely when viewer = owner (already shipped). Original 06d stub said "disabled with tooltip" — re-audit shows hidden is the shipped pattern and is acceptable: an owner can't act on their own CAPA, so a disabled form would just be visual debt. Locked rule (3-layer enforcement) is independent of the UI choice.
> - No 4-source timeline merge like 6c — CAPA only has 2 plausible sources (`activity_events` + `notifications`). Documents are linked via `<DocumentLinkPicker>` in the Evidence card, not surfaced as timeline events.
> - No new RPCs, no new perm keys, no schema changes.

---

## 0. Cross-cutting findings (apply to both routes)

| # | Finding | File(s) | Fix |
|---|---|---|---|
| 0.1 | No `loading.tsx` / `error.tsx` at either route — page blanks on nav and any thrown error escapes to the global boundary | `app/(app)/capa/loading.tsx` (missing), `app/(app)/capa/error.tsx` (missing), `app/(app)/capa/[id]/loading.tsx` (missing), `app/(app)/capa/[id]/error.tsx` (missing) | Add skeletons matching post-load layout (KPI strip + tab strip + table for list; header + 60/40 split for detail). Wire brand error card with `Try again` (resets boundary) + `Back to CAPAs` link |
| 0.2 | "Module 3" eyebrow above page title is internal-speak — Phase 6b dropped it on `/incidents`, 6c dropped it on `/investigations` | `app/(app)/capa/page.tsx:183` | Drop the eyebrow; lift the title hierarchy to match 6b/6c |
| 0.3 | Sandbox practice badge: re-audit confirms tokens are already on `warning/15 + warning` (no raw amber literals on this route). 6c migration covered detail page. | n/a | None — already compliant, noted for the audit trail |

---

## 1. `/capa` (list — KPI strip + 6 tabs + table)

KPI strip on top (4 cards: Active / Pending verification / Overdue / Closed via 6 head-count `Promise.all` queries), tab list filtering by status (Mine · Active · Pending verification · Overdue · Closed · All), table with 8 columns (Ref · Title · Type · Owner · Verifier · Progress · Due · Status). URL-driven `?action=create` opens the create modal (already wired and shared with `/investigations/[id]?action=create-capa`).

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | KPI cards: numeric large + sublabel small + icon + tone — matches 6b `KpiCard` palette. Status badges use `CAPA_STATUS_META` with `warning/15` + `success/15` token pairs. Table layout matches `/incidents` post-6b density. | None |
| 2. Empty state | ⚠ generic | List empty: "No CAPAs match this view." — same string regardless of tab. The "Mine" tab landing empty for a worker is very different from "Closed" tab empty for an org with no closed CAPAs yet. | Per-tab empty hints: `Mine` → "Nothing assigned to you. New CAPAs from investigations or inspections appear here.", `Active` → "No active CAPAs. They'll show up here as investigations create them.", `Pending verification` → "Nothing waiting on a verifier.", `Overdue` → "No overdue CAPAs — nice work.", `Closed` → "No closed CAPAs yet.", `All` → "No CAPAs in this org yet." |
| 3. Loading state | ✗ missing | No `loading.tsx`; KPI strip + table both blank during nav | Add skeleton: KPI strip (4 cards) + tab strip + table-rows × 6. KPIs hydrate as one block in the same boundary — **don't try independent KPI hydration**, the queries already run in `Promise.all` so the gating block is ~one network RTT |
| 4. Error state | ⚠ inline string | `queryError && <p className="text-sm text-destructive">{queryError}</p>` (`page.tsx:210`) — no retry, no recovery affordance | Render via the brand error card via the new `error.tsx`; keep the inline string as a row-fetch fallback (KPI block is resilient already) |
| 5. Responsive | ✓ ok | KPI: `grid-cols-2 sm:grid-cols-4`; table in scrollable container | None |
| 6. A11y / keyboard | ✗ broken | Tabs are plain `<Link>` elements — no `role="tablist"`, no `role="tab"`, no `aria-current="page"` on the active tab. Filter chip(s) (none currently) would also miss `aria-pressed`. KPI cards are pure read-only — fine. | Wrap tab list in `<nav role="tablist" aria-label="CAPA status tabs">`; each tab `<Link role="tab" aria-current={active ? "page" : undefined}>`. Mirrors the 6c `detail-tabs.tsx` pattern |
| 7. Form-error UX | n/a | List page | None |
| 8. Copy | ⚠ | "Module 3" eyebrow (line 183). Tab labels OK. Status pill copy via `CAPA_STATUS_META` correct. | Drop eyebrow (per 0.2) |
| 9. Dark mode | ✓ ok | All tokens, no raw hex on this route | None |
| 10. Cache Components | ✓ ok | `searchParams: Promise<...>` awaited; no stale `'use cache'`; no `export const runtime` | None |

### Small functional gaps

- **Filter chips missing.** Plan stub mentioned "site / owner / verifier / due-window / source" — none of these are wired beyond the 6-tab status filter. Mirror 6c precedents that *did* land:
  - **Site filter** (`?site=all|<uuid>`) using the planner-shape — defaults to current site cookie. Recommend adding.
  - **Owner filter** (`?owner=me|unassigned|<uuid>`) — recommend adding (mirrors 6c lead filter).
  - **Verifier filter** — *defer*. Verifier is set after `pending_verification` only, and the "Pending verification" tab already narrows the view; a verifier filter is low-value.
  - **Due-window filter** (`?due=this_week|this_month|next_30d`) — *defer to v2*. Overdue tab already covers the urgent case.
  - **Source filter** (`?source=incident|investigation|inspection|standalone`) — *defer to v2*. Low click-through value vs. the cost of the chip.
- **"Create CAPA" button** — already URL-driven via `?action=create`. Verified working from both `/capa?action=create` and `/investigations/[id]?action=create-capa`. ✓
- **Bulk close-verified** — defer to v2 (rare path; per-row "Mark verified" already exists on detail).
- **Sandbox affordance** — same toggle visibility logic as `/incidents` post-6b. Re-audit: confirmed already compliant.

---

## 2. `/capa/[id]` — 60/40 detail

Left 60%: Description card → ProgressSection (slider with debounced autosave) → CompleteCapaButton (when status = `in_progress`) → VerificationForm (when status = `pending_verification` AND viewer ≠ owner AND `canVerify`) → Evidence + references (DocumentLinkPicker) → Activity timeline. Right 40%: SourceInvestigationLink → OwnerVerifierCard → Reassign-verifier modal trigger.

### Header + banner audit

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Title + status pill + due-date chip; back link to `/capa`. Status pill colors match `CAPA_STATUS_META`. | None |
| 2. Empty state | n/a (single detail view) | | |
| 5. Responsive | ✓ ok | `lg:grid-cols-[1fr_320px]` stacks on mobile | None |
| 8. Copy | ✓ ok | Header copy fine; due-date red when overdue (token-driven) | None |

### Per-section audit

#### ProgressSection (slider + debounced save)

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | `<input type="range">` with `aria-label="Implementation progress"`; SaveIndicator next to it | None |
| 4. Error state | ⚠ | `toast.error(result.error)` on save fail, but no retry surfaced — user must edit the slider again to retrigger | Add retry button next to SaveIndicator on `status === "error"` (mirrors 6c 5-Why retry) |
| 6. A11y | ✓ ok | `aria-label`; arrow keys move ±1 by default (browser-standard for range inputs). Step is `1`. | None |
| **Auto-promotion UX** | ✗ silent | When owner drags slider from 0 → N on `status='created'`, action `updateCapaProgress` auto-transitions to `in_progress` and logs `capa.started` event ([id]/actions.ts:56–75). No toast, no in-page confirmation — the status pill flips on next render but the user gets no acknowledgment of the lifecycle shift | Add `toast.success("CAPA started", { description: "Status moved to In progress." })` from the action's success path when the transition fires (gate via a returned boolean — RPC needs to surface "did we promote?" in the response, OR the action wrapper computes it from the prior state). **Server Action returns `{ ok: true, promoted: boolean }`.** |

#### VerificationForm (4-outcome radio + method select)

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Radio group (4 outcomes) + select (5 methods) + conditional fields (rejection reason for `not_effective`, re-verify date for `too_early_to_verify`) + submit button. `<InfoTooltip tip="capa_verifier_independence">` and `<InfoTooltip tip="capa_partial_effective">` placed correctly. | None |
| 2. Empty state | n/a | Form always populated when rendered | |
| 4. Error state | ⚠ | Submit error → toast.error only. No inline error bubble next to the failing field. | Acceptable — verification errors are RPC-level (not field-level Zod fails). Toast is the right channel. No fix. |
| 6. A11y | ⚠ | Radio group is standard `<RadioGroup>` / `<RadioGroupItem>` but the per-outcome consequence text below each option isn't linked via `aria-describedby` — screen readers read the label only, not the consequence | Each `<RadioGroupItem id="outcome-{key}">` gets `aria-describedby="outcome-{key}-desc"`; the consequence text gets a matching `id` |
| 7. Form-error UX | ⚠ | `not_effective` needs rejection reason — it's `required`, but the form-disabled gating + toast pattern is OK. No fieldErrors surface. | Acceptable — single conditional required field, the disabled button signals it |
| 8. Copy | ✓ ok | Hints clear: "Effective → closes this CAPA", "Partially effective → closes this CAPA + creates a follow-up", "Not effective → reverts to In progress", "Too early to verify → set a re-verify date" | None |
| **Partial-effective pre-submit warning** | ⚠ surprise | When verifier selects `partially_effective`, the follow-up CAPA is auto-created **server-side** via `verify_capa_v1`. The verifier sees it post-submit as a banner on the parent page (lines 134–148 of detail page). Spec doesn't require pre-submit form preview, but the original plan stub said "show the follow-up's draft form on screen BEFORE submit". Re-audit verdict: pre-submit form is a heavy lift (need to render a CAPA mini-form, capture title/owner/due — duplicating the create-CAPA form), AND the auto-spawn is intentional ("close the loop without manual ceremony"). | Compromise: surface a **pre-submit info card** above the submit button when `outcome === 'partially_effective'`: "Submitting this verification will create a follow-up CAPA assigned back to <owner-name>. You'll be able to edit its title, due date, and details after the verification completes." Don't render the full form — render the *intent*. This bridges the surprise gap without re-implementing the create flow. |

#### CompleteCapaButton

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Modal confirms "Move to Awaiting verification. Verifier <name> notified." | None |
| 8. Copy | ✓ ok | Confirms what fires: state transition + verifier notification | None |

#### OwnerVerifierCard + Reassign-verifier modal

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ⚠ | "Reassign verifier" trigger uses a generic `border + hover:bg-accent` pattern instead of the secondary-button tier. Inconsistent with rest of the secondary actions (e.g. the Reassign-lead modal trigger on investigations, which uses the standard ghost-button styling) | Apply `<Button variant="outline" size="sm">` styling to match the standard secondary-action tier |
| 6. A11y | ⚠ minor | Card has no `<h2>` / `<h3>` heading; icon-only role indicators (no text label) | Wrap "Owner" / "Verifier" labels in `<h3 className="sr-only md:not-sr-only">` so screen readers find the section structure |
| Modal: reassign | ✓ ok | URL-driven `?action=reassign-verifier`, candidates filtered (excludes owner — enforces `owner ≠ verifier`), logs `activity_events` with `{from, to}` payload (`actions.ts:296–305`) | None |
| Modal: validation | ⚠ | `<select>` with no aria-required, button disabled when no selection — visual-only signal | Add `aria-required="true"` on select; keep disabled-button gate |

#### Evidence + references card (DocumentLinkPicker)

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Re-uses the `<DocumentLinkPicker>` from Phase 4. No CAPA-specific gaps. | None |

#### Activity timeline

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ⚠ | Flat reverse-chrono list of `activity_events.eq("capa_id", capa.id)` only (page.tsx:96–98). No per-day grouping. No deep-link icon per row. | Group by `format(date, 'yyyy-MM-dd')` like 6c. Deep-link icon only where a deep target exists (other CAPAs in a follow-up chain) — most CAPA activity is on this page already, so deep-link is mostly a no-op here; add only where it would actually navigate |
| 4. Cross-source coverage | ⚠ partial | Single source — `activity_events` only. Spec §11 has `notifications` (CAPA-related: `capa_overdue`, `capa_escalated`) keyed via `capa_id`. The investigation timeline merge in 6c set the precedent. | Add a parallel fetch of `notifications.eq("capa_id", capa.id)`, merge in TS, sort by `created_at`. Add VERB_LABELS for `notification.capa_overdue` / `notification.capa_escalated`. **2-source merge, not 4** — CAPA doesn't have direct comments and document linkage is shown in its own card, not as timeline events. |
| 6. A11y | ⚠ | Avatar fallbacks use initials; verb text reads naturally. Once deep-link icon is added (where applicable), it's the focus target. Otherwise rows are non-interactive (fine). | None beyond the deep-link addition |
| 8. Copy | ✓ ok | VERB_LABELS map currently covers existing CAPA verbs | Add 2 new entries for the notification verbs |

### Cross-section small gaps

- **Source link** — already shows where the CAPA came from (`Stand-alone` / `Investigation IN-XXXX → Incident I-XXXX`). ✓
- **Modal pattern** — `?action=reassign-verifier` aligns with 6c's URL-driven modal pattern. ✓
- **Owner-cannot-verify** — form is hidden when viewer = owner. **Decision locked: keep hidden, do NOT switch to disabled-with-tooltip.** Rationale: the tooltip would just say "you can't verify your own CAPA"; we already enforce at 3 layers (UI hide / Server Action reject / DB CHECK constraint); and the OwnerVerifierCard already surfaces "Verifier: <other-user-name>" so the owner can see who to ask. Hiding is cleaner.
- **Follow-up banner** — when this CAPA was created from a partial-effective parent, the page shows a pink banner at the top linking to the parent. That's the *receiving* end of the partial-effective chain. The *sending* end (parent CAPA after a partial-effective verification) shows a banner linking to the spawned follow-up. Both surfaces are wired; no fix needed.

---

## 3. Definition of done

Smoke-test pass (re-running `docs/smoke-test-phase2.md` CAPA section + 6d-specific additions):

1. `/capa` list renders with KPI strip + 6 tabs + table; tab strip has `role=tablist` + `aria-current="page"`; per-tab empty copy fires when the tab has zero rows; "Module 3" eyebrow gone.
2. `loading.tsx` + `error.tsx` ship at both routes; error boundary's "Try again" resets the page; "Back to CAPAs" link works.
3. Site filter chip (`?site=all|<uuid>`) and Owner filter chip (`?owner=me|unassigned|<uuid>`) round-trip via URL; chips have `aria-pressed`.
4. `/capa/[id]` renders 60/40 layout; back link works; status pill flips on auto-promotion.
5. **Progress slider auto-promotion fires `toast.success("CAPA started")`** when slider moves from 0 on `status='created'`. Server Action returns `{ ok: true, promoted: true }` and the toast key reads off it.
6. `not_effective` outcome → required rejection reason gates submit; toast on save fail; retry button surfaces on simulated save fail (mirrors 6c).
7. **Partial-effective verification shows a pre-submit info card** explaining the follow-up auto-spawn before the verifier can submit.
8. Reassign-verifier modal uses secondary-button tier styling; logs `activity_events` with `{from, to}`; cannot pick the owner; surfaces RPC errors inline.
9. Activity timeline shows 2-source merge (`activity_events` + `notifications`); per-day grouping; deep-link icon where target differs from current page.
10. Verification radio group has `aria-describedby` linking each outcome's consequence text; reassign select has `aria-required="true"`.
11. PR description: before/after screenshots for the list (KPI + tabs + per-tab empty), detail (60/40 with progress toast + partial-effective info card), and timeline (2-source merge with grouped days).

---

## Open questions (resolve before opening the PR)

1. **Owner-cannot-verify: hide vs. disable-with-tooltip.** Re-audit shipped pattern: the verification form is hidden entirely when viewer = owner. Original 06d stub said "disabled with tooltip", which would force a flicker of the form's shell. Recommend: **keep hidden** (current behaviour). Confirm.
2. **Progress auto-promotion toast — Server Action shape.** To know whether to fire the toast, the action needs to return whether the promotion fired (it could read prior + new status from the RPC return). Plan: extend `updateCapaProgress` action result to `{ ok: true, promoted: boolean }` and key the toast off it. Confirm shape.
3. **Partial-effective pre-submit: info card vs. confirm modal.** Recommend: **inline info card** above the submit button (lighter touch, no modal interruption). Alternative: shadcn `<AlertDialog>` confirm before the action fires ("This will create a follow-up CAPA. Continue?"). Inline card is less interruptive but easier to miss; modal is more explicit but adds a click. **Recommend inline card.** Confirm.
4. **Site + Owner filter chips.** Recommend adding both; defer Verifier / Due-window / Source filters per the per-row analysis above. Confirm scope.
5. **Activity timeline — include `severity_overrides`?** The CAPA isn't directly affected by severity overrides (those live on incidents). Recommend: **don't merge `severity_overrides` into the CAPA timeline** — they belong to the incident timeline. Investigation timeline (6c) doesn't merge them either.
6. **Per-row deep-link icon on the timeline.** For most CAPA verbs the target IS this page (`capa.created` / `capa.completed` / `capa.verified`), so a deep-link is a no-op. Surface the icon **only** when the verb references a different entity (e.g. `notification.capa_overdue` deep-linking to the notification's HSE record if applicable). Recommend: per-verb dispatch map; default = no icon. Confirm.
7. **Retry button on progress save-fail.** 6c added retry on 5-Why and Findings. Mirror here? Recommend: **yes**, same pattern (`<button>Retry</button>` next to the SaveIndicator). Confirm.
8. **Reassign select aria-required.** Defensive a11y addition; recommend: yes. Confirm.

---

## Out of scope (logged in SPEC §15 if confirmed)

- Bulk close-verified on the list (rare path; per-row Mark verified exists)
- Verifier filter on the list (low click-through value vs. footprint)
- Due-window filter on the list (Overdue tab covers the urgent case)
- Source filter on the list (low value)
- Pre-submit full-form preview for the partial-effective follow-up CAPA (info card is the compromise; full form would re-implement the create flow)
- 4-source timeline merge à la 6c (CAPA only has 2 plausible sources)
- Reopening verified-and-closed CAPAs (terminal state by design; create a fresh CAPA from the source incident if needed)
- Drag-and-drop reorder of CAPA cards (no Kanban view at the CAPA level)
- Comment thread on CAPAs (no comment table; v2 if business asks)
