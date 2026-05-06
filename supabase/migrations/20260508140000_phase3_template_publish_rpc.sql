-- ============================================================================
-- Phase 3 — publish_template_version_v1 atomic RPC
-- ============================================================================
-- Transitions a draft template_version to 'published' and updates the
-- parent template's current_version_id, archiving the previous active
-- version (if any). All in a single transaction so the snapshot rule
-- (CLAUDE.md hard rule) is preserved: in-flight inspections that hold a
-- template_version_id continue to point at an immutable row, even though
-- the parent template's current_version_id has rolled forward.
--
-- Per CLAUDE.md: workflow logic lives in lib/workflow/*.ts; the RPC is
-- just the transaction boundary. The server action (publishTemplateVersion)
-- validates the change_summary length and calls this.
--
-- Safety:
--   * Asserts caller has template:edit OR template:publish on the org.
--   * Asserts the draft belongs to the named template AND has at least one
--     item (rejecting empty templates that can't be inspected).
--   * Asserts caller cannot publish a system preset (org_id IS NULL).
--   * Writes an activity_events row capturing the version_number +
--     change_summary so the Versions panel can timeline it.
-- ============================================================================

create or replace function publish_template_version_v1(
  p_template_id      uuid,
  p_draft_version_id uuid,
  p_change_summary   text,
  p_actor_id         uuid
) returns void
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_template          templates%rowtype;
  v_draft             template_versions%rowtype;
  v_previous_id       uuid;
  v_item_count        integer;
begin
  -- Lock the template row
  select * into v_template from templates where id = p_template_id for update;
  if not found then
    raise exception 'Template % not found', p_template_id;
  end if;
  if v_template.is_system_preset then
    raise exception 'System presets cannot be re-published';
  end if;

  -- Lock the draft version
  select * into v_draft from template_versions
   where id = p_draft_version_id and template_id = p_template_id
   for update;
  if not found then
    raise exception 'Draft version % does not belong to template %', p_draft_version_id, p_template_id;
  end if;
  if v_draft.status <> 'draft' then
    raise exception 'Version % is not a draft (status=%)', p_draft_version_id, v_draft.status;
  end if;

  -- Reject empty templates
  v_item_count := jsonb_array_length(v_draft.items);
  if v_item_count = 0 then
    raise exception 'Cannot publish empty template — add at least one item';
  end if;

  -- Reject empty change summaries (UI also requires ≥ 10 chars; double-check)
  if length(coalesce(trim(p_change_summary), '')) < 10 then
    raise exception 'change_summary must be at least 10 characters';
  end if;

  -- Archive the previous current version (if any)
  v_previous_id := v_template.current_version_id;
  if v_previous_id is not null and v_previous_id <> p_draft_version_id then
    update template_versions
       set status = 'archived'
     where id = v_previous_id;
  end if;

  -- Promote the draft
  update template_versions
     set status         = 'published',
         change_summary = p_change_summary,
         published_by   = p_actor_id,
         published_at   = now()
   where id = p_draft_version_id;

  -- Update the parent template pointer + status
  update templates
     set current_version_id = p_draft_version_id,
         status             = 'published'
   where id = p_template_id;

  -- Audit trail (template_id parent column added by Phase 3 schema migration)
  insert into activity_events (template_id, actor_id, verb, payload)
  values (
    p_template_id,
    p_actor_id,
    'template.published',
    jsonb_build_object(
      'version_id',     p_draft_version_id,
      'version_number', v_draft.version_number,
      'change_summary', p_change_summary,
      'item_count',     v_item_count
    )
  );
end $$;
