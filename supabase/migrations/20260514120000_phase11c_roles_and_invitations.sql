-- ----------------------------------------------------------------------------
-- Phase 11c — Roles editor + Invitations
--
-- Closes the remaining org-admin self-service gaps:
--   - Role permission editing. Today the locked RBAC rule "org owners can edit
--     role permission sets" requires SQL. After 11c, site_admin users can
--     extend default-role permission sets and create custom roles via
--     /admin/roles + /admin/roles/[id].
--   - Email invitations for not-yet-signed-up users. 11b's
--     invite_member_to_site_v1 only resolves existing org profiles and raises
--     a guidance error otherwise. 11c lands the invitations table + the
--     /invite/[token] accept flow + Supabase auth admin email integration.
--
-- Reuses the existing roles.is_default column for "can't rename or delete"
-- guards instead of adding a new is_system column the parent plan called out
-- — same intent.
--
-- Grants:
--   - site_admin gets role:create + role:delete + role:edit (the latter has
--     been dormant since Phase 0) + invitation:read.
--   - ehs_manager gets invitation:read (read-only into the pending list;
--     member:invite from 11b is what gates create + revoke).
--   - Catch-all in seed_default_roles guarantees site_admin in newly-seeded
--     orgs picks the new keys up automatically.
--
-- The notification_kind enum gets a new 'invited' value so the in-app bell
-- renders an "invited" entry distinct from "assigned" when the notification
-- engine fires on invitation.created.
-- ----------------------------------------------------------------------------

-- 1. Enum extension -----------------------------------------------------------
-- ALTER TYPE ADD VALUE works in a transaction as long as the new value isn't
-- used in the same transaction. The 11c migration only declares the value;
-- the app-side notification engine inserts 'invited' notifications at runtime.

alter type notification_kind add value if not exists 'invited';

-- 2. Permission keys + grants -------------------------------------------------

insert into permissions (key, description) values
  ('role:create',      'Create a new custom role'),
  ('role:delete',      'Delete a custom role'),
  ('invitation:read',  'View pending invitations org-wide')
on conflict (key) do nothing;

-- Grant role:create + role:delete + role:edit + invitation:read to site_admin;
-- invitation:read also to ehs_manager. Idempotent across all orgs.
do $$
declare
  v_role record;
begin
  for v_role in select id, key from roles where key in ('site_admin', 'ehs_manager') loop
    if v_role.key = 'site_admin' then
      insert into role_permissions (role_id, permission_key) values
        (v_role.id, 'role:create'),
        (v_role.id, 'role:delete'),
        (v_role.id, 'role:edit'),
        (v_role.id, 'invitation:read')
      on conflict (role_id, permission_key) do nothing;
    elsif v_role.key = 'ehs_manager' then
      insert into role_permissions (role_id, permission_key) values
        (v_role.id, 'invitation:read')
      on conflict (role_id, permission_key) do nothing;
    end if;
  end loop;
end $$;

-- 3. invitations table --------------------------------------------------------

create table if not exists invitations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  site_id           uuid not null references sites(id) on delete cascade,
  role_id           uuid not null references roles(id) on delete restrict,
  include_children  boolean not null default false,
  email             text not null,
  token             text not null unique,
  expires_at        timestamptz not null default (now() + interval '14 days'),
  invited_by        uuid references profiles(id) on delete set null,
  accepted_at       timestamptz,
  revoked_at        timestamptz,
  accepted_by       uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- One pending invitation per (site, lower(email)) at a time. Re-invite after
-- accept or revoke succeeds because the partial predicate filters them out.
create unique index if not exists invitations_pending_email_per_site_idx
  on invitations (site_id, lower(email))
  where accepted_at is null and revoked_at is null;

create index if not exists invitations_org_pending_idx on invitations(org_id)
  where accepted_at is null and revoked_at is null;

create index if not exists invitations_token_idx on invitations(token);

alter table invitations enable row level security;

-- READ: invitation:read org-wide. The current_org() check stays redundant with
-- has_org_permission's site_member walk but keeps tenancy explicit.
drop policy if exists invitations_read on invitations;
create policy invitations_read on invitations for select to authenticated
  using (org_id = current_org() and has_org_permission('invitation:read'));

-- INSERT: member:invite on the target site (RPC also enforces).
drop policy if exists invitations_admin_insert on invitations;
create policy invitations_admin_insert on invitations for insert to authenticated
  with check (
    org_id = current_org()
    and has_permission('member:invite', site_id)
  );

