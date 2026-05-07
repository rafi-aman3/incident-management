# Phase 11c smoke test — Roles editor + Invitations

Walk this end-to-end before merging the 11c PR. Surfaces should match the
expectations laid out in `plans/11c-roles-and-invitations.md`. Run on the
demo `UCB` org so the catch-all on `seed_default_roles` already grants
`role:create / role:delete / invitation:read` to `site_admin`.

## Pre-flight

1. `pnpm db:check` — confirm 4 demo accounts exist, all with valid memberships.
2. `pnpm dev` — boot the app at http://localhost:3000.
3. Sign in as **`site_admin@ucb.test`**. Selected site should be Houston.

## Part A — Roles editor

### A1. Roles list visibility

- [ ] Open `/admin`. Confirm the **Roles** card (4th admin tile) is now a live
      link (was "Phase 11c" placeholder pre-merge).
- [ ] Confirm a 5th KPI tile **Pending invites** appears next to Roles.
- [ ] Click into `/admin/roles`. The 4 default roles render with the **System**
      chip and a system count = 4 in the header.
- [ ] Filter chips: **All** / **System** / **Custom** work correctly. Search by
      name filters live (Enter to commit).

### A2. System role: edit permissions but not name

- [ ] Click the **Worker** row → land on `/admin/roles/<worker-id>?tab=permissions`.
- [ ] Confirm the Name field is **disabled** with helper text
      "System roles can't be renamed."
- [ ] The PermissionChecklist groups by entity prefix (Sites / Members / Roles
      / etc.). Each group shows `selected / total` and is collapsible.
- [ ] Tick **`incident:read_site`** on for Worker. Header pill flips to
      **"1 unsaved change"** in amber.
- [ ] Click **Save changes**. Sonner success toast: "Role updated".
- [ ] Reload the page → the new perm persists.
- [ ] Bottom-right **Delete role** button is **hidden** (system role guard).

### A3. Custom role lifecycle

- [ ] Back on `/admin/roles`, click **+ New role** in the header.
- [ ] Name = `Auditor (read-only)`, description = `Read-only access for
      external auditors`. Tick `incident:read_site`, `report:read`,
      `inspection:read_site`.
- [ ] Submit → toast "Role created" → redirect to
      `/admin/roles/<auditor-id>?tab=permissions` with the 3 perms checked.
- [ ] Switch to **Members** tab → renders empty state "No members hold this
      role yet."
- [ ] Bottom-right **Delete role** button is visible (custom role + 0 members).
- [ ] Click Delete → AlertDialog confirm → submit → redirect to
      `/admin/roles`. The row is gone.

### A4. Custom role with member: delete is gated

- [ ] Re-create the **Auditor (read-only)** role with the same 3 perms.
- [ ] Open `/admin/sites/<houston-id>?tab=members` → click **Change role** on
      `worker@ucb.test` → pick **Auditor (read-only)** → Save.
- [ ] Back on `/admin/roles/<auditor-id>?tab=permissions`. Delete button is
      now **disabled** with `title` showing "1 member(s) hold this role —
      change their role first."
- [ ] Switch to **Members** tab → see Worker with their Houston membership
      listed.
- [ ] Reset: change Worker's role back to `worker`. Delete the Auditor role.

### A5. Permission catalog includes new keys

- [ ] On any role's Permissions tab, the **Roles** group shows
      `role:create`, `role:delete`, `role:edit`, `role:read` (4 entries).
- [ ] The **Invitations** group shows `invitation:read` (1 entry).

## Part B — Invitations

### B1. Pending list shows freshly-issued invites

- [ ] Open `/admin/invitations`. Empty state: "No invitations match these
      filters." (No demo invitations seeded.)
- [ ] Click **+ Invite member** in the header.
- [ ] Email = `auditor@external.test`, Site = Houston, Role = Worker. Submit.
- [ ] **Success panel** appears: shows `<APP_URL>/invite/<token>` with a
      Copy button. Email may report "delivery failed" depending on local
      Supabase SMTP config — that's expected.
- [ ] Click **Done**.
- [ ] List now shows 1 row with status **Pending** and "14 days left".

### B2. Accept flow — happy path (unauth → sign up → land)

- [ ] Copy the accept URL from the row's **Copy link** action.
- [ ] Open an **incognito window**. Paste the URL → unauthenticated branch
      renders: "You're invited to Houston · Sign up or log in with
      auditor@external.test to accept."
- [ ] Click **Log in or sign up** → routes to
      `/login?redirect_to=/invite/<token>&email=auditor@external.test`.
- [ ] Sign up with that exact email (or use Supabase Studio to create the
      auth user manually).
- [ ] After auth lands → redirect back to `/invite/<token>` → ready branch
      ("Accept invitation to Houston?") → click **Accept and continue**.
