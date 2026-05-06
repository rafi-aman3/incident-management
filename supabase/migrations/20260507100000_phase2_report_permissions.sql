-- ============================================================================
-- Phase 2 — new permission keys for reports / CAPA verification / demo reset
-- ============================================================================
-- Adds 4 net-new keys on top of the 25 seeded in init.sql §4:
--
--   report:edit_hours            — annual hours-worked input on OSHA 300A
--   capa:reassign_verifier       — change the verifier on an existing CAPA
--   notification:hse_record_edit — record HSE phone / online submission timestamps
--   demo:reset                   — run the demo affordances (reset / sample-load)
--
-- Grants:
--   - ehs_manager  → report:edit_hours, capa:reassign_verifier,
--                    notification:hse_record_edit
--   - site_admin   → all 4 (auto-included by the catch-all in seed_default_roles;
--                    explicit grant added here for existing orgs)
--   - supervisor   → no new grants
--   - worker       → no new grants
--
-- Convention: matches existing key naming `<entity>:<verb>` (`report:read`,
-- `incident:override_severity`, …) — not `:view`.
-- ============================================================================

insert into permissions (key, description) values
  ('report:edit_hours',            'Edit annual hours-worked for OSHA 300A'),
  ('capa:reassign_verifier',       'Reassign the independent verifier on a CAPA'),
  ('notification:hse_record_edit', 'Record HSE phone / online submission timestamps'),
  ('demo:reset',                   'Run demo data reset and sample-load affordances')
on conflict (key) do nothing;

-- Grant the new keys to existing default ehs_manager roles in every org
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('report:edit_hours'),
      ('capa:reassign_verifier'),
      ('notification:hse_record_edit')
    ) as k(key)
   where r.is_default = true
     and r.key = 'ehs_manager'
on conflict do nothing;

-- site_admin gets every permission (mirrors the catch-all in seed_default_roles)
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- ----------------------------------------------------------------------------
-- Update seed_default_roles() so future orgs receive the new ehs_manager grants
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
    (v_role_id, 'capa:reassign_verifier'),
    (v_role_id, 'report:read'),
    (v_role_id, 'report:export'),
    (v_role_id, 'report:edit_hours'),
    (v_role_id, 'notification:hse_record_edit'),
    (v_role_id, 'template:create'),
    (v_role_id, 'template:publish'),
    (v_role_id, 'inspection:run'),
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