-- UPDATE: only the revoked_at column flips. The RPC sets it; we don't
-- column-restrict in RLS, but member:invite + tenancy gate is enough.
drop policy if exists invitations_admin_update on invitations;
create policy invitations_admin_update on invitations for update to authenticated
  using (
    org_id = current_org()
    and has_permission('member:invite', site_id)
  )
  with check (
    org_id = current_org()
    and has_permission('member:invite', site_id)
  );

-- No DELETE policy — invitations are append-only audit. Revoke flips
-- revoked_at; re-invite creates a fresh row.
revoke delete on invitations from public;

-- 4. RLS — roles + role_permissions admin write paths -------------------------

-- The init.sql roles_read + role_permissions_read policies stay. Add admin
-- write paths gated on org-wide perms.

drop policy if exists roles_admin_insert on roles;
create policy roles_admin_insert on roles for insert to authenticated
  with check (
    org_id = current_org()
    and has_org_permission('role:create')
  );

drop policy if exists roles_admin_update on roles;
create policy roles_admin_update on roles for update to authenticated
  using (
    org_id = current_org()
    and has_org_permission('role:edit')
  )
  with check (
    org_id = current_org()
    and has_org_permission('role:edit')
  );

drop policy if exists roles_admin_delete on roles;
create policy roles_admin_delete on roles for delete to authenticated
  using (
    org_id = current_org()
    and has_org_permission('role:delete')
  );

-- role_permissions: insert + delete gate through the parent role's org_id +
-- the role:edit perm. (We use replace-set semantics in update_role_v1, so a
-- create_role_v1 lands inserts and update_role_v1 replays delete-then-insert.)

drop policy if exists role_permissions_admin_insert on role_permissions;
create policy role_permissions_admin_insert on role_permissions for insert to authenticated
  with check (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.org_id = current_org()
        and (has_org_permission('role:edit') or has_org_permission('role:create'))
    )
  );

drop policy if exists role_permissions_admin_delete on role_permissions;
create policy role_permissions_admin_delete on role_permissions for delete to authenticated
  using (
    exists (
      select 1 from roles r
      where r.id = role_permissions.role_id
        and r.org_id = current_org()
        and has_org_permission('role:edit')
    )
  );

-- 5. RPC — create_role_v1 -----------------------------------------------------
-- Slugs the name into a kebab-case key (with numeric suffix on collision).
-- Validates every entry of p_permission_keys exists in the permissions
-- catalog; rejects unknown keys. is_default lands as false.

create or replace function create_role_v1(
  p_name             text,
  p_description      text,
  p_permission_keys  text[]
) returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id        uuid := auth.uid();
  v_org_id         uuid;
  v_base_key       text;
  v_key            text;
  v_suffix         int := 0;
  v_role_id        uuid;
  v_unknown        text;
  v_perm_count     int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_org_permission('role:create') then
    raise exception 'You do not have permission to create roles'
      using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'Role name is required' using errcode = '23514';
  end if;

  -- Slug: lowercase, replace non-alphanumeric runs with '_', trim leading/
  -- trailing underscores. Add numeric suffix on (org_id, key) collision.
  v_base_key := regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '_', 'g');
  v_base_key := regexp_replace(v_base_key, '^_+|_+$', '', 'g');
  if length(v_base_key) = 0 then
    v_base_key := 'role';
  end if;
  v_key := v_base_key;
  while exists (select 1 from roles where org_id = v_org_id and key = v_key) loop
    v_suffix := v_suffix + 1;
    v_key := v_base_key || '_' || v_suffix::text;
  end loop;

  -- Validate the supplied permission keys exist in the catalog. nulls / blank
  -- entries are stripped first.
  if p_permission_keys is not null then
    select string_agg(k, ', ') into v_unknown
      from unnest(p_permission_keys) k
      where k is not null and length(trim(k)) > 0
        and not exists (select 1 from permissions p where p.key = k);
    if v_unknown is not null then
      raise exception 'Unknown permission key(s): %', v_unknown
        using errcode = '23503';
    end if;
  end if;

  insert into roles (org_id, key, name, description, is_default)
    values (v_org_id, v_key, trim(p_name), nullif(trim(coalesce(p_description, '')), ''), false)
    returning id into v_role_id;

  if p_permission_keys is not null then
    insert into role_permissions (role_id, permission_key)
      select v_role_id, k
        from unnest(p_permission_keys) k
       where k is not null and length(trim(k)) > 0
      on conflict (role_id, permission_key) do nothing;
  end if;

  select count(*) into v_perm_count from role_permissions where role_id = v_role_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'role.created',
          jsonb_build_object(
            'role_id', v_role_id,
            'role_key', v_key,
            'role_name', trim(p_name),
            'permission_count', v_perm_count
          ));

  return v_role_id;
