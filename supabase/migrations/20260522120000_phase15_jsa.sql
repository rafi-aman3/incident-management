-- ============================================================================
-- Phase 15 — Job Safety Analysis (§JSA)
-- ============================================================================
-- OSHA 3071 + HSE INDG163-aligned task-level safe-work analysis. Six new
-- tables (jsas / jsa_steps / jsa_step_hazards / jsa_step_controls /
-- jsa_signoffs + the cross-link jsa_incident_links) + five new permission
-- keys + a new notification_kind value + extensions to the polymorphic
-- document_link_parent enum so photo evidence can attach per step /
-- step-hazard + a backfill of grants on existing orgs + a seed_default_roles
-- patch so future orgs inherit the new grants.
--
-- Plan: plans/15-jsa.md
-- SPEC: §JSA (data model), §JSA.7 (RLS), §JSA.9 (decisions log)
--
-- Three SPEC deltas land alongside this migration (the SPEC commit follows):
--   1. jsa_incident_links — incident → JSA backlink with causal auto-flip
--      (mirrors §HZ's incident_hazard_links pattern).
--   2. expires_at is a policy default of approved_at + 12 months, overridable
--      per-JSA at approval time. Neither OSHA 3071 nor HSE INDG163 mandates
--      a fixed cadence — both require event-triggered review.
--   3. permits_required text[] is descriptive metadata only — explicit non-
--      goal that this is NOT a permit-issuance workflow.
--
-- Phase 14's hazards.source_jsa_id and hazard_controls.origin_jsa_id columns
-- existed as bare uuids awaiting this migration; FKs are added here.
-- ============================================================================


-- ----------------------------------------------------------------------------
-- 1. Enum extensions
-- ----------------------------------------------------------------------------
alter type notification_kind add value if not exists 'jsa_review_required';
alter type document_link_parent add value if not exists 'jsa_step';
alter type document_link_parent add value if not exists 'jsa_step_hazard';


-- ----------------------------------------------------------------------------
-- 2. activity_events.jsa_id — let JSA actions author activity rows
-- ----------------------------------------------------------------------------
alter table activity_events
  add column if not exists jsa_id uuid;
create index if not exists activity_jsa_idx
  on activity_events(jsa_id) where jsa_id is not null;


-- ----------------------------------------------------------------------------
-- 3. jsas — the JSA record, 5-state lifecycle, approver != creator
-- ----------------------------------------------------------------------------
create table jsas (
  id                            uuid primary key default gen_random_uuid(),
  ref_code                      text unique,
  org_id                        uuid not null references orgs(id) on delete cascade,
  site_id                       uuid not null references sites(id) on delete restrict,

  title                         text not null,
  job_description               text,
  area                          text,

  performed_by_roles            text[] not null default '{}',
  performed_by_workgroups       text[] not null default '{}',

  frequency                     text check (frequency in (
    'daily','weekly','monthly','as_needed','one_off','continuous'
  )),
  estimated_duration_minutes    integer check (estimated_duration_minutes is null or estimated_duration_minutes > 0),

  ppe_required                  text[] not null default '{}',
  -- Descriptive metadata only — see SPEC §JSA.4 non-goal note. Not a permit-
  -- issuance workflow.
  permits_required              text[] not null default '{}',

  status                        text not null default 'draft' check (status in (
    'draft','under_review','approved','expired','archived'
  )),

  approved_by                   uuid references profiles(id) on delete set null,
  approved_at                   timestamptz,
  -- Policy default of approved_at + 12 months, set at approval time and
  -- overridable. Neither OSHA 3071 nor HSE INDG163 mandates a cadence.
  expires_at                    date,

  created_by                    uuid not null references profiles(id) on delete restrict,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  deleted_at                    timestamptz,

  -- Three-layer "approver != creator" enforcement, layer 1.
  constraint jsas_approver_differs_from_creator
    check (approved_by is null or approved_by <> created_by)
);
create trigger jsas_updated before update on jsas
  for each row execute function set_updated_at();

create index jsas_site_status_idx on jsas (site_id, status)
  where deleted_at is null;
create index jsas_org_status_idx on jsas (org_id, status)
  where deleted_at is null;
create index jsas_expires_idx on jsas (expires_at)
  where status = 'approved' and deleted_at is null;


-- ----------------------------------------------------------------------------
-- 4. Wire Phase 14's deferred JSA FKs now that jsas exists
-- ----------------------------------------------------------------------------
alter table hazards
  add constraint hazards_source_jsa_fk
  foreign key (source_jsa_id) references jsas(id) on delete set null;

alter table hazard_controls
  add constraint hazard_controls_origin_jsa_fk
  foreign key (origin_jsa_id) references jsas(id) on delete set null;


-- ----------------------------------------------------------------------------
-- 5. jsa_steps — ordered task breakdown, drag-reorderable via @dnd-kit
-- ----------------------------------------------------------------------------
create table jsa_steps (
  id                            uuid primary key default gen_random_uuid(),
  jsa_id                        uuid not null references jsas(id) on delete cascade,
  sequence                      integer not null check (sequence > 0),
  step_description              text not null,
  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now(),
  unique (jsa_id, sequence)
);
create trigger jsa_steps_updated before update on jsa_steps
  for each row execute function set_updated_at();
create index jsa_steps_jsa_idx on jsa_steps (jsa_id, sequence);


-- ----------------------------------------------------------------------------
-- 6. jsa_step_hazards — per-step hazards scored on the shared 5×5 matrix
--    Uses the same severity enum as incidents (S1=Critical … S5=Insignificant)
--    so a single computeRisk()/computeResidual() drives all surfaces.
-- ----------------------------------------------------------------------------
create table jsa_step_hazards (
  id                            uuid primary key default gen_random_uuid(),
  jsa_step_id                   uuid not null references jsa_steps(id) on delete cascade,

  hazard_description            text not null,
  hazard_category               text not null check (hazard_category in (
    'physical','chemical','biological','psychosocial',
    'mechanical','electrical','ergonomic','environmental'
  )),

  likelihood                    text not null check (likelihood in (
    'rare','unlikely','possible','likely','almost_certain'
  )),
  consequence                   text not null check (consequence in (
    'insignificant','minor','moderate','major','catastrophic'
  )),
  inherent_risk_score           severity not null,
  residual_risk_score           severity not null,

  -- One-way per step-hazard. Flipped true by promoteStepHazard; never flipped
  -- back. The candidate's resolution lives on hazard_candidates.status.
  promoted_to_register          boolean not null default false,
  hazard_candidate_id           uuid references hazard_candidates(id) on delete set null,
  registered_hazard_id          uuid references hazards(id) on delete set null,

  created_at                    timestamptz not null default now(),
  updated_at                    timestamptz not null default now()
);
create trigger jsa_step_hazards_updated before update on jsa_step_hazards
  for each row execute function set_updated_at();
create index jsa_step_hazards_step_idx on jsa_step_hazards (jsa_step_id);


-- ----------------------------------------------------------------------------
-- 7. jsa_step_controls — same 5-level hierarchy as §HZ
-- ----------------------------------------------------------------------------
create table jsa_step_controls (
  id                            uuid primary key default gen_random_uuid(),
  jsa_step_hazard_id            uuid not null references jsa_step_hazards(id) on delete cascade,

  control_level                 text not null check (control_level in (
    'elimination','substitution','engineering','administrative','ppe'
  )),
  control_description           text not null,

  created_at                    timestamptz not null default now()
);
create index jsa_step_controls_hazard_idx on jsa_step_controls (jsa_step_hazard_id);


-- ----------------------------------------------------------------------------
-- 8. jsa_signoffs — per-worker per-shift ledger
--    signed_for_session is freeform text so contractors can use site-specific
--    shift names (`A-shift`, `night-2`). NULL is coerced to '' inside the
--    unique index so workers can also sign without picking a session.
-- ----------------------------------------------------------------------------
create table jsa_signoffs (
  id                            uuid primary key default gen_random_uuid(),
  jsa_id                        uuid not null references jsas(id) on delete cascade,
  worker_id                     uuid not null references profiles(id) on delete restrict,
  signed_at                     timestamptz not null default now(),
  signed_for_session            text,
  notes                         text,
  created_at                    timestamptz not null default now()
);
create unique index jsa_signoffs_unique_per_session
  on jsa_signoffs (jsa_id, worker_id, coalesce(signed_for_session, ''));
create index jsa_signoffs_jsa_idx on jsa_signoffs (jsa_id, signed_at desc);
create index jsa_signoffs_worker_idx on jsa_signoffs (worker_id, signed_at desc);


-- ----------------------------------------------------------------------------
-- 9. jsa_incident_links — closes the feedback loop (incident → JSA review)
--    Mirrors §HZ's incident_hazard_links table. The auto-flip from
--    `approved → under_review` lives in the actions layer.
-- ----------------------------------------------------------------------------
create table jsa_incident_links (
  id                            uuid primary key default gen_random_uuid(),
  jsa_id                        uuid not null references jsas(id) on delete cascade,
  incident_id                   uuid not null references incidents(id) on delete cascade,
  link_type                     text not null check (link_type in (
    'causal','contributing','exposed_but_not_causal'
  )),
  triggered_review              boolean not null default false,
  identified_at                 timestamptz not null default now(),
  identified_by                 uuid not null references profiles(id) on delete restrict,
  notes                         text,
  created_at                    timestamptz not null default now(),
  unique (jsa_id, incident_id)
);
create index jsa_incident_links_jsa_idx on jsa_incident_links (jsa_id);
create index jsa_incident_links_incident_idx on jsa_incident_links (incident_id);


-- ----------------------------------------------------------------------------
-- 10. Ref-code generator (JSA-<SITE>-<YEAR>-NNNN)
--     Mirrors the Phase 14 hazard ref-code path: derives a 3-letter site
--     prefix from sites.name (alphanumeric, uppercased) — sites has no
--     dedicated short_code column.
-- ----------------------------------------------------------------------------
create or replace function generate_jsa_ref_code(p_site_id uuid) returns text
  language plpgsql security definer set search_path = public as $$
declare
  v_site_name text;
  v_site_code text;
  v_year      int := extract(year from now())::int;
  v_seq       int;
  v_prefix    text;
begin
  select name into v_site_name from sites where id = p_site_id;
  v_site_code := upper(substring(regexp_replace(coalesce(v_site_name, ''), '[^A-Za-z0-9]', '', 'g') from 1 for 3));
  if v_site_code is null or v_site_code = '' then
    v_site_code := 'XXX';
  end if;
  v_prefix := 'JSA-' || v_site_code || '-' || v_year::text || '-';
  select coalesce(max((regexp_match(ref_code, '-(\d+)$'))[1]::int), 0) + 1
    into v_seq
    from jsas
   where ref_code like v_prefix || '%';
  return v_prefix || lpad(v_seq::text, 4, '0');
end $$;

create or replace function set_jsa_ref_code() returns trigger
  language plpgsql as $$
begin
  if new.ref_code is null or new.ref_code = '' then
    new.ref_code := generate_jsa_ref_code(new.site_id);
  end if;
  return new;
end $$;

create trigger jsas_ref_code before insert on jsas
  for each row execute function set_jsa_ref_code();


-- ----------------------------------------------------------------------------
-- 11. Expiry sweep — flips approved → expired when expires_at < today
-- ----------------------------------------------------------------------------
create or replace function expire_overdue_jsas() returns int
  language plpgsql security definer set search_path = public as $$
declare
  v_count int;
begin
  with updated as (
    update jsas
       set status = 'expired', updated_at = now()
     where status = 'approved'
       and expires_at is not null
       and expires_at < current_date
       and deleted_at is null
     returning id
  )
  select count(*) into v_count from updated;
  return v_count;
end $$;

-- pg_cron schedule (defensive: skips silently if the extension isn't enabled
-- on this database; the function is idempotent and can be invoked manually
-- from the Supabase dashboard if cron isn't available).
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    if exists (select 1 from cron.job where jobname = 'jsa-expiry-daily') then
      perform cron.unschedule('jsa-expiry-daily');
    end if;
    perform cron.schedule(
      'jsa-expiry-daily',
      '15 1 * * *',
      $jsa_cron$select public.expire_overdue_jsas();$jsa_cron$
    );
  end if;
end $$;


-- ----------------------------------------------------------------------------
-- 12. New permission keys
-- ----------------------------------------------------------------------------
insert into permissions (key, description) values
  ('jsa:read_site',           'Read JSAs at sites you belong to'),
  ('jsa:draft',               'Create and edit draft JSAs'),
  ('jsa:approve',             'Approve a JSA submitted for review'),
  ('jsa:signoff',             'Sign off on a JSA before performing the job'),
  ('jsa:promote_step_hazard', 'Promote a JSA step-hazard to the hazard register candidate queue')
on conflict (key) do nothing;


-- ----------------------------------------------------------------------------
-- 13. Row-Level Security
-- ----------------------------------------------------------------------------
alter table jsas                enable row level security;
alter table jsa_steps           enable row level security;
alter table jsa_step_hazards    enable row level security;
alter table jsa_step_controls   enable row level security;
alter table jsa_signoffs        enable row level security;
alter table jsa_incident_links  enable row level security;

-- jsas: read site-scoped; insert requires jsa:draft; update requires either
-- jsa:draft (for body edits on drafts — action layer further restricts to
-- status='draft') or jsa:approve (for the approval status transition only).
create policy jsas_read on jsas for select to authenticated
  using (
    org_id = current_org()
    and deleted_at is null
    and user_can_access_site(site_id)
  );
create policy jsas_insert on jsas for insert to authenticated
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
    and has_permission('jsa:draft', site_id)
  );
create policy jsas_update on jsas for update to authenticated
  using (
    org_id = current_org()
    and user_can_access_site(site_id)
    and (
      has_permission('jsa:draft',   site_id)
      or has_permission('jsa:approve', site_id)
    )
  )
  with check (
    org_id = current_org()
    and user_can_access_site(site_id)
  );

-- jsa_steps + jsa_step_hazards + jsa_step_controls: read + write via parent
-- JSA's site_id. The action layer enforces status='draft' for write paths.
create policy jsa_steps_read on jsa_steps for select to authenticated
  using (exists (
    select 1 from jsas j
     where j.id = jsa_steps.jsa_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
  ));
create policy jsa_steps_write on jsa_steps for all to authenticated
  using (exists (
    select 1 from jsas j
     where j.id = jsa_steps.jsa_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and has_permission('jsa:draft', j.site_id)
  ))
  with check (exists (
    select 1 from jsas j
     where j.id = jsa_steps.jsa_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and has_permission('jsa:draft', j.site_id)
  ));

create policy jsa_step_hazards_read on jsa_step_hazards for select to authenticated
  using (exists (
    select 1 from jsa_steps s
      join jsas j on j.id = s.jsa_id
     where s.id = jsa_step_hazards.jsa_step_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
  ));
create policy jsa_step_hazards_write on jsa_step_hazards for all to authenticated
  using (exists (
    select 1 from jsa_steps s
      join jsas j on j.id = s.jsa_id
     where s.id = jsa_step_hazards.jsa_step_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and (
         has_permission('jsa:draft', j.site_id)
         or has_permission('jsa:promote_step_hazard', j.site_id)
       )
  ))
  with check (exists (
    select 1 from jsa_steps s
      join jsas j on j.id = s.jsa_id
     where s.id = jsa_step_hazards.jsa_step_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and (
         has_permission('jsa:draft', j.site_id)
         or has_permission('jsa:promote_step_hazard', j.site_id)
       )
  ));

create policy jsa_step_controls_read on jsa_step_controls for select to authenticated
  using (exists (
    select 1 from jsa_step_hazards sh
      join jsa_steps s on s.id = sh.jsa_step_id
      join jsas j on j.id = s.jsa_id
     where sh.id = jsa_step_controls.jsa_step_hazard_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
  ));
create policy jsa_step_controls_write on jsa_step_controls for all to authenticated
  using (exists (
    select 1 from jsa_step_hazards sh
      join jsa_steps s on s.id = sh.jsa_step_id
      join jsas j on j.id = s.jsa_id
     where sh.id = jsa_step_controls.jsa_step_hazard_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and has_permission('jsa:draft', j.site_id)
  ))
  with check (exists (
    select 1 from jsa_step_hazards sh
      join jsa_steps s on s.id = sh.jsa_step_id
      join jsas j on j.id = s.jsa_id
     where sh.id = jsa_step_controls.jsa_step_hazard_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
       and has_permission('jsa:draft', j.site_id)
  ));

-- jsa_signoffs: read for site members; insert requires jsa:signoff AND
-- worker_id = auth.uid() (workers sign for themselves — no proxy sign-off).
create policy jsa_signoffs_read on jsa_signoffs for select to authenticated
  using (exists (
    select 1 from jsas j
     where j.id = jsa_signoffs.jsa_id
       and j.org_id = current_org()
       and user_can_access_site(j.site_id)
  ));
create policy jsa_signoffs_insert on jsa_signoffs for insert to authenticated
  with check (
    worker_id = auth.uid()
    and exists (
      select 1 from jsas j
       where j.id = jsa_signoffs.jsa_id
         and j.org_id = current_org()
         and user_can_access_site(j.site_id)
         and has_permission('jsa:signoff', j.site_id)
         and j.status = 'approved'
    )
  );

-- jsa_incident_links: read for users who can see both ends; insert requires
-- investigation:lead on the incident's site.
create policy jsa_incident_links_read on jsa_incident_links for select to authenticated
  using (
    exists (
      select 1 from jsas j
       where j.id = jsa_incident_links.jsa_id
         and j.org_id = current_org()
         and user_can_access_site(j.site_id)
    )
    and exists (
      select 1 from incidents i
       where i.id = jsa_incident_links.incident_id
         and i.org_id = current_org()
         and user_can_access_site(i.site_id)
    )
  );
create policy jsa_incident_links_insert on jsa_incident_links for insert to authenticated
  with check (
    identified_by = auth.uid()
    and exists (
      select 1 from incidents i
       where i.id = jsa_incident_links.incident_id
         and i.org_id = current_org()
         and user_can_access_site(i.site_id)
         and has_permission('investigation:lead', i.site_id)
    )
    and exists (
      select 1 from jsas j
       where j.id = jsa_incident_links.jsa_id
         and j.org_id = current_org()
         and user_can_access_site(j.site_id)
    )
  );


-- ----------------------------------------------------------------------------
-- 14. can_edit_parent — extend polymorphic dispatch for jsa_step / jsa_step_hazard
-- ----------------------------------------------------------------------------
create or replace function can_edit_parent(
  p_parent_type document_link_parent,
  p_parent_id   uuid
) returns boolean
  language plpgsql stable security definer set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_site_id uuid;
  v_owner   uuid;
  v_status  text;
begin
  if v_uid is null then return false; end if;

  case p_parent_type
    when 'incident' then
      select reporter_id, site_id into v_owner, v_site_id
        from incidents where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return v_owner = v_uid
          or has_permission('incident:assign',     v_site_id)
          or has_permission('incident:close',      v_site_id)
          or has_permission('investigation:edit',  v_site_id);

    when 'investigation' then
      select site_id into v_site_id
        from investigations where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('investigation:edit', v_site_id);

    when 'capa' then
      select site_id into v_site_id
        from capas where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('capa:complete',           v_site_id)
          or has_permission('capa:reassign_verifier',  v_site_id);

    when 'asset' then
      select site_id into v_site_id
        from assets where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('asset:edit', v_site_id);

    when 'site' then
      return has_permission('site:configure', p_parent_id);

    when 'inspection' then
      select inspector_id, site_id into v_owner, v_site_id
        from inspections where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return (v_owner = v_uid and has_permission('inspection:edit_own', v_site_id))
          or has_permission('inspection:edit_any', v_site_id);

    when 'finding' then
      select i.site_id into v_site_id
        from inspection_findings f
        join inspections i on i.id = f.inspection_id
       where f.id = p_parent_id;
      if not found then return false; end if;
      return has_permission('finding:resolve',  v_site_id)
          or has_permission('finding:escalate', v_site_id);

    -- New for Phase 15: photo / document evidence per JSA step.
    when 'jsa_step' then
      select j.site_id, j.status into v_site_id, v_status
        from jsa_steps s
        join jsas j on j.id = s.jsa_id
       where s.id = p_parent_id and j.deleted_at is null;
      if not found then return false; end if;
      return v_status = 'draft' and has_permission('jsa:draft', v_site_id);

    when 'jsa_step_hazard' then
      select j.site_id, j.status into v_site_id, v_status
        from jsa_step_hazards sh
        join jsa_steps s on s.id = sh.jsa_step_id
        join jsas j on j.id = s.jsa_id
       where sh.id = p_parent_id and j.deleted_at is null;
      if not found then return false; end if;
      return v_status = 'draft' and has_permission('jsa:draft', v_site_id);
  end case;

  return false;
end $$;


-- ----------------------------------------------------------------------------
-- 15. org_id_of_event — extend to include JSA
-- ----------------------------------------------------------------------------
create or replace function org_id_of_event(e activity_events) returns uuid
  language sql stable security definer set search_path = public as $$
  select coalesce(
    (select org_id from incidents             where id = e.incident_id),
    (select org_id from investigations        where id = e.investigation_id),
    (select org_id from capas                 where id = e.capa_id),
    (select org_id from templates             where id = e.template_id),
    (select org_id from inspections           where id = e.inspection_id),
    (select org_id from inspection_findings   where id = e.finding_id),
    (select org_id from assets                where id = e.asset_id),
    (select org_id from documents             where id = e.document_id),
    (select d.org_id
       from document_links dl
       join documents d on d.id = dl.document_id
      where dl.id = e.document_link_id),
    (select org_id from jsas                  where id = e.jsa_id)
  )
$$;


-- ----------------------------------------------------------------------------
-- 16. Backfill permission grants on existing orgs' default roles
-- ----------------------------------------------------------------------------
-- worker: read_site + signoff
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values ('jsa:read_site'), ('jsa:signoff')) as k(key)
   where r.is_default = true and r.key = 'worker'
