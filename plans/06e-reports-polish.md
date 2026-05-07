# Phase 6e — Reports polish

**Status:** drafted 2026-05-06 · re-audited 2026-05-08 against shipped surfaces (Phase 6 module 5 of 10)
**Goal:** Reports are the regulator-facing surface. The 5 pages (`/reports`, `/reports/osha-300`, `/reports/osha-300a`, `/reports/osha-301/[id]`, `/reports/riddor-f2508/[id]`) all ship with correct tokens, real form fidelity, and a working ITA CSV + 301/F2508 PDF path. Re-audit finds the gaps are all polish-shaped: missing route-level loading/error files, an internal-speak eyebrow, a subtle per-incident perm-check that's keyed on `currentSiteId` instead of the incident's `site_id`, an ITA CSV missing its UTF-8 BOM, no `YearPicker` on 300A despite 300 having one, and a "this is a record, not a submission" disclaimer that's currently only implied via the phone-immediate copy.
**Branch:** `feat/phase-6-reports-polish`
**PR target:** `main`
**Pages covered:** `/reports`, `/reports/osha-300`, `/reports/osha-300a`, `/reports/osha-301/[incidentId]`, `/reports/riddor-f2508/[incidentId]`

> **What this PR ships:**
> - 10-item shared checklist applied to all 5 routes; concrete findings + fixes below.
> - `loading.tsx` + `error.tsx` at every reports route (5 pairs); brand error card replaces the inline `text-destructive` string on `/reports/osha-300`.
> - "Continuous output layer" eyebrow dropped on `/reports` (matches 6b/6c/6d "Module N" eyebrow drops).
> - Per-incident pages (301, F2508) and their PDF routes switch the perm guard from `can("...", currentSiteId)` to `can("...", incident.site_id)` so a user with multi-site access doesn't 404 when the incident is on a non-active site.
> - ITA CSV export gets the UTF-8 BOM (`﻿` prefix) — explicit polish bullet from the original 06e stub.
> - 300A page adds a `YearPicker` mirroring 300 (currently the page reads `?year=` but offers no UI to change it).
> - 300A annual-hours form gets a Retry button on save-fail (mirrors the 6c 5-Why retry / 6d progress retry).
> - HSE record card on F2508 gets the explicit "record, not submission — submit through the HSE portal" disclaimer (currently only implied via the "phone HSE immediately + F2508 within 10 days" line).
> - 301 form's "Generate PDF" failure path: PDF route currently returns `text/plain` error bodies. Switch to `redirect(.../?pdf_error=<code>)` so the page renders a brand error banner instead of dumping the user on a text page.
> - Establishment-info card on 300 + 300A: when `osha_establishment_id` or `naics_code` is `(unset)`, surface a small inline link to `/admin/sites/[id]/edit` gated on `site:configure` — addresses the "you can't actually upload to ITA without these" silent gap.
>
> **Not in this PR (deferred or n/a):**
> - **No 300 / 300A PDFs.** Per `CLAUDE.md`: "300/300A PDFs deferred to v2". Print-CSS on the HTML view is good enough; the PrintButton is already on 300A and gets added to 300.
> - **No ITA online submission.** We generate the CSV; the user uploads it to the OSHA portal. The /reports landing's tile copy already states this.
> - **No HSE online submission.** F2508 is record-keeping; user submits via HSE portal. PR adds the explicit disclaimer.
> - **No per-RIDDOR-category UI variation** (death / specified / over-7-day / occupational disease / dangerous occurrence). Original 06e stub asked for per-category section show/hide; `deriveF2508Fields` computes a single `report_type` summary field and renders the flat list. v2 work — log in SPEC §15.
> - **No recent-generations log on `/reports`.** Original stub asked for "who generated, when, format, deep-link to artifact" — we don't track generations (PDF route is stateless; CSV route is stateless), and adding a `report_generations` table is a v2-shaped change. Log in SPEC §15.
> - **No 13-tooltip-per-column-letter explanation on `/reports/osha-300`.** Original stub asked for "Column tooltip on each header explains the OSHA form column letter". Adding 13 tooltips is heavy + low signal (the second header row already labels each column in plain English — `Case #` / `Employee` / `Date` / `Location` / `Description` / `Class` / `Death` / etc.). Single `<InfoTooltip tip="osha_300_columns">` on the column-letter row is the compromise; defer per-column tooltips to v2 if asked.
> - **No new perm keys.** Existing `report:export` / `report:edit_hours` / `notification:hse_record_edit` cover everything.
> - **No new RPCs, no schema changes.**

