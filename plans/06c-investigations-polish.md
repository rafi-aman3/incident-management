# Phase 6c — Investigations polish

**Status:** drafted 2026-05-06 (Phase 6 module 3 of 10)
**Goal:** The investigation surface owns the longest-dwell screen in the product (a 5-tab detail with a Kanban list view). Every tab carries its own state, every drag posts the right activity_event, every witness statement that came in via the Wizard surfaces in the right place, and the OSHA 301 sticky banner never goes stale.
**Branch:** `feat/phase-6-investigations-polish`
**PR target:** `main`
**Pages covered:** `/investigations`, `/investigations/[id]`

> **What this PR ships:**
> - Audit + fixes per the 10-item shared checklist.
> - Hardened Kanban drag (no ghost cards, idempotent server action on drop).
> - Tab-state preserved in URL (`?tab=summary|five-why|evidence|findings|timeline`).
> - 5-Why chain editor: keyboard-only operable, autosave, undo on accidental delete.
> - Evidence upload: drag-and-drop, mime-type guard, preview thumbnails.
> - Findings tab: status filters; "Escalate to incident" CTA only when `escalation_eligible`.
> - Timeline tab: cross-source events (incident · investigation · capa · notifications).

> **Not in this PR:**
> - No new investigation status (open / in_progress / closed locked).
> - No new RCA method (5-Why is locked; fishbone / fault-tree deferred to v2).
> - No new evidence type beyond photo / doc / video / audio.

---

## Pages

### 1. `/investigations` (Kanban)
3-column board: Open · In progress · Closed. Drag to advance. Filter by site / track / due-date. Card shows incident severity stripe, type, due-date, owner avatar.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card stripe = incident severity color; column headers; drag affordance per `@dnd-kit` defaults | |
| 2. Empty state | TBD | Each column empty: "Nothing in <state> yet" — short helper | |
| 3. Loading state | TBD | Column skeletons (3 placeholder cards each) | |
| 4. Error state | TBD | Drag-drop server action error → revert position + toast | |
| 5. Responsive | TBD | sm: collapse to a single tab-list view (Open / In progress / Closed) | |
| 6. A11y / keyboard | TBD | `@dnd-kit` keyboard sensor: Space picks up, arrows move, Enter drops, Esc cancels. Announce moves via aria-live. | |
| 7. Form-error UX | n/a | | |
| 8. Copy | TBD | Column header copy + due-date label ("Due in 3 days" / "Overdue 2 days") | |
| 9. Dark mode | TBD | Card severity stripe in dark | |
| 10. Cache Components | TBD | Board state is per-org + dynamic | |

**Likely small gaps:**
- Drag-drop transition between Open → Closed should require a CAPA exists (per workflow rule). UI should disable the drop target if rule blocks it, with explainer.
- Filter state in URL (site / track / due-window).
- Card click vs. card drag — both reachable; click-through to detail doesn't fire on accidental drag.
- "Assign me" button on Open cards if owner is null and viewer has `investigation:assign`.
- Overdue cards have a subtle red corner indicator.

### 2. `/investigations/[id]` (5-tab detail)
Tabs: **Summary** · **5-Why** · **Evidence** · **Findings** · **Timeline**. URL state `?tab=...` survives refresh + share. OSHA 301 sticky banner persists across all tabs while applicable.

**Per-tab audit:**

#### Summary tab
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Top: incident link card + severity badge + reg banner; "Investigation" header with status pill | |
| 2. Empty state | TBD | "Investigation just opened — start with the 5-Why tab" | |
| 6. A11y / keyboard | TBD | Tab navigation arrow-key per WAI-ARIA tabs pattern | |
| 8. Copy | TBD | "Status" pill copy (Open / In progress / Closed) — match Kanban | |

**Likely small gaps:**
- Witness statements carried over from Wizard Step 2 — surfaced on Summary OR Evidence? Place per `docs/ui-flow.md`. Confirm the carryover hasn't dropped silently.
- Action bar: "Mark in progress" / "Close investigation" / "Reopen" — disabled per perm + per workflow rule with explainer tooltip.

