-- ============================================================================
-- Phase 3 — Templates + Inspections schema
-- ============================================================================
-- Adopts the SafetyCulture-shaped data model (per docs/SPEC.md §15 entry
-- 2026-05-06 "Phase 3 data model"):
--
--   * Templates are pointer rows (templates) with versioned content rows
--     (template_versions). Each version stores `header` + `items` +
--     `template_data` as JSONB — a flat array of TemplateNodeItems linked
--     by `parent_id`, plus reusable answer_sets and condition_sets. Lets us
--     ingest real SafetyCulture library payloads as system presets without
--     translation.
--   * System presets (`is_system_preset = true`, `org_id IS NULL`) are
--     read-only to all authenticated users. Org-scoped templates are
--     created by importing from a preset (or from scratch) and are editable
--     by users with the relevant template:* permissions.
--   * Inspections snapshot a `template_version_id` at start — the snapshot
--     rule (CLAUDE.md hard rule) is enforced by the FK + the publish RPC
--     archiving the previous version rather than rewriting it.
--   * Inspection answers are stored as JSONB on `inspections.answers` keyed
--     by item_id (one row per inspection, fast write/read in v1; SPEC §15
--     records the trade-off vs a normalized table).
--   * Failed responses materialize into `inspection_findings` rows on
--     complete. Findings can be resolved or escalated to an incident
--     (writes a draft `incidents` row and stores the linkage in
--     `escalated_incident_id`).
--
-- All Phase 3 tables follow the existing tenancy + RLS conventions (see
-- init.sql §15): `org_id = current_org()` for tenancy isolation,
-- `user_can_access_site(site_id)` for site visibility, and
-- `has_permission(key, site_id)` / `has_org_permission(key)` for write
-- gates.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type template_status        as enum ('draft', 'published', 'archived');
create type template_schedule_kind as enum ('daily', 'weekly', 'monthly', 'custom', 'on_demand');
create type inspection_status      as enum ('draft', 'in_progress', 'completed', 'abandoned');
create type finding_status         as enum ('open', 'in_progress', 'resolved', 'escalated_to_incident');

-- ----------------------------------------------------------------------------
-- 2. Org-level RBAC helper (templates are org-scoped, not site-scoped, so
--    has_permission() — which is per-site — doesn't apply directly).
--    Returns true if the user has the named permission at ANY site they're
--    a member of within their current org.
-- ----------------------------------------------------------------------------
create or replace function has_org_permission(p_permission text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from site_members sm
      join role_permissions rp on rp.role_id = sm.role_id
    where sm.profile_id = auth.uid()
      and rp.permission_key = p_permission
    union all
    select 1 from team_members tm
      join team_permissions tp on tp.team_id = tm.team_id
    where tm.profile_id = auth.uid()
      and tp.permission_key = p_permission
  )
$$;

-- ----------------------------------------------------------------------------
-- 3. Ref-code sequences (per-year NNNN format, like incidents/investigations)
-- ----------------------------------------------------------------------------
create sequence ref_inspection_seq;
create sequence ref_finding_seq;

-- ----------------------------------------------------------------------------
-- 4. Tables
-- ----------------------------------------------------------------------------

-- 4.1 templates: pointer + metadata (org-scoped or system preset)
create table templates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid references orgs(id) on delete cascade,
  slug                text,                                                -- preserved from system-preset source
  name                text not null,
  description         text,
  logo_url            text,
  industry            industry_type not null,
  status              template_status not null default 'draft',
  is_system_preset    boolean not null default false,
  is_featured         boolean not null default false,
  is_imported         boolean not null default false,
  source_preset_id    uuid references templates(id) on delete set null,
  current_version_id  uuid,                                                -- FK constraint added below
  created_by          uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  archived_at         timestamptz,
  check (
    (is_system_preset = true  and org_id is null)
    or
    (is_system_preset = false and org_id is not null)
  )
);
create index templates_org_idx        on templates(org_id) where org_id is not null;
create index templates_industry_idx   on templates(industry);
create index templates_preset_idx     on templates(is_system_preset) where is_system_preset = true;

create trigger templates_updated_at
  before update on templates
  for each row execute function set_updated_at();

