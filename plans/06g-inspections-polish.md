# Phase 6g — Inspections polish

**Status:** drafted 2026-05-06 (Phase 6 module 7 of 10)
**Goal:** Inspections is the **only mobile-first surface** in V1. The runner must work cleanly with one thumb on a 375px screen, photo + signature uploads must tolerate flaky network, the required-fields modal must never trap the user in a loop, and the dual-mode page (runner OR completed report) must pick the right mode based on status + perm.
**Branch:** `feat/phase-6-inspections-polish`
**PR target:** `main`
**Pages covered:** `/inspections`, `/inspections/[id]`, `/inspections/[id]/findings/[findingId]`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist for all 3 pages.
> - **Mobile-first runner audit** at 375 / 414 / 768 viewports.
> - Photo upload UX: capture-from-camera default; preview + delete; offline-tolerance (queue if no network; toast on retry).
> - Signature pad UX: smooth pen tracking; clear/redo; aria-label.
> - Required-fields modal: lists missing items with deep-link tap targets; can dismiss to keep editing.
> - Flagged-items wizard: each flagged answer reviewed → set finding severity + assign → next; back-button works.
> - Finding detail page: Mark Resolved + Escalate-to-Incident flow polished.

> **Not in this PR:**
> - **No GPS/geo-tagging.** Deferred to v2 per `IMS_PLANNING.md` §15.5.4.
> - **No offline-first PWA.** Online-with-tolerance only; full offline mode is v2.
> - **No native app.** Web only, mobile-responsive.
> - **No live multi-inspector.** Single user per inspection.

---

## Pages

### 1. `/inspections` (list)
Filter by status (scheduled / in_progress / completed / abandoned) + site. URL-driven Start picker (`?action=start`).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card list per inspection; status pill; due-date if scheduled | |
| 2. Empty state | TBD | Empty status filter: "No <status> inspections" + "Start an inspection" CTA → `?action=start` | |
| 3. Loading state | TBD | Skeleton cards | |
| 4. Error state | TBD | Start picker: no assigned templates → "No inspections assigned to you. Ask an admin to assign one." | |
| 5. Responsive | TBD | sm: cards stack; filter chips scroll horizontally | |
| 6. A11y / keyboard | TBD | Card click + actions reachable | |
| 7. Form-error UX | TBD | Start picker form errors per standard shape | |
| 8. Copy | TBD | "Start" vs. "Resume" — distinct based on status | |
| 9. Dark mode | TBD | Status pill dark mode | |
| 10. Cache Components | TBD | Per-site list cached; per-inspection state dynamic | |

**Likely small gaps:**
- Card body: template name, version, site, due-date, owner avatar.
- Resume affordance for `in_progress` inspections (deep-link to runner mid-flow).
- Sort: due-date asc default for scheduled; completed-date desc for completed.
- "Start unscheduled inspection" — pick template + site; create inspection on demand.

### 2. `/inspections/[id]` (dual-mode: runner OR completed report)
**Mode A — Runner (status=in_progress, viewer has runner perm):** mobile-first vertical scroll; per-item answer card; bottom-sticky progress bar; complete button.
**Mode B — Completed report (status=completed/abandoned, viewer has reader perm):** desktop-friendly read-only summary with photos, signature blocks, findings panel.

**Per-mode audit:**

#### Mode A — Runner
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Item cards per type (question / text / datetime / signature / media); answer chips for answer_sets | |
| 2. Empty state | TBD | "Inspection has no items" — shouldn't happen but degrade gracefully | |
| 3. Loading state | TBD | First load skeleton; autosave indicator | |
| 4. Error state | TBD | Photo upload failure: queued retry; toast non-blocking | |
| 5. Responsive | TBD | **Primary mobile-first surface — verify 375px works one-thumb** | |
| 6. A11y / keyboard | TBD | Each item card focusable; answer chip group keyboard-operable; signature pad has fallback | |
| 7. Form-error UX | TBD | Required-fields modal: list missing → tap-to-deep-link; flagged-items wizard | |
| 8. Copy | TBD | "Mark complete" — sticks at bottom; explainer modal: "<X> required items missing" before submit | |
| 9. Dark mode | TBD | Runner dark mode; high-contrast for outdoor sun visibility? Note: dark mode but outdoor-safe contrast required | |
| 10. Cache Components | TBD | Runner is fully dynamic | |

