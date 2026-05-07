-- ----------------------------------------------------------------------------
-- Phase 11b — Members admin
--
-- Reclaims the dormant `member:invite` + `member:manage` perm keys (declared
-- in init.sql:121–122 since Phase 0 but never granted to any default role)
-- and pairs them with admin-write RLS on `site_members` plus 4 atomic RPCs:
--
--   - add_site_member_v1: idempotent upsert on (profile_id, site_id). Logs
--     `member.added` (or `member.role_changed` on the upsert path).
--   - remove_site_member_v1: per-site last-admin guard (rejects when removing
--     the only `site_admin` row on a site). Logs `member.removed`.
--   - change_site_member_role_v1: same per-site last-admin guard fires on
--     demote-from-site_admin. Logs `member.role_changed`.
--   - invite_member_to_site_v1: in 11b, a thin wrapper that resolves email
--     -> existing profile -> calls add_site_member_v1. If the email isn't
--     yet a registered user, raises a guidance error directing the admin to
--     11c (which lands the invitations table + magic-link flow).
--
-- Grants:
--   - site_admin gets member:invite + member:manage.
--   - ehs_manager gets member:invite only (can invite + add existing users
--     to a site, but cannot change roles or remove members).
--
-- RLS additions on `site_members` (the existing site_members_read policy
-- post-Phase-6a recursion-fix uses `user_can_access_site` and stays intact):
--   - site_members_admin_insert: with check (has_permission('member:manage', site_id))
--   - site_members_admin_update: same gate, plus same WITH CHECK
--   - site_members_admin_delete: using (has_permission('member:manage', site_id))
-- ----------------------------------------------------------------------------

-- 1. Grants -------------------------------------------------------------------

do $$
declare
  v_role record;
begin
  for v_role in select id, key from roles where key in ('site_admin', 'ehs_manager') loop
    -- Both roles get member:invite.
    insert into role_permissions (role_id, permission_key) values
      (v_role.id, 'member:invite')
    on conflict (role_id, permission_key) do nothing;

    -- Only site_admin gets member:manage.
    if v_role.key = 'site_admin' then
      insert into role_permissions (role_id, permission_key) values
        (v_role.id, 'member:manage')
      on conflict (role_id, permission_key) do nothing;
    end if;
  end loop;
end $$;

-- 2. RLS — site_members admin write paths -------------------------------------

drop policy if exists site_members_admin_insert on site_members;
create policy site_members_admin_insert on site_members
  for insert to authenticated
  with check (has_permission('member:manage', site_id));

drop policy if exists site_members_admin_update on site_members;
create policy site_members_admin_update on site_members
  for update to authenticated
  using (has_permission('member:manage', site_id))
  with check (has_permission('member:manage', site_id));

drop policy if exists site_members_admin_delete on site_members;
create policy site_members_admin_delete on site_members
  for delete to authenticated
  using (has_permission('member:manage', site_id));

-- 3. RPC — add_site_member_v1 -------------------------------------------------
-- Idempotent upsert: re-calling with a different role updates instead of
-- erroring. Treats as add when no prior row exists, as role-change when one
-- does.

