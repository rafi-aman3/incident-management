-- ----------------------------------------------------------------------------
-- Phase 4 — Resources (Assets + Documents) — schema + RLS
--
-- Ships the per-site asset registry, the org-wide flat document library,
-- and the polymorphic document_links table that ties them to incidents,
-- investigations, CAPAs, sites, inspections, and findings.
--
-- Companion migrations land in this same phase:
--   * phase4_documents_storage_bucket  — `documents` private bucket + RLS
--   * phase4_resources_rpcs            — link / unlink / archive / replace RPCs
--   * phase4_resources_permissions     — perm keys + default-role grants
--
-- Cross-refs:
--   * plans/04-resources.md §A1
--   * docs/SPEC.md §15 (Phase 4 entry — flat docs / additive dual-write)
-- ----------------------------------------------------------------------------

-- ----------------------------------------------------------------------------
-- 1. Enums
-- ----------------------------------------------------------------------------
create type asset_kind as enum (
  'forklift','fume_hood','fire_extinguisher','aed','conveyor',
  'ergonomic_station','machine_guard','press','crane','vehicle',
  'eyewash_station','spill_kit','safety_shower','generator','other'
);

create type asset_condition as enum ('excellent','good','fair','poor','unsafe');

create type asset_status as enum ('active','retired');

create type document_type as enum (
  'sds','sop','policy','training_cert','form','evidence','audit_report','other'
);

-- Polymorphic parent enum — every value here must have a clause in
-- `can_edit_parent()` (lib/.../phase4_resources_rpcs.sql) and a matching
-- column on `activity_events` (extended further down) before it is used.
create type document_link_parent as enum (
  'incident','investigation','capa','asset','site','inspection','finding'
);

-- ----------------------------------------------------------------------------
-- 2. Ref-code sequence for assets (AST-2026-0001)
-- ----------------------------------------------------------------------------
create sequence ref_asset_seq;

-- ----------------------------------------------------------------------------
-- 3. documents — org-scoped library; flat (no versioning in v1)
--    See plans/04-resources.md §A1 + Open Q5 for the deferred Document
--    Control story.
-- ----------------------------------------------------------------------------
create table documents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  -- NULL = org-wide; non-NULL = site-scoped (UI flag only — RLS keeps
  -- visibility at the org level so library reuse across sites works).
  site_id         uuid references sites(id) on delete set null,
  name            text not null,
  type            document_type not null,
  -- "<org_id>/<uuid>-<filename>" — matches the path-prefix RLS in the
  -- documents-bucket migration.
  storage_path    text not null,
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null check (size_bytes >= 0),
  -- Optional retention / next-review. UI flags ≤ 30 d.
  expiry_date     date,
  notes           text,
  uploaded_by     uuid references profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  -- Soft-archive only — file stays in storage for OSHA 5y / RIDDOR 3y
  -- retention.
  archived_at     timestamptz,
  archived_reason text
);
create trigger documents_updated
  before update on documents
  for each row execute function set_updated_at();

create index documents_org_active_idx
  on documents(org_id)
  where archived_at is null;
create index documents_org_type_idx
  on documents(org_id, type)
  where archived_at is null;
create index documents_expiry_idx
  on documents(expiry_date)
  where archived_at is null and expiry_date is not null;
create index documents_site_idx
  on documents(site_id)
  where archived_at is null and site_id is not null;

-- ----------------------------------------------------------------------------
-- 4. assets — per-site operational asset registry
-- ----------------------------------------------------------------------------
create table assets (
  id                 uuid primary key default gen_random_uuid(),
  ref_code           text not null unique
                          default next_ref_code('AST', 'ref_asset_seq'),
  org_id             uuid not null references orgs(id) on delete cascade,
  site_id            uuid not null references sites(id) on delete restrict,
  name               text not null,
  kind               asset_kind not null,
  -- Free text — "Bay 3, Aisle A". Site is structured; location is not.
  location           text,
  condition          asset_condition not null default 'good',
  status             asset_status not null default 'active',
  last_inspected_at  timestamptz,
  next_pm_at         timestamptz,
  -- Optional pointer at the asset's SDS in the documents library. Set via
  -- `<DocumentLinkPicker default_type_filter="sds">`. NOT the only way to
  -- attach an SDS — `document_links(parent_type='asset')` is the durable
  -- many-to-many. This field denormalizes the primary one for fast list
  -- rendering.
  sds_document_id    uuid references documents(id) on delete set null,
  notes              text,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  -- Soft-delete only.
  deleted_at         timestamptz
);
create trigger assets_updated
  before update on assets
  for each row execute function set_updated_at();

create index assets_site_status_idx
  on assets(site_id, status)
  where deleted_at is null;
create index assets_org_kind_idx
  on assets(org_id, kind)
  where deleted_at is null;
