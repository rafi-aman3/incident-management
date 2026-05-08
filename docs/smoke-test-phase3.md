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

- Cross-parent reparenting via DnD is deferred — sibling-only reorder is supported in 6f via @dnd-kit/sortable + the existing ↑/↓ buttons.
- Recurring-inspection auto-creation cron is not wired — schedule fields are stored but not yet triggering runs. Plan note in §15.
- Library presets are static seed (14 templates); real SafetyCulture API import is v2.
- Item types beyond the MVP 8 (`textsingle`, `address`, `dynamicfield`, `list`, `slider`, `checkbox`, `drawing`) render as "Unsupported in v1" placeholders if a preset contains them. None of the 14 seeded templates use those types.

---

## Phase 6f — Templates polish checkpoints (added 2026-05-08)

Re-run all of the above first, then walk these new affordances. ~5 min.

1. **Loading skeletons.** Hard-refresh `/templates`, `/templates/browse`, `/templates/[id]`, `/templates/[id]/edit`, `/templates/[id]/assign`. Each route paints a skeleton matching the post-load layout (no blank flash, no layout shift).
2. **Error boundary retry.** Open DevTools → Network → throttle to "Offline" → load `/templates` — see the destructive brand error card with **Try again** + **Browse system presets**. Toggle online → click Try again → page recovers.
3. **Tree DnD via pointer.** On `/templates/[id]/edit`, grab the GripVertical handle on a question and drag it past a sibling. The order updates with a 4px activation delay so a click-to-select doesn't fire a drag. Autosave shows **Saving… → Saved**.
4. **Tree DnD via keyboard.** Tab to focus a GripVertical handle (visible focus ring on the handle). Press Space to pick up — `aria-live` polite region announces "Moved <label> to position X of Y." Use ↑/↓ to move, Space again to drop. Escape cancels mid-drag.
5. **Cross-parent drop is rejected.** Try dragging a question from Section A onto a question inside Section B. The drop snaps back; aria-live announces "Can't move across sections."
6. **Tree delete confirm.** Click the trash icon on a section that has 3 children. AlertDialog opens with "Delete this section and 3 items inside?" Cancel keeps the section; Delete removes it + all children.
7. **Assignment Remove confirm.** On `/templates/[id]/assign`, click Remove on an active assignment row. AlertDialog opens with "Remove assignment from <site>?" + the snapshot-rule reassurance copy.
8. **Active-assignments table.** Same page — confirm the active list renders as a `<table>` with Site / Schedule / Pinned version / Actions columns. The screen reader reads each row as `<site name>, <schedule>, v<N>` with row scope.
9. **ChangeSummaryDialog auto-suggestion.** In the editor, add 2 items, rename a section, then click Publish. The change-summary textarea opens pre-filled with `Added 2 items, renamed 1.` Edit freely before submit. (For first publish: textarea opens pre-filled with `Initial version of <template name>.`)
10. **Autosave-vs-publish race.** Type rapidly into the template name input → without waiting, click Publish. The Publish button is disabled while status is "Saving…" — when the save completes, the dialog opens with the latest state reflected in the diff suggestion. No silent overwrite.
11. **Save-failed Retry.** Block `/templates/[id]/edit/actions` POST in DevTools → make an edit → SaveIndicator flips to "Save failed" with a Retry button. Unblock + click Retry → status returns to "Saved".
12. **Snapshot-rule callout.** With at least one in-flight inspection on a prior version, visit `/templates/[id]`. A warning-tinted card surfaces: "N inspection(s) still running on a prior version" with a "View running inspections →" link to `/inspections?template=<id>&status=in_progress`.
13. **Version sidebar `aria-current`.** On `/templates/[id]?version=N`, the active row in the version sidebar is wrapped in `<nav aria-label="Version history">` and the link has `aria-current="page"` (visible via DevTools / VoiceOver: "current page, version N").
14. **Editor tab a11y.** In the builder, the Body / Title-page switcher is `role="tablist"` with each tab `role="tab"` + `aria-selected`. The tree below has `role="tabpanel"` + `aria-labelledby` matching the active tab. Switching tabs preserves the tree-panel id binding.

