-- ============================================================================
-- 0001_init — EHS Operations Platform schema (Phase 0 foundation)
-- Implements docs/SPEC.md §10 + CLAUDE.md hard rules:
--   - RBAC = roles + site_members + teams + permissions (NOT a user_role enum)
--   - Soft-delete only on incidents/investigations/capas
--   - Append-only audit (severity_overrides, notifications, activity_events)
--   - CAPA owner ≠ verifier (DB CHECK)
--   - Severity-change requires matching severity_overrides row in same txn
--   - All ref-coded entities use BEFORE INSERT triggers + sequences
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type incident_type as enum (
  'injury', 'illness', 'near_miss', 'property_damage',
  'environmental_release', 'unsafe_condition', 'observation', 'dangerous_occurrence'
);
create type severity                  as enum ('S1', 'S2', 'S3', 'S4', 'S5');
create type track                     as enum ('A', 'B', 'C');
create type incident_status           as enum ('draft', 'submitted', 'classified', 'under_investigation', 'awaiting_capa', 'closed');
create type investigation_status      as enum ('pending_assignment', 'in_progress', 'awaiting_capa', 'closed');
create type investigation_team_role   as enum ('lead', 'member', 'observer');
create type capa_type                 as enum ('corrective', 'preventive');
create type capa_status               as enum ('created', 'in_progress', 'completed', 'pending_verification', 'verified', 'closed');
create type verification_result       as enum ('effective', 'partially_effective', 'not_effective', 'too_early_to_verify');
create type verification_method       as enum ('inspection', 'monitoring', 'audit_trend', 're_interview', 'document_review');
create type notification_kind as enum (
  'osha_8hr', 'osha_24hr', 'riddor_immediate', 'riddor_f2508_10d', 'riddor_7day',
  'riddor_disease', 'capa_overdue', 'capa_escalated', 'assigned'
);
create type body_part as enum (
  'head', 'neck', 'chest', 'abdomen', 'back',
  'left_arm', 'right_arm', 'left_hand', 'right_hand',
  'left_leg', 'right_leg', 'left_foot', 'right_foot',
  'left_eye', 'right_eye', 'other'
);
create type riddor_specified_injury as enum (
  'fracture', 'amputation', 'sight_loss', 'crush_internal',
  'serious_burn', 'scalping', 'loss_of_consciousness', 'enclosed_space_injury'
);
create type treatment as enum ('none', 'first_aid', 'medical', 'hospitalization');
create type employment_status as enum ('employee', 'contractor', 'visitor', 'agency');
create type industry_type as enum (
  'healthcare', 'education', 'manufacturing', 'warehouse', 'office', 'construction', 'lab'
);

-- ----------------------------------------------------------------------------
-- 2. updated_at trigger helper
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Tenancy: orgs + sites + profiles
-- ----------------------------------------------------------------------------
create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  industry    industry_type,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger orgs_updated before update on orgs for each row execute function set_updated_at();