- [ ] Land on `/dashboard?invited=Houston` with a Sonner toast
      "Welcome to Houston · You're now a member…"
- [ ] Selected site cookie is `houston-id`. The Houston dashboard renders.

### B3. Re-invite bumps the token

- [ ] Back as `site_admin`, on `/admin/invitations`, invite the same email
      again. Confirm the prior pending row is **revoked** (gone from
      Pending filter; appears in **All** with status Revoked).
- [ ] The new row has a **fresh expires_at** (~14 days out).

### B4. Revoke flow

- [ ] Issue a fresh invitation to `revoked@external.test`.
- [ ] Click **Revoke** on the row. Toast "Invitation revoked".
- [ ] Filter All → the row's status flips to **Revoked**.
- [ ] Open the (revoked) accept URL in incognito → "This invitation was
      revoked" branch.

### B5. Expired branch

- [ ] In Supabase SQL editor: `update invitations set expires_at = now() - interval '1 day'
      where email = 'expired@external.test';` (after issuing one).
- [ ] Open the accept URL in incognito → "This invitation expired on …"
      branch.

### B6. Mismatch branch

- [ ] Sign in as `site_admin@ucb.test` (admin's own email).
- [ ] Open an accept URL issued to `auditor@external.test` while signed in.
- [ ] Confirm the **Wrong account** branch renders with the masked invited
      email + a Sign out CTA.

### B7. Email match guard at RPC

- [ ] In SQL editor, manually call `accept_invitation_v1(<token>)` while
      signed in as a user whose email doesn't match the invitation. Confirm
      the RPC raises "This invitation is for a different email."

### B8. Existing-org-profile rejection

- [ ] Try to invite `worker@ucb.test` (already in the org).
- [ ] Confirm the dialog surfaces "A user with that email is already in your
      org. Use the Members tab to add them to this site."

## Part C — Permission gates

### C1. ehs_manager — read-only on Invitations

- [ ] Sign in as `ehs_manager@ucb.test`. Houston selected.
- [ ] `/admin` is reachable. Roles + Invitations cards both show.
- [ ] `/admin/invitations` opens. The **+ Invite member** button **is**
      rendered because `ehs_manager` holds `member:invite` on Houston.
- [ ] `/admin/roles` opens (read-only `role:read` is a default ehs_manager
      perm). The **+ New role** button is **hidden**.
- [ ] On any role detail, Save attempts surface a toast error from the RPC
      ("You do not have permission to edit roles") — `role:edit` is not
      granted to ehs_manager by default.

### C2. supervisor — admin landing redirects to /

- [ ] Sign in as `supervisor@ucb.test`. Houston selected.
- [ ] `/admin/roles` route → redirected to `/admin` (supervisor doesn't hold
      `role:read` on the org by default; if `role:read` is granted via
      `seed_default_roles`, the page renders read-only).
- [ ] `/admin/invitations` → redirects to `/admin` (no `invitation:read`).

### C3. worker — fully gated

- [ ] Sign in as `worker@ucb.test`. Houston selected.
- [ ] `/admin` → empty state "Admin is for site admins". (No
      `site:configure` / `member:invite` / `role:read` /
      `invitation:read`.)

## Part D — Audit trail

- [ ] In SQL editor:
      `select verb, payload from activity_events where verb like 'role.%' or verb like 'invitation.%' order by created_at desc limit 20;`
- [ ] Confirm entries for: `role.created` · `role.updated` (with
      `old_permission_keys` + `new_permission_keys`) · `role.deleted` ·
      `invitation.created` (with `email` + `site_id`) ·
      `invitation.revoked` · `invitation.accepted`.

## Part E — DB sanity

- [ ] `select key, description from permissions where key in
      ('role:create','role:delete','invitation:read')` returns 3 rows.
- [ ] `select count(*) from role_permissions rp join roles r on r.id =
      rp.role_id where r.key = 'site_admin' and rp.permission_key in
      ('role:create','role:delete','role:edit','invitation:read');` returns
      4 (one per UCB site_admin role × 4 perms = 4 in single-org demo).
- [ ] `select unnest(enum_range(null::notification_kind))` includes
      `'invited'`.
- [ ] On `invitations`, the partial unique index allows re-inviting after
      revoke or accept.

## Part F — Polish checklist

- [ ] `loading.tsx` renders for /admin/roles · /admin/roles/[id] ·
      /admin/invitations · /invite/[token].
- [ ] `error.tsx` renders + Try again resets for the 3 admin routes.
- [ ] All routes have `aria-current` on the active tab where applicable
      (role detail Permissions / Members tabs).
- [ ] No raw `bg-amber-100/950` literals in new code (use the `warning`
      tokens or the existing tone helpers).

If every step passes — squash + merge the PR. Phase 11 closes here.
