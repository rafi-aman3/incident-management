-- ============================================================================
-- Phase 3 — complete_inspection_v1 atomic RPC
-- ============================================================================
-- Materializes a completed inspection in a single transaction:
--
--   1. Asserts caller is the inspector (with inspection:edit_own) OR holds
--      inspection:edit_any at the site, AND has inspection:complete.
--   2. Walks `inspections.answers` against the snapshotted
--      template_versions row to compute score_total / score_max.
--   3. For every answer where `selected_option_failed = true`, inserts an
--      inspection_findings row capturing item label + response label +
--      comment + photo paths.
--   4. Updates the inspection: status='completed', completed_at=now(),
--      score totals, is_failed.
--   5. Writes an activity_events row.
--
-- Validation of "all required fields answered" happens client-side (UI
-- modal lists missing required items and blocks submit). The server still
-- accepts incomplete submissions — the use case is "user marks N/A" or
-- "supervisor force-completes". RLS already ensures only authorized users
-- can call this.
--
-- The expected `answers` jsonb shape per item_id:
--   {
--     selected_option_id?: uuid,
--     selected_option_failed?: boolean,
--     selected_option_score?: integer,
--     selected_option_max?:   integer,
--     selected_option_label?: string,
--     response_text?: string,
--     response_value?: any,
--     notes?: string,
--     uploads?: [{ id, name, storage_path }],
--     updated_at: iso
--   }
--
-- The runner is responsible for denormalizing the answer_set lookup
-- (label / score / max / failed) into the answer payload at save time.
-- This keeps the RPC O(N) over answers without re-walking the items tree.
-- ============================================================================

create or replace function complete_inspection_v1(p_inspection_id uuid)
  returns void
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_insp           inspections%rowtype;
  v_score_total    integer := 0;
  v_score_max      integer := 0;
  v_failed_count   integer := 0;
  v_answer_key     text;
  v_answer         jsonb;
  v_label          text;
  v_failed_label   text;
  v_comment        text;
  v_photo_paths    text[];
  v_items          jsonb;
  v_item           jsonb;
  v_item_label_map jsonb := '{}'::jsonb;
begin
  -- 1. Lock + authz
  select * into v_insp from inspections where id = p_inspection_id for update;
  if not found then
    raise exception 'Inspection % not found', p_inspection_id;
  end if;
  if v_insp.status = 'completed' then
    raise exception 'Inspection % already completed', p_inspection_id;
  end if;
  if v_insp.deleted_at is not null then
    raise exception 'Inspection % is deleted', p_inspection_id;
  end if;

  if not (
    (v_insp.inspector_id = auth.uid() and has_permission('inspection:edit_own', v_insp.site_id))
    or has_permission('inspection:edit_any', v_insp.site_id)
  ) then
    raise exception 'forbidden: must be inspector or hold inspection:edit_any';
  end if;
  if not has_permission('inspection:complete', v_insp.site_id) then
    raise exception 'forbidden: inspection:complete required';
  end if;

  -- 2. Build item_id → label map by walking the snapshotted template version
  select items into v_items from template_versions where id = v_insp.template_version_id;
  if v_items is not null then
    for v_item in select value from jsonb_array_elements(v_items) loop
      if v_item ? 'item_id' then
        v_item_label_map := v_item_label_map
          || jsonb_build_object(
               v_item->>'item_id',
               coalesce(v_item->>'label', '(unlabeled)')
             );
      end if;
    end loop;
  end if;

  -- 3. Walk answers — compute score, materialize findings on failed entries
  for v_answer_key, v_answer in select * from jsonb_each(v_insp.answers) loop
    -- Score totals (only count items where score_max is set)
    if v_answer ? 'selected_option_max' and (v_answer->>'selected_option_max') is not null then
      v_score_max   := v_score_max   + coalesce((v_answer->>'selected_option_max')::integer, 0);
      v_score_total := v_score_total + coalesce((v_answer->>'selected_option_score')::integer, 0);
    end if;

    -- Failed → finding row
    if (v_answer->>'selected_option_failed')::boolean is true then
      v_failed_count := v_failed_count + 1;

      v_label        := coalesce(v_item_label_map->>v_answer_key, '(unlabeled item)');
      v_failed_label := v_answer->>'selected_option_label';
      v_comment      := v_answer->>'notes';

      -- Collect storage paths from uploads array (if present)
      v_photo_paths := array(
        select coalesce(u->>'storage_path', '')
          from jsonb_array_elements(coalesce(v_answer->'uploads', '[]'::jsonb)) as u
         where coalesce(u->>'storage_path', '') <> ''
      );

      insert into inspection_findings (
        inspection_id, org_id, site_id,
        item_id, item_label, failed_response_label, comment, photo_paths,
        status
      )
      values (
        p_inspection_id,
        v_insp.org_id,
        v_insp.site_id,
        v_answer_key,
        v_label,
        v_failed_label,
        v_comment,
        v_photo_paths,
        'open'
      );
    end if;
  end loop;

  -- 4. Update the inspection
  update inspections
     set status       = 'completed',
         completed_at = now(),
         conducted_at = coalesce(conducted_at, now()),
         score_total  = v_score_total,
         score_max    = v_score_max,
         is_failed    = (v_failed_count > 0)
   where id = p_inspection_id;

  -- 5. Audit
  insert into activity_events (inspection_id, actor_id, verb, payload)
  values (
    p_inspection_id,
    auth.uid(),
    'inspection.completed',
    jsonb_build_object(
      'score_total',   v_score_total,
      'score_max',     v_score_max,
      'failed_count',  v_failed_count,
      'finding_count', v_failed_count
    )
  );