create index assets_pm_due_idx
  on assets(next_pm_at)
  where deleted_at is null and status = 'active' and next_pm_at is not null;

-- ----------------------------------------------------------------------------
-- 5. document_links — polymorphic typed-pair (parent_type enum + uuid)
-- ----------------------------------------------------------------------------
create table document_links (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  parent_type  document_link_parent not null,
  parent_id    uuid not null,
  -- Optional context tag, e.g. 'sds' / 'attachment' / 'evidence' / 'sop' /
  -- 'photo'. Pairs with the picker's `default_link_role` prop; lets the
  -- same document attach to one parent twice with two roles.
  link_role    text,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  -- Soft-remove only. The document itself stays.
  removed_at   timestamptz,
  unique (document_id, parent_type, parent_id, link_role)
);

create index document_links_document_idx
  on document_links(document_id)
  where removed_at is null;
create index document_links_parent_idx
  on document_links(parent_type, parent_id)
  where removed_at is null;

-- ----------------------------------------------------------------------------
-- 6. incidents.equipment_asset_id — soft FK from incidents to assets
--    Sparse — only set in the wizard for property_damage / unsafe_condition
--    types. Other types ignore it.
-- ----------------------------------------------------------------------------
alter table incidents
  add column equipment_asset_id uuid references assets(id) on delete set null;

create index incidents_equipment_asset_idx
  on incidents(equipment_asset_id)
  where equipment_asset_id is not null;

-- ----------------------------------------------------------------------------
-- 7. activity_events extension — asset / document / document_link parents
--    Mirrors Phase 3's pattern: every parent type that can author an
--    activity row gets its own column, and `org_id_of_event` coalesces
--    across them so the existing RLS policy keeps working.
-- ----------------------------------------------------------------------------
alter table activity_events
  add column asset_id         uuid references assets(id)         on delete cascade,
  add column document_id      uuid references documents(id)      on delete cascade,
  add column document_link_id uuid references document_links(id) on delete cascade;

create index activity_asset_idx         on activity_events(asset_id)         where asset_id         is not null;
create index activity_document_idx      on activity_events(document_id)      where document_id      is not null;
create index activity_document_link_idx on activity_events(document_link_id) where document_link_id is not null;

create or replace function org_id_of_event(e activity_events) returns uuid
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select org_id from incidents             where id = e.incident_id),
    (select org_id from investigations        where id = e.investigation_id),
    (select org_id from capas                 where id = e.capa_id),
    (select org_id from templates             where id = e.template_id),
    (select org_id from inspections           where id = e.inspection_id),
    (select org_id from inspection_findings   where id = e.finding_id),
    (select org_id from assets                where id = e.asset_id),
    (select org_id from documents             where id = e.document_id),
    (select d.org_id
       from document_links dl
       join documents d on d.id = dl.document_id
      where dl.id = e.document_link_id)
  )
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS — assets / documents / document_links
--
--    Tenancy + visibility only. Per-action perm checks (asset:create,
--    document:upload, document:archive, document_link:create / remove)
--    live in the server actions and the RPCs (next migration).
-- ----------------------------------------------------------------------------
alter table assets         enable row level security;
alter table documents      enable row level security;
alter table document_links enable row level security;

-- Assets are site-scoped: a user sees an asset iff they can access its
-- site. include_children inheritance is already baked into
-- user_can_access_site().
create policy assets_read on assets for select to authenticated
  using (
    deleted_at is null
    and org_id = current_org()
    and user_can_access_site(site_id)
  );

create policy assets_write on assets for all to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
  )
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
  );

-- Documents are org-scoped — every member of the org can read every
-- document. site_id is a UI hint for "Houston only" labels but does NOT
-- restrict visibility (the library is the point).
create policy documents_read on documents for select to authenticated
  using (org_id = current_org());

create policy documents_write on documents for all to authenticated
  using (org_id = current_org())
  with check (org_id = current_org());

-- document_links: visible iff the user can see the document. Visibility of
-- the parent record is already enforced by the parent table's own RLS, so
-- we don't double-police it here.
create policy document_links_read on document_links for select to authenticated
  using (
    removed_at is null
    and exists (
      select 1 from documents d
      where d.id = document_links.document_id
        and d.org_id = current_org()
    )
  );

create policy document_links_write on document_links for all to authenticated
  using (
    exists (
      select 1 from documents d
      where d.id = document_links.document_id
        and d.org_id = current_org()
    )
  )
  with check (
    exists (
      select 1 from documents d
      where d.id = document_links.document_id
        and d.org_id = current_org()
    )
  );

-- Append-only audit feel: deny DELETE on document_links from non-superuser
-- callers (soft-remove only). We let UPDATE through so the RPC can flip
-- `removed_at`.
revoke delete on document_links from public;
