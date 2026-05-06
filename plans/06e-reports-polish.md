# Phase 6e — Reports polish

**Status:** drafted 2026-05-06 (Phase 6 module 5 of 10)
**Goal:** Reports are the regulator-facing surface. Numbers must be defensible (TRIR / DART / Severity Rate computed correctly), the OSHA 300 Log columns must match the legal form, the OSHA 301 + RIDDOR F2508 PDFs must render identically light- and dark-mode (paper artifact stays light), and every "submit" affordance is honest about what it does (we don't actually wire ITA submission in v1; we generate the file).
**Branch:** `feat/phase-6-reports-polish`
**PR target:** `main`
**Pages covered:** `/reports`, `/reports/osha-300`, `/reports/osha-300a`, `/reports/osha-301/[incidentId]`, `/reports/riddor-f2508/[incidentId]`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist for all 5 pages.
> - PDF visual review (`@react-pdf/renderer`) — cross-check line wrapping, page breaks, signature blocks, version footer.
> - 300A annual summary: editable `site_annual_hours` UX, live TRIR/DART/Severity recompute, default-period correctness.
> - ITA-format CSV export polish: filename convention (`OSHA300A-<establishment>-<year>.csv`); UTF-8 BOM; column header exact match.
> - HSE notification record card on the F2508 page: clear "this is a record, not a submission" disclaimer.

> **Not in this PR:**
> - **No 300 / 300A PDFs.** Per `CLAUDE.md`: "300/300A PDFs deferred to v2".
> - **No actual ITA online submission.** We generate the CSV; user uploads it to ITA themselves.
> - **No actual RIDDOR online submission.** F2508 is a record-keeping printable; user submits via HSE online portal themselves.
> - No new regulatory form types beyond the 4 (300, 300A, 301, F2508).

---

## Pages

### 1. `/reports` (landing)
Tile grid of available reports + a recent-generation log. Tiles disabled (with explainer) when not applicable to the user's site (e.g., RIDDOR tile disabled on US-only sites).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Tile grid; brand iconography; "applicable to your site" badge | |
| 2. Empty state | TBD | "No reports generated yet — start with OSHA 300 Log" | |
| 6. A11y / keyboard | TBD | Tile keyboard-only operable | |
| 8. Copy | TBD | Tile copy explains *purpose* (e.g., "Annual summary required by OSHA — the 5y retention starts here") | |
| 10. Cache Components | TBD | Tile applicability per-site cached; recent-generations dynamic | |

**Likely small gaps:**
- Recent-generations table: who generated, when, format, deep-link to artifact.
- Disabled tile UX: "Not applicable to <Site name> — RIDDOR is for UK sites only."
- "Need a report we don't have?" — link to support / hidden in v1.

### 2. `/reports/osha-300` (300 Log table)
Live preview of the OSHA 300 Log columns. Filter by establishment / year. ITA-format CSV export button.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Tabular; sticky header; columns match OSHA 300 form letter-for-letter (A through M, plus column 6 sub-options) | |
| 2. Empty state | TBD | "No recordable cases for <year>" — explain the recordability rule in 1 sentence | |
| 3. Loading state | TBD | Skeleton table | |
| 4. Error state | TBD | Establishment / year invalid → fallback to current year | |
| 5. Responsive | TBD | Wide table; horizontal scroll on sm with frozen first column | |
| 6. A11y / keyboard | TBD | Header sortable; row-action menu reachable | |
| 7. Form-error UX | TBD | Year filter must be valid past year | |
| 8. Copy | TBD | Column tooltip on each header explains the OSHA form column letter | |
| 9. Dark mode | TBD | Table dark mode uses neutral surface | |
| 10. Cache Components | TBD | Per-site + per-year cache with revalidate on incident change | |

**Likely small gaps:**
- "Recordability" — derived from incident type + injured-person fields per OSHA 1904. Audit the derivation logic; ensure days-away / days-restricted compute correctly.
- CSV export — exact column order matches ITA spec; UTF-8 BOM; filename convention.
- Print-friendly view? Per `CLAUDE.md` — 300 PDF deferred to v2; print-CSS to make the HTML printable would be a small gap fix here.
- Multi-establishment org — column for establishment ID per row.

### 3. `/reports/osha-300a` (annual summary)
The summary form: total cases by category, total days-away/restricted, TRIR / DART / Severity Rate. Editable `site_annual_hours`. Live recompute.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Form-shaped per OSHA 300A; 5×5 totals grid | |
| 2. Empty state | TBD | "No data for <year>" + "Enter establishment hours to compute" | |
| 4. Error state | TBD | Hours = 0 → metric shows "—" not "Infinity" | |
| 6. A11y / keyboard | TBD | Hours input keyboard-only, validates positive integer | |
| 7. Form-error UX | TBD | Hours autosaves on blur; field-level error if non-numeric | |
| 8. Copy | TBD | TRIR / DART / Severity Rate — show the formula on hover | |

**Likely small gaps:**
- Establishment selector if multi-site org.
- Year selector defaults to last completed year (300A is annual).
- "Posted Feb 1 – Apr 30" reminder — surface a notification at the right time (Phase 1 notification engine extension).
- Export CSV / export PDF (PDF deferred per CLAUDE.md).

### 4. `/reports/osha-301/[incidentId]` (per-incident page + PDF)
The 301 form for a single recordable injury. Per-field display + "Download PDF" affordance.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Form layout matches OSHA 301 paper form | |
| 2. Empty state | TBD | If accessed for a non-recordable incident → "This incident is not OSHA-recordable" + back link | |
| 4. Error state | TBD | PDF generation failure → fallback to print-HTML | |
| 6. A11y / keyboard | TBD | "Download PDF" reachable; PDF has accessible text layer | |
| 8. Copy | TBD | Field labels match OSHA exactly (no paraphrasing) | |
| 9. Dark mode | TBD | Form HTML respects dark; PDF stays light always (paper) | |

**Likely small gaps:**
- PDF page breaks — long descriptions wrap correctly.
- Witness statement section — concatenated or per-witness blocks?
- Sticky banner on `/incidents/[id]` should link here AND show a "Mark report submitted" affordance (records the submission date for the 5y retention clock).

### 5. `/reports/riddor-f2508/[incidentId]` (per-incident page + PDF)
RIDDOR F2508 record. UK-only. Includes HSE notification record card (when did we notify HSE; reference number; who recorded it).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Form layout matches HSE F2508 paper form | |
| 2. Empty state | TBD | If accessed for a non-RIDDOR incident → "This incident is not RIDDOR-reportable" + back link | |
| 6. A11y / keyboard | TBD | "Download PDF" reachable; HSE record fields keyboard-editable | |
| 8. Copy | TBD | Disclaimer: "This is a record. Submit to HSE online — HSE doesn't accept this PDF." | |

**Likely small gaps:**
- HSE record card edits log to `activity_events`.
- Per-RIDDOR-category UI variation (death / specified / over-7-day / occupational disease / dangerous occurrence) — which sections show.
- 3y retention reminder.

---

## Definition of done — Reports PR

1. 10-item checklist passes for all 5 pages.
2. OSHA 300 columns match the legal form letter-for-letter; tooltips on each.
3. ITA CSV export filename + BOM + column order match the ITA spec.
4. 300A metrics return "—" not "Infinity" when hours = 0.
5. 301 PDF + F2508 PDF render identically across light/dark mode user setting (paper stays light).
6. Per-incident report pages route correctly when the incident isn't applicable (recordable / RIDDOR-applicable) — clear "not applicable" notice, not raw data.
7. HSE record card on F2508 has the "this is a record, not a submission" disclaimer.
8. Smoke-test (`docs/smoke-test-phase2.md` reports section) re-runs green.
9. PR description includes:
   - Before/after PDFs (rendered to PNG for diff).
   - CSV diff against an OSHA-published template.
   - Screen recording of the 300A live-recompute.
