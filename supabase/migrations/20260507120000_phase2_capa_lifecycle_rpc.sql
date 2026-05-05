-- ============================================================================
-- Phase 2 — CAPA lifecycle RPCs (atomic-write transactions)
-- ============================================================================
-- The CAPA verification flow has 4 outcomes (per SPEC §6 verification_result
-- enum), one of which (partially_effective) auto-creates a follow-up CAPA in
-- the same transaction. Same pattern as classify_incident_v1: workflow logic
-- runs in lib/workflow/*.ts (per CLAUDE.md hard rule), and this RPC is just
-- the transaction boundary so the parent update + follow-up insert + activity
-- event don't tear apart on partial failure.
--
-- 1) verify_capa_v1 — branches by p_result and applies the right state change.
-- 2) assign_capa_from_investigation_v1 — bundles "Assign CAPA" close path:
--    create CAPA + close investigation + bump incident status, atomically.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) verify_capa_v1
-- ----------------------------------------------------------------------------
-- Branches:
--   effective            → status='verified' → 'closed'; verified_at + closed_at set
--   partially_effective  → as above + auto-create follow-up CAPA (same owner,
--                          verifier=null, status='created'), parent's
--                          follow_up_capa_id pointed at the new row
--   not_effective        → status='in_progress'; rejection_reason populated;
--                          completed_at cleared
--   too_early_to_verify  → status stays 'pending_verification'; re_verify_at set
--                          (re_verify_at is required in this branch)
--
-- Returns the follow-up capa id when partially_effective, else NULL.
--
-- Defenses (in addition to UI hide + server-action reject + the existing
-- capa_owner_not_verifier CHECK constraint at row level):
--   - Status must be 'pending_verification'
--   - auth.uid() must equal verifier_id (the assigned verifier)
--   - auth.uid() must NOT equal owner_id (redundant with CHECK if verifier_id
--     is set, but defensive in case verifier_id is null)
-- ============================================================================
create or replace function verify_capa_v1(
  p_capa_id      uuid,
  p_result       verification_result,
  p_method       verification_method,
  p_notes        text,
  p_re_verify_at date,
  p_actor_id     uuid
) returns uuid
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_capa         capas%rowtype;
  v_follow_up_id uuid;
begin
  -- Lock and read parent CAPA
  select * into v_capa from capas where id = p_capa_id for update;
  if not found then
    raise exception 'CAPA % not found', p_capa_id;
  end if;
  if v_capa.status <> 'pending_verification' then
    raise exception 'CAPA % not awaiting verification (status=%)',
      p_capa_id, v_capa.status;
  end if;
  if v_capa.verifier_id is null then
    raise exception 'CAPA % has no assigned verifier', p_capa_id;
  end if;
  if p_actor_id <> v_capa.verifier_id then
    raise exception 'Only the assigned verifier may verify CAPA %', p_capa_id;
  end if;
  if p_actor_id = v_capa.owner_id then
    raise exception 'CAPA owner cannot verify own CAPA';
  end if;

  -- Branch by outcome
  if p_result = 'effective' then
    update capas
       set verification_result = p_result,
           verification_method = p_method,
           status              = 'closed',
           verified_at         = now(),
           closed_at           = now()
     where id = p_capa_id;

  elsif p_result = 'partially_effective' then
    update capas
       set verification_result = p_result,
           verification_method = p_method,
           status              = 'closed',
           verified_at         = now(),
           closed_at           = now()
     where id = p_capa_id;

    -- Auto-create follow-up CAPA in 'created' status. Owner is preserved;
    -- verifier intentionally NULL so it can be (re)assigned.
    insert into capas (
      investigation_id, incident_id, org_id, site_id,
      type, title, description, owner_id, due_date, status
    ) values (
      v_capa.investigation_id, v_capa.incident_id, v_capa.org_id, v_capa.site_id,
      v_capa.type,
      'Follow-up: ' || v_capa.title,
      coalesce(p_notes, '') ||
        E'\n\n(Auto-created follow-up — parent CAPA was verified as partially effective.)',
      v_capa.owner_id,
      current_date + 30,
      'created'
    ) returning id into v_follow_up_id;

    update capas set follow_up_capa_id = v_follow_up_id where id = p_capa_id;

  elsif p_result = 'not_effective' then
    update capas
       set verification_result = p_result,
           verification_method = p_method,
           status              = 'in_progress',
           rejection_reason    = p_notes,
           completed_at        = null
     where id = p_capa_id;

  elsif p_result = 'too_early_to_verify' then
    if p_re_verify_at is null then
      raise exception 'too_early_to_verify requires re_verify_at';
    end if;
    update capas
       set verification_result = p_result,
           verification_method = p_method,
           re_verify_at        = p_re_verify_at
     where id = p_capa_id;

  else
    raise exception 'Unknown verification_result: %', p_result;
  end if;

  -- Audit trail
  insert into activity_events (capa_id, incident_id, investigation_id, actor_id, verb, payload)
    values (
      p_capa_id, v_capa.incident_id, v_capa.investigation_id, p_actor_id,
      'capa.' || p_result::text,
      jsonb_build_object(
        'method', p_method,
        'notes', p_notes,
        'follow_up_capa_id', v_follow_up_id,
        're_verify_at', p_re_verify_at
      )
    );

  return v_follow_up_id;
end $$;

-- ----------------------------------------------------------------------------
-- 2) assign_capa_from_investigation_v1
-- ----------------------------------------------------------------------------
-- Bundles the "Assign CAPA" close path used by /investigations/[id] modal:
--   1. Insert CAPA in 'created' state with owner / verifier / due date
--   2. Close the investigation (status='closed', closed_at=now())
--   3. Bump the source incident's status to 'awaiting_capa' (only when it's
--      currently 'under_investigation')
--   4. Write activity_events row 'investigation.closed_with_capa'
--
-- Returns the new CAPA id.
-- ============================================================================
create or replace function assign_capa_from_investigation_v1(
  p_investigation_id uuid,
  p_type             capa_type,
  p_title            text,
  p_description      text,
  p_owner_id         uuid,
  p_verifier_id      uuid,
  p_due_date         date,
  p_actor_id         uuid
) returns uuid
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_inv     investigations%rowtype;
  v_capa_id uuid;
begin
  select * into v_inv from investigations where id = p_investigation_id for update;
  if not found then
    raise exception 'Investigation % not found', p_investigation_id;
  end if;
  if v_inv.status = 'closed' then
    raise exception 'Investigation % already closed', p_investigation_id;
  end if;

  -- Insert CAPA — DB CHECK constraint enforces owner_id <> verifier_id
  insert into capas (
    investigation_id, incident_id, org_id, site_id,
    type, title, description, owner_id, verifier_id, due_date, status
  ) values (
    p_investigation_id, v_inv.incident_id, v_inv.org_id, v_inv.site_id,
    p_type, p_title, p_description, p_owner_id, p_verifier_id, p_due_date, 'created'
  ) returning id into v_capa_id;

  -- Close the investigation
  update investigations
     set status    = 'closed',
         closed_at = now()
   where id = p_investigation_id;

  -- Bump source incident status if currently under investigation
  update incidents
     set status = 'awaiting_capa'
   where id = v_inv.incident_id
     and status = 'under_investigation';

  -- Audit
  insert into activity_events (investigation_id, capa_id, incident_id, actor_id, verb, payload)
    values (
      p_investigation_id, v_capa_id, v_inv.incident_id, p_actor_id,
      'investigation.closed_with_capa',
      jsonb_build_object('capa_id', v_capa_id, 'capa_type', p_type)
    );

  return v_capa_id;
end $$;
