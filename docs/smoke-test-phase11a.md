# Smoke test — Phase 11a (sites admin)

**Coverage:** `/admin` landing rebuild · `/admin/sites` (table + tree, filters) · `/admin/sites/[id]` (4 tabs) · `update_site_v1` / `archive_site_v1` / `unarchive_site_v1` RPCs.

**Pre-reqs:**
- Migration `20260512120000_phase11a_sites_admin.sql` applied (`pnpm db:push`).
- Types regenerated (`pnpm db:types`).
- Seeded UCB demo data (`pnpm db:seed`).
- Sign in as `admin@ucb.com` (site_admin) for the full lifecycle. A second pass as `ehs@ucb.com` (ehs_manager) confirms the per-perm UI gate.

## 1. Sidebar visibility

1. Sign in as `admin@ucb.com`. **Expected:** "Admin" entry visible in the sidebar (was dormant pre-migration because no role held `site:configure`).
2. Sign in as `worker@ucb.com`. **Expected:** "Admin" entry NOT visible.
3. Sign in as `ehs@ucb.com`. **Expected:** "Admin" entry visible (granted `site:configure`).

## 2. /admin landing

1. Click "Admin" in the sidebar.
2. **Expected:** new landing page (no longer "Admin coming in Phase 3").
3. **Expected:** 4 KPI tiles render with org-scoped counts: Active sites, Archived sites (0 on a fresh seed), Members, Roles.
4. **Expected:** 3 admin cards: Sites (live, links to `/admin/sites`), Members (placeholder, "Phase 11b"), Roles (placeholder, "Phase 11c").
5. **Expected:** Site setup wizard + Demo affordances cards still link out correctly.

## 3. /admin/sites table view

1. From `/admin`, click the Sites card.
2. **Expected:** Table view loads with all UCB sites (Houston, Manchester, plus child sites).
3. **Expected:** Filter chips: Active (selected by default) · Archived · All; All countries · US · GB; Table / Tree toggle.
4. Click "GB". **Expected:** Manchester + its children remain; Houston tree disappears. URL has `?country=GB`.
5. Search "manch" in the search box, press Enter. **Expected:** filters to Manchester rows.
6. Click "Clear search". **Expected:** all GB sites return.
7. Click "All countries". **Expected:** filter pill cleared, all sites return.

## 4. /admin/sites tree view

1. Click "Tree" in the view toggle (top-right).
2. **Expected:** indented hierarchy with parents at depth 0 and child sites nested with chevron prefix.
3. Click any node. **Expected:** lands on `/admin/sites/[id]`.

## 5. Site detail — Overview (rename + re-parent)

1. Open Houston (a top-level US site). Land on Overview tab.
2. **Expected:** form pre-populated with name + country (read-only) + timezone + address + region + OSHA establishment ID + NAICS + parent-site dropdown.
3. Edit the address to something different. Click "Save changes".
4. **Expected:** toast "Site updated"; form refreshes with the new address.
5. Try to set Houston's parent to one of its own children. Click "Save changes".
6. **Expected:** server-action error toast "Re-parenting would create a cycle".
7. Set Houston's parent back to "No parent (top-level site)". Save.
8. **Expected:** success.

## 6. Site detail — Members tab (read-only)

1. Click the "Members" tab.
2. **Expected:** yellow info banner: "Member editing ships in Phase 11b. Read-only for now."
3. **Expected:** read-only table with each `site_members` row showing avatar/name/email + role + include_children boolean.
4. **Expected:** no add / remove / change-role affordances.

## 7. Site detail — Annual hours

1. Click the "Annual hours" tab.
2. **Expected:** if seeded data has rows, they render newest-first; otherwise "No years recorded yet" empty card.
3. Click "+ Add year".
4. **Expected:** AlertDialog with year + hours fields; year defaults to current.
5. Submit with year=2025, hours=240000.
6. **Expected:** toast "Added 2025"; dialog closes; row appears in the table.
7. Edit the 2025 row's hours to 250000 inline. Click "Save".
8. **Expected:** toast "Saved 2025".
9. Click the trash button on 2025. **Expected:** confirm dialog; clicking Remove deletes the row.
10. Cross-check on `/reports/osha-300a` for the same site + year — your edits should be visible there too.

## 8. Site detail — Setup tab

1. Click the "Setup" tab.
2. **Expected:** "Complete" status for any site with `setup_completed_at` set, or "In progress" + "Resume wizard →" link otherwise.
3. **Expected:** Progress payload `<details>` block (collapsed by default) renders the JSON when present.
4. **Expected:** read-only — no un-complete affordance.

## 9. Archive lifecycle

1. From `/admin/sites`, open a leaf site (one with no children) — e.g. a Manchester sub-site.
2. Click "Archive site" (top-right).
3. **Expected:** AlertDialog opens with "Type the site name to confirm" guard.
4. Type a wrong name. **Expected:** Archive button stays disabled.
5. Type the exact site name. Add a reason. Click Archive.
6. **Expected:** toast "Site archived"; redirect to `/admin/sites?status=archived`; the site appears under the Archived filter.
7. The site's lifecycle pill reads "Archived" with the date and reason on the detail page.
8. **Expected:** Editing the archived site's Overview is disabled (field `disabled`); helper banner says "Editing is disabled while the site is archived. Unarchive first."

## 10. Unarchive

1. From `/admin/sites?status=archived`, open the just-archived site.
2. Click "Unarchive site" (top-right).
3. **Expected:** simple Yes/Cancel AlertDialog (no type-name guard).
4. Confirm.
5. **Expected:** toast "Site unarchived"; redirect to `/admin/sites` (active list); the site reappears under Active.

## 11. Archive guards

1. Try to archive Houston (which has child sites).
2. **Expected:** error toast: "Archive child sites first: <child names>".
3. Re-parent a Manchester child to be under Houston. Save.
4. Archive Manchester now (still has children — its other child).
5. Try to archive Manchester. **Expected:** the child-archive guard fires.
6. Archive each child first. Then archive Manchester. **Expected:** success.

## 12. Permission guard (ehs_manager)

1. Sign out, sign in as `ehs@ucb.com`.
2. Navigate to `/admin/sites/<houston-id>`.
3. **Expected:** Overview tab is editable (perm `site:configure` granted).
4. **Expected:** "Archive site" button NOT shown (perm `site:archive` is site_admin-only).
5. Try to navigate manually to `/admin/sites/<houston-id>?archive=1` (or just attempt `archive_site_v1` from Postman) — server enforces the gate too.

## 13. Activity events

1. As `admin@ucb.com`, after running the lifecycle above, check `select * from activity_events where verb like 'site.%' order by created_at desc` in the SQL editor.
2. **Expected:** rows for `site.updated`, `site.archived`, `site.unarchived`, each with the actor + payload.

## 14. Loading + error states

1. Throttle CPU in DevTools, navigate to `/admin/sites`. **Expected:** skeleton shows during the brief load (filter chips + table).
2. Force a thrown error (rename a column temporarily in a query, or make the action throw). **Expected:** branded `error.tsx` with Try again + Back to admin.

## 15. Dark mode parity

1. Toggle dark mode in the app shell.
2. **Expected:** every surface above (admin landing, sites list table + tree, site detail tabs, archive dialog, AnnualHoursEditor) renders correctly.

## 16. Cross-surface check

1. Edit a site's name from `/admin/sites/[id]` Overview.
2. **Expected:** new name shows up in the topbar SiteSwitcher, the dashboard "Site:" pill, the OSHA 300A site picker, every list page that surfaces site_name, etc. (We rely on `revalidatePath` + RLS-bound queries to pick this up.)