on conflict do nothing;

-- supervisor: read_site + signoff + draft
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values ('jsa:read_site'), ('jsa:signoff'), ('jsa:draft')) as k(key)
   where r.is_default = true and r.key = 'supervisor'
on conflict do nothing;

-- ehs_manager: read_site + signoff + draft + approve + promote_step_hazard
insert into role_permissions (role_id, permission_key)
  select r.id, k.key
    from roles r
    cross join (values
      ('jsa:read_site'),
      ('jsa:signoff'),
      ('jsa:draft'),
      ('jsa:approve'),
      ('jsa:promote_step_hazard')
    ) as k(key)
   where r.is_default = true and r.key = 'ehs_manager'
on conflict do nothing;

-- site_admin catch-all
insert into role_permissions (role_id, permission_key)
  select r.id, p.key
    from roles r
    cross join permissions p
   where r.is_default = true and r.key = 'site_admin'
on conflict do nothing;


-- ----------------------------------------------------------------------------
-- 17. Patch seed_default_roles() so future orgs inherit JSA grants
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
    (v_role_id, 'planner:read'),
    (v_role_id, 'argus:use'),
    (v_role_id, 'hazard:read_site'),
    (v_role_id, 'jsa:read_site'),
    (v_role_id, 'jsa:signoff')
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
    (v_role_id, 'hazard:report'),
    (v_role_id, 'jsa:read_site'),
    (v_role_id, 'jsa:signoff'),
    (v_role_id, 'jsa:draft')
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
    (v_role_id, 'hazard_candidate:review'),
    (v_role_id, 'jsa:read_site'),
    (v_role_id, 'jsa:signoff'),
    (v_role_id, 'jsa:draft'),
    (v_role_id, 'jsa:approve'),
    (v_role_id, 'jsa:promote_step_hazard')
  on conflict do nothing;

  -- site_admin catch-all picks up every existing permission key.
  insert into roles (org_id, key, name, description, is_default)
    values (p_org_id, 'site_admin', 'Site Administrator', 'Full system access for assigned sites.', true)
    on conflict (org_id, key) do update set description = excluded.description
    returning id into v_role_id;
  insert into role_permissions (role_id, permission_key)
    select v_role_id, key from permissions
  on conflict do nothing;
end $$;
