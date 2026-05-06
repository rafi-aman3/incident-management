-- ============================================================================
-- Phase 4 — Resources RPCs (link / unlink / archive / replace)
-- ============================================================================
-- Atomic transaction boundaries for the document-link lifecycle. Server
-- actions in lib/actions/documents.ts wrap these one-to-one; the picker
-- components never call them directly.
--
-- Per plans/04-resources.md §A3 + §A6. Activity events fire on every
-- mutation so the dashboard activity feed and per-record activity tabs
-- stay accurate without per-call wiring in the server actions.
--
-- Auth model:
--   * Org-wide gate via has_org_permission('document_link:create' / etc.)
--   * Per-parent gate via can_edit_parent(parent_type, parent_id), which
--     dispatches to existing site-scoped permission checks. The incident
--     case allows the reporter to attach during draft (matches the loose
--     write policy on incident_attachments from Phase 1) and the
--     inspection case allows the inspector to attach to their own run
--     (matches the inspection_uploads RLS from Phase 3).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. can_edit_parent — polymorphic dispatch
--
--    Returns true iff the caller can edit the named parent record. Used by
--    the link / unlink RPCs. NOT a "can read" check — visibility comes from
--    the parent table's own RLS, which is independently enforced when the
--    server queries the parent before invoking the RPC.
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
begin
  if v_uid is null then return false; end if;

  case p_parent_type
    -- Incident: reporter (covers worker drafting in the wizard) OR any of
    -- the assign / close / investigation:edit perms at the incident's site.
    when 'incident' then
      select reporter_id, site_id into v_owner, v_site_id
        from incidents where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return v_owner = v_uid
          or has_permission('incident:assign',     v_site_id)
          or has_permission('incident:close',      v_site_id)
          or has_permission('investigation:edit',  v_site_id);

    -- Investigation: investigation:edit at the site.
    when 'investigation' then
      select site_id into v_site_id
        from investigations where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('investigation:edit', v_site_id);

    -- CAPA: complete (own) or reassign_verifier (any).
    when 'capa' then
      select site_id into v_site_id
        from capas where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('capa:complete',           v_site_id)
          or has_permission('capa:reassign_verifier',  v_site_id);

    -- Asset: asset:edit at the site.
    when 'asset' then
      select site_id into v_site_id
        from assets where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return has_permission('asset:edit', v_site_id);

    -- Site: site:configure on the site itself.
    when 'site' then
      return has_permission('site:configure', p_parent_id);

    -- Inspection: inspector with edit_own, OR edit_any holder at the site.
    when 'inspection' then
      select inspector_id, site_id into v_owner, v_site_id
        from inspections where id = p_parent_id and deleted_at is null;
      if not found then return false; end if;
      return (v_owner = v_uid and has_permission('inspection:edit_own', v_site_id))
          or has_permission('inspection:edit_any', v_site_id);

    -- Finding: resolve OR escalate at the inspection's site.
    when 'finding' then
      select i.site_id into v_site_id
        from inspection_findings f
        join inspections i on i.id = f.inspection_id
       where f.id = p_parent_id;
      if not found then return false; end if;
      return has_permission('finding:resolve',  v_site_id)
          or has_permission('finding:escalate', v_site_id);
  end case;

  return false;
end $$;

-- ----------------------------------------------------------------------------
-- 2. link_document_v1 — idempotent link create
--
--    Asserts:
--      * caller holds document_link:create org-wide
--      * caller can read the document (org match)
--      * caller can edit the parent (per can_edit_parent)
--    Idempotent: if a non-removed link exists for the same
--    (document_id, parent_type, parent_id, link_role), returns its id
--    without mutating. Otherwise inserts and returns the new id.
-- ----------------------------------------------------------------------------
create or replace function link_document_v1(
  p_document_id uuid,
  p_parent_type document_link_parent,
  p_parent_id   uuid,
  p_link_role   text default null
) returns uuid
  language plpgsql security invoker set search_path = public
as $$
declare
  v_doc      documents%rowtype;
  v_link_id  uuid;
  v_existing uuid;
begin
  -- 1. Org-wide perm gate
  if not has_org_permission('document_link:create') then
    raise exception 'forbidden: document_link:create required';
  end if;

  -- 2. Lock + visibility on the document
  select * into v_doc from documents
   where id = p_document_id and org_id = current_org()
   for share;
  if not found then
    raise exception 'Document % not found in current org', p_document_id;
  end if;
  if v_doc.archived_at is not null then
    raise exception 'Document % is archived', p_document_id;
  end if;

  -- 3. Per-parent edit gate
  if not can_edit_parent(p_parent_type, p_parent_id) then
    raise exception 'forbidden: cannot edit % %', p_parent_type, p_parent_id;
  end if;

  -- 4. Idempotency: existing non-removed link wins.
  --    NULL link_role distinguished from non-NULL via `is not distinct from`.
  select id into v_existing
    from document_links
   where document_id = p_document_id
     and parent_type = p_parent_type
     and parent_id   = p_parent_id
     and link_role is not distinct from p_link_role
     and removed_at is null
   limit 1;
  if found then
    return v_existing;
  end if;

  -- 5. Insert
  insert into document_links (document_id, parent_type, parent_id, link_role, created_by)
  values (p_document_id, p_parent_type, p_parent_id, p_link_role, auth.uid())
  returning id into v_link_id;

  -- 6. Audit
  insert into activity_events (document_link_id, document_id, actor_id, verb, payload)
  values (
    v_link_id,
    p_document_id,
    auth.uid(),
    'document_link.created',
    jsonb_build_object(
      'parent_type', p_parent_type,
      'parent_id',   p_parent_id,
      'link_role',   p_link_role
    )
  );

  return v_link_id;
