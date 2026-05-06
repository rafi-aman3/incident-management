# Phase 6d — CAPA polish

**Status:** drafted 2026-05-06 (Phase 6 module 4 of 10)
**Goal:** CAPA is the spot regulators look at first. Owner-cannot-verify must be visually obvious, the 4-outcome verification flow must lead the user gently, and the partial-effective auto-spawn-follow-up must NOT surprise anyone — it should be predicted on screen before the action is taken.
**Branch:** `feat/phase-6-capa-polish`
**PR target:** `main`
**Pages covered:** `/capa`, `/capa/[id]`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist.
> - Visible owner≠verifier guard at every render (button disabled state + tooltip explaining why).
> - 4-outcome verification flow polish: each outcome shows its consequence before submit.
> - Progress slider auto-promotes `created → in_progress` cleanly (no silent transitions; user sees the status pill flip).
> - URL-driven create modal: works from `/capa?action=create` AND `/investigations/[id]?action=create-capa`. State preserved across refresh.

> **Not in this PR:**
> - No new verification outcome (4 are locked).
> - No new verification method (5 are locked: inspection / monitoring / audit_trend / re_interview / document_review).
> - No new CAPA status. Owner-cannot-verify is enforced at 3 layers and stays.

---

## Pages

### 1. `/capa` (list + KPI strip + 6 tabs)
KPI strip on top (overdue / awaiting verification / partially-effective chain / closed-effective / etc.), then tab list filtering by status: All · Created · In progress · Awaiting verification · Verified · Reopened (or whatever the 6 tabs are).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | KPI cards: numeric large; sublabel small; trend indicator if applicable | |
| 2. Empty state | TBD | Each tab empty: short helper + suggested next action | |
| 3. Loading state | TBD | KPI strip skeleton + table skeleton independently — KPIs can hydrate first | |
| 4. Error state | TBD | If KPI query fails, that one card shows "—" not blank | |
| 5. Responsive | TBD | sm: KPI strip wraps; tabs scroll horizontally | |
| 6. A11y / keyboard | TBD | Tab list: arrow-key navigation per WAI-ARIA | |
| 7. Form-error UX | n/a | List page | |
| 8. Copy | TBD | "Awaiting verification" copy must explain the perm: "Owner can't verify their own CAPA — needs an independent verifier" | |
| 9. Dark mode | TBD | KPI numbers use brand purple in light, dark-mode variant in dark | |
| 10. Cache Components | TBD | KPIs per-org cached with revalidate-on-write; per-row reads dynamic | |

**Likely small gaps:**
- "Create CAPA" button → opens URL-driven modal (`?action=create`).
- Filter chips (site / owner / verifier / due-window / source).
- Sort: due-date asc default for "In progress" tab; verified-date desc for "Verified" tab.
- Bulk close-verified — probably v2.
- Sandbox affordance — same toggle as incidents list (visible to admins only).

### 2. `/capa/[id]` (60/40 layout)
Left 60%: progress + activity timeline. Right 40%: details (owner, verifier, source, due-date, evidence, references). Owner controls progress slider; verifier controls verification action; everyone with `capa:read` sees the page but actions are perm-gated.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | 60/40 layout per ui-flow.md; status pill top-right; due-date red if overdue | |
| 2. Empty state | TBD | "No evidence yet" / "No references yet" — short subtle | |
| 3. Loading state | TBD | Skeleton mirrors layout | |
| 4. Error state | TBD | Verification action error → toast + revert | |
| 5. Responsive | TBD | sm: stack 60/40 vertically | |
| 6. A11y / keyboard | TBD | Progress slider keyboard-operable (arrow keys ±5); verification radio group reachable | |
| 7. Form-error UX | TBD | Verify action returns errors per the standard shape | |
| 8. Copy | TBD | Verification outcomes — each has a 1-line consequence preview before submit | |
| 9. Dark mode | TBD | Status pill colors | |
| 10. Cache Components | TBD | Per-CAPA cache with revalidate-on-write | |

**Likely small gaps:**

- **Owner≠verifier UX:** when the viewer IS the owner AND the CAPA is awaiting verification, the verification button must be disabled with a tooltip: "You can't verify your own CAPA — assign a different verifier." Don't just hide the button.
- **Reassign verifier** — modal: search-and-select another user with `capa:verify` perm; confirms the swap; logs `activity_event`.
- **Progress slider** — auto-promotes `created → in_progress` on first slide; show toast: "Status moved to In progress".
- **"Mark complete"** — confirm modal: "This will move to Awaiting verification. Verifier <name> will be notified."
- **4-outcome verification panel:**
  - Effective → closes the CAPA.
  - Partially effective → closes this CAPA + auto-spawns a follow-up CAPA via `follow_up_capa_id`. **Show the follow-up's draft form on screen BEFORE submit**, so the user knows what's about to be created.
  - Not effective → reopens; assigns back to owner.
  - Too early to verify → defers; sets next-check date.
- **Verification method dropdown** — enums labeled clearly; tooltip on each method.
- **Evidence & references card** — DocumentLinkPicker mounted (per Phase 4 reuse).
- **Activity timeline** — same merging pattern as investigations: cross-source events.
- **Source link** — shows where this CAPA came from (incident / investigation / inspection finding / standalone).

---

## Definition of done — CAPA PR

1. 10-item checklist passes for both pages.
2. Owner-cannot-verify is visible at every render: when viewer = owner AND CAPA awaits verification, verify button is disabled with the tooltip explainer (per `feedback_brand_color.md` precision style).
3. Progress slider auto-promotion is visible (status pill flips, toast confirms).
4. Partial-effective verification shows the follow-up CAPA's pre-filled form BEFORE commit.
5. Reassign-verifier modal logs `activity_event` and notifies new verifier.
6. List page KPIs hydrate independently (no all-or-nothing skeleton).
7. URL-driven create modal works from both `/capa?action=create` and `/investigations/[id]?action=create-capa`.
8. Smoke-test (`docs/smoke-test-phase2.md` CAPA section) re-runs green.
9. PR description includes before/after screenshots + a screen recording of the 4-outcome verification panel.
