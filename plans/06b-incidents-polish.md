# Phase 6b — Incidents polish

**Status:** drafted 2026-05-06 (Phase 6 module 2 of 10)
**Goal:** The incident capture flow is V1's marquee feature — Report Wizard is what's demoed first. Every step lands cleanly, draft state survives a refresh, the regulatory clock fires at exactly the right moment, and the detail page surfaces every linked artifact (witnesses, attachments, asset, severity overrides, regulatory banner) without clutter.
**Branch:** `feat/phase-6-incidents-polish`
**PR target:** `main`
**Pages covered:** `/incidents`, `/incidents/new/[step]`, `/incidents/[id]`

> **What this PR ships:**
> - Audit + fixes per the 10-item shared checklist for all three pages.
> - Hardened Report Wizard step transitions (no state loss; no double-finalize; no stale draft surfacing).
> - Polished severity-override modal + reason audit display.
> - Cleaner regulatory-banner copy where vague.
> - List-page filter + saved-view affordances if missing.
> - Smoke-test re-run (`docs/smoke-test-phase2.md` — incident-creation steps).

> **Not in this PR:**
> - No new incident type. The 8 types are locked.
> - No new severity matrix dimensions. 5×5 is locked.
> - No new track. A/B/C is locked.
> - No new fields on `incidents` (sparse-column model is locked for v1).

---

## Pages

### 1. `/incidents` (list)
The triage view. Filterable by site / type / severity / status / track / date / sandbox-toggle. Column set covers the columns a triager actually sorts by.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Severity color in left rail (S1 red → S5 grey) per `docs/design.md` §2 | |
| 2. Empty state | TBD | Org-fresh: card with "Report your first incident" CTA → `/incidents/new/1` | |
| 3. Loading state | TBD | Skeleton row count matches typical | |
| 4. Error state | TBD | RLS denial vs. server error — distinct messages | |
| 5. Responsive | TBD | sm: collapse to severity-card list (`docs/design.md` §6.3) | |
| 6. A11y / keyboard | TBD | Row-click and "View" button both reachable; row-click announces incident ID | |
| 7. Form-error UX | n/a | List page — filter URL doesn't error | |
| 8. Copy | TBD | "Report incident" button label vs. "New incident" — pick one and use it everywhere | |
| 9. Dark mode | TBD | Severity tokens dark-mode | |
| 10. Cache Components | TBD | List query is per-site + RLS-bound; cannot cache cross-user. Use dynamic. | |

**Likely small gaps:**
- Filter chips persist in URL? If user shares the URL, recipient lands on same view?
- Sort: by `occurred_at` desc default? Stable secondary sort?
- Sandbox toggle — visible only to users with `site:configure`? Default: off.
- "Bulk actions" — present (e.g., bulk-close)? If not, log as v2.
- Soft-deleted incidents — never appear regardless of filter (per locked rule).

### 2. `/incidents/new/[step]` (3-step Report Wizard)
The 3-step wizard with draft-row + per-step server actions. **The regulatory clock starts on Step 3 finalize, not Step 1 save.** State must survive refresh between steps.

**Per-step audit:**

#### Step 1 — What happened
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Type cards (8 types) use icons from design system | |
| 2. Empty state | n/a | | |
| 3. Loading state | TBD | First load creates the draft row — show "Setting up your report…" if slow? | |
| 4. Error state | TBD | If draft row creation fails, user lands where? | |
| 5. Responsive | TBD | 8-card grid → 2-col on sm | |
| 6. A11y / keyboard | TBD | Type-card keyboard: arrow keys between cards; Enter selects | |
| 7. Form-error UX | TBD | "When did it happen?" — past-only validation; future date rejected with field error | |
| 8. Copy | TBD | "Continue" button vs. "Save & continue" — clarify draft is auto-saved | |
| 9. Dark mode | TBD | | |
| 10. Cache Components | TBD | Wizard pages NEVER cached (per-user draft state) | |

**Likely small gaps:**
- Body map — keyboard navigable? aria-label on each region?
- Asset typeahead — debounced? Empty-result helper "Don't see your asset? Add it" → `/resources/assets/new`?
- Equipment-asset pin only appears for property_damage / unsafe_condition / dangerous_occurrence types — confirm conditional render.

