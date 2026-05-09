# Phase 8 — Settings (account preferences)

**Status:** drafted 2026-05-08, immediately after Phase 6 closed
**Goal:** Lift `/settings` from the EmptyState stub shipped in 6l Topbar polish (PR #9) to a real account-preferences surface. **Account-only.** Org-level / site-level / notification-recipient surfaces all live elsewhere already (`/admin/sites/[id]`, `/admin/members`, `/admin/roles`, `/admin/site-setup` Step 6) — Phase 8 is what THE USER controls about THEIR OWN account, not what they configure on behalf of the org. Original Phase 8 reservation was "Settings + Members"; Members moved to Phase 11 on 2026-05-07.
**Estimated duration:** ~1 day (small surface, mostly forms)
**Depends on:** Phase 6 closed (12 polish PRs merged 2026-05-08); Phase 11 closed (admin console covers everything that's NOT account-level).
**Branch:** `feat/phase-8-settings`
**PR target:** `main`
**Pages covered:** `/settings` (single route)

> **What this PR ships:**
> - Real `/settings` page replacing the EmptyState stub (`app/(app)/settings/page.tsx` + `loading.tsx` + `error.tsx`).
> - **4 sections** (each its own card on the page; no tabs — the surface is small enough to scroll):
>   1. **Profile** — edit `full_name` + `department`. Email shown **read-only** (changing email is a Supabase verification flow — deferred to v2).
>   2. **Security** — change password via Supabase auth (`auth.updateUser({ password })`), with current-password re-auth via `signInWithPassword` to verify identity before applying. Sign-out-everywhere button calls `auth.admin.signOut(userId)` server-side (admin client) to invalidate every session including the current one (user lands back on `/login`).
>   3. **Appearance** — theme toggle: Light / Dark / System. Per-device via `next-themes` (already a transitive dep through sonner; no new dep). Persists in localStorage; no DB column. Per Q1 recommendation.
>   4. **Sign out** — re-mount the existing `signOut` server action as a section-level button (current location is in the topbar profile dropdown; that stays — this is just a parallel affordance for users who naturally look in Settings).
> - **3 server actions** in `app/(app)/settings/actions.ts`:
>   - `updateProfile` — `full_name + department` validation + RLS-bound update on own row (existing `profiles_update_self` policy from Phase 0 init.sql).
>   - `changePassword` — re-auth via `signInWithPassword` then `auth.updateUser({ password })`. Returns ActionResult with fieldErrors keyed `current_password / new_password / confirm_password`. New password ≥ 8 chars + ≠ current + matches confirm.
>   - `signOutEverywhere` — `auth.admin.signOut(userId)` via service-role admin client; `redirect('/login?signed_out=everywhere')`.
> - **Theme integration:** new `<ThemeProvider>` wrapping `<body>` in the root layout (NOT just sonner's pass-through). Adds the `class="dark"` attribute on `<html>` per the next-themes convention. Verifies the existing `dark:` Tailwind variants in `docs/design.md` §2 still render correctly.
> - **Sidebar nav:** keep Settings out of the sidebar — it stays a profile-dropdown destination per the 6l shipped pattern. Admins reach `/admin` for org-level settings; normal users reach `/settings` from the topbar.
> - **`docs/ui-flow.md`** line 36 update: outdated "Site Admin · Site settings page (post-setup)" → "All users · Account preferences (profile, password, theme, sign out)". The site-level concerns it referenced moved to `/admin/sites/[id]` in Phase 11a.

> **Not in this PR (deferred to v2 or later):**
> - **No schema migration.** `profiles` already has `full_name + department`; password lives in `auth.users`; theme is per-device. Phase 8 is purely UI + server actions over existing tables.
> - **No new permission keys.** Account settings are scoped via RLS to `auth.uid() = profiles.id` (existing `profiles_update_self` policy from Phase 0). No new perm gate.
> - **No email change flow.** Requires Supabase verification email + 2-stage confirm (old + new email). Defers cleanly — email can stay read-only with "Email changes are a v2 feature — contact your admin" copy.
> - **No notification silencing per user.** A user-level "silence specific notification kinds" surface would need a new `user_notification_silences` table plus dashboard-banner + bell-feed filter wiring. Real value but real work. Defers to v2; logged in SPEC §15.
> - **No language preference.** i18n is v2 per Phase 6 plan (PLANNING/IMS_PLANNING.md §16.10).
> - **No two-factor auth (2FA / MFA).** Supabase supports it (`auth.mfa.*`), but enrollment + recovery codes + step-up auth on settings-edit is its own phase. Defer.
> - **No timezone preference.** Sites have `timezone` for the regulatory clock; user-level timezone is for display formatting only — falls back to browser locale, which is good enough for v1.
> - **No `preferred_pathway` column / personalized dashboard.** CLAUDE.md mentions pathways as an onboarding concept, but no `preferred_pathway` column shipped on profiles. Per Q5 — defer; revisit when the dashboard needs personalization beyond what the empty-state cards already provide.
> - **No avatar upload / profile photo.** Defer — would need Storage bucket + thumbnail generation + per-user RLS. Adds breadth without unblocking anything in V1.
> - **No theme = per-user DB column.** Per Q1 — `next-themes` + localStorage is the convention; cross-device theme sync isn't standard product expectation.
> - **No active-sessions list.** Showing "Signed in from 3 devices" requires admin-client session enumeration + per-device labels (browser / IP). Deferred; "Sign out everywhere" alone covers the security need.

---

## Definition of done

1. `/settings` renders 4 sections (Profile, Security, Appearance, Sign out) with brand-consistent card layout.
2. **Profile section:** form persists `full_name + department` via `updateProfile`; field-level errors via `aria-invalid` + `aria-describedby` per the 11a/6h pattern; toast on success; pending state on submit.
3. **Security section:**
   - Password change: 3-field form (current / new / confirm); re-auth via `signInWithPassword` server-side BEFORE the update so a stolen session can't change the password without the current one; `auth.updateUser({ password })` on success; fieldErrors per field on Zod failure or auth failure (wrong current password = `fieldErrors.current_password = ['Current password is incorrect']`).
   - Sign-out-everywhere: AlertDialog confirm (mirrors 6c destructive-action precedent + 6j Demo Reset typed-name pattern is overkill here — a plain "Yes, sign out everywhere" button inside an AlertDialog with a description sentence is the right tier). On success → redirect to `/login?signed_out=everywhere` and the login page renders a small "You've been signed out from all devices" banner.
4. **Appearance section:** theme toggle (Light / Dark / System) — 3 buttons in a `role="radiogroup"` (mirrors 6f Templates industry-filter + 6i Planner view-toggle precedent: single-select filter without panel-swap is radiogroup, not tablist). Active button has `aria-checked="true"` + brand-purple background. Click flips theme via `next-themes`'s `setTheme()`; persists in localStorage; respects `prefers-color-scheme` on System.
5. **Sign out section:** existing `signOut` action mounted as a section-level button. Plain Button (no AlertDialog — same-device sign-out is reversible by signing back in).
6. **State files:** `loading.tsx` (4-card skeleton matching the post-load layout) + `error.tsx` (brand destructive card with Try again + Back to dashboard, mirrors 6h pattern).
7. **A11y:**
   - Each form has visible labels + descriptive helper text under inputs.
   - The 4 sections are wrapped in `<section aria-labelledby>` so SR users navigate by region.
   - Theme toggle is a radiogroup (per #4).
   - Decorative icons get `aria-hidden`.
8. **Smoke test:** `docs/smoke-test-phase8.md` ~6-step walkthrough (Profile edit · Password change with wrong current · Password change with mismatched confirm · Theme toggle persists across reload · Sign-out-everywhere · `/login?signed_out=everywhere` banner).
9. **Topbar wiring:** the existing 6l profile-dropdown link to `/settings` works without change; the EmptyState stub it pointed to is replaced by the real page.
10. **ui-flow.md** line 36 row updated to match shipped scope (account preferences, not site settings).
11. **`pnpm tsc --noEmit`** clean.
12. **`pnpm lint`** matches the 42/14 baseline established at the end of 6j (no new findings; the AlertDialog migration on Sign-out-everywhere may add 1 transient setState-in-effect-on-success warning that already ships across change-role-dialog / archive-site-dialog / template-library-filters — acceptable per the existing baseline).

---

## Task list (ordered)

### A. Theme infrastructure

#### 1. Install + wire `next-themes`

`next-themes` is already a transitive dep through sonner (verified). Install as a direct dep so we own the version.

```bash
pnpm add next-themes
```

#### 2. `<ThemeProvider>` in root layout

Add to `app/layout.tsx`:

```tsx
import { ThemeProvider } from "next-themes";

<html lang="en" suppressHydrationWarning>
  <body>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </ThemeProvider>
  </body>
</html>
```

`suppressHydrationWarning` on `<html>` is the next-themes recommendation (the `class="dark"` attribute is set client-side after mount, so the SSR markup mismatches by design for one frame).

### B. Server actions

#### 3. `updateProfile` action

```ts
// app/(app)/settings/actions.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Display name can't be empty").max(120),
  department: z.string().trim().max(120).nullable().optional(),
});

export async function updateProfile(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: fd.get("full_name"),
    department: fd.get("department") || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      department: parsed.data.department,
    })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  // Topbar reads full_name from the same row — refresh the layout cache.
  revalidatePath("/", "layout");
  return { ok: true };
}
```

#### 4. `changePassword` action

```ts
const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Required"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "New password must differ from current",
    path: ["new_password"],
  });

export async function changePassword(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse({
    current_password: fd.get("current_password"),
    new_password: fd.get("new_password"),
    confirm_password: fd.get("confirm_password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user } = await requireUser();

  // Re-auth so a stolen session can't change password without the current one.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: parsed.data.current_password,
  });
  if (reauthErr) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { current_password: ["Current password is incorrect"] },
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
```

#### 5. `signOutEverywhere` action

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function signOutEverywhere(): Promise<never> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await admin.auth.admin.signOut(user.id);
  redirect("/login?signed_out=everywhere");
}
```

The existing `lib/supabase/admin.ts` (shipped Phase 11c for invitation lookup) is the source for the service-role client. `auth.admin.signOut(userId)` invalidates every refresh token for the user, including the current session — the user lands on `/login` on the next request.

### C. Settings page UI

#### 6. `app/(app)/settings/page.tsx`

Replaces the EmptyState stub. Renders 4 cards in a 1-column layout (`max-w-3xl`):

```tsx
export default async function SettingsPage() {
  const { profile, user } = await requireUser();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Manage your account preferences. Org-level settings live under <Link href="/admin">Admin</Link>.
        </p>
      </div>

      <ProfileCard initial={{ full_name: profile.full_name, email: user.email!, department: profile.department }} />
      <SecurityCard />
      <AppearanceCard />
      <SignOutCard />
    </div>
  );
}
```

#### 7. `<ProfileCard>` component

Client component for the form-error UX. Renders email read-only with a "v2" hint, full_name + department editable, save button with pending state, toast on success.

#### 8. `<SecurityCard>` component

Two sub-sections within one card:
- **Change password** — 3-field form with `useActionState(changePassword, null)`; pending → button disabled; success → toast + reset all 3 fields.
- **Sign out everywhere** — AlertDialog (mirrors 6c primitive) with a "Yes, sign out everywhere" destructive button.

#### 9. `<AppearanceCard>` component

Theme toggle. 3 buttons in a `role="radiogroup"` with `aria-label="Theme preference"`:

```tsx
<div role="radiogroup" aria-label="Theme preference" className="inline-flex rounded-md border p-0.5">
  {(["light", "dark", "system"] as const).map((t) => (
    <button
      key={t}
      role="radio"
      aria-checked={theme === t}
      onClick={() => setTheme(t)}
      className={cn(
        "rounded px-3 py-1.5 text-sm capitalize",
        theme === t ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {t}
    </button>
  ))}
</div>
```

`useTheme()` from next-themes; `useEffect` + `mounted` flag to avoid hydration mismatch on the active-theme readback (next-themes recommendation).

#### 10. `<SignOutCard>` component

Re-mounts the existing `signOut` action. Plain Button (no AlertDialog — same-device sign-out is reversible by signing back in; the friction would be silly).

### D. State files + smoke test

#### 11. `app/(app)/settings/loading.tsx`

4-card skeleton matching the post-load layout (header band + 4 cards each with 1–3 input skeletons).

#### 12. `app/(app)/settings/error.tsx`

Brand destructive card with **Try again** + **Back to dashboard** (mirrors the 6h/6j shape).

#### 13. `docs/smoke-test-phase8.md`

6-step walkthrough:
1. Sign in → click profile avatar → Settings → land on `/settings`.
2. Profile: edit display name → Save → toast "Profile updated"; topbar reads the new name on next nav.
3. Security: Change password with WRONG current → field error "Current password is incorrect" on the current-password field.
4. Security: Change password with mismatched confirm → field error on the confirm field.
5. Security: Change password successfully → toast; sign out + sign back in with new password works.
6. Security: Sign out everywhere → AlertDialog confirm → click → land on `/login?signed_out=everywhere` with a small banner; trying to use a previously-open tab in another browser fails with `redirect('/login')`.
7. Appearance: click Dark → page flips to dark mode; reload → still dark. Click System → reflects browser preference.
8. Sign out (this device): clicks the section-level button → land on `/login`.

### E. Login page polish

#### 14. `?signed_out=everywhere` banner

`/login` reads `searchParams.signed_out === "everywhere"` and renders a 1-line warning callout above the form: "You've been signed out from all devices. Sign in again to continue."

### F. Doc updates

#### 15. `docs/ui-flow.md` line 36

Replace:

```
/settings                               Site Admin · Site settings page (post-setup)
```

with:

```
/settings                               All users · Account preferences (profile, password, theme, sign out)
```

#### 16. `CLAUDE.md` status block

After PR merges: bump from "V1 polish-complete" line to also include "Phase 8 Settings shipped 2026-05-XX (PR #N)".

#### 17. `docs/SPEC.md` §15

Append entries for the deferred items (email change, MFA, notification silencing, avatar, language, timezone preference, active sessions list).

---

## Open questions — resolve before §A kickoff

1. **Theme storage: `next-themes` + localStorage (per-device) vs. new `profiles.theme_preference` column (synced).** Per-device is the standard product convention (every major SaaS does this). Adding a DB column means a 1-line migration + an extra round-trip on first paint. Recommend **per-device via next-themes**. ✅/❌
2. **Sign-out-everywhere — ship it or defer?** Requires the service-role admin client (already shipped in Phase 11c for `/invite/[token]` lookup). The action is straightforward; the only operational risk is the user accidentally signing themselves out and being mildly inconvenienced (they can sign back in). Recommend **ship it** — it's a security best-practice users expect on a settings page. ✅/❌
3. **Email change — defer?** Requires Supabase verification email + 2-stage confirm. Material work. Recommend **defer to v2**; show email read-only with "Contact your admin to change" copy. ✅/❌
4. **Notification silencing per user — defer?** Real product value but real work (new table + dashboard banner filter + bell feed filter + per-kind UI). Recommend **defer**; the platform is fine with site-level recipient management for v1. ✅/❌
5. **`preferred_pathway` column for personalized dashboard — defer?** CLAUDE.md mentions pathways as an onboarding concept but no column exists. Adding it would need (a) the migration, (b) a Settings checkbox group, (c) dashboard logic to honor the selection. Recommend **defer** — the dashboard's empty-state cards already personalize without needing a stored preference; cross that bridge when the dashboard needs more. ✅/❌
6. **Confirm-on-sign-out for the section-level Sign out button — yes or no?** AlertDialog confirm vs. plain button. Recommend **plain button** — same-device sign-out is reversible; AlertDialog friction without a forcing reason. (Sign-out-everywhere DOES get an AlertDialog because every-device is harder to undo.) ✅/❌
