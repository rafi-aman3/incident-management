# Phase 4 — Smoke test

> Run before merging Phase 4 to confirm the Resources module (Assets +
> Documents) is shippable end-to-end. ~10 minutes. Re-run after any
> change that touches `/resources/*`, the document link picker, the
> asset typeahead, or any of the Phase 1/2 widgets the picker mounts on.

## Setup
1. `pnpm install`
2. `pnpm db:push` — applies all migrations through `20260509150000_phase4_resources_rpcs.sql`
3. `pnpm db:types` — regenerates `lib/supabase/types.ts`
4. `pnpm db:seed` — populates Phase 4 resources on top of the Phase 3 data:
   - 8 documents (1 per type) — including a forklift training cert with `expiry_date = today+14d`
   - 6 assets — Hyster H40 forklift, fume hood, fire extinguisher, AED, ergonomic workstation, conveyor (`unsafe`)
   - Cross-links: forklift incident → forklift asset; SDS / SOP → forklift asset & incident; SDS → first investigation; SOP → first CAPA; printable form → seeded forklift inspection; evidence photo → conveyor asset
5. `pnpm dev`

Demo accounts (password `Demo!2026`):
- `admin@demo.local` — Site Admin (Houston + Manchester, full perms)
- `ehs@demo.local`   — EHS Manager
- `supervisor@demo.local`
- `worker@demo.local` — Worker (Houston only)

## Step 1 — Sidebar nav

1. Sign in as `admin@demo.local`.
2. Confirm sidebar now lists **Assets** and **Documents** entries between Inspections and Reports.
3. Sign out, sign in as `worker@demo.local`. Both entries still visible (worker holds `asset:read_site` + `document:read_org`).

## Step 2 — Assets list

1. As `admin@demo.local` → click **Assets** → `/resources/assets`.
2. Confirm 6 assets render, grouped by site headers (Houston / Houston Building A / Manchester / Manchester North).
3. The conveyor row renders the Condition pill in **destructive red** with label "Unsafe". The Next-PM column for conveyor is red with an "overdue" hint.
4. Apply filter `?condition=unsafe` from the dropdown — only the conveyor row remains.
5. Search "forklift" in the search box — only the Hyster H40 row remains. Clear filters.

## Step 3 — Asset detail + actions

1. Click the conveyor row → `/resources/assets/<id>`.
2. Header shows kind chip (`Conveyor`), site, location, **Update condition** dropdown, **Mark inspected** button.
3. Hover the `Unsafe` chip in the dropdown → tooltip / context note about tagout + 24h escalation (RegTooltip §asset_unsafe_condition).
4. Click **Update condition → Fair**. Toast confirms; no unsafe-prompt CTA appears (transition is downgrade, not upgrade-to-unsafe).
5. Click **Update condition → Unsafe** again. Toast + a destructive alert appears: *"Asset marked unsafe — file an incident report"* with a "Report" link to `/incidents/new/1?asset=<id>&type=unsafe_condition`.
6. Click **Mark inspected** — toast "Marked inspected"; refresh the page; "Last inspected" now shows today's date.
7. Tabs: **Overview** (cards), **Incidents** (lists the seeded "Conveyor motor seizure" incident), **Inspections** (loose-joined to site), **Documents** (lists the conveyor leak photo via `link_role=photo`; "+ Add document" button opens the picker).
8. Click **Edit** in the header → asset edit form pre-fills correctly. Cancel.

## Step 4 — Documents list + filters

1. Sidebar → **Documents** → `/resources/documents`.
2. Card grid renders 8 documents. Each card shows file-type icon, type chip, scope label (site name or "Org-wide"), uploader, "Linked from N records" footer.
3. The forklift training cert card shows an **amber "Expires in 14d"** pill.
4. Toggle **Expiring ≤ 30d** filter → only the forklift training cert card remains.
5. Toggle **Cards / Table** view in the filter row — table view renders the same data with columns Name / Type / Scope / Uploaded / Expiry / Links.
6. Clear filters. Search "SOP" → SOP — Lockout/Tagout card remains.

## Step 5 — Document detail + replace + archive

1. Click the **IPA Solvent SDS** card → `/resources/documents/<id>`.
2. Header: type chip + scope ("Org-wide") + file metadata.
3. **File preview** card: PDF iframe loads (placeholder content seeded; preview must show without 404).
4. **Linked from N records** panel (right column) shows grouped sections: Incidents (1), Investigations (1), Assets (1). Each row deep-links to the parent record.
5. Click **Replace file**, pick any small PDF — toast "File replaced"; preview reloads with the new file. (Confirm via SQL that `documents.storage_path` updated and an `activity_events` row with verb `document.replaced` was written.)
6. Click **Edit metadata** → change name → save → header updates.
7. Click **Archive** → dialog warns "Document linked to 3 active record(s)" → click **Archive anyway**. Detail re-renders with archived banner; action cluster hidden.
8. Sign out + back in (or refresh the documents list) — archived doc no longer appears in the library list.

