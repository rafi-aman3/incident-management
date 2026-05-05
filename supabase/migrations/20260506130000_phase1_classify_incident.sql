-- ============================================================================
-- Phase 1 — classify_incident_v1 atomic-write RPC
-- ============================================================================
-- The workflow engines (severity, routing, notifications) live in
-- lib/workflow/*.ts per CLAUDE.md hard rule. This RPC takes their precomputed
-- outputs and applies them atomically:
--
--   1. Lock the incident row (FOR UPDATE) and reject if not in draft/submitted
--   2. Write severity + track + status='classified' + classified_at
--   3. If track A or B AND not sandbox: insert investigations row with SLA
--   4. If not sandbox: insert one notifications row per deadline (site-wide,
--      recipient_id NULL — the dashboard banner reads these via the
--      "recipient_id is null AND user_can_access_site(site_id)" RLS branch)
--   5. Insert activity_events row 'incident.classified'
--
-- Sandbox incidents (is_sandbox=true) still get severity + track for display,
-- but skip investigation-row creation and skip notification fan-out (per
-- CLAUDE.md "Engine layers all skip sandbox rows").
-- ============================================================================

create or replace function classify_incident_v1(
  p_incident_id uuid,
  p_severity    severity,
  p_track       track,
  p_deadlines   jsonb,
  p_actor_id    uuid
) returns void
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_incident incidents%rowtype;
  v_due_date date;
begin
  -- 1. Lock and read
  select * into v_incident from incidents where id = p_incident_id for update;
  if not found then
    raise exception 'Incident % not found', p_incident_id;
  end if;
  if v_incident.status not in ('draft', 'submitted') then
    raise exception 'Incident % already classified (status=%)', p_incident_id, v_incident.status;
  end if;

  -- 2. Update incident — severity + track + status + classified_at
  -- The deferred severity-change trigger only fires when severity changes from
  -- a non-NULL value; the initial NULL → S* assignment is exempt.
  update incidents
     set severity      = p_severity,
         track         = p_track,
         status        = 'classified',
         classified_at = now()
   where id = p_incident_id;

  -- Sandbox: skip downstream effects
  if v_incident.is_sandbox then
    insert into activity_events (incident_id, actor_id, verb, payload)
      values (p_incident_id, p_actor_id, 'incident.classified',
              jsonb_build_object('severity', p_severity, 'track', p_track, 'sandbox', true));
    return;
  end if;

  -- 3. Investigation auto-creation for Track A/B
  if p_track in ('A', 'B') then
    v_due_date := case when p_track = 'A' then current_date + 14 else current_date + 7 end;
    insert into investigations (incident_id, site_id, org_id, status, due_date)
      values (p_incident_id, v_incident.site_id, v_incident.org_id, 'pending_assignment', v_due_date);
    update incidents set status = 'under_investigation' where id = p_incident_id;
  end if;

  -- 4. Site-wide notifications (recipient_id NULL → visible to all site members)
  insert into notifications (
    kind, incident_id, recipient_id, site_id, title, body, deadline_at
  )
  select
    (d->>'kind')::notification_kind,
    p_incident_id,
    null,
    v_incident.site_id,
    d->>'title',
    d->>'body',
    (d->>'deadlineAt')::timestamptz
  from jsonb_array_elements(p_deadlines) d;

  -- 5. Audit trail
  insert into activity_events (incident_id, actor_id, verb, payload)
    values (p_incident_id, p_actor_id, 'incident.classified',
            jsonb_build_object('severity', p_severity, 'track', p_track,
                               'deadline_count', jsonb_array_length(p_deadlines)));
end $$;
