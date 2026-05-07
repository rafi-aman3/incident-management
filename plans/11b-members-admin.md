# Phase 11b — Members admin (sub-PR #2 of 3)

**Status:** drafted 2026-05-07 (parent: `plans/11-sites-management.md`; predecessor: 11a sites admin shipped on 2026-05-07 PR #14)
**Goal:** Land the members half of the Phase 11 admin console: light up the Members tab on `/admin/sites/[id]` (currently read-only with a "ships in 11b" banner), ship the org-wide `/admin/members` list + per-member detail, wire add / remove / change-role / toggle-include_children through 3 atomic RPCs with a per-site last-admin guard, redirect the Phase 6l `/members` stub to `/admin/members`, and grant the dormant `member:invite` + `member:manage` perm keys to the right default roles.
**Branch:** `feat/phase-11-members-admin`
**PR target:** `main`
**Parent plan:** `plans/11-sites-management.md`
**Depends on:** Phase 11a (shipped 2026-05-07 PR #14). The dormant `member:invite` + `member:manage` perm keys declared in `init.sql:121–122` since Phase 0.

> **What this sub-PR ships:**
>
> ### Schema (one migration: `20260513120000_phase11b_members_admin.sql`)
> - `insert into permissions ('member:remove_self_protection', 'placeholder')` — **NO**, no new perm keys. The 4 dormant keys (`member:invite / member:manage` plus `role:read / role:edit`) are sufficient.
> - **Grants:**
>   - `site_admin` picks up `member:invite` + `member:manage`.
>   - `ehs_manager` picks up `member:invite` only (can invite, can't change roles).
>   - `supervisor / worker` unchanged.
> - **RLS additions:**
>   - New `site_members_admin_insert` policy: `for insert to authenticated with check (has_permission('member:manage', site_id))`.
>   - New `site_members_admin_update` policy: `for update to authenticated using (has_permission('member:manage', site_id)) with check (has_permission('member:manage', site_id))`.
>   - New `site_members_admin_delete` policy: `for delete to authenticated using (has_permission('member:manage', site_id))`.
>   - The existing `site_members_read` policy stays (post-Phase-6a recursion fix uses `user_can_access_site` — no change). 11b's RPC writes ride the new admin policies.
>
> ### Atomic RPCs (security-definer)
> - `add_site_member_v1(p_site_id, p_profile_id, p_role_id, p_include_children?)` — gates on `has_permission('member:manage', p_site_id)`. Idempotent on `(profile_id, site_id)` — re-calling with a different role updates instead of erroring (treats as upsert). Rejects when the role is in a different org. Logs `member.added` (or `member.role_changed` on the upsert path).
> - `remove_site_member_v1(p_site_id, p_profile_id)` — gates on `member:manage`. **Last-admin guard (per-site):** rejects when the membership being removed has role `site_admin` AND it's the only `site_admin` row on that site. Surfaces actionable error: "Promote another member to site admin first." Logs `member.removed` with the role-key in the payload.
> - `change_site_member_role_v1(p_site_id, p_profile_id, p_role_id, p_include_children?)` — gates on `member:manage`. Same per-site last-admin guard fires when demoting from `site_admin`. Logs `member.role_changed`.
> - `invite_member_to_site_v1(p_site_id, p_email, p_role_id, p_include_children?)` — gates on `member:invite`. **In v1 (this sub-PR), this RPC is a thin wrapper that:** ① looks up `auth.users` by email, ② if found, calls `add_site_member_v1` for the resolved profile, ③ if not found, raises a guidance error: "User has not signed up yet. Send them an invitation in Phase 11c." So invitation-by-email-for-not-yet-signed-up users is explicitly deferred to 11c (which lands the `invitations` table + magic-link flow). 11b can still add any existing org member to a site. Logs `member.added` on success.
>
> ### Routes (3 new + 1 lit-up)
> 1. **`/admin/sites/[id]?tab=members`** — currently read-only with a "ships in 11b" banner. Replace banner with a member-management surface:
>    - "+ Add member" button (gated `member:manage`) — opens an `<AddMemberDialog>` (combobox of org profiles NOT already on this site, role select, include_children checkbox). Calls `add_site_member_v1`.
>    - Per-row Change role + Remove popover (gated `member:manage`). Change role opens `<ChangeRoleDialog>` (role select + include_children). Remove uses an `<AlertDialog>` confirm with the last-admin guard surfaced as a friendly error if the RPC rejects.
>    - Lead-admin pill renders next to the `site_admin` member's role chip with an `aria-label="Last site admin — protected"` when that member is the only `site_admin` (server-side flag from a count query).
> 2. **`/admin/members`** — org-wide profile list:
>    - Header band ("Members · N total"); top-right "+ Invite member" links to a placeholder modal that explains the email-invite flow lands in 11c (with a deep-link back to `/admin/sites/[id]?tab=members` for adding existing org members today).
>    - Columns: Name · Email · Sites count · Primary role (the highest-perm role across their memberships, or `—` if none) · Last seen (`profiles.last_seen_at` if present, else "—"). Click row → `/admin/members/[profileId]`.
>    - URL-driven filters: `?role=<role_id>` (filter to members with that role on at least one site), `?site=<site_id>` (members of that site), `?q=<name|email>` search. Same filter-chip UX as `/admin/sites`.
>    - Empty: "No members match these filters."
> 3. **`/admin/members/[profileId]`** — per-member detail:
>    - Profile metadata header (name + email + department read-only — editing profile data is Phase 8).
>    - Memberships table: site · role · include_children · since (created_at). Per-row Change role + Remove (gated `member:manage`).
>    - "+ Add to a site" inline-form (combobox of accessible sites NOT already on this member, role select, include_children). Calls `add_site_member_v1`.
>    - Read-only audit footer: count of last-30-day activity events authored by this profile (a useful "is this user active" signal without surfacing the full activity log here).
> 4. **`/members`** (Phase 6l stub) — change to a server-side `redirect('/admin/members')`. The 6l profile-dropdown link starts working without further changes.
>
> ### Components (new, under `components/admin/`)
> - `add-member-dialog.tsx` — `<AlertDialog>`-style modal; combobox of org profiles + role select + include_children checkbox. Reused on both the site-detail Members tab and `/admin/members/[profileId]`.
> - `change-role-dialog.tsx` — same combobox-less form (role + include_children only).
> - `remove-member-dialog.tsx` — confirm `<AlertDialog>`. Surfaces the RPC's last-admin error in the dialog body inline (toast on success).
> - `member-combobox.tsx` — async combobox over org profiles (filters out profile IDs already in a passed-in `excludeIds` list).
> - `members-list.tsx` — table primitive for `/admin/members`.
> - `members-filters.tsx` — URL-driven filter chips (mirrors `sites-filters` shape).
> - `member-memberships-table.tsx` — table on `/admin/members/[profileId]`.
>
> ### Server actions
> - `app/(app)/admin/sites/[id]/members-actions.ts` — `addSiteMember` + `changeSiteMemberRole` + `removeSiteMember`. Each wraps an RPC; standard `{ ok, error, fieldErrors }` shape; revalidates both `/admin/sites/[id]?tab=members` and `/admin/members/<profileId>`.
> - `app/(app)/admin/members/actions.ts` — same 3 actions exposed at the org-wide route + a `getProfileSearchSuggestions(q)` helper that backs the member combobox.

---

## Why this sub-PR

11a closed the gap on **what a site looks like**; 11b closes the gap on **who's on it**. Today there is no UI to add a colleague to a site — every membership change requires the SQL editor (`insert into site_members ...`). The functional-gap report from PR #12 explicitly called this out: "Site Admin and EHS Manager demo accounts have no site assigned and the wizard fails them with `No site selected` … In a fresh environment that would block the spec'd flow for those roles."

This sub-PR makes that flow work via a `site_admin` adding the demo accounts to the right site through `/admin/sites/[id]?tab=members` or `/admin/members/[profileId]`. The forcing-function "ships in 11b" banner that 11a left in place tells the truth: 11b is what removes it.

---

## Locked-rule honors

- **No new perm keys** — uses the already-declared `member:invite / member:manage` from `init.sql`. UI never invents perms.
- **Workflow engine = server actions.** All 3 (4) RPCs are called from server actions, log to `activity_events` with `member.added / member.removed / member.role_changed` verbs.
- **Audit append-only.**
- **Permission keys are system-defined** (no UI editing of the `permissions` catalog).

---

## Resolved open questions (from the parent plan)

- **#4 Last-admin guard scope** — **per-site**, as the parent plan recommended. The RPCs `remove_site_member_v1` and `change_site_member_role_v1` reject the operation when the actor would leave the site with zero `site_admin` rows. Per-org last-admin protection is *not* enforced here (there's no "remove from org" action in 11b — that's an account-deletion concern, not a site-membership concern).
- **#1 Org-wide vs. site-pinned invitations** — n/a in 11b. The "Invite member" CTA on `/admin/members` is a placeholder that explains the email path lands in 11c. Existing org members can still be added to a site via the combobox today.
- **#3 Email delivery** — n/a (11c).
- **#2 `notification_kind.invited`** — n/a (11c).
- **#7 Archive-cascade read filter** — already resolved in 11a (query-level filter on `sites.archived_at`).
- **#8 Phase 8 ripple** — this sub-PR redirects `/members` to `/admin/members`. Phase 8 stays = Settings/account preferences.

---

## What's NOT in this sub-PR

- **Email invitations** for users who haven't signed up yet — **11c**. The `invite_member_to_site_v1` RPC v1 in this sub-PR ONLY adds an existing org profile to a site (resolves email → existing profile, then delegates to `add_site_member_v1`). If the email isn't an existing user, it raises a guidance error directing the admin to 11c.
- **Role permission editor** — **11c**.
- **`roles.is_system`** — **11c**.
- **Org-creation / sign-up flow** — separate workstream.
- **Profile editing** (full_name, department, avatar) — Phase 8 Settings.
- **Bulk member operations** (CSV import, bulk-change-role) — single-row UX in v1.

---

## Definition of done

1. Migration applies cleanly. Types regenerated include the 4 RPCs.
2. The 4 RPCs are testable from the SQL editor with the standard `{ status, error }` semantics.
3. **Demo gap closed:** a `site_admin` can add `Site Admin demo` + `EHS Manager demo` accounts (currently siteless per the functional-gap report) onto Houston via `/admin/sites/Houston-id?tab=members`, and those accounts can immediately use the report wizard without the "No site selected" error.
4. `/admin/sites/[id]?tab=members` no longer shows the read-only banner; instead surfaces add / change / remove flows gated on `member:manage`.
5. `/admin/members` lists every org profile with role + sites count.
6. `/admin/members/[profileId]` shows full membership grid + add-to-site flow.
7. Last-admin guard fires correctly: try to remove the last `site_admin` for a site → actionable error; try to demote them → same error.
8. `/members` (Phase 6l stub) redirects server-side to `/admin/members` — the 6l profile-dropdown link starts working.
9. After the migration, `ehs_manager` users see "Add member" on site-detail Members tab but their per-row Change role + Remove popovers stay disabled (perm `member:manage` is `site_admin`-only).
10. `loading.tsx` + `error.tsx` ship at the route level for `/admin/members` + `/admin/members/[profileId]`.
11. Phase 6 polish 10-item checklist passes for all new routes.
12. Smoke-test guide at `docs/smoke-test-phase11b.md` covers the lifecycle end-to-end.
13. PR description shows before/after of the site-detail Members tab (read-only banner → live editor) and a 30-second screen recording of adding a member + the last-admin guard fire.

---

## Open questions for the user (resolve before I start writing code)

1. **`ehs_manager` member-management scope.** I propose granting `ehs_manager` only `member:invite` (can invite + add an existing user to a site) but NOT `member:manage` (can't change roles or remove). This matches the spec's intent that role-edit is a `site_admin` privilege. **Recommend: invite-only for ehs_manager.** Confirm.
2. **Last-admin guard wording.** When the guard fires, should the modal show:
   (a) a generic "There must be at least one site admin on every site. Promote another member first." (Stripe-style guard) OR
   (b) a more directive "Promote a specific other member by name. Click here to do it." inline-suggestion flow?
   **Recommend: (a)** — simpler, matches the system-message tone we use elsewhere. The user can then click the other member in the list and Change role themselves.
3. **`/admin/members` "Invite member" CTA in 11b.** Three options:
   (a) Hide the button until 11c.
   (b) Show a disabled button with a "Coming in 11c" tooltip.
   (c) Show an enabled button that opens a modal explaining the path: "To add an existing colleague, go to the site → Members tab. To invite someone who hasn't signed up yet, that's coming in Phase 11c (no UI to send the invite from this page yet). Cancel / Go to a site →"
   **Recommend: (c)** — it answers the question, isn't dishonest about where we are, and offers the working path. (a) and (b) both leave the user wondering.
4. **"Add to a site" combobox on `/admin/members/[profileId]`.** Should it offer ONLY the sites the *acting admin* has `member:manage` on, OR all sites in the org? **Recommend: only sites the acting admin can manage** (RLS would reject otherwise, and showing un-actionable options is just bad UX).
5. **Profile read-only fields on `/admin/members/[profileId]`.** Phase 8 owns profile editing, but the admin will want to see basics. Render `full_name + email + department` plus per-membership site/role/include_children/since/last-30-day-activity-count. Anything else worth surfacing? **Recommend: stick to that minimum** — anything richer (avatar, login history, audit trail) earns its own decision in Phase 8 or a future audit-log surface.
6. **Member combobox empty state when ALL org profiles are already on the site.** Show "Everyone in your org is already on this site" or hide the "+ Add member" button entirely? **Recommend: show the button → modal opens → empty-state copy explains.** Hiding the button is sneaky; surfacing the empty state is honest.

---

## File-level scope (concrete)

```
supabase/migrations/20260513120000_phase11b_members_admin.sql        [new]

app/(app)/admin/sites/[id]/page.tsx                                  [edit — light up the Members tab]
app/(app)/admin/sites/[id]/members-actions.ts                        [new]

app/(app)/admin/members/page.tsx                                     [new]
app/(app)/admin/members/loading.tsx                                  [new]
app/(app)/admin/members/error.tsx                                    [new]
app/(app)/admin/members/actions.ts                                   [new]
app/(app)/admin/members/[profileId]/page.tsx                         [new]
app/(app)/admin/members/[profileId]/loading.tsx                      [new]
app/(app)/admin/members/[profileId]/error.tsx                        [new]

app/(app)/members/page.tsx                                           [rewrite — server-side redirect]

app/(app)/admin/page.tsx                                             [edit — flip Members card from "Phase 11b" placeholder to live link]

components/admin/add-member-dialog.tsx                               [new]
components/admin/change-role-dialog.tsx                              [new]
components/admin/remove-member-dialog.tsx                            [new]
components/admin/member-combobox.tsx                                 [new]
components/admin/members-list.tsx                                    [new]
components/admin/members-filters.tsx                                 [new]
components/admin/member-memberships-table.tsx                        [new]

lib/rbac/permissions.ts                                              [unchanged — perm keys already in the union]

docs/smoke-test-phase11b.md                                          [new]
```

Total: 1 migration · 7 new routes (2 of them small) · 1 rewrite + 2 surgical edits · 7 new components · 1 smoke-test guide. Roughly the same surface as 11a.
