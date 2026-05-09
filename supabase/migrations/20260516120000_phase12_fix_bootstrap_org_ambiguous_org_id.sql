-- Phase 12 fix — bootstrap_org_v1 ambiguous "org_id" reference
--
-- The previous definition declared `returns table (org_id uuid, site_id uuid)`.
-- Inside the function body, `org_id` is therefore visible as an OUT parameter
-- and shadows the `roles.org_id` column in the unqualified comparison
-- `where org_id = v_org_id`. Postgres reports:
--
--   column reference "org_id" is ambiguous
--
-- Fix: qualify the column reference (`roles.org_id`). No other behaviour change.

create or replace function bootstrap_org_v1(
  p_org_name  text,
  p_industry  industry_type,
  p_country   char(2),
  p_site_name text,
  p_timezone  text
) returns table (org_id uuid, site_id uuid)
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_user_id        uuid := auth.uid();
  v_user_email     text;
  v_user_full_name text;
  v_org_id         uuid;
  v_site_id        uuid;
  v_admin_role_id  uuid;
  v_existing_org   text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select o.name into v_existing_org
    from public.profiles p
    join public.orgs o on o.id = p.org_id
   where p.id = v_user_id;

  if found then
    raise exception 'You already have an account in %', v_existing_org;
  end if;

  if length(trim(coalesce(p_org_name, ''))) = 0 then
    raise exception 'Organization name is required' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_site_name, ''))) = 0 then
    raise exception 'Site name is required' using errcode = '22023';
  end if;
  if p_country not in ('US', 'GB') then
    raise exception 'Country must be US or GB' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_timezone, ''))) = 0 then
    raise exception 'Timezone is required' using errcode = '22023';
  end if;

  select u.email,
         coalesce(u.raw_user_meta_data->>'full_name', u.email)
    into v_user_email, v_user_full_name
    from auth.users u
   where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'Could not load auth.user record';
  end if;

  insert into public.orgs (name, slug, industry)
  values (
    trim(p_org_name),
    lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g')) ||
      '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6),
    p_industry
  )
  returning id into v_org_id;

  perform public.seed_default_roles(v_org_id);

  select r.id into v_admin_role_id
    from public.roles r
   where r.org_id = v_org_id
     and r.key = 'site_admin'
     and r.is_default = true;

  if v_admin_role_id is null then
    raise exception 'seed_default_roles did not create a site_admin role';
  end if;

  insert into public.profiles (id, org_id, full_name, email)
  values (v_user_id, v_org_id, v_user_full_name, v_user_email);

  insert into public.sites (org_id, name, country, timezone)
  values (v_org_id, trim(p_site_name), p_country, trim(p_timezone))
  returning id into v_site_id;

  insert into public.site_members (site_id, profile_id, role_id, include_children)
  values (v_site_id, v_user_id, v_admin_role_id, true);

  insert into public.activity_events (incident_id, investigation_id, capa_id, actor_id, verb, payload)
  values
    (null, null, null, v_user_id, 'org.created',
      jsonb_build_object(
        'org_id', v_org_id,
        'name', trim(p_org_name),
        'industry', p_industry::text,
        'via', 'onboarding')),
    (null, null, null, v_user_id, 'site.created',
      jsonb_build_object(
        'org_id', v_org_id,
        'site_id', v_site_id,
        'name', trim(p_site_name),
        'country', p_country,
        'timezone', trim(p_timezone),
        'via', 'onboarding'));

  return query select v_org_id, v_site_id;
end $$;