## Step 6 — Document Link Picker on the wizard

1. Sign in as `worker@demo.local`.
2. Click **Report Incident** → Step 1: pick `Property damage`, fill out fields, submit.
3. On Step 2:
   - **Equipment involved** text field is present.
   - **Linked asset** typeahead is present immediately below — focus the search box, type "forklift" → Hyster H40 row appears with condition pill. Click it → field collapses to "AST-2026-0001 · Hyster H40 Forklift" with a clear (×) button.
   - **Attachments** section: existing direct-upload widget still works.
   - **Or link from the library** panel: click **Add document** → modal opens with two tabs.
     - Library tab: pre-filtered to `type=sds`. The IPA SDS shows. Click **Link** → toast + the modal closes; the panel now lists "IPA Solvent SDS" with an `attachment` chip + unlink × button.
     - Click **Add document** again → switch to **Upload new** tab → drop a small PDF, fill name/type → click **Upload and link** → row appears in the section.
4. Submit Step 2 → Step 3 → finalize.

## Step 7 — Incident detail surfaces asset + linked docs

1. From the wizard finalize, you land on `/incidents/<id>`.
2. **Asset** card renders with the forklift's ref code + name + kind + condition. Click it → routes to the asset detail. Back.
3. **Attachments** card shows the legacy direct-upload entries (if any).
4. **Linked library documents** card shows the SDS + the new PDF you uploaded in Step 6.
5. Click "Add document" in that card → DocumentLinkPicker opens with default type filter `attachment`. Cancel.

## Step 8 — Investigation evidence + CAPA

1. Sign in as `ehs@demo.local`.
2. Open the investigation linked to one of the seeded Track-A incidents (e.g. via dashboard → recent investigation, or `/investigations` Kanban).
3. Switch to the **Evidence** tab.
4. Existing **EvidenceUploader** still uploads to `investigation-evidence` bucket and surfaces in the grid.
5. Below the grid, **Library evidence** panel: click **Add document** → pre-filter set to `evidence` type. Pick the conveyor leak photo → toast → row appears.
6. Visit `/capa/<id>` of any seeded CAPA → confirm **Evidence & references** card with the SOP linked from seed; **Add document** opens the picker.

## Step 9 — Smoke-test the polymorphic detail panel

1. Back as `admin@demo.local` → `/resources/documents/<id>` of the Lockout/Tagout SOP.
2. **Linked from N records** panel must include sections from at least 2 different parent types after the Step-7 wizard run (e.g. Incidents + CAPAs + Assets). Each link is clickable.

## Step 10 — Permissions sanity

1. As `worker@demo.local`, hit `/resources/assets/new` directly (URL bar). Page renders empty-state "no permission" message — Create Asset is gated to `asset:create` (ehs_manager + site_admin only).
2. As `worker@demo.local`, on a document detail page the Replace / Edit / Archive buttons are absent.
3. As `supervisor@demo.local`, asset edit on Houston-site asset works (supervisor holds `asset:edit`); asset delete is hidden (`asset:delete` is `site_admin` only).

## Step 11 — Console health

1. Watch the dev-server terminal during all clicks above. Expect:
   - No hydration warnings.
   - No `'use cache'` runtime errors.
   - No Storage CORS warnings.
   - No RLS-deny errors during normal navigation.
2. Reload `/resources/documents/<id>` of an image-mime-type document → preview renders an `<img>`; signed URL fetched without console errors.

## Spot-check SQL (optional, ~30s)

Run from the Supabase SQL editor / psql:

```sql
-- Phase 4 perm grants per default role
select r.key, count(*)
  from roles r
  join role_permissions rp on rp.role_id = r.id
 where r.is_default = true
   and rp.permission_key like 'asset:%' or rp.permission_key like 'document%' or rp.permission_key like 'document_link:%'
 group by r.key;

-- Active links by parent type
select parent_type, count(*) from document_links where removed_at is null group by parent_type;

-- Conveyor asset condition + last_inspected
select name, condition, last_inspected_at, next_pm_at from assets where name ilike 'Main Floor Conveyor%';

-- Forklift incident equipment_asset_id resolved
select i.ref_code, i.title, a.ref_code as asset_ref, a.name from incidents i
  left join assets a on a.id = i.equipment_asset_id
  where i.title ilike 'Forklift collision%';
```

---

If every step above passes with a clean console, Phase 4 is shippable.
