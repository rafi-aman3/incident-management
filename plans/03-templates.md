# Phase 3 — Templates + Inspections

**Status:** ready to start (drafted 2026-05-06; revised same day after porting decision)
**Goal:** A `site_admin` or `ehs_manager` browses an industry-scoped template library (SafetyCulture-shaped — cards with logo / industry / description), imports a preset into their org, edits it in the versioned builder, publishes v1, and assigns it to one or more sites with a schedule. A worker on mobile starts an inspection from that template, answers items (single-select / text / datetime / photo / signature), submits, and any failed response automatically creates a finding row. Failed findings can be escalated to an incident (pre-fills the Phase 1 Report Wizard with the finding context). Re-editing the template publishes v2 — running and historical inspections continue to honor the version they started against.
**Estimated duration:** ~2.5 weeks (expanded from the original 1-week templates-only scope)
**Depends on:** Phase 2 (shipped 2026-05-06, PR #3). RBAC tables + resolver from Phase 0/1.

> **Scope expansion 2026-05-06:** Phase 3 was originally Templates only with Inspections deferred to Phase 4. After studying the production reference at `/Users/rafiaman/Desktop/office-projects/workplace-safety-frontend` (SafetyCulture-shaped, real backend), the editor and the inspection runner share so much UI surface (item-type rendering primitives, answer/option dispatch, validation walking) that splitting them means rebuilding the same components twice. Phase 4 is now collapsed into Phase 3. The next phase (formerly 5) becomes Phase 4: Resources. SPEC §15 entry logged.
>
> **Data-model decision 2026-05-06:** Adopt the SafetyCulture-style flat-items-with-`parent_id` shape (sections / categories / questions / information / signature / etc., reusable answer_sets at template_data level, separate `header` array for title-page items). Lets us seed real SafetyCulture-library JSON payloads as system presets without translation. Stored as JSONB on `template_versions` (keeps version-immutability as a single row revision rather than a normalized item-table snapshot). SPEC §15 entry logged.

> **What this phase ships of the Templates + Inspections modules:**
> - Schema: `templates`, `template_versions` (with `header` / `items` / `template_data` JSONB), `template_assignments`, `inspections` (with `template_version_id` snapshot), `inspection_uploads`, `inspection_findings`, `inspection_assignees`. Storage bucket `inspection-uploads`.
> - Permissions: `template:{read_org,create,edit,publish,archive,assign}`, `inspection:{read_site,start,edit_own,edit_any,complete,delete}`, `finding:{read,resolve,escalate}`.
> - `/templates` (org-scoped imported list — table with status, last-modified, "Start Inspection", actions menu).
> - `/templates/browse` (system-preset library — SafetyCulture-style card grid, industry filter, featured chip, "Import" CTA).
> - `/templates/new` (blank create) and `/templates/[id]/edit` (versioned builder — left sidebar items tree, central canvas, right options panel; drag-reorder via @dnd-kit; autosave 1s debounce on draft version; publish-with-change-summary).
> - `/templates/[id]/assign` (per-site or "all sites" + schedule shape, hierarchy-aware via `site_members.include_children`).
> - `/inspections` (list with status filter, search, "Start Inspection" picker, table or mobile-card view).
> - `/inspections/[id]` (runner — mobile-first checklist; renders header items first, then body items grouped by section/category; per-item save debounced; photo + signature uploads to Supabase Storage; progress bar; complete dialog warning on missing required + flagged-items wizard).
> - `/inspections/[id]/findings/[findingId]` (finding detail — comment, mark resolved, "Escalate to Incident" pre-fills `/incidents/new/1`).
> - 8 MVP item types editable + renderable end-to-end: **section, category, information, question (with answer_set), text, datetime, signature, media** (photo). Items the seed payloads contain that aren't in the MVP (`textsingle`, `address`, `dynamicfield`, `list`, `slider`, etc.) render as a read-only "Unsupported in v1 — extend before publishing" placeholder card; the editor's "+ Add item" picker only shows the MVP 8.
> - Curated library: ~15 system-preset templates seeded across all 7 industries, taken directly from SafetyCulture library payloads (industry strings normalized to our enum: `health-care` → `healthcare`, etc.). Featured chip on 4 of them.
> - Sidebar nav entries for Templates + Inspections, gated on the relevant `read` permission.
> - 6 new RegTooltips (immutable versions, snapshot rule, Compliant/Partly/Non-Compliant grading, photo evidence on failed responses, "all sites" warning, finding → incident escalation path).
> - Seed extension: clone 2 presets into UCB, assign 1 to Houston (daily 06:00) and 1 to Manchester (weekly Mondays 09:00), simulate 1 in-progress and 1 completed inspection so the demo lands on populated lists.
> - `docs/smoke-test-phase3.md` with end-to-end walkthrough.
>
> **Not in this phase:** template Management-of-Change approvals (PRD §15.5.4 — deferred v2); AI-assisted authoring; QR-code attendance; template-import-from-CSV; the deferred 7 item types (`list`, `number`, `slider`, `checkbox`, `drawing`, `address`, `asset`, `site`, `smartfield`, `dynamicfield`, `temperature`, `textsingle` — read-only fallback only); inspection report PDF; recurring-inspection auto-creation cron (Phase 4-or-later); offline mode; Resources Assets/Documents library (Phase 4 next); Planner (Phase 5).

---

## Definition of done

A stakeholder dropping in unannounced after Phase 3 sees:

1. **Library page renders.** Sign in as `admin@demo.local` → `/templates/browse` → SafetyCulture-style card grid with the seeded ~15 presets. Each card: logo (or initial avatar), name, 1-line description (truncated), industry chip, "Featured" chip on the 4 featured ones, "Import" button. Filters: `?industry=&q=&featured=`. Clicking a card opens a **read-only preview drawer** showing the title page + body checklist (rendered via the same `<ChecklistRenderer>` used by the runner).
2. **Import works.** Clicking "Import" on a preset card creates a new org-scoped `templates` row (status=`draft`, `is_imported=true`, `source_preset_id=<preset>`), copies the preset's current `template_versions` payload into a new `v1` draft (regenerating item UUIDs to avoid collisions), and routes to `/templates/[id]/edit`. The preset row is unchanged. Re-importing the same preset is allowed (creates a separate copy — useful for branching).
3. **Imported list renders.** `/templates` → table grouped by industry (sticky industry headers); columns: name, status badge (Draft / Published / Archived), version (`v2`), last-modified, "Start Inspection" (disabled when `status='draft'`), actions menu (Edit / Duplicate / Archive). Filters: `?industry=&status=&q=`. "+ New template" button visible with `template:create`. "Browse Library" link in the page header.
4. **Editor end-to-end.** `/templates/[id]/edit` mounts a 3-column layout — left sidebar items tree (Header tab + Body tab; drag-reorder via @dnd-kit; nested by parent), central canvas (selected item rendered as it'll appear in the runner), right options panel (item type label, required toggle, answer-set picker for question items, etc.). All edits autosave at 1s debounce to the **draft version** — never to a published version. Top bar shows sync status ("Synced" / "Saving..." / "Unsaved changes"). Top-right "Publish v{N+1}" opens a `<ChangeSummaryDialog>` (textarea required, ≥ 10 chars), then atomically creates a new immutable `template_versions` row, sets `templates.current_version_id`, archives the previous version, and writes a `template.published` activity event.
5. **Versioned history works.** `/templates/[id]?version=2` renders the v2 snapshot read-only via the same `<ChecklistRenderer>`. A "Versions" right drawer (`?versions=open`) lists every version with `change_summary`, `published_by` avatar, `published_at` relative time, "View" link. Editing always operates on the working draft (or auto-creates one cloned from current_version_id on first edit).
6. **Assign page works.** `/templates/[id]/assign` — per-site checkboxes (with hierarchy include_children toggle per site) or "all sites" radio, `schedule_kind` (daily / weekly / monthly / custom / on_demand) + `start_time_local`. Submitting upserts `template_assignments`. "Remove" sets `unassigned_at`. Assignment of a draft template is rejected.
7. **Inspections list renders.** Sign in as `worker@demo.local` → `/inspections` → table with seeded rows showing 1 in-progress + 1 completed. Columns: title, source template, conducted-on, status (chip + dot), actions. Filters: `?template=&status=&site=&q=`. "Start Inspection" button → opens picker modal listing **published** templates the user has access to start (per `inspection:start` + active assignments at the user's site). Picking one creates a new `inspections` row with `template_version_id` snapshotted from the assignment's current version, then routes to `/inspections/[id]`.
8. **Runner end-to-end on mobile breakpoint.** `/inspections/[id]` — mobile-first single-column layout. Topbar: back button, title (auto-filled from template name + site + date), timer, "Submit" CTA. Header card renders the title-page items (auto-populates "Conducted on" with `now()` and "Inspector" with the current user). Body items render section-by-section, each with a progress chip (`3/12 answered`). Per-item input components (single-select buttons for `question`, textarea for `text`, datetime picker for `datetime`, signature canvas for `signature`, photo upload for `media`, label-only for `information` and unsupported types). Each answer save calls `saveInspectionAnswer(inspectionId, itemKey, payload)` server action, debounced 500ms.
9. **Photo + signature uploads work.** `media` items support drag-drop or camera capture; uploads go to `inspection-uploads/<inspectionId>/<uuid>-<filename>` with path-prefix RLS. `signature` items render a canvas with pen/clear; on submit the canvas converts to a PNG, uploads, and stores `{ name, upload_id, signed_at }` in the answer payload. Signed-URL fetches in the report.
10. **Submit / complete works.** Clicking "Submit" → walks the items tree, lists any **required+unanswered** items in a confirmation modal, blocks submit until they're filled or marked N/A. If any responses are `failed=true` (per the answer_set's `failed` flag), shows a "Flagged items detected" wizard listing them with a comment textarea each. Final submit calls `completeInspection(inspectionId)` which: sets `status=completed`, `completed_at=now()`, computes `score_total` / `score_max`, sets `is_failed` = (any failed answer), inserts `inspection_findings` rows for each failed answer (status=`open`, capturing item label, response label, comment, photo paths), writes `inspection.completed` activity event.
11. **Findings surface.** `/inspections/[id]` after completion → "Findings" tab listing the auto-created findings. `/inspections/[id]/findings/[findingId]` → finding detail with item label, failed response, comment, photo gallery, status pill, "Mark resolved" + "Escalate to Incident" buttons. Escalate writes a draft `incidents` row pre-filling `description` from the finding label + comment, `area` from the inspection's site, then routes to `/incidents/new/1` with the draft id pre-loaded.
12. **Snapshot rule is real.** Re-edit the template after publishing → make a substantive change → publish v2 → confirm via `select template_version_id from inspections where id = <existing>` that the running inspection still points at v1. The runner UI continues to render v1's items.
13. **Permissions enforced at all 3 layers.** Sidebar entries hidden when missing read perm. Server actions reject when user lacks the relevant key. RLS denies cross-org SELECT/UPDATE on `templates` / `template_versions` / `inspections` and cross-site on the rest. The 4 default seeded roles get the perm bundle from §A4.
14. **Library presets seeded.** ~15 system-preset rows across all 7 industries, taken directly from the SafetyCulture library JSON shape — `org_id IS NULL`, `is_system_preset=true`, one `template_versions` row at `v1 active`. 4 are `is_featured=true`.
15. **Demo lists are populated.** `scripts/seed.ts` clones 2 presets into UCB, assigns each to Houston/Manchester respectively, creates 1 in-progress inspection and 1 completed inspection (with a failed item → 1 finding) so the demo lands on populated lists, not empty states.
16. **6 new RegTooltips render.** (1) Library "Import" → "Cloning copies items into your org so you can edit them. The preset itself stays untouched." (2) Editor "Publish v{N+1}" → "Publishing creates a new immutable version. In-flight inspections continue against the version they were started with." (3) Editor "Versions" → "Older versions stay readable for audit. They can never be edited." (4) Assign "All sites" → "Assigns the active version to every site in your org. Hierarchy: child sites only inherit when the user assigning has 'include children' on the parent." (5) Runner answer set on the first failed response → "Failed responses become findings — the EHS team can review, mark resolved, or escalate to an incident." (6) Finding "Escalate to Incident" → "Escalates this finding into the Phase 1 Report Wizard. The investigation tracks back via `escalated_from_finding_id`."
17. **`pnpm dev` console clean.** No hydration warnings, no `'use cache'` errors, no Supabase RLS noise, no Cache Components runtime errors, no Storage CORS warnings.
18. **Smoke test passes** per `docs/smoke-test-phase3.md`.

Phase 3 explicitly does **not** include: template Management-of-Change approvals; AI-assisted authoring; QR-code attendance; CSV template import; the 7 deferred item types in editor (read-only fallback only); inspection report PDF; offline mode; auto-creation cron for scheduled inspections (creating runs from active assignments); Resources / Planner.

---

## Task list (ordered)

### A. Schema deltas + RBAC additions

#### 1. Migration: `phase3_templates_inspections_schema`

```sql
-- Enums
create type template_status     as enum ('draft', 'published', 'archived');
create type template_schedule_kind as enum ('daily', 'weekly', 'monthly', 'custom', 'on_demand');
create type inspection_status   as enum ('draft', 'in_progress', 'completed', 'abandoned');
create type finding_status      as enum ('open', 'in_progress', 'resolved', 'escalated_to_incident');

-- Note: industry_type enum already exists from Phase 0 with v1 values.
-- SafetyCulture industries map: 'health-care' → 'healthcare', 'construction' → 'construction', etc.
-- Mapping is done in seed (see §A5), no enum change needed.

-- ---------------------------------------------------------------------------
-- templates: pointer + metadata (org-scoped or system preset)
-- ---------------------------------------------------------------------------
create table templates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references orgs(id) on delete cascade,        -- NULL = system preset
  slug                text,                                                -- for system presets, mirrors SafetyCulture slug
  name                text not null,
  description         text,
  logo_url            text,
  industry            industry_type not null,
  status              template_status not null default 'draft',
  is_system_preset    boolean not null default false,
  is_featured         boolean not null default false,
  is_imported         boolean not null default false,                      -- true when cloned from a preset
  source_preset_id    uuid references templates(id) on delete set null,
  current_version_id  uuid,
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  check (
    (is_system_preset = true and org_id is null)
    or (is_system_preset = false and org_id is not null)
  )
);
create index on templates(org_id) where org_id is not null;
create index on templates(industry);
create index on templates(is_system_preset);

-- ---------------------------------------------------------------------------
-- template_versions: immutable post-publish, JSONB header + items + template_data
-- ---------------------------------------------------------------------------
create table template_versions (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references templates(id) on delete cascade,
  version_number  smallint not null,
  status          template_status not null default 'draft',
  change_summary  text,                                                    -- required when transitioning to 'published'
  header          jsonb not null default '[]'::jsonb,                      -- TemplateNodeItem[]
  items           jsonb not null default '[]'::jsonb,                      -- TemplateNodeItem[]
  template_data   jsonb not null default '{"answer_sets":{},"condition_sets":[]}'::jsonb,
  published_by    uuid references profiles(id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (template_id, version_number)
);
create index on template_versions(template_id);

alter table templates
  add constraint templates_current_version_fk
  foreign key (current_version_id) references template_versions(id) on delete set null;

-- TemplateNodeItem shape (JSONB):
-- {
--   item_id: uuid,
--   parent_id?: uuid,           -- omitted for root section
--   type: 'section' | 'category' | 'information' | 'question' | 'text' | 'datetime' | 'signature' | 'media' | <unsupported_passthrough>,
--   label: string,
--   options: {
--     sort_order: number,
--     is_mandatory?: boolean,
--     answer_set?: uuid,         -- for 'question' type
--     enable_signature_timestamp?: boolean,
--     ... (per-type passthrough fields kept verbatim from SafetyCulture-shaped seed)
--   }
-- }
--
-- template_data shape:
-- {
--   answer_sets: { [id]: { id, type: 'question'|'list', responses: [{ id, label, score, colour, enable_score, failed }] } },
--   condition_sets: [{ id, type: 'is'|'is not'|... }]
-- }

-- ---------------------------------------------------------------------------
-- template_assignments: per-site or all-sites + schedule
-- ---------------------------------------------------------------------------
create table template_assignments (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references templates(id) on delete cascade,
  template_version_id uuid not null references template_versions(id),
  site_id             uuid not null references sites(id) on delete cascade,
  include_children    boolean not null default false,
  schedule_kind       template_schedule_kind not null,
  schedule_cron       text,                                                -- for 'custom'
  start_time_local    time,
  assigned_by         uuid references profiles(id) on delete set null,
  assigned_at         timestamptz not null default now(),
  unassigned_at       timestamptz
);
create unique index template_assignments_active_uniq
  on template_assignments(template_id, site_id)
  where unassigned_at is null;
create index on template_assignments(site_id) where unassigned_at is null;
create index on template_assignments(template_version_id);

-- ---------------------------------------------------------------------------
-- inspections: a run, with frozen template_version_id snapshot
-- ---------------------------------------------------------------------------
create table inspections (
  id                  uuid primary key default gen_random_uuid(),
  ref_code            text not null unique,                                -- INSP-2026-0001 etc, generated like incident ref codes
  template_id         uuid not null references templates(id),
  template_version_id uuid not null references template_versions(id),     -- IMMUTABLE post-create
  assignment_id       uuid references template_assignments(id) on delete set null,
  site_id             uuid not null references sites(id) on delete restrict,
  title               text not null,
  inspector_id        uuid references profiles(id) on delete set null,
  status              inspection_status not null default 'in_progress',
  conducted_at        timestamptz,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  abandoned_at        timestamptz,
  header_responses    jsonb not null default '{}'::jsonb,                  -- { item_id: AnswerShape }
  answers             jsonb not null default '{}'::jsonb,                  -- { item_id: AnswerShape }
  score_total         integer,
  score_max           integer,
  is_failed           boolean not null default false,                      -- has at least one failed=true answer
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz                                          -- soft-delete only
);
create index on inspections(site_id, status) where deleted_at is null;
create index on inspections(template_id) where deleted_at is null;
create index on inspections(inspector_id) where deleted_at is null;

-- AnswerShape (per item_id):
-- {
--   selected_option_id?: uuid,                  -- for 'question' / 'list'
--   selected_option_failed?: boolean,           -- denormalized from answer_set for fast filtering
--   response_text?: string,                     -- for 'text'
--   response_value?: { value: iso } | { upload_id: string, name: string } | { ... },
--   notes?: string,
--   updated_at: iso
-- }

-- ---------------------------------------------------------------------------
-- inspection_uploads: photo / signature files
-- ---------------------------------------------------------------------------
create table inspection_uploads (
  id              uuid primary key default gen_random_uuid(),
  inspection_id   uuid not null references inspections(id) on delete cascade,
  item_id         text not null,                                           -- maps to TemplateNodeItem.item_id
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  uploaded_by     uuid references profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  deleted_at      timestamptz
);
create index on inspection_uploads(inspection_id);

-- ---------------------------------------------------------------------------
-- inspection_findings: failed responses materialized into actionable rows
-- ---------------------------------------------------------------------------
create table inspection_findings (
  id                      uuid primary key default gen_random_uuid(),
  ref_code                text not null unique,                            -- FIND-2026-0001
  inspection_id           uuid not null references inspections(id) on delete cascade,
  item_id                 text not null,
  item_label              text not null,
  failed_response_label   text,
  comment                 text,
  photo_paths             text[] not null default '{}',
  status                  finding_status not null default 'open',
  resolved_at             timestamptz,
  resolved_by             uuid references profiles(id) on delete set null,
  escalated_incident_id   uuid references incidents(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on inspection_findings(inspection_id);
create index on inspection_findings(status) where status in ('open','in_progress');

-- ---------------------------------------------------------------------------
-- inspection_assignees: optional multi-assignee (a finding to investigate, a co-inspector)
-- ---------------------------------------------------------------------------
create table inspection_assignees (
  inspection_id  uuid not null references inspections(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  assigned_at    timestamptz not null default now(),
  primary key (inspection_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- RLS policies (templates)
-- ---------------------------------------------------------------------------
alter table templates             enable row level security;
alter table template_versions     enable row level security;
alter table template_assignments  enable row level security;
alter table inspections           enable row level security;
alter table inspection_uploads    enable row level security;
alter table inspection_findings   enable row level security;
alter table inspection_assignees  enable row level security;

-- Templates: system presets visible to all auth'd users; org rows visible where org_id = current_org()
-- Inserts/updates: require can('template:create' / 'template:edit', org)
-- System-preset UPDATE/DELETE denied to PUBLIC (only seed migrations write to them)
-- Template versions: same SELECT scope as parent; UPDATE blocked when status='published' (immutability)
-- Template assignments: site-scoped via site_members
-- Inspections: site-scoped SELECT; INSERT requires can('inspection:start', site_id);
--   UPDATE answers requires can('inspection:edit_own') and inspector_id = auth.uid(),
--                   OR can('inspection:edit_any', site_id)
-- Inspection uploads: same site scope as parent inspection; INSERT path-prefix matches inspection_id
-- Inspection findings: same SELECT scope; UPDATE requires can('finding:resolve' / 'finding:escalate', site_id)
```

#### 2. Migration: `phase3_template_publish_rpc`

Atomic Postgres function `publish_template_version_v1(template_id uuid, draft_version_id uuid, change_summary text)`:
1. Asserts caller has `template:publish` on the template's org.
2. Asserts `draft_version_id.status = 'draft'` AND `draft_version_id.template_id = template_id`.
3. Asserts the draft has at least one item (rejects empty templates).
4. Sets the previous `current_version_id` row's `status = 'archived'` (if not null).
5. Sets the draft's `status = 'published'`, `change_summary`, `published_by = auth.uid()`, `published_at = now()`.
6. Sets `templates.current_version_id = draft_version_id`, `templates.status = 'published'`.
7. Inserts an `activity_events` row (`verb = 'template.published'`, payload = `{template_id, version_number, change_summary}`).

Wrapping in an RPC for the same reason as Phase 1's `classify_incident_v1` — multi-row update needs a transaction.

#### 3. Migration: `phase3_import_preset_rpc`

Atomic `import_preset_to_org_v1(preset_id uuid)`:
1. Asserts caller has `template:create` on their org.
2. Asserts target preset has `is_system_preset = true`.
3. Inserts a new `templates` row: same `industry` / `name` / `description` / `logo_url`, `org_id = current_org()`, `is_system_preset = false`, `is_imported = true`, `source_preset_id = preset_id`, `status = 'draft'`.
4. Inserts a new `template_versions` row at `version_number = 1`, `status = 'draft'`, copies `header` + `items` + `template_data` from the preset's current version. **Item UUIDs are regenerated** to avoid cross-template collisions in future joins (recursive walk; preserves `parent_id` linkage by maintaining a remap table).
5. Sets the new template's `current_version_id` to the new draft.
6. Returns the new template id.

#### 4. Migration: `phase3_inspection_complete_rpc`

Atomic `complete_inspection_v1(inspection_id uuid)`:
1. Asserts caller is the inspector OR has `inspection:edit_any` on the site.
2. Reads the inspection's `answers` JSONB; computes `score_total` (sum of selected_option scores from the answer_sets) and `score_max` (sum of max scores per question item).
3. Walks the answers, finds entries with `selected_option_failed = true`, inserts an `inspection_findings` row per failed answer with item label + response label + any comment/notes from the answer.
4. Updates `inspections` row: `status = 'completed'`, `completed_at = now()`, `score_total`, `score_max`, `is_failed = (count of failed > 0)`.
5. Inserts an `activity_events` row (`verb = 'inspection.completed'`, payload = `{inspection_id, score_total, score_max, finding_count}`).

#### 5. Migration: `phase3_template_inspection_permissions_seed`

Add permission keys + grants. Idempotent inserts via `on conflict do nothing`, then loop existing orgs and grant per matching default-role row:

| Key | Worker | Supervisor | EHS Manager | Site Admin |
|---|---|---|---|---|
| `template:read_org` | ✓ | ✓ | ✓ | ✓ |
| `template:create` |  |  | ✓ | ✓ |
| `template:edit` |  |  | ✓ | ✓ |
| `template:publish` |  |  | ✓ | ✓ |
| `template:archive` |  |  | ✓ | ✓ |
| `template:assign` |  |  | ✓ | ✓ |
| `inspection:read_site` | ✓ | ✓ | ✓ | ✓ |
| `inspection:start` | ✓ | ✓ | ✓ | ✓ |
| `inspection:edit_own` | ✓ | ✓ | ✓ | ✓ |
| `inspection:edit_any` |  | ✓ | ✓ | ✓ |
| `inspection:complete` | ✓ | ✓ | ✓ | ✓ |
| `inspection:delete` |  |  | ✓ | ✓ |
| `finding:read` | ✓ | ✓ | ✓ | ✓ |
| `finding:resolve` |  | ✓ | ✓ | ✓ |
| `finding:escalate` |  | ✓ | ✓ | ✓ |

(Some `template:*` keys were partially seeded in Phase 0 — verify and grant if missing.)

Add the keys to `lib/rbac/permissions.ts` const enum.

#### 6. Migration: `phase3_library_preset_seed`

Insert ~15 system-preset templates curated from the SafetyCulture library payloads provided by the user, one `template_versions` row at `v1 published` per template. Industry strings normalized:
- SafetyCulture `health-care` → our `healthcare`
- SafetyCulture `construction` → our `construction` (matches)
- SafetyCulture `manufacturing` → our `manufacturing` (matches)
- (etc. — full mapping table in `lib/templates/industry-map.ts`)

Curated library — at least 2 templates per industry, 4 marked `is_featured`:

| Industry | Template name (from SC library) | Featured? |
|---|---|---|
| healthcare | Medical Audit Checklist | ✓ |
| healthcare | Infection Prevention and Control Rounds |  |
| manufacturing | Forklift Pre-Use Inspection | ✓ |
| manufacturing | Machine Guarding Pre-Shift |  |
| warehouse | Pallet-Rack Quarterly Inspection |  |
| warehouse | Warehouse Aisle Housekeeping | ✓ |
| office | Office Ergonomic Workstation | ✓ |
| office | Fire Extinguisher Monthly |  |
| construction | Daily Site Tailgate Check |  |
| construction | Scaffold Inspection |  |
| education | Classroom Hazard Walk |  |
| education | Playground Equipment Monthly |  |
| lab | Fume Hood Monthly Verification |  |
| lab | Eyewash Station Weekly |  |

Source data: real SafetyCulture-shape JSON. Stored as `header` + `items` + `template_data` JSONB on the `template_versions` row, IDs regenerated. The 4 featured templates use full content (~30+ items, 3+ answer_sets); the rest use abbreviated content (~6-10 items, 1 answer_set) to keep the seed migration size sane. Full content extension is tracked as a v2 task.

Implementation: `lib/templates/presets/*.json` files imported by the seed migration via `pg_read_binary_file` + `jsonb` cast. Migration is idempotent.

### B. Item-type rendering primitives

#### 7. `lib/templates/item-types.ts`

```ts
export const MVP_ITEM_TYPES = [
  'section', 'category', 'information',
  'question', 'text', 'datetime', 'signature', 'media',
] as const;

export type MvpItemType = (typeof MVP_ITEM_TYPES)[number];

export const NON_ANSWERABLE_TYPES = ['section', 'category', 'information'] as const;

// Typeguard for items that should appear in the editor's "+ Add item" picker
export function isMvpType(t: string): t is MvpItemType { ... }
```

Plus utilities: `walkItems(rootArray)` recursive generator (skip non-answerable for validation walks), `groupBySection(items)`, `findRequiredUnanswered(template, answers)`.

#### 8. `components/templates/item-renderers/`

8 components, one per MVP item type, each with two render modes:
- `mode='editor'` — display + click-to-select (right-panel options edit it)
- `mode='runner'` — input bound to `value` + `onChange`

Plus a `<UnsupportedItemFallback>` for the 7 deferred types — shows a small "Unsupported in v1" badge with the item label, read-only.

| Component | Type | Editor render | Runner render |
|---|---|---|---|
| `<SectionItem>` | section | header bar with rename + drag handle | section heading + collapsible group |
| `<CategoryItem>` | category | sub-header with rename | sub-heading |
| `<InformationItem>` | information | static text block | static text block |
| `<QuestionItem>` | question | label + answer-set picker preview | answer buttons (single-select), photo upload if `photo_required_if_fail` |
| `<TextItem>` | text | label + multi-line preview | textarea, autosave on blur |
| `<DateTimeItem>` | datetime | label + format pills | date + time picker |
| `<SignatureItem>` | signature | label + "Signature" placeholder | name input + canvas (pen, clear, save) → uploads PNG |
| `<MediaItem>` | media | label + camera icon | drag-drop / file picker / camera button → upload |

#### 9. `components/templates/ChecklistRenderer.tsx`

Server- or client-rendered (depends on mode). Reads `template_versions.header` + `items` + `template_data.answer_sets`. Renders the header card first, then groups body items by `section.item_id`, then renders each item via the item-renderers. Validates required + flagged on submit (delegated to `lib/templates/validation.ts`).

Used by:
- Library preview drawer (read-only)
- Editor canvas (preview tab)
- Inspection runner (interactive)
- Read-only version viewer (`/templates/[id]?version=N`)
- Inspection report view (`/inspections/[id]` after completion)

### C. Library page + import

#### 10. `/templates/browse/page.tsx`

Card grid of system presets. `?industry=&q=&featured=`. Each card opens a preview drawer; "Import" CTA on the drawer or directly on the card. Tooltips per §16.1.

#### 11. `clonePresetToOrg` server action

Wraps `import_preset_to_org_v1` RPC. Returns `{ ok: true, template_id }` on success → caller redirects to `/templates/[id]/edit`.

### D. Imported list page

#### 12. `/templates/page.tsx`

Org-scoped list (status, last-modified, "Start Inspection", actions menu). Filters: `?industry=&status=&q=`. Header has "+ New template" + "Browse Library" buttons. Empty state CTA: "Browse Library".

#### 13. `/templates/new/page.tsx`

Form: name (required), industry (defaults to user's org industry), description. Submit → `createTemplate(...)` writes the `templates` row + a blank `v1` draft → redirects to `/templates/[id]/edit`.

### E. Versioned editor

#### 14. `/templates/[id]/edit/page.tsx` + `<TemplateEditor>` (client)

3-column layout. Implementation strongly modeled on the reference at `app/(protected-pages)/template-editor/_components/TemplateEditorPage.tsx` — adapted to:
- Server Actions instead of axios (autosave debounced 1s → `updateDraftVersion(versionId, header, items, template_data)`).
- `@dnd-kit` instead of `@hello-pangea/dnd` (matches Phase 2's investigation Kanban).
- Supabase client uploads for media items.
- shadcn primitives instead of bespoke UI.

URL state: `?tab=header|body&itemId=<id>&version=draft|<n>&versions=open`. Default = `tab=body, version=draft`.

Top-right: "Publish v{N+1}" button → `<ChangeSummaryDialog>` → `publishTemplateVersion(...)` server action.

#### 15. `/templates/[id]/page.tsx` (read-only viewer)

Renders the version selected by `?version=<n>` (default = current). Shows `<ChecklistRenderer>` in read-only mode + a `<VersionsPanel>`. "Edit" button (gated on `template:edit`) routes to `/edit`.

#### 16. Editor server actions in `lib/actions/templates.ts`

- `createTemplate(name, industry, description?)` — writes templates + blank v1 draft.
- `updateDraftVersion(versionId, header, items, template_data)` — Zod-validates the JSON shape; rejects if not `status='draft'`; sets `updated_at`.
- `publishTemplateVersion(templateId, draftVersionId, changeSummary)` — wraps the RPC.
- `createNewDraftFromCurrent(templateId)` — auto-called when a user with `template:edit` opens an active template's edit route; clones items into a new draft `version_number = current + 1`. Idempotent: returns existing draft if one exists.
- `archiveTemplate(templateId)` — soft-archive; idempotent.
- `duplicateTemplate(templateId)` — full clone within the same org (different name) — for "fork before edit" workflow.

### F. Assign page

#### 17. `/templates/[id]/assign/page.tsx`

Two-mode form (per-site checkboxes vs all-sites). Schedule fields apply to all checked sites. Existing assignments listed below with "Remove" action that sets `unassigned_at`.

#### 18. Assign server actions in `lib/actions/templates.ts`

- `assignTemplate(templateId, payload)` — Zod-validates; loops sites; per-site `can('template:assign', siteId)`; rejects if version not published.
- `unassignTemplate(assignmentId)` — sets `unassigned_at`.

### G. Inspections list + start picker

#### 19. `/inspections/page.tsx`

Table with status filter, search, "Start Inspection" button → opens `<StartInspectionDialog>`.

#### 20. `<StartInspectionDialog>`

Lists templates the user can start at their current site (joins `template_assignments` + `templates` where the user has `inspection:start` on the site). Shows: template name, last-edited, "Start" button. On Start → `startInspection(templateId, assignmentId, siteId)` server action → creates `inspections` row with `template_version_id` snapshotted from the assignment → routes to `/inspections/[id]`.

#### 21. Inspection list server queries

`/inspections` reads `inspections_visible` joined with `templates` for the source-template column. Sandbox + soft-deleted excluded.

### H. Inspection runner

#### 22. `/inspections/[id]/page.tsx` + `<InspectionRunner>` (client)

Mobile-first. Single column on `< md`. Topbar (back, title, timer, Submit). Header card → `<ChecklistRenderer mode="runner" items={template.header} />`. Body → grouped sections.

Auto-populate: header items flagged `auto_populate: 'inspector'` get the current user's name; `auto_populate: 'now'` get `new Date()`. Done client-side on first mount.

Per-item save: each item-renderer's `onChange` debounced 500ms → `saveInspectionAnswer(inspectionId, itemId, payload)` server action → upserts the JSONB key in `inspections.answers`. Optimistic UI; tiny "Saved" indicator.

Photo / signature uploads: client-side signed-URL upload → server action `attachInspectionUpload(inspectionId, itemId, storagePath, fileName, mime, size)` writes the metadata row and returns the upload_id; runner stores `{ upload_id, name }` in the answer.

#### 23. Submit / complete flow

"Submit" button → walks items via `walkItems()` to find required+unanswered → if any, modal lists them with "Mark N/A" or "Go to item" buttons, blocks submit. If all required filled, walks again to find `failed=true` answers → modal lists each with a comment textarea + "Add photo" button → on confirm calls `completeInspection(inspectionId)` (wraps the RPC). On success → redirects to `/inspections/[id]?view=report`.

#### 24. Inspection runner server actions in `lib/actions/inspections.ts`

- `startInspection(templateId, assignmentId, siteId, title?)`
- `saveInspectionAnswer(inspectionId, itemId, payload)`
- `attachInspectionUpload(inspectionId, itemId, storagePath, fileName, mime, size)`
- `removeInspectionUpload(uploadId)` — soft-deletes upload row + clears the answer reference.
- `completeInspection(inspectionId)` — wraps the RPC.
- `abandonInspection(inspectionId, reason?)` — sets status=`abandoned`, `abandoned_at`.

### I. Findings

#### 25. `/inspections/[id]/findings/[findingId]/page.tsx`

Detail page: item label, failed response, comment, photo gallery, status pill. Buttons: "Mark resolved" (gated on `finding:resolve`), "Escalate to Incident" (gated on `finding:escalate`).

#### 26. Findings server actions in `lib/actions/findings.ts`

- `resolveFinding(findingId, notes?)` — sets `status='resolved'`, `resolved_at`, `resolved_by`.
- `escalateFindingToIncident(findingId)` — creates a draft `incidents` row pre-filled from finding (description = `${item_label}\n\n${comment}`, area = inspection.site.area, type = `unsafe_condition`, reporter = current user, is_sandbox = false). Sets finding's `status='escalated_to_incident'`, `escalated_incident_id`. Returns `{ ok: true, incident_id }` → caller redirects to `/incidents/new/1?id=<draft>`.

### J. Storage bucket

#### 27. `inspection-uploads` bucket setup

Migration creates the bucket (private), with path-prefix RLS:
- INSERT requires the user to have `inspection:edit_own` AND `inspector_id = auth.uid()` on the inspection, OR `inspection:edit_any` on the site.
- SELECT path = `<inspection_id>/...` joined to the user's site visibility on `inspections`.

### K. Sidebar nav + tooltips

#### 28. `nav-config.ts`

Add:
```ts
{ href: "/templates",   label: "Templates",   icon: ClipboardCheck, permission: "template:read_org" },
{ href: "/inspections", label: "Inspections", icon: ClipboardSignature, permission: "inspection:read_site" },
```
Insert between `/capa` and `/reports`.

#### 29. RegTooltips

Append the 6 new entries (per §Definition-of-done item 16) to `docs/onboarding.md` §8.

### L. Seed extension + smoke test

#### 30. `scripts/seed.ts`

After Phase 2 seed:
- Import 2 presets to UCB: "Forklift Pre-Use Inspection" → assigned daily 06:00 to Houston with include_children=true; "Office Ergonomic Workstation" → assigned weekly Monday 09:00 to Manchester with include_children=true.
- Simulate 1 in-progress inspection: Houston worker started a forklift check this morning, 3/12 items answered, status=`in_progress`.
- Simulate 1 completed inspection: yesterday's forklift check, all items answered, 1 failed response → 1 finding row at `status='open'`. Score 11/12.
- Simulate 1 finding-escalated-to-incident: a finding from 3 days ago (forklift hydraulic leak) escalated → links to a draft incident row (uses the existing `escalated_from_finding_id` column added in this phase).

#### 31. `docs/smoke-test-phase3.md`

10–15 minute walkthrough:
1. Sign in as `admin@demo.local` → `/templates/browse` → confirm 14 cards rendered, 4 featured, 7 industries represented. Filter by `?industry=manufacturing`.
2. Click "Forklift Pre-Use Inspection" preview → preview drawer opens → confirm header + items render correctly via `<ChecklistRenderer>`.
3. Click "Import" → routes to `/templates/[id]/edit` → confirm draft v1 has all items + answer_sets copied.
4. Edit one question's label, drag a section to reorder, change an answer-set color.
5. Click "Publish v1" → enter change summary "Initial publish" → confirm toast, badge changes to "Published".
6. Re-edit (auto-creates draft v2) → publish v2 → confirm Versions panel shows v1 + v2.
7. Open `/templates/[id]?version=1` → confirm v1 rendered read-only.
8. Click "Assign" → check Houston box → schedule daily 06:00 → submit.
9. SQL spot-check: `select template_version_id from template_assignments where template_id = ?` confirms v2.
10. Sign out, sign in as `worker@demo.local` (Houston member) → `/inspections` → see the seeded in-progress + completed rows.
11. Click "Start Inspection" → pick "UCB Forklift Pre-Use" → routes to `/inspections/[id]` → header auto-populates inspector + datetime.
12. Answer 5 items including a failed response, upload a photo, sign on a `signature` item.
13. Click "Submit" → confirm required-field warning if any, fill, then flagged-items wizard appears, add a comment, complete.
14. Verify `/inspections/[id]` shows the report view + Findings tab with 1 row.
15. Open the finding → click "Escalate to Incident" → confirm routing to `/incidents/new/1?id=<draft>` with description pre-filled.
16. Sign in as `ehs@demo.local` → confirm finding is visible at `/inspections/[id]/findings/[id]`.
17. Console clean: no Cache Components errors, no RLS noise, no Storage CORS warnings.

### M. Wrap

#### 32. CLAUDE.md status bump

Append the build-status paragraph: "Phase 3 merged via PR #4 (date) — templates + inspections module shipped. Library + import flow, versioned editor (8 MVP item types editable, 7 read-only fallback), per-site assignments with snapshot rule enforced, mobile-first inspection runner with photo + signature upload to Supabase Storage, failed responses → findings → escalate-to-incident chain. SafetyCulture-shaped data model adopted (see SPEC §15)."

#### 33. SPEC.md updates

Append two §15 entries:
- "Phase 3 expanded scope: Templates + Inspections collapsed into one phase (was Phases 3 + 4) — shared rendering primitives made the split wasteful."
- "Phase 3 data model: SafetyCulture-shaped flat-items-with-parent_id, JSONB on template_versions; ports the workplace-safety-frontend reference's editor + runner data model verbatim. Lets us seed real SafetyCulture-library JSON payloads without translation."

Also bump §13 phase mapping to merge old-Phase-4 into Phase 3, and shift Resources / Planner up by one (now Phases 4 / 5).

#### 34. PR

Per `.claude/rules/github-workflow.md`: PR title `feat: phase 3 — templates + inspections module`. Squash to a single commit on merge. Conventional Commits.

---

## Open questions (raise before code)

1. **Item-type fallback strategy.** The MVP supports 8 item types editable + renderable. The seed payloads contain 7+ types not in the MVP (`textsingle`, `address`, `dynamicfield`, etc.). Plan: render them as a read-only `<UnsupportedItemFallback>` in the runner; hide them from the editor's "+ Add" picker; the editor canvas shows them with a "v1: unsupported, v2 will add" badge. Confirm OK.
2. **Inspection answers — JSONB on `inspections` row vs normalized `inspection_answers` table.** Going with JSONB for v1 simplicity — the entire answers blob is a single key:value map keyed by item_id, written via JSONB merge on each save. Trade-off: harder to query "all inspections that failed item X" (would need a JSONB index). Acceptable for v1; SPEC §15 entry if changed.
3. **Inspection scoring.** SafetyCulture's score model: each answer_set response has a `score` and `enable_score`; total = sum of selected option scores; max = sum of (max selectable score per question). Storing computed totals on `inspections.score_total` / `score_max` for fast list queries. Recompute happens at `complete_inspection_v1` time only — drafts don't show partial scores.
4. **Library curation scope.** 14 presets across 7 industries (4 featured, 10 abbreviated). Confirm OK vs a larger set (you mentioned 957 templates exist; we don't need all of them). Full content extension tracked as v2.
5. **Industry mapping.** Map SafetyCulture's `health-care` → our `healthcare`. The full mapping table lives at `lib/templates/industry-map.ts`. Any industry the user provides in a payload that isn't in our 7-value enum gets mapped to `office` as a fallback (with a warning in the seed log).
6. **Real SafetyCulture API proxy?** Confirmed NO — the user's payload is a sample of the API response shape for our reference, not an integration. We seed our DB with a curated subset of the JSON shape and serve from our own DB. Real API integration deferred to v2.
7. **Recurring-inspection auto-creation cron.** PRD §15.5.4 calls for a daily cron that creates due `Inspection` rows from active `template_assignments` based on `schedule_kind`. Plan: NOT in Phase 3. The schedule fields land on the assignment row in this phase; the cron handler that materializes runs from them is a Phase 4-or-later add. For Phase 3 demo, inspections are started manually via the picker (which is what the SafetyCulture reference also does — schedules don't auto-create runs there either). SPEC §15 entry to log this.