✅ All 14 pass: 6f is shippable.

---

## Phase 6g — Inspections polish checkpoints (added 2026-05-08)

Re-run the prior steps first, then walk these. Best on a 375px viewport (DevTools → Toggle device toolbar → iPhone SE) since the runner is the only mobile-first surface in V1.

1. **Loading skeletons.** Hard-refresh `/inspections`, `/inspections/[id]` (both runner and report variants), `/inspections/[id]/findings/[findingId]`. Each route paints a skeleton matching the post-load layout — no blank flash, no layout shift.
2. **Error boundary retry.** DevTools → Network → throttle to "Offline" → load `/inspections`. The destructive brand error card renders with **Try again** + **Back to dashboard**. Toggle online → click Try again → page recovers.
3. **`/inspections/[id]` not-found.** Navigate to `/inspections/00000000-0000-0000-0000-000000000000`. The dashed not-found card surfaces with a "Back to inspections" CTA.
4. **Per-file upload tolerance.** In the runner, on a media item, attach 3 image files where one is an invalid type (e.g. a `.txt` renamed `.png` so the MIME mismatches) or oversize (>25 MB). Toast reports "Uploaded 2 of 3" + an error toast for the rejected file. The 2 successes persist in the upload grid; refresh confirms.
5. **AbortController stalled-upload.** DevTools → Network → "Slow 3G" + "Offline" toggle mid-upload. After 30s the upload reports "upload stalled — timed out after 30s" as a per-file failure toast. Other queued files in the same batch continue (or fail independently).
6. **Save debounce.** On a runner text-response item, click into a textarea → blur out → wait 1s → see the network indicator flip from "Saving…" → "Saved Xs ago." If you blur again before the 1s elapses, only one network call fires (verify in the Network tab — `/inspections` server action, payload merged).
7. **Network indicator state cycling.**
   - **Online + saving:** Click a question button → pill shows "Saving…" with the spinner.
   - **Online + saved:** ~1s after the last commit → pill shows "Saved <relative>".
   - **Offline + last saved:** DevTools → Offline → pill flips to "Offline — last saved Xs ago."
   - **Offline + never saved:** Hard-refresh while offline → pill shows "Offline."
   - **Relative time refresh:** Wait 15+ seconds — the relative-time string updates in place (e.g. "Saved 12s ago" → "Saved 27s ago").
8. **Signature pad a11y.** On a signature item: VoiceOver / TalkBack announces "Printed name, edit text" on the input (label is wired) and "Signature drawing area, image" on the canvas. The Clear button announces "Clear signature, button."
9. **44px tap targets at 375px.** Inspect the runner Submit button + media-uploader Camera/Upload buttons in DevTools → confirm `min-height: 44px` on mobile (`sm:` breakpoint shrinks them on desktop). Sausage-finger test: tap each comfortably with a thumb.
10. **AlertDialog: Mark Resolved.** On a finding detail, click "Mark resolved." The AlertDialog body has the "Resolution notes (optional)" textarea inline. Type a note → confirm → page redirects to the parent `/inspections/[id]`. The finding now shows the green "Resolved" pill with the appended note in the comment.
11. **AlertDialog: Escalate.** On a different finding, click "Escalate to incident." Confirm. Page redirects to `/incidents/<newId>` with a draft incident pre-populated from the finding. Original finding shows "Escalated" pill on `/inspections/[id]`.
12. **List filters auto-submit.** On `/inspections`, change the status select → URL updates immediately to `?status=in_progress`, list refreshes. Type into the search box → blur (or press Enter) → URL updates to `?q=...`. No "Apply" button anywhere.
13. **Resume-vs-Continue chip.** With one in-progress and one completed inspection visible in `/inspections`, the in-progress row shows a "Resume" pill next to the title; completed rows show only the existing "Has findings" pill where applicable.
14. **Findings panel `aria-label`.** On a completed-with-findings `/inspections/[id]`, screen reader announces the findings region as "Findings from this inspection, region" before listing the items.
15. **Module 5 eyebrow gone.** `/inspections` page header shows just "Inspections" + sub-copy — no "Module 5" tag.

✅ All 15 pass: 6g is shippable.
