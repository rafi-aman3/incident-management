-- ============================================================================
-- Phase 3 — import_preset_to_org_v1 atomic RPC
-- ============================================================================
-- Clones a system-preset template into the caller's org as a fresh draft v1.
-- All item UUIDs are regenerated to avoid collisions if the same user later
-- imports the same preset multiple times. Parent_id linkage is preserved by
-- building a remap table during the walk.
--
-- The preset itself is unchanged. The new templates row sets:
--   * org_id            = caller's current_org()
--   * is_system_preset  = false
--   * is_imported       = true
--   * source_preset_id  = the preset's id (for "imported from" attribution)
--   * status            = 'draft'  (until the user publishes via the editor)
--
-- Returns the new template id so the server action can redirect the user
-- to /templates/[id]/edit.
-- ============================================================================

-- Helper: regenerate UUIDs in a TemplateNodeItem array, preserving the
-- parent_id graph. Pure SQL CTE walk — no looping.
create or replace function regenerate_item_ids(p_items jsonb)
  returns jsonb
  language plpgsql immutable
  set search_path = public
as $$
declare
  v_remap jsonb := '{}'::jsonb;
  v_item  jsonb;
  v_old_id text;
  v_new_id uuid;
  v_result jsonb := '[]'::jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' then
    return p_items;
  end if;

  -- First pass: build old_id → new_id remap for every item
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_old_id := v_item->>'item_id';
    if v_old_id is not null then
      v_new_id := gen_random_uuid();
      v_remap  := v_remap || jsonb_build_object(v_old_id, v_new_id::text);
    end if;
  end loop;

  -- Second pass: rewrite each item's item_id and (if present) parent_id
  for v_item in select value from jsonb_array_elements(p_items) loop
    v_old_id := v_item->>'item_id';
    if v_old_id is not null and v_remap ? v_old_id then
      v_item := jsonb_set(v_item, '{item_id}', to_jsonb(v_remap->>v_old_id));
    end if;
    if v_item ? 'parent_id' and v_remap ? (v_item->>'parent_id') then
      v_item := jsonb_set(v_item, '{parent_id}', to_jsonb(v_remap->>(v_item->>'parent_id')));
    end if;
    v_result := v_result || jsonb_build_array(v_item);
  end loop;

  return v_result;
end $$;

create or replace function import_preset_to_org_v1(p_preset_id uuid)
  returns uuid
  language plpgsql
  security invoker
  set search_path = public
as $$
declare
  v_org_id        uuid := current_org();
  v_preset        templates%rowtype;
  v_preset_ver    template_versions%rowtype;
  v_new_template  uuid;
  v_new_version   uuid;
begin
  if v_org_id is null then
    raise exception 'No current org for caller';
  end if;
  if not has_org_permission('template:create') then
    raise exception 'forbidden: template:create required';
  end if;

  -- Lock and read the preset
  select * into v_preset from templates
   where id = p_preset_id and is_system_preset = true
   for share;
  if not found then
    raise exception 'Preset % not found or not a system preset', p_preset_id;
  end if;
  if v_preset.current_version_id is null then
    raise exception 'Preset % has no current version', p_preset_id;
  end if;

  select * into v_preset_ver from template_versions
   where id = v_preset.current_version_id
   for share;
  if not found then
    raise exception 'Preset version % missing', v_preset.current_version_id;
  end if;

  -- Insert the new org-scoped template
  insert into templates (
    org_id, name, description, logo_url, industry,
    status, is_system_preset, is_imported, source_preset_id,
    created_by
  ) values (
    v_org_id,
    v_preset.name,
    v_preset.description,
    v_preset.logo_url,
    v_preset.industry,
    'draft',
    false,
    true,
    p_preset_id,
    auth.uid()
  )
  returning id into v_new_template;

  -- Insert v1 draft, with regenerated item UUIDs so future joins remain
  -- unambiguous if the user imports the same preset twice
  insert into template_versions (
    template_id, version_number, status,
    header, items, template_data
  ) values (
    v_new_template,
    1,
    'draft',
    regenerate_item_ids(v_preset_ver.header),
    regenerate_item_ids(v_preset_ver.items),
    v_preset_ver.template_data
  )
  returning id into v_new_version;

  -- Point the template at its draft
  update templates
     set current_version_id = v_new_version
   where id = v_new_template;

  -- Audit
  insert into activity_events (template_id, actor_id, verb, payload)
  values (
    v_new_template,
    auth.uid(),
    'template.imported',
    jsonb_build_object(
      'preset_id',   p_preset_id,
      'preset_name', v_preset.name,
      'industry',    v_preset.industry
    )
  );

  return v_new_template;
end $$;
