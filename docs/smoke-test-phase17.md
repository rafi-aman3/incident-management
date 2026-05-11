# Phase 17 Smoke Test — Settings Redesign

Run after `pnpm db:push` + `pnpm db:types` on a freshly-seeded demo project. Tests both the happy path and the protected guard paths.

## 0. Pre-flight

```bash
pnpm db:push       # apply 20260524120000_phase17_settings_redesign.sql
pnpm db:types      # regen lib/supabase/types.ts
pnpm dev
```

Sign in as `admin@demo.local` (default password — see `scripts/seed.ts`). Open `/dashboard` and confirm the topbar, sidebar, and Argus panel all still render.

## 1. Settings shell + IA

1. Click the avatar in the topbar → **Settings**.
2. URL should redirect from `/settings` to `/settings/profile`.
3. Left sidebar (lg+ viewports) shows **4 groups, 9 tabs**:
   - Account → Profile · Appearance · Sidebar
   - Workspace → Organization
   - Preferences → Argus · Notifications
   - Security → Security · Cookies · Delete account
4. Shrink the viewport below `lg`. The sidebar collapses into a top-of-content `<select>` with `<optgroup>` headings.
5. Active state: the current tab is highlighted in the sidebar; the URL updates on each click without a full page reload.

## 2. Profile + Appearance + Security (Phase 8 carryover, no regression)

1. **Profile** → change display name, Save → toast "Profile updated", topbar avatar dropdown reflects the new name.
2. **Appearance** → toggle Light / Dark / System → theme flips immediately; reload → preference persists.
3. **Security** → password form rejects an incorrect current password with a field error; matching new/confirm + correct current → toast "Password updated".
4. **Security → Sign out everywhere** → AlertDialog confirms → redirect to `/login?signed_out=everywhere` with the warning banner.
5. **Security → Sign out** (same-device, no confirm) → redirect to `/login`. Sign back in to continue.

## 3. Sidebar customisation

1. **Sidebar** tab → see a checkbox row per hideable nav item (Incidents, Investigations, CAPA, Templates, Inspections, Hazards, JSA, Assets, Documents, Planner, Reports, Bulletins).
2. Uncheck **Hazards** + **JSA** → both rows disappear from the left rail immediately on next nav.
3. Type `/hazards` in the address bar — page still loads (the hide list does not gate access; RBAC does).
4. Type `Hazards` into ⌘K search → result still appears (Phase 7 palette respects RBAC, not the hide list).
5. Click **Restore all** → both rows reappear; toast "Showing all sections".
6. Verify the "Always visible" footer copy lists Dashboard, Report Incident, Admin.

## 4. Organization tab (Site admin path)

1. **Organization** tab as `admin@demo.local` → see editable Name + Industry + read-only Workspace ID with a Copy button.
2. Click **Copy** → toast "Copied to clipboard". Paste into the URL bar to verify.
3. Upload a 200×200 PNG via the logo input → click **Save logo** → toast "Logo updated". Preview swaps to the uploaded image.
4. Reload the page → logo persists. Open the org row in the Supabase SQL editor — `logo_url` should be `<orgId>/logo.png`.
5. Click **Remove logo** → AlertDialog confirm → toast "Logo removed". The Storage object is gone; the org's `logo_url` is NULL.
6. Edit Name + Industry → Save → toast "Organisation updated". The orgs row reflects the new values.

## 5. Organization tab (Worker path — permission gate)

1. Sign out → sign in as `worker@demo.local`.
2. Visit `/settings/organization` directly.
3. Page renders the `EmptyState` ("Organisation settings are admin-only") with a back-to-profile button.
4. The sidebar in the left rail **does not show** the Organization tab.

## 6. Argus prefs

1. Sign back in as `admin@demo.local`.
2. **Argus** tab → see "Enabled" badge + daily token usage / 10M budget.
3. Toggle **Open Argus side panel automatically** OFF → toast "Argus panel will start closed".
4. Reload the page → the Argus side panel in the topbar starts closed (cyan trigger still visible; panel sheet not open).
5. Toggle back ON → reload → panel auto-opens on first render.
6. If `orgs.argus_enabled = false` (set via SQL): the tab still renders, the toggle is disabled, and the copy explains "Argus is turned off for this workspace."

## 7. Notifications prefs