end;
$$;

grant execute on function create_role_v1(text, text, text[]) to authenticated;

comment on function create_role_v1(text, text, text[]) is
  'Creates a custom role with a slug-derived key. Validates permission keys against the catalog. Gates on role:create.';

-- 6. RPC — update_role_v1 -----------------------------------------------------
-- For is_default = true rows: the name is locked (the column updates if
-- the same value is passed; a different value raises). description and
-- permission keys are always editable. Replace-set on role_permissions.

create or replace function update_role_v1(
  p_role_id          uuid,
  p_name             text default null,
  p_description      text default null,
  p_permission_keys  text[] default null
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id        uuid := auth.uid();
  v_org_id         uuid;
  v_role           record;
  v_unknown        text;
  v_old_keys       text[];
  v_new_keys       text[];
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_org_permission('role:edit') then
    raise exception 'You do not have permission to edit roles'
      using errcode = '42501';
  end if;

  select * into v_role from roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role not found' using errcode = '23503';
  end if;
  if v_role.org_id <> v_org_id then
    raise exception 'Role is in a different org' using errcode = '42501';
  end if;

  -- System-role rename guard: name change is rejected when the new value is
  -- materially different from the existing name.
  if v_role.is_default and p_name is not null and trim(p_name) <> v_role.name then
    raise exception 'System roles cannot be renamed'
      using errcode = '42501';
  end if;

  -- Validate permission keys.
  if p_permission_keys is not null then
    select string_agg(k, ', ') into v_unknown
      from unnest(p_permission_keys) k
      where k is not null and length(trim(k)) > 0
        and not exists (select 1 from permissions p where p.key = k);
    if v_unknown is not null then
      raise exception 'Unknown permission key(s): %', v_unknown
        using errcode = '23503';
    end if;
  end if;

  -- Capture old + new sets for the activity payload. NULL p_permission_keys
  -- means "don't touch the set"; '{}'::text[] means "clear the set".
  select array_agg(permission_key order by permission_key)
    into v_old_keys
    from role_permissions where role_id = p_role_id;

  -- Update name + description (name only when changed and not a system role
  -- with an attempted rename — already handled above).
  update roles set
    name        = case when p_name is not null and not is_default then trim(p_name) else name end,
    description = case when p_description is not null then nullif(trim(p_description), '') else description end
  where id = p_role_id;

  if p_permission_keys is not null then
    delete from role_permissions where role_id = p_role_id;
    insert into role_permissions (role_id, permission_key)
      select p_role_id, k
        from unnest(p_permission_keys) k
       where k is not null and length(trim(k)) > 0
      on conflict (role_id, permission_key) do nothing;

    select array_agg(permission_key order by permission_key)
      into v_new_keys
      from role_permissions where role_id = p_role_id;
  else
    v_new_keys := v_old_keys;
  end if;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'role.updated',
          jsonb_build_object(
            'role_id', p_role_id,
            'role_key', v_role.key,
            'is_default', v_role.is_default,
            'old_permission_keys', coalesce(v_old_keys, '{}'::text[]),
            'new_permission_keys', coalesce(v_new_keys, '{}'::text[])
          ));
end;
$$;

grant execute on function update_role_v1(uuid, text, text, text[]) to authenticated;

comment on function update_role_v1(uuid, text, text, text[]) is
  'Updates a role''s name (non-system only), description, and permission set (replace-set). Gates on role:edit.';

-- 7. RPC — delete_role_v1 -----------------------------------------------------
-- Rejects when is_default = true (system roles are eternal). Rejects when any
-- site_members.role_id matches (force admin to reassign first).

