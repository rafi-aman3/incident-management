-- ----------------------------------------------------------------------------
-- Phase 6a polish — create_site_v1 RPC
--
-- V1 had no UI flow to create a brand-new site: scripts/seed.ts inserted
-- rows directly via the service role and the /admin/site-setup wizard only
-- updates existing sites. A fresh org or a fresh user with no memberships
-- had no path forward (the topbar SiteSwitcher and dashboard empty card
-- both pointed at /admin/site-setup, which gates on an existing site).
--
-- This RPC closes that gap with a single atomic security-definer call:
--   1. Validates the caller is authenticated and resolves their org via
--      profiles.
--   2. Gates: caller must be either bootstrapping (zero memberships in
--      their org) OR already hold the site_admin role somewhere in the
--      same org. Anyone with site_admin can spin up additional sites.
--   3. Validates parent_site_id (if provided) lives in the caller's org.
--   4. Inserts the new sites row.
--   5. Auto-grants site_admin (with include_children = true) to the
--      caller via site_members. The catch-all role-permission grant
--      from seed_default_roles() means this immediately unlocks every
--      capability on the new site.
--   6. Returns the new site_id so the calling Server Action can flip
--      the selected_site cookie + redirect into the configuration wizard.
--
-- Sites table has no INSERT RLS policy and the codebase favors atomic RPCs
-- over per-table policies (see Phase 3/4 RPC pattern). SECURITY DEFINER
-- bypasses RLS; gating is enforced in SQL above.
-- ----------------------------------------------------------------------------

create or replace function create_site_v1(
  p_name             text,
  p_country          text,
  p_timezone         text default 'UTC',
  p_address          text default null,
  p_naics_code       text default null,
  p_parent_site_id   uuid default null
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id           uuid := auth.uid();
  v_org_id            uuid;
  v_site_id           uuid;
  v_admin_role_id     uuid;
  v_membership_count  int;
  v_is_admin_anywhere boolean;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Resolve org via profiles
  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  -- Validate inputs
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Site name is required' using errcode = '23514';
  end if;
  if p_country is null or p_country not in ('US', 'GB') then
    raise exception 'Country must be US or GB' using errcode = '23514';
  end if;

  -- Gate: bootstrap (zero memberships) OR existing site_admin in same org
  select count(*) into v_membership_count
    from site_members where profile_id = v_user_id;

  select exists(
    select 1
      from site_members sm
      join roles r on r.id = sm.role_id
      join sites s on s.id = sm.site_id
     where sm.profile_id = v_user_id
       and r.key = 'site_admin'
       and s.org_id = v_org_id
  ) into v_is_admin_anywhere;

  if v_membership_count > 0 and not v_is_admin_anywhere then
    raise exception
      'You need site_admin on at least one existing site to create more sites'
      using errcode = '42501';
  end if;

  -- Validate parent_site_id if provided
  if p_parent_site_id is not null then
    if not exists(
      select 1 from sites where id = p_parent_site_id and org_id = v_org_id
    ) then
      raise exception 'Parent site not found in your org'
        using errcode = '23503';
    end if;
  end if;

  -- Resolve site_admin role for this org
  select id into v_admin_role_id
    from roles
   where org_id = v_org_id and key = 'site_admin'
   limit 1;
  if v_admin_role_id is null then
    raise exception 'site_admin role missing for this org — re-run seed_default_roles()'
      using errcode = 'P0001';
  end if;

  -- Insert site
  insert into sites (org_id, name, country, timezone, address, naics_code, parent_site_id)
  values (
    v_org_id,
    trim(p_name),
    p_country,
    coalesce(p_timezone, 'UTC'),
    nullif(trim(coalesce(p_address, '')), ''),
    nullif(trim(coalesce(p_naics_code, '')), ''),
    p_parent_site_id
  )
  returning id into v_site_id;

  -- Auto-grant site_admin to the creator
  insert into site_members (site_id, profile_id, role_id, include_children)
  values (v_site_id, v_user_id, v_admin_role_id, true);

  return v_site_id;
end;
$$;

grant execute on function create_site_v1(text, text, text, text, text, uuid)
  to authenticated;

comment on function create_site_v1(text, text, text, text, text, uuid) is
  'Creates a new site for the caller''s org and grants the caller site_admin membership. Allowed when the caller has zero memberships (org bootstrap) OR holds site_admin somewhere in the same org.';
