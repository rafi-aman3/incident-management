-- ============================================================================
-- Phase 4 — new permission keys for resources (assets + documents + links)
-- ============================================================================
-- Net-new keys (9) on top of the existing registry. Replaces the legacy
-- placeholder `asset:manage` (init.sql §4) with four fine-grained CRUD keys.
-- Existing key `document:upload` is kept and now granted to worker /
-- supervisor as well (Phase 3 only granted it to ehs_manager).
--
-- Default-role grants (composes with the catch-all on site_admin):
--
--   worker      — asset:read_site, document:read_org, document:upload,
--                 document_link:create
--   supervisor  — worker + asset:edit, document_link:remove
--   ehs_manager — supervisor + asset:create, document:edit_metadata,
--                 document:archive
--   site_admin  — all (via catch-all)
--
-- Per plans/04-resources.md §A4.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Register new keys (idempotent)
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('asset:read_site',        'View assets at a site'),
  ('asset:create',           'Create new assets'),
  ('asset:edit',             'Edit asset metadata, condition, or PM dates'),
  ('asset:delete',           'Soft-delete an asset'),

  ('document:read_org',      'View any document in the org library'),
  ('document:edit_metadata', 'Edit a document''s name, type, expiry, or replace its file'),
  ('document:archive',       'Archive (soft-retire) a document'),

  ('document_link:create',   'Link a document to an incident, investigation, CAPA, asset, etc.'),
  ('document_link:remove',   'Remove a document link from a parent record')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Retire the placeholder `asset:manage` key. The FK on role_permissions
--    is `on delete cascade`, so existing grants disappear too.
-- ----------------------------------------------------------------------------
delete from permissions where key = 'asset:manage';

-- ----------------------------------------------------------------------------
-- 3. Grant new keys to the matching default roles in every existing org
-- ----------------------------------------------------------------------------

-- worker: read assets, browse + upload documents, create links
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('asset:read_site'),
      ('document:read_org'),
      ('document:upload'),
      ('document_link:create')
    ) as k(key)
   where r.is_default = true
     and r.key = 'worker'
on conflict do nothing;

-- supervisor (worker + edit assets + remove links)
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('asset:read_site'),
      ('asset:edit'),
      ('document:read_org'),
      ('document:upload'),
      ('document_link:create'),
      ('document_link:remove')
    ) as k(key)
   where r.is_default = true
     and r.key = 'supervisor'
on conflict do nothing;

-- ehs_manager (supervisor + create assets + manage document metadata + archive)
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('asset:read_site'),
      ('asset:create'),
      ('asset:edit'),
      ('document:read_org'),
      ('document:upload'),
      ('document:edit_metadata'),
      ('document:archive'),
      ('document_link:create'),
      ('document_link:remove')
    ) as k(key)
   where r.is_default = true
     and r.key = 'ehs_manager'
on conflict do nothing;

-- site_admin: catch-all (every key in the registry, including the new ones)
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 4. Update seed_default_roles() so future orgs receive the new grants
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
    (v_role_id, 'document_link:create')
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
    (v_role_id, 'document_link:remove')
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
    (v_role_id, 'document_link:remove')
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