create table sites (
  id                      uuid primary key default gen_random_uuid(),
  org_id                  uuid not null references orgs(id) on delete cascade,
  parent_site_id          uuid references sites(id) on delete restrict,
  name                    text not null,
  address                 text,
  country                 char(2) not null check (country in ('US', 'GB')),
  region                  text,
  timezone                text not null default 'UTC',
  osha_establishment_id   text,
  naics_code              text,
  setup_completed_at      timestamptz,
  setup_progress          jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger sites_updated before update on sites for each row execute function set_updated_at();
create index sites_org_idx on sites(org_id);
create index sites_parent_idx on sites(parent_site_id);

create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  org_id          uuid not null references orgs(id) on delete cascade,
  full_name       text,
  email           text not null,
  department      text,
  seen_welcome    boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create index profiles_org_idx on profiles(org_id);
create unique index profiles_email_idx on profiles(lower(email));

-- ----------------------------------------------------------------------------
-- 4. RBAC: permissions (system) + roles (per-org) + role_permissions
--          + site_members (role-binding) + teams + team_members + team_sites
-- ----------------------------------------------------------------------------

-- System permission registry — string keys, not user-editable
create table permissions (
  key         text primary key,
  description text not null
);

insert into permissions (key, description) values
  ('site:read',                'Read site metadata'),
  ('site:configure',           'Configure site settings'),
  ('member:invite',            'Invite users to a site'),
  ('member:manage',            'Edit/remove site memberships'),
  ('role:read',                'Read role definitions'),
  ('role:edit',                'Edit role permission sets'),
  ('team:manage',              'Create and edit teams'),
  ('incident:report',          'Submit a new incident report'),
  ('incident:read_own',        'Read incidents reported by self'),
  ('incident:read_site',       'Read incidents within accessible sites'),
  ('incident:override_severity','Override auto-classified severity'),
  ('incident:assign',          'Assign / route an incident'),
  ('incident:close',           'Close an incident'),
  ('investigation:lead',       'Lead an investigation'),
  ('investigation:edit',       'Edit RCA, evidence, team'),
  ('capa:create',              'Create a CAPA'),
  ('capa:complete',            'Mark a CAPA completed (as owner)'),
  ('capa:verify',              'Verify CAPA effectiveness (non-owner only)'),
  ('report:read',              'Read regulatory reports'),
  ('report:export',            'Export OSHA / RIDDOR reports'),
  ('template:create',          'Create inspection templates'),
  ('template:publish',         'Publish a new template version'),
  ('inspection:run',           'Run inspections from templates'),
  ('asset:manage',             'Create / edit operational assets'),
  ('document:upload',          'Upload documents');

-- Org-defined role rows. Default 4 seeded per org via seed_default_roles().
create table roles (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  key         text not null,                          -- e.g. 'worker', 'supervisor'
  name        text not null,
  description text,
  is_default  boolean not null default false,         -- one of the 4 seeded defaults
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, key)
);
create trigger roles_updated before update on roles for each row execute function set_updated_at();
create index roles_org_idx on roles(org_id);