#### 5-Why tab
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Per `docs/design.md` §6.9 — chain visual; current why highlighted | |
| 2. Empty state | TBD | "Start with the problem statement" — autofocus the first input on first land | |
| 4. Error state | TBD | Autosave failure → toast + retry; never lose what was typed | |
| 6. A11y / keyboard | TBD | Tab between why nodes; Enter adds next why; Backspace on empty deletes | |
| 7. Form-error UX | TBD | Save server-action returns the standard shape; pending state per node | |
| 8. Copy | TBD | "Why?" prompt vs. "Why did this happen?" — pick one and use it | |

**Likely small gaps:**
- Undo last-deleted why (5s toast with Undo).
- Autosave debounce — 1s? Indicator: "Saved 3s ago".
- Limit 5 whys (or allow more)? Per RCA convention, 5 is conventional but not strict. Confirm against `docs/SPEC.md`.
- Branching — single chain in v1; document as "no branching in v1" in §15 if user asks.

#### Evidence tab
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Grid with thumbnails; type icon overlay (photo / doc / video / audio) | |
| 2. Empty state | TBD | "Drop files here or" + Browse + DocumentLinkPicker | |
| 3. Loading state | TBD | Upload progress per file | |
| 4. Error state | TBD | Mime-type rejection inline; oversize rejection with limit | |
| 6. A11y / keyboard | TBD | Drop zone focusable; Browse button keyboard-only operable | |
| 7. Form-error UX | TBD | Per-file error — doesn't kill the batch | |
| 8. Copy | TBD | "Add evidence" (consistent with library DocumentLinkPicker) | |

**Likely small gaps:**
- DocumentLinkPicker → existing library docs link via `document_links`; uploaded-here files go to Storage + create a `documents` row + auto-link.
- Evidence-only-uploaded-here vs. library-linked — visual differentiator.
- Delete evidence — soft-delete with audit; confirm modal.

#### Findings tab
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Finding cards: status pill (open / resolved / escalated), severity inherited from inspection if any | |
| 2. Empty state | TBD | "No findings yet — add one or wait for an inspection to surface one" | |
| 4. Error state | TBD | "Escalate to incident" action → routes to `/incidents/new/1?from=finding&id=...` (Phase 1 pre-fill) | |
| 6. A11y / keyboard | TBD | Card actions reachable | |
| 8. Copy | TBD | "Resolve" vs. "Mark resolved" — pick one | |

**Likely small gaps:**
- Findings sourced from inspections (failed answers) — show inspection link.
- Findings created manually here — separate "+ Add finding" affordance.
- Bulk resolve? Probably v2.

#### Timeline tab
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Vertical timeline; events grouped by day; icon per event kind | |
| 2. Empty state | TBD | "No activity yet" — won't happen often (incident creation is event #1) | |
| 6. A11y / keyboard | TBD | Items focusable; deep-link button on each | |
| 8. Copy | TBD | Event copy: action verb + actor + target (e.g., "Anna assigned this to Boris") | |

**Likely small gaps:**
- Filter chips: which event kinds to show (default: all).
- Cross-source: includes incident events + capa events + notifications + severity overrides? Confirm scope.
- "Notes" — free-form note added by anyone with `investigation:note` perm? If so, audit. If not yet, log as v2.

---

## Definition of done — Investigations PR

1. 10-item checklist passes for both pages.
2. Kanban drag is keyboard-only operable AND screen-reader announces moves.
3. Tab state lives in URL; refresh + share preserves tab.
4. 5-Why autosave never loses input; undo works.
5. Evidence upload tolerates per-file failure; never blocks the batch.
6. Findings → Escalate-to-incident pre-fills the Wizard Step 1 correctly.
7. Timeline merges events from at least 4 sources (incident · investigation · capa · notifications).
8. OSHA 301 sticky banner persists across tabs while applicable; disappears on report submit.
9. Smoke-test (`docs/smoke-test-phase2.md` investigation steps) re-runs green.
10. PR description shows before/after for any visual swap + a 30s screen recording of Kanban keyboard nav.
