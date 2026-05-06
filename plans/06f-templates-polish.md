# Phase 6f — Templates polish

**Status:** drafted 2026-05-06 (Phase 6 module 6 of 10)
**Goal:** Templates is the largest surface in V1 (7 routes). The 3-column builder is the most complex single screen. Every interaction (sidebar tree drag, canvas autosave, options panel, ChangeSummaryDialog, version publish) must be predictable, the import-preset → assign flow must work in one continuous click-stream, and unsupported item types must render the yellow "Unsupported in v1" placeholder consistently.
**Branch:** `feat/phase-6-templates-polish`
**PR target:** `main`
**Pages covered:** `/templates`, `/templates/browse`, `/templates/browse/[id]`, `/templates/new`, `/templates/[id]`, `/templates/[id]/edit`, `/templates/[id]/assign`

> **What this PR ships:**
> - Audit + fixes per the 10-item checklist for all 7 pages.
> - Builder hardening: 1s autosave-to-draft is rock-solid (no lost edits, no double-saves, no race with publish).
> - ChangeSummaryDialog: clear before/after diff per item; "Publish v2" button shows what will change.
> - Browse → Import → Assign flow: one continuous click-stream with breadcrumb back to source preset.
> - Unsupported-type placeholder: same yellow card style across builder + viewer + (read-only) running inspection.
> - Versioned-snapshot indicator on viewer: "Showing version 1.2 (current) | running inspections still on 1.1".

> **Not in this PR:**
> - **No new MVP item types.** 8 are locked: section / category / information / question / text / datetime / signature / media. The 7 deferred types stay deferred (yellow placeholder).
> - **No template-import-from-CSV.** Preset import only (system → org).
> - **No live collaborative editing.** Single editor at a time; conflict warning if another user touches the draft.

---

## Pages

### 1. `/templates` (org-imported list, industry-grouped)
The user's org's imported templates, grouped by industry (`healthcare` / `education` / `manufacturing` / `warehouse` / `office` / `construction` / `lab`).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card grid; industry section header per `docs/design.md`; brand purple for primary "Browse system presets" button | |
| 2. Empty state | TBD | Org-fresh: "No templates yet — browse system presets or build a blank one" + 2 CTAs | |
| 3. Loading state | TBD | Skeleton cards | |
| 4. Error state | TBD | Industry section with 0 templates: "No <industry> templates yet" subtle | |
| 5. Responsive | TBD | sm: cards single column | |
| 6. A11y / keyboard | TBD | Card click + actions menu both reachable | |
| 8. Copy | TBD | Card body: 1-line description; version pill + "Last published <date>" | |
| 10. Cache Components | TBD | Per-org cache; revalidate on publish | |

**Likely small gaps:**
- Filter: industry chips OR sticky industry section nav.
- Sort: name asc / last-published desc.
- Card actions: Edit · Assign · View · Archive (with confirm).
- "Imported from <preset name>" lineage badge.

### 2. `/templates/browse` (system-preset library)
Card grid of system presets across all 7 industries. 4 featured chips on top (per `CLAUDE.md`).

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Card grid like SafetyCulture's library; featured chip row | |
| 2. Empty state | n/a | System presets always exist (14 seeded) | |
| 6. A11y / keyboard | TBD | Featured chip + card both reachable | |
| 8. Copy | TBD | Card sublabel: industry + question count + "Imported by <N> orgs" if we track that | |

**Likely small gaps:**
- Filter chips: industry; complexity (questions count); "for new sites" tag.
- Search: free-text search across preset name + description.
- Sort by popularity / question-count / alphabetical.

### 3. `/templates/browse/[id]` (preset detail)
Read-only preview of a system preset. "Import to my org" CTA.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Preview pane (similar to `/templates/[id]` viewer) + sidebar with import CTA | |
| 4. Error state | TBD | Already-imported preset: button shows "Imported — view yours" → routes to org template | |
| 7. Form-error UX | TBD | Import server action confirms with org name + site assign step skipped if no admin perm | |
| 8. Copy | TBD | "Import" → modal: "Import as new template in <Org>. You'll edit + publish + assign separately." | |

**Likely small gaps:**
- Item-UUID regeneration (per `import_preset_to_org_v1` RPC) — not a UI concern but verify the imported result shows as a fresh org template, not a system pointer.
- Breadcrumb: Browse → <Industry> → <Preset name>.

### 4. `/templates/new` (blank create form)
Single-step form: name + industry + initial section. Posts → routes to `/templates/[id]/edit`.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Centered card form | |
| 6. A11y / keyboard | TBD | Tab order: name → industry → initial-section name → submit | |
| 7. Form-error UX | TBD | Name unique-per-org check | |
| 8. Copy | TBD | "Create blank template" — explainer: "You'll add sections + items in the next step" | |

