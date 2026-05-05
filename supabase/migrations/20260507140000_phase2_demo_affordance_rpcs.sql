-- ============================================================================
-- Phase 2 — demo affordance RPCs + orgs.is_demo flag
-- ============================================================================
-- Three demo affordances surface as buttons under /admin/demo (gated on the
-- new permission key `demo:reset` — site_admin only). To prevent an admin on
-- a real prod org from accidentally wiping data, every destructive RPC here
-- guards on `orgs.is_demo = true`.
--
--   1) orgs.is_demo flag (default false)
--   2) reset_demo_data_v1(p_org_id) — wipes transactional data for a demo org
--   3) load_sample_chain_v1(p_site_id, p_actor_id, p_verifier_id) — creates a
--      Track A injury → closed investigation → CAPA in 'pending_verification'
--      ready to demo the verification flow in 30 seconds
--
-- Server actions enforce can('demo:reset', siteId) before invoking these RPCs.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) orgs.is_demo
-- ----------------------------------------------------------------------------
alter table orgs add column if not exists is_demo boolean not null default false;

-- ----------------------------------------------------------------------------
-- 2) reset_demo_data_v1
-- ----------------------------------------------------------------------------
-- Wipes transactional rows for the org in dependency order. Keeps foundational
-- rows (orgs, sites, profiles, roles, role_permissions, site_members, teams,
-- notification_recipients, site_annual_hours) intact so the seed script
-- doesn't need to re-run.
--
-- Hard guard: refuses unless orgs.is_demo = true on the target org.
-- ============================================================================
create or replace function reset_demo_data_v1(p_org_id uuid) returns void
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_is_demo boolean;
begin
  select is_demo into v_is_demo from orgs where id = p_org_id;
  if v_is_demo is null then
    raise exception 'Org % not found', p_org_id;
  end if;
  if v_is_demo = false then
    raise exception 'Org % is not a demo org; reset refused', p_org_id;
  end if;

  -- Delete in dependency order (children first; cascades clean up most edges)
  delete from activity_events ae
   where exists (select 1 from incidents i where i.id = ae.incident_id and i.org_id = p_org_id)
      or exists (select 1 from investigations inv where inv.id = ae.investigation_id and inv.org_id = p_org_id)
      or exists (select 1 from capas c where c.id = ae.capa_id and c.org_id = p_org_id);

  delete from notifications n
   where n.site_id in (select id from sites where org_id = p_org_id);

  delete from hse_notification_records hr
   where exists (select 1 from incidents i where i.id = hr.incident_id and i.org_id = p_org_id);

  delete from rca_whys rw
   where exists (select 1 from investigations inv where inv.id = rw.investigation_id and inv.org_id = p_org_id);

  delete from investigation_evidence ie
   where exists (select 1 from investigations inv where inv.id = ie.investigation_id and inv.org_id = p_org_id);

  delete from investigation_team_members itm
   where exists (select 1 from investigations inv where inv.id = itm.investigation_id and inv.org_id = p_org_id);

  -- CAPAs: clear self-referential follow_up_capa_id first to avoid FK churn
  update capas set follow_up_capa_id = null where org_id = p_org_id;
  delete from capas where org_id = p_org_id;

  delete from investigations where org_id = p_org_id;

  delete from incident_attachments ia
   where exists (select 1 from incidents i where i.id = ia.incident_id and i.org_id = p_org_id);

  delete from severity_overrides so
   where exists (select 1 from incidents i where i.id = so.incident_id and i.org_id = p_org_id);

  delete from injured_persons ip
   where exists (select 1 from incidents i where i.id = ip.incident_id and i.org_id = p_org_id);

  delete from witnesses w
   where exists (select 1 from incidents i where i.id = w.incident_id and i.org_id = p_org_id);

  delete from incidents where org_id = p_org_id;
end $$;

