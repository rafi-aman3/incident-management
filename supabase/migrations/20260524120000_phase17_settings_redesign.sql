-- ============================================================================
-- Phase 17 — Settings redesign
-- ============================================================================
-- See plans/17-settings-redesign.md.
--
-- Lands:
--   1. orgs.logo_url                          — public Storage URL or null
--   2. profiles.sidebar_hidden_items text[]   — list of nav hrefs to hide
--   3. profiles.argus_panel_default boolean   — per-user panel-open default
--   4. user_notification_silences table       — (profile, kind) silencing set
--   5. permission key 'org:configure'         — granted to site_admin via the
--      catch-all in seed_default_roles(); existing rows backfilled below
--   6. RESTRICT → SET NULL on 7 FKs to profiles(id)  (for GDPR account-delete)
--   7. count_org_configure_holders(p_org_id)  — last-admin guard RPC
--   8. org_delete_summary(p_org_id)           — counts surfaced in confirm UI
--   9. Storage bucket 'org-logos' (public) + per-org-path RLS write gates
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. orgs.logo_url
-- ----------------------------------------------------------------------------
alter table public.orgs
  add column logo_url text;


-- ----------------------------------------------------------------------------
-- 2 + 3. profiles new columns
-- ----------------------------------------------------------------------------
alter table public.profiles
  add column sidebar_hidden_items text[] not null default '{}',
  add column argus_panel_default  boolean not null default true;


-- ----------------------------------------------------------------------------
-- 4. user_notification_silences
-- ----------------------------------------------------------------------------
create table public.user_notification_silences (
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  notification_kind notification_kind not null,
  created_at        timestamptz not null default now(),
  primary key (profile_id, notification_kind)
);

alter table public.user_notification_silences enable row level security;

create policy user_notification_silences_select_self
  on public.user_notification_silences for select
  using (auth.uid() = profile_id);

create policy user_notification_silences_insert_self
  on public.user_notification_silences for insert
  with check (auth.uid() = profile_id);

create policy user_notification_silences_delete_self
  on public.user_notification_silences for delete
  using (auth.uid() = profile_id);


-- ----------------------------------------------------------------------------
-- 5. permission key 'org:configure'
-- ----------------------------------------------------------------------------
-- Catalog row (system permission registry).
insert into public.permissions (key, description) values
  ('org:configure', 'Edit organisation identity (name, industry, logo)')
on conflict (key) do nothing;

-- Backfill: every existing site_admin default role gets it.
insert into public.role_permissions (role_id, permission_key)
  select r.id, 'org:configure'
    from public.roles r
   where r.is_default = true
     and r.key = 'site_admin'
on conflict do nothing;

-- (No seed_default_roles() patch needed — its site_admin branch grants every
-- key from the `permissions` table, so future orgs inherit org:configure
-- automatically once the catalog row is inserted above.)


-- ----------------------------------------------------------------------------
-- 6. RESTRICT → SET NULL on 7 FKs to profiles(id)
-- ----------------------------------------------------------------------------
-- Required so hard-delete of a profile (Self-service account deletion) does
-- not trip a constraint violation. The "every CAPA has an owner" invariant
-- moves from the FK to the create-CAPA action; UI renders 'Removed user'
-- for null actors.

-- 6a. capas.owner_id
alter table public.capas
  alter column owner_id drop not null;
alter table public.capas
  drop constraint capas_owner_id_fkey,
  add constraint capas_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete set null;

-- 6b. severity_overrides.overridden_by  (audit table — keep the row even if actor gone)
alter table public.severity_overrides
  alter column overridden_by drop not null;
alter table public.severity_overrides
  drop constraint severity_overrides_overridden_by_fkey,
  add constraint severity_overrides_overridden_by_fkey
    foreign key (overridden_by) references public.profiles(id) on delete set null;

-- 6c. hazard_risk_assessments.assessor_id  (Phase 14)
alter table public.hazard_risk_assessments
  alter column assessor_id drop not null;
