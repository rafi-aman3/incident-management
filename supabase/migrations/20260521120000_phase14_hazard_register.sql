-- ============================================================================
-- Phase 14 — Hazard Register (§HZ)
-- ============================================================================
-- ISO 45001 §6.1.2-aligned live inventory of workplace hazards. Five new
-- tables (live register + history-preserving assessments + hierarchy-of-
-- controls + candidate review queue + incident feedback loop) + five new
-- permission keys + a new notification_kind value + a backfill of grants on
-- existing orgs + a seed_default_roles() update so future orgs inherit the
-- new grants.
--
-- Plan: plans/14-hazard-register.md
-- SPEC: §HZ (data model), §HZ.7 (RLS), §HZ.8 (KPIs)
--
-- Three SPEC deltas land with this migration (all log to §15 decisions table
-- via the docs commit that follows):
--   1. hazard_controls.next_control_review_at — control-review cadence
--   2. Risk-owner auto-notification on incident_hazard_links insert
--      (notification_kind='hazard_incident_linked' added below; firing path
--      lives in lib/workflow/notifications.ts in the next commit)
--   3. SPEC §HZ.3 matrix orientation corrected to match the shipped incident
--      severity engine (S1=Critical/worst .. S5=Insignificant/best). The
--      `inherent_risk_score` / `residual_risk_score` columns therefore use
--      the existing `severity` enum rather than a parallel scale. Plan
--      kickoff Q&A confirmed this as the resolution (2026-05-11).
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Extend notification_kind
-- ----------------------------------------------------------------------------
alter type notification_kind add value if not exists 'hazard_incident_linked';