-- ----------------------------------------------------------------------------
-- 3) load_sample_chain_v1
-- ----------------------------------------------------------------------------
-- Creates a representative Track A injury → closed investigation → CAPA in
-- 'pending_verification' with a different verifier than owner, so the demo
-- can land directly on the verify form. Returns the CAPA id so the caller
-- can deep-link to /capa/[id].
--
-- Guard: refuses unless the site's org has is_demo=true. Verifier must differ
-- from actor (the CHECK constraint on capas already enforces this; we add a
-- friendly raise so callers see a useful error).
-- ============================================================================
create or replace function load_sample_chain_v1(
  p_site_id     uuid,
  p_actor_id    uuid,
  p_verifier_id uuid
) returns uuid
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_org_id            uuid;
  v_is_demo           boolean;
  v_incident_id       uuid;
  v_investigation_id  uuid;
  v_capa_id           uuid;
begin
  if p_actor_id = p_verifier_id then
    raise exception 'verifier must differ from owner';
  end if;

  select s.org_id, o.is_demo
    into v_org_id, v_is_demo
    from sites s
    join orgs o on o.id = s.org_id
   where s.id = p_site_id;

  if v_org_id is null then
    raise exception 'Site % not found', p_site_id;
  end if;
  if not coalesce(v_is_demo, false) then
    raise exception 'Site % belongs to a non-demo org; load_sample_chain refused', p_site_id;
  end if;

  -- 1) Track A injury incident, already classified
  insert into incidents (
    org_id, site_id, reporter_id, type, title, description, occurred_at,
    severity, track, status, classified_at, osha_recordable
  ) values (
    v_org_id, p_site_id, p_actor_id, 'injury',
    'Sample: forklift wrist injury (demo)',
    'A forklift operator caught their wrist between the load and a rack. '
      || 'Hospitalized for evaluation. Sample data for the verification demo.',
    now() - interval '5 days',
    'S2', 'A', 'awaiting_capa', now() - interval '5 days', true
  ) returning id into v_incident_id;

  insert into injured_persons (incident_id, name, treatment, hospitalized, fatality)
    values (v_incident_id, 'Sample Worker', 'hospitalization', true, false);

  -- 2) Closed investigation with 5-Why and findings
  insert into investigations (
    incident_id, site_id, org_id, lead_investigator_id, status, started_at, due_date,
    findings, root_cause_summary, closed_at
  ) values (
    v_incident_id, p_site_id, v_org_id, p_actor_id, 'closed',
    now() - interval '4 days',
    current_date + 9,
    'Operator was not wearing wrist protection. Rack spacing was 12cm narrower '
      || 'than the forklift turn-radius spec. PM checklist did not include a '
      || 'rack-clearance verification step.',
    'Inadequate rack clearance + missing PPE check',
    now() - interval '1 hour'
  ) returning id into v_investigation_id;

  insert into rca_whys (investigation_id, level, question, answer) values
    (v_investigation_id, 1, 'Why was the operator injured?',
       'Wrist caught between load and rack during a tight turn.'),
    (v_investigation_id, 2, 'Why was clearance insufficient?',
       'Rack spacing was 12cm narrower than the forklift turn-radius spec.'),
    (v_investigation_id, 3, 'Why was the rack spacing wrong?',
       'Original layout pre-dated the current forklift fleet.'),
    (v_investigation_id, 4, 'Why did no review happen at fleet upgrade?',
       'PM checklist did not include rack-clearance verification.'),
    (v_investigation_id, 5, 'Why did the checklist miss it?',
       'Template last reviewed 2019; new equipment risks not added.');

  -- 3) CAPA in pending_verification, ready to verify
  insert into capas (
    investigation_id, incident_id, org_id, site_id, type, title, description,
    owner_id, verifier_id, due_date, status, progress_pct, completed_at
  ) values (
    v_investigation_id, v_incident_id, v_org_id, p_site_id, 'corrective',
    'Widen forklift lane and update PM checklist',
    'Re-space racks in Bay 7 to 18cm minimum clearance; add a rack-clearance '
      || 'check to the forklift quarterly PM template.',
    p_actor_id, p_verifier_id, current_date + 14, 'pending_verification', 100,
    now() - interval '2 hours'
  ) returning id into v_capa_id;

  insert into activity_events (incident_id, capa_id, investigation_id, actor_id, verb, payload)
    values (v_incident_id, v_capa_id, v_investigation_id, p_actor_id,
            'demo.sample_chain_loaded',
            jsonb_build_object('capa_id', v_capa_id));

  return v_capa_id;
end $$;
