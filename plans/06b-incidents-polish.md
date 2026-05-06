# Phase 6b — Incidents polish

**Status:** drafted 2026-05-06 (Phase 6 module 2 of 10) · audit refreshed 2026-05-07 against shipped code
**Goal:** The incident capture flow is V1's marquee feature — Report Wizard is what's demoed first. Every step lands cleanly, draft state survives a refresh, the regulatory clock fires at exactly the right moment, and the detail page surfaces every linked artifact (witnesses, attachments, asset, severity overrides) without clutter.
**Branch:** `feat/phase-6-incidents-polish`
**PR target:** `main`
**Pages covered:** `/incidents`, `/incidents/new/[step]`, `/incidents/[id]`

> **What this PR ships:**
> - Audit fixes per the 10-item checklist for all three pages (filled in below from a real code audit, not TBDs).
> - Hardened wizard transitions: future-date validation, **save-and-exit** affordance on Step 3, finalize-button copy + explainer, notification-recipient preview.
> - Detail-page Suspense boundaries for each card section + parallelized queries.
> - Soft-deleted-incident routes to a "deleted notice" card, not a 404.
> - Severity-override audit history (full reverse-chrono list, not just latest).
> - Sandbox toggle gated by `site:configure`.
> - Dark-mode token sweep on severity badges + linked-asset card + status badges.
>
> **Not in this PR:**
> - No new incident type. The 8 types are locked.
> - No new severity matrix dimensions. 5×5 is locked.
> - No new tracks. A/B/C is locked.
> - No new fields on `incidents` (sparse-column model is locked for v1).
> - No new schema, no new RPCs, no new perm keys (consistent with `plans/06-frontend-polish.md`).
> - **OSHA 301 sticky banner stays on `/investigations/[id]` only** (where it shipped in Phase 2). Surfacing it on the incident detail page would duplicate the cue — incident detail already shows finalized state and the regulatory clock. Logged as a v2 consideration if stakeholders ask for it.

---

## Audit summary (from real code, 2026-05-07)

**15 gaps total — 3 broken, 12 minor.** Concrete findings below; tiering at the end.

### 1. `/incidents` (list) — `app/(app)/incidents/page.tsx`

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ Pass | Severity tokens via `bg-sev-*` (`badges.tsx:4–9`) | — |
| 2 | Empty state | ✅ Pass | Card with "Report your first incident" CTA (`page.tsx:78–91`) | — |
| 3 | Loading state | ❌ Broken | No Suspense; sequential `await` blocks render (`page.tsx:51`) | Wrap table in `<Suspense fallback={<TableSkeleton/>}>` |
| 4 | Error state | ⚠️ Gap | Raw `error.message` shown (`page.tsx:75`); RLS vs network indistinguishable | Branded error card; map `PGRST*` codes to "Access denied" copy |
| 5 | Responsive (sm) | ❌ Broken | Table only wraps `overflow-x-auto`; no card-list collapse on sm | `md:table-cell` on detail columns + `md:hidden` vertical card list |
| 6 | A11y / keyboard | ✅ Pass | `aria-pressed` on filter chips (`page.tsx:217–228`); rows are `<TableRow>` links | — |
| 7 | Form-error UX | n/a | URL-driven filters | — |
| 8 | Copy | ⚠️ Gap | "Report incident" (top), "Save override" (modal), "Submit incident" (wizard) — verb tense inconsistent | Standardize: top "Report incident" → wizard "Finalize report" → modal "Override severity" |
| 9 | Dark mode | ⚠️ Gap | StatusBadge raw `dark:bg-amber-950` (`badges.tsx:68`); S1–S5 use `text-white` without dark variant | Replace raw colors with tokens; add `dark:` overrides on sev-* |
| 10 | Cache Components | ✅ Pass | Per-site RLS-bound; correctly dynamic | — |

**Specific calls:** Filter chips URL-driven ✅. Default sort `occurred_at desc` ✅. Soft-deleted excluded via `.is("deleted_at", null)` ✅. **Sandbox toggle visible to all users — should gate by `can("site:configure")`.**

### 2. `/incidents/new/[step]` (3-step Wizard)

#### Step 1 — `components/incidents/wizard/step-1-what-happened.tsx`

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1, 5, 8, 9 | All | ✅ Pass | Type-card grid 2-col → 4-col (`step-1:43`); tokens used; copy clear | — |
| 6 | A11y / keyboard | ❌ Broken | Type cards are `<button aria-pressed>` but **no arrow-key nav** between them | Add `onKeyDown` cycling through 8-card array; Enter selects |
| 7 | Form-error UX | ⚠️ Gap | **Future-date validation missing** — user can pick tomorrow as `occurred_at` | Zod `.refine((v) => new Date(v) <= new Date(), "Cannot report future events")` |

**Specific calls:** AssetTypeaheadField correctly conditional on `property_damage`/`unsafe_condition`/`dangerous_occurrence` (`step-2:114–115`) ✅.

#### Step 2 — `components/incidents/wizard/step-2-details.tsx`

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1, 3, 5, 9 | All | ✅ Pass | Injured-person repeats; risk matrix; tokens | — |
| 6 | A11y / keyboard | ⚠️ Gap | BodyMap has `role="group"` but no arrow-key nav between regions; Tab traverses all 16 buttons (`body-map.tsx:43+`) | Add arrow-key handler mapping column/row indices |
| 8 | Copy | ⚠️ Gap | Witnesses block at `step-2:409` has no helper "Statements will be available to the assigned investigator" | Add helper text under the block heading |

