-- ============================================================================
-- Phase 12 — Auth & Onboarding
-- ============================================================================
-- Adds the onboarding-completion column on profiles + a SECURITY DEFINER
-- bootstrap RPC that atomically creates org + profile + first site +
-- first membership for a brand-new signup. Pre-12 the only path to a
-- profile row was `pnpm db:seed`; this RPC is what /register → /verify-otp
-- → /onboarding now uses to mint a real workspace.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. profiles.onboarded_at — NULL = mid-onboarding (or skipped Step 3 invites);
-- timestamp = onboarding finished. Existing rows backfilled to now() so the
-- 4 seeded demo accounts (worker / supervisor / ehs / admin) skip the gate.
-- ----------------------------------------------------------------------------

alter table profiles add column onboarded_at timestamptz;
update profiles set onboarded_at = now() where onboarded_at is null;

-- ----------------------------------------------------------------------------
-- 2. Parity insert policy. The bootstrap RPC bypasses RLS via SECURITY
-- DEFINER, so this policy isn't load-bearing for the happy path — it's
-- defense-in-depth for any future code path that inserts a profile row
-- directly under the user's session.
-- ----------------------------------------------------------------------------

create policy profiles_self_insert on profiles for insert to authenticated
  with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- 3. bootstrap_org_v1 — atomic create of org + profile + first site + first
-- membership + default role seeding. SECURITY DEFINER so a brand-new user
-- (no profile row yet) can create the row their own session would normally
-- need RLS-wise to read first.
--
-- Pre-conditions:
--   - auth.uid() must exist (i.e., user is signed in via /verify-otp)
--   - no profile row may exist for this user (otherwise raises with the
--     existing org's name so the UI can show a useful error)
--
-- Post-conditions:
--   - orgs row created with derived slug (lower(name) + 6-char random suffix)
--   - profiles row created (id = auth.uid(), org_id = new org)
--   - sites row created as the first site
--   - site_members row created (caller as site_admin + include_children=true)
--   - 4 default roles seeded via seed_default_roles()
--   - profiles.onboarded_at stays NULL until finishOnboarding flips it —
--     that's how we detect tab-crash-mid-onboarding (org+site+profile exist
--     but Step 3 wasn't reached)
-- ----------------------------------------------------------------------------

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
  -- 1. Auth check
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- 2. Reject if a profile already exists for this user
  select o.name into v_existing_org
    from public.profiles p
    join public.orgs o on o.id = p.org_id
   where p.id = v_user_id;

  if found then
    raise exception 'You already have an account in %', v_existing_org;
  end if;

  -- 3. Validate inputs
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

  -- 4. Read auth.users for email + raw_user_meta_data.full_name
  select u.email,
         coalesce(u.raw_user_meta_data->>'full_name', u.email)
    into v_user_email, v_user_full_name
    from auth.users u
   where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'Could not load auth.user record';
  end if;

  -- 5. Create the org with auto-derived slug + random 6-char suffix
  insert into public.orgs (name, slug, industry)
  values (
    trim(p_org_name),
    lower(regexp_replace(trim(p_org_name), '[^a-zA-Z0-9]+', '-', 'g')) ||
      '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 6),
    p_industry
  )
  returning id into v_org_id;

  -- 6. Seed the 4 default roles + their permission grants
  perform public.seed_default_roles(v_org_id);

  -- 7. Look up the new org's site_admin role id for the membership row
  select id into v_admin_role_id
    from public.roles
   where org_id = v_org_id
     and key = 'site_admin'
     and is_default = true;

  if v_admin_role_id is null then
    raise exception 'seed_default_roles did not create a site_admin role';
  end if;

  -- 8. Create the profile row (this is what RLS would normally block)
  insert into public.profiles (id, org_id, full_name, email)
  values (v_user_id, v_org_id, v_user_full_name, v_user_email);

  -- 9. Create the first site
  insert into public.sites (org_id, name, country, timezone)
  values (v_org_id, trim(p_site_name), p_country, trim(p_timezone))
  returning id into v_site_id;

  -- 10. Make the caller a site_admin on the new site, with include_children=true
  insert into public.site_members (site_id, profile_id, role_id, include_children)
  values (v_site_id, v_user_id, v_admin_role_id, true);

  -- 11. Log activity (org + site creation events). Mirrors the 11a/6a pattern:
  -- entity FKs left null since activity_events has no org_id / site_id columns
  -- in v1 — identity goes in the payload jsonb.
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

grant execute on function public.bootstrap_org_v1(text, industry_type, char(2), text, text)
  to authenticated;

comment on function public.bootstrap_org_v1(text, industry_type, char(2), text, text) is
  'Phase 12 onboarding RPC. Atomically creates org + profile + first site + first membership for a freshly-verified signup. Caller becomes site_admin with include_children=true. Pre-condition: caller has no existing profile row.';
