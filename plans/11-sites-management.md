# Phase 11 — Sites + Members + Roles (Org admin console)

**Status:** drafted 2026-05-07 (Phase 11 reservation; depends on Phase 6 polish + on Phase 7/8 if/when those ship — but does not block on them)
**Goal:** A `site_admin` (and select `ehs_manager` flows) can run the full org-admin console from `/admin`: see every site in the org, edit any site's metadata + hierarchy + annual hours + setup state + members, archive a site, manage org-wide membership (cross-site view + invitations), and edit role permission sets. Today the org has no UI surface for any of this — the sites table is read-only via RLS, the four `site:configure / member:invite / member:manage / role:edit` perm keys are declared but never granted, and `/admin` still renders a stale "Admin coming in Phase 3" `EmptyState`. This phase delivers the admin console that closes that gap and unblocks every "I need to fix the org structure" task that currently requires a Supabase SQL editor.
**Estimated duration:** ~1.5 weeks (3 sub-PRs: sites · members · roles+invitations)
**Depends on:**
- Phase 6 polish (in flight; 6c merged 2026-05-07, 6d–6j queued). No hard dependency, but landing after Phase 6 wraps means the polish standards (10-item checklist, brand error card, `loading.tsx` per route, AlertDialog confirm pattern) are in force.
- Phase 6a `create_site_v1` RPC + `/admin/sites/new` (already shipped). This phase extends the sites surface around what 6a created.
- The 4 dormant perm keys from `init.sql` line 119–124 (`site:configure / member:invite / member:manage / role:edit`).
**Branch convention:** one branch per sub-PR off `main`:
- `feat/phase-11-sites-admin`
- `feat/phase-11-members-admin`
- `feat/phase-11-roles-and-invitations`