create or replace function add_site_member_v1(
  p_site_id          uuid,
  p_profile_id       uuid,
  p_role_id          uuid,
  p_include_children boolean default false
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id     uuid := auth.uid();
  v_org_id      uuid;
  v_site        record;
  v_profile     record;
  v_role        record;
  v_existing    record;
  v_verb        text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('member:manage', p_site_id) then
    raise exception 'You do not have permission to manage members on this site'
      using errcode = '42501';
  end if;

  select * into v_site from sites where id = p_site_id;
  if v_site is null then
    raise exception 'Site not found' using errcode = '23503';
  end if;
  if v_site.org_id <> v_org_id then
    raise exception 'Site is in a different org' using errcode = '42501';
  end if;
  if v_site.archived_at is not null then
    raise exception 'Cannot manage members on an archived site' using errcode = '23514';
  end if;

  select * into v_profile from profiles where id = p_profile_id;
  if v_profile is null then
    raise exception 'Profile not found' using errcode = '23503';
  end if;
  if v_profile.org_id <> v_org_id then
    raise exception 'Profile is in a different org' using errcode = '42501';
  end if;

  select * into v_role from roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role not found' using errcode = '23503';
  end if;
  if v_role.org_id <> v_org_id then
    raise exception 'Role is in a different org' using errcode = '42501';
  end if;

  -- Detect upsert path so we can emit the right activity verb.
  select * into v_existing from site_members
   where site_id = p_site_id and profile_id = p_profile_id;

  insert into site_members (site_id, profile_id, role_id, include_children)
  values (p_site_id, p_profile_id, p_role_id, coalesce(p_include_children, false))
  on conflict (profile_id, site_id) do update set
    role_id          = excluded.role_id,
    include_children = excluded.include_children;

  if v_existing is null then
    v_verb := 'member.added';
  else
    v_verb := 'member.role_changed';
  end if;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, v_verb,
          jsonb_build_object(
            'site_id', p_site_id,
            'profile_id', p_profile_id,
            'role_id', p_role_id,
            'role_key', v_role.key,
            'include_children', coalesce(p_include_children, false)
          ));
end;
$$;

grant execute on function add_site_member_v1(uuid, uuid, uuid, boolean) to authenticated;

comment on function add_site_member_v1(uuid, uuid, uuid, boolean) is
  'Adds (or upserts the role of) a profile on a site. Gates on member:manage. Logs member.added or member.role_changed.';

-- 4. RPC — change_site_member_role_v1 -----------------------------------------
-- Separate signature from add even though add upserts, so the UI flow for
-- "change role on existing member" stays explicit. The per-site last-admin
-- guard fires when demoting from site_admin.

create or replace function change_site_member_role_v1(
  p_site_id          uuid,
  p_profile_id       uuid,
  p_role_id          uuid,
  p_include_children boolean default false
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id        uuid := auth.uid();
  v_org_id         uuid;
  v_site           record;
  v_role           record;
  v_existing       record;
  v_old_role_key   text;
  v_admin_count    int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('member:manage', p_site_id) then
    raise exception 'You do not have permission to manage members on this site'
      using errcode = '42501';
  end if;

  select * into v_site from sites where id = p_site_id;
  if v_site is null then
    raise exception 'Site not found' using errcode = '23503';
  end if;
  if v_site.org_id <> v_org_id then
    raise exception 'Site is in a different org' using errcode = '42501';
  end if;
  if v_site.archived_at is not null then
    raise exception 'Cannot manage members on an archived site' using errcode = '23514';
  end if;

  select * into v_role from roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role not found' using errcode = '23503';
  end if;
  if v_role.org_id <> v_org_id then
    raise exception 'Role is in a different org' using errcode = '42501';
  end if;

  select sm.*, r.key as role_key
    into v_existing
    from site_members sm
    join roles r on r.id = sm.role_id
   where sm.site_id = p_site_id and sm.profile_id = p_profile_id;
  if v_existing is null then
    raise exception 'Member is not on this site' using errcode = '23503';
  end if;

  v_old_role_key := v_existing.role_key;

  -- Last-admin guard: if the existing role is site_admin and the new role is
  -- NOT site_admin, count remaining site_admin rows for this site.
  if v_old_role_key = 'site_admin' and v_role.key <> 'site_admin' then
    select count(*)
      into v_admin_count
      from site_members sm
      join roles r on r.id = sm.role_id
     where sm.site_id = p_site_id and r.key = 'site_admin';
    if v_admin_count <= 1 then
      raise exception
        'There must be at least one site admin on every site. Promote another member first.'
        using errcode = '23514';
    end if;
  end if;

  update site_members set
    role_id          = p_role_id,
    include_children = coalesce(p_include_children, false)
  where site_id = p_site_id and profile_id = p_profile_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'member.role_changed',
          jsonb_build_object(
            'site_id', p_site_id,
            'profile_id', p_profile_id,
            'old_role_key', v_old_role_key,
            'new_role_id', p_role_id,
            'new_role_key', v_role.key,
            'include_children', coalesce(p_include_children, false)
          ));
end;
$$;

grant execute on function change_site_member_role_v1(uuid, uuid, uuid, boolean) to authenticated;

