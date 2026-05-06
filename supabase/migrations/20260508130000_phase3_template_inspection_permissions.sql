-- ============================================================================
-- Phase 3 — new permission keys for templates + inspections + findings
-- ============================================================================
-- Net-new keys (13) on top of the existing registry. The legacy keys
-- `template:create`, `template:publish`, and `inspection:run` from
-- init.sql §4 are kept (some seed code references them); new fine-grained
-- keys augment rather than replace them.
--
-- Default-role grants (composes with the catch-all on site_admin):
--
--   worker      — template:read_org, inspection:read_site, inspection:start,
--                 inspection:edit_own, inspection:complete, finding:read
--   supervisor  — worker + inspection:edit_any, finding:resolve,
--                 finding:escalate
--   ehs_manager — supervisor + template:create, template:edit, template:publish,
--                 template:archive, template:assign, inspection:delete
--   site_admin  — all (via catch-all)
--
-- Permission key naming follows existing `<entity>:<verb>` convention.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Register new keys (idempotent)
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('template:read_org',     'List org templates and the system-preset library'),
  ('template:edit',         'Edit draft template versions'),
  ('template:archive',      'Archive an org template'),
  ('template:assign',       'Assign a template to a site with a schedule'),

  ('inspection:read_site',  'View inspections at a site'),
  ('inspection:start',      'Start a new inspection from a template'),
  ('inspection:edit_own',   'Edit answers on inspections you started'),
  ('inspection:edit_any',   'Edit answers on any inspection at the site'),
  ('inspection:complete',   'Submit / complete an inspection'),
  ('inspection:delete',     'Soft-delete an inspection'),

  ('finding:read',          'View inspection findings'),
  ('finding:resolve',       'Mark a finding resolved'),
  ('finding:escalate',      'Escalate a finding to an incident')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Grant new keys to the matching default roles in every existing org
-- ----------------------------------------------------------------------------

-- worker
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('template:read_org'),
      ('inspection:read_site'),
      ('inspection:start'),
      ('inspection:edit_own'),
      ('inspection:complete'),
      ('finding:read')
    ) as k(key)
   where r.is_default = true
     and r.key = 'worker'
on conflict do nothing;

-- supervisor (worker keys + edit_any + finding actions)
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('template:read_org'),
      ('inspection:read_site'),
      ('inspection:start'),
      ('inspection:edit_own'),
      ('inspection:edit_any'),
      ('inspection:complete'),
      ('finding:read'),
      ('finding:resolve'),
      ('finding:escalate')
    ) as k(key)
   where r.is_default = true
     and r.key = 'supervisor'
on conflict do nothing;

-- ehs_manager (supervisor + template authoring/assigning + inspection delete)
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('template:read_org'),
      ('template:create'),                              -- existed pre-Phase 3
      ('template:edit'),
      ('template:publish'),                             -- existed pre-Phase 3
      ('template:archive'),
      ('template:assign'),
      ('inspection:read_site'),
      ('inspection:start'),
      ('inspection:edit_own'),
      ('inspection:edit_any'),
      ('inspection:complete'),
      ('inspection:delete'),
      ('finding:read'),
      ('finding:resolve'),
      ('finding:escalate')
    ) as k(key)
   where r.is_default = true
     and r.key = 'ehs_manager'
on conflict do nothing;

-- site_admin: catch-all (every key in the registry)
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3. Update seed_default_roles() so future orgs receive the new grants
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
    (v_role_id, 'finding:read')
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
    (v_role_id, 'finding:escalate')
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
    (v_role_id, 'document:upload')
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