-- ----------------------------------------------------------------------------
-- 2. hazards — the live register
-- ----------------------------------------------------------------------------
create table hazards (
  id                            uuid primary key default gen_random_uuid(),
  ref_code                      text unique,
  org_id                        uuid not null references orgs(id) on delete cascade,
  site_id                       uuid not null references sites(id) on delete restrict,
  area                          text,

  title                         text not null,
  description                   text,
  hazard_category               text not null check (hazard_category in (
    'physical','chemical','biological','psychosocial',
    'mechanical','electrical','ergonomic','environmental'
  )),
  hazard_source                 text not null check (hazard_source in (
    'routine_activity','non_routine_activity','past_incident',
    'emergency_situation','contractor_activity','design',
    'change','external_input','inspection','worker_report',
    'jsa','sds_import'
  )),

  status                        text not null default 'identified' check (status in (
    'identified','under_assessment','controlled','monitoring','closed','superseded'
  )),

  affects_workers               text[] not null default '{}',
  affects_others                text[] not null default '{}',

  identified_by                 uuid references profiles(id) on delete set null,
  identified_at                 timestamptz not null default now(),
  identification_method         text,

  current_risk_assessment_id    uuid,                                            -- FK added below

  source_candidate_id           uuid,                                            -- FK added below
  source_jsa_id                 uuid,                                            -- FK in Phase 15
  source_incident_id            uuid references incidents(id) on delete set null,
  source_sds_id                 text,
  source_sds_section            text,

  superseded_by_hazard_id       uuid references hazards(id) on delete set null,
  closed_at                     timestamptz,
  closed_reason                 text,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create trigger hazards_updated before update on hazards
  for each row execute function set_updated_at();

create index hazards_site_status_idx on hazards (site_id, status)
  where deleted_at is null;
create index hazards_org_status_idx on hazards (org_id, status)
  where deleted_at is null;
create index hazards_category_idx on hazards (hazard_category)
  where deleted_at is null;
create index hazards_current_ra_idx on hazards (current_risk_assessment_id);


-- ----------------------------------------------------------------------------
-- 3. hazard_risk_assessments — history-preserving, periodic + event-driven
-- ----------------------------------------------------------------------------
create table hazard_risk_assessments (
  id                            uuid primary key default gen_random_uuid(),
  hazard_id                     uuid not null references hazards(id) on delete cascade,

  likelihood                    text not null check (likelihood in (
    'rare','unlikely','possible','likely','almost_certain'
  )),
  consequence                   text not null check (consequence in (
    'insignificant','minor','moderate','major','catastrophic'
  )),
  inherent_risk_score           severity not null,
  residual_risk_score           severity not null,

  trigger_type                  text not null check (trigger_type in (
    'initial','periodic_review','post_incident','management_of_change',
    'regulatory_change','worker_consultation','audit_finding','sds_revision'
  )),
  triggered_by_incident_id      uuid references incidents(id) on delete set null,

  rationale                     text,
  assessor_id                   uuid not null references profiles(id) on delete restrict,
  consulted_worker_ids          uuid[] not null default '{}',

  next_review_at                date,
  assessed_at                   timestamptz not null default now(),
  superseded_at                 timestamptz,
  created_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create index hazard_ra_hazard_assessed_idx
  on hazard_risk_assessments (hazard_id, assessed_at desc);
create index hazard_ra_next_review_idx
  on hazard_risk_assessments (next_review_at)
  where deleted_at is null and next_review_at is not null;

alter table hazards
  add constraint hazards_current_ra_fk
  foreign key (current_risk_assessment_id) references hazard_risk_assessments(id)
  on delete set null;


-- ----------------------------------------------------------------------------
-- 4. hazard_controls — hierarchy of controls (+ next_control_review_at delta)
-- ----------------------------------------------------------------------------
create table hazard_controls (
  id                            uuid primary key default gen_random_uuid(),
  hazard_id                     uuid not null references hazards(id) on delete cascade,

  control_level                 text not null check (control_level in (
    'elimination','substitution','engineering','administrative','ppe'
  )),
  control_description           text not null,

  effectiveness                 text not null default 'not_yet_verified'
                                check (effectiveness in (
                                  'effective','partially_effective',
                                  'not_yet_verified','ineffective'
                                )),

  responsible_party_id          uuid references profiles(id) on delete set null,
  implemented_at                timestamptz,
  last_verified_at              timestamptz,
  next_verification_at          date,
  next_control_review_at        date,                                            -- SPEC delta

  origin                        text not null default 'from_initial_assessment'
                                check (origin in (
                                  'pre_existing','from_initial_assessment',
                                  'from_capa','from_management_of_change',
                                  'from_jsa','from_sds_section'
                                )),
  origin_capa_id                uuid references capas(id) on delete set null,
  origin_jsa_id                 uuid,                                            -- FK in Phase 15

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz
);
create trigger hazard_controls_updated before update on hazard_controls
  for each row execute function set_updated_at();

create index hazard_controls_hazard_idx on hazard_controls (hazard_id)
  where deleted_at is null;
create index hazard_controls_next_review_idx on hazard_controls (next_control_review_at)
  where deleted_at is null and next_control_review_at is not null;


-- ----------------------------------------------------------------------------
-- 5. hazard_candidates — single review queue, 8 inbound sources
-- ----------------------------------------------------------------------------
create table hazard_candidates (
  id                            uuid primary key default gen_random_uuid(),
  org_id                        uuid not null references orgs(id) on delete cascade,
  source_type                   text not null check (source_type in (
    'sds_import','worker_report','inspection','incident_review',
    'management_of_change','audit_finding','external_advisory','jsa'
  )),
  source_reference_id           text,

  site_id                       uuid references sites(id) on delete cascade,
  area                          text,

  proposed_title                text not null,
  proposed_category             text not null check (proposed_category in (
    'physical','chemical','biological','psychosocial',
    'mechanical','electrical','ergonomic','environmental'
  )),
  proposed_description          text,
  proposed_metadata             jsonb not null default '{}'::jsonb,

  status                        text not null default 'pending_review' check (status in (
    'pending_review','converted','dismissed','merged'
  )),

  proposed_by                   uuid references profiles(id) on delete set null,
  reviewed_by                   uuid references profiles(id) on delete set null,
  reviewed_at                   timestamptz,
  conversion_hazard_id          uuid references hazards(id) on delete set null,
  merged_into_hazard_id         uuid references hazards(id) on delete set null,
  dismiss_reason                text,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
create trigger hazard_candidates_updated before update on hazard_candidates
  for each row execute function set_updated_at();

create index hazard_candidates_pending_idx on hazard_candidates (org_id, created_at desc)
  where status = 'pending_review';
create index hazard_candidates_site_status_idx on hazard_candidates (site_id, status);
create index hazard_candidates_source_type_idx on hazard_candidates (org_id, source_type, status);

alter table hazards
  add constraint hazards_source_candidate_fk
  foreign key (source_candidate_id) references hazard_candidates(id)
  on delete set null;


-- ----------------------------------------------------------------------------
-- 6. incident_hazard_links — closes the feedback loop
-- ----------------------------------------------------------------------------
create table incident_hazard_links (
  id                            uuid primary key default gen_random_uuid(),
  incident_id                   uuid not null references incidents(id) on delete cascade,
  hazard_id                     uuid not null references hazards(id) on delete cascade,

  was_in_register_at_time       boolean not null,
  link_type                     text not null check (link_type in (
    'causal','contributing','exposed_but_not_causal'
  )),
  triggered_reassessment        boolean not null default false,

  identified_at                 timestamptz not null default now(),
  identified_by                 uuid not null references profiles(id) on delete restrict,
  notes                         text,
  created_at                    timestamptz not null default now(),

  unique (incident_id, hazard_id)
);
create index incident_hazard_links_incident_idx on incident_hazard_links (incident_id);
create index incident_hazard_links_hazard_idx on incident_hazard_links (hazard_id);


-- ----------------------------------------------------------------------------
-- 7. Ref-code generator for hazards (HAZ-<SITE>-<YEAR>-NNNN)
-- ----------------------------------------------------------------------------
create or replace function generate_hazard_ref_code(p_site_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_site_code text;
  v_year      int := extract(year from now())::int;
  v_seq       int;
  v_prefix    text;
begin
  select coalesce(short_code, upper(substring(name from 1 for 3))) into v_site_code
    from sites where id = p_site_id;
  if v_site_code is null then
    v_site_code := 'XXX';
  end if;
  v_site_code := upper(v_site_code);
  v_prefix    := 'HAZ-' || v_site_code || '-' || v_year::text || '-';
  select coalesce(max((regexp_match(ref_code, '-(\d+)$'))[1]::int), 0) + 1
    into v_seq
    from hazards
   where ref_code like v_prefix || '%';
  return v_prefix || lpad(v_seq::text, 4, '0');
end $$;

create or replace function set_hazard_ref_code() returns trigger
  language plpgsql as $$
begin
  if new.ref_code is null or new.ref_code = '' then
    new.ref_code := generate_hazard_ref_code(new.site_id);
  end if;
  return new;
end $$;

create trigger hazards_ref_code before insert on hazards
  for each row execute function set_hazard_ref_code();


-- ----------------------------------------------------------------------------
-- 8. New permission keys
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('hazard:read_site',        'Read hazards at sites you belong to'),
  ('hazard:report',           'Report a new hazard or candidate at your site'),
  ('hazard:manage',           'Manage assessments and controls on hazards'),
  ('hazard:close',            'Close or supersede a hazard'),
  ('hazard_candidate:review', 'Review the candidate queue (convert / dismiss / merge)')
on conflict (key) do nothing;


-- ----------------------------------------------------------------------------
-- 9. Row-Level Security
-- ----------------------------------------------------------------------------
alter table hazards                  enable row level security;
alter table hazard_risk_assessments  enable row level security;
alter table hazard_controls          enable row level security;
alter table hazard_candidates        enable row level security;
alter table incident_hazard_links    enable row level security;

-- hazards: read site-scoped + own (identifier); write requires hazard:report;
-- update requires hazard:manage; close (status flip) handled at app layer.
create policy hazards_read on hazards for select to authenticated
  using (
    org_id = current_org()
    and deleted_at is null
    and user_can_access_site(site_id)
  );
create policy hazards_insert on hazards for insert to authenticated
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
    and has_permission('hazard:report', site_id)
  );
create policy hazards_update on hazards for update to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
    and has_permission('hazard:manage', site_id)
  )
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
  );

-- hazard_risk_assessments: read + write via parent hazard's site
create policy hazard_ra_read on hazard_risk_assessments for select to authenticated
  using (exists (
    select 1 from hazards h
     where h.id = hazard_risk_assessments.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
  ));
create policy hazard_ra_insert on hazard_risk_assessments for insert to authenticated
  with check (exists (
    select 1 from hazards h
     where h.id = hazard_risk_assessments.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
       and has_permission('hazard:manage', h.site_id)
  ));
create policy hazard_ra_update on hazard_risk_assessments for update to authenticated
  using (exists (
    select 1 from hazards h
     where h.id = hazard_risk_assessments.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
       and has_permission('hazard:manage', h.site_id)
  ));

-- hazard_controls: same pattern as RAs
create policy hazard_controls_read on hazard_controls for select to authenticated
  using (exists (
    select 1 from hazards h
     where h.id = hazard_controls.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
  ));
create policy hazard_controls_insert on hazard_controls for insert to authenticated
  with check (exists (
    select 1 from hazards h
     where h.id = hazard_controls.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
       and has_permission('hazard:manage', h.site_id)
  ));
create policy hazard_controls_update on hazard_controls for update to authenticated
  using (exists (
    select 1 from hazards h
     where h.id = hazard_controls.hazard_id
       and h.org_id = current_org()
       and user_can_access_site(h.site_id)
       and has_permission('hazard:manage', h.site_id)
  ));

-- hazard_candidates: read site-scoped; insert hazard:report; update review.
-- site_id may be null on candidates created without a site (rare; e.g. some
-- SDS imports). Null-site candidates require hazard_candidate:review on the
-- caller's any-site to read — enforced at the app layer.
create policy hazard_candidates_read on hazard_candidates for select to authenticated
  using (
    org_id = current_org()
    and (
      site_id is null
      or user_can_access_site(site_id)
    )
  );
create policy hazard_candidates_insert on hazard_candidates for insert to authenticated
  with check (
    org_id = current_org()
    and (
      site_id is null
      or (
        user_can_access_site(site_id)
        and has_permission('hazard:report', site_id)
      )
    )
  );
create policy hazard_candidates_update on hazard_candidates for update to authenticated
  using (
    org_id = current_org()
    and (
      site_id is null
      or (
        user_can_access_site(site_id)
        and has_permission('hazard_candidate:review', site_id)
      )
    )
  );

-- incident_hazard_links: read via parent hazard; insert requires investigation
-- lead on the incident's site (handled in the server action), enforced here
-- as access to BOTH sides.
create policy incident_hazard_links_read on incident_hazard_links for select to authenticated
  using (
    exists (
      select 1 from incidents i
       where i.id = incident_hazard_links.incident_id
         and i.org_id = current_org()
         and user_can_access_site(i.site_id)
    )
    and exists (
      select 1 from hazards h
       where h.id = incident_hazard_links.hazard_id
         and h.org_id = current_org()
         and user_can_access_site(h.site_id)
    )
  );
create policy incident_hazard_links_insert on incident_hazard_links for insert to authenticated
  with check (
    exists (
      select 1 from incidents i
       where i.id = incident_hazard_links.incident_id
         and i.org_id = current_org()
         and user_can_access_site(i.site_id)
    )
    and exists (
      select 1 from hazards h
       where h.id = incident_hazard_links.hazard_id
         and h.org_id = current_org()
         and user_can_access_site(h.site_id)
         and has_permission('hazard:manage', h.site_id)
    )
    and identified_by = auth.uid()
  );


-- ----------------------------------------------------------------------------
-- 10. Backfill permission grants on existing orgs
-- ----------------------------------------------------------------------------
-- Worker: read_site only
insert into role_permissions (role_id, permission_key)
  select r.id, 'hazard:read_site'
    from roles r
   where r.is_default = true and r.key = 'worker'
on conflict do nothing;

-- Supervisor: read_site + report
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values ('hazard:read_site'), ('hazard:report')) as k(key)
   where r.is_default = true and r.key = 'supervisor'
