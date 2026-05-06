# Phase 4 — Resources (Assets + Documents)

**Status:** ready to start (drafted 2026-05-06, immediately after Phase 3 merge / PR #4)
**Goal:** A `site_admin` or `ehs_manager` maintains a per-site **asset registry** (forklifts, fume hoods, fire extinguishers, AEDs, conveyors, ergonomic stations…) with location / condition / last-inspected / next-PM dates, plus an org-wide **document library** (SDSs, SOPs, training certs, policies, evidence files) that polymorphically links to **incidents · investigations · CAPAs · assets · sites**. The Phase 1 thin file-upload paths (incident attachments, investigation evidence) upgrade in place to a tabbed picker — "From library" (cross-link an existing document) or "Upload new" (which now also writes a `documents` row, so every uploaded file becomes a re-linkable library item). A worker reporting a forklift incident can attach the forklift's SDS plus its maintenance log without leaving the wizard; a verifier closing a CAPA can attach the regenerated SOP from the library; an EHS manager browsing `/resources/assets/[id]` can see every incident, inspection, finding, and CAPA that ever touched that asset.
**Estimated duration:** ~1 week
**Depends on:** Phase 3 (shipped 2026-05-06, PR #4). Phase 1 thin upload (`incident-attachments` bucket + `incident_attachments` table). Phase 2 investigation evidence (`investigation-evidence` bucket + `investigation_evidence` table). RBAC resolver from Phase 0/1.

> **What this phase ships of the Resources module:**
> - Schema: `assets`, `asset_kinds` (enum), `asset_condition` (enum), `documents`, `document_type` (enum), `document_links` (polymorphic — `parent_type` enum + `parent_id` uuid). Storage bucket `documents` private with org-prefix RLS.
> - Permissions: `asset:{read_site,create,edit,delete}`, `document:{read_org,upload,edit_metadata,archive}` (verify `document:upload` already seeded by Phase 3 perms migration — this phase just grants it to the right default roles), `document_link:{create,remove}`.
> - `/resources/assets` (per-site registry table + org roll-up via site filter; columns: ref, name, kind, site, location, condition, last-inspected, next PM, SDS link).
> - `/resources/assets/new` and `/resources/assets/[id]/edit` (form: name, kind, site, location, condition, last_inspected_at, next_pm_at, linked SDS document, notes, status).
> - `/resources/assets/[id]` (asset detail with linked-incidents / linked-inspections / linked-documents / activity tabs; "Update condition" + "Mark inspected" + "Schedule PM" mini-actions).
> - `/resources/documents` (org library card or table view, filters `?type=&q=&site=&expiring=`, "Upload" CTA, expiring-soon highlight ≤ 30 days).
> - `/resources/documents/new` (upload form: file, name, type, optional site scope, expiry_date, notes; max 25 MB; PNG/JPG/PDF/DOC/DOCX/XLSX MIMEs).
> - `/resources/documents/[id]` (document detail with file preview / download, link list grouped by parent type — "Linked from 3 incidents · 1 inspection · 2 CAPAs · 4 assets", "Replace file" + "Archive" actions, edit metadata).
> - `<DocumentLinkPicker>` reusable client component — two-tab modal ("From library" + "Upload new"), used by:
>   1. `/incidents/new/1` Step-1 attachments (replaces direct upload-only widget)
>   2. `/incidents/[id]` Attachments tab "+ Add"
>   3. `/investigations/[id]` Evidence drawer "+ Add"
>   4. `/capa/[id]` Verification evidence "+ Add"
>   5. `/resources/assets/[id]` Documents tab "+ Link" (e.g., attach SDS or maintenance log)
> - Atomic RPCs:
>   1. `link_document_v1(document_id, parent_type, parent_id, link_role?)` — asserts caller has read on the document AND edit on the parent record; idempotent (no-op on dup); returns the link_id.
>   2. `unlink_document_v1(link_id)` — soft-removes the link (the document itself stays).
>   3. `archive_document_v1(document_id, reason?)` — sets `documents.archived_at`; rejects when active links exist unless `force=true`; the file stays in storage (5-y OSHA / 3-y RIDDOR retention).
> - Seed extension: 6–8 sample documents (1 per type) into UCB; 6 assets across Houston / Manchester / their child sites; backfill polymorphic links so the existing seeded forklift incident points at the forklift asset and the matching maintenance-log document; the existing seeded forklift inspection points at the same forklift asset.
> - Sidebar nav adds **Resources** as a parent group with two children (Assets, Documents). Existing entries shuffle; templates+inspections stay where they are.
> - 4 new RegTooltips (asset condition `unsafe`, document expiry, polymorphic link reuse, SDS auto-attach for chemical incidents — even though we don't auto-attach in v1, the tooltip explains the intent so the demo lands honest).
> - `docs/smoke-test-phase4.md` 10-minute walkthrough.

> **Not in this phase (deferred per IMS_PLANNING §15.4 — Phase 7 of the production roadmap):**
> - Document versioning (Draft → Review → Approved → Published → Under-revision → Retired, semver, change_summary). v1 ships flat "current file" only. Replace-file overwrites the storage object and bumps `updated_at` — there is no version history. SPEC §15 entry to log this divergence.
> - Approval workflow (`DocumentApproval` table with multi-step sign-off). Deferred.
> - E-signatures (21 CFR Part 11). Deferred.
> - Forced acknowledgement workflow (`DocumentAcknowledgement` blocking work screens). Deferred.
> - Auto-training trigger when an SOP changes. Deferred (depends on Training module — Phase 8 of IMS_PLANNING).
> - Distribution audit-trail visualization (who has read which version when). Deferred.
> - Real SDS Manager library integration (auto-attach SDS when a chemical is named in an incident — the wiring is here via `assets.sds_document_id` + the link picker, but no SDS library API call). Deferred to v2.
> - Auto-creation of inspections from `assets.next_pm_at` (cron). Deferred (same family as the recurring-inspection cron we deferred in Phase 3).
> - Migration of the existing `incident_attachments` / `investigation_evidence` rows into the new `documents` + `document_links` model. **Additive** — those tables stay; new uploads from the upgraded picker write to **both** the legacy table (so existing list views keep rendering) **and** the new documents library. SPEC §15 entry to log this dual-write decision; cleanup tracked as v1.5.

---

## Definition of done

A stakeholder dropping in unannounced after Phase 4 sees:

1. **Sidebar updates.** "Resources" group appears below Inspections with two children: Assets, Documents. Visible iff the user holds `asset:read_site` OR `document:read_org`. Workers see Documents only (read perm) but not the Assets entry (workers don't manage the registry — they consume it via the link picker). Supervisors / EHS managers / site admins see both.
2. **Assets list renders.** Sign in as `admin@demo.local` → `/resources/assets` → table grouped by site (sticky site headers) with seeded rows: 6 assets across Houston + Manchester. Columns: Ref code (`AST-2026-0001`), Name, Kind chip (Forklift / Fume hood / Fire extinguisher / AED / Conveyor / Ergonomic station), Location, Condition pill (Excellent / Good / Fair / Poor / **Unsafe** in red), Last inspected (relative time), Next PM (relative time, red when overdue), Linked SDS (icon link or em-dash). Filters: `?site=&kind=&condition=&q=`. "+ New asset" button (gated `asset:create`). Empty-state CTA: "Add your first asset".
3. **Asset create / edit work.** `/resources/assets/new` form: Name (req), Kind (select), Site (select scoped by user's `site_members`), Location (free text), Condition (default `good`), Last inspected (date — optional), Next PM (date — optional), Linked SDS (`<DocumentLinkPicker type=sds>`), Notes (textarea), Status (active / retired). Submit → `createAsset(...)` writes the row → routes to `/resources/assets/[id]`. Editing reuses the same form on `/resources/assets/[id]/edit`.
4. **Asset detail end-to-end.** `/resources/assets/[id]` — header card (name, kind chip, site, condition pill, "Update condition" inline-edit popover); 4 tabs: **Overview** (location, last-inspected, next-PM countdown, SDS preview, notes, recent activity), **Incidents** (cross-link list — every incident with `equipment_asset_id = this`), **Inspections** (every inspection that ran against a template assigned to this asset's site AND mentioned the asset — for v1, joined via the inspection's `site_id` + the template's `industry`; for the demo we explicitly link via the seeded inspection metadata), **Documents** (link list — SDS, maintenance logs, photos — via `document_links` where `parent_type='asset' AND parent_id=this`). "+ Link document" button opens `<DocumentLinkPicker>`. "Mark inspected" button records `last_inspected_at = now()` + writes an `activity_events` row.
5. **Documents list renders.** Sign in as `ehs@demo.local` → `/resources/documents` → org library. Card grid (default) or table (`?view=table`). Each card: file-type icon + name, type chip (SDS / SOP / Policy / Training / Form / Evidence / Report / Other), site scope (or "Org-wide"), uploader avatar, expiry pill (red ≤ 30 d, gray otherwise, hidden if no expiry), "Linked from N records" footer. Filters: `?type=&site=&q=&expiring=true`. Sort: `?sort=updated_at&dir=desc` (default). "+ Upload" button.
6. **Document upload works.** `/resources/documents/new` — file picker (drag-drop or click), name (auto-fills from filename, editable), type (select), site scope (defaults org-wide), expiry date (optional), notes. Submit → uploads file to `documents/<org_id>/<uuid>-<filename>` → calls `createDocument(...)` server action → writes `documents` row → routes to `/resources/documents/[id]`. Max 25 MB; allowed MIMEs: `image/png`, `image/jpeg`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.ms-excel`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Rejected files surface a Zod fieldError.
7. **Document detail + link panel.** `/resources/documents/[id]` — header card (name, type chip, file metadata, uploaded-by, expiry countdown, archived badge if applicable), file preview (PDF iframe; image inline; other types render a download CTA), link list grouped by parent type with counts in the section header (e.g., "Linked from 3 incidents · 1 inspection · 2 CAPAs · 4 assets"). Each row is a deep-link to the parent record. Buttons: "Replace file" (re-upload, overwrites storage object, bumps `updated_at`), "Edit metadata", "Archive" (gated `document:archive`; rejects when active links exist unless user confirms force-archive in dialog).
8. **Polymorphic link picker works.** `<DocumentLinkPicker>` modal: tab 1 "From library" — table of org documents filterable by type + search, "Link" CTA per row → `link_document_v1(...)` RPC → toast + closes. Tab 2 "Upload new" — file picker + minimal metadata fields → uploads, creates the document, immediately calls `link_document_v1(...)`. Picker is mounted in 5 contexts (per §scope) and respects each parent's edit permission (rejects with toast when missing). Default `type` filter pre-applied based on context (e.g., asset-tab opens with `type=sds`; CAPA evidence opens with `type=evidence`).
9. **Phase 1 / 2 widgets upgraded in place.** `/incidents/new/1` Step-1 attachments now opens `<DocumentLinkPicker>` instead of a raw file input; uploaded files become BOTH `incident_attachments` rows (legacy, keeps the existing list view rendering) AND `documents` + `document_links` rows (so they appear in the library and re-link from elsewhere). Same dual-write on `/incidents/[id]` Attachments tab and `/investigations/[id]` Evidence drawer. `/capa/[id]` verification evidence flips to documents-only (no legacy table for CAPA evidence existed).
10. **Cross-link from incident to asset works.** `/incidents/new/2` (Step 2 — type-conditional fields) for `property_damage` already collects `equipment_name` (sparse column). Phase 4 adds an optional `equipment_asset_id` lookup: a typeahead listing assets at the incident's site, with "+ Add new asset" inline. When set, the incident-detail page renders an "Asset" card linking back to `/resources/assets/[id]`, and the asset's Incidents tab shows this incident.
11. **Activity events fire.** Every asset / document / link mutation writes an `activity_events` row (verbs: `asset.created`, `asset.condition_updated`, `asset.inspected`, `document.uploaded`, `document.replaced`, `document.archived`, `document_link.created`, `document_link.removed`). Surface in the dashboard activity feed + each parent record's activity tab.
12. **Permissions enforced at all 3 layers.** Sidebar entries hidden when missing read perm. Server actions reject when user lacks the relevant key. RLS denies cross-org SELECT on `documents` (org-scoped) and cross-site SELECT on `assets` (site-scoped via `site_members`). The 4 default seeded roles get the perm bundle from §A4. Storage RLS enforces org-prefix on the `documents` bucket.
13. **Demo data populated.** `scripts/seed.ts` extension creates: 6 assets (forklift Houston, fume hood Manchester, fire extinguisher Houston-warehouse, AED Manchester-office, ergonomic station Manchester, conveyor Houston-floor); 8 documents (1 per type — 1 SDS, 1 SOP, 1 policy, 1 training cert, 1 form template, 1 evidence photo, 1 audit report, 1 misc); polymorphic links wiring the existing forklift incident → forklift asset + maintenance log document, the seeded forklift inspection → forklift asset, the seeded CAPA → SOP document.
14. **4 new RegTooltips render.** (1) Asset Condition `unsafe` chip → "Unsafe assets must be tagged out and reported as an unsafe-condition incident — managers should escalate within 24 h." (2) Document expiry pill → "Documents past expiry are still retained per OSHA's 5-year and RIDDOR's 3-year rules — retire them via Archive, never hard-delete." (3) Library row "Linked from N records" → "A single document can attach to many records — replacing the file updates every link at once." (4) Incident Step-1 attachments tooltip on the "From library" tab → "Re-using a library file beats re-uploading: every incident, investigation, and CAPA that referenced this file now points at the same source of truth."
15. **`pnpm dev` console clean.** No hydration warnings, no `'use cache'` errors, no Cache Components runtime errors, no Storage CORS warnings, no RLS noise.
16. **Smoke test passes** per `docs/smoke-test-phase4.md`.

Phase 4 explicitly does **not** include: document versioning + approval + e-signatures + forced ack (Phase 7 of IMS_PLANNING — v2); auto-training trigger on SOP version change; distribution audit-trail visualization; real SDS Manager API integration; PM-cron auto-creation of inspections; migration of legacy `incident_attachments` / `investigation_evidence` rows (additive dual-write only); Planner (Phase 5).

---

## Task list (ordered)

### A. Schema deltas + RBAC additions

#### 1. Migration: `phase4_resources_schema`

```sql
-- Enums
create type asset_kind as enum (
  'forklift','fume_hood','fire_extinguisher','aed','conveyor',
  'ergonomic_station','machine_guard','press','crane','vehicle',
  'eyewash_station','spill_kit','safety_shower','generator','other'
);
create type asset_condition as enum ('excellent','good','fair','poor','unsafe');
create type asset_status    as enum ('active','retired');

create type document_type as enum (
  'sds','sop','policy','training_cert','form','evidence','audit_report','other'
);

create type document_link_parent as enum (
  'incident','investigation','capa','asset','site','inspection','finding'
);

-- ---------------------------------------------------------------------------
-- assets — per-site operational asset registry
-- ---------------------------------------------------------------------------
create table assets (
  id                 uuid primary key default gen_random_uuid(),
  ref_code           text not null unique,                                -- AST-2026-0001
  org_id             uuid not null references orgs(id) on delete cascade,
  site_id            uuid not null references sites(id) on delete restrict,
  name               text not null,
  kind               asset_kind not null,
  location           text,                                                 -- free text — "Bay 3, Aisle A"
  condition          asset_condition not null default 'good',
  status             asset_status not null default 'active',
  last_inspected_at  timestamptz,
  next_pm_at         timestamptz,
  sds_document_id    uuid references documents(id) on delete set null,    -- forward-declared; FK added after documents table
  notes              text,
  created_by         uuid references profiles(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz                                           -- soft-delete only
);
create index on assets(site_id, status) where deleted_at is null;
create index on assets(org_id, kind)    where deleted_at is null;
create index on assets(next_pm_at)      where deleted_at is null and status = 'active' and next_pm_at is not null;

-- ---------------------------------------------------------------------------
-- documents — org-wide library, flat (no versions in v1)
-- ---------------------------------------------------------------------------
create table documents (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  site_id         uuid references sites(id) on delete set null,            -- NULL = org-wide
  name            text not null,
  type            document_type not null,
  storage_path    text not null,                                            -- "<org_id>/<uuid>-<filename>"
  file_name       text not null,
  mime_type       text not null,
  size_bytes      bigint not null,
  expiry_date     date,                                                     -- nullable; UI flags ≤ 30 d
  notes           text,
  uploaded_by     uuid references profiles(id) on delete set null,
  uploaded_at     timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  archived_at     timestamptz,
  archived_reason text
);
create index on documents(org_id) where archived_at is null;
create index on documents(org_id, type) where archived_at is null;
create index on documents(expiry_date) where archived_at is null and expiry_date is not null;

-- Now wire the deferred FK
alter table assets
  add constraint assets_sds_document_fk
  foreign key (sds_document_id) references documents(id) on delete set null;

-- ---------------------------------------------------------------------------
-- document_links — polymorphic typed-pair (parent_type enum + parent_id uuid)
-- ---------------------------------------------------------------------------
create table document_links (
  id           uuid primary key default gen_random_uuid(),
  document_id  uuid not null references documents(id) on delete cascade,
  parent_type  document_link_parent not null,
  parent_id    uuid not null,
  link_role    text,                                                        -- optional context tag e.g. 'sds','attachment','evidence','sop'
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  removed_at   timestamptz,                                                 -- soft-remove only
  unique (document_id, parent_type, parent_id, link_role)
);
create index on document_links(document_id) where removed_at is null;
create index on document_links(parent_type, parent_id) where removed_at is null;

-- ---------------------------------------------------------------------------
-- incidents.equipment_asset_id — soft FK from incidents to assets
-- (sparse — only set for property_damage / unsafe_condition incidents that
--  pin to a specific asset)
-- ---------------------------------------------------------------------------
alter table incidents
  add column equipment_asset_id uuid references assets(id) on delete set null;
create index on incidents(equipment_asset_id) where equipment_asset_id is not null;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table assets         enable row level security;
alter table documents      enable row level security;
alter table document_links enable row level security;

-- Assets: site-scoped (via site_members + include_children inheritance from existing helper)
create policy assets_read on assets for select to authenticated
  using (org_id = current_org() and user_can_access_site(site_id));

create policy assets_write on assets for all to authenticated
  using (org_id = current_org() and user_can_access_site(site_id))
  with check (org_id = current_org() and user_can_access_site(site_id));
-- Server actions enforce the create/edit/delete keys; RLS just keeps cross-org / cross-site reads out.

-- Documents: org-scoped (anyone in the org can see anything; type/site filters live in queries, not RLS)
create policy documents_read on documents for select to authenticated
  using (org_id = current_org());

create policy documents_write on documents for all to authenticated
  using (org_id = current_org())
  with check (org_id = current_org());
-- Server actions enforce upload/edit/archive perms.

-- Document links: visible iff the user can see the document AND the parent
-- (we're not double-policing the parent at RLS — the per-parent table's RLS already
--  handles that, so we let document_links be readable when document is readable).
create policy document_links_read on document_links for select to authenticated
  using (exists (
    select 1 from documents d where d.id = document_links.document_id and d.org_id = current_org()
  ));

create policy document_links_write on document_links for all to authenticated
  using (exists (
    select 1 from documents d where d.id = document_links.document_id and d.org_id = current_org()
  ))
  with check (exists (
    select 1 from documents d where d.id = document_links.document_id and d.org_id = current_org()
  ));
```

#### 2. Migration: `phase4_documents_storage_bucket`

```sql
-- Private bucket
insert into storage.buckets (id, name, public)
values ('documents','documents',false)
on conflict (id) do nothing;

-- READ: any authenticated user whose org matches the path prefix
create policy "documents read" on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1)::uuid = current_org()
  );

-- INSERT: requires document:upload on the user's org (caller's profile.org_id)
create policy "documents write" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and split_part(name, '/', 1)::uuid = current_org()
    and has_org_permission('document:upload')
  );

-- UPDATE (replace-file path): same as write
create policy "documents update" on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and split_part(name, '/', 1)::uuid = current_org()
    and has_org_permission('document:edit_metadata')
  );

-- DELETE: blocked at storage layer for retention; archive is a metadata flag.
-- (The migration explicitly creates NO delete policy.)
```

The Phase 3 `inspection-uploads` bucket policy template is the reference shape.

#### 3. Migration: `phase4_resources_rpcs`

Atomic Postgres functions (mirror Phase 3's RPC-wrap-multi-row-write pattern):

1. **`link_document_v1(document_id uuid, parent_type document_link_parent, parent_id uuid, link_role text default null)`**
   - Asserts caller has `document:read_org` on the document's org.
   - Asserts caller can edit the parent (per-type dispatch — see §A6 helper `can_edit_parent`).
   - Idempotent: if a non-removed link already exists with the same `(document_id, parent_type, parent_id, link_role)`, returns its id. Else inserts.
   - Writes `activity_events { verb: 'document_link.created', payload: { document_id, parent_type, parent_id, link_role } }`.
   - Returns `{ link_id }`.

2. **`unlink_document_v1(link_id uuid)`**
   - Asserts caller can edit the parent.
   - Sets `removed_at = now()`. Idempotent.
   - Writes `activity_events { verb: 'document_link.removed', ... }`.

3. **`archive_document_v1(document_id uuid, reason text default null, force boolean default false)`**
   - Asserts caller has `document:archive` on the document's org.
   - Counts active links (`removed_at is null`). If `count > 0 and not force`, raises `'document has active links — pass force=true to archive anyway'`.
   - Sets `archived_at = now()`, `archived_reason = reason`.
   - Writes `activity_events { verb: 'document.archived', payload: { document_id, reason, link_count } }`.

4. **`replace_document_file_v1(document_id uuid, new_storage_path text, new_file_name text, new_mime text, new_size_bytes bigint)`**
   - Asserts caller has `document:edit_metadata` on the document's org.
   - Updates the row (in-place — no version row created in v1) and bumps `updated_at`.
   - Writes `activity_events { verb: 'document.replaced', payload: { document_id, prior_storage_path } }`.
   - **Note:** the storage-object cleanup of the prior file is NOT done here (storage delete is blocked by retention rules). The prior storage_path becomes orphaned in the bucket — accepted trade-off; tracked in §Open questions.

#### 4. Migration: `phase4_resources_permissions_seed`

Add the perm keys + grants. Idempotent inserts via `on conflict do nothing`, then loop existing orgs and grant per matching default-role row:

| Key | Worker | Supervisor | EHS Manager | Site Admin |
|---|---|---|---|---|
| `asset:read_site`        | ✓ | ✓ | ✓ | ✓ |
| `asset:create`           |   |   | ✓ | ✓ |
| `asset:edit`             |   | ✓ | ✓ | ✓ |
| `asset:delete`           |   |   |   | ✓ |
| `document:read_org`      | ✓ | ✓ | ✓ | ✓ |
| `document:upload`        | ✓ | ✓ | ✓ | ✓ |
| `document:edit_metadata` |   |   | ✓ | ✓ |
| `document:archive`       |   |   | ✓ | ✓ |
| `document_link:create`   | ✓ | ✓ | ✓ | ✓ |
| `document_link:remove`   |   | ✓ | ✓ | ✓ |

(`document:upload` was added to the registry in Phase 3 but never granted to default roles — verify and grant if missing. `asset:manage` similarly seeded as a placeholder; this phase splits it into the four CRUD keys above and removes the placeholder via `delete from permissions where key = 'asset:manage'`.)

Add the keys to `lib/rbac/permissions.ts` const enum; remove `asset:manage` and `document:upload` is already there — leave as-is.

#### 5. Migration: `phase4_link_legacy_attachments_view`

A read-only view `attachments_unified` for the dashboard activity feed and audit exports — UNIONs:
- `incident_attachments` rows projected to `(parent_type='incident', parent_id, file_name, storage_path, uploaded_at, ...)`,
- `investigation_evidence` rows projected to `(parent_type='investigation', ...)`,
- `document_links` joined to `documents` projected to `(parent_type, parent_id, ...)`.

Lets the activity feed render legacy + new uploads identically without forcing the data migration. View is read-only; does not affect writes.

#### 6. Helper: `can_edit_parent(parent_type document_link_parent, parent_id uuid) returns boolean`

Server-side helper (in a new migration alongside the RPCs) that dispatches per `parent_type` to the existing per-table edit perms:
- `incident` → `incident:assign` OR `incident:close` on the incident's site
- `investigation` → `investigation:edit` on the site
- `capa` → `capa:complete` (own) OR `capa:reassign_verifier` (any) on the site
- `asset` → `asset:edit` on the site
- `site` → `site:configure` on the site
- `inspection` → `inspection:edit_own` (own) OR `inspection:edit_any` on the site
- `finding` → `finding:resolve` OR `finding:escalate` on the site

Used by `link_document_v1` + `unlink_document_v1` for one-place permission resolution.

### B. Document upload primitives

#### 7. `lib/documents/upload.ts`

```ts
export async function uploadDocumentFile(
  file: File,
  orgId: string,
): Promise<{ storage_path: string; size_bytes: number; mime_type: string }> { ... }
```

Client-side helper using Supabase signed-URL upload to `documents/<org_id>/<uuid>-<filename>`. Validates MIME + size before upload. Throws on quota or 413.

#### 8. `lib/documents/types.ts`

`DOCUMENT_TYPES`, `ASSET_KINDS`, `ASSET_CONDITIONS` const arrays + Zod schemas + label/icon maps for chips.

### C. `<DocumentLinkPicker>` reusable modal

#### 9. `components/documents/DocumentLinkPicker.tsx`

Client component. Props: `parent_type`, `parent_id`, `default_link_role?`, `default_type_filter?`, `multi?` (default false), `onLinked: (link) => void`.

Shape:
- Trigger button (composable; consumer provides via `<DocumentLinkPicker.Trigger>` or a `trigger` prop).
- Modal opens with two tabs.
- **From library** tab: search input, type filter (default = `default_type_filter`), table of org documents with "Link" CTA per row → `link_document_v1(...)` → toast "Linked".
- **Upload new** tab: minimal form (file, name, type, expiry?) → uploads via `uploadDocumentFile()` → calls `createDocument()` → calls `link_document_v1()` → routes to the parent (or stays in-modal if `multi`).
- Loading + error states inline; no nested modals.

Accessibility: focus traps inside modal; `Esc` closes; restored to trigger.

### D. Server actions

#### 10. `lib/actions/documents.ts`

- `createDocument(input)` — Zod-validates; writes `documents` row.
- `replaceDocumentFile(documentId, newFile)` — re-uploads + wraps `replace_document_file_v1`.
- `updateDocumentMetadata(documentId, fields)` — Zod-validates name / type / site / expiry / notes; perm `document:edit_metadata`.
- `archiveDocument(documentId, reason?, force=false)` — wraps `archive_document_v1`.
- `linkDocument(documentId, parentType, parentId, linkRole?)` — wraps `link_document_v1`.
- `unlinkDocument(linkId)` — wraps `unlink_document_v1`.

#### 11. `lib/actions/assets.ts`

- `createAsset(input)` — Zod-validates; perm `asset:create`; assigns `ref_code` via the same `gen_ref_code('AST')` helper Phase 1 / 3 used.
- `updateAsset(assetId, fields)` — perm `asset:edit`.
- `markAssetInspected(assetId, atTimestamp?)` — sets `last_inspected_at`; activity event `asset.inspected`.
- `updateAssetCondition(assetId, condition)` — sets condition; activity event `asset.condition_updated`. Worker note: when condition transitions to `unsafe`, the action returns a payload nudging the caller to open the Report Wizard pre-filled with `type=unsafe_condition` + `equipment_asset_id=this`. The `<ConditionUpdater>` UI shows that secondary CTA.
- `deleteAsset(assetId)` — soft-delete; perm `asset:delete`.

### E. Pages

#### 12. `/resources/assets/page.tsx`

Site-grouped table. URL state `?site=&kind=&condition=&q=&page=`. Header buttons: "+ New asset" + filter chips. Empty state with CTA.

#### 13. `/resources/assets/new/page.tsx` + `/resources/assets/[id]/edit/page.tsx`

Shared `<AssetForm>` server component. RHF + Zod + useActionState; `<DocumentLinkPicker default_type_filter="sds">` for the Linked SDS field.

#### 14. `/resources/assets/[id]/page.tsx` + `<AssetDetailTabs>`

4-tab layout: Overview / Incidents / Inspections / Documents. URL state `?tab=`.

#### 15. `/resources/documents/page.tsx`

Card-grid (default) or table (`?view=table`). Filters: `?type=&site=&q=&expiring=true&page=`. Empty-state CTA "Upload your first document".

#### 16. `/resources/documents/new/page.tsx`

Upload form. Handles drag-drop + file picker. Submit calls `createDocument`.

#### 17. `/resources/documents/[id]/page.tsx`

File preview (PDF iframe, image inline, otherwise download CTA). Link list grouped by parent type. Buttons: Replace file, Edit metadata, Archive.

### F. Phase 1 / 2 widget upgrade in place

#### 18. `/incidents/new/1` Step-1 attachments

Replace the existing direct file input with `<DocumentLinkPicker parent_type="incident" parent_id={draftId} default_type_filter="evidence" multi>`. Dual-write: the server action that handles "Upload new" writes `documents` + `document_links` AND inserts an `incident_attachments` row pointing at the same storage path (re-using the legacy bucket path? — no, the new path lives in the `documents` bucket; the legacy table just records the path so the Phase 1 list view keeps rendering). See §A5 for the unified view.

#### 19. `/incidents/[id]` Attachments tab + `/investigations/[id]` Evidence drawer

Same swap — picker replaces direct upload. Existing list view reads from the unified view.

#### 20. `/capa/[id]` verification evidence

Picker only writes to `documents` + `document_links` (no legacy capa-evidence table — historical CAPAs in the seed get backfilled to the new model in §G).

#### 21. `/incidents/new/2` property-damage / unsafe-condition Step

Add `equipment_asset_id` typeahead alongside the existing `equipment_name` text field. Typeahead queries `/api/assets/search?siteId=&q=` (server route — no separate API for now, can be a server action). "+ Add new asset" inline opens an asset-create dialog.

### G. Sidebar nav + tooltips

#### 22. `nav-config.ts`

Replace the flat list with a grouped structure (the Phase 3 list stays flat; Resources is the first group). Group label "Resources" with two children:

```ts
{ groupLabel: "Resources",
  permission: ["asset:read_site","document:read_org"],   // visible iff user holds either
  items: [
    { href: "/resources/assets",    label: "Assets",    icon: Boxes,    permission: "asset:read_site" },
    { href: "/resources/documents", label: "Documents", icon: Files,    permission: "document:read_org" },
  ]
}
```

Insert between `/inspections` and `/reports`. Update `<AppSidebar>` to render groups (collapsible parent section).

#### 23. RegTooltips

Append the 4 new entries (per §Definition-of-done item 14) to `docs/onboarding.md` §8. Total moves from 23 → 27.

### H. Seed extension + smoke test

#### 24. `scripts/seed.ts`

After Phase 3 seed:
- Insert 8 documents into UCB (1 of each type). Real PDFs not needed — small dummy text files in the bucket are fine for the demo (the file-preview path is wired but the demo doesn't pretend the SDS is a real chemical record).
- Insert 6 assets across Houston / Manchester / their child sites (forklift Houston-floor, fume hood Manchester-lab, fire extinguisher Houston-warehouse, AED Manchester-office, ergonomic station Manchester-office, conveyor Houston-floor).
- Backfill: link the existing seeded forklift incident → forklift asset (`incidents.equipment_asset_id`), link the SDS document → forklift asset (`document_links` parent_type=asset), link the maintenance log → forklift asset, link the SDS → the seeded forklift incident, link the SOP → the seeded CAPA, link an evidence photo → the seeded investigation. Idempotent (skip if already present).
- Set 1 document's `expiry_date` to 14 days from now so the "expiring soon" filter returns a hit.
- Set 1 asset's condition to `unsafe` (the conveyor) so the unsafe-condition tooltip + workflow CTA renders without the demo presenter having to manually change it.

#### 25. `docs/smoke-test-phase4.md`

10-minute walkthrough:
1. Sign in as `admin@demo.local` → sidebar shows "Resources" group with Assets + Documents.
2. `/resources/assets` → table grouped by site, 6 rows, conveyor renders red `unsafe` chip.
3. Click conveyor → asset detail → 4 tabs render → click condition `unsafe` chip → see RegTooltip 1.
4. "+ New asset" → fill form → submit → routes to detail.
5. On the new asset, "+ Link document" → DocumentLinkPicker opens → tab "From library" lists 8 documents → search for "SDS" → "Link" → toast → asset's Documents tab shows the row.
6. `/resources/documents` → 8 cards → click `?expiring=true` filter → 1 card (the one with 14-d expiry) renders → tooltip 2 hover.
7. "+ Upload" → drop a small PDF → fill metadata → submit → routes to detail.
8. Document detail → "Linked from N records" footer → click expand → see grouped link list.
9. Sign in as `worker@demo.local` → `/incidents/new/1` → on Step 1, attachments widget = DocumentLinkPicker → tab "From library" → pick the SDS → submit Step 1 → confirm both `incident_attachments` and `documents`+`document_links` rows wrote (SQL spot-check).
10. On `/incidents/new/2` → equipment typeahead → pick Conveyor → submit → finalize wizard → `/incidents/[id]` shows Asset card linking to `/resources/assets/[id]`.
11. Sign in as `ehs@demo.local` → `/investigations/[id]` of the existing seeded forklift investigation → Evidence drawer "+ Add" → DocumentLinkPicker → upload a new photo → confirm document appears in `/resources/documents` library.
12. `/capa/[id]` → verification evidence "+ Add" → upload a SOP → verify document.
13. SQL spot-check: `select * from document_links where parent_type='asset' and parent_id=<conveyor>` returns the seeded links.
14. `/resources/documents/[id]` of the SDS → click "Archive" → confirm dialog warns about active links → cancel → click again with "force" → archived badge renders.
15. Console clean.

### I. Wrap

#### 26. CLAUDE.md status bump

Append the build-status paragraph: "Phase 4 merged via PR #5 (date) — Resources module shipped. Per-site asset registry + org-wide document library; polymorphic `document_links` (incident · investigation · capa · asset · site · inspection · finding); reusable `<DocumentLinkPicker>` mounted in 5 contexts; Phase 1 / 2 file uploads upgraded to library-or-upload (legacy `incident_attachments` / `investigation_evidence` kept for back-compat via dual-write through the `attachments_unified` view); `documents` private bucket with org-prefix RLS; 4 atomic RPCs (`link_document_v1`, `unlink_document_v1`, `archive_document_v1`, `replace_document_file_v1`); `incidents.equipment_asset_id` + asset typeahead in Wizard Step 2 for property-damage / unsafe-condition. **No document versioning, approvals, e-signatures, or forced ack — all deferred to Phase 7 of IMS_PLANNING (v2).** Seed extends with 6 assets + 8 documents + cross-link backfill so the demo lands populated. Smoke-test guide at `docs/smoke-test-phase4.md`. **Phase 5 next: Planner — unified read-only calendar.**"

#### 27. SPEC.md updates

Append three §15 entries:
- "Phase 4 ships flat documents (no versioning) — deferred Document Control deep features (versioning, approvals, e-signatures, forced ack, distribution audit-trail viz) to Phase 7 of IMS_PLANNING per its 15-phase roadmap. v1 demo doesn't sell those features."
- "Phase 4 keeps `incident_attachments` + `investigation_evidence` as legacy back-compat tables; new uploads dual-write to the new `documents` + `document_links` model AND to the legacy table so existing list views render unchanged. The `attachments_unified` view UNIONs both. Cleanup tracked as v1.5."
- "Phase 4 polymorphic link parent enum spans 7 types: incident · investigation · capa · asset · site · inspection · finding. `inspection` and `finding` are deliberately included — the seeded inspection finding gallery now sources via `document_links` instead of (or alongside) `inspection_uploads`."

Bump §13 phase-mapping prose if useful (Phase 4 row already exists in ui-flow §13; just confirm scope rows still match).

#### 28. PR

Per `.claude/rules/github-workflow.md`: branch `feat/phase-4-resources`, PR title `feat: phase 4 — resources (assets + documents)`. Squash to a single commit on merge. Conventional Commits.

---

## Open questions (raise before code)

1. **Documents bucket vs. shared with incident/investigation buckets.** New bucket `documents` is the cleanest path. Existing `incident-attachments` and `investigation-evidence` buckets stay for the legacy dual-write target. Confirm OK vs. consolidating into a single `documents` bucket and deprecating the others — that would require a real data migration job and is out of scope for v1.
2. **Storage cleanup of replaced files.** The `replace_document_file_v1` RPC leaves the prior storage object orphaned in the bucket (storage delete is blocked by retention rules — OSHA 5y / RIDDOR 3y). Plan: accept as-is for v1, run a scheduled GC job at the v1.5 stage that copies orphans to a cold-storage prefix and revokes their RLS once the retention window passes. Confirm OK.
3. **Asset PM cron.** PRD §15.2 wants daily PM-due notifications + auto-creation of inspections from `assets.next_pm_at`. Plan: NOT in Phase 4. Asset row carries the date; the dashboard activity feed and `/resources/assets` "Next PM" column surface it. Cron deferred to the same family as the Phase-3-deferred recurring-inspection cron. Confirm.
4. **SDS Manager API integration.** The `assets.sds_document_id` field exists, the link picker filters for `type=sds`, the chemical-incident wiring is ready. But **no real SDS Manager library API call** in v1 — the demo seeds dummy SDS PDFs into the documents bucket. Confirm we don't fake an integration.
5. **Document version tracking — really nothing in v1?** Confirm: no version row, no change_summary, no approver. Replace-file mutates the row in place + bumps `updated_at`. Audit-only signal is the `document.replaced` activity event. v2 = full Phase 7 of IMS_PLANNING.
6. **`equipment_asset_id` on every incident type or just property-damage / unsafe-condition?** Plan: nullable on the `incidents` table; surfaced in the wizard only for `property_damage` and `unsafe_condition` (matches the existing sparse-column pattern from Phase 1). Other types ignore it.
7. **Per-site documents vs. org-wide.** `documents.site_id` is nullable; NULL = org-wide visible to every member; non-NULL = site-scoped (still visible to org members, but flagged in UI as "Houston only"). RLS keeps it org-scoped only — the site filter is UI-side. Confirm vs. enforcing site-scope at RLS.
8. **DocumentLinkPicker parent edit-perm dispatch.** A central `can_edit_parent` SQL helper does the perm dispatch per `parent_type`. Alternatively, the client picker could call per-context server actions and skip the central dispatch. Plan: central dispatch wins (one place to change rules, RPC stays atomic). Confirm.
9. **Backfill of legacy attachments into `documents`?** Plan: NO — additive dual-write only for new uploads. The old rows stay in `incident_attachments` / `investigation_evidence`; the unified view UNIONs them. Migration to a single source of truth is a v1.5 task. Confirm vs. one-shot backfill in this phase (cost: more migration code + risk to existing demo data; benefit: single source of truth from day 1).
10. **Asset image / photo as a document?** A forklift asset card looks better with a photo. Plan: use `document_links` with `link_role='photo'` to attach a `type=evidence` (or new `type=asset_photo`) document. Confirm vs. adding a `assets.photo_url` denormalized field. (`document_links` reuse is the more consistent answer — but the asset detail page needs to render the linked photo as a hero image without a click. UI footnote in the detail-page task.)