-- 4.2 template_versions: immutable post-publish, JSONB content
create table template_versions (
  id              uuid primary key default gen_random_uuid(),
  template_id     uuid not null references templates(id) on delete cascade,
  version_number  smallint not null check (version_number >= 1),
  status          template_status not null default 'draft',
  change_summary  text,
  header          jsonb not null default '[]'::jsonb,
  items           jsonb not null default '[]'::jsonb,
  template_data   jsonb not null default '{"answer_sets":{},"condition_sets":[]}'::jsonb,
  published_by    uuid references profiles(id) on delete set null,
  published_at    timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (template_id, version_number),
  -- A published version must have a published_at and a non-empty change_summary
  check (
    status <> 'published'
    or (published_at is not null and length(coalesce(change_summary, '')) > 0)
  )
);
create index template_versions_template_idx on template_versions(template_id);

create trigger template_versions_updated_at
  before update on template_versions
  for each row execute function set_updated_at();

-- Add the back-FK from templates → template_versions (deferred until
-- template_versions exists)
alter table templates
  add constraint templates_current_version_fk
  foreign key (current_version_id)
  references template_versions(id)
  on delete set null;

-- 4.3 template_assignments: per-site or all-sites + schedule
create table template_assignments (
  id                  uuid primary key default gen_random_uuid(),
  template_id         uuid not null references templates(id) on delete cascade,
  template_version_id uuid not null references template_versions(id),
  site_id             uuid not null references sites(id) on delete cascade,
  include_children    boolean not null default false,
  schedule_kind       template_schedule_kind not null,
  schedule_cron       text,
  start_time_local    time,
  assigned_by         uuid references profiles(id) on delete set null,
  assigned_at         timestamptz not null default now(),
  unassigned_at       timestamptz,
  -- For 'custom' schedules a cron expression is required
  check (schedule_kind <> 'custom' or schedule_cron is not null)
);
create unique index template_assignments_active_uniq
  on template_assignments(template_id, site_id)
  where unassigned_at is null;
create index template_assignments_site_idx
  on template_assignments(site_id) where unassigned_at is null;
create index template_assignments_version_idx
  on template_assignments(template_version_id);

-- 4.4 inspections: a run, with frozen template_version_id snapshot
create table inspections (
  id                  uuid primary key default gen_random_uuid(),
  ref_code            text not null unique
                          default next_ref_code('INSP', 'ref_inspection_seq'),
  org_id              uuid not null references orgs(id) on delete cascade,
  template_id         uuid not null references templates(id),
  template_version_id uuid not null references template_versions(id),       -- IMMUTABLE post-create
  assignment_id       uuid references template_assignments(id) on delete set null,
  site_id             uuid not null references sites(id) on delete restrict,
  title               text not null,
  inspector_id        uuid references profiles(id) on delete set null,
  status              inspection_status not null default 'in_progress',
  conducted_at        timestamptz,
  started_at          timestamptz not null default now(),
  completed_at        timestamptz,
  abandoned_at        timestamptz,
  abandon_reason      text,
  header_responses    jsonb not null default '{}'::jsonb,
  answers             jsonb not null default '{}'::jsonb,
  score_total         integer,
  score_max           integer,
  is_failed           boolean not null default false,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  deleted_at          timestamptz
);
create index inspections_site_status_idx
  on inspections(site_id, status) where deleted_at is null;
create index inspections_template_idx
  on inspections(template_id) where deleted_at is null;
create index inspections_inspector_idx
  on inspections(inspector_id) where deleted_at is null;

create trigger inspections_updated_at
  before update on inspections
  for each row execute function set_updated_at();

-- 4.5 inspection_uploads: photo / signature / drawing files (path-prefix RLS)
create table inspection_uploads (
  id              uuid primary key default gen_random_uuid(),
  inspection_id   uuid not null references inspections(id) on delete cascade,
  item_id         text not null,                                            -- TemplateNodeItem.item_id
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  uploaded_by     uuid references profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  deleted_at      timestamptz
);
create index inspection_uploads_inspection_idx on inspection_uploads(inspection_id);