comment on function change_site_member_role_v1(uuid, uuid, uuid, boolean) is
  'Changes a member''s role on a site. Per-site last-admin guard rejects demoting the only site_admin. Gates on member:manage.';

-- 5. RPC — remove_site_member_v1 ----------------------------------------------

create or replace function remove_site_member_v1(
  p_site_id     uuid,
  p_profile_id  uuid
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id      uuid := auth.uid();
  v_org_id       uuid;
  v_site         record;
  v_existing     record;
  v_old_role_key text;
  v_admin_count  int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('member:manage', p_site_id) then
    raise exception 'You do not have permission to manage members on this site'
      using errcode = '42501';
  end if;

  select * into v_site from sites where id = p_site_id;
  if v_site is null then
    raise exception 'Site not found' using errcode = '23503';
  end if;
  if v_site.org_id <> v_org_id then
    raise exception 'Site is in a different org' using errcode = '42501';
  end if;

  select sm.*, r.key as role_key
    into v_existing
    from site_members sm
    join roles r on r.id = sm.role_id
   where sm.site_id = p_site_id and sm.profile_id = p_profile_id;
  if v_existing is null then
    raise exception 'Member is not on this site' using errcode = '23503';
  end if;

  v_old_role_key := v_existing.role_key;

  -- Last-admin guard: if removing a site_admin, count remaining site_admin
  -- rows for this site and reject if this is the only one.
  if v_old_role_key = 'site_admin' then
    select count(*)
      into v_admin_count
      from site_members sm
      join roles r on r.id = sm.role_id
     where sm.site_id = p_site_id and r.key = 'site_admin';
    if v_admin_count <= 1 then
      raise exception
        'There must be at least one site admin on every site. Promote another member first.'
        using errcode = '23514';
    end if;
  end if;

  delete from site_members
   where site_id = p_site_id and profile_id = p_profile_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'member.removed',
          jsonb_build_object(
            'site_id', p_site_id,
            'profile_id', p_profile_id,
            'old_role_key', v_old_role_key
          ));
end;
$$;

grant execute on function remove_site_member_v1(uuid, uuid) to authenticated;

comment on function remove_site_member_v1(uuid, uuid) is
  'Removes a member from a site. Per-site last-admin guard rejects removing the only site_admin. Gates on member:manage.';

-- 6. RPC — invite_member_to_site_v1 -------------------------------------------
-- 11b version: only resolves an existing org email. If the email isn't a
-- registered user, raises a guidance error directing the admin to 11c. The
-- full email-invite-for-not-yet-signed-up flow lands with the invitations
-- table in 11c.

create or replace function invite_member_to_site_v1(
  p_site_id          uuid,
  p_email            text,
  p_role_id          uuid,
  p_include_children boolean default false
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id     uuid := auth.uid();
  v_org_id      uuid;
  v_profile_id  uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('member:invite', p_site_id) then
    raise exception 'You do not have permission to invite members to this site'
      using errcode = '42501';
  end if;

  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required' using errcode = '23514';
  end if;

  -- Look up existing profile by email within the same org.
  select id into v_profile_id
    from profiles
   where lower(email) = lower(trim(p_email))
     and org_id = v_org_id;

  if v_profile_id is null then
    raise exception
      'No user with that email is in your org yet. Email invitations for new users ship in Phase 11c.'
      using errcode = '23503';
  end if;

  -- Caller must also have member:manage to actually add the member. invite
  -- without manage would surface the existence of the user but never finish
  -- the add. We surface that asymmetry now rather than at upsert time.
  if not has_permission('member:manage', p_site_id) then
    raise exception
      'A site admin needs to add the member. Send the request to your site admin.'
      using errcode = '42501';
  end if;

  perform add_site_member_v1(p_site_id, v_profile_id, p_role_id, p_include_children);
end;
$$;

grant execute on function invite_member_to_site_v1(uuid, text, uuid, boolean) to authenticated;

comment on function invite_member_to_site_v1(uuid, text, uuid, boolean) is
  '11b: resolves email -> existing org profile -> add_site_member_v1. Email-for-not-yet-signed-up flow lands in 11c.';
