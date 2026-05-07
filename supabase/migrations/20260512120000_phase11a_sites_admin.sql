-- ----------------------------------------------------------------------------
-- Phase 11a — Sites admin
--
-- Lifts the dormant `site:configure` permission key (declared in init.sql:120
-- since Phase 0 but never granted to any default role) and pairs it with a
-- new `site:archive` key. Together they unlock the org-admin sites surface:
--   - `site:configure` granted to site_admin + ehs_manager (rename, address,
--     timezone, OSHA establishment ID, NAICS, parent re-parent).
--   - `site:archive` granted to site_admin only (archive/unarchive).
--
-- Sites use `archived_at` instead of `deleted_at` because the locked rule
-- restricts soft-delete to incidents/investigations/capas. Same UX, different
-- column — referential integrity of historical FK chains stays intact.
--
-- Schema additions:
--   - sites.archived_at, sites.archived_by, sites.archive_reason
--   - permissions row for `site:archive`
--   - role_permissions grants
--   - sites_update RLS policy for `site:configure` writes
--
-- Atomic RPCs (security-definer):
--   - update_site_v1: rename + edit any non-country metadata. Cycle-checks
--     parent re-parents. Rejects cross-org parents. Rejects re-parenting to
--     an archived parent. Logs `site.updated` to activity_events.
--   - archive_site_v1: rejects when the site has any non-archived child
--     (must archive children first). Logs `site.archived`.
--   - unarchive_site_v1: rejects when the site's parent is itself archived.
--     Logs `site.unarchived`.
--
-- Country is intentionally NOT in update_site_v1's signature: changing a
-- site's country mutates the regulatory engine end-to-end (OSHA vs RIDDOR
-- routing). Logged in SPEC §15 as v2.
-- ----------------------------------------------------------------------------

-- 1. Schema additions ---------------------------------------------------------

alter table sites add column if not exists archived_at  timestamptz;
alter table sites add column if not exists archived_by  uuid references profiles(id) on delete set null;
alter table sites add column if not exists archive_reason text;

create index if not exists sites_archived_at_idx on sites(archived_at)
  where archived_at is not null;

-- 2. Permission key + grants --------------------------------------------------

insert into permissions (key, description) values
  ('site:archive', 'Archive a site (and unarchive it)')
on conflict (key) do nothing;

-- Grant site:configure to site_admin + ehs_manager; site:archive to site_admin
-- across all orgs (one role row per org). Idempotent on (role_id, permission_key).
do $$
declare
  v_role record;
begin
  for v_role in select id, key from roles where key in ('site_admin', 'ehs_manager') loop
    insert into role_permissions (role_id, permission_key) values
      (v_role.id, 'site:configure')
    on conflict (role_id, permission_key) do nothing;

    if v_role.key = 'site_admin' then
      insert into role_permissions (role_id, permission_key) values
        (v_role.id, 'site:archive')
      on conflict (role_id, permission_key) do nothing;
    end if;
  end loop;
end $$;

-- 3. RLS — sites_update -------------------------------------------------------
-- The existing sites_read policy (init.sql:651) stays. Add an UPDATE policy
-- so the RPCs below (which run as security-definer but still validate via
-- has_permission) compose with future direct-update flows. Today only the
-- RPCs write to sites, but the policy makes the intent explicit.

drop policy if exists sites_update on sites;
create policy sites_update on sites for update to authenticated
  using (org_id = current_org() and has_permission('site:configure', id))
  with check (org_id = current_org() and has_permission('site:configure', id));

-- 4. RPC — update_site_v1 -----------------------------------------------------