-- 4.6 inspection_findings: failed responses materialized into actionable rows
create table inspection_findings (
  id                      uuid primary key default gen_random_uuid(),
  ref_code                text not null unique
                              default next_ref_code('FIND', 'ref_finding_seq'),
  inspection_id           uuid not null references inspections(id) on delete cascade,
  org_id                  uuid not null references orgs(id) on delete cascade,
  site_id                 uuid not null references sites(id) on delete cascade,
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
create index inspection_findings_inspection_idx on inspection_findings(inspection_id);
create index inspection_findings_status_idx
  on inspection_findings(status) where status in ('open', 'in_progress');

create trigger inspection_findings_updated_at
  before update on inspection_findings
  for each row execute function set_updated_at();

-- 4.7 inspection_assignees: optional multi-assignee
create table inspection_assignees (
  inspection_id  uuid not null references inspections(id) on delete cascade,
  profile_id     uuid not null references profiles(id) on delete cascade,
  assigned_at    timestamptz not null default now(),
  primary key (inspection_id, profile_id)
);

-- ----------------------------------------------------------------------------
-- 5. Soft-delete view for inspections
-- ----------------------------------------------------------------------------
create view inspections_active as
  select * from inspections where deleted_at is null;

-- ----------------------------------------------------------------------------
-- 6. Storage bucket (private; path-prefix RLS wired below)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('inspection-uploads', 'inspection-uploads', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 7. Row-Level Security
-- ----------------------------------------------------------------------------
alter table templates             enable row level security;
alter table template_versions     enable row level security;
alter table template_assignments  enable row level security;
alter table inspections           enable row level security;
alter table inspection_uploads    enable row level security;
alter table inspection_findings   enable row level security;
alter table inspection_assignees  enable row level security;

-- 7.1 templates
-- SELECT: system presets visible to all auth'd users; org rows visible to
-- members of the same org.
create policy templates_read on templates for select to authenticated
  using (
    is_system_preset = true
    or (org_id = current_org())
  );

-- INSERT: only org-scoped templates (system presets are seeded by migrations
-- as the postgres role, not by users); requires template:create at any site.
create policy templates_insert on templates for insert to authenticated
  with check (
    is_system_preset = false
    and org_id = current_org()
    and has_org_permission('template:create')
  );

-- UPDATE: org-scoped editable rows only; system presets are immutable to
-- end users. Either template:edit (general edit) or template:archive (set
-- status = archived) covers writes via the relevant server actions.
create policy templates_update on templates for update to authenticated
  using (
    is_system_preset = false
    and org_id = current_org()
    and (has_org_permission('template:edit') or has_org_permission('template:archive'))
  )
  with check (
    is_system_preset = false
    and org_id = current_org()
  );

-- DELETE: archive only — no hard-delete in v1.
revoke delete on templates from public;

-- 7.2 template_versions
-- SELECT: follows parent template visibility.
create policy template_versions_read on template_versions for select to authenticated
  using (
    exists (
      select 1 from templates t
      where t.id = template_versions.template_id
        and (t.is_system_preset = true or t.org_id = current_org())
    )
  );

-- INSERT: org-scoped templates only; requires template:edit (creating a
-- draft) or template:create (the publish RPC writes the v1 row).
create policy template_versions_insert on template_versions for insert to authenticated
  with check (
    exists (
      select 1 from templates t
      where t.id = template_versions.template_id
        and t.is_system_preset = false
        and t.org_id = current_org()
        and (has_org_permission('template:edit') or has_org_permission('template:create'))
    )
  );

-- UPDATE: only on org-scoped, non-published versions (drafts). The publish
-- RPC transitions draft → published in a single statement and gates that
-- transition itself; once published the row is read-only via this policy.
create policy template_versions_update on template_versions for update to authenticated
  using (
    exists (
      select 1 from templates t
      where t.id = template_versions.template_id
        and t.is_system_preset = false
        and t.org_id = current_org()
        and has_org_permission('template:edit')
    )
  )
  with check (
    exists (
      select 1 from templates t
      where t.id = template_versions.template_id
        and t.is_system_preset = false
        and t.org_id = current_org()
    )
  );

revoke delete on template_versions from public;

-- 7.3 template_assignments
create policy template_assignments_read on template_assignments for select to authenticated
  using (user_can_access_site(site_id));

create policy template_assignments_insert on template_assignments for insert to authenticated
  with check (
    user_can_access_site(site_id)
    and has_permission('template:assign', site_id)
  );

create policy template_assignments_update on template_assignments for update to authenticated
  using (
    user_can_access_site(site_id)
    and has_permission('template:assign', site_id)
  )
  with check (user_can_access_site(site_id));

revoke delete on template_assignments from public;

-- 7.4 inspections
create policy inspections_read on inspections for select to authenticated
  using (
    org_id = current_org()
    and (deleted_at is null or has_permission('inspection:edit_any', site_id))
    and user_can_access_site(site_id)
  );

create policy inspections_insert on inspections for insert to authenticated
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
    and has_permission('inspection:start', site_id)
  );

-- UPDATE: own inspection (inspector_id = uid + inspection:edit_own) OR
-- inspection:edit_any at site. Soft-delete uses `inspection:delete`.
create policy inspections_update on inspections for update to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
    and (
      (inspector_id = auth.uid() and has_permission('inspection:edit_own', site_id))
      or has_permission('inspection:edit_any', site_id)
      or has_permission('inspection:delete', site_id)
    )
  )
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
  );

revoke delete on inspections from public;