on conflict do nothing;

-- EHS Manager: read_site + report + manage + candidate:review
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('hazard:read_site'),
      ('hazard:report'),
      ('hazard:manage'),
      ('hazard_candidate:review')
    ) as k(key)
   where r.is_default = true and r.key = 'ehs_manager'
on conflict do nothing;

-- Site Admin catch-all (re-runs harmlessly thanks to on conflict do nothing)
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true and r.key = 'site_admin'
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 11. Patch seed_default_roles() so future orgs inherit the new grants
-- ----------------------------------------------------------------------------
-- The function is rewritten in full because plpgsql doesn't support a clean
-- partial-update pattern. Mirrors the Phase 5 / 9a / 10 precedent.
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
    (v_role_id, 'planner:read'),
    (v_role_id, 'argus:use'),
    (v_role_id, 'hazard:read_site')
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
    (v_role_id, 'planner:read'),
    (v_role_id, 'argus:use'),
    (v_role_id, 'hazard:read_site'),
    (v_role_id, 'hazard:report')
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
    (v_role_id, 'planner:read'),
    (v_role_id, 'bulletin:create'),
    (v_role_id, 'bulletin:publish'),
    (v_role_id, 'argus:use'),
    (v_role_id, 'hazard:read_site'),
    (v_role_id, 'hazard:report'),
    (v_role_id, 'hazard:manage'),
    (v_role_id, 'hazard_candidate:review')
  on conflict do nothing;

  -- site_admin (catch-all picks up every existing permission key)
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;
