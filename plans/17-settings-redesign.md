# Phase 17 — Settings Redesign

**Status:** drafted 2026-05-12 — informed by Q&A in this session + reference image at `assets/settings.png`
**Goal:** Re-architect `/settings` from the single-column 4-card account-preferences surface (Phase 8 / PR #25) into a left-sidebar IA with 9 nested-route tabs grouped into 4 sections (Account · Workspace · Preferences · Security). Adds first-class **Organization edit** (name / industry / logo) for site-admins, **per-user sidebar customisation** (hide module rows you don't use), **per-user-per-kind notification silencing** (closes the SPEC §15 deferral from Phase 8), **per-user Argus side-panel default**, **cookie transparency**, and **self-service account deletion**.
**Estimated duration:** ~7-10 days (one migration + new Storage bucket + 9 routes + 10 components + cross-cutting wiring in AppSidebar + bell feed + ArgusContextProvider).
**Depends on:** Phase 8 closed (account-preferences scaffold) · Phase 9a-e closed (Argus org-flag + panel provider) · Phase 11a-c closed (admin console stable so we know what stays under /admin) · Phase 12 closed (Supabase auth flows wired) · Phase 14-16 closed (so the new sidebar customisation surface knows the full module list).
**Branch:** `feat/phase-17-settings-redesign`
**PR target:** `main`
**New deps:** none — every primitive needed (radix Tabs/Dialog, lucide icons, supabase storage, sonner toasts, next-themes, react-hook-form, Zod) ships already.
**Schema migration:** **one** — `20260524120000_phase17_settings_redesign.sql`.

> **What this PR ships:**
> - New left-sidebar layout under `/settings` with 9 nested-route tabs in 4 groups:
>   - **Account** — Profile · Appearance · **Sidebar** (NEW)
>   - **Workspace** — **Organization** (NEW)
>   - **Preferences** — **Argus** (NEW) · **Notifications** (NEW)
>   - **Security** — Security · **Cookies** (NEW) · **Delete account** (NEW)
> - Existing `<ProfileCard>` / `<AppearanceCard>` / `<SecurityCard>` / `<SignOutCard>` get re-mounted into the new sidebar IA (Sign-out folded into Security). No functional regression for the 4 Phase-8 cards.
> - One migration adding `orgs.logo_url text` + `profiles.sidebar_hidden_items text[]` + `profiles.argus_panel_default boolean` + new `user_notification_silences` table + new `org:configure` permission key + new public Storage bucket `org-logos` with per-org path RLS.
> - 5 new server actions: `updateOrg` · `uploadOrgLogo` · `setSidebarHiddenItems` · `setArgusPanelDefault` · `setNotificationSilence` · `deleteOwnAccount`. (Existing 3 server actions — `updateProfile` / `changePassword` / `signOutEverywhere` — keep their current signatures.)
> - Cross-cutting reads: **AppSidebar** filters its rendered items against `profiles.sidebar_hidden_items`; **NotificationBell + DashboardAlertsBanner** filter against `user_notification_silences`; **ArgusContextProvider** initial open/closed state reads `profiles.argus_panel_default`.
> - **`/admin/integrations` stays where it is** (per user direction — Integrations is NOT moved into Settings). `/admin/sites|members|roles|invitations` likewise stay in the admin console. `/settings` is *configuration*, `/admin` is *operations*.
> - SPEC delta logged in §15: per-user notification silencing closes (replaces Phase 8's 2026-05-09 deferral); new §AUTH-DELETE-ACCOUNT subsection for self-service account deletion semantics; new §UI-SETTINGS-IA subsection locks the 4-group / 9-tab layout.

> **Not in this PR (deferred):**
> - **No Branding tab.** Folded into Organization as a single logo upload. Brand color stays locked at `#735CDD` per CLAUDE.md (we don't ship a custom-color override; it's not even surfaced as a swatch in v1).
> - **No Billing tab. No Invoices tab.** This app has no billing model — SDS Manager (parent product) handles licensing. Adding stub pages would be fiction; better to drop the tabs entirely.
> - **No Integrations move.** `/admin/integrations` stays at its current location with its single SDS Manager card from Phase 16.
> - **No Privacy & Data tab as conceived.** Replaced by Cookies + Delete account.
> - **No org-admin Argus toggle.** Org-level `argus_enabled` stays read-only in the Argus tab (per the Q5 fork). Support flips the flag via SQL — keeps cost guardrails out of accidental-click range.
> - **No org-admin Argus token-budget edit.** The 10M default ships from Phase 9d; admins see the consumed/remaining display, not the edit. Defers to a future ops console.
> - **No editable workspace slug.** Read-only with a copy-to-clipboard button (per Q5 fork). Slug isn't in user-facing URLs in this app; editability is low-risk but unnecessary in v1.
> - **No real cookie consent toggles.** The app uses essential cookies only (Supabase auth + next-themes preference + sonner toaster) — no analytics / marketing / tracking. The Cookies tab is *transparency* (list essentials + "Clear non-essential local data" button that wipes localStorage). Real consent toggles require something to gate; we have nothing.
> - **No avatar / profile photo upload.** Email read-only stays per Phase 8. Both still deferred.
> - **No MFA / 2FA enrollment.** Phase 8 deferred this; still deferred.
> - **No active-sessions list.** "Sign-out-everywhere" covers the security need.
> - **No timezone preference.** Site-level timezone (regulatory clock) is the source of truth; per-user is browser locale.
> - **No language preference.** i18n still v2.
> - **No audit-log surface on org edits.** `activity_events` already records org-level mutations (we'll add `org.updated` + `org.logo_uploaded` verbs); a user-facing audit feed is its own phase.
> - **No "Export my data" GDPR endpoint.** Delete-my-account is the only GDPR primitive in v1. Export is a v2 feature (requires a backgrounded job + signed-URL deliverable).

---

## Why this scope

**The current settings surface is too thin.** Phase 8 shipped an account-only preferences page (Profile · Security · Appearance · Sign out) deliberately scoped to "what THE USER controls about THEIR OWN account". Everything org-level lives under `/admin`. After Phases 9-16 the org has a lot more to configure (Argus on/off, notification routing, organisation identity) and the current model has no home for any of it. The reference image's left-sidebar IA is the standard SaaS pattern for "this is where you manage your space, both personal and shared" — same surface, permission-gated visibility per tab.

**Org-level edits are the load-bearing addition.** The org row has shipped 5 columns over 6 phases (`industry` from init · `is_demo` from Phase 2 demo affordances · `argus_enabled` + `argus_daily_token_budget` from Phase 9a) and zero of them have a user-facing edit path. Site-admins currently change the org name via the Supabase SQL editor. This is the kind of gap that's invisible until a demo turns to "and how do I rebrand this to my company name?" and then it's a showstopper.

**Sidebar customisation is the differentiator.** Every SaaS settings page has org-edit + notifications + theme. Sidebar customisation is unusual — most apps either let you pin/unpin items (we already do — Phase 11k sidebar pin/unpin) or hide nothing. Letting users hide module rows they don't use (a healthcare org doesn't care about JSA; a construction site doesn't care about Documents) reduces cognitive load without breaking access (they can still type the URL or use ⌘K Search to navigate). It's also a low-cost feature — one boolean array on `profiles`, one filter step in `AppSidebar`. High demo value, low LOC.

**Notifications-silencing closes a SPEC §15 deferral that's been open since Phase 8.** The user notification silencing surface was explicitly deferred in `plans/08-settings.md` Q4 with a SPEC §15 entry. The feature has gotten relatively bigger since Phase 9 added `argus_suggestion` + `stop_work_raised` to the bell feed and Phase 14/15 added `hazard_incident_linked` + `jsa_review_required`. Users will increasingly want to mute "all argus suggestions to my bell" without losing "stop-work raised on my site" — which is exactly what per-kind silencing buys.

**Self-service account delete is a GDPR right.** The "right to be forgotten" under GDPR Article 17 is a self-service primitive most SaaS apps ship. We have no path today — users have to ask an admin who has to ask Supabase support. A typed-confirmation flow + `auth.admin.deleteUser` (with a hard-block guard so the last org-admin can't lock the org out) is ~80 LOC and closes a real compliance gap. Cascade on `auth.users` already wipes `profiles` + `site_members` + `team_members` + `team_sites` (all FKs cascade on profile delete via Phase 0 init.sql); authored rows on incidents / investigations / CAPAs / bulletins NULL out their `created_by` per the existing FK rules, which is the desired "forgotten author" semantic.

---

## Pre-flight deps

- **Phase 8 closed (PR #24, 2026-05-09)** — `app/(app)/settings/page.tsx` + `actions.ts` + 4 cards are on `main`. Phase 17 keeps every server action signature stable so the existing forms re-mount without rewrite.
- **Phase 9a-e closed (PRs #27-31)** — `orgs.argus_enabled` + `orgs.argus_daily_token_budget` + `ArgusContextProvider` exist. Argus tab reads them.
- **Phase 11a-c closed (PRs #14-16)** — admin console covers Sites/Members/Roles/Invitations. Phase 17 leaves those alone.
- **`auth.admin.signOut` + `auth.admin.deleteUser` available** via service-role admin client (`lib/supabase/admin.ts` shipped Phase 11c).
- **Supabase Storage** has `documents` bucket (Phase 4). Phase 17 adds a new public `org-logos` bucket — same migration file.

---

## Spec deltas to fold

Three additions to `docs/SPEC.md` ship with this plan:

1. **§15 — close the Phase 8 deferral** for "user-level notification silencing per kind". 2026-05-12 entry: "Per-user, per-`notification_kind` silencing shipped in Phase 17 (PR #N). Closes 2026-05-09 deferral. New `user_notification_silences` table. Life-safety kinds (`stop_work_raised`, `osha_8hr`, `osha_24hr`, `riddor_immediate`, `riddor_f2508_10d`) are *non-silenceable* — toggle rendered disabled with a tooltip explaining why. Applies to both bell feed AND dashboard banner reads."

2. **New §AUTH-DELETE-ACCOUNT** subsection (between §AUTH-LOGIN and §AUTH-INVITE in SPEC.md). Locks:
   - Self-service deletion is a hard delete via `auth.admin.deleteUser(user.id)` — cascades on `auth.users` → `profiles` → `site_members` / `team_members` → no `profiles` row left.
   - Authored rows on operational tables (`incidents.reporter_id`, `investigations.lead_user_id`, `capas.owner_id`, `bulletins.author_id`, etc.) have ON DELETE SET NULL — author becomes "Removed user" in the UI.
   - **Hard-block:** if the deleting user is the **only holder of `org:configure` in the org**, the action returns a `{ ok: false, error: 'You're the last org admin — promote another admin before deleting your account.' }` with a link to `/admin/members`.
   - Typed confirmation: user types their own email address in the confirm field (mirrors Phase 11j Demo Reset's typed-name pattern; same pattern as GitHub / Vercel / Stripe self-delete).
   - Redirects to `/login?account_deleted=1` with a `<DeleteAccountBanner>` confirmation.

3. **New §UI-SETTINGS-IA** subsection (next to §UI-NAV in SPEC.md). Locks the 4-group / 9-tab layout, the route shape `/settings/<section>`, the redirect from `/settings` → `/settings/profile`, the permission gates per tab, and the rule that **`/admin` keeps operational tools (Sites / Members / Roles / Invitations / Integrations / Site-setup / Demo) — `/settings` keeps configuration (account + org identity + preferences + security)**.

---

## Schema migration: `20260524120000_phase17_settings_redesign.sql`

```sql
-- ============================================================================
-- Phase 17 — Settings redesign
-- ============================================================================
-- 1. orgs.logo_url                          — public Storage URL or null
-- 2. profiles.sidebar_hidden_items text[]  — list of nav-config hrefs to hide
-- 3. profiles.argus_panel_default boolean  — per-user "panel open by default"
-- 4. user_notification_silences table      — (profile_id, kind) silencing set
-- 5. permission key 'org:configure'        — granted to site_admin only
-- 6. seed_default_roles() patched          — future orgs inherit the grant
-- 7. activity_event_verb gains 'org.updated' + 'org.logo_uploaded'
-- 8. Storage bucket 'org-logos' (public)   — RLS write gated on org:configure
-- ============================================================================

begin;

-- 1. orgs.logo_url --------------------------------------------------------
alter table public.orgs
  add column logo_url text;

-- 2 + 3. profiles columns -------------------------------------------------
alter table public.profiles
  add column sidebar_hidden_items text[] not null default '{}',
  add column argus_panel_default  boolean not null default true;

-- 4. user_notification_silences ------------------------------------------
create table public.user_notification_silences (
  profile_id        uuid not null references public.profiles(id) on delete cascade,
  notification_kind notification_kind not null,
  created_at        timestamptz not null default now(),
  primary key (profile_id, notification_kind)
);

alter table public.user_notification_silences enable row level security;

-- Read your own silences
create policy user_notification_silences_select_self
  on public.user_notification_silences for select
  using (auth.uid() = profile_id);

-- Insert your own silences (with hard-block on life-safety kinds at action layer)
create policy user_notification_silences_insert_self
  on public.user_notification_silences for insert
  with check (auth.uid() = profile_id);

-- Delete your own silences
create policy user_notification_silences_delete_self
  on public.user_notification_silences for delete
  using (auth.uid() = profile_id);

-- 5. permission key 'org:configure' --------------------------------------
-- Granted to site_admin role on every existing org (idempotent backfill).
insert into public.role_permissions (role_id, permission_key)
select r.id, 'org:configure'
  from public.roles r
 where r.role_key = 'site_admin'
on conflict (role_id, permission_key) do nothing;

-- 6. seed_default_roles() — patch so new orgs inherit the grant ----------
-- (Full function body included; we re-create it with the added permission_key
--  in the site_admin grant list. Mirrors the Phase 14 / Phase 15 pattern.)

-- ... [seed_default_roles() body — site_admin permission_keys gains 'org:configure'] ...

-- 7. activity event verbs -----------------------------------------------
-- activity_events.verb is text; no enum change needed. Document the new
-- values in lib/activity/verbs.ts:
--   'org.updated'        — payload: { fields_changed: ['name' | 'industry'] }
--   'org.logo_uploaded'  — payload: { logo_url, replaced: boolean }
--   'account.deleted'    — payload: { deleted_user_email }
--   'sidebar_pref.updated' — payload: { hidden_items: string[] }  (low value; skip)

-- 8. Storage bucket 'org-logos' (public) --------------------------------
insert into storage.buckets (id, name, public)
  values ('org-logos', 'org-logos', true)
  on conflict (id) do nothing;

-- Storage RLS: write gated on org:configure ----------------------------
-- Path convention: 'org-logos/{org_id}/logo.{ext}'
-- (Implemented as a storage.objects policy; see migration file body.)

create policy org_logos_read_public
  on storage.objects for select
  using (bucket_id = 'org-logos');

create policy org_logos_insert_via_org_configure
  on storage.objects for insert
  with check (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

create policy org_logos_update_via_org_configure
  on storage.objects for update
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

create policy org_logos_delete_via_org_configure
  on storage.objects for delete
  using (
    bucket_id = 'org-logos'
    and exists (
      select 1
        from public.profiles p
        join public.site_members sm on sm.profile_id = p.id
        join public.role_permissions rp on rp.role_id = sm.role_id
       where p.id = auth.uid()
         and rp.permission_key = 'org:configure'
         and (storage.foldername(name))[1] = p.org_id::text
    )
  );

-- 9. RPC for "is this user the only org:configure holder?" -------------
-- Used by deleteOwnAccount guard.
create or replace function public.count_org_configure_holders(p_org_id uuid)
returns integer language sql stable security definer as $$
  select count(distinct p.id)::integer
    from public.profiles p
    join public.site_members sm on sm.profile_id = p.id
    join public.role_permissions rp on rp.role_id = sm.role_id
   where p.org_id = p_org_id
     and rp.permission_key = 'org:configure';
$$;

grant execute on function public.count_org_configure_holders(uuid) to authenticated;

commit;
```

**Notes on the migration:**
- `orgs.logo_url` is a nullable text storing the **public Storage path** (`org-logos/${org_id}/logo.png`) — read clients build the public URL via `supabase.storage.from('org-logos').getPublicUrl(path)`.
- `profiles.sidebar_hidden_items` stores the **module hrefs** from `nav-config.ts` (e.g., `['/jsa', '/resources/documents']`). Stored as `text[]` not jsonb because we never query *into* the array — we just read the whole list on every layout render.
- `user_notification_silences` is composite-PK by `(profile_id, kind)`. RLS = your own rows. Life-safety hard-block is at the action layer (UI disables the toggle; server rejects an insert for the protected kinds). The reason it's not a CHECK constraint is so we can flex the "protected set" in code without a migration — life-safety is a policy, not a DB invariant.
- `org:configure` permission key gets granted via the same idempotent `insert ... on conflict` pattern Phase 14 used for hazard permissions. `seed_default_roles()` is re-created with the key in the `site_admin` grant array so future orgs inherit.
- Storage bucket `org-logos` is **public** (logos are typically org-public — they appear on PDFs, login pages of future white-labeled views, etc.). Per-org path prefix RLS gates writes.
- `count_org_configure_holders` is a `SECURITY DEFINER` SQL function (not plpgsql) per the project rule "avoid self-referencing RLS — use SECURITY DEFINER helpers" — it bypasses RLS to count org-wide.

---

## Server actions

All in `app/(app)/settings/actions.ts`. Existing 3 actions keep their signatures; 6 new actions added.

**Existing (unchanged):**
- `updateProfile(prev, fd) → ActionResult`
- `changePassword(prev, fd) → ActionResult`
- `signOutEverywhere() → never`

**New:**

```ts
// 1. updateOrg — name + industry. Logo handled separately by uploadOrgLogo.
const orgSchema = z.object({
  name:     z.string().trim().min(1).max(120),
  industry: z.enum(["healthcare", "education", "manufacturing", "warehouse", "office", "construction", "lab"]),
});

export async function updateOrg(prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  // Permission check: any site where user has org:configure
  const { supabase, profile } = await requireUser();
  if (!(await canAnywhere("org:configure"))) return { ok: false, error: "Permission denied" };

  const parsed = orgSchema.safeParse({ name: fd.get("name"), industry: fd.get("industry") });
  if (!parsed.success) return { ok: false, error: "Validation failed", fieldErrors: parsed.error.flatten().fieldErrors };

  const { error } = await supabase
    .from("orgs")
    .update({ name: parsed.data.name, industry: parsed.data.industry })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  await logActivity({ verb: "org.updated", payload: { fields_changed: ["name", "industry"] } });
  revalidatePath("/settings/organization");
  revalidatePath("/", "layout"); // topbar / sidebar may render org name in future
  return { ok: true };
}
```

```ts
// 2. uploadOrgLogo — multipart, server-side upload to Storage.
export async function uploadOrgLogo(prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const file = fd.get("logo") as File | null;
  if (!file) return { ok: false, error: "No file" };
  if (file.size > 2 * 1024 * 1024) return { ok: false, error: "Max 2 MB" };
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) {
    return { ok: false, error: "JPEG / PNG / WebP / GIF only" };
  }

  const { supabase, profile } = await requireUser();
  if (!(await canAnywhere("org:configure"))) return { ok: false, error: "Permission denied" };

  const ext = file.type.split("/")[1].replace("jpeg", "jpg");
  const path = `${profile.org_id}/logo.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from("org-logos").upload(path, buf, {
    contentType: file.type,
    upsert: true,
  });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await supabase
    .from("orgs")
    .update({ logo_url: path })
    .eq("id", profile.org_id);
  if (dbErr) return { ok: false, error: dbErr.message };

  await logActivity({ verb: "org.logo_uploaded", payload: { logo_url: path, replaced: true } });
  revalidatePath("/settings/organization");
  return { ok: true };
}
```

```ts
// 3. setSidebarHiddenItems — replace the whole array on each save.
const sidebarSchema = z.object({
  hidden_items: z.array(z.string()).max(20), // hard cap for safety
});

export async function setSidebarHiddenItems(items: string[]): Promise<ActionResult> {
  const parsed = sidebarSchema.safeParse({ hidden_items: items });
  if (!parsed.success) return { ok: false, error: "Validation failed" };

  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ sidebar_hidden_items: parsed.data.hidden_items })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/", "layout"); // sidebar re-renders for this user
  return { ok: true };
}
```

```ts
// 4. setArgusPanelDefault — boolean toggle.
export async function setArgusPanelDefault(value: boolean): Promise<ActionResult> {
  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ argus_panel_default: value })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
```

```ts
// 5. setNotificationSilence — toggle insert/delete on one (profile, kind).
const NON_SILENCEABLE_KINDS: NotificationKind[] = [
  "stop_work_raised", "osha_8hr", "osha_24hr",
  "riddor_immediate", "riddor_f2508_10d", "riddor_7day", "riddor_disease",
];

export async function setNotificationSilence(kind: NotificationKind, silenced: boolean): Promise<ActionResult> {
  if (silenced && NON_SILENCEABLE_KINDS.includes(kind)) {
    return { ok: false, error: "This notification is life-safety / compliance and can't be silenced." };
  }
  const { supabase, profile } = await requireUser();
  if (silenced) {
    const { error } = await supabase
      .from("user_notification_silences")
      .upsert({ profile_id: profile.id, notification_kind: kind }, { onConflict: "profile_id,notification_kind" });
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("user_notification_silences")
      .delete()
      .eq("profile_id", profile.id)
      .eq("notification_kind", kind);
    if (error) return { ok: false, error: error.message };
  }
  revalidatePath("/settings/notifications");
  // The bell feed + dashboard banner re-fetch on each navigation, so no layout revalidate.
  return { ok: true };
}
```

```ts
// 6. deleteOwnAccount — typed-confirmation; service-role admin delete.
const deleteSchema = z.object({
  confirm_email: z.string().email(),
});

export async function deleteOwnAccount(prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const { user, profile } = await requireUser();
  const parsed = deleteSchema.safeParse({ confirm_email: fd.get("confirm_email") });
  if (!parsed.success || parsed.data.confirm_email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    return { ok: false, error: "Email doesn't match" };
  }

  // Hard-block: last org-admin guard.
  const { data: count, error: countErr } = await supabase
    .rpc("count_org_configure_holders", { p_org_id: profile.org_id });
  if (countErr) return { ok: false, error: countErr.message };
  // count includes this user; if there's only this user, block.
  if (count <= 1) {
    return {
      ok: false,
      error: "You're the last org admin — promote another admin under Admin → Members before deleting your account.",
    };
  }

  await logActivity({ verb: "account.deleted", payload: { deleted_user_email: user.email } });

  const admin = createAdminClient();
  await admin.auth.admin.deleteUser(user.id);
  redirect("/login?account_deleted=1");
}
```

```ts
// helper — used by updateOrg + uploadOrgLogo. Returns true iff the caller
// holds 'org:configure' on any of their sites (org-scope perm check).
export async function canAnywhere(perm: PermissionKey): Promise<boolean> {
  const { profile, supabase } = await requireUser();
  const { data, error } = await supabase
    .from("site_members")
    .select("role_id, roles!inner(role_permissions!inner(permission_key))")
    .eq("profile_id", profile.id);
  if (error || !data) return false;
  return data.some((sm: any) =>
    sm.roles.role_permissions.some((rp: any) => rp.permission_key === perm)
  );
}
```

---

## Routes

```
app/(app)/settings/
  layout.tsx                         NEW — settings-shell (left sidebar + content area)
  page.tsx                           CHANGED — redirect to /settings/profile
  actions.ts                         CHANGED — adds 6 new server actions
  profile/page.tsx                   NEW — re-mounts <ProfileCard>
  appearance/page.tsx                NEW — re-mounts <AppearanceCard>
  sidebar/page.tsx                   NEW — <SidebarPrefCard>
  organization/page.tsx              NEW — <OrganizationCard> (gated on org:configure)
  argus/page.tsx                     NEW — <ArgusPrefsCard>
  notifications/page.tsx             NEW — <NotificationsPrefsCard>
  security/page.tsx                  NEW — re-mounts <SecurityCard> + folds <SignOutCard>
  cookies/page.tsx                   NEW — <CookiesCard>
  delete-account/page.tsx            NEW — <DeleteAccountCard>
  loading.tsx                        CHANGED — skeleton for the new shell shape
  error.tsx                          unchanged
```

**Route gating:**
- `/settings/profile` · `/appearance` · `/sidebar` · `/argus` · `/notifications` · `/security` · `/cookies` · `/delete-account` — RLS-gated; visible to every authenticated user.
- `/settings/organization` — server-side check `canAnywhere("org:configure")`; non-admins see the EmptyState pattern shipped Phase 11.

**Bare-`/settings`** is a `redirect("/settings/profile")` in `page.tsx`. We don't try to remember the last-visited tab — too much state for too little value.

---

## Components

```
components/settings/
  settings-shell.tsx                  NEW — wraps the page; renders SettingsSidebar + children
  settings-sidebar.tsx                NEW — group/tab links with active state; reads the perm
  profile-card.tsx                    existing — kept (no change)
  appearance-card.tsx                 existing — kept (no change)
  security-card.tsx                   existing — kept; folds the sign-out button inline
  sign-out-card.tsx                   REMOVED — its button moves into security-card
  sidebar-pref-card.tsx               NEW — checkbox list of hideable nav items
  organization-card.tsx               NEW — name/industry edit form + read-only slug
  org-logo-uploader.tsx               NEW — file input + preview + replace; sub-comp of organization-card
  argus-prefs-card.tsx                NEW — read-only org status + per-user panel-default toggle
  notifications-prefs-card.tsx        NEW — grouped per-kind toggles with life-safety hard-block
  cookies-card.tsx                    NEW — transparency table + "Clear non-essential local data" button
  delete-account-card.tsx             NEW — typed-confirmation flow
```

### `<SettingsSidebar>`

Server component. Reads `await can("org:configure", null)` (org-scope perm) once and hides the Organization link if false. Mirrors the project's existing sidebar permission pattern. Mobile = collapsible per Phase 6l + the inline-collapsibles-in-Sheet rule (memory: `feedback_inline_ui_in_mobile_sheets.md`). At < lg, the settings sidebar collapses into a top-of-content `<Select>` (just the tab list — there's no need for two sidebars on mobile).

### `<SidebarPrefCard>`

Client component. Reads the user's current `sidebar_hidden_items` (passed as prop from the server page) and renders a checkbox group of every **hideable** module row (defined in a new const `HIDEABLE_NAV_ITEMS` in `components/app-shell/nav-config.ts`):

```
HIDEABLE (toggleable):
  /incidents · /investigations · /capa · /templates · /inspections
  · /hazards · /jsa · /resources/assets · /resources/documents
  · /planner · /reports · /bulletins
PINNED (always visible):
  /dashboard · /incidents/new/1 · /admin (perm-gated anyway)
```

Checked = visible. Unchecked = hidden. Each click fires `setSidebarHiddenItems(newArray)` server action; optimistic UI flips immediately and the sidebar re-renders on the next nav (already covered by the `revalidatePath("/", "layout")` in the action).

### `<OrganizationCard>`

Form fields:
- **Logo** (drag-drop uploader; preview at 96×96; "Change" / "Remove" buttons)
- **Name** (text input, required, 1-120 chars)
- **Industry** (Select with the 7 enum values)
- **Slug** (read-only with copy-to-clipboard button + tooltip "Workspace slug is fixed — contact support to rename")

Permission check at the server level (page returns EmptyState if `!canAnywhere("org:configure")`). The form itself doesn't double-check — the page wouldn't render at all for unprivileged users.

### `<OrgLogoUploader>`

Drag-and-drop primitive (re-uses the same pattern as `<DocumentUploader>` from Phase 4). 2 MB cap. Accepts JPEG / PNG / WebP / GIF. Shows 96×96 preview after select; "Save logo" calls `uploadOrgLogo` server action; sonner toast on success. Removing the logo (`logo_url = null`) is a separate action invoked by the "Remove" button → confirm AlertDialog → `updateOrg({ logo_url: null })` (overloaded use of updateOrg with a `logo_only: true` field or a separate `removeOrgLogo` action — implementer's choice; `removeOrgLogo` is cleaner).

### `<ArgusPrefsCard>`

Two sub-sections:
1. **Org status** (read-only): Shows `orgs.argus_enabled` as a status badge ("Enabled" / "Disabled") + the daily token budget remaining (`orgs.argus_daily_token_budget` minus today's consumed sum from `argus_suggestions`). Renders a "Contact support to change" line.
2. **My preferences**: One toggle — "Open Argus side panel automatically when I navigate." Default ON. Wired to `setArgusPanelDefault` server action; on flip, sonner toast.

The `ArgusContextProvider` (Phase 9e, mounted in `(app)/layout.tsx`) reads `profile.argus_panel_default` and uses it as the initial `open` state.

### `<NotificationsPrefsCard>`

Renders every `notification_kind` enum value, grouped by category:

| Group | Kinds | Silenceable? |
|---|---|---|
| **Regulatory clock** | `osha_8hr`, `osha_24hr`, `riddor_immediate`, `riddor_f2508_10d`, `riddor_7day`, `riddor_disease` | **No** (life-safety / compliance) |
| **Stop-work** | `stop_work_raised` | **No** (life-safety) |
| **Investigation & CAPA** | `capa_overdue`, `capa_escalated` | Yes |
| **Assignment** | `assigned`, `invited` | Yes |
| **Hazard & JSA** | `hazard_incident_linked`, `jsa_review_required` | Yes |
| **Argus** | (none in v1 — Argus has no dedicated `notification_kind` yet) | — |

Each kind gets a row with `<Switch>` (on = subscribed, off = silenced). Non-silenceable rows render the Switch disabled with a small lock icon + tooltip "Life-safety alerts can't be silenced".

The server-side **bell feed query** (`lib/notifications/list.ts` — Phase 6l) and **dashboard alerts banner query** (`lib/dashboard/alerts.ts`) both add a `WHERE kind NOT IN (SELECT notification_kind FROM user_notification_silences WHERE profile_id = auth.uid())` subquery. Two ~3-line patches.

### `<CookiesCard>`

A read-only transparency table:

| Cookie / storage | Purpose | Type |
|---|---|---|
| `sb-<project-ref>-auth-token` | Supabase auth refresh token | Essential |
| `theme` (localStorage) | Your last-selected Light / Dark / System preference | Essential |
| `argus.search.recent` (localStorage) | Your recent ⌘K searches (MRU 5) | Non-essential |
| `sidebar.pinned` (cookie) | Whether your sidebar stays pinned | Non-essential |

Below the table: a single **"Clear non-essential local data"** button that calls a client-side `clearLocalData()` function (no server action — purely localStorage / non-essential cookies). Logs out the user? No — we keep them signed in. Clears: `argus.search.recent`, any `sonner.*` keys, `sidebar.pinned` cookie. Toast: "Non-essential local data cleared."

### `<DeleteAccountCard>`

Two-stage UI:

1. **Initial state:** A short paragraph + a red destructive button "Delete my account".
2. **Confirm stage** (AlertDialog or inline expansion): 
   - Heading: "This permanently deletes your account."
   - 3 bullets: "You will be signed out everywhere." · "Your authored records (incidents, investigations, CAPAs, bulletins) stay in the org but show 'Removed user' as the author." · "This cannot be undone."
   - Type-to-confirm input: "Type your email to confirm" (placeholder `you@example.com`). Submit button stays disabled until the typed email exactly matches `user.email`.
   - **Last-admin warning banner** (rendered ONLY if `count_org_configure_holders === 1`): amber callout "You're the last org admin — you cannot delete your account until you promote another admin under [Admin → Members](/admin/members)."
   - Submit button → `deleteOwnAccount` server action → redirect to `/login?account_deleted=1`.

The `<DeleteAccountBanner>` on `/login` reads `searchParams.account_deleted === "1"` and renders "Your account has been deleted. Thank you for using the platform."

---

## Cross-cutting wiring

### `AppSidebar` reads `sidebar_hidden_items`

In `components/app-shell/app-sidebar.tsx`, add a filter step after the existing RBAC gate:

```ts
const allowed = NAV.filter((it) => !it.permission || can(it.permission, currentSiteId));
const hidden  = profile.sidebar_hidden_items ?? [];
const visible = allowed.filter((it) =>
  PINNED_HREFS.includes(it.href) || !hidden.includes(it.href)
);
```

`PINNED_HREFS` is a const list (`/dashboard`, `/incidents/new/1`, `/admin`) — these can't be hidden even if a stale value sits in the array. The settings page only ever offers `HIDEABLE_NAV_ITEMS` to begin with; the filter is defense-in-depth.

### `NotificationBell` + `DashboardAlertsBanner` read silences

In `lib/notifications/list.ts` and `lib/dashboard/alerts.ts`, append a `.not("kind", "in", `(${silencedKinds.join(",")})`)` to the query (or a subquery via PostgREST `.or()`). Silenced kinds list pre-fetched on the same RSC render so it's one extra query per layout load — acceptable.

### `ArgusContextProvider` reads `argus_panel_default`

In `app/(app)/layout.tsx`, pass `profile.argus_panel_default` as initial state into `<ArgusContextProvider>`. Existing component already supports an `initialOpen` prop (added in Phase 9e); just wire it through.

### Topbar avatar dropdown

No change. Still links to `/settings`. The `/settings` page redirects to `/settings/profile`, which is the first ACCOUNT tab and the natural landing page.

### `/admin/integrations` link from `/admin`

Stays as-is. The admin index page (`app/(app)/admin/page.tsx`) keeps its existing Integrations tile.

---

## RBAC

| Permission key | Phase | Granted to (default) | Notes |
|---|---|---|---|
| `org:configure` | **17 (NEW)** | `site_admin` only | Org-scope — checked via `canAnywhere("org:configure")` server helper. |

`canAnywhere` is a new helper alongside the existing `can(perm, siteId)`. Returns true iff the user holds `perm` on at least one site. Used for org-scope permissions where the concept is "any admin can do this" not "any site-admin on this specific site".

**No new role types.** No team-permission changes. No RLS rewrites on existing tables.

---

## Argus

Argus is **read-only** in this phase:

- `<ArgusPrefsCard>` shows org `argus_enabled` + daily-budget-remaining as informational; the only writable surface is the per-user `argus_panel_default` toggle.
- No new Argus tools, no new wand surfaces, no new system prompts.
- The Argus side-panel + insight tiles already gate on `orgs.argus_enabled` per Phase 9a — that gate stays load-bearing.

**Page-context provider:** add 2 new `ArgusRouteKey` values for context-aware panel suggestions:
- `settings_organization` — chips: "Suggest industry-typed templates" · "Recommend default site setup" (panel chat — not new wand calls)
- `settings_notifications` — chips: "Which notifications should I subscribe to?" · "What's the difference between OSHA 8hr and 24hr?"

Other settings pages get the **generic** context (no `hasActiveSignal`), so the panel renders without page-specific chips. Zero schema impact — just extends the `ArgusRouteKey` union.

---

## Verification (`docs/smoke-test-phase17.md`)

12-step walkthrough:

1. Sign in as `admin@demo.local` → click avatar → Settings → land on `/settings/profile`.
2. **Profile** edit display name → Save → toast + name persists in topbar.
3. **Appearance** flip to Dark → reload → still Dark; flip to System → reflects browser preference.
4. **Sidebar** uncheck "Assets" + "Documents" → reload → both rows gone from the left sidebar; **direct URL `/resources/assets` still works** (RBAC still permits; only the link is hidden); re-check the boxes → rows reappear on the next nav.
5. **Organization** as `admin@demo.local` → see editable name + industry + read-only slug; upload a 200×200 PNG → preview appears + toast "Logo updated"; refresh page → logo persists.
6. **Organization** sign out + sign in as `worker@demo.local` → `/settings/organization` returns EmptyState "Permission denied".
7. **Argus** (as `admin@demo.local`) → see "Enabled" + "X / 10M tokens used today"; flip "Open side panel automatically" off → reload → panel starts closed; flip back on → reload → panel starts open.
8. **Notifications** → toggle off `capa_overdue` + `argus_suggestion` (wait — Argus doesn't have a kind in v1; use `assigned` instead) → trigger an assignment notification (assign yourself a CAPA via /capa); bell feed stays empty + dashboard alerts banner skips the row; toggle back on → next assignment shows up.
9. **Notifications** life-safety guard → click the disabled `stop_work_raised` Switch → tooltip explains "Life-safety alerts can't be silenced"; try to insert a row directly via `supabase.from('user_notification_silences').insert(...)` → server action returns error; raw DB insert succeeds but the bell-feed filter ignores it (defense-in-depth at the read layer; the UI never offers the insert).
10. **Security** change password (wrong current → field error · matching confirm → success); sign-out-everywhere → land on `/login?signed_out=everywhere` with banner.
11. **Cookies** → click "Clear non-essential local data" → ⌘K palette "Recent searches" empties; theme preference persists; auth cookie persists (still signed in).
12. **Delete account** as `admin@demo.local` (only org-admin) → see "You're the last org admin" amber banner; delete-button disabled. Promote `ehs@demo.local` to site_admin under /admin/members → reload /settings/delete-account → banner gone, button enabled; type correct email → submit → redirect to `/login?account_deleted=1` with banner. Verify in the SQL editor that `auth.users` row is gone + `profiles` row is gone + `site_members` rows for that user are gone.

---

## Definition of done

1. Migration `20260524120000_phase17_settings_redesign.sql` applies cleanly on a fresh Supabase project + on the seeded demo project (idempotent backfill).
2. `pnpm db:types` regen lands the new types (`orgs.logo_url`, `profiles.sidebar_hidden_items`, `profiles.argus_panel_default`, `user_notification_silences`).
3. `/settings` redirects to `/settings/profile`; nested routes render the right card; sidebar groups + tab labels match the spec.
4. `/settings/organization` returns EmptyState for non-`org:configure` users; updates persist for `site_admin`.
5. Logo upload + remove cycle works end-to-end; the public URL renders on the Organization card preview.
6. Sidebar hide/show persists per-user; pinned items never hide; RBAC gate still respected.
7. Notifications silencing + life-safety hard-block works at UI, action, and read layer (bell + banner).
8. Argus panel default toggle persists + actually changes initial open/closed state on next nav.
9. Cookies clear-non-essential button wipes the documented keys + does NOT log the user out.
10. Delete account: typed-email gate + last-admin guard + cascade verified.
11. SPEC §15 entry added; SPEC §AUTH-DELETE-ACCOUNT + §UI-SETTINGS-IA subsections added.
12. `docs/smoke-test-phase17.md` 12-step walkthrough green.
13. `pnpm tsc --noEmit` clean.
14. `pnpm lint` matches the project baseline (no new findings beyond the existing 42/14 from the end of Phase 6j + the small post-Phase-9d / 14 / 15 deltas).
15. CLAUDE.md status block bumped with "Phase 17 Settings Redesign shipped 2026-05-XX (PR #N)".

---

## Open questions — resolve at kickoff Q&A

1. **Cookie-preferences depth** — current default is **transparency-only** (table + clear-local-data button). Should the "Clear non-essential local data" button also clear the **next-themes** preference (so the user resets back to System)? Default = **no** (theme is an explicit user pref, not a tracking cookie). ✅/❌
2. **Account-delete cascade behaviour** — confirm hard-delete via `auth.admin.deleteUser` is acceptable. Trade-off: cascade SET NULL on authored rows means future audit lookups show "Removed user" instead of the original author. The alternative (soft-delete `profiles.deleted_at`) preserves history but adds a column + a UI "hide-by-default" gate on every list. Default = **hard delete** (matches GDPR "right to be forgotten" semantics; loses audit trail but EHS regulators care more about *what happened* than *who reported it* — and the org name is preserved on the row regardless). ✅/❌
3. **Notifications life-safety hard-block scope** — confirm it applies to **both** bell feed AND dashboard banner (default), not just bell. ✅/❌
4. **Logo dimensions / aspect ratio** — recommend on the upload card "Square recommended, 200×200 minimum, up to 2 MB". Should we enforce square (reject non-1:1) or just suggest? Default = **suggest only**; logos in the wild are often not square. UI renders inside a 96×96 fixed box with `object-contain` so non-square logos still display correctly. ✅/❌
5. **Argus tab when `argus_enabled = false`** — render the tab and show "Argus is disabled for your org. Contact support to enable", or hide the tab entirely? Default = **render with disabled-state copy** (consistent with the "tabs are stable IA, content varies by state" pattern). ✅/❌
6. **Sidebar 'reset to defaults' button** — small "Restore all" link at the bottom of the Sidebar tab. Default = **yes**, ships in this phase (1-line addition: `setSidebarHiddenItems([])`). ✅/❌
7. **`canAnywhere` helper location** — `lib/auth/can.ts` (alongside the existing `can`) or a new `lib/auth/canAnywhere.ts`? Default = **co-locate in `can.ts`**; it's a small extension of the same primitive. ✅/❌
8. **PR sizing** — this phase is non-trivial (~2000-2500 LOC across migration + 9 routes + 10 components + 3 cross-cutting wires). Single PR or split (e.g. PR-A: shell + sidebar IA + account/security tabs no-op move; PR-B: organization tab + logo upload + org:configure perm; PR-C: notifications + argus prefs + sidebar customisation; PR-D: cookies + delete account)? Default = **single PR** (matches the Phase 14+16 combined precedent and avoids a half-shipped IA where some tabs exist and others don't). ✅/❌

---

## File / surface inventory

**New files:**
- `supabase/migrations/20260524120000_phase17_settings_redesign.sql`
- `app/(app)/settings/layout.tsx`
- `app/(app)/settings/{profile,appearance,sidebar,organization,argus,notifications,security,cookies,delete-account}/page.tsx` (×9)
- `components/settings/settings-shell.tsx`
- `components/settings/settings-sidebar.tsx`
- `components/settings/sidebar-pref-card.tsx`
- `components/settings/organization-card.tsx`
- `components/settings/org-logo-uploader.tsx`
- `components/settings/argus-prefs-card.tsx`
- `components/settings/notifications-prefs-card.tsx`
- `components/settings/cookies-card.tsx`
- `components/settings/delete-account-card.tsx`
- `lib/settings/clear-local-data.ts` (client-only)
- `lib/auth/can.ts` extension — `canAnywhere(perm)` exported
- `lib/notifications/silences.ts` — helper to fetch silenced kinds for current user (used by bell + banner)
- `docs/smoke-test-phase17.md`

**Changed files:**
- `app/(app)/settings/page.tsx` (now a redirect)
- `app/(app)/settings/actions.ts` (adds 6 new actions)
- `app/(app)/settings/loading.tsx` (skeleton matches new shell)
- `app/(app)/layout.tsx` (passes `argus_panel_default` to provider)
- `components/app-shell/app-sidebar.tsx` (filter against `sidebar_hidden_items`)
- `components/app-shell/nav-config.ts` (exports `HIDEABLE_NAV_ITEMS` const)
- `lib/notifications/list.ts` (bell feed silences filter)
- `lib/dashboard/alerts.ts` (banner silences filter)
- `app/login/page.tsx` (renders `?account_deleted=1` banner)
- `docs/SPEC.md` (§15 entry; new §AUTH-DELETE-ACCOUNT; new §UI-SETTINGS-IA)
- `docs/ui-flow.md` (update the `/settings` row to reflect the new nested-route shape)
- `CLAUDE.md` (status-block bump on merge)

**Removed files:**
- `components/settings/sign-out-card.tsx` (folded into `security-card.tsx`)