**Likely small gaps:**
- Tap-target sizes ≥ 44px per `docs/design.md` §8.
- Section headers sticky-on-scroll showing current section.
- Per-item answer chips: large enough; not crowded.
- Photo capture: camera default on mobile; library picker on desktop.
- Photo preview: tap to enlarge; delete X corner.
- Signature pad: clear button; redo button; works with finger + stylus + mouse.
- Datetime: native picker on mobile.
- Information items render as visible info card (not interactive).
- Unsupported-type placeholder: yellow card same as builder.
- Progress bar: % complete + current section.
- Network indicator: "Saving…" / "Offline — queued" / "Saved".
- "Save & exit" — preserves state for later resume.
- Required-fields modal: after Mark Complete tap → lists missing → "Go to first missing" deep-link.
- Flagged-items wizard: after required check passes → enter wizard for each `failed`-answer item; set finding severity + assign per item; "Skip" allowed (auto-creates open finding).
- Complete RPC fires once; idempotent.

#### Mode B — Completed report
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Read-only summary; photo gallery; signature blocks; findings list | |
| 2. Empty state | TBD | Inspection completed with 0 findings: "All clear" success card | |
| 6. A11y / keyboard | TBD | Findings list keyboard-navigable; photo gallery has captions | |
| 8. Copy | TBD | "Completed by <name> at <time>" header | |
| 9. Dark mode | TBD | Photo gallery in dark mode | |

**Likely small gaps:**
- Print-friendly view (or "Download PDF" — defer to v2 if not shipped).
- Findings panel: deep-link to each finding's detail page.
- "Re-run inspection" button — creates a new in_progress against the same template version.
- Audit trail: who started / completed / abandoned + timestamps.
- Template version pill: "Run against v1.2"; deep-link to that frozen version.

### 3. `/inspections/[id]/findings/[findingId]` (finding detail)
Read-only finding metadata + Mark Resolved + Escalate-to-Incident.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Severity badge, source-item snippet, photo + note from runner | |
| 2. Empty state | n/a | | |
| 4. Error state | TBD | Already-resolved finding: button shows "Resolved <when> by <who>" pill | |
| 6. A11y / keyboard | TBD | Action buttons reachable; confirmation modal traps focus | |
| 7. Form-error UX | TBD | Escalate action: pre-fills `/incidents/new/1?from=finding&id=...` | |
| 8. Copy | TBD | "Escalate to incident" tooltip: "Creates a draft incident pre-filled from this finding" | |

**Likely small gaps:**
- Resolution note required on Mark Resolved? Strong recommend yes.
- Escalation note carried to incident description.
- Activity log on the finding (cross-source events).
- Linked CAPA — if a CAPA was opened from this finding, surface it.

---

## Definition of done — Inspections PR

1. 10-item checklist passes for all 3 pages.
2. Runner is one-thumb operable on 375px (manual verification: hold phone, scroll through full template, complete).
3. Photo upload tolerates network drop (verified: airplane-mode toggle mid-upload).
4. Signature pad smooth on touch + stylus + mouse.
5. Required-fields modal lists missing items with deep-link tap targets; can dismiss without losing state.
6. Flagged-items wizard: each item reviewed → finding severity + assign; back-button preserves state.
7. Mode A vs. Mode B: status+perm picks the right mode; never wrong-mode displayed.
8. Finding → Escalate pre-fills Wizard Step 1 correctly (verified e2e).
9. Smoke-test (`docs/smoke-test-phase3.md` inspection section) re-runs green.
10. PR description includes:
    - 30s screen recording of runner on 375px viewport.
    - Network-drop demo: airplane-mode mid-upload → recovery.
    - Before/after for any visual swap.