> **What this phase ships:**
>
> ### Schema (one migration: `2026XXXXXXXXXX_phase11_admin_console.sql`)
> - `sites.archived_at timestamptz` — sites are **archived, not soft-deleted**. The locked rule restricts `deleted_at` soft-delete to `incidents / investigations / capas`; sites use an `archived_at` flag instead so the locked rule isn't violated and so referential integrity of historical FK chains (incidents → site, etc.) stays intact.
> - `sites.archived_by uuid references profiles(id) on delete set null` + `sites.archive_reason text`.
> - `invitations` (new table): `id`, `org_id`, `site_id` (nullable for org-wide), `role_id`, `email`, `token` (random 32-byte hex), `expires_at` (default `now() + 14 days`), `invited_by`, `accepted_at`, `revoked_at`, `created_at`. Unique on `(org_id, email)` *partial* `where accepted_at is null and revoked_at is null` so re-inviting after accept/revoke is allowed.
> - `roles.is_system boolean not null default false` — flags the 4 default seeded roles so they can't be deleted (UI also gates).
> - New perm keys (4 already exist; we add 4 more for granularity):
>   - `site:archive` (separate from `site:configure` so an EHS manager can edit but not archive)
>   - `role:create`
>   - `role:delete`
>   - `invitation:read` (so EHS managers can view but not issue)
> - **Grants:**
>   - `site_admin` gets all of: `site:configure / site:archive / member:invite / member:manage / role:read / role:edit / role:create / role:delete / invitation:read`.
>   - `ehs_manager` gets: `site:configure / member:invite / member:manage / role:read / invitation:read`.
>   - `supervisor / worker` unchanged.
> - **RLS additions:**
>   - `sites_update` policy: `org_id = current_org() and has_permission('site:configure', id) and archived_at is null`.
>   - `sites_archive_update` policy (write-only on `archived_at` column): same gate but `site:archive`. (Implemented as a `before update` trigger that splits the column write — see RPC list below.)
>   - `roles_*` policies for INSERT/UPDATE/DELETE gated by org-wide perm via `has_org_permission`.
>   - `role_permissions_*` policies for INSERT/DELETE.
>   - `site_members_admin_*` policies for INSERT/UPDATE/DELETE gated by `member:manage`.
>   - `invitations_*` four policies (read by `invitation:read`, insert by `member:invite`, update revoke by `member:invite`, delete forbidden — append-only, only `revoked_at` writes).
>
> ### Atomic RPCs (security-definer)
> - `update_site_v1(site_id, name?, address?, region?, timezone?, osha_establishment_id?, naics_code?, parent_site_id?)` — gates on `site:configure`; rejects parent re-parent that would create a cycle (walk ancestors); rejects parent change to a site in a different org; logs `site.updated` to `activity_events`.
> - `archive_site_v1(site_id, reason?)` — gates on `site:archive`; rejects when the site has active children (must archive children first — surfaces actionable error); sets `archived_at + archived_by + archive_reason`; logs `site.archived`.
> - `unarchive_site_v1(site_id)` — gates on `site:archive`; clears the archive fields if the site has no archived parent (you can't un-archive a child whose parent is archived); logs `site.unarchived`.
> - `add_site_member_v1(site_id, profile_id, role_id, include_children?)` — gates on `member:manage`; idempotent on `(profile_id, site_id)`; rejects when the role is in a different org; logs `member.added`.
> - `remove_site_member_v1(site_id, profile_id)` — gates on `member:manage`; rejects when removing the last `site_admin` membership for that site (surfaces "promote another admin first"); logs `member.removed`.
> - `change_site_member_role_v1(site_id, profile_id, role_id, include_children?)` — gates on `member:manage`; same last-admin guard if demoting; logs `member.role_changed`.
> - `create_role_v1(name, description?, permission_keys[])` — gates on `role:create`; inserts `roles` + bulk inserts `role_permissions`; rejects unknown permission keys; rejects duplicate role name within org; sets `is_system=false`.
> - `update_role_v1(role_id, name?, description?, permission_keys[])` — gates on `role:edit`; **blocks edits to `is_system=true` rows for renaming** but allows permission-set changes (so an org can extend the default `worker` role without renaming it). Replace-set semantics for permissions.
> - `delete_role_v1(role_id)` — gates on `role:delete`; rejects when `is_system=true` OR when any `site_members.role_id = role_id` exists; logs `role.deleted`.
> - `create_invitation_v1(email, role_id, site_id?, include_children?)` — gates on `member:invite`; site_id null = org-wide invitation (resolves to "first site they accept onto" — see Open Questions); generates `token` (`encode(gen_random_bytes(32), 'hex')`); upserts `invitations` (revoke any prior pending for same email if exists). Emits a notification (kind=`assigned` reused, or new kind `invited` — see Open Questions).
> - `revoke_invitation_v1(invitation_id)` — gates on `member:invite`; sets `revoked_at`.
> - `accept_invitation_v1(token)` — public-callable (no auth gate other than "you must be the user the email belongs to"); validates not-expired and not-accepted-or-revoked; creates `profiles` row if first sign-up (matched by email); creates `site_members` row from the invitation; sets `accepted_at`; returns `{ org_id, site_id }` for redirect.
>
> ### Routes (8 new + 1 rebuilt)
> 1. **`/admin`** — rebuilt landing. KPI tiles: sites count (+archived), members count, roles count (system + custom), pending invitations. Three quick links to Sites / Members / Roles. RegTooltip on each tile explaining what the surface owns.
> 2. **`/admin/sites`** — list of all org sites in two view modes: **Table** (default; columns: name · country · region · members count · last incident · setup state · status pill `Active` / `Archived`) and **Tree** (parent → child indented list; click to expand). Filters: `?status=active|archived|all`, `?country=US|GB|all`, `?q=<name>`. URL-driven. Top-right: + Add site (links to existing `/admin/sites/new`). Per-row actions popover: Edit · Manage members · Archive (or Unarchive).
> 3. **`/admin/sites/[id]`** — site detail with 4 tabs (`?tab=overview|members|hours|setup`):
>    - **Overview**: rename + address + region + timezone + OSHA establishment ID + NAICS + parent_site_id reparent (combobox of org sites, with "no parent" option). Country is **immutable in v1** (changes the regulatory engine; logged as v2 in SPEC §15). All fields gated on `site:configure`. Save calls `update_site_v1`. Footer card: Archive (gated on `site:archive`).
>    - **Members**: list of `site_members` for this site. Add member modal (combobox of org profiles + role select + include_children checkbox). Per-row Change-role + Remove. Show "Lead admin?" warning when removing/demoting the last `site_admin`.
>    - **Annual hours**: per-year `site_annual_hours` editor (currently only reachable from `/reports/osha-300a`). Table of years; inline-edit hours_worked; "+ Add year" row. Reused as a feature card so OSHA 300A doesn't change.
>    - **Setup**: shows `setup_progress` JSON + `setup_completed_at`; deep-link to `/admin/site-setup/[step]` if not yet completed.
> 4. **`/admin/members`** — org-wide profile list. Columns: name · email · sites count · primary role · last seen. Filters: `?role=<role_id>`, `?site=<site_id>`, `?q=<name|email>`. + Invite member opens modal (= `create_invitation_v1`). Per-row click → `/admin/members/[profileId]`.
> 5. **`/admin/members/[profileId]`** — individual member's site memberships across the org. Table: site · role · include_children · since. Add new site membership inline. Remove from any site. Profile metadata: name, email, department (read-only in v1; editing profile data is Phase 8 Settings).
> 6. **`/admin/roles`** — list of org roles. Columns: name (with `system` chip when `is_system`) · description · permissions count · members count · created_by. Filter: `?type=system|custom|all`. + New role opens modal. Per-row Edit (or View if `role:read`-only).
> 7. **`/admin/roles/[id]`** — role permission editor. Permission checklist grouped by entity (`incident:*`, `inspection:*`, `capa:*`, `template:*`, `asset:*`, `document:*`, `member:*`, `role:*`, `site:*`, `planner:*`, `report:*`, `notification:*`). Save calls `update_role_v1` (replace-set). Right rail shows member count + first 10 members assigned. Delete button gated on `role:delete && !is_system && member_count === 0`.
> 8. **`/admin/invitations`** — pending invitations list. Columns: email · invited site · role · invited by · expires in · status. Per-row Resend (creates a new token + extends expiry) + Revoke. + New invitation opens the same modal as Members.
> 9. **`/invite/[token]`** — public-ish landing for the invitation link. If unauthenticated → asks to sign up / log in. If authenticated and email matches → "Accept invitation to <site>?" → calls `accept_invitation_v1` → redirects to `/dashboard?invited=<site_name>`. If email mismatch → "This invitation is for <email>; please sign in as that user."
>
> ### Components (reusable)
> - `<SiteHierarchyTree>` — nested-list renderer; consumes the same BFS site-resolver pattern from the planner.
> - `<PermissionChecklist>` — grouped permission picker driven by `permissions` table; used in `/admin/roles/[id]` and (later, Phase 8) for any per-role custom-permission editor.
> - `<RoleSelect>` — combobox of org roles; reused on add-member, change-role, invite-member modals.
> - `<MemberCombobox>` — async combobox over org profiles; reused everywhere a member picker shows up.
> - `<ArchiveSiteDialog>` — `<AlertDialog>` confirm with "type the site name to confirm" guard (irreversible-feeling action).
> - `<InvitationLinkCard>` — copyable link + expiry chip + resend / revoke actions.
>
> ### Sidebar / topbar nav
> - The 6l profile dropdown's **Settings** link still routes to `/settings` (Phase 8 owns it).
> - The 6l profile dropdown's **Members** link in this phase **redirects to `/admin/members`** (replaces the Phase 6l empty-stub; Phase 8 doesn't need to ship a separate /members anymore — the redirect is the answer).
> - Sidebar gains an **Admin** parent group (gated by `has_org_permission('site:configure')` OR any role: `is_system=true ∧ key='site_admin'`-style heuristic) with three children: Sites · Members · Roles. Visible only to admins.
>
> ### Smoke test
> `docs/smoke-test-phase11.md` — three flows:
> 1. **Site lifecycle:** create child site → edit address + reparent → archive (with reason) → unarchive → confirm activity_events trail.
> 2. **Member lifecycle:** invite an external email → accept the invite as that user (incognito tab) → land in dashboard with the right site selected → change their role from supervisor to ehs_manager → remove from a site → confirm last-admin guard fires when removing the only site_admin.
> 3. **Role lifecycle:** create a custom "Auditor (read-only)" role with read-perms on every entity → assign 2 members → confirm UI gates kick in for those members on every page → edit the role to add `incident:report` → confirm the new perm activates without re-login → try to delete the system `worker` role → confirm rejection.

