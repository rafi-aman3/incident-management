# Phase 6h — Resources polish (Assets + Documents)

**Status:** drafted 2026-05-06 (Phase 6 module 8 of 10)
**Goal:** Resources is the cross-cutting plumbing — every other module mounts the `<DocumentLinkPicker>`, the `<AssetTypeaheadField>`, and reads back from the `documents` + `document_links` tables. Polish here ripples everywhere: picker affordances must be pleasant, asset detail tabs must always reflect linked-from-elsewhere data, and document signed-URL preview must work for PDF / image / fallback.
**Branch:** `feat/phase-6-resources-polish`
**PR target:** `main`
**Pages covered:** `/resources/assets`, `/resources/assets/new`, `/resources/assets/[id]`, `/resources/assets/[id]/edit`, `/resources/documents`, `/resources/documents/new`, `/resources/documents/[id]`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist for all 7 pages.
> - DocumentLinkPicker hardening (used in 5+ contexts — fix once, ripple everywhere).
> - AssetTypeaheadField hardening (Wizard Step 2 reuse).
> - Asset detail 4-tab navigation (Overview · Incidents · Inspections · Documents) — tab state in URL.
> - Document detail signed-URL preview: PDF iframe / image inline / download fallback.
> - Replace / Edit metadata / Archive cluster on document detail header.
> - Linked-list grouping by parent type on document detail.

> **Not in this PR:**
> - **No document versioning.** Deferred to Phase 7 of `IMS_PLANNING.md` (v2 Document Control deep).
> - **No approvals / e-signatures / forced ack.** Same v2 deferral.
> - **No SDS Manager API integration.** v2.
> - **No asset PM cron.** v2.
> - **No asset hierarchy / parent-child.** v2.

---

## Pages — Assets

### 1. `/resources/assets` (site-grouped table)
Filters: site, kind, condition, free-text q. Default sort: site asc, name asc.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Site section header per group; condition badge per row | |
| 2. Empty state | TBD | Org-fresh: "No assets yet — register your first asset" CTA | |
| 3. Loading state | TBD | Skeleton rows | |
| 4. Error state | TBD | Filter site doesn't exist → fallback to all | |
| 5. Responsive | TBD | sm: stack rows as cards | |
| 6. A11y / keyboard | TBD | Row click + actions reachable | |
| 7. Form-error UX | TBD | Filter chip URL state | |
| 8. Copy | TBD | Condition pill copy: "Operational" / "Needs attention" / "Unsafe — quarantine" | |
| 9. Dark mode | TBD | Condition badge tokens | |
| 10. Cache Components | TBD | Per-site list cache; revalidate on edit | |

**Likely small gaps:**
- Bulk actions: bulk-condition update? Probably v2.
- Last-inspected column with red-amber-green based on time since.
- Next-PM column with red if overdue.
- "Register asset" CTA top-right.

### 2. `/resources/assets/new` and `/resources/assets/[id]/edit` (shared form)
Same form, different action. Fields: name, kind, location, condition, last-inspected, next-PM, SDS-link via DocumentSelectField.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Form layout consistent with other create forms | |
| 6. A11y / keyboard | TBD | DocumentSelectField keyboard-only operable | |
| 7. Form-error UX | TBD | Required: name, site; optional: rest | |
| 8. Copy | TBD | "Last inspected" — explainer: "Manual entry; will integrate with Inspections in v2" | |

**Likely small gaps:**
- DocumentSelectField: typeahead filtered to type=`sds`; "Don't see your SDS? Upload one" → opens DocumentLinkPicker upload tab.
- Site picker scoped to user's accessible sites.
- Condition transition rules (e.g., Operational → Unsafe must require a reason — deferred or include?).
- Edit form — "Replace SDS" affordance visible.

### 3. `/resources/assets/[id]` (4-tab detail)
Tabs: **Overview** (asset facts, condition popover, "Mark inspected", unsafe-transition CTA wiring `/incidents/new/1?asset=...&type=unsafe_condition`) · **Incidents** · **Inspections** · **Documents**.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Tab nav per WAI-ARIA; right rail with quick stats | |
| 2. Empty state | TBD | Each tab empty: "No incidents linked" / etc. | |
| 6. A11y / keyboard | TBD | Tab arrow-key nav; AssetActions popover keyboard-only | |
| 8. Copy | TBD | Unsafe-transition CTA: "Report as unsafe condition" — pre-fills incident type + asset | |

**Likely small gaps:**
- Tab state in URL: `?tab=overview|incidents|inspections|documents`.
- Documents tab uses DocumentLinkPicker; linked docs shown grouped by type.
- Incidents tab links each row to `/incidents/[id]`.
- Inspections tab: for v1, this might be empty (no asset-inspection link); confirm and either populate or hide.
- "Mark inspected" — modal: optional note + sets `last_inspected_at = now()`.
- AssetActions popover: condition change with required reason.
- Activity timeline on Overview tab (asset events).