---

## 0. Cross-cutting findings (apply to all 5 routes)

| # | Finding | File(s) | Fix |
|---|---|---|---|
| 0.1 | No `loading.tsx` / `error.tsx` at any of the 5 reports routes — page blanks on nav + any thrown error escapes to the global boundary | All 5 routes | Add 5 × `loading.tsx` (skeleton matching post-load layout — tile grid for landing, table for 300, KPI grid + form for 300A, field group list for 301/F2508) + 5 × `error.tsx` (brand error card with `Try again` reset + `Back to Reports` link) |
| 0.2 | "Continuous output layer" eyebrow on `/reports` is internal-speak — matches the "Module N" eyebrows that 6b/6c/6d dropped | `app/(app)/reports/page.tsx:78` | Drop the eyebrow; lift the title hierarchy to match 6b/6c/6d |
| 0.3 | Per-incident perm guards (301 + F2508 + both PDF routes) call `can("incident:read_site", currentSiteId)` — but the incident may live on a different accessible site. RLS still admits the row, but the page 404s for users with multi-site access whose `currentSiteId` cookie is on the "wrong" site | `app/(app)/reports/osha-301/[incidentId]/page.tsx:21–27`, `app/(app)/reports/riddor-f2508/[incidentId]/page.tsx:23–35`, `app/api/reports/301/[incidentId]/pdf/route.tsx:14–19`, `app/api/reports/riddor-f2508/[incidentId]/pdf/route.tsx:14–19` | Read the incident first (RLS-bound), then guard with `can("incident:read_site", incident.site_id)`. Same pattern for `report:export` on the PDF routes (key off the incident's site, not the cookie) |
| 0.4 | TooltipProvider duplicated on 300 / 300A / F2508 (300 + 300A wrap, F2508 wraps) — small DRY miss but safe to leave per page. Lifting to `(app)/layout.tsx` is a separate refactor | n/a | None — note for the audit trail; leave as-is |

---

## 1. `/reports` (landing)

Tile grid (4 tiles: OSHA 300 / 300A / 301 / RIDDOR F2508) + per-site jurisdiction logic (RIDDOR tile only when `memberships` includes a GB site; dimmed when `currentSite.country !== "GB"`). YearPicker top-right.

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | Tile grid `sm:grid-cols-2`; brand iconography (FileBarChart / FileText / FileCheck / Flag); `text-primary` accents. | None |
| 2. Empty state | ⚠ | `!canRead` shows a `border-dashed text-muted-foreground` block — fine. No empty state for "no recordable cases yet" — tile metric just reads "0 recordable cases YTD" which is the right signal. | None |
| 3. Loading state | ✗ missing | No `loading.tsx`; tiles + counts blank during nav | Add skeleton with 4 tile placeholders + YearPicker placeholder |
| 4. Error state | ✗ missing | No `error.tsx`; head-count query failures escape to global boundary | Add brand error card |
| 5. Responsive | ✓ ok | `sm:grid-cols-2`; YearPicker wraps when narrow | None |
| 6. A11y / keyboard | ✓ ok | Tiles are `<Link>` elements (focusable, keyboard-reachable); YearPicker is a row of `<Link>` elements | None |
| 7. Form-error UX | n/a | No forms | None |
| 8. Copy | ⚠ | "Continuous output layer" eyebrow — internal-speak (per 0.2). Tile metric copy is good. RIDDOR dimmed-tile metric "GB sites only" is clear. | Drop eyebrow |
| 9. Dark mode | ✓ ok | Tokens only, `bg-card`, `border`, `text-primary` — no raw hex | None |
| 10. Cache Components | ✓ ok | `searchParams: Promise<...>` awaited; no stale `'use cache'`; head-count queries are RLS-scoped to the user | None |

### Small functional gaps

- **RIDDOR tile clickability when dimmed** — currently the dimmed tile (US-only user) still routes to `/incidents?riddor=1`, which renders an empty list. Two options: (a) suppress the click via `pointer-events-none` + `aria-disabled`, (b) leave clickable since the empty-list outcome is honest. **Recommend (b)** — a stakeholder clicking the dimmed tile and landing on a labelled empty list ("No RIDDOR-reportable cases on US sites") is a clearer teaching moment than a non-clickable element. Confirm.
- **Recent-generations log** — original stub asked for one. Defer to v2 (we don't track generations; PDF + CSV routes are stateless). Log in SPEC §15.

---

## 2. `/reports/osha-300` (Log)

Table with two-row header (column letters A–M + sub-headers), establishment KvRow strip, year + month filter pills, ITA CSV export (gated on `report:export`).

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | Two-row header (A–M letters + plain-English sub-row); rows use `font-mono` for case number, `tabular-nums` for day counts, totals row uses `bg-muted/30 font-medium` | None |
| 2. Empty state | ✓ ok | "No recordable cases for [Month] {year}" — month-aware; legible | None |
| 3. Loading state | ✗ missing | No `loading.tsx`; table blanks during nav | Add skeleton: establishment strip + filter pills + table-rows × 6 |
| 4. Error state | ⚠ raw string | `queryError && <p className="text-sm text-destructive">{queryError}</p>` (page.tsx:163) — leaks the raw Supabase error message | Render via `error.tsx` brand error card; remove the inline `<p>` |
| 5. Responsive | ✓ ok | `overflow-x-auto` on the table wrapper; year/month filter rows `flex-wrap` | None |
| 6. A11y / keyboard | ⚠ minor | Table semantics correct; `<a>` filter pills are reachable; no `aria-current` on the active year/month pill (visual-only signal via `bg-primary text-primary-foreground`) | Add `aria-current="page"` on the active year + active month pill |
| 7. Form-error UX | n/a | No forms | None |
| 8. Copy | ⚠ | InfoTooltip on title (`osha_300_vs_301`) is good. Original stub asked for per-column-letter tooltips — replaced with single `<InfoTooltip tip="osha_300_columns">` on the column-letter header row (pre-cleared scope reduction in the "Not in this PR" block above). | Add one column-row tooltip; **add `osha_300_columns` to `lib/constants/tooltips.ts`** with a 1-sentence explanation of the A–M letter system |
| 9. Dark mode | ✓ ok | Tokens only | None |
| 10. Cache Components | ✓ ok | `searchParams: Promise<...>` awaited; injured_persons join is direct RLS | None |

### Small functional gaps

- **`!canRead` partial render** — page renders establishment strip + filter pills + empty-state card with no "you don't have access" copy. Mirror `/reports` landing's explicit notice. Recommend.
- **PrintButton** — 300A and 301 have it; 300 doesn't. Add `<PrintButton />` next to the export button so 300 prints alongside its peers. Print-CSS uses the `print:hidden` pattern already established.
- **Establishment-config link** — when `osha_establishment_id` or `naics_code` is `(unset)`, the table generates fine but the ITA CSV output has empty values for those columns — a regulator-facing miss. Add a small `<Link>` inline next to the "(unset)" KvRow value that routes to `/admin/sites/[id]/edit?focus=osha`, gated on `site:configure`. Same fix on 300A.
- **ITA CSV BOM** — `app/api/reports/osha-300/csv/route.ts:91` returns the CSV without a UTF-8 BOM. Excel-on-Windows misreads non-ASCII column values without one. Prepend `﻿` before serializing. Original 06e stub flagged this explicitly.
- **ITA CSV filename** — currently `osha-300-{year}[-{MM}].csv`. Original stub said `OSHA300A-<establishment>-<year>.csv` but that was 300A-shaped (and 300A has no CSV export anyway). For the 300 export, recommend `osha-300-<establishment>-<year>[-<MM>].csv` when establishment ID is set, fall back to current shape when unset. Confirm.

---

## 3. `/reports/osha-300a` (Annual summary)

Establishment info card → 6 count cards → 6 injury-type counts → AnnualHoursForm → 3 KPI cards (TRIR / DART / Severity Rate) → death-count callout (when `deaths > 0`) → "Certification (deferred to v1.5)" callout. PrintButton in header.

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | KpiCard uses `border-2 border-primary/30 bg-primary/5` for the brand-emphasized values; CountCard uses `bg-card` neutral. Death callout uses `border-destructive`. ✓ | None |
| 2. Empty state | ✓ ok | "No data" path: count cards render zeros, KPIs render "—" with hint "Set annual hours above" — already correct | None |
| 3. Loading state | ✗ missing | No `loading.tsx`; multiple cards + form skeleton would help | Add skeleton: establishment card + 6 count placeholders + 3 KPI placeholders |
| 4. Error state | ✗ missing | No `error.tsx`; site-not-found / hours-fetch failure escapes | Add brand error card |
| 5. Responsive | ✓ ok | `sm:grid-cols-2 lg:grid-cols-3` on counts; `sm:grid-cols-3` on KPIs; print-friendly | None |
| 6. A11y / keyboard | ⚠ | AnnualHoursForm: `<Label htmlFor>` ✓; `<Input min={0} step={1}>` ✓; submit button has pending state. No `aria-required` (it IS required — defaults to "set hours to compute"). Death callout has no `role="status"` so screen readers don't announce it on initial render | Add `aria-required="true"` on the hours input; wrap death callout in `role="status"` |
| 7. Form-error UX | ⚠ | Save-fail toasts but offers no Retry — user must edit the value to retrigger | Add a Retry button to AnnualHoursForm (mirrors 6c 5-Why / 6d progress retry pattern) |
| 8. Copy | ✓ ok | "Posting period: Feb 1 – Apr 30 the following year. ITA submission deadline: March 2." with InfoTooltip(`ita_deadline`). Hours form helper text is precise. KPI cards explain how the rate is computed. | None |
| 9. Dark mode | ✓ ok | Tokens only | None |
| 10. Cache Components | ✓ ok | `searchParams: Promise<...>` awaited; `Promise.all` over site / hours / cases | None |

### Small functional gaps

- **`!canRead` partial render** — same as 300; add explicit notice.
- **YearPicker missing.** Page reads `?year=` but offers no UI to change it. 300 has the YearPicker; 300A doesn't. Add a YearPicker mirroring 300 (current + 3 prior years).
- **Establishment-config link** — same as 300 (per "(unset)" finding).
- **Print-CSS** — current PrintButton works but the page-break behavior across the 6-card / 3-card / death callout / certification dashed box hasn't been verified at A4. Verify in print preview during PR review; tweak with `print:break-inside-avoid` on each major card if needed.
- **6 injury-type tooltip set** — could surface `<InfoTooltip>` per type explaining what counts as "skin disorder" vs. "respiratory" vs. "poisoning". Heavy + low-value (form labels are self-explanatory); defer to v2.

---

## 4. `/reports/osha-301/[incidentId]` (per-incident form + PDF)

7-day deadline countdown banner → establishment header → 3 field-group lists (Employee / Physician / Case — 18 fields total) → extra-injured-persons warning (when >1 person) → "Edit underlying data" crosslink. PrintButton + Generate PDF (gated on `report:export`).

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | Field groups with `bg-muted/30` group headers; each field row uses `grid-cols-[40px_1fr_2fr]` (number / label / value); deadline banner color flips on overdue | None |
| 2. Empty state | ✓ ok | Non-recordable incident shows "This incident is not OSHA-recordable. Form 301 is only required for recordable cases." + back link — already correct | None |
| 3. Loading state | ✗ missing | No `loading.tsx`; deadline banner + field groups blank during nav | Add skeleton: deadline banner placeholder + 3 group placeholders × 6 rows each |
| 4. Error state | ⚠ | No `error.tsx`. Underlying single-row fetch + `notFound()` covers the not-found case; thrown errors escape | Add brand error card |
| 5. Responsive | ✓ ok | Field rows degrade; deadline banner readable at sm | None |
| 6. A11y / keyboard | ⚠ | Field group headers use `<p>` not `<h2>` — screen reader misses the hierarchy. Deadline banner has no `role="status"`. PrintButton + Generate PDF reachable. | `<p>` → `<h2 className="...">` for group headers; add `role="status"` to the deadline banner |
| 7. Form-error UX | n/a | Read-only display | None |
| 8. Copy | ✓ ok | Field labels match OSHA wording; "(captured at HR — not stored in v1)" placeholders are honest | None |
| 9. Dark mode | ✓ ok | Tokens only; PDF stays light always (paper artifact) | None |
| 10. Cache Components | ✓ ok | `params: Promise<...>` awaited; route-handler PDF returns `cache-control: no-store` | None |

### Small functional gaps

- **Per-incident perm guard** — see 0.3 cross-cutting fix (key off `incident.site_id`).
- **PDF route error UX** — `app/api/reports/301/[incidentId]/pdf/route.tsx` returns plain-text errors (`"Forbidden"`, `"Incident not found"`, `"Incident is not OSHA-recordable"`). Browser renders them as text/plain. Switch to `redirect` back to the `/reports/osha-301/[id]?pdf_error=<code>` and surface a brand error banner on the page (page reads `?pdf_error=` and renders an alert). Same treatment for the F2508 PDF route.
- **Multiple-injured-persons** — the page renders only the first injured person + a footer warning. v1 explicit decision per `CLAUDE.md` ("type-specific incident data uses sparse columns on `incidents`"). Footer warning copy is clear; no fix.
- **`not-found.tsx`** — `notFound()` lands on Next's default 404. A custom not-found.tsx for the `/reports` subtree (one file at `app/(app)/reports/not-found.tsx`) would render a brand-shaped 404 across all 5 routes. Recommend.

---

## 5. `/reports/riddor-f2508/[incidentId]` (per-incident form + PDF + HSE record card)

UK-only (404 for `site.country !== "GB"`). Establishment header → 3 field-group lists (Incident / Person / Injury — 16 fields total) → extra-injured-persons warning → HseRecordCard (phone + online submission timestamps). PrintButton + Generate PDF.

### Audit table

| Dim | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✓ ok | Same field-group treatment as 301; HseRecordCard has clean phone + online row pair with green check-circle on completion | None |
| 2. Empty state | ⚠ | `!incident.riddor_reportable` shows a `border-warning/40 bg-warning/5` banner — clear. Non-GB incident → 404 (correct per ui-flow §8.17). | None |
| 3. Loading state | ✗ missing | No `loading.tsx` | Add skeleton (same shape as 301 + HseRecordCard placeholder) |
| 4. Error state | ✗ missing | No `error.tsx` | Add brand error card |
| 5. Responsive | ✓ ok | Field rows + HseRecordCard rows degrade cleanly | None |
| 6. A11y / keyboard | ⚠ | Same `<p>` → `<h2>` finding as 301. HseRecordCard form inputs have `<Label htmlFor>` + `required` + `maxLength` — good. No `aria-required` on the inputs (the `required` HTML attribute already implies it but explicit is better). Phone-completion + online-completion summary blocks have no `role="status"` so the toast-driven success message is the only announcement. | `<p>` → `<h2>`; `aria-required="true"` on HSE inputs; `role="status"` on the completion summary blocks |
| 7. Form-error UX | ⚠ | HseRecordCard's `recordHsePhoneCall` / `recordHseOnlineSubmission` toast on save-fail; no Retry. | Add Retry buttons mirroring 6c/6d pattern (or accept toast-only — these are 1-shot record actions, the user re-clicking the input + submit is idempotent). Recommend: **leave toast-only** — these aren't autosaves; the full form re-submission IS the retry. Confirm. |
| 8. Copy | ⚠ | Sub-text says "phone HSE immediately + F2508 within 10 days". Doesn't explicitly say "this PDF is a record — submit through the HSE online portal (HSE doesn't accept this PDF)". The Reports tile copy on `/reports` says "UK event-triggered HSE report" — also doesn't mention the submission channel. | Tighten: add a small disclaimer line under the page title — "**This is a record.** Submit through the HSE online portal — HSE doesn't accept this PDF." Place above or below the InfoTooltip(`riddor_deadlines`). |
| 9. Dark mode | ✓ ok | Tokens only | None |
| 10. Cache Components | ✓ ok | `params: Promise<...>` awaited; HSE record fetch is a `maybeSingle()` keyed on `incident_id` | None |

### Small functional gaps

- **Per-incident perm guard** — see 0.3 (key off `incident.site_id`).
- **PDF route error UX** — same redirect-with-`?pdf_error=` treatment as 301.
- **Per-RIDDOR-category UI variation** — `report_type` is computed once into a single field but doesn't drive show/hide of sections. v2-shaped; logged in "Not in this PR".
- **HSE record card edit log** — already logs to `activity_events` with `verb: "hse.phone_recorded" / "hse.online_recorded"` and a `payload.reference`. ✓
- **3y retention reminder** — RIDDOR retention is 3 years vs OSHA's 5y. Currently surfaced only in `docs/SPEC.md`. Could add a footer line "Retain for 3 years (RIDDOR 2013, Reg. 12)". Recommend (small, copy-only).

---

## 6. Definition of done

Smoke-test pass (re-running `docs/smoke-test-phase2.md` reports section + 6e-specific additions):

1. All 5 reports routes have `loading.tsx` + `error.tsx`; error boundary's "Try again" resets the page; "Back to Reports" link works from each.
2. `/reports` eyebrow gone; tiles render correctly for US-only / GB-only / mixed-membership users; YearPicker round-trips via URL.
3. `/reports/osha-300` table renders all 13 columns; ITA CSV export downloads with **UTF-8 BOM**; CSV filename includes establishment ID when set; PrintButton present; brand error card replaces the inline `text-destructive` string.
4. Active year + month pills (300 page) have `aria-current="page"`; column-letter header row gets `<InfoTooltip tip="osha_300_columns">`.
5. `/reports/osha-300a` has a YearPicker; AnnualHoursForm has Retry button on save-fail + `aria-required` on the input; death callout has `role="status"`.
6. Per-incident pages (301 + F2508) and their PDF routes guard via `can("...", incident.site_id)` — verified by signing in as a user with multi-site access whose `currentSiteId` is on the "wrong" site, and confirming the page renders.
7. F2508 page shows the "**This is a record.** Submit through the HSE online portal — HSE doesn't accept this PDF." disclaimer.
8. HseRecordCard inputs get `aria-required="true"`; completion summaries get `role="status"`.
9. PDF route errors redirect to the page with `?pdf_error=<code>`; page renders a brand error banner instead of dumping the user on a `text/plain` page.
10. `(app)/reports/not-found.tsx` ships and renders the brand 404 across all 5 routes.
11. Establishment-config link surfaces on 300 + 300A when `osha_establishment_id` / `naics_code` is `(unset)`, gated on `site:configure`.
12. PR description: before/after screenshots for each route (10 screenshots), a CSV diff (with vs. without BOM, viewable in Excel), and a print-preview screenshot per page.

---

## Open questions (resolve before opening the PR)

1. **RIDDOR tile clickability when dimmed.** Recommend **leave clickable** — the `/incidents?riddor=1` empty-list landing is a clearer teaching moment than a non-clickable element. Confirm.
2. **ITA CSV filename shape.** Recommend `osha-300-<establishment>-<year>[-<MM>].csv` when `osha_establishment_id` is set, fall back to current `osha-300-<year>[-<MM>].csv`. Confirm shape.
3. **Per-column-letter tooltips on 300.** Original stub asked for 13. Recommend **single header-row InfoTooltip** explaining the A–M letter system in one sentence; defer per-column to v2 if asked. Confirm.
4. **Establishment-config link target.** When `(unset)`, link to `/admin/sites/[id]/edit?focus=osha` (deep-link with focus param) or just `/admin/sites/[id]/edit`? Recommend the `?focus=osha` deep-link so the form scrolls to the OSHA fields. Confirm.
5. **HseRecordCard Retry button.** Recommend **toast-only** (no Retry) — the form submission IS the retry; HSE record-keeping is 1-shot per record. Confirm.
6. **PDF route error handling.** Recommend `redirect(.../?pdf_error=<code>)` → page reads `?pdf_error=` and renders a brand error banner above the form. Alternative: render an HTML error page directly from the route handler. Recommend redirect (keeps the user in the page context). Confirm.
7. **Custom `not-found.tsx` for `/reports`.** Recommend ship one at `app/(app)/reports/not-found.tsx` covering all 5 routes. Confirm.
8. **3y retention reminder on F2508.** Recommend ship the small footer copy ("Retain for 3 years per RIDDOR 2013, Reg. 12"). Confirm.

---

## Out of scope (logged in SPEC §15 if confirmed)

- 300 / 300A PDF generation (deferred per `CLAUDE.md`)
- ITA online submission (we generate, user uploads)
- HSE online submission (we record, user submits via HSE portal)
- Per-RIDDOR-category UI variation (death / specified / over-7-day / occupational disease / dangerous occurrence) — flat list for v1
- Recent-generations log on `/reports` — needs `report_generations` table; v2
- Per-OSHA-300-column tooltips (13) — single header-row tooltip is the v1 compromise
- Per-injury-type tooltips on 300A's 6 buckets — labels are self-explanatory
- Multiple-injured-persons-per-incident split (one 301 / F2508 per person) — v1 renders primary record only with a banner explaining the limit
- Bulk PDF export ("download all 301s for {year}") — rare path; one-by-one is fine for v1
- Digital sign-off / certification on 300A (deferred to v1.5 per existing in-page callout)
