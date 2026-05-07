# Smoke test — Phase 11b (members admin)

**Coverage:** Members tab on `/admin/sites/[id]` (lit up from 11a's read-only banner) · `/admin/members` org-wide list · `/admin/members/[profileId]` per-member detail · `/members` redirect · `/admin` landing card flip · `add_site_member_v1` / `change_site_member_role_v1` / `remove_site_member_v1` / `invite_member_to_site_v1` RPCs · per-site last-admin guard.

**Pre-reqs:**
- Migration `20260513120000_phase11b_members_admin.sql` applied (`pnpm db:push`).
- Types regenerated (`pnpm db:types`).
- Seeded UCB demo data (`pnpm db:seed`).

## 1. Demo gap closed (the canonical 11b story)

The functional-gap report from PR #12 flagged that `Site Admin` and `EHS Manager` demo accounts are siteless and can't use the report wizard. 11b closes that gap.

1. Sign in as `admin@ucb.com` (an existing `site_admin` somewhere — typically Houston).
2. Navigate `/admin/sites/<houston-id>?tab=members`.
3. **Expected:** the read-only "ships in 11b" banner is gone. A real "+ Add member" button is visible.
4. Click "+ Add member". **Expected:** AlertDialog opens with a Person picker, Role picker, Include-children checkbox.
5. Pick the demo `Site Admin` account, role = `site_admin`. Click Add.
6. **Expected:** toast "Member added"; row appears in the table.
7. Sign out. Sign in as the demo `Site Admin` account.
8. **Expected:** dashboard loads with Houston as the selected site (or visible in the SiteSwitcher); `/incidents/new/1` works without the prior "No site selected" error.

## 2. Last-admin guard (per-site)

1. As `admin@ucb.com`, navigate to `/admin/sites/<houston-id>?tab=members`.
2. Find the row for the only `site_admin` on Houston. **Expected:** the role chip shows "site_admin · last admin" tag; the Remove (X) button is rendered as **disabled** with a `title` tooltip explaining the guard.
3. Click the Change-role pencil for that same row. Pick a non-admin role (e.g. `worker`). Click Save.
4. **Expected:** the dialog stays open with the inline error: "There must be at least one site admin on every site. Promote another member first." (No silent toast — error visible in dialog body.)
5. Cancel. Promote another member (e.g. an `ehs_manager`) to `site_admin` via Change role.
6. **Expected:** "last admin" chip moves to the new admin row; the original admin's Remove + Change-role become unblocked.

## 3. Add / change / remove

1. As `admin@ucb.com` on `/admin/sites/<houston-id>?tab=members`.
2. Add a new worker via "+ Add member" → toast → row appears.
3. Change their role to `supervisor` via the pencil → toast → role chip updates to "supervisor".
4. Toggle "Include child sites" via Change-role → save → row reflects "Yes".
5. Remove them via the X → confirm in AlertDialog → toast "Member removed".

## 4. Permission gates

1. Sign in as `ehs@ucb.com` (`ehs_manager`).
2. Navigate to `/admin/sites/<houston-id>?tab=members`.
3. **Expected:** "+ Add member" button is **NOT visible** (perm `member:manage` is `site_admin`-only).
4. **Expected:** Per-row Change role + Remove icons are **NOT visible** for the same reason.
5. **Expected:** the rest of the page (Overview tab, sidebar Admin entry) still works because `ehs_manager` holds `site:configure` from 11a.
6. Sign in as `worker@ucb.com`. **Expected:** `/admin/sites/...` redirects to `/admin/sites` (no `site:configure`); `/admin/sites` redirects to `/admin` (same gate); `/admin` itself shows the "Admin is for site admins" empty state.

## 5. /admin/members list

1. As `admin@ucb.com`, click the Members card on `/admin`.
2. **Expected:** lands on `/admin/members`. KPI tile-style header reads "N members in this org."
3. **Expected:** placeholder card on the right: "Email invitations ship in Phase 11c. To add an existing colleague, open a site and use the Members tab."
4. **Expected:** Filter dropdowns: Role + Site. Search box.
5. Filter by Role = `site_admin`. **Expected:** only profiles who hold `site_admin` somewhere appear.
6. Filter by Site = Houston. **Expected:** only Houston members appear.
7. Search "Manager". **Expected:** matches by name OR email.
8. Click any row. **Expected:** lands on `/admin/members/<profileId>`.

## 6. /admin/members/[profileId]

1. Open any profile's detail page.
2. **Expected:** profile header (avatar + name + email + department) + read-only "Profile editing lands in Phase 8" hint.
3. **Expected:** memberships table: every site this profile is on, with role + include_children + since (created_at).
4. **Expected:** sites the acting admin has `member:manage` on show Change role + Remove affordances; sites they DON'T have `member:manage` on show "—" (action column).
5. **Expected:** archived sites surface as "archived" under the site name and have NO action affordances.
6. Click "Add to a site". **Expected:** modal opens with a Site dropdown listing only sites the acting admin can manage AND that the member isn't already on. If the list is empty, the modal explains why and offers a Close button.
7. **Expected:** activity-events footer: "<N> activity events in the last 30 days" — useful "is this user active" signal.

## 7. /members redirect

1. Open the user-menu profile dropdown (top-right).
2. Click "Members".
3. **Expected:** lands on `/admin/members` (the 6l stub `/members` is now a server-side redirect — the dropdown link doesn't have to change).

## 8. /admin landing card flip

1. Navigate `/admin`.
2. **Expected:** Members card is no longer a placeholder with "Phase 11b" chip; it's a live card that links to `/admin/members`.
3. **Expected:** Roles card still shows "Phase 11c" chip until 11c lands.

## 9. Email invite (11b version — existing org user only)

1. From `/admin/members` or the site-detail Members tab, expect to see the "Email invitations ship in Phase 11c" placeholder. The 11b version of `invite_member_to_site_v1` (callable from SQL editor) only resolves email → existing org profile.
2. From the SQL editor, call `select invite_member_to_site_v1('<houston-id>', 'somebody-not-in-org@example.com', '<role-id>', false);`
3. **Expected:** error: "No user with that email is in your org yet. Email invitations for new users ship in Phase 11c."
4. Call it with an existing org email. **Expected:** success — same outcome as `add_site_member_v1`.

## 10. Activity events

1. After running the lifecycle above, check `select * from activity_events where verb like 'member.%' order by created_at desc` in the SQL editor.
2. **Expected:** rows for `member.added`, `member.role_changed`, `member.removed` with actor + payload (`profile_id`, `role_key`, `include_children`, etc.).

## 11. Loading / error states

1. Throttle CPU, navigate to `/admin/members`. **Expected:** skeleton shows during load.
2. Navigate to `/admin/members/<profileId>`. **Expected:** different skeleton matching the post-load layout.
3. Force a thrown error in either route → branded error card with Try again + Back link.

## 12. Dark mode + a11y

1. Toggle dark mode. Verify every surface above.
2. Tab through `/admin/sites/[id]?tab=members` — focus reaches every Add / Change-role / Remove affordance.
3. Last-admin guard's disabled Remove button has the explainer in its `title` attribute (visible on hover for sighted users; SR users hear the `aria-label`).