1. **Notifications** tab → see 5 groups (Regulatory clock, Stop-work, Investigation & CAPA, Assignment, Hazard & JSA).
2. Regulatory clock + Stop-work groups show a **Locked** badge; every Switch is disabled and forced-on.
3. Hover a locked row's Switch → `aria-label` reads "(locked on)".
4. Toggle **CAPA overdue** OFF.
5. As a different user (e.g. `supervisor@demo.local`), create a CAPA assigned to `admin@demo.local` with a past due date — or run the cron `/api/cron/daily-overdue` manually.
6. Back as `admin@demo.local`, open the bell → the CAPA-overdue row is absent.
7. Re-enable CAPA overdue → next render, the row reappears.
8. Sanity-check the server-side guard: attempt to hand-insert a `user_notification_silences` row for `stop_work_raised` via the Supabase SQL editor — the row inserts (RLS allows your own row), but the regulatory banner and bell will still surface stop-work alerts because the read-layer filter is defence-in-depth (this is intentional).

## 8. Cookies tab

1. **Cookies** tab → see the transparency table with 4 rows (auth cookie, theme, recent searches, sidebar_pinned).
2. Run a few ⌘K searches to populate `argus.search.recent` in localStorage; pin/unpin the sidebar to set `sidebar_pinned`.
3. Click **Clear non-essential local data** → toast "Non-essential local data cleared".
4. DevTools → Application → Local Storage: `argus.search.recent` is gone.
5. DevTools → Application → Cookies: `sidebar_pinned` is gone (or expired). The `sb-*-auth-token` cookie is **unchanged** — you stay signed in.
6. Theme preference is preserved (the `theme` localStorage key is untouched).

## 9. Delete account — non-admin happy path

1. Sign in as a non-admin (e.g. `supervisor@demo.local`).
2. **Delete account** tab → see the destructive card with bullets explaining cascade behaviour.
3. Sole-admin banner is **absent** (this user isn't the sole admin).
4. Click **Delete my account** → AlertDialog opens.
5. Type a wrong email → Submit stays disabled.
6. Type the correct email → Submit enables → click → redirect to `/login?account_deleted=1` with the success banner.
7. Verify in SQL: `auth.users` row gone, `profiles` row gone, the user's `site_members` rows gone. Any incidents the user reported now show `reporter_id = NULL`.

## 10. Delete account — sole-admin gate (no escape)

1. In a fresh org with a single `org:configure` holder (or after promoting/demoting in `/admin/members`), sign in as that lone admin.
2. **Delete account** tab → the **amber sole-admin banner** is visible. The **Delete my account** button is `disabled` (`aria-disabled` set).
3. A second affordance shows: **Delete organisation…** (only visible because you're the sole admin AND you hold `org:configure`).
4. Don't click it yet — go to **Admin → Members**, promote another user to a `site_admin` role.
5. Reload `/settings/delete-account` → banner is gone, **Delete my account** is enabled.

## 11. Delete entire organisation

1. Re-create the sole-admin condition (demote the second admin via `/admin/members`).
2. **Delete account** tab → click **Delete organisation…**.
3. AlertDialog opens with a count summary: `<N> members · <M> sites · <K> incidents`.
4. Type the wrong org name → Submit stays disabled.
5. Type the correct name; leave the `DELETE` field empty → still disabled.
6. Type both correctly → Submit enables → click.
7. Redirect to `/login?org_deleted=1` with the success banner.
8. Verify in SQL: the `orgs` row is gone; every dependent row (sites, profiles, incidents, etc.) cascade-deleted; every `auth.users` row for the org's members is gone.

## 12. Activity log

After any action above, the `activity_events` table should contain:
- `org.updated` (Step 4.6)
- `org.logo_uploaded` (Step 4.3)
- `org.logo_removed` (Step 4.5)
- `account.deleted` (Step 9.6)
- `org.deleted` (Step 11.7)

Each row has `actor_id = the user that performed the action`, `verb = ...`, and `payload` populated with the relevant detail.

## Definition of done

- [ ] All 12 sections complete with no failures or warnings.
- [ ] `pnpm tsc --noEmit` clean.
- [ ] `pnpm lint` matches baseline (no new findings beyond pre-existing).
- [ ] No regression on Phase 8's `/settings/profile|appearance|security` flows.
- [ ] CLAUDE.md status block + `docs/BUILD_STATUS.md` updated with the merged PR number.
