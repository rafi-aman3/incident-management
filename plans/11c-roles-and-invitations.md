# Phase 11c — Roles editor + Invitations (sub-PR #3 of 3)

**Status:** drafted 2026-05-07 (parent: `plans/11-sites-management.md`; predecessors: 11a sites admin PR #14, 11b members admin PR #15 — both merged 2026-05-07)
**Goal:** Land the third and final Phase 11 sub-PR. Ships the role editor (so org owners can extend the 4 default roles' permission sets and create new custom roles per the locked RBAC rule), the invitations table + `/invite/[token]` accept flow (so the "Invite member" CTA stops being a placeholder and an admin can email-invite a colleague who isn't yet on the platform), and the third dormant pair of perm keys (`role:create`, `role:delete` — `role:read`/`role:edit` already exist; `invitation:read` is new).
**Branch:** `feat/phase-11-roles-and-invitations`
**PR target:** `main`
**Parent plan:** `plans/11-sites-management.md`
**Depends on:**
- Phase 11a (PR #14, merged 2026-05-07).
- Phase 11b (PR #15, merged 2026-05-07).
- The dormant `role:edit` perm key declared in `init.sql:124` since Phase 0.
- Supabase project's auth admin API + email transport (project already configured).

> **What this sub-PR ships:**
>
> ### Schema (one migration: `20260514120000_phase11c_roles_and_invitations.sql`)
> - **No new column on `roles`** — the table already has `is_default boolean not null default false`, set to `true` for the 4 seeded roles via `seed_default_roles()`. We use that column for the "can't rename or delete" guard. (The parent plan called this `is_system` — same intent, different column name; we reuse what's there.)
> - New `invitations` table:
>   ```sql
>   create table invitations (
>     id                uuid primary key default gen_random_uuid(),
>     org_id            uuid not null references orgs(id) on delete cascade,
>     site_id           uuid not null references sites(id) on delete cascade,
>     role_id           uuid not null references roles(id) on delete restrict,
>     include_children  boolean not null default false,
>     email             text not null,
>     token             text not null unique,
>     expires_at        timestamptz not null default (now() + interval '14 days'),
>     invited_by        uuid references profiles(id) on delete set null,
>     accepted_at       timestamptz,
>     revoked_at        timestamptz,
>     created_at        timestamptz not null default now()
>   );
>   create unique index invitations_pending_email_per_site_idx
>     on invitations (site_id, lower(email))
>     where accepted_at is null and revoked_at is null;
>   create index invitations_org_pending_idx on invitations(org_id)
>     where accepted_at is null and revoked_at is null;
>   create index invitations_token_idx on invitations(token);
>   ```
>   The partial unique index lets re-inviting after accept/revoke succeed; only one *pending* invitation per (site, email) at a time.
> - **3 new perm keys:**
>   - `role:create` — make a new custom role.
>   - `role:delete` — delete a custom role (system roles are protected at the RPC).
>   - `invitation:read` — view the org-wide pending invitations list.
> - **Grants:** `site_admin` picks up all 3. `ehs_manager` picks up `invitation:read` only (so they can see what's pending without issuing or revoking — `member:invite` from 11b is what gates create/revoke).
> - **`notification_kind` enum** — append `invited` value (matches the parent plan recommendation: cleaner copy than reusing `assigned`).
> - **RLS additions:**
>   - `roles_admin_insert` / `roles_admin_update` / `roles_admin_delete` policies — gated on org-wide perm via `has_org_permission` (an existing helper from Phase 3 — `lib/rbac/permissions.ts` already references it via `resolve_org_permissions`).
>   - `role_permissions_admin_insert` / `role_permissions_admin_delete` policies — gated through the parent role's `org_id`.
>   - `invitations` four policies: `read` (by `invitation:read` org-wide), `insert` (by `member:invite` on the target site), `update` only on the `revoked_at` column (by `member:invite` on the site), no delete (append-only audit).
>
> ### Atomic RPCs (security-definer)
> - `create_role_v1(p_name, p_description?, p_permission_keys text[])` — gates on `has_org_permission('role:create')`; rejects when `(org_id, key)` would collide; generates a kebab-case `key` from the name (slug + numeric suffix if needed); validates every entry in `p_permission_keys` exists in the `permissions` catalog (rejects unknown keys); inserts `roles` + bulk-inserts `role_permissions`; sets `is_default = false`. Returns the new `role_id`.
> - `update_role_v1(p_role_id, p_name?, p_description?, p_permission_keys text[])` — gates on `has_org_permission('role:edit')`. **`is_default = true` rows: name is locked but description + permission_keys are editable.** Replace-set semantics on `role_permissions` (delete then insert all). Logs `role.updated` to `activity_events`.
> - `delete_role_v1(p_role_id)` — gates on `has_org_permission('role:delete')`. Rejects when `is_default = true` (system roles are eternal). Rejects when any `site_members.role_id = p_role_id` exists. Logs `role.deleted`.
> - `create_invitation_v1(p_site_id, p_email, p_role_id, p_include_children?)` — gates on `has_permission('member:invite', p_site_id)`. Rejects when an existing org profile already has the email (forces the admin to use the per-site Members tab — no double-path). Revokes any prior pending invitation for the same `(site_id, email)` before inserting (so re-invite cleanly bumps the token + expiry). Generates `token` via `encode(gen_random_bytes(32), 'hex')` (64 chars). Returns `{ invitation_id, token }` so the calling Server Action can both display the link AND trigger Supabase auth admin invite. Logs `invitation.created`.
> - `revoke_invitation_v1(p_invitation_id)` — gates on `has_permission('member:invite', site_id)` (resolved via the invitation row). Sets `revoked_at`. Logs `invitation.revoked`.
> - `accept_invitation_v1(p_token)` — special: **NOT** gated on a permission (the inviting admin doesn't need to be the accepting user). Validates: not-expired (`expires_at > now()`), not-accepted, not-revoked, the calling auth user's email matches `lower(invitations.email)`. Calls `add_site_member_v1(site_id, auth.uid(), role_id, include_children)` to land the membership. Sets `accepted_at`. Returns `{ org_id, site_id, site_name }` for the redirect copy. Logs `invitation.accepted`.
>
> ### Routes (4 new)
> 1. **`/admin/roles`** — list of org roles.
>    - Header band ("Roles · N total"); top-right "+ New role" gated on `role:create`.
>    - Columns: Name (with "system" chip when `is_default`) · Description · Permissions count · Members count · Created.
>    - Filter chip: System / Custom / All (default All). URL-driven `?type=`.
>    - Sort: system roles first (`is_default desc, name asc`).
>    - Per-row click → `/admin/roles/[id]`.
> 2. **`/admin/roles/[id]`** — role editor:
>    - Header: role name + system chip + member count.
>    - Tabs (URL `?tab=permissions|members`, default `permissions`):
>      - **Permissions**: grouped checklist (sections: `incident:* / investigation:* / capa:* / template:* / inspection:* / asset:* / document:* / planner:* / report:* / member:* / role:* / site:* / notification:* / team:* / demo:*`). Each section is collapsible; group header shows "Selected N / M". Save button + dirty-state ("3 unsaved changes"). Save calls `update_role_v1` with the full keys array (replace-set).
>      - **Members**: read-only list of profiles assigned to this role across the org. Per-row link to `/admin/members/[profileId]` (Phase 11b). Useful for "who am I about to affect" before saving.
>    - Bottom-right "Delete role" button gated on `role:delete && !is_default && member_count === 0`. Confirm via shadcn `<AlertDialog>`. (Per parent-plan recommendation.)
>    - For `is_default = true` rows: Name field is read-only with helper "System roles can't be renamed."; Delete button is hidden entirely (not just disabled).
>    - For new role flow: `/admin/roles?action=new` opens a modal (combobox-less form: name + optional description + permission checklist starts empty); on submit calls `create_role_v1` and redirects to the new role's edit page.
> 3. **`/admin/invitations`** — pending invitations list:
>    - Columns: Email · Site · Role · Invited by · Expires in · Status (pending / expired / accepted / revoked).
>    - Default filter: pending only. URL `?status=pending|all` (accepted + revoked rolled into "all" since they're terminal).
>    - "+ Invite member" button (gated `member:invite`) opens an `<InviteMemberDialog>` (email + site combobox + role + include_children). Same modal opens from `/admin/members` "+ Invite member" CTA — replaces the 11b placeholder.
>    - Per-row Resend (creates a fresh token via re-running `create_invitation_v1`; revokes the prior) + Revoke (calls `revoke_invitation_v1`) actions.
>    - Each pending row carries a "Copy link" affordance — the absolute URL `<APP_URL>/invite/<token>` — so an admin in a dev environment without configured SMTP can hand the link off out-of-band.
> 4. **`/invite/[token]`** — public-ish invitation accept page (no `requireUser` gate; the accept RPC enforces email match):
>    - Loads invitation by token (single query, no auth context yet).
>    - **Branch on auth state:**
>      - **Unauthenticated** → render a friendly card: "<Inviter> invited you to <Site> at <Org>. Sign up or log in with <invited-email> to accept." with two CTAs: "Create an account" (links to a sign-up page that pre-fills the email) and "Log in" (links to `/login`). Behind the scenes, the auth pages preserve the `?redirect_to=/invite/<token>` so we land back here after the user authenticates.
>      - **Authenticated, email matches** → render an "Accept invitation to <Site>?" card; clicking Accept calls `accept_invitation_v1(token)` → on success sets the `selected_site` cookie to the new site → redirects to `/dashboard?invited=<site_name>` (Sonner toast on dashboard).
>      - **Authenticated, email does NOT match** → "This invitation is for `<masked-invited-email>`. Sign in as that user to accept." Sign-out CTA + log-in-as-someone-else CTA.
>    - **Edge cases:** expired (terminal "This invitation expired on <date>. Ask your admin to send a new one."); already-accepted ("You already accepted this invitation. Click here to go to <Site>."); revoked ("This invitation was revoked. Ask your admin if this is a mistake.").
>
> ### Components (new, under `components/admin/`)
> - `permission-checklist.tsx` — grouped checklist primitive with section headers + "selected N/M" counts + collapse/expand. Driven by a flat `permissions` catalog passed in from the page (read from `select * from permissions`). Selected-state lives in client state until Save.
> - `role-list.tsx` — table primitive for `/admin/roles`.
> - `role-filters.tsx` — `?type=` chip + sort.
> - `new-role-dialog.tsx` — `?action=new` modal: name + description + initial permission checklist.
> - `delete-role-dialog.tsx` — `<AlertDialog>` confirm for role deletion (only ever shown when guards pass).
> - `invite-member-dialog.tsx` — email + site combobox + role + include_children. On submit: calls `create_invitation_v1` server action, displays the resulting `<APP_URL>/invite/<token>` link in the modal post-success (with Copy button) AND triggers the optional Supabase auth admin invite email path (best-effort — the link is the source of truth).
> - `invitations-list.tsx` — table primitive for `/admin/invitations`.
> - `accept-invitation-card.tsx` — the body of `/invite/[token]` (handles all 3 branches above).
>
> ### Server actions
> - `app/(app)/admin/roles/actions.ts` — `createRole` + `updateRole` + `deleteRole` (wraps the 3 role RPCs).
> - `app/(app)/admin/invitations/actions.ts` — `createInvitation` + `revokeInvitation` + `acceptInvitation`. The create action also tries `supabaseAdmin.auth.admin.inviteUserByEmail({ email, options: { redirectTo: '<APP_URL>/invite/<token>' } })` after the RPC succeeds — best-effort; the link returned by the RPC is always shown to the admin regardless.
> - `app/(app)/admin/page.tsx` — small edit: flip the Roles card from "Phase 11c" placeholder to live link.

---

## Why this sub-PR

11a + 11b closed the gaps for sites and members. The remaining gaps for full org-admin self-service:

1. **Role permission editing.** The locked RBAC rule says "org owners can edit role permission sets." Today that requires SQL. After 11c, `site_admin` users can extend the 4 default roles' permission sets and create custom roles (e.g. "Auditor read-only") through `/admin/roles/[id]`.
2. **Email invitations for not-yet-signed-up users.** 11b's `invite_member_to_site_v1` only resolves existing org profiles; it raises a guidance error for new emails. The 11b UI explicitly says "Email invitations ship in Phase 11c" everywhere it matters. 11c lands the `invitations` table + `/invite/[token]` accept flow + Supabase auth admin invite integration.

These two pieces complete the org-admin console story. After 11c, every org-admin task that today requires the Supabase SQL editor has a UI path.

---

## Locked-rule honors

- **Permission keys are system-defined.** The `<PermissionChecklist>` is a closed list driven by `select * from permissions`. The 3 new keys (`role:create / role:delete / invitation:read`) land via the migration, never via UI.
- **System roles can't be renamed or deleted.** `is_default = true` rows: name is read-only in the form; Delete is hidden. RPCs enforce both (defense in depth).
- **Audit append-only.** Role + invitation lifecycle events go to `activity_events`: `role.created / role.updated / role.deleted / invitation.created / invitation.revoked / invitation.accepted`.
- **No country mutation, no soft-delete on incidents/investigations/capas, no perm catalog edits via UI** — all 11a + 11b rules unchanged.

---

## Resolved open questions (from the parent plan)

- **#1 Org-wide vs. site-pinned invitations** → **site_id is required on every invitation.** No "join org and we'll figure out a site later" path. Matches the 11b `invite_member_to_site_v1` shape and avoids the "logged in but no site" cold-state.
- **#2 Notification kind for invitations** → **add `invited` to the `notification_kind` enum** in this migration. Cleaner copy than reusing `assigned`. The notification engine fires on `invitation.created` and the recipient sees an in-app bell entry.
- **#3 Email delivery** → **Supabase auth admin invite via `auth.admin.inviteUserByEmail()`**, with the absolute `/invite/<token>` URL passed as `redirectTo`. The action also returns the link directly so admins on dev orgs without SMTP can copy-paste it. Best-effort: an SMTP failure doesn't block the RPC success.
- **#4 Last-admin guard scope** → already resolved in 11b (per-site).
- **#5 `is_system` backfill** → **n/a** — using the existing `roles.is_default` column instead of adding `is_system`. Same semantic; 4 default roles already have `is_default = true` from `seed_default_roles()`.
- **#6 Sandbox sites** → already deferred (incident-only for v1).
- **#7 Archive-cascade read filter** → already resolved in 11a.
- **#8 Phase 8 ripple** → resolved in 11b (the `/members` redirect already lands users on `/admin/members`). Phase 8 stays = Settings/account preferences only.

---

## What's NOT in this sub-PR (defers to v2)

- **Role hierarchy / inheritance** — flat role list per org. Inheritance is a v3 idea.
- **Bulk operations** — single-row UX for create / edit / delete / invite. CSV import deferred.
- **Custom permission keys** — perm catalog stays system-defined.
- **Audit-log read view** of role + invitation operations — events go to `activity_events` already; surfacing them is a separate decision.
- **2FA enforcement on accept** — Phase 8 Settings.
- **Organisation transfer** (move a profile between orgs) — single-org-per-user is locked.
- **Email-template customization** — uses the default Supabase auth admin invite template in v1.
- **Resend-cooldown / rate-limiting** on invitation re-sends — v2.

---

## Definition of done

1. Migration applies cleanly. Types regenerated include the 6 new RPCs + the `invitations` table.
2. Six RPCs testable from the SQL editor with the standard `{ status, error }` semantics.
3. **Role lifecycle:** create a custom "Auditor (read-only)" role from `/admin/roles?action=new` → assign 1 member to it via `/admin/sites/[id]?tab=members` change-role flow → confirm UI gates kick in for that member → edit the role to add `incident:read_site` → confirm the new perm activates without re-login.
4. **System role lifecycle:** open the `worker` role's editor → name field is read-only + Delete button is hidden → permission set IS editable (add `incident:read_site` to make workers able to see all site incidents) → Save → confirm RLS reads `has_permission` live with the new grant.
5. **Invitation lifecycle:**
   - From `/admin/invitations` "+ Invite member", invite an email NOT in the org → modal shows the `<APP_URL>/invite/<token>` link with Copy button.
   - In an incognito window, paste the link → unauth branch renders → click "Create an account" → sign up with the matching email → land back on `/invite/<token>` → accept → land on `/dashboard?invited=<site_name>` with the right site selected.
   - From `/admin/invitations`, revoke a pending invitation → opening that link shows the "revoked" branch.
   - Re-invite the same email → token + expires_at refresh; the prior pending row is revoked.
6. After the migration, `site_admin` users see the Roles + Invitations affordances for the first time. `ehs_manager` users see Invitations (read-only) and the Invite-member CTA but not Roles.
7. The 6l `/members` redirect (from 11b) plus the new "+ Invite member" path on both `/admin/members` and `/admin/invitations` are wired and consistent.
8. `loading.tsx` + `error.tsx` ship for `/admin/roles`, `/admin/roles/[id]`, `/admin/invitations`, `/invite/[token]`.
9. Phase 6 polish 10-item checklist passes for all new routes.
10. Smoke-test guide at `docs/smoke-test-phase11c.md` covers the role + invitation lifecycles end-to-end.
11. `CLAUDE.md` build-status block + memory updated; the parent `plans/11-sites-management.md` open-questions log marks every question as resolved.
12. Phase 11 closes: `project_phase_11_sites_management.md` flips to "shipped" status.

---

## Open questions for the user (resolve before I start writing code)

1. **`ehs_manager` invitation visibility.** I propose granting `invitation:read` to both `site_admin` and `ehs_manager` (so EHS managers can see what's pending) but **only `member:invite` (from 11b) lets them issue invitations**. **Recommend: yes — keep visibility broad, action narrow.** Confirm.
2. **Token URL surface.** The accept URL is `<APP_URL>/invite/<token>` where `<token>` is 64 hex chars. Should the marketing/landing page expose `/invite/<token>` to anonymous users (the page handles unauth) or 404 unauthenticated visitors? **Recommend: handle unauth gracefully** (the page is the entry point for new sign-ups; 404 would break the email flow).
3. **Email delivery fallback.** Best-effort Supabase auth admin invite + always-show-the-link in the modal so dev orgs work. **Recommend: that combo.** A more aggressive option is to gate the Save button on the email send succeeding — but that ties UX to SMTP availability, which feels wrong.
4. **`is_default` role rename.** The parent plan said "`is_default` rows: name locked, permission set editable." Confirm: name is fully read-only on the edit form; description IS editable. (Description is harmless metadata.)
5. **Role delete with members.** The RPC rejects `delete_role_v1` when any `site_members.role_id = role_id` exists. The UI surfaces this as a disabled Delete button + a "<N> members hold this role — change their role first" helper. **Recommend: that, no force-reassign in v1.**
6. **Permission catalog versioning.** `permissions` table is a flat list today. As we add modules in future phases, new keys land via migrations. The role editor reads `select * from permissions` live, so newly-added keys appear immediately without code changes to the editor — but a freshly-loaded edit form won't show the new key until the user reloads. **Recommend: live read** (current behavior). Reload-to-see-new-perms is acceptable for v1; SSE / live-subscribe is a v2 idea.

---

## File-level scope (concrete)

```
supabase/migrations/20260514120000_phase11c_roles_and_invitations.sql       [new]

app/(app)/admin/roles/page.tsx                                              [new]
app/(app)/admin/roles/loading.tsx                                           [new]
app/(app)/admin/roles/error.tsx                                             [new]
app/(app)/admin/roles/actions.ts                                            [new]
app/(app)/admin/roles/[id]/page.tsx                                         [new]
app/(app)/admin/roles/[id]/loading.tsx                                      [new]
app/(app)/admin/roles/[id]/error.tsx                                        [new]

app/(app)/admin/invitations/page.tsx                                        [new]
app/(app)/admin/invitations/loading.tsx                                     [new]
app/(app)/admin/invitations/error.tsx                                       [new]
app/(app)/admin/invitations/actions.ts                                      [new]

app/(public)/invite/[token]/page.tsx                                        [new — note (public) layout]
app/(public)/invite/[token]/actions.ts                                      [new]
app/(public)/invite/[token]/loading.tsx                                     [new]

app/(app)/admin/page.tsx                                                    [edit — flip Roles card]
app/(app)/admin/members/page.tsx                                            [edit — wire the "+ Invite member" CTA]

components/admin/permission-checklist.tsx                                   [new]
components/admin/role-list.tsx                                              [new]
components/admin/role-filters.tsx                                           [new]
components/admin/new-role-dialog.tsx                                        [new]
components/admin/delete-role-dialog.tsx                                     [new]
components/admin/invite-member-dialog.tsx                                   [new]
components/admin/invitations-list.tsx                                       [new]
components/admin/accept-invitation-card.tsx                                 [new]

lib/rbac/permissions.ts                                                     [edit — add 3 new keys to the union]

docs/smoke-test-phase11c.md                                                 [new]
```

Total: 1 migration · 11 new routes (4 main + loading/error per) · 2 surgical edits · 8 new components · 1 perm-union update · 1 smoke-test guide. Largest of the 3 sub-PRs (matches the parent plan's "11c is the heaviest" expectation).