### 5. `/templates/[id]` (read-only viewer with versions panel)
Nav between draft / published versions. Right rail shows version history + assignments.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Linear flat-list of items with section headers; right rail with versions | |
| 2. Empty state | TBD | Brand-new template: "Add your first item in the editor" + "Edit" CTA | |
| 6. A11y / keyboard | TBD | Version switcher reachable; assignments list reachable | |
| 8. Copy | TBD | Version pill: "v1.2 (published)" / "v1.3 (draft)" — clear lineage | |

**Likely small gaps:**
- "Running inspections still on <version>" callout — explains the snapshot rule.
- "Edit" button → `/templates/[id]/edit` (forks to a new draft if currently published).
- "Assign" button → `/templates/[id]/assign`.
- Archive — confirm modal; warn about active assignments.

### 6. `/templates/[id]/edit` (3-column builder)
The complex one. Sidebar tree (left) · canvas preview (center) · options panel (right). 1s autosave-to-draft. ChangeSummaryDialog on publish. 8 MVP item types editable; 7 deferred types render yellow placeholder.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | 3-column layout per `docs/design.md`; collapse rules at sm | |
| 2. Empty state | TBD | New draft: empty section + "Add your first item" autofocus | |
| 3. Loading state | TBD | Skeleton 3-column on first load; autosave indicator on subsequent | |
| 4. Error state | TBD | Autosave failure: persistent toast + retry; never silent | |
| 5. Responsive | TBD | sm: 3-column collapses to tabs (Tree / Canvas / Options) | |
| 6. A11y / keyboard | TBD | Tree: arrow-key navigation; Enter to focus item; reorder via keyboard (Alt+up/down); Canvas item focus mirrors tree selection; Options panel form fields keyboard-only operable | |
| 7. Form-error UX | TBD | Per-item validation (e.g., question must have label); inline error in options panel | |
| 8. Copy | TBD | Item type picker labels + tooltips; "Add item" button label consistent | |
| 9. Dark mode | TBD | 3-column tokens; canvas preview matches running-inspection dark mode | |
| 10. Cache Components | TBD | Builder is fully dynamic — no cache | |

**Likely small gaps:**
- Drag-reorder via mouse + keyboard. Drop indicator visible.
- Add-item flyout: 8 supported types listed; 7 deferred types listed but disabled with yellow tooltip "Coming in v2".
- Section vs. category distinction visible in tree (different icon).
- `parent_id` graph integrity — UI never lets the user create a cycle.
- ChangeSummaryDialog: per-item delta (added / removed / modified); "Publish v<N+1>" button confirms count.
- Autosave indicator: "Saved 3s ago" / "Saving…" / "Failed — retry".
- Conflict warning if another user holds the draft (last-write-wins or warn).
- Unsupported-type placeholder yellow card: same style as viewer + runner.

### 7. `/templates/[id]/assign` (per-site or all-sites + schedule)
Assign template to one or more sites; pick schedule kind (daily / weekly / monthly / custom-cron) + start_time_local. Hierarchy-aware: include_children expands the tree.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Site picker + schedule form; "preview next 5 runs" panel | |
| 6. A11y / keyboard | TBD | Site tree keyboard-navigable; include_children checkbox per node | |
| 7. Form-error UX | TBD | Cron expression validation; start_time_local sanity | |
| 8. Copy | TBD | Schedule kind tooltips: "Daily 06:00 local — runs every day at 06:00 in <Site> timezone" | |

**Likely small gaps:**
- "All sites" toggle vs. per-site picker — clear they're alternatives.
- Existing assignment list (this template at site X already runs daily 06:00) — surface so user doesn't double-assign.
- Edit / unassign actions on existing assignments.
- Cron preview: next 5 run times rendered.
- Site timezone: surface explicitly so user knows which clock they're on.

---

## Definition of done — Templates PR

1. 10-item checklist passes for all 7 pages.
2. Builder autosave never loses an edit; tested by typing + killing the tab + reopening.
3. Builder is fully keyboard operable end-to-end (add section → add question → set options → publish).
4. ChangeSummaryDialog shows accurate before/after per item.
5. Yellow "Unsupported in v1" placeholder renders consistently across builder, viewer, and running-inspection (Phase 6g).
6. Browse → Import → Edit → Publish → Assign is one continuous click-stream with breadcrumb back to the source preset.
7. Assign page shows next 5 cron run times + site timezone.
8. Smoke-test (`docs/smoke-test-phase3.md`) re-runs green incl. snapshot-rule integration check.
9. PR description includes:
   - Before/after screenshots for builder.
   - 1-min screen recording: Browse → Import → Edit → Publish → Assign.
   - Keyboard-only walkthrough of builder.
