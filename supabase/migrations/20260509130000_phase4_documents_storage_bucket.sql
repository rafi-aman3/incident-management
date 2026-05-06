-- ----------------------------------------------------------------------------
-- Phase 4 — `documents` private bucket + path-prefix RLS
--
-- Bucket layout: `<org_id>/<uuid>-<filename>` — first path segment is the
-- owning org. RLS uses the same shape as Phase 3's `inspection-uploads`
-- bucket and Phase 0's `incident-attachments` / `investigation-evidence`,
-- but with `current_org()` instead of a parent-row join.
--
-- Per plans/04-resources.md §A2:
--   * READ   — auth'd user whose `current_org()` matches the path prefix.
--   * INSERT — same, gated additionally on has_org_permission('document:upload').
--   * UPDATE — same, gated on has_org_permission('document:edit_metadata').
--               Used by `replace_document_file_v1` to overwrite the storage
--               object in place; documents are flat in v1 (no version row).
--   * DELETE — intentionally NO policy. Storage objects are retention-bound
--               (OSHA 5y / RIDDOR 3y); archive is a metadata flag only.
--               Replaced files become orphans in the bucket — see plans
--               Open Q2 for the v1.5 GC plan.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

create policy "documents read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and split_part(storage.objects.name, '/', 1)::uuid = current_org()
  );

create policy "documents write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(storage.objects.name, '/', 1)::uuid = current_org()
    and has_org_permission('document:upload')
  );

create policy "documents update" on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and split_part(storage.objects.name, '/', 1)::uuid = current_org()
    and has_org_permission('document:edit_metadata')
  )
  with check (
    bucket_id = 'documents'
    and split_part(storage.objects.name, '/', 1)::uuid = current_org()
    and has_org_permission('document:edit_metadata')
  );

-- No DELETE policy — storage objects are retention-bound. The
-- archive_document_v1 RPC sets documents.archived_at; the file stays.