create or replace function update_site_v1(
  p_site_id                uuid,
  p_name                   text default null,
  p_address                text default null,
  p_region                 text default null,
  p_timezone               text default null,
  p_osha_establishment_id  text default null,
  p_naics_code             text default null,
  p_parent_site_id         uuid default null,
  p_clear_parent           boolean default false
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id     uuid := auth.uid();
  v_org_id      uuid;
  v_site        record;
  v_old_payload jsonb;
  v_new_payload jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('site:configure', p_site_id) then
    raise exception 'You do not have permission to edit this site'
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
    raise exception 'Cannot edit an archived site — unarchive first'
      using errcode = '23514';
  end if;

  if p_name is not null and length(trim(p_name)) = 0 then
    raise exception 'Site name cannot be empty' using errcode = '23514';
  end if;

  -- Parent re-parent validation: cycle check + cross-org + non-archived parent.
  if p_clear_parent then
    -- caller wants to remove the parent
    null;
  elsif p_parent_site_id is not null then
    if p_parent_site_id = p_site_id then
      raise exception 'A site cannot be its own parent' using errcode = '23514';
    end if;

    declare
      v_parent record;
    begin
      select * into v_parent from sites where id = p_parent_site_id;
      if v_parent is null then
        raise exception 'Parent site not found' using errcode = '23503';
      end if;
      if v_parent.org_id <> v_org_id then
        raise exception 'Parent site is in a different org' using errcode = '42501';
      end if;
      if v_parent.archived_at is not null then
        raise exception 'Cannot re-parent under an archived site'
          using errcode = '23514';
      end if;
    end;

    -- Cycle check: walk the proposed parent's ancestor chain. If we hit
    -- p_site_id, the new parent is a descendant of this site → cycle.
    if exists (
      with recursive ancestors as (
        select id, parent_site_id from sites where id = p_parent_site_id
        union all
        select s.id, s.parent_site_id
          from sites s
          join ancestors a on s.id = a.parent_site_id
      )
      select 1 from ancestors where id = p_site_id
    ) then
      raise exception 'Re-parenting would create a cycle' using errcode = '23514';
    end if;
  end if;

  v_old_payload := jsonb_build_object(
    'name', v_site.name,
    'address', v_site.address,
    'region', v_site.region,
    'timezone', v_site.timezone,
    'osha_establishment_id', v_site.osha_establishment_id,
    'naics_code', v_site.naics_code,
    'parent_site_id', v_site.parent_site_id
  );

  update sites set
    name                   = coalesce(nullif(trim(p_name), ''), name),
    address                = case when p_address is not null
                                  then nullif(trim(p_address), '')
                                  else address end,
    region                 = case when p_region is not null
                                  then nullif(trim(p_region), '')
                                  else region end,
    timezone               = coalesce(nullif(trim(p_timezone), ''), timezone),
    osha_establishment_id  = case when p_osha_establishment_id is not null
                                  then nullif(trim(p_osha_establishment_id), '')
                                  else osha_establishment_id end,
    naics_code             = case when p_naics_code is not null
                                  then nullif(trim(p_naics_code), '')
                                  else naics_code end,
    parent_site_id         = case
                                when p_clear_parent then null
                                when p_parent_site_id is not null then p_parent_site_id
                                else parent_site_id end,
    updated_at             = now()
  where id = p_site_id;

  select jsonb_build_object(
    'name', name,
    'address', address,
    'region', region,
    'timezone', timezone,
    'osha_establishment_id', osha_establishment_id,
    'naics_code', naics_code,
    'parent_site_id', parent_site_id
  ) into v_new_payload from sites where id = p_site_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'site.updated',
          jsonb_build_object('site_id', p_site_id, 'before', v_old_payload, 'after', v_new_payload));
end;
$$;

grant execute on function update_site_v1(uuid, text, text, text, text, text, text, uuid, boolean)
  to authenticated;

comment on function update_site_v1(uuid, text, text, text, text, text, text, uuid, boolean) is
  'Edits site metadata. Country is immutable. Validates parent re-parents (cycle, cross-org, non-archived). Gates on site:configure.';

-- 5. RPC — archive_site_v1 ----------------------------------------------------

create or replace function archive_site_v1(
  p_site_id  uuid,
  p_reason   text default null
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id  uuid := auth.uid();
  v_org_id   uuid;
  v_site     record;
  v_children text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('site:archive', p_site_id) then
    raise exception 'You do not have permission to archive this site'
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
    raise exception 'Site is already archived' using errcode = '23514';
  end if;

  -- Reject when the site has any active (non-archived) child.
  select string_agg(name, ', ') into v_children
    from sites
   where parent_site_id = p_site_id and archived_at is null;
  if v_children is not null then
    raise exception 'Archive child sites first: %', v_children
      using errcode = '23514';
  end if;

  update sites set
    archived_at    = now(),
    archived_by    = v_user_id,
    archive_reason = nullif(trim(coalesce(p_reason, '')), ''),
    updated_at     = now()
  where id = p_site_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'site.archived',
          jsonb_build_object('site_id', p_site_id, 'reason', p_reason));
end;
$$;

grant execute on function archive_site_v1(uuid, text) to authenticated;

comment on function archive_site_v1(uuid, text) is
  'Archives a site (sets archived_at + archived_by + archive_reason). Rejects when active children exist. Gates on site:archive.';

-- 6. RPC — unarchive_site_v1 --------------------------------------------------

create or replace function unarchive_site_v1(
  p_site_id  uuid
) returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id  uuid := auth.uid();
  v_org_id   uuid;
  v_site     record;
  v_parent   record;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select org_id into v_org_id from profiles where id = v_user_id;
  if v_org_id is null then
    raise exception 'Profile not found' using errcode = '42501';
  end if;

  if not has_permission('site:archive', p_site_id) then
    raise exception 'You do not have permission to unarchive this site'
      using errcode = '42501';
  end if;

  select * into v_site from sites where id = p_site_id;
  if v_site is null then
    raise exception 'Site not found' using errcode = '23503';
  end if;
  if v_site.org_id <> v_org_id then
    raise exception 'Site is in a different org' using errcode = '42501';
  end if;
  if v_site.archived_at is null then
    raise exception 'Site is not archived' using errcode = '23514';
  end if;

  -- Reject when the parent is archived (would leave this site dangling under
  -- an archived ancestor).
  if v_site.parent_site_id is not null then
    select * into v_parent from sites where id = v_site.parent_site_id;
    if v_parent.archived_at is not null then
      raise exception 'Unarchive the parent site first (% is archived)', v_parent.name
        using errcode = '23514';
    end if;
  end if;

  update sites set
    archived_at    = null,
    archived_by    = null,
    archive_reason = null,
    updated_at     = now()
  where id = p_site_id;

  insert into activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values (null, null, null, v_user_id, 'site.unarchived',
          jsonb_build_object('site_id', p_site_id));
end;
$$;

grant execute on function unarchive_site_v1(uuid) to authenticated;

comment on function unarchive_site_v1(uuid) is
  'Unarchives a site. Rejects when the parent is archived. Gates on site:archive.';
