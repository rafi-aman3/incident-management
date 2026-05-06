# Phase 3 — Smoke test

> Run this before merging Phase 3 to confirm the templates + inspections
> module is shippable end-to-end. ~15 minutes. Re-run after any change
> that touches `/templates`, `/inspections`, the editor, or the runner.

## Setup
1. `pnpm install`
2. `pnpm db:push` — applies all migrations through `20260508170000_phase3_resolve_org_permissions.sql`
3. `pnpm db:types` — regenerates `lib/supabase/types.ts`
4. `pnpm db:seed` — populates UCB + 14 system-preset templates + 2 cloned templates + 2 inspections (1 in-progress, 1 completed with 1 finding)
5. `pnpm dev` — starts the dev server (port 3000 or auto-fallback)

Demo accounts (password `Demo!2026` for all):
- `admin@demo.local` — Site Admin (Houston + Manchester, full perms)
- `ehs@demo.local` — EHS Manager (Houston + Manchester)
- `supervisor@demo.local` — Supervisor (Houston + Building A)
- `worker@demo.local` — Worker (Houston only)

## Step 1 — Template library renders
1. Sign in as `admin@demo.local`.
2. Click **Templates** in the sidebar → land on `/templates` (UCB-scoped list).
3. Confirm 2 cloned templates show: **UCB Forklift Pre-Use** (Manufacturing) and **UCB Office Ergonomic Check** (Office). Both `Published`.
4. Click **Browse library** in the page header.
5. On `/templates/browse`, confirm 14 cards across all 7 industries; 4 should have a **Featured** chip (Medical Audit Checklist, Forklift Pre-Use Inspection, Warehouse Aisle Housekeeping, Office Ergonomic Workstation Self-Assessment).
6. Filter by `?industry=manufacturing` (click the Manufacturing pill) → 2 cards remain.
7. Toggle **Featured** → only the Forklift card should remain in Manufacturing.
8. Clear filters.

✅ Pass: cards render, filters work, no console errors.

## Step 2 — Library preview + import
1. Click **Preview** on the Medical Audit Checklist card.
2. On `/templates/browse/<id>`, confirm the read-only checklist renders: title page + 3 sections (Patient Record System / Medical Record Review / Completion) + Compliant / Partly Compliant / Non-Compliant chips per question.
3. Click **Import to my org**.
4. Should redirect to `/templates/<new id>/edit` with all items copied as a fresh draft v1. Check that question item IDs differ from the preset.

✅ Pass: import lands on the editor; items are populated.

## Step 3 — Editor end-to-end (autosave + publish)
1. In the editor: change the template name in the topbar to `UCB Medical Audit`.
2. Wait 1 second — the topbar should show **Saving...** then **Saved**.
3. In the left sidebar, click an item → its options appear in the right panel. Toggle its **Required** checkbox. Confirm autosave fires again.
4. Click **+ Add item** under a section, choose **Question**. New question is selected and appears in the canvas preview with the default Yes / No / N/A answer set.
5. Use the ↑ / ↓ arrows on hover in the sidebar to reorder a question.
6. Click **Publish v1** in the topbar. The dialog opens.
7. Type a change summary < 10 chars — the **Publish** button stays disabled.
8. Type a longer summary (e.g. `Initial publish for UCB`) and submit.
9. Should toast `Published v1` and redirect to the read-only viewer (`/templates/<id>`).

✅ Pass: autosave + publish + redirect all work; toast shows.

## Step 4 — Versioned editing (snapshot rule prep)
1. On the viewer, click **Edit** → editor reopens. A new draft v2 is auto-created cloned from v1.
2. Edit a question label. Wait for autosave. Click **Publish v2** with a new summary.
3. Back on the viewer, the **Versions** panel shows **v2** (Published, current) above **v1** (Archived).
4. Click **v1** → renders read-only with the original label.
5. Use `?version=2` to confirm v2 view; `?version=1` for v1 view.

✅ Pass: both versions are independently viewable; v1 stays immutable.

## Step 5 — Assign template
1. From the viewer (v2 active), click **Assign**.
2. Confirm `Houston` appears in the site list (you have `template:assign` there as admin).
3. Select Houston → toggle **Include child sites** ON.
4. Frequency = **Daily**, start time = `06:00`.
5. Click **Save assignment**. Toast: `Assigned to 1 site`.
6. Confirm the **Active assignments** list now lists Houston with `pinned to v2`.
7. SQL spot-check (Supabase SQL editor):
   ```sql
   select template_version_id from template_assignments
    where template_id = '<your imported template id>'
      and unassigned_at is null;
   ```
   Should match the v2 ID, not v1.

✅ Pass: assignment row points at v2; old in-flight inspections (none here) would have stayed on whichever version they started against.

## Step 6 — Inspections list lands populated
1. Sign out. Sign in as `worker@demo.local`.
2. Click **Inspections** in the sidebar.
3. Confirm 2 seeded rows: one **In progress** (Forklift FL-12 — morning check) and one **Completed** with a **Has findings** pill (Forklift FL-12 — yesterday).
4. Click the in-progress row → opens the runner mode at `/inspections/<id>`.

✅ Pass: list shows the seeded data; clicking rows navigates correctly.

