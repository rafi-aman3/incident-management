# Phase 11a — Sites admin (sub-PR #1 of 3)

**Status:** drafted 2026-05-07 (parent: `plans/11-sites-management.md`)
**Goal:** Land the sites half of the Phase 11 admin console: rebuild `/admin` from its stale "Coming in Phase 3" `EmptyState`, ship the org-wide `/admin/sites` table + tree, ship the per-site `/admin/sites/[id]` 4-tab detail (Overview / Members read-only / Annual hours / Setup), wire the lifecycle (edit, archive, unarchive) through 3 atomic RPCs, and grant the dormant `site:configure` perm key to `site_admin` + `ehs_manager` so the Admin sidebar entry actually surfaces. Members editing + role editing land in sub-PRs 11b + 11c.
**Branch:** `feat/phase-11-sites-admin`
**PR target:** `main`
**Parent plan:** `plans/11-sites-management.md`
**Depends on:** Phase 6a `create_site_v1` RPC (already shipped). The dormant `site:configure` perm key declared in `init.sql:120` since Phase 0.

> **What this sub-PR ships:**
>
> ### Schema (one migration: `2026XXXXXXXXXX_phase11a_sites_admin.sql`)
> - `alter table sites add column archived_at timestamptz`
> - `alter table sites add column archived_by uuid references profiles(id) on delete set null`
> - `alter table sites add column archive_reason text`
> - `insert into permissions ('site:archive', 'Archive a site (and unarchive it)')`
> - **Grants:**
>   - `site_admin` — picks up `site:configure` + `site:archive`
>   - `ehs_manager` — picks up `site:configure`
>   - `supervisor / worker` — unchanged
> - **RLS:**
>   - New `sites_update` policy: `for update to authenticated using (org_id = current_org() and has_permission('site:configure', id)) with check (org_id = current_org() and has_permission('site:configure', id))`. Archive writes ride this same policy because `archived_at` is just a column on `sites` — but the *RPC* gates on `site:archive` separately so an EHS manager (configure ✓ archive ✗) can edit but not archive.
>   - Existing `sites_read` policy stays — already filters on `user_can_access_site`. Add a wrapper read-filter: queries that hit `sites` for non-admin views skip rows where `archived_at is not null`. Implemented at the query level (not RLS) so admins can still read archived sites by passing an explicit `?status=archived` filter.
>
> ### Atomic RPCs (security-definer)
> - `update_site_v1(p_site_id, p_name?, p_address?, p_region?, p_timezone?, p_osha_establishment_id?, p_naics_code?, p_parent_site_id?)` — gates on `has_permission('site:configure', p_site_id)`; rejects parent re-parent that would create a cycle (recursive ancestor walk); rejects parent change to a site in a different org; rejects a parent that is itself archived. Logs `site.updated` to `activity_events` with the diff payload. Country is **never** mutated (passed in as immutable; v2 in SPEC §15).
> - `archive_site_v1(p_site_id, p_reason?)` — gates on `has_permission('site:archive', p_site_id)`; rejects when the site has any non-archived child (surfaces actionable error: "Archive child sites first: <names>"); sets `archived_at = now() + archived_by = auth.uid() + archive_reason`. Logs `site.archived` with the reason payload.
> - `unarchive_site_v1(p_site_id)` — gates on `has_permission('site:archive', p_site_id)`; rejects when the site's parent is itself archived (you can't un-archive a child whose parent is gone). Clears the three archive columns. Logs `site.unarchived`.
>
> ### Routes
> 1. **`/admin`** — replaces the EmptyState with an admin landing dashboard:
>    - Header band ("Admin · Org configuration").
>    - 4 KPI tiles (active sites count · archived sites count · members count · roles count). Each tile is a server-side count with `cacheTag('admin:'+orgId)`.
>    - 3 link cards: Sites (live in this PR), Members (placeholder card with "Coming in 11b" copy + a link to `/admin/sites/<current>?tab=members` for the per-site members read-only view that we ship in this PR), Roles (placeholder card with "Coming in 11c" copy).
>    - Bottom row: existing `/admin/demo` and `/admin/site-setup/[step]` deep-links preserved.
>    - Permission gate: shown to anyone with `site:configure` OR `member:invite` OR `role:read` (any one). Actual surface widgets gate further by perm.
> 2. **`/admin/sites`** — org-wide site list:
>    - Header band ("Sites · N active · M archived"); top-right "+ Add site" links to existing `/admin/sites/new`.
>    - View toggle (URL-driven): **Table** (default) and **Tree**.
>    - **Table**: columns `Name · Country · Region · Members · Last incident · Setup status · Lifecycle pill` (Active / Archived). Per-row actions popover: Edit · Manage members (links to `?tab=members`) · Archive (or Unarchive). Click row → detail.
>    - **Tree**: nested-list rendering using BFS, indentation per depth, expand/collapse per branch. Same row data as table, condensed.
>    - Filters: `?status=active|archived|all` (default active), `?country=US|GB|all`, `?q=<name>`. URL-driven; back/forward preserves state.
>    - Empty state: "No sites match these filters." with a Reset link.
>    - `loading.tsx` skeleton; brand `error.tsx` card with retry.
> 3. **`/admin/sites/[id]`** — site detail with 4 tabs (`?tab=overview|members|hours|setup`, default overview):
>    - Header: site name + country flag + lifecycle pill + "← Back to sites" breadcrumb. Action cluster (right): "Archive" (or "Unarchive"; gated on `site:archive`).
>    - **Overview tab** (the meat of this sub-PR): editable form with fields `name · address · region · timezone · osha_establishment_id (US-only — hidden for GB) · naics_code (US-only) · parent_site_id (combobox of org sites including "no parent")`. Country shown read-only with explainer "Country is set at creation and locks the regulatory engine. To change country, archive this site and create a new one." Save calls `update_site_v1`; renders the standard `{ ok, error, fieldErrors }` result with field-level + form-level errors; success → toast + `router.refresh()`.
>    - **Members tab** (read-only in this PR — full edit ships in 11b): table of `site_members` (profile name + email + role + include_children + since). Header note: "Member editing ships in the next admin PR. To add a member today, run `add_site_member_v1` from the SQL editor." (yes, that copy is intentionally a forcing function — it's the only honest answer until 11b lands.)
>    - **Annual hours tab**: per-year `site_annual_hours` editor. Lifted from `app/(app)/reports/osha-300a/`. Reusable component `<AnnualHoursEditor>` so OSHA 300A keeps the same UX. Year row inline-edit + "+ Add year" + delete year (soft via `delete from site_annual_hours where (site_id, year) = ...`; this row has no audit constraint).
>    - **Setup tab**: shows `setup_progress` JSON pretty-rendered + `setup_completed_at` timestamp. Deep-link to `/admin/site-setup/[step]` if not yet completed. Read-only here.
>    - `loading.tsx` skeleton; `error.tsx` with retry + back-link to `/admin/sites`.
>
> ### Components (new)
> - `components/admin/site-hierarchy-tree.tsx` — BFS tree renderer; reuses the same memberships-aware site resolver from `lib/planner/aggregate.ts`.
> - `components/admin/edit-site-form.tsx` — mirrors the structure of `create-site-form.tsx`; calls `updateSite` server action with `useActionState`.
> - `components/admin/archive-site-dialog.tsx` — `<AlertDialog>` with "type the site name to confirm" guard for the irreversible-feeling action. Reused for unarchive (without the type-name guard, since unarchive is reversible).
> - `components/admin/annual-hours-editor.tsx` — extracted from `/reports/osha-300a` so both surfaces share the same editor. Same RPC paths, same RLS, same UX.
> - `components/admin/admin-landing.tsx` — KPI tile row + 3 link cards (replaces the EmptyState).
>
> ### Server actions
> - `app/(app)/admin/sites/[id]/actions.ts` — `updateSite` (wraps `update_site_v1`) · `archiveSite` (wraps `archive_site_v1`) · `unarchiveSite` (wraps `unarchive_site_v1`). Standard `{ ok, error, fieldErrors }` shape.
> - `app/(app)/admin/sites/[id]/hours-actions.ts` — `setAnnualHours(siteId, year, hours)` + `deleteAnnualHours(siteId, year)`. (Reuses existing OSHA 300A actions if they're already at this name; otherwise extracts.)
>
> ### Sidebar / nav
> - `components/app-shell/nav-config.ts` — `/admin` entry already gated on `site:configure`. No code change. Once the schema migration runs, `site_admin` users will see Admin appear automatically. Worth a smoke note: a fresh signup flow against the new seed will land an admin in `/admin` for the first time.

---

## Why this sub-PR

The platform has shipped 5 modules and 6c+ polish, but every "fix the org structure" task still requires the Supabase SQL editor. This sub-PR closes that gap for the **sites** vertical: any `site_admin` can rename a site, fix its address, add an OSHA establishment ID after-the-fact, re-parent a sub-site, archive a decommissioned location, and edit the site's annual hours-worked from a real UI. Members + roles editing follow in 11b + 11c.

It also reclaims the dormant `site:configure` permission, which has been declared in the schema since Phase 0 but never granted — this is the perm the Admin sidebar entry has been gated on the whole time, which means **today no user sees the Admin nav item at all** even though the route exists. After this sub-PR's migration runs, `site_admin` users see the Admin entry; `ehs_manager` users see it for the configure-only paths.

---

## Locked-rule honors

- **Sites use `archived_at`, not `deleted_at`.** Soft-delete is restricted to `incidents/investigations/capas`; archiving sites is a different state. Honored.
- **Permission keys are system-defined.** The new `site:archive` key lands in the schema migration; the UI never invents perms.
- **Workflow engine = server actions.** All three RPCs are called from server actions, not from triggers. Activity logging is inline in the RPC body.
- **Audit append-only.** `site.updated / site.archived / site.unarchived` events go into `activity_events`; never UPDATE/DELETE on activity rows.
- **Country immutable.** Set at create, never edit. Logged in SPEC §15 as v2.

---

## Resolved open questions (from the parent plan)

1. **Org-wide vs. site-pinned invitations** → n/a in this sub-PR (invitations land in 11c).
2. **Notification kind for invitations** → n/a (11c).
3. **Email delivery** → n/a (11c).
4. **Last-admin guard** → n/a in 11a (members editing is 11b). The `archive_site_v1` RPC does NOT gate on member-state; archiving a site whose only `site_admin` is the actor is allowed (the site is being decommissioned; admin promotion isn't relevant). Guard logic in 11b.
5. **`is_system` backfill on the 4 default roles** → defer to 11c (the column lands with the roles editor work).
6. **Sandbox sites** → n/a (parent-plan decision: incident-only; honored).
7. **Site archive cascade — what dependent rows hide from non-admin reads** → **decided: query-level filter on `archived_at`, not RLS-level.** RLS keeps `user_can_access_site` semantics so admins can still read an archived site. Non-admin queries on `sites` add `.is('archived_at', null)`. Per-table joins already filter via `site_id` so they degrade naturally for archived sites: incidents on an archived site stay in the historical record but no new incident can be filed (the report wizard would no-op the archived site in the SiteSwitcher).
8. **Phase 8 ripple** → tracked separately; this sub-PR doesn't change `/members` or `/settings` stub routes. The 11b PR will add the `/members` redirect to `/admin/members`.

---

## What's NOT in this sub-PR (defers to 11b / 11c / v2)

- Member editing (add/remove/change role on the Members tab) — **11b**.
- Org-wide `/admin/members` + `/admin/members/[profileId]` — **11b**.
- Last-admin guard on member removal — **11b**.
- Roles editor (`/admin/roles`, `/admin/roles/[id]`) — **11c**.
- Invitations + `/invite/[token]` — **11c**.
- `roles.is_system` column — **11c** (lands with the roles editor migration).
- Country mutation on a site — v2 (SPEC §15).
- Org branding (logo, colors) — Phase 8 / later.
- Audit-log read view of admin operations — events go to `activity_events` already; surfacing them is a separate decision.
- Bulk-archive / CSV import — single-row UX in v1.

---

## Definition of done

1. Schema migration applies cleanly (`pnpm db:push`), regenerated types include `archived_at / archived_by / archive_reason / site:archive`.
2. The 3 RPCs are testable from the SQL editor with the standard `{ status, error }` semantics.
3. `/admin` no longer shows the "Coming in Phase 3" copy. KPI tiles render real org-scoped counts.
4. `/admin/sites` shows every site in the current org, table + tree both render, status/country/q filters work in URL, archived sites hidden by default.
5. `/admin/sites/[id]` 4 tabs render correctly. Overview save round-trips (rename a site → toast + reflected in list).
6. Archive flow: archive a leaf site → vanishes from active table → reappears under `?status=archived` → unarchive → returns to active. Activity events trail visible (next sub-PR's Activity admin view, but writes happen now).
7. Archive cycle guards: try to archive a site with active children → actionable error names the children. Try to re-parent a site to its own descendant → cycle error. Try to re-parent across orgs → cross-org error.
8. After the migration, `site_admin` users see the Admin entry in the sidebar without re-login (the nav-config filter is server-rendered per-request).
9. `loading.tsx` + `error.tsx` ship at both route levels.
10. Phase 6 polish 10-item checklist passes for `/admin`, `/admin/sites`, `/admin/sites/[id]`.
11. Smoke-test guide at `docs/smoke-test-phase11a.md` covers the lifecycle end-to-end.
12. PR description includes before/after screenshots of `/admin` (EmptyState → KPI dashboard) and a 30-second screen recording of the archive/unarchive flow.

---

## Open questions for the user (resolve before I start writing code)

1. **Sidebar visibility.** The existing `/admin` nav entry is gated on `site:configure`. Once the migration grants this perm to `ehs_manager` and `site_admin`, **both roles will see "Admin" in the sidebar.** The original parent-plan implication was that Admin is a `site_admin`-only surface. Confirm: is it OK for `ehs_manager` to see (and use) the Admin entry, given they can edit site metadata but not archive? Or should the sidebar gate stay `site:configure` while the Admin landing surface itself filters tiles per-perm?
2. **Annual hours editor extraction.** The current `/reports/osha-300a` editor is the only place to edit `site_annual_hours`. **Recommend:** extract into a shared component used by both surfaces, no behavior change. Confirm vs. duplicate.
3. **Archive confirmation pattern.** Type-the-site-name-to-confirm `<AlertDialog>` for archive vs. simpler "Yes / Cancel" `<AlertDialog>`. **Recommend:** type-the-name (Stripe-style; high-friction is appropriate because archived sites are easy to forget about and surface in reports). Confirm.
4. **Setup tab affordance.** Should the Setup tab let an admin **un-complete** a setup (clear `setup_completed_at` so the wizard resumes), or stay strictly read-only? **Recommend:** read-only for v1 (un-complete is a footgun; the wizard exists for the cold-start path). Confirm.
5. **`/admin/sites` default view.** Table or Tree as the default? **Recommend:** Table (faster scan for orgs with > 5 sites; tree is the secondary view).
6. **`region` column on sites.** Schema has it, create form omits it. **Recommend:** add to the edit form. The create form keeps its current 4 fields (name + country + timezone + optional address + NAICS + parent) so onboarding stays fast; corrections happen on edit.

---

## File-level scope (concrete)

```
supabase/migrations/2026XXXXXXXXXX_phase11a_sites_admin.sql      [new]

app/(app)/admin/page.tsx                                          [rewrite]
app/(app)/admin/loading.tsx                                       [new]
app/(app)/admin/sites/page.tsx                                    [new]
app/(app)/admin/sites/loading.tsx                                 [new]
app/(app)/admin/sites/error.tsx                                   [new]
app/(app)/admin/sites/[id]/page.tsx                               [new]
app/(app)/admin/sites/[id]/actions.ts                             [new]
app/(app)/admin/sites/[id]/hours-actions.ts                       [new]
app/(app)/admin/sites/[id]/loading.tsx                            [new]
app/(app)/admin/sites/[id]/error.tsx                              [new]

components/admin/admin-landing.tsx                                [new]
components/admin/sites-list.tsx                                   [new]
components/admin/sites-filters.tsx                                [new]
components/admin/site-hierarchy-tree.tsx                          [new]
components/admin/site-detail-tabs.tsx                             [new]
components/admin/edit-site-form.tsx                               [new]
components/admin/archive-site-dialog.tsx                          [new]
components/admin/annual-hours-editor.tsx                          [new — extracted from osha-300a]

app/(app)/reports/osha-300a/page.tsx                              [edit — consume <AnnualHoursEditor>]

docs/smoke-test-phase11a.md                                       [new]
```

Total: 1 migration · 5 routes (rewrite or new) · 8 new components · 1 surgical edit on `/reports/osha-300a` · 1 smoke-test guide.