## Pages — Documents

### 4. `/resources/documents` (card grid + table toggle)
Filters: type, site, expiring=1 (default narrows to `expires_at < now() + 14d` for the training cert seed). View toggle: grid / table.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card per doc with type icon, name, expiry pill, link count | |
| 2. Empty state | TBD | "No documents yet — upload your first" CTA | |
| 5. Responsive | TBD | sm: force card view; hide table toggle | |
| 6. A11y / keyboard | TBD | View toggle reachable; cards keyboard-operable | |
| 8. Copy | TBD | Expiry pill: "Expires in 14d" / "Expired 3d ago" — color-coded | |

**Likely small gaps:**
- View-toggle persists in URL or localStorage.
- Filter chip: "Linked to <N> records" sort.
- Bulk archive — probably v2.
- "Upload document" CTA top-right.

### 5. `/resources/documents/new` (upload form)
Fields: file, type, name (default to filename), site, expires_at (optional).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Drop zone + form fields | |
| 4. Error state | TBD | Mime-type whitelist; oversize rejection with limit | |
| 6. A11y / keyboard | TBD | Drop zone keyboard-operable | |
| 7. Form-error UX | TBD | Per-field validation; pending state on submit | |

**Likely small gaps:**
- Drop zone shows accepted types.
- Multi-file upload — probably scope-creep; one-at-a-time in v1.
- "Save & link" — optional second step to attach to a parent immediately?

### 6. `/resources/documents/[id]` (file preview)
Signed-URL preview: PDF iframe / image inline / download fallback. Link list grouped by parent type. Replace / Edit metadata / Archive cluster.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Preview takes ~70% of viewport; sidebar with metadata + links | |
| 2. Empty state | TBD | Doc with no links: "Not linked to any record yet" + DocumentLinkPicker affordance | |
| 4. Error state | TBD | Signed URL expired / 404 → re-mint and retry once; if still fails, download fallback | |
| 5. Responsive | TBD | sm: preview becomes tap-to-open; metadata stacks | |
| 6. A11y / keyboard | TBD | Action cluster reachable; PDF iframe focus | |
| 8. Copy | TBD | Archive confirm: warns if active links; offers `force` per `archive_document_v1` RPC | |

**Likely small gaps:**
- Replace file: warns "this overwrites in place; previous version is unrecoverable in v1; versioning ships in v2".
- Edit metadata: name, type, expires_at, site.
- Archive: soft (sets archived_at); force on active links.
- Link list: grouped by parent type (incident / investigation / capa / asset / inspection / site / org); each row deep-links + has Unlink action.
- Add link: opens DocumentLinkPicker `link_document_v1` flow.

## Cross-cutting — DocumentLinkPicker

The picker is mounted in 5+ contexts. Polish once here:
- 2-tab modal: "From library" / "Upload new".
- Library tab: search, type filter, expiring filter; selecting one triggers `link_document_v1` (idempotent per-parent).
- Upload tab: same form as `/resources/documents/new`; on success, auto-links to the calling parent.
- Modal traps focus; ESC closes.
- Non-blocking failure: per-link-attempt error logged; partial success surfaced (e.g., "2 linked, 1 failed").
- Default tab: Library if any docs exist; Upload otherwise.

## Cross-cutting — AssetTypeaheadField

Mounted in Wizard Step 2 for property_damage / unsafe_condition / dangerous_occurrence:
- Debounced search; site-scoped.
- Empty result: "Don't see your asset? Add it" → opens new-asset modal inline.
- Selected asset persists to `incidents.equipment_asset_id`.
- Visual chip on selected; Clear (X) restores typeahead input.

---

## Definition of done — Resources PR

1. 10-item checklist passes for all 7 pages.
2. DocumentLinkPicker works identically in all 5 mount points (Wizard Step 2, incident detail, investigation evidence, CAPA evidence, asset detail Documents tab).
3. AssetTypeaheadField inline-add modal works without losing wizard state.
4. Asset detail tabs (Overview / Incidents / Inspections / Documents) all populate correctly with linked-from-elsewhere data.
5. Document signed-URL preview falls back gracefully (PDF iframe → image inline → download button).
6. Document Replace / Archive (with `force` for active links) work via RPC.
7. Smoke-test (`docs/smoke-test-phase4.md`) re-runs green.
8. PR description includes:
   - Picker mount-point gallery (1 screenshot per of the 5 mount points).
   - Before/after for any visual swap.
   - 30s recording of asset detail tab navigation.