## Step 7 — Runner end-to-end
1. In the runner, the title page should auto-fill `Conducted by` (Wally Worker) and `Conducted on` (now).
2. Answer 2-3 question items by clicking response buttons. The progress bar at the top updates.
3. Find an item with the **Photo** type (if any in this template — Forklift has one in the Operational Checks category) → upload an image. Should preview in the grid.
4. Find a Signature item → type a name, draw with mouse/finger, click **Save signature**. Should swap to the green "Signed by" state.
5. Click **Submit** in the topbar.
6. If any required items are unanswered → the **Missing required answers** modal lists them. Either answer them and back out, or click **Submit anyway**.
7. Since the seed already gave you a failed item earlier (or you pick a "Fail" response), the **Flagged items detected** wizard appears. Add a comment (e.g. `Will service tomorrow`).
8. Click **Submit inspection**. Toast: `Inspection completed`. The page refreshes into REPORT mode.

✅ Pass: photo + signature + flag-with-comment + submit all work; report mode renders.

## Step 8 — Findings + escalation
1. On the now-completed inspection, scroll to the **Findings** section. The 1+ failed responses appear as findings, each with a status badge.
2. Click a finding → `/inspections/<id>/findings/<findingId>` detail page opens.
3. Sign out, sign in as `ehs@demo.local`. Re-open the same finding URL.
4. Confirm both **Mark resolved** and **Escalate to incident** buttons are visible.
5. Click **Escalate to incident**. Should redirect to `/incidents/<new draft id>`.
6. Confirm the new incident's description is pre-filled with `Escalated from inspection finding: <item label>` + the original comment.

✅ Pass: escalation creates a draft incident with the right linkage.

## Step 9 — Snapshot rule (the big one)
This is the integration check for the CLAUDE.md hard rule that in-flight inspections must keep their original version.

1. Sign in as `admin@demo.local`.
2. Open `/templates` → **UCB Forklift Pre-Use** → click **Edit**.
3. The auto-created draft is now v2 (since the seed published v1). Edit a question label, e.g. add `(updated)` to the end. Wait for autosave.
4. Publish v2 with a change summary like `Mid-cycle update for snapshot test`.
5. Open the seeded **in-progress** inspection from `/inspections`.
6. Confirm the runner shows the OLD label (without `(updated)`), not the new v2 label. The inspection is still pinned to v1.
7. SQL spot-check:
   ```sql
   select i.id, i.title, i.template_version_id, tv.version_number, tv.status
     from inspections i
     join template_versions tv on tv.id = i.template_version_id
    where i.template_id = '<UCB Forklift Pre-Use template id>'
    order by i.started_at;
   ```
   Should show the in-progress + completed inspections both pinned to v1.
8. Now any new inspection started from `/inspections?action=start` will pin to v2.

✅ Pass: existing inspections keep their v1 snapshot; new ones get v2.

## Step 10 — Sidebar nav + permissions
1. As `worker@demo.local`, confirm the sidebar shows: Dashboard, Report Incident, Incidents, Investigations*, CAPA, Templates, Inspections, Reports, Admin*. (* = these may be hidden if perms not granted; nav-config gates by perm.)
2. As worker, the **Templates** page should be visible (read-only — no `+ New template`, no `Edit` buttons).
3. As worker, the **Browse library** page renders, but the **Import** button on each card is disabled (workers don't have `template:create`).
4. As worker, no **Assign** button on a published template viewer.

✅ Pass: nav perms + UI gates are consistent.

## Step 11 — Tooltips
Hover/focus the `?` icon next to:
1. Library card **Import to my org** → "Importing a preset" tooltip
2. Editor **Publish v{N}** → "Publishing creates a new immutable version"
3. Viewer **Versions** panel header → "Why versions are immutable"
4. Assign form **Assign to every site I manage** checkbox → "Assigning to all sites"
5. Runner **Flagged items detected** dialog title → "Failed responses become findings"
6. Finding-detail **Escalate to incident** button → "Escalating a finding"

✅ Pass: all 6 new tooltips render.

## Step 12 — Console health
1. Open DevTools console.
2. Reload `/templates`, `/templates/browse`, `/templates/<id>/edit`, `/inspections/<id>` (runner mode), `/inspections/<id>` (report mode), `/inspections/<id>/findings/<id>`.
3. Confirm:
   - No React hydration warnings
   - No `'use cache'` errors
   - No Supabase RLS noise (`new row violates...`)
   - No Cache Components runtime errors
   - No Storage CORS warnings on photo / signature uploads

✅ Pass: console is clean.

---

## Reset between runs

To wipe Phase 3 demo state without nuking everything else:
```sql
delete from inspections      where org_id = (select id from orgs where slug='ucb');
delete from template_assignments where template_id in (
  select id from templates where org_id = (select id from orgs where slug='ucb')
);
delete from template_versions where template_id in (
  select id from templates where org_id = (select id from orgs where slug='ucb')
);
delete from templates where org_id = (select id from orgs where slug='ucb') and is_imported = true;
```
Then `pnpm db:seed` to repopulate.

---

## Known incomplete edges (tracked, not blockers)

- Drag-and-drop reorder is keyboard-only (↑↓); full @dnd-kit cross-section drag is v2.
- Recurring-inspection auto-creation cron is not wired — schedule fields are stored but not yet triggering runs. Plan note in §15.
- Library presets are static seed (14 templates); real SafetyCulture API import is v2.
- Item types beyond the MVP 8 (`textsingle`, `address`, `dynamicfield`, `list`, `slider`, `checkbox`, `drawing`) render as "Unsupported in v1" placeholders if a preset contains them. None of the 14 seeded templates use those types.