end $$;

-- ----------------------------------------------------------------------------
-- 3. unlink_document_v1 — idempotent soft-remove
--
--    Asserts:
--      * caller holds document_link:remove org-wide
--      * caller can edit the parent (looked up via the existing link row)
--    Idempotent: re-calling on an already-removed link is a no-op.
-- ----------------------------------------------------------------------------
create or replace function unlink_document_v1(p_link_id uuid)
  returns void
  language plpgsql security invoker set search_path = public
as $$
declare
  v_link document_links%rowtype;
begin
  if not has_org_permission('document_link:remove') then
    raise exception 'forbidden: document_link:remove required';
  end if;

  select * into v_link from document_links where id = p_link_id for update;
  if not found then
    raise exception 'Link % not found', p_link_id;
  end if;

  -- Already removed → no-op (idempotent)
  if v_link.removed_at is not null then
    return;
  end if;

  -- Re-validate parent edit perm; the org may have changed roles since the
  -- link was first created.
  if not can_edit_parent(v_link.parent_type, v_link.parent_id) then
    raise exception 'forbidden: cannot edit % %', v_link.parent_type, v_link.parent_id;
  end if;

  update document_links
     set removed_at = now()
   where id = p_link_id;

  insert into activity_events (document_link_id, document_id, actor_id, verb, payload)
  values (
    p_link_id,
    v_link.document_id,
    auth.uid(),
    'document_link.removed',
    jsonb_build_object(
      'parent_type', v_link.parent_type,
      'parent_id',   v_link.parent_id,
      'link_role',   v_link.link_role
    )
  );
end $$;

-- ----------------------------------------------------------------------------
-- 4. archive_document_v1 — flag-only retire (file stays in storage)
--
--    Asserts caller holds document:archive org-wide. If the document has
--    active links and `p_force = false`, raises so the caller can prompt
--    "this is linked to N records — archive anyway?". Storage object is
--    intentionally NOT deleted — OSHA 5y / RIDDOR 3y retention.
-- ----------------------------------------------------------------------------
create or replace function archive_document_v1(
  p_document_id uuid,
  p_reason      text default null,
  p_force       boolean default false
) returns void
  language plpgsql security invoker set search_path = public
as $$
declare
  v_doc            documents%rowtype;
  v_active_links   integer;
begin
  if not has_org_permission('document:archive') then
    raise exception 'forbidden: document:archive required';
  end if;

  select * into v_doc from documents
   where id = p_document_id and org_id = current_org()
   for update;
  if not found then
    raise exception 'Document % not found in current org', p_document_id;
  end if;
  if v_doc.archived_at is not null then
    -- Idempotent
    return;
  end if;

  select count(*) into v_active_links
    from document_links
   where document_id = p_document_id and removed_at is null;

  if v_active_links > 0 and not p_force then
    raise exception
      'Document has % active link(s) — pass force=true to archive anyway',
      v_active_links;
  end if;

  update documents
     set archived_at     = now(),
         archived_reason = p_reason
   where id = p_document_id;

  insert into activity_events (document_id, actor_id, verb, payload)
  values (
    p_document_id,
    auth.uid(),
    'document.archived',
    jsonb_build_object(
      'reason',      p_reason,
      'link_count',  v_active_links,
      'forced',      p_force
    )
  );
end $$;

-- ----------------------------------------------------------------------------
-- 5. replace_document_file_v1 — overwrite-in-place
--
--    Updates storage_path / file_name / mime / size on an existing
--    document row and bumps updated_at. v1 has NO version history — the
--    prior storage object becomes orphaned in the bucket (storage delete
--    is blocked by retention policy; v1.5 GC sweeps orphans). The activity
--    event captures the prior storage_path so audit can reconstruct.
--
--    Asserts caller holds document:edit_metadata org-wide.
-- ----------------------------------------------------------------------------
create or replace function replace_document_file_v1(
  p_document_id     uuid,
  p_storage_path    text,
  p_file_name       text,
  p_mime_type       text,
  p_size_bytes      bigint
) returns void
  language plpgsql security invoker set search_path = public
as $$
declare
  v_doc            documents%rowtype;
  v_prior_path     text;
begin
  if not has_org_permission('document:edit_metadata') then
    raise exception 'forbidden: document:edit_metadata required';
  end if;

  select * into v_doc from documents
   where id = p_document_id and org_id = current_org()
   for update;
  if not found then
    raise exception 'Document % not found in current org', p_document_id;
  end if;
  if v_doc.archived_at is not null then
    raise exception 'Document % is archived — unarchive before replacing', p_document_id;
  end if;
  if p_size_bytes < 0 then
    raise exception 'size_bytes cannot be negative';
  end if;

  v_prior_path := v_doc.storage_path;

  update documents
     set storage_path = p_storage_path,
         file_name    = p_file_name,
         mime_type    = p_mime_type,
         size_bytes   = p_size_bytes,
         updated_at   = now()
   where id = p_document_id;

  insert into activity_events (document_id, actor_id, verb, payload)
  values (
    p_document_id,
    auth.uid(),
    'document.replaced',
    jsonb_build_object(
      'prior_storage_path', v_prior_path,
      'new_storage_path',   p_storage_path,
      'new_file_name',      p_file_name,
      'new_size_bytes',     p_size_bytes
    )
  );
end $$;
