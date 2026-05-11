-- ============================================================================
-- Phase 10 — Safety Bulletins
-- ============================================================================
-- Standalone post-investigation lessons-learned module. See
-- plans/10-safety-bulletins.md and IMS_PLANNING §6.4.3 / §12.2.16.
--
-- Demo-grade scope: one table + one enum + two permission keys + RLS.
-- Audience targeting (per-site/role) and acknowledgements deferred to
-- Phase 10.5 — both extensions hang off this table without altering it
-- (FKs go the other way), so no future migration needs to touch
-- safety_bulletins to add them.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Enum + table
-- ----------------------------------------------------------------------------
create type safety_bulletin_status as enum ('draft', 'published', 'archived');

create table safety_bulletins (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references orgs(id) on delete cascade,
  source_incident_id       uuid references incidents(id) on delete set null,
  source_investigation_id  uuid references investigations(id) on delete set null,
  title                    text not null,
  summary                  text,
  body                     text not null default '',
  status                   safety_bulletin_status not null default 'draft',
  created_by               uuid references profiles(id) on delete set null,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  published_at             timestamptz,
  archived_at              timestamptz,
  constraint published_requires_timestamp
    check (status <> 'published' or published_at is not null)
);

create trigger safety_bulletins_updated
  before update on safety_bulletins
  for each row execute function set_updated_at();

create index safety_bulletins_org_published_idx
  on safety_bulletins(org_id, published_at desc)
  where archived_at is null and status = 'published';

create index safety_bulletins_org_status_idx
  on safety_bulletins(org_id, status)
  where archived_at is null;

create index safety_bulletins_source_inv_idx
  on safety_bulletins(source_investigation_id)
  where source_investigation_id is not null and archived_at is null;


-- ----------------------------------------------------------------------------
-- 2. RLS
-- ----------------------------------------------------------------------------
alter table safety_bulletins enable row level security;

-- Read: anyone in the org sees published rows; authors see their own drafts.
-- Archived rows are still visible (auditable) but the UI filters them.
create policy safety_bulletins_read
  on safety_bulletins for select to authenticated
  using (
    org_id = current_org()
    and (status = 'published' or status = 'archived' or created_by = auth.uid())
  );

-- Insert: gated on bulletin:create. Author always = auth.uid() (enforced
-- in the server action; RLS double-checks via with check).
create policy safety_bulletins_insert
  on safety_bulletins for insert to authenticated
  with check (
    org_id = current_org()
    and created_by = auth.uid()
    and exists (
      select 1 from role_permissions rp
      join roles r on r.id = rp.role_id
      join site_members sm on sm.role_id = r.id and sm.profile_id = auth.uid()
      where rp.permission_key = 'bulletin:create' and r.org_id = current_org()
      limit 1
    )
  );

-- Update: author can edit own drafts; bulletin:publish holders can publish /
-- unpublish / archive any row in the org.
create policy safety_bulletins_update
  on safety_bulletins for update to authenticated
  using (
    org_id = current_org()
    and (
      (created_by = auth.uid() and status = 'draft')
      or exists (
        select 1 from role_permissions rp
        join roles r on r.id = rp.role_id
        join site_members sm on sm.role_id = r.id and sm.profile_id = auth.uid()
        where rp.permission_key = 'bulletin:publish' and r.org_id = current_org()
        limit 1
      )
    )
  )
  with check (org_id = current_org());

-- Delete: blocked outright. Archive via status + archived_at instead.
-- (No policy added — default is deny.)


-- ----------------------------------------------------------------------------
-- 3. Permission keys
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('bulletin:create',  'Create and edit draft safety bulletins'),
  ('bulletin:publish', 'Publish, unpublish, or archive safety bulletins')
on conflict (key) do nothing;

-- Grant to ehs_manager + site_admin in every existing org. site_admin gets
-- it via the catch-all below too, but the explicit grant keeps the audit
-- trail clean.
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values ('bulletin:create'), ('bulletin:publish')) as k(key)
   where r.is_default = true
     and r.key in ('ehs_manager', 'site_admin')
on conflict do nothing;

-- site_admin catch-all (re-runs harmlessly thanks to on conflict do nothing).
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 4. Patch seed_default_roles() so future orgs get the new grants
-- ----------------------------------------------------------------------------
-- The function is rewritten in full because plpgsql doesn't support a clean
-- partial-update pattern. Mirrors the Phase 5 + 9a precedent.
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
    (v_role_id, 'role:read'),
    (v_role_id, 'template:read_org'),
    (v_role_id, 'inspection:read_site'),
    (v_role_id, 'inspection:start'),
    (v_role_id, 'inspection:edit_own'),
    (v_role_id, 'inspection:complete'),
    (v_role_id, 'finding:read'),
    (v_role_id, 'asset:read_site'),
    (v_role_id, 'document:read_org'),
    (v_role_id, 'document:upload'),
    (v_role_id, 'document_link:create'),
    (v_role_id, 'planner:read'),
    (v_role_id, 'argus:use')
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
    (v_role_id, 'inspection:run'),
    (v_role_id, 'template:read_org'),
    (v_role_id, 'inspection:read_site'),
    (v_role_id, 'inspection:start'),
    (v_role_id, 'inspection:edit_own'),
    (v_role_id, 'inspection:edit_any'),
    (v_role_id, 'inspection:complete'),
    (v_role_id, 'finding:read'),
    (v_role_id, 'finding:resolve'),
    (v_role_id, 'finding:escalate'),
    (v_role_id, 'asset:read_site'),
    (v_role_id, 'asset:edit'),
    (v_role_id, 'document:read_org'),
    (v_role_id, 'document:upload'),
    (v_role_id, 'document_link:create'),
    (v_role_id, 'document_link:remove'),
    (v_role_id, 'planner:read'),
    (v_role_id, 'argus:use')
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
    (v_role_id, 'capa:reassign_verifier'),
    (v_role_id, 'report:read'),
    (v_role_id, 'report:export'),
    (v_role_id, 'report:edit_hours'),
    (v_role_id, 'notification:hse_record_edit'),
    (v_role_id, 'template:read_org'),
    (v_role_id, 'template:create'),
    (v_role_id, 'template:edit'),
    (v_role_id, 'template:publish'),
    (v_role_id, 'template:archive'),
    (v_role_id, 'template:assign'),
    (v_role_id, 'inspection:run'),
    (v_role_id, 'inspection:read_site'),
    (v_role_id, 'inspection:start'),
    (v_role_id, 'inspection:edit_own'),
    (v_role_id, 'inspection:edit_any'),
    (v_role_id, 'inspection:complete'),
    (v_role_id, 'inspection:delete'),
    (v_role_id, 'finding:read'),
    (v_role_id, 'finding:resolve'),
    (v_role_id, 'finding:escalate'),
    (v_role_id, 'asset:read_site'),
    (v_role_id, 'asset:create'),
    (v_role_id, 'asset:edit'),
    (v_role_id, 'document:read_org'),
    (v_role_id, 'document:upload'),
    (v_role_id, 'document:edit_metadata'),
    (v_role_id, 'document:archive'),
    (v_role_id, 'document_link:create'),
    (v_role_id, 'document_link:remove'),
    (v_role_id, 'planner:read'),
    (v_role_id, 'bulletin:create'),
    (v_role_id, 'bulletin:publish'),
    (v_role_id, 'argus:use')
  on conflict do nothing;

  -- site_admin (full system access — catch-all picks up new keys at run time)
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;