create table role_permissions (
  role_id        uuid not null references roles(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (role_id, permission_key)
);

create table site_members (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references profiles(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  role_id           uuid not null references roles(id) on delete restrict,
  include_children  boolean not null default false,
  created_at        timestamptz not null default now(),
  unique (profile_id, site_id)
);
create index site_members_site_idx on site_members(site_id);
create index site_members_profile_idx on site_members(profile_id);

create table teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references orgs(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (org_id, name)
);
create trigger teams_updated before update on teams for each row execute function set_updated_at();

create table team_sites (
  team_id uuid not null references teams(id) on delete cascade,
  site_id uuid not null references sites(id) on delete cascade,
  primary key (team_id, site_id)
);

create table team_members (
  team_id     uuid not null references teams(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role_id     uuid references roles(id) on delete set null,
  primary key (team_id, profile_id)
);

create table team_permissions (
  team_id        uuid not null references teams(id) on delete cascade,
  permission_key text not null references permissions(key) on delete cascade,
  primary key (team_id, permission_key)
);

-- ----------------------------------------------------------------------------
-- 5. RBAC helper functions
-- ----------------------------------------------------------------------------

-- Resolve current user's org_id (for tenancy isolation in RLS).
create or replace function current_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Site-access check honoring include_children (recursive ancestor walk).
create or replace function user_can_access_site(p_site_id uuid) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;

  -- Direct membership
  if exists (select 1 from site_members where profile_id = v_uid and site_id = p_site_id) then
    return true;
  end if;

  -- Ancestor membership with include_children = true
  return exists (
    with recursive ancestors as (
      select id, parent_site_id from sites where id = p_site_id
      union all
      select s.id, s.parent_site_id
        from sites s join ancestors a on a.parent_site_id = s.id
    )
    select 1 from ancestors a
    join site_members sm on sm.site_id = a.id
    where sm.profile_id = v_uid and sm.include_children = true
  );
end $$;

-- Permission check: union of role permissions (per accessible site_member row)
-- with team permissions (per team membership intersected with team_sites).
create or replace function has_permission(p_permission text, p_site_id uuid) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from site_members sm
      join role_permissions rp on rp.role_id = sm.role_id
    where sm.profile_id = auth.uid()
      and rp.permission_key = p_permission
      and (sm.site_id = p_site_id or (sm.include_children and exists (
            with recursive descendants as (
              select id from sites where id = sm.site_id
              union all
              select s.id from sites s join descendants d on s.parent_site_id = d.id
            )
            select 1 from descendants where id = p_site_id
      )))
    union all
    select 1 from team_members tm
      join team_permissions tp on tp.team_id = tm.team_id
      join team_sites ts on ts.team_id = tm.team_id
    where tm.profile_id = auth.uid()
      and tp.permission_key = p_permission
      and ts.site_id = p_site_id
  )
$$;

-- ----------------------------------------------------------------------------
-- 6. Ref-code sequences (per-year, NNNN format)
-- ----------------------------------------------------------------------------
create sequence ref_incident_seq;
create sequence ref_investigation_seq;
create sequence ref_capa_seq;

create or replace function next_ref_code(p_prefix text, p_seq text) returns text
  language plpgsql as $$
declare
  v_n bigint;
begin
  execute format('select nextval(%L)', p_seq) into v_n;
  return p_prefix || '-' || to_char(now(), 'YYYY') || '-' || lpad(v_n::text, 4, '0');
end $$;

-- ----------------------------------------------------------------------------
-- 7. Incidents (sparse-column model per SPEC §10 v1 decision)
-- ----------------------------------------------------------------------------
create table incidents (
  id                          uuid primary key default gen_random_uuid(),
  ref_code                    text unique,
  org_id                      uuid not null references orgs(id) on delete cascade,
  site_id                     uuid not null references sites(id) on delete restrict,
  type                        incident_type not null,
  title                       text not null,
  description                 text,
  occurred_at                 timestamptz not null,
  area                        text,
  location                    text,
  severity                    severity,
  track                       track,
  status                      incident_status not null default 'draft',
  reporter_id                 uuid references profiles(id) on delete set null,
  -- Regulatory flags
  osha_recordable             boolean not null default false,
  riddor_reportable           boolean not null default false,
  -- Sandbox practice rows excluded from KPIs/dashboards/reports
  is_sandbox                  boolean not null default false,
  -- Sparse type-specific columns (v1 demo decision; per-type tables in v2)
  ppe_worn                    text[],
  substance                   text,
  quantity_value              numeric,
  quantity_unit               text,
  equipment                   text,
  dangerous_occurrence_kind   text,
  -- Lifecycle timestamps
  classified_at               timestamptz,
  closed_at                   timestamptz,
  deleted_at                  timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create trigger incidents_updated before update on incidents for each row execute function set_updated_at();
create index incidents_site_idx on incidents(site_id);
create index incidents_org_idx on incidents(org_id);
create index incidents_status_idx on incidents(status) where deleted_at is null;
create index incidents_occurred_idx on incidents(occurred_at desc) where deleted_at is null;

create or replace function set_incident_ref_code() returns trigger
  language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := next_ref_code('INC', 'ref_incident_seq');
  end if;
  return new;
end $$;
create trigger incidents_ref_code before insert on incidents for each row execute function set_incident_ref_code();

create table injured_persons (
  id                            uuid primary key default gen_random_uuid(),
  incident_id                   uuid not null references incidents(id) on delete cascade,
  name                          text not null,
  job_title                     text,
  department                    text,
  supervisor_id                 uuid references profiles(id) on delete set null,
  employment_status             employment_status,
  body_parts                    body_part[],
  injury_nature                 text,
  mechanism                     text,
  object_substance              text,
  treatment                     treatment,
  days_away                     integer,
  days_restricted               integer,
  fatality                      boolean not null default false,
  hospitalized                  boolean not null default false,
  riddor_specified_injury       riddor_specified_injury,
  date_of_death                 date,
  created_at                    timestamptz not null default now()
);
create index injured_persons_incident_idx on injured_persons(incident_id);

create table witnesses (
  id           uuid primary key default gen_random_uuid(),
  incident_id  uuid not null references incidents(id) on delete cascade,
  name         text not null,
  contact      text,
  statement    text,
  created_at   timestamptz not null default now()
);
create index witnesses_incident_idx on witnesses(incident_id);

-- ----------------------------------------------------------------------------
-- 8. Severity overrides — append-only audit, paired with severity-change trigger
-- ----------------------------------------------------------------------------
create table severity_overrides (
  id                  uuid primary key default gen_random_uuid(),
  incident_id         uuid not null references incidents(id) on delete cascade,
  original_severity   severity not null,
  new_severity        severity not null,
  overridden_by       uuid not null references profiles(id) on delete restrict,
  reason              text not null,
  created_at          timestamptz not null default now()
);
create index severity_overrides_incident_idx on severity_overrides(incident_id);

-- Severity-change trigger: any UPDATE to incidents.severity from a non-NULL
-- value must be paired with a severity_overrides INSERT in the SAME txn.
-- Enforced via a DEFERRABLE constraint trigger so insertion order doesn't
-- matter; both rows must be visible at txn commit. Initial classification
-- (NULL → S*) is exempt because the engine sets severity for the first time.
create or replace function enforce_severity_override() returns trigger
  language plpgsql as $$
begin
  if old.severity is distinct from new.severity
     and old.severity is not null
     and not exists (
       select 1 from severity_overrides
        where incident_id       = new.id
          and original_severity = old.severity
          and new_severity      = new.severity
     ) then
    raise exception
      'Severity change on incident % requires a matching severity_overrides row',
      new.id;
  end if;
  return new;
end $$;

create constraint trigger incidents_severity_audit
  after update on incidents
  deferrable initially deferred
  for each row execute function enforce_severity_override();

-- ----------------------------------------------------------------------------
-- 9. Investigations + RCA + evidence + team
-- ----------------------------------------------------------------------------
create table investigations (
  id                    uuid primary key default gen_random_uuid(),
  ref_code              text unique,
  incident_id           uuid not null references incidents(id) on delete cascade,
  site_id               uuid not null references sites(id) on delete restrict,
  org_id                uuid not null references orgs(id) on delete cascade,
  lead_investigator_id  uuid references profiles(id) on delete set null,
  status                investigation_status not null default 'pending_assignment',
  started_at            timestamptz,
  due_date              date,
  root_cause_summary    text,
  findings              text,
  rca_method            text not null default '5_why',
  closed_at             timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create trigger investigations_updated before update on investigations for each row execute function set_updated_at();
create index investigations_incident_idx on investigations(incident_id);
create index investigations_status_idx on investigations(status) where deleted_at is null;

create or replace function set_investigation_ref_code() returns trigger
  language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := next_ref_code('INV', 'ref_investigation_seq');
  end if;
  return new;
end $$;
create trigger investigations_ref_code before insert on investigations for each row execute function set_investigation_ref_code();

create table investigation_team_members (
  investigation_id  uuid not null references investigations(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  role              investigation_team_role not null default 'member',
  added_at          timestamptz not null default now(),
  primary key (investigation_id, profile_id)
);

create table rca_whys (
  id                uuid primary key default gen_random_uuid(),
  investigation_id  uuid not null references investigations(id) on delete cascade,
  level             smallint not null check (level between 1 and 5),
  question          text,
  answer            text,
  is_root_cause     boolean generated always as (level = 5) stored,
  created_at        timestamptz not null default now(),
  unique (investigation_id, level)
);

create table investigation_evidence (
  id                uuid primary key default gen_random_uuid(),
  investigation_id  uuid not null references investigations(id) on delete cascade,
  type              text,
  storage_path      text not null,
  file_name         text not null,
  mime_type         text,
  size_bytes        bigint,
  uploaded_by       uuid references profiles(id) on delete set null,
  uploaded_at       timestamptz not null default now()
);
create index investigation_evidence_idx on investigation_evidence(investigation_id);

-- ----------------------------------------------------------------------------
-- 10. CAPAs — owner ≠ verifier enforced at DB layer
-- ----------------------------------------------------------------------------
create table capas (
  id                    uuid primary key default gen_random_uuid(),
  ref_code              text unique,
  investigation_id      uuid references investigations(id) on delete set null,
  incident_id           uuid references incidents(id) on delete set null,
  org_id                uuid not null references orgs(id) on delete cascade,
  site_id               uuid not null references sites(id) on delete restrict,
  type                  capa_type not null,
  title                 text not null,
  description           text,
  owner_id              uuid not null references profiles(id) on delete restrict,
  verifier_id           uuid references profiles(id) on delete set null,
  due_date              date,
  status                capa_status not null default 'created',
  progress_pct          smallint not null default 0 check (progress_pct between 0 and 100),
  verification_result   verification_result,
  verification_method   verification_method,
  rejection_reason      text,
  re_verify_at          date,
  follow_up_capa_id     uuid references capas(id) on delete set null,
  completed_at          timestamptz,
  verified_at           timestamptz,
  closed_at             timestamptz,
  deleted_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint capa_owner_not_verifier check (verifier_id is null or verifier_id <> owner_id)
);
create trigger capas_updated before update on capas for each row execute function set_updated_at();
create index capas_owner_idx on capas(owner_id);
create index capas_verifier_idx on capas(verifier_id);
create index capas_status_idx on capas(status) where deleted_at is null;

create or replace function set_capa_ref_code() returns trigger
  language plpgsql as $$
begin
  if new.ref_code is null then
    new.ref_code := next_ref_code('CAPA', 'ref_capa_seq');
  end if;
  return new;
end $$;
create trigger capas_ref_code before insert on capas for each row execute function set_capa_ref_code();

-- ----------------------------------------------------------------------------
-- 11. Notifications + recipients + HSE record + activity events
-- ----------------------------------------------------------------------------
create table notifications (
  id              uuid primary key default gen_random_uuid(),
  kind            notification_kind not null,
  incident_id     uuid references incidents(id) on delete cascade,
  capa_id         uuid references capas(id) on delete cascade,
  recipient_id    uuid references profiles(id) on delete set null,
  site_id         uuid not null references sites(id) on delete cascade,
  title           text not null,
  body            text,
  deadline_at     timestamptz,
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index notifications_recipient_idx on notifications(recipient_id);
create index notifications_site_idx on notifications(site_id);

create table notification_recipients (
  id                      uuid primary key default gen_random_uuid(),
  site_id                 uuid not null references sites(id) on delete cascade,
  notification_kind       notification_kind not null,
  recipient_profile_id    uuid references profiles(id) on delete cascade,
  external_email          text,
  created_at              timestamptz not null default now(),
  check (recipient_profile_id is not null or external_email is not null)
);
create index notification_recipients_site_kind_idx
  on notification_recipients(site_id, notification_kind);

create table hse_notification_records (
  id                          uuid primary key default gen_random_uuid(),
  incident_id                 uuid not null references incidents(id) on delete cascade,
  phone_called_at             timestamptz,
  phoned_by                   uuid references profiles(id) on delete set null,
  hse_phone_reference         text,
  written_submitted_at        timestamptz,
  riddor_online_reference     text,
  created_at                  timestamptz not null default now(),
  unique (incident_id)
);

create table activity_events (
  id                uuid primary key default gen_random_uuid(),
  incident_id       uuid references incidents(id) on delete cascade,
  investigation_id  uuid references investigations(id) on delete cascade,
  capa_id           uuid references capas(id) on delete cascade,
  actor_id          uuid references profiles(id) on delete set null,
  verb              text not null,
  payload           jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);
create index activity_incident_idx on activity_events(incident_id);
create index activity_investigation_idx on activity_events(investigation_id);
create index activity_capa_idx on activity_events(capa_id);

-- ----------------------------------------------------------------------------
-- 12. Soft-delete views (default-filtered queries)
-- ----------------------------------------------------------------------------
create view incidents_active as
  select * from incidents where deleted_at is null;
create view investigations_active as
  select * from investigations where deleted_at is null;
create view capas_active as
  select * from capas where deleted_at is null;

-- ----------------------------------------------------------------------------
-- 13. Append-only audit: revoke UPDATE/DELETE on audit tables
-- ----------------------------------------------------------------------------
revoke update, delete on severity_overrides from public;
revoke update, delete on notifications        from public;
revoke update, delete on activity_events      from public;

-- ----------------------------------------------------------------------------
-- 14. Storage buckets (private; path-prefix RLS wired below)
-- ----------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('incident-attachments',  'incident-attachments',  false),
       ('investigation-evidence', 'investigation-evidence', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 15. Row-Level Security (Phase 0 baseline)
--     Phase 0 demo policies: tenancy isolation by org + per-site membership.
--     Phase 1+ tightens write paths via has_permission() per §11.
-- ----------------------------------------------------------------------------
alter table orgs                       enable row level security;
alter table sites                      enable row level security;
alter table profiles                   enable row level security;
alter table permissions                enable row level security;
alter table roles                      enable row level security;
alter table role_permissions           enable row level security;
alter table site_members               enable row level security;
alter table teams                      enable row level security;
alter table team_sites                 enable row level security;
alter table team_members               enable row level security;
alter table team_permissions           enable row level security;
alter table incidents                  enable row level security;
alter table injured_persons            enable row level security;
alter table witnesses                  enable row level security;
alter table severity_overrides         enable row level security;
alter table investigations             enable row level security;
alter table investigation_team_members enable row level security;
alter table rca_whys                   enable row level security;
alter table investigation_evidence     enable row level security;
alter table capas                      enable row level security;
alter table notifications              enable row level security;
alter table notification_recipients    enable row level security;
alter table hse_notification_records   enable row level security;
alter table activity_events            enable row level security;

-- Permissions registry — read-only to all authenticated users
create policy permissions_read on permissions for select to authenticated using (true);

-- Org self-read
create policy orgs_read on orgs for select to authenticated
  using (id = current_org());

-- Sites: read those the user can access (direct or via include_children ancestor)
create policy sites_read on sites for select to authenticated
  using (org_id = current_org() and user_can_access_site(id));

-- Profiles: read self + others in same org
create policy profiles_read on profiles for select to authenticated
  using (org_id = current_org());
create policy profiles_update_self on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Roles, role_permissions: read within org
create policy roles_read on roles for select to authenticated
  using (org_id = current_org());
create policy role_permissions_read on role_permissions for select to authenticated
  using (exists (select 1 from roles r where r.id = role_permissions.role_id and r.org_id = current_org()));

-- Site memberships: read self + same-site peers
create policy site_members_read on site_members for select to authenticated
  using (
    profile_id = auth.uid()
    or exists (select 1 from site_members sm where sm.site_id = site_members.site_id and sm.profile_id = auth.uid())
  );

-- Teams: read within org
create policy teams_read on teams for select to authenticated using (org_id = current_org());
create policy team_sites_read on team_sites for select to authenticated
  using (exists (select 1 from teams t where t.id = team_sites.team_id and t.org_id = current_org()));
create policy team_members_read on team_members for select to authenticated
  using (exists (select 1 from teams t where t.id = team_members.team_id and t.org_id = current_org()));
create policy team_permissions_read on team_permissions for select to authenticated
  using (exists (select 1 from teams t where t.id = team_permissions.team_id and t.org_id = current_org()));

-- Incidents: read site-scoped + own drafts; write own drafts (Phase 0 baseline)
create policy incidents_read on incidents for select to authenticated
  using (
    org_id = current_org()
    and (
      reporter_id = auth.uid()
      or (deleted_at is null and user_can_access_site(site_id))
    )
  );
create policy incidents_insert on incidents for insert to authenticated
  with check (
    org_id = current_org()
    and reporter_id = auth.uid()
    and user_can_access_site(site_id)
  );
create policy incidents_update on incidents for update to authenticated
  using (org_id = current_org() and user_can_access_site(site_id))
  with check (org_id = current_org() and user_can_access_site(site_id));

create policy injured_persons_rw on injured_persons for all to authenticated
  using (exists (select 1 from incidents i where i.id = injured_persons.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)))
  with check (exists (select 1 from incidents i where i.id = injured_persons.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

create policy witnesses_rw on witnesses for all to authenticated
  using (exists (select 1 from incidents i where i.id = witnesses.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)))
  with check (exists (select 1 from incidents i where i.id = witnesses.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

create policy severity_overrides_read on severity_overrides for select to authenticated
  using (exists (select 1 from incidents i where i.id = severity_overrides.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)));
create policy severity_overrides_insert on severity_overrides for insert to authenticated
  with check (
    overridden_by = auth.uid()
    and exists (select 1 from incidents i where i.id = severity_overrides.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id))
  );

create policy investigations_read on investigations for select to authenticated
  using (org_id = current_org() and (deleted_at is null) and user_can_access_site(site_id));
create policy investigations_insert on investigations for insert to authenticated
  with check (org_id = current_org() and user_can_access_site(site_id));
create policy investigations_update on investigations for update to authenticated
  using (org_id = current_org() and user_can_access_site(site_id))
  with check (org_id = current_org() and user_can_access_site(site_id));

create policy investigation_team_rw on investigation_team_members for all to authenticated
  using (exists (select 1 from investigations i where i.id = investigation_team_members.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)))
  with check (exists (select 1 from investigations i where i.id = investigation_team_members.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

create policy rca_whys_rw on rca_whys for all to authenticated
  using (exists (select 1 from investigations i where i.id = rca_whys.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)))
  with check (exists (select 1 from investigations i where i.id = rca_whys.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

create policy investigation_evidence_rw on investigation_evidence for all to authenticated
  using (exists (select 1 from investigations i where i.id = investigation_evidence.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)))
  with check (exists (select 1 from investigations i where i.id = investigation_evidence.investigation_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

create policy capas_read on capas for select to authenticated
  using (org_id = current_org() and (deleted_at is null) and user_can_access_site(site_id));
create policy capas_insert on capas for insert to authenticated
  with check (org_id = current_org() and user_can_access_site(site_id));
create policy capas_update on capas for update to authenticated
  using (org_id = current_org() and user_can_access_site(site_id))
  with check (org_id = current_org() and user_can_access_site(site_id));

create policy notifications_read on notifications for select to authenticated
  using (
    recipient_id = auth.uid()
    or (recipient_id is null and user_can_access_site(site_id))
  );
create policy notification_recipients_read on notification_recipients for select to authenticated
  using (user_can_access_site(site_id));

create policy hse_records_read on hse_notification_records for select to authenticated
  using (exists (select 1 from incidents i where i.id = hse_notification_records.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)));
create policy hse_records_insert on hse_notification_records for insert to authenticated
  with check (exists (select 1 from incidents i where i.id = hse_notification_records.incident_id and i.org_id = current_org() and user_can_access_site(i.site_id)));

-- Helper: derive org_id from any of the parent rows on activity_events
create or replace function org_id_of_event(e activity_events) returns uuid
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select org_id from incidents       where id = e.incident_id),
    (select org_id from investigations  where id = e.investigation_id),
    (select org_id from capas           where id = e.capa_id)
  )
$$;

create policy activity_read on activity_events for select to authenticated
  using (org_id_of_event(activity_events.*) = current_org());

create policy activity_insert on activity_events for insert to authenticated
  with check (
    actor_id = auth.uid()
    and org_id_of_event(activity_events.*) = current_org()
  );

-- ----------------------------------------------------------------------------
-- 16. Storage RLS (path-prefix policies)
-- ----------------------------------------------------------------------------
create policy "incident attachments read" on storage.objects for select to authenticated
  using (
    bucket_id = 'incident-attachments'
    and exists (
      select 1 from incidents i
      where i.id::text = split_part(storage.objects.name, '/', 1)
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );
create policy "incident attachments write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'incident-attachments'
    and exists (
      select 1 from incidents i
      where i.id::text = split_part(storage.objects.name, '/', 1)
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );

create policy "investigation evidence read" on storage.objects for select to authenticated
  using (
    bucket_id = 'investigation-evidence'
    and exists (
      select 1 from investigations inv
      where inv.id::text = split_part(storage.objects.name, '/', 1)
        and inv.org_id = current_org()
        and user_can_access_site(inv.site_id)
    )
  );
create policy "investigation evidence write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'investigation-evidence'
    and exists (
      select 1 from investigations inv
      where inv.id::text = split_part(storage.objects.name, '/', 1)
        and inv.org_id = current_org()
        and user_can_access_site(inv.site_id)
    )
  );

-- ----------------------------------------------------------------------------
-- 17. Default-role seeding helper (called from scripts/seed.ts per new org)
-- ----------------------------------------------------------------------------
create or replace function seed_default_roles(p_org_id uuid) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_role_id uuid;
begin
  -- worker
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'worker', 'Worker', 'Reports incidents and observations.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_own'),
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read')
  on conflict do nothing;

  -- supervisor
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'supervisor', 'Supervisor', 'Reviews and routes site incidents.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read'),
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_site'),
    (v_role_id, 'incident:override_severity'),
    (v_role_id, 'incident:assign'),
    (v_role_id, 'capa:complete'),
    (v_role_id, 'capa:verify'),
    (v_role_id, 'inspection:run')
  on conflict do nothing;

  -- ehs_manager
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'ehs_manager', 'EHS Manager', 'Leads investigations and manages regulatory reporting.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key) values
    (v_role_id, 'site:read'),
    (v_role_id, 'role:read'),
    (v_role_id, 'incident:report'),
    (v_role_id, 'incident:read_site'),
    (v_role_id, 'incident:override_severity'),
    (v_role_id, 'incident:assign'),
    (v_role_id, 'incident:close'),
    (v_role_id, 'investigation:lead'),
    (v_role_id, 'investigation:edit'),
    (v_role_id, 'capa:create'),
    (v_role_id, 'capa:complete'),
    (v_role_id, 'capa:verify'),
    (v_role_id, 'report:read'),
    (v_role_id, 'report:export'),
    (v_role_id, 'template:create'),
    (v_role_id, 'template:publish'),
    (v_role_id, 'inspection:run'),
    (v_role_id, 'document:upload')
  on conflict do nothing;

  -- site_admin (full system access)
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;

-- ----------------------------------------------------------------------------
-- End of 0001_init
-- ----------------------------------------------------------------------------
