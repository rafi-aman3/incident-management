-- ============================================================================
-- Phase 5 — new permission key for the unified Planner calendar
-- ============================================================================
-- Single net-new key. Granted to all 4 default roles in every existing org
-- (worker / supervisor / ehs_manager directly; site_admin via the catch-all).
--
-- Why a dedicated key (vs. relying on the per-source reads we already have):
-- the planner is a cross-module surface, and a future executive view that
-- aggregates across orgs (post-v1) will key off this same perm at a different
-- scope. Costs nothing now; future-proofs the gate.
--
-- Per plans/05-planner.md §A1.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Register the new key (idempotent)
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('planner:read', 'View the unified Planner calendar')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Grant the new key to every default role in every existing org
--    (worker / supervisor / ehs_manager explicitly; site_admin via catch-all)
-- ----------------------------------------------------------------------------
insert into role_permissions (role_id, permission_key)
  select r.id, 'planner:read'
    from roles r
   where r.is_default = true
     and r.key in ('worker', 'supervisor', 'ehs_manager')
on conflict do nothing;

-- site_admin: catch-all (every key in the registry, including the new one)
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- 3. Update seed_default_roles() so future orgs receive the new grant
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
    (v_role_id, 'document_link:create'),
    (v_role_id, 'planner:read')
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
    (v_role_id, 'planner:read')
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
    (v_role_id, 'planner:read')
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
