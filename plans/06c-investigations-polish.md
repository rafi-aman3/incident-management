# Phase 6c — Investigations polish

**Status:** drafted 2026-05-06 · re-audited 2026-05-07 against shipped surfaces (Phase 6 module 3 of 10)
**Goal:** Tighten the longest-dwell screen in the product. The Kanban + 5-tab detail are already wired to the correct workflow; the gaps are in keyboard a11y on drag, an evidence uploader whose drag-and-drop copy is a lie, a Timeline tab that only joins 2 of the 4 promised event sources, and the small-functional-gap pile (lead/site filter chips, raw amber sandbox literal, "Module 2" subtitle, overloaded "Open" filter).
**Branch:** `feat/phase-6-investigations-polish`
**PR target:** `main`
**Pages covered:** `/investigations`, `/investigations/[id]` (5 tabs)

> **What this PR ships:**
> - 10-item shared checklist applied to both routes; concrete findings + fixes below.
> - Kanban: KeyboardSensor + ARIA live announcements; per-column empty copy; lead + site filters; sandbox-badge token migration; "Open" chip split into Pending / In progress; "Module 2" subtitle dropped (matches 6b).
> - Detail: tab strip gets `aria-current`; sandbox badge migrated; `loading.tsx` + `error.tsx` shipped at the route level; sequential queries parallelized.
> - 5-Why: retry-on-save-fail button per row (autosave is locked at 5 rows; nothing else changes).
> - Evidence: real drag-and-drop wired (current copy promises it but only click works); per-file failure no longer kills the batch; trash button keyboard-reachable + confirm modal; PDF inline thumbnail via signed URL where viewer-supported.
> - Findings: stays a single textarea per spec — plan section corrected to match shipped reality (the prior rewrite mis-described it as cards-with-status-pills; that's the inspection findings model).
> - Timeline: joins CAPA + notification events to fulfill the "4 sources" promise; per-day grouping; deep-link affordance.
>
> **Not in this PR (deferred or n/a):**
> - No new investigation status; state machine is locked (`pending_assignment → in_progress → awaiting_capa → closed`).
> - No fishbone / fault-tree RCA — 5-Why locked for v1.
> - No branching 5-Why (single chain).
> - No new RPCs, no new perm keys, no schema changes.
> - No mobile-specific Kanban layout beyond the existing `sm:grid-cols-2` collapse.

---

## 0. Cross-cutting findings (apply to both routes)

| # | Finding | File(s) | Fix |
|---|---|---|---|
| 0.1 | "Practice" sandbox badge uses raw `bg-amber-100 ... dark:bg-amber-950` literals — Phase 6b migrated all other surfaces to `warning/15 + warning` token pair | `app/(app)/investigations/page.tsx` (n/a — Kanban cards don't show it; only detail does) `app/(app)/investigations/[id]/page.tsx:243` | Replace with token pair; reuse the helper used in 6b |
| 0.2 | "Module 2" / "Module …" eyebrow above page title is internal-speak, dropped on `/incidents` in 6b | `app/(app)/investigations/page.tsx:96` | Drop the eyebrow; lift the title hierarchy to match 6b |
| 0.3 | No `loading.tsx` / `error.tsx` at the route level — page blanks during nav and any thrown error escapes to the global boundary | `app/(app)/investigations/loading.tsx` (missing), `app/(app)/investigations/[id]/loading.tsx` (missing), `app/(app)/investigations/[id]/error.tsx` (missing) | Add skeletons matching post-load layout; wire brand error card with retry |

---

## 1. `/investigations` (Kanban + List view)

3-column-or-4-column board (DB enum is 4 statuses: `pending_assignment / in_progress / awaiting_capa / closed`; the prior plan said 3, which was wrong). Filter chips (severity S1/S2/S3 + status) and a Kanban / List view toggle. List view uses a shadcn Table.

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ⚠ partial | Cards have a grip handle + severity / track badges but no left-edge severity stripe; design.md doesn't strictly require one — keep current treatment. View-toggle uses `bg-primary` correctly. | None (visual treatment locked) |
| 2. Empty state | ⚠ weak | Module-level empty: text-only "No investigations yet" with a 1-line helper, no icon, no CTA. Per-column empty: literal `(empty)`. List-view empty: "No investigations match these filters" — only ever rendered in list view. | Per-column empty: short copy per column (e.g. `pending_assignment` → "Nothing waiting for a lead"). Module empty: keep copy, add a muted icon (`SearchX`) for visual ballast; no CTA — ui-flow §8.9 explicitly says investigations are auto-created on classify, not user-created here. |
| 3. Loading state | ✗ missing | No `loading.tsx`; page blanks on nav | Add skeleton: header bar + 4 column placeholders × 3 cards each |
| 4. Error state | ⚠ weak | `queryError` rendered as bare destructive paragraph at top of page (line 107) | Render via the brand error card; keep retry behaviour to a `Try again` Link refreshing the page |
| 5. Responsive | ✓ ok | `sm:grid-cols-2 xl:grid-cols-4` — at md it's 2 columns; at < sm it stacks | None |
| 6. A11y / keyboard | ✗ broken | `useSensors(useSensor(PointerSensor, …))` — **no KeyboardSensor**. Keyboard users cannot drag. No `aria-live` for moves. FilterChips are `<Link>`s with no `aria-pressed` / `aria-current`. | Add `KeyboardSensor` from `@dnd-kit/core` + `sortableKeyboardCoordinates`; wrap board in `<div role="region" aria-label="Investigation kanban">`; on drag end announce via `<span aria-live="polite" className="sr-only">` ("Moved IN-2025-0001 to In progress"). Filter chips: `aria-pressed={active}`. |
| 7. Form-error UX | n/a | | |
| 8. Copy | ⚠ | Subtitle "Module 2" is internal. Filter chip "Open" matches **both** `pending_assignment` AND `in_progress` — collapses two real states behind one chip. View-toggle labels "Kanban / List" are fine. | Drop "Module 2" eyebrow. Split "Open" → "Pending" + "In progress" (each maps to one DB enum). Refresh column subtitles per `INVESTIGATION_STATUS_META` (current copy is OK, audit each line for wording consistency). |
| 9. Dark mode | ✓ ok | All tokens; no raw hex on this route | None |
| 10. Cache Components | ✓ ok | `searchParams: Promise<...>` awaited; no stale `'use cache'` (page is intentionally uncached) | None |

### Small functional gaps

- ui-flow §8.9 promises **lead, severity, site, date-range** filters; only severity + status are wired. Add **Lead** (multi-select dropdown) and **Site** ("All accessible sites" / specific) chips. Date-range deferred to v2 (low value vs. the `due_date` chip already on every card).
- No "Assign me" CTA on `pending_assignment` cards even though `investigation:lead` perm exists. Add a tertiary ghost button on the card visible when `lead === null && canLead`.
- Filter state isn't preserved when toggling Kanban/List — `buildHref` already merges, so this is just a copy-check; verify with `sev=S2 → click List → back to Kanban` flow.
- Drag from `closed` is silently disallowed (terminal state). Add a subtle `cursor-not-allowed` on `closed`-column cards' grip.

---

## 2. `/investigations/[id]` — 5-tab detail

URL state `?tab=summary|why|evidence|findings|timeline` survives refresh + share. OSHA 301 sticky banner persists across tabs while `osha_recordable && !isClosed` (no submitted-state to gate on — the 301 is a PDF render at `/reports/osha-301/[id]`, not a stateful form, so this is correct).

### Header + banner audit

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Title + status pill + due-date chip; Action cluster (Assign CAPA / Close — no CAPA) gated by perms | None |
| 2. Empty state | n/a (always populated — investigation always has source incident) | | |
| 5. Responsive | ⚠ minor | Top action cluster could collide with title at narrow widths | Wrap with `flex-wrap`; or move actions to a footer bar at sm |
| 6. A11y | ⚠ | "practice" sandbox span has no `aria-label` (just text "practice" — fine); but raw amber tokens (see 0.1) | Token migration |
| 8. Copy | ✓ ok | Action labels are verbs ("Assign CAPA", "Close — no CAPA"). Banner copy is correct (cites §1904.29(b)(3)). | None |

### Per-tab audit

#### Summary tab

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | 2-col grid: snapshot card + witnesses left, team right | None |
| 2. Empty state | ⚠ minor | WitnessStatementsSection empty: "No witness statements yet." — no helper or CTA path explanation | Add helper line: "Statements added at the incident phase carry over here automatically." (already in the section header — copy below the empty list could repeat the path). |
| 6. A11y | ⚠ minor | TeamPanel role badge is purely color-coded ("Lead" pill in `bg-primary/10 text-primary`); add a non-color signal (Crown icon already exists in the header — surface it next to the pill or use the badge) | Add `<Crown />` or text-only "Lead" disambiguator in the role pill |
| Other | ⚠ | Five sequential queries (inv → team → witnesses → site_members) — only the tab-conditional ones are gated. Team + witnesses + site_members are always fetched even for non-summary tabs. | Move team + witnesses fetch into `if (tab === "summary")` block; site_members is needed by modals (kept always). Saves ~3 RTTs per tab nav. |

#### 5-Why tab

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Why-5 highlighted (`bg-primary/5` + ROOT CAUSE badge with Target icon) | None |
| 2. Empty state | n/a | Always 5 seeded rows; placeholder copy covers cold-state | None |
| 4. Error state | ⚠ | Save-fail just prints "Save failed" — no retry; user must edit the field again to retrigger | Add a `Retry` ghost button next to the `SaveIndicator` when `status === "error"` that re-invokes `saveWhy` with the current values |
| 6. A11y | ✓ ok | Each row has `<Label htmlFor>` + `<Input>` + `<Textarea>`; `disabled` mirrors `readOnly`. | None |
| 7. Form-error UX | ⚠ | Field-level errors don't surface — Zod failures only return `result.error` which is a global string in the indicator | Acceptable for autosave (error is rare and recoverable); no fix |
| 8. Copy | ✓ ok | Question placeholder cascades ("Why did this happen?" → "Why did the answer to Why #N-1 happen?") | None |

#### Evidence tab

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ⚠ | Grid is OK; PDFs render as a generic FileText icon — no thumbnail | Out of scope (PDF.js is a heavy dep); keep current FileText fallback. Document as v2 in SPEC §15. |
| 2. Empty state | ✓ ok | "No evidence yet — upload photos, maintenance logs, SDS sheets, or PDF reports." | None |
| 3. Loading | n/a | Upload `busy` state shown on button; per-file progress not surfaced | Acceptable for v1 |
| 4. Error state | ✗ broken | Per-file `throw` aborts entire batch — file 3 of 5 failing kills 4 + 5 (plan promised "per-file error doesn't kill the batch") | Refactor `for` to gather successes + failures; report at end with one toast per outcome bucket. Don't `throw`; track `failed: string[]`. |
| 6. A11y | ✗ broken | (a) "Drag photos or PDFs here" copy with no `onDragOver` / `onDrop` handlers — only click works. (b) Trash button is `opacity-0 group-hover:opacity-100` — keyboard users can't reach it. | (a) Wire `onDragEnter / onDragOver / onDragLeave / onDrop` on the drop zone div; share the `upload(files)` handler. (b) Show trash button by default (no opacity gating), or use `focus-within:opacity-100` so keyboard focus also reveals it. |
| 7. Delete confirm | ✗ missing | Trash icon submits a `<form action={deleteInvestigationEvidence}>` immediately — no confirm. Hard-delete (DELETE FROM + storage.remove). Soft-delete rule applies to incidents/investigations/capas only, so hard-delete is permitted, but a confirm modal is non-negotiable for destructive UI. | Wrap delete in a confirm modal: "Delete <filename>? This removes the file and the metadata. Cannot be undone." |
| 8. Copy | ✓ ok | "Add evidence" / "Library evidence" / "No evidence yet" all consistent | None |

#### Findings tab

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ✓ ok | Card with header + textarea (rows=14) + autosave indicator | None |
| 2. Empty state | ⚠ minor | Empty textarea has placeholder; no separate empty card | Acceptable — placeholder is the empty state |
| 4. Error state | ⚠ | Same as 5-Why — no retry button on save-fail | Add `Retry` button (matches 5-Why pattern) |
| Plan correction | — | Earlier draft of this plan described findings as "cards with status pills + escalate-to-incident CTA". That's the **inspection findings** model (`inspection_findings` table). Investigation findings is a single `text` column on `investigations` per SPEC §5; the textarea is correct. | Plan corrected (this section) — no shipped-code fix needed |

#### Timeline tab

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual | ⚠ | Flat reverse-chrono list; no per-day grouping; no deep-link button per item | Group by `format(date, 'yyyy-MM-dd')` into `<section>`s with day-header. Add a small icon-link on each row that targets the correct deep URL (incident verb → `/incidents/<id>`, investigation verb → current page, capa verb → `/capa/<id>`). |
| 2. Empty state | ⚠ minor | "No activity yet." — won't actually happen (incident.classified is event #1) | Keep but soften: "Nothing has happened yet." |
| 4. Cross-source coverage | ✗ partial | Query is `activity_events.or(investigation_id.eq.X, incident_id.eq.Y)` — captures incident + investigation events but **not CAPA events** (CAPAs link via `capa_id`, not `investigation_id` on activity rows) and **not notifications** (separate table) | Extend the query: (a) lookup `capa.id where capa.investigation_id = inv.id`, then OR `capa_id.in(...)`; (b) join `notifications where investigation_id = inv.id`; merge in TS; sort. Add verb labels for `capa.created / capa.completed / capa.verified / capa.verification_partial / notification.fired`. |
| 6. A11y | ⚠ | Avatar fallbacks have initials; verb text reads naturally. No focusable rows. | When deep-link icon is added (above), it's the focus target. Otherwise list rows are non-interactive — that's fine. |
| 8. Copy | ✓ ok | VERB_LABELS map covers the current verbs accurately | Add the new CAPA + notification verb labels |

### Cross-tab small gaps

- **Tab strip** is `<Link>` based; missing `aria-current="page"` on the active tab. Fix: add `aria-current={active ? "page" : undefined}` in `detail-tabs.tsx`.
- **Header action cluster** disappears when `isClosed`; that's correct, but a closed investigation has no "Reopen" affordance (terminal state per spec). Surface a small footnote on the status pill: "Closed investigations are read-only." Keep behaviour.
- **Modal `?action=...` pattern** — currently only one URL key (`action`) plus `profile` for remove-team. Working as expected; no fix.

---

## 3. Definition of done

Smoke-test pass (re-running `docs/smoke-test-phase2.md` investigation steps):

1. Kanban renders with seeded UCB data; drag with mouse + keyboard both work; ARIA live announces moves.
2. Filter chips with `aria-pressed`; "Pending" / "In progress" each map to a single DB enum value; lead + site filters round-trip via URL.
3. Detail loads; tab strip `aria-current`; tab-state survives refresh + share.
4. 5-Why autosaves; retry button surfaces on simulated save-fail.
5. Evidence: drag a file onto the dropzone (the copy is no longer a lie); upload 3 files where one is too large — the other 2 succeed and a single toast names the failed file. Trash button reachable via Tab; confirm modal blocks accidental delete.
6. Findings textarea autosaves; retry button on save-fail.
7. Timeline lists incident + investigation + CAPA + notification events, grouped by day, with deep-link icon per row.
8. OSHA 301 banner persists across tabs while applicable; vanishes on close.
9. Sandbox practice badge uses warning tokens (no raw amber); "Module 2" eyebrow gone; `loading.tsx` + `error.tsx` ship.
10. PR description: before/after for the Kanban (showing keyboard drag affordance) + Evidence dropzone (showing real DnD) + Timeline (showing 4-source merge).

---

## Open questions (resolve before opening the PR)

1. **"Assign me" CTA on pending_assignment cards** — currently no card-level affordance; full lead-assign goes through `?action=reassign-lead` on the detail page. Add a 1-click "Assign me" on cards (gated on `investigation:lead` + `lead === null`)? **Recommend: yes** — saves 2 clicks for the supervisor flow.
2. **Site filter chip** — Phase 5 planner uses verbose `?site=all|<uuid>` shape. Mirror it here? **Recommend: yes**, same shape — `?site=...` (default = current site cookie).
3. **Date-range filter** — ui-flow §8.9 promises it; is it worth the calendar-popover footprint when every card already chips its own due-date? **Recommend: defer to v2**, log in SPEC §15.
4. **Trash-button confirm modal** — small inline `<AlertDialog>` or full `Dialog`? **Recommend: shadcn `<AlertDialog>`** (matches the destructive pattern used elsewhere).
5. **Timeline: include `severity_overrides` table?** It's append-only audit; verbs there don't go through `activity_events`. **Recommend: defer** — a "Severity overridden" event is already emitted to `activity_events` per Phase 1, so we'd double-count. Confirm by grepping for the verb.
6. **Should we move team / witnesses fetches into the `tab === "summary"` block to save RTTs on non-summary tabs?** **Recommend: yes** — saves ~3 queries when a user lands on `?tab=evidence` or `?tab=timeline` from a deep link.

---

## Out of scope (logged in SPEC §15 if confirmed)

- PDF thumbnail rendering on Evidence tab (PDF.js is heavy)
- Bulk-resolve / bulk-action on findings (n/a for free-text findings)
- Branching 5-Why or alternative RCA methods (5-Why locked for v1)
- Reopen-closed investigations (terminal state by design)
- Date-range filter on Kanban