#### Step 3 — `components/incidents/wizard/step-3-review.tsx`

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1, 3, 4, 9 | All | ✅ Pass | Severity + track preview correct; no exception leak | — |
| 7 | Form-error UX | ✅ Pass | `disabled={isPending}` (`step-3:133`) + idempotent server action | — |
| 8 | Copy | ⚠️ Gap | Submit reads "Submit incident"; no explainer of what finalize means | "Finalize report" + helper "Starts the regulatory clock and notifies <N> people" |
| n/a | UX gap | ❌ Broken | **No save-and-exit affordance.** Footer has only `← Back` + Submit (`step-3:124–138`); user can't escape draft mode without finalizing or backtracking | Add `Save draft & exit` link → `/incidents` (draft already persisted) |
| n/a | UX gap | ⚠️ Gap | Notification preview missing — Step 3 explainer should list "Filing will notify: [names]" before submit | Pass `notificationRecipients: string[]` from server; render under "What the system will do" (`step-3:91–118`) |

### 3. `/incidents/[id]` (detail) — `app/(app)/incidents/[id]/page.tsx`

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1, 5, 7 | All | ✅ Pass | Severity + status + track badges; lg→sm collapse works; override-modal returns `{ ok }` cleanly | — |
| 2 | Empty state | ✅ Pass | Witnesses + attachments sections render only when populated | — |
| 3 | Loading state | ❌ Broken | Sequential `await` for incident + overrides + witnesses + attachments + linked-asset (`detail:19–75`) | `Promise.all()` + Suspense around aside cards |
| 4 | Error state | ⚠️ Gap | Soft-deleted hits 404 — no "deleted notice" card | If `error?.code === "PGRST116"` → "Access denied"; if no row but `deleted_at IS NOT NULL` lookup → "This incident was deleted by an admin" |
| 6 | A11y / keyboard | ⚠️ Gap | Severity-override modal (`triage-modals.tsx:105–148`) — verify Radix `Dialog` traps focus + ESC closes | Audit + add tests via keyboard walkthrough |
| 8 | Copy | ⚠️ Gap | Latest override shown (`detail:54–59`); full audit trail hidden | Render full reverse-chrono list (collapsible past 3 entries) |
| 9 | Dark mode | ⚠️ Gap | Linked-asset card `bg-muted/30` (`detail:187`) + severity badge raw `text-white` | Replace with `dark:`-aware tokens |
| 10 | Cache Components | ✅ Pass | Server component, RLS-bound per incident | — |

**Specific calls:** Linked-asset card jumps to `/resources/assets/[id]` ✅. **OSHA 301 banner — by design lives on `/investigations/[id]` only; not duplicated here.**

---

## Cross-cutting findings

- **`text-white` literals** in `badges.tsx:5–9` and `wizard/wizard-progress.tsx:21` need dark-mode variants.
- **No Suspense boundaries** on list + detail pages — fix together with parallelized queries.
- **Copy verb-tense inconsistency** — "Report" / "Submit" / "Save" all used for the same act. Standardize across the three pages.
- **Sandbox toggle** on the list page should gate by `can("site:configure")` — not a new perm, just a missing check.

---

## Proposed scope (please confirm before I execute)

**Tier A — must fix (the polish bar)**: 1, 2, 3, 4, 5, 6, 7
**Tier B — nice to have**: 8, 9
**Tier C — judgment call (flag here, decide before I touch)**: 10

| # | Fix | Tier | Est. effort |
|---|---|---|---|
| 1 | Wizard Step 3 **save-and-exit** + finalize copy + explainer | A | M |
| 2 | Wizard Step 1 **future-date validation** | A | S |
| 3 | List + Detail Suspense boundaries + parallelized detail queries | A | M |
| 4 | Soft-deleted incident → "deleted notice" card (not 404) | A | S |
| 5 | Sandbox toggle gated by `site:configure` | A | S |
| 6 | Severity-override **full audit history** on detail | A | S |
| 7 | Copy standardization across the 3 surfaces ("Report incident" / "Finalize report" / "Override severity") | A | S |
| 8 | Dark-mode token sweep on `badges.tsx` + linked-asset card + StatusBadge raw colors | B | S |
| 9 | List page sm-breakpoint card-list collapse | B | M |
| 10 | Type-card + BodyMap arrow-key nav + Step-3 notification preview + Witness carryover helper | C | M-L |

**Why C is a judgment call:** Arrow-key nav across the 8 type cards is real polish but is the kind of thing every keyboard-only user benefits from once and a pointer user never notices — easy to defer if scope is tight. Same with the "Filing will notify: [names]" preview — useful but requires a server-side recipient lookup that doesn't exist yet (would need a new helper in `lib/workflow/notifications.ts` that returns a recipient list without dispatching). Witness carryover helper is one line of copy — that's free; pull it into B if you want.

**Recommendation:** Ship **Tier A + B** in this PR (9 items, all small/medium). Defer C unless you specifically want the keyboard-nav polish or the notification preview now. The save-and-exit affordance + soft-deleted notice + suspense are the real demo-facing wins.

---

## Definition of done

1. The chosen tier(s) above are implemented and the audit table updates from ⚠️/❌ to ✅.
2. Wizard refresh-survives at every step (kill the tab on Step 2, reopen, land on Step 2 with state intact).
3. Wizard finalize is idempotent (double-click → one report, not two).
4. Save-and-exit from Step 3 lands on `/incidents` with draft visible (sandbox toggle off).
5. Soft-deleted incident routes to a deleted-notice card, not a 404 / RLS error.
6. List page is filterable + URL-shareable; sandbox toggle hidden for users without `site:configure`.
7. Smoke-test (`docs/smoke-test-phase2.md` capture section) re-runs green.
8. PR description includes before/after screenshots for any visual swap.