create or replace function delete_role_v1(p_role_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id      uuid := auth.uid();
  v_org_id       uuid;
  v_role         record;
  v_member_count int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_org_permission('role:delete') then
    raise exception 'You do not have permission to delete roles'
      using errcode = '42501';
  end if;

  select * into v_role from roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role not found' using errcode = '23503';
  end if;
  if v_role.org_id <> v_org_id then
    raise exception 'Role is in a different org' using errcode = '42501';
  end if;

  if v_role.is_default then
    raise exception 'System roles cannot be deleted'
      using errcode = '42501';
  end if;

  select count(*) into v_member_count
    from site_members where role_id = p_role_id;
  if v_member_count > 0 then
    raise exception
      'Cannot delete this role — % member(s) still hold it. Reassign them first.',
      v_member_count
      using errcode = '23514';
  end if;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'role.deleted',
          jsonb_build_object(
            'role_id', p_role_id,
            'role_key', v_role.key,
            'role_name', v_role.name
          ));

  delete from roles where id = p_role_id;
end;
$$;

grant execute on function delete_role_v1(uuid) to authenticated;

comment on function delete_role_v1(uuid) is
  'Deletes a custom role. Rejects system roles + roles with active members. Gates on role:delete.';

-- 8. RPC — create_invitation_v1 -----------------------------------------------
-- Rejects when an existing org profile already has the email (force the
-- admin to use the per-site Members tab — no double path). Revokes any prior
-- pending invitation for the same (site, lower(email)) before inserting.
-- Generates the token via encode(gen_random_bytes(32), 'hex') (64 hex chars).

create or replace function create_invitation_v1(
  p_site_id          uuid,
  p_email            text,
  p_role_id          uuid,
  p_include_children boolean default false
) returns table (invitation_id uuid, token text)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id    uuid := auth.uid();
  v_org_id     uuid;
  v_site       record;
  v_role       record;
  v_email      text;
  v_token      text;
  v_id         uuid;
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

  v_email := lower(trim(p_email));

  -- Reject when an existing org profile owns the email — admin should use the
  -- per-site Members tab "+ Add member" path instead.
  if exists (
    select 1 from profiles
     where org_id = v_org_id and lower(email) = v_email
  ) then
    raise exception
      'A user with that email is already in your org. Use the Members tab to add them to this site.'
      using errcode = '23505';
  end if;

  select * into v_site from sites where id = p_site_id;
  if v_site is null then
    raise exception 'Site not found' using errcode = '23503';
  end if;
  if v_site.org_id <> v_org_id then
    raise exception 'Site is in a different org' using errcode = '42501';
  end if;
  if v_site.archived_at is not null then
    raise exception 'Cannot invite members to an archived site' using errcode = '23514';
  end if;

  select * into v_role from roles where id = p_role_id;
  if v_role is null then
    raise exception 'Role not found' using errcode = '23503';
  end if;
  if v_role.org_id <> v_org_id then
    raise exception 'Role is in a different org' using errcode = '42501';
  end if;

  -- Revoke any prior pending invitation for the same (site, email) so the
  -- partial unique index doesn't collide on insert.
  update invitations
     set revoked_at = now()
   where site_id = p_site_id
     and lower(email) = v_email
     and accepted_at is null
     and revoked_at is null;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into invitations (
    org_id, site_id, role_id, include_children, email, token, invited_by
  ) values (
    v_org_id, p_site_id, p_role_id, coalesce(p_include_children, false),
    v_email, v_token, v_user_id
  ) returning id into v_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'invitation.created',
          jsonb_build_object(
            'invitation_id', v_id,
            'site_id', p_site_id,
            'role_id', p_role_id,
            'role_key', v_role.key,
            'email', v_email,
            'include_children', coalesce(p_include_children, false)
          ));

  return query select v_id, v_token;
end;
$$;

grant execute on function create_invitation_v1(uuid, text, uuid, boolean) to authenticated;

comment on function create_invitation_v1(uuid, text, uuid, boolean) is
  'Creates a pending invitation. Revokes any prior pending row for the same (site, email). Returns id + 64-hex token. Gates on member:invite.';

-- 9. RPC — revoke_invitation_v1 -----------------------------------------------

create or replace function revoke_invitation_v1(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id  uuid := auth.uid();
  v_org_id   uuid;
  v_inv      record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  select * into v_inv from invitations where id = p_invitation_id;
  if v_inv is null then
    raise exception 'Invitation not found' using errcode = '23503';
  end if;
  if v_inv.org_id <> v_org_id then
    raise exception 'Invitation is in a different org' using errcode = '42501';
  end if;

  if not has_permission('member:invite', v_inv.site_id) then
    raise exception 'You do not have permission to revoke this invitation'
      using errcode = '42501';
  end if;

  if v_inv.accepted_at is not null then
    raise exception 'This invitation was already accepted' using errcode = '23514';
  end if;
  if v_inv.revoked_at is not null then
    -- Idempotent: revoking an already-revoked invitation is a no-op.
    return;
  end if;

  update invitations set revoked_at = now() where id = p_invitation_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'invitation.revoked',
          jsonb_build_object(
            'invitation_id', p_invitation_id,
            'site_id', v_inv.site_id,
            'email', v_inv.email
          ));
