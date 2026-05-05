-- ============================================================================
-- Phase 1 — sandbox RLS hardening + incident_attachments table
-- ============================================================================
-- 1) Sandbox visibility per docs/onboarding.md §8.4: sandbox incidents are
--    visible only to (a) the reporter and (b) site admins (anyone with the
--    site:configure permission). Hidden from everyone else so practice
--    reports don't leak into other workers' lists.
--
-- 2) incident_attachments — metadata for files uploaded to the existing
--    incident-attachments bucket. The bucket RLS (path-prefix on
--    <incident_id>/...) was wired in Phase 0; this table just records the
--    pointer + uploader + size so the detail page can list them. Full
--    Documents library UI lands in Phase 5.
-- ============================================================================

-- Drop and recreate the incidents read policy with sandbox visibility
drop policy if exists incidents_read on incidents;
create policy incidents_read on incidents for select to authenticated
  using (
    org_id = current_org()
    and (
      -- Always visible to the reporter (own drafts + own classifications)
      reporter_id = auth.uid()
      or (
        deleted_at is null
        and user_can_access_site(site_id)
        and (
          -- Sandbox rows hidden from non-reporter / non-admin
          is_sandbox = false
          or has_permission('site:configure', site_id)
        )
      )
    )
  );

-- ----------------------------------------------------------------------------
-- incident_attachments
-- ----------------------------------------------------------------------------
create table if not exists incident_attachments (
  id            uuid primary key default gen_random_uuid(),
  incident_id   uuid not null references incidents(id) on delete cascade,
  storage_path  text not null,
  file_name     text not null,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now()
);
create index if not exists incident_attachments_incident_idx
  on incident_attachments(incident_id);

alter table incident_attachments enable row level security;

create policy incident_attachments_read on incident_attachments for select to authenticated
  using (
    exists (
      select 1 from incidents i
      where i.id = incident_attachments.incident_id
        and i.org_id = current_org()
        and (
          i.reporter_id = auth.uid()
          or (
            user_can_access_site(i.site_id)
            and (i.is_sandbox = false or has_permission('site:configure', i.site_id))
          )
        )
    )
  );

create policy incident_attachments_insert on incident_attachments for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from incidents i
      where i.id = incident_attachments.incident_id
        and i.org_id = current_org()
        and user_can_access_site(i.site_id)
    )
  );

create policy incident_attachments_delete on incident_attachments for delete to authenticated
  using (
    uploaded_by = auth.uid()
    or exists (
      select 1 from incidents i
      where i.id = incident_attachments.incident_id
        and has_permission('site:configure', i.site_id)
    )
  );