#### Step 2 — Who and what
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Injured-person sub-form repeats; clear "Add another" affordance | |
| 6. A11y / keyboard | TBD | Witnesses block: add/remove maintains focus | |
| 7. Form-error UX | TBD | At-least-one-injured for injury type; at-least-one-witness optional | |
| 8. Copy | TBD | "Witness" vs "Witness statement" — wording consistent with §6.10 | |

**Likely small gaps:**
- DocumentLinkPicker — does the modal trap focus? Library tab vs. Upload tab — initial tab matches "most-likely user intent" (Library if any docs exist, else Upload).
- Witness statement carryover into investigation — surfaced on Step 2 with "These statements will be available to the investigator"?

#### Step 3 — Review and finalize
| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Read-only summary card; severity-matrix preview uses 5×5 component | |
| 4. Error state | TBD | Finalize action returns 4 distinct error states: validation / RLS / engine error / network. Each renders its own copy. | |
| 7. Form-error UX | TBD | Submit is single-press — disable on first click; idempotent server action | |
| 8. Copy | TBD | "Finalize report" — explicit; explainer below: "This starts the regulatory clock and notifies <N> people" | |

**Likely small gaps:**
- Severity-engine result preview — does Step 3 show the *predicted* severity + track? Helpful to set expectations.
- Notification preview — "Filing this will notify: <name>, <name>" — preview the planned notifications before commit.
- "Save & exit" — preserves draft; reachable via top-bar; does NOT finalize.

### 3. `/incidents/[id]` (detail)
Read-only-ish detail with severity badge, regulatory banner, linked-asset card, attachments, witnesses, severity-override history, OSHA 301 sticky banner (when due), action menu (Investigate / Override severity / Reroute track / Reopen / View report).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Severity badge + status badge top-right; regulatory banner top per `docs/design.md` §6.6 | |
| 2. Empty state | TBD | "No witnesses" / "No attachments" / "No overrides yet" — single-line subtle, not blank | |
| 3. Loading state | TBD | Skeleton matches the multi-card layout | |
| 4. Error state | TBD | Soft-deleted incidents — page shows "This incident was deleted" not 404 | |
| 5. Responsive | TBD | sm: collapse 60/40 to single column | |
| 6. A11y / keyboard | TBD | Severity-override modal traps focus; reason field required + announced | |
| 7. Form-error UX | TBD | Override action returns errors per the standard shape | |
| 8. Copy | TBD | "Reopen" — explainer: this restarts what part of the workflow? | |
| 9. Dark mode | TBD | Severity badge + reg banner | |
| 10. Cache Components | TBD | Per-incident page; cache by incident id with revalidate-on-write | |

**Likely small gaps:**
- OSHA 301 sticky banner — appears only when type=injury AND finalized AND OSHA-recordable; persists until report submitted; copy should explain the 8h/24h/7d clock relevant to this case.
- Linked-asset card — clicking jumps to `/resources/assets/[id]` with the incident as breadcrumb? Or just modal-preview?
- Severity override audit — shows previous → new + reason + by-whom + at-when, in reverse chrono.
- Activity timeline — present? Right rail or bottom? Does it merge `activity_events` rows across incident / investigation / capa / notification?
- "View OSHA 301 report" / "View RIDDOR F2508 report" — only render if the right regulator applies (US site → OSHA, GB site → RIDDOR).

---

## Definition of done — Incidents PR

1. 10-item checklist passes for all three pages.
2. Wizard refresh-survives at every step (kill the tab on Step 2, reopen, land on Step 2 with state intact).
3. Wizard finalize is idempotent (double-click → one report, not two).
4. Detail page surfaces every linked artifact (asset, attachments, library docs, witnesses, overrides, OSHA 301 banner where applicable) with consistent card style.
5. List page is filterable + URL-shareable.
6. Severity-override modal is keyboard-only operable.
7. Soft-deleted incident routes to a "deleted" notice, not a 404 or RLS error.
8. Smoke-test (`docs/smoke-test-phase2.md` capture section) re-runs green.
9. PR description includes before/after screenshots for any visual swap.