end;
$$;

grant execute on function revoke_invitation_v1(uuid) to authenticated;

comment on function revoke_invitation_v1(uuid) is
  'Revokes a pending invitation. Idempotent on already-revoked. Gates on member:invite.';

-- 10. RPC — accept_invitation_v1 ----------------------------------------------
-- NOT permission-gated — the inviting admin is unlikely to be the accepting
-- user. Validates the calling auth user's email matches the invitation's
-- email (case-insensitive), then calls add_site_member_v1.

create or replace function accept_invitation_v1(p_token text)
returns table (
  org_id     uuid,
  site_id    uuid,
  site_name  text,
  role_id    uuid
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id  uuid := auth.uid();
  v_email    text;
  v_inv      record;
  v_site     record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated. Sign in to accept an invitation.'
      using errcode = '42501';
  end if;

  -- Pull the calling user's email from auth.users.
  select lower(u.email) into v_email from auth.users u where u.id = v_user_id;
  if v_email is null then
    raise exception 'Profile email is missing' using errcode = '42501';
  end if;

  if p_token is null or length(p_token) = 0 then
    raise exception 'Invitation token is required' using errcode = '23514';
  end if;

  select * into v_inv from invitations where token = p_token;
  if v_inv is null then
    raise exception 'Invitation not found' using errcode = '23503';
  end if;

  if v_inv.revoked_at is not null then
    raise exception 'This invitation was revoked' using errcode = '23514';
  end if;
  if v_inv.accepted_at is not null then
    raise exception 'This invitation was already accepted' using errcode = '23514';
  end if;
  if v_inv.expires_at <= now() then
    raise exception 'This invitation expired on %', to_char(v_inv.expires_at, 'YYYY-MM-DD')
      using errcode = '23514';
  end if;

  if v_inv.email <> v_email then
    raise exception
      'This invitation is for a different email. Sign in with the invited email to accept.'
      using errcode = '42501';
  end if;

  -- Ensure the accepting user has a profile in the inviting org. If they
  -- signed up with the invited email but the auto-profile-creation trigger
  -- placed them in a different org, raise an actionable error.
  if not exists (
    select 1 from profiles where id = v_user_id and org_id = v_inv.org_id
  ) then
    raise exception
      'Your profile is not in the inviting organization yet. Contact your admin.'
      using errcode = '42501';
  end if;

  -- Land the membership via the existing 11b RPC (idempotent upsert).
  perform add_site_member_v1(
    v_inv.site_id, v_user_id, v_inv.role_id, v_inv.include_children
  );

  -- Lookup site name for the accept-success redirect copy.
  select * into v_site from sites where id = v_inv.site_id;

  update invitations
     set accepted_at = now(),
         accepted_by = v_user_id
   where id = v_inv.id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'invitation.accepted',
          jsonb_build_object(
            'invitation_id', v_inv.id,
            'site_id', v_inv.site_id,
            'role_id', v_inv.role_id,
            'invited_by', v_inv.invited_by
          ));

  return query select v_inv.org_id, v_inv.site_id, v_site.name, v_inv.role_id;
end;
$$;

grant execute on function accept_invitation_v1(text) to authenticated;

comment on function accept_invitation_v1(text) is
  'Accepts an invitation by token. Validates email match + not-expired + not-revoked + not-accepted. Calls add_site_member_v1. NOT permission-gated.';

-- 11. seed_default_roles update ----------------------------------------------
-- Future orgs need ehs_manager to land with invitation:read. site_admin
-- catch-all picks up role:create / role:delete / invitation:read automatically.

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

  -- ehs_manager (Phase 11c adds invitation:read)
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
    (v_role_id, 'document:upload'),
    (v_role_id, 'invitation:read')
  on conflict do nothing;

  -- site_admin (catch-all picks up new keys at run time, including the 3
  -- 11c keys: role:create, role:delete, invitation:read).
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;