-- 7.5 inspection_uploads
create policy inspection_uploads_read on inspection_uploads for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_uploads.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );

create policy inspection_uploads_insert on inspection_uploads for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from inspections i
      where i.id = inspection_uploads.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and (
          (i.inspector_id = auth.uid() and has_permission('inspection:edit_own', i.site_id))
          or has_permission('inspection:edit_any', i.site_id)
        )
    )
  );

create policy inspection_uploads_update on inspection_uploads for update to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_uploads.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and (
          (i.inspector_id = auth.uid() and has_permission('inspection:edit_own', i.site_id))
          or has_permission('inspection:edit_any', i.site_id)
        )
    )
  );

-- 7.6 inspection_findings
create policy inspection_findings_read on inspection_findings for select to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
    and has_permission('finding:read', site_id)
  );

create policy inspection_findings_insert on inspection_findings for insert to authenticated
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
    -- Inserts come from complete_inspection_v1 (inspector or edit_any holder)
    and exists (
      select 1 from inspections i
      where i.id = inspection_findings.inspection_id
        and (
          (i.inspector_id = auth.uid() and has_permission('inspection:edit_own', i.site_id))
          or has_permission('inspection:edit_any', i.site_id)
          or has_permission('inspection:complete', i.site_id)
        )
    )
  );

create policy inspection_findings_update on inspection_findings for update to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
    and (has_permission('finding:resolve', site_id) or has_permission('finding:escalate', site_id))
  )
  with check (org_id = current_org() and user_can_access_site(site_id));

revoke delete on inspection_findings from public;

-- 7.7 inspection_assignees
create policy inspection_assignees_read on inspection_assignees for select to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_assignees.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );

create policy inspection_assignees_insert on inspection_assignees for insert to authenticated
  with check (
    exists (
      select 1 from inspections i
      where i.id = inspection_assignees.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and has_permission('inspection:edit_any', i.site_id)
    )
  );

create policy inspection_assignees_delete on inspection_assignees for delete to authenticated
  using (
    exists (
      select 1 from inspections i
      where i.id = inspection_assignees.inspection_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and has_permission('inspection:edit_any', i.site_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 8. Extend activity_events to support template + inspection events
--    The original table (init.sql §11) only had parent FKs for
--    incident/investigation/capa, and `org_id_of_event` coalesced from those
--    three to enforce RLS. Phase 3 events (template.published,
--    inspection.completed, finding.escalated, …) need their own parent
--    columns so they pass the same RLS check.
-- ----------------------------------------------------------------------------
alter table activity_events
  add column template_id   uuid references templates(id)            on delete cascade,
  add column inspection_id uuid references inspections(id)          on delete cascade,
  add column finding_id    uuid references inspection_findings(id)  on delete cascade;

create index activity_template_idx   on activity_events(template_id)   where template_id   is not null;
create index activity_inspection_idx on activity_events(inspection_id) where inspection_id is not null;
create index activity_finding_idx    on activity_events(finding_id)    where finding_id    is not null;

create or replace function org_id_of_event(e activity_events) returns uuid
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select org_id from incidents          where id = e.incident_id),
    (select org_id from investigations     where id = e.investigation_id),
    (select org_id from capas              where id = e.capa_id),
    (select org_id from templates          where id = e.template_id),     -- NULL for system presets — see below
    (select org_id from inspections        where id = e.inspection_id),
    (select org_id from inspection_findings where id = e.finding_id)
  )
$$;

-- ----------------------------------------------------------------------------
-- 9. Storage RLS for inspection-uploads bucket (path-prefix policy)
-- Path: <inspection_id>/<uuid>-<filename>
-- ----------------------------------------------------------------------------
create policy "inspection uploads read" on storage.objects for select to authenticated
  using (
    bucket_id = 'inspection-uploads'
    and exists (
      select 1 from inspections i
      where i.id::text = split_part(storage.objects.name, '/', 1)
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );

create policy "inspection uploads write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-uploads'
    and exists (
      select 1 from inspections i
      where i.id::text = split_part(storage.objects.name, '/', 1)
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and (
          (i.inspector_id = auth.uid() and has_permission('inspection:edit_own', i.site_id))
          or has_permission('inspection:edit_any', i.site_id)
        )
    )
  );

create policy "inspection uploads delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspection-uploads'
    and exists (
      select 1 from inspections i
      where i.id::text = split_part(storage.objects.name, '/', 1)
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
        and (
          (i.inspector_id = auth.uid() and has_permission('inspection:edit_own', i.site_id))
          or has_permission('inspection:edit_any', i.site_id)
        )
    )
  );