end $$;

-- ----------------------------------------------------------------------------
-- escalate_finding_to_incident_v1
--   Atomically: creates a draft incident pre-filled from the finding,
--   updates the finding's status + escalated_incident_id, writes activity.
-- ----------------------------------------------------------------------------
create or replace function escalate_finding_to_incident_v1(p_finding_id uuid)
  returns uuid
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_finding   inspection_findings%rowtype;
  v_incident_id uuid;
  v_description text;
begin
  select * into v_finding from inspection_findings
   where id = p_finding_id
   for update;
  if not found then
    raise exception 'Finding % not found', p_finding_id;
  end if;
  if v_finding.status = 'escalated_to_incident' then
    raise exception 'Finding % already escalated (incident: %)',
                    p_finding_id, v_finding.escalated_incident_id;
  end if;
  if not has_permission('finding:escalate', v_finding.site_id) then
    raise exception 'forbidden: finding:escalate required';
  end if;

  v_description := 'Escalated from inspection finding: ' || v_finding.item_label;
  if coalesce(v_finding.failed_response_label, '') <> '' then
    v_description := v_description || E'\nResponse: ' || v_finding.failed_response_label;
  end if;
  if coalesce(v_finding.comment, '') <> '' then
    v_description := v_description || E'\n\n' || v_finding.comment;
  end if;

  insert into incidents (
    ref_code, org_id, site_id, type, title, description,
    occurred_at, reporter_id, status, is_sandbox
  ) values (
    next_ref_code('INC', 'ref_incident_seq'),
    v_finding.org_id,
    v_finding.site_id,
    'unsafe_condition',
    'From finding: ' || left(v_finding.item_label, 200),
    v_description,
    now(),
    auth.uid(),
    'draft',
    false
  )
  returning id into v_incident_id;

  update inspection_findings
     set status                = 'escalated_to_incident',
         escalated_incident_id = v_incident_id
   where id = p_finding_id;

  insert into activity_events (finding_id, incident_id, actor_id, verb, payload)
  values (
    p_finding_id,
    v_incident_id,
    auth.uid(),
    'finding.escalated',
    jsonb_build_object(
      'incident_id', v_incident_id,
      'item_label',  v_finding.item_label
    )
  );

  return v_incident_id;
end $$;