---

## Why this phase

Today the EHS platform requires a Supabase admin to run any of the following:

- Add a sub-site under an existing site.
- Rename or correct a site's address / OSHA establishment ID / NAICS.
- Re-parent a site (e.g., warehouse moves under a new region).
- Archive a site that's been decommissioned (currently impossible — no archive flag exists).
- Update annual hours-worked outside the OSHA 300A flow.
- Invite a colleague onto a site (the `/admin/sites/new` flow grants `site_admin` to the *creator*; there's no surface to grant memberships to anyone else).
- Change a member's role.
- Add a permission to a role (e.g., let supervisors close minor incidents).
- See who is in the org and what they can do.

Each of these is a "Supabase SQL editor" task today. That's fine for a single demo org but blocks any org with a real onboarding (creator → invites colleague → sets them up as the EHS manager → runs first incident). Phase 11 closes the loop so a `site_admin` can run the org without touching Postgres.

This phase also reclaims the four dormant perm keys (`site:configure / member:invite / member:manage / role:edit`) declared in `init.sql` since Phase 0 but never granted to anyone — they were laid down for exactly this surface.

---

## Locked rules this phase must honor

- **Soft-delete is restricted to `incidents / investigations / capas`.** Sites use `archived_at` instead — same UX, different column name, no rule violation.
- **Permission keys are system-defined; admins edit role→perm mapping, not the perm catalog.** `<PermissionChecklist>` is a closed list driven by `select * from permissions`. New perm keys land via migrations, never via UI.
- **CAPA owner ≠ verifier** stays untouched (CAPAs aren't in scope).
- **Workflow engine is server-actions, not DB triggers.** All admin mutations go through RPCs from server actions (the migration adds RLS policies but no trigger functions for business logic).
- **Org-scoped reads can use `'use cache'`; user-scoped reads stay dynamic.** The admin console is mostly user-scoped (per-actor perm gates) so most pages are dynamic; the org-wide member count + site count tiles are good `'use cache'` candidates with `cacheTag('admin:'+orgId)` invalidated on every mutation RPC.
- **Audit append-only.** Every mutation logs to `activity_events`; never UPDATE/DELETE on activity rows.

---

## Sub-PR sequencing

Three PRs land sequentially against `main`:

| # | PR title | Surface | Schema | Notes |
|---|---|---|---|---|
| 1 | `feat(phase-11): sites admin` | `/admin` rebuild + `/admin/sites` + `/admin/sites/[id]` (4 tabs) + sidebar Admin group | `sites.archived_at` + `archived_by` + `archive_reason`; `site:archive` perm; `update_site_v1` + `archive_site_v1` + `unarchive_site_v1` RPCs; sites_update RLS | Annual-hours editor + Setup tab integrate with existing surfaces |
| 2 | `feat(phase-11): members admin` | `/admin/members` + `/admin/members/[profileId]` + member-management modals on `/admin/sites/[id]?tab=members` | `add_site_member_v1` + `remove_site_member_v1` + `change_site_member_role_v1`; site_members_admin RLS | Reuses `<MemberCombobox>` + `<RoleSelect>` |
| 3 | `feat(phase-11): roles + invitations` | `/admin/roles` + `/admin/roles/[id]` + `/admin/invitations` + `/invite/[token]` | `roles.is_system`; `invitations` table; `role:create / role:delete / invitation:read` perms; `create_role_v1 / update_role_v1 / delete_role_v1 / create_invitation_v1 / revoke_invitation_v1 / accept_invitation_v1` RPCs; roles + role_permissions + invitations RLS | Most complex of the three; depends on Supabase auth admin API for the email side of invitations |

Each PR ships with: per-route `loading.tsx`, `error.tsx`, the 10-item Phase 6 polish checklist, brand error card on RPC failures, AlertDialog confirms on archive/delete/remove/revoke, full a11y pass.

---

## Out of scope (logged as deferred)

Add to `docs/SPEC.md` §15 if confirmed during implementation:

- **Cross-org transfer** — single-org-per-user is locked; no UI for moving a profile between orgs.
- **Custom permission keys** — perm keys stay system-defined.
- **Org-level branding** (logo, colors) — Phase 8 Settings or later.
- **Audit-log UI** for admin operations — `activity_events` already captures them; surfacing them is a separate read-only view that can land in Phase 8 or a Phase 12.
- **Country change on a site** — touches the regulatory engine end-to-end (OSHA vs. RIDDOR routing, severity defaults, holiday calendars). Country is set at `/admin/sites/new` and immutable thereafter in v1.
- **Self-service org creation / sign-up flow** — orgs are seeded today; the public sign-up path is a separate workstream.
- **Email-template customization** for invitations — invitations land via the Supabase auth admin API or a hand-rolled SMTP path with a frozen template.
- **Role inheritance / role hierarchy** — flat role list per org. Inheritance is a v3 idea.
- **Bulk operations** (bulk-invite, bulk-archive sites) — single-row UX in v1; CSV import deferred.
- **API tokens / service accounts** — n/a for v1.
- **2FA enforcement** — Phase 8 Settings.

---

## Open questions (resolve before sub-PR #1 starts)

1. **Org-wide invitations vs. site-pinned invitations.** Should an invite without a `site_id` land the invitee on a "no site yet" view (their `site_admin` adds them later), OR auto-add them to a default site? **Recommend: site_id is required on every invitation in v1**, with the path to create one at the site picker inside the modal. Skips the "logged in but no site" cold-state edge case entirely.
2. **Notification kind for invitations.** The `notification_kind` enum has `assigned` but no `invited`. Reuse `assigned` (good enough — "you were assigned to <site>") or add `invited`? **Recommend: add `invited`** (notification copy reads better; one-line migration).
3. **Email delivery for invitations.** Use the Supabase `auth.admin.inviteUserByEmail()` (binds to Supabase's auth flow + emails the user), or hand-roll the email + a magic-link page? **Recommend: Supabase admin invite** for v1 — saves a Resend integration; the `accept_invitation_v1` RPC then runs after the invitee completes their first sign-in. Caveat: the magic-link goes to Supabase's hosted page first, not directly to `/invite/[token]` — confirm this is acceptable.
4. **Last-admin guard scope.** Block removing the last `site_admin` for a *site*, OR block removing the last `site_admin` for the *whole org*? **Recommend: per-site** (matching the granular RBAC model). Confirm with the user.
5. **`is_system` retroactive flag on the 4 default roles.** Should the migration backfill `is_system=true` on the existing 4 seeded roles? **Recommend: yes** (one UPDATE in the migration; the seed already creates them by name, so we match on `roles.key in ('worker','supervisor','ehs_manager','site_admin')`).
6. **Sandbox sites.** The `is_sandbox` flag exists on incidents; does it propagate to sites or stay incident-only? **Recommend: incident-only** (sites have no sandbox state today; touching that is its own decision).
7. **Site archive cascade.** When a site is archived, do any of its dependent rows (`site_annual_hours`, `site_members`, `templates_assignments`, `notification_recipients`) get hidden from non-admin reads? **Recommend: site_members stays visible to admins (so archive is recoverable), everything else respects RLS via `sites.archived_at` join (membership-derived reads filter out archived sites for non-admin users).** Confirm this read-time filter is correct vs. a more aggressive "hide from everyone" approach.
8. **Phase 8 (Settings + Members) overlap.** This phase absorbs the "Members" half of the original Phase 8 reservation. Phase 8's surface area shrinks to "Settings: account preferences, notification prefs, profile editing." **Action:** update `project_phase_6_status.md` + the 6l plan + memory accordingly.

---

## Definition of done — phase level

- All 3 sub-PRs merged on `main`.
- Stale `/admin` `EmptyState` replaced with the rebuilt landing.
- The 4 dormant perm keys + 4 new perm keys are granted to the right default roles.
- `archive_site_v1` exercised cleanly: archived site disappears from non-admin views; un-archive restores it.
- A sign-in via `/invite/[token]` lands on `/dashboard` with the invited site already selected via cookie.
- Role permissions can be edited and the new perms take effect on subsequent server-action calls without a re-login (RLS reads `has_permission` live).
- The system roles (`worker / supervisor / ehs_manager / site_admin`) can have permissions added but cannot be deleted or renamed.
- `docs/smoke-test-phase11.md` re-runs green on a fresh seed.
- `CLAUDE.md` build-status block + memory updated with the merged-PR line per sub-PR.
- `docs/SPEC.md` §15 logs every Open Question's resolution.
- All 8 routes pass the Phase 6 polish 10-item checklist (visual / empty / loading / error / responsive / a11y / form-error / copy / dark mode / Cache Components).

Phase 11 explicitly does NOT include: org-creation UI, custom perm keys, email-template customization, audit-log read-views, country mutation on sites, sandbox sites, role hierarchy, bulk operations, API tokens, 2FA.