alter table public.hazard_risk_assessments
  drop constraint hazard_risk_assessments_assessor_id_fkey,
  add constraint hazard_risk_assessments_assessor_id_fkey
    foreign key (assessor_id) references public.profiles(id) on delete set null;

-- 6d. incident_hazard_links.identified_by  (Phase 14)
alter table public.incident_hazard_links
  alter column identified_by drop not null;
alter table public.incident_hazard_links
  drop constraint incident_hazard_links_identified_by_fkey,
  add constraint incident_hazard_links_identified_by_fkey
    foreign key (identified_by) references public.profiles(id) on delete set null;

-- 6e. jsas.created_by  (Phase 15)
alter table public.jsas
  alter column created_by drop not null;
alter table public.jsas
  drop constraint jsas_created_by_fkey,
  add constraint jsas_created_by_fkey
    foreign key (created_by) references public.profiles(id) on delete set null;

-- 6f. jsa_signoffs.worker_id  (Phase 15)
alter table public.jsa_signoffs
  alter column worker_id drop not null;
alter table public.jsa_signoffs
  drop constraint jsa_signoffs_worker_id_fkey,
  add constraint jsa_signoffs_worker_id_fkey
    foreign key (worker_id) references public.profiles(id) on delete set null;

-- 6g. jsa_incident_links.identified_by  (Phase 15)
alter table public.jsa_incident_links
  alter column identified_by drop not null;
alter table public.jsa_incident_links
  drop constraint jsa_incident_links_identified_by_fkey,
  add constraint jsa_incident_links_identified_by_fkey
    foreign key (identified_by) references public.profiles(id) on delete set null;


-- ----------------------------------------------------------------------------
-- 7. count_org_configure_holders — last-admin guard for account delete
-- ----------------------------------------------------------------------------
create or replace function public.count_org_configure_holders(p_org_id uuid)
returns integer
language sql stable security definer set search_path = public as $$
  -- Mirror resolve_org_permissions: a holder is any profile that gets the
  -- key either via a role (site_members → role_permissions) or via a team
  -- (team_members → team_permissions). DISTINCT collapses dual-route holders.
  select count(distinct holders.id)::integer
    from (
      select p.id
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.org_id = p_org_id
         and rp.permission_key = 'org:configure'
      union
      select p.id
        from public.profiles p
        join public.team_members tm on tm.profile_id = p.id
        join public.team_permissions tp on tp.team_id = tm.team_id
       where p.org_id = p_org_id
         and tp.permission_key = 'org:configure'
    ) holders;
$$;

grant execute on function public.count_org_configure_holders(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 8. org_delete_summary — counts shown above the confirm gate
-- ----------------------------------------------------------------------------
create or replace function public.org_delete_summary(p_org_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members',   (select count(*)::int from public.profiles  where org_id = p_org_id),
    'sites',     (select count(*)::int from public.sites     where org_id = p_org_id),
    'incidents', (select count(*)::int from public.incidents where org_id = p_org_id and deleted_at is null),
    'name',      (select name from public.orgs where id = p_org_id)
  );
$$;

grant execute on function public.org_delete_summary(uuid) to authenticated;


-- ----------------------------------------------------------------------------
-- 9. Storage bucket 'org-logos' + RLS
-- ----------------------------------------------------------------------------
-- Public bucket: logos are routinely surfaced on PDFs, the login page of
-- white-labeled views, etc. Per-org path prefix (`{org_id}/...`) gates writes.
insert into storage.buckets (id, name, public)
  values ('org-logos', 'org-logos', true)
  on conflict (id) do nothing;

create policy org_logos_read_public
  on storage.objects for select
  using (bucket_id = 'org-logos');

create policy org_logos_insert_via_org_configure
  on storage.objects for insert
  with check (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

create policy org_logos_update_via_org_configure
  on storage.objects for update
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

create policy org_logos_delete_via_org_configure
  on storage.objects for delete
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

commit;
