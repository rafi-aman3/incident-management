# Phase 12 — Auth & Onboarding

**Status:** drafted 2026-05-09
**Goal:** Today the platform has only one auth surface (`/login` with the 4 seeded demo accounts) — registration, OTP verification, password recovery, and post-signup org-bootstrap don't exist. For the demo we need a **functional, end-to-end signup → verify → onboard → dashboard flow** so a stakeholder can experience how a brand-new customer would get started. The OTP step is real-shaped (form + verify action + redirect) but uses a **fixed demo code `8484`** instead of wiring SMTP/SMS — every other piece (registration, session, org/profile/site creation, RBAC seeding, dashboard handoff) is **fully functional**: a brand-new email logged out + back in still owns its real org and real first site, and re-running the same email post-signup hits the right "email in use" path. Onboarding is its own lightweight wizard (org name + industry → first site → optional invites → done), separate from the existing per-site `/admin/site-setup` wizard which handles deeper site configuration.
**Estimated duration:** ~2-3 days (largest auth surface area in the codebase to date — 6 new pages + 6 server actions + 1 RPC + 1 schema migration)
**Depends on:** Phase 0 (orgs / profiles / `seed_default_roles()`), Phase 1 (existing `/login`), Phase 11c (admin invitations table + `invite_member_to_site_v1` RPC — onboarding's optional Step 3 reuses it), Phase 8 (`<ThemeProvider>` already global). No conflicts with shipped routes.
**Branch:** `feat/phase-12-auth-onboarding`
**PR target:** `main`

> **Pages this PR ships (6 new + 1 modified):**
> - `app/(auth)/register/page.tsx` — signup form (full name + email + password + confirm)
> - `app/(auth)/verify-otp/page.tsx` — 4-digit OTP input with resend cooldown
> - `app/(auth)/forgot-password/page.tsx` — request password reset
> - `app/(auth)/reset-password/page.tsx` — apply new password (after Supabase magic link)
> - `app/(onboarding)/onboarding/page.tsx` — onboarding wizard (3 steps: Org · First site · Invite teammates)
> - `app/(onboarding)/onboarding/loading.tsx` + `error.tsx`
> - `app/(auth)/login/page.tsx` (modified) — adds "Don't have an account? Sign up" + "Forgot password?" links beneath the form
>
> **Note on the new `(onboarding)` route group:** unlike `(auth)` (no profile required) and `(app)` (full requireUser), `(onboarding)` accepts users who have an `auth.user` row but **no `profiles` row** — they're mid-bootstrap. New `requireAuthenticatedUser()` helper in `lib/supabase/auth.ts` handles this gate.

> **Server actions this PR ships (in `app/(auth)/*/actions.ts` + `app/(onboarding)/onboarding/actions.ts`):**
> - `signUp` — `auth.signUp({ email, password, options: { data: { full_name } } })`. Sends a Supabase verification email in production; in demo mode does **not** send (we use the magic OTP `8484` directly). Returns `ActionResult` + redirects to `/verify-otp?email=…`.
> - `verifyOtp` — accepts the 6-digit code from `/verify-otp` form. **Demo mode (env var `NEXT_PUBLIC_DEMO_OTP_BYPASS=8484`):** if the typed code matches `8484`, the action calls the admin client's `auth.admin.updateUserById(userId, { email_confirm: true })` to mark the email confirmed + signs the user in via `auth.signInWithPassword` using the password they just registered with (server caches it briefly via a short-lived `pending_otp_session` cookie). **Production mode** (when env var unset): uses `auth.verifyOtp({ email, token, type: "signup" })` against Supabase's email OTP. Either path redirects to `/onboarding`.
> - `resendOtp` — re-issues the verification email (production) or no-op-with-success-toast (demo). 60s cooldown enforced server-side.
> - `requestPasswordReset` — `auth.resetPasswordForEmail(email, { redirectTo: <APP_URL>/reset-password })`. In demo mode prints the link to the server console (no email actually sent) and shows the same "Check your inbox" success message regardless of email validity (no enumeration leak).
> - `setNewPassword` — accepts a fresh password from `/reset-password`; confirms via `auth.updateUser({ password })`.
> - `bootstrapOrg` — onboarding Step 1+2 single-action commit. Calls a new SECURITY-DEFINER RPC `bootstrap_org_v1(p_org_name, p_industry, p_country, p_site_name, p_timezone)` that creates `orgs` + `profiles` + first `sites` + `site_members` (caller as `site_admin` + `include_children=true`) + invokes `seed_default_roles()` — all in one transaction. Returns the new `org_id` + `site_id`. Redirects to `/onboarding?step=invite&site=<id>`.
> - `inviteOnOnboarding` — onboarding Step 3 (optional). For each invited email, calls the existing `invite_member_to_site_v1` RPC from Phase 11c. Skip-button bypasses entirely.
> - `finishOnboarding` — final commit; toggles a new `profiles.onboarded_at` timestamp; redirects to `/dashboard?welcome=1`.

> **Server-side gate updates:**
> - **`requireUser()`** (`lib/supabase/auth.ts`): existing behavior preserved — if no auth.user → `/login`; if no profile row → **NEW** redirect to `/onboarding` instead of `/login` (a user halfway through the flow should land back at the onboarding step they left off, not the login page).
> - **NEW `requireAuthenticatedUser()`** helper: returns `{ supabase, user }` for routes inside `(onboarding)` — accepts no-profile state, redirects to `/login` only if no auth.user.
> - **`(app)` layout:** if `profile.onboarded_at IS NULL` AND the user has a profile + at least one site (i.e., a half-completed signup that DID create the org but DIDN'T finish onboarding) → redirect to `/onboarding?step=invite` so they finish. Otherwise full app access. Edge case is intentional: `bootstrap_org_v1` succeeds on Step 2 → user crashes their tab → re-opens → still gets routed to "you have 1 task left" on Step 3.

> **DB changes (1 migration):**
> - `20260513120000_phase12_auth_onboarding.sql`:
>   - `alter table profiles add column onboarded_at timestamptz` — `null = mid-onboarding or skipped invites`, `not null = onboarding complete`. Backfill all existing profile rows to `now()` so the 4 seeded demo accounts skip the onboarding gate.
>   - New SECURITY DEFINER RPC `bootstrap_org_v1(p_org_name text, p_industry industry_type, p_country char(2), p_site_name text, p_timezone text)` — creates `orgs` + `profiles` row + first `sites` row + `site_members` row (caller as `site_admin` + `include_children=true`) + invokes `seed_default_roles(<new org_id>)`. Returns `(org_id uuid, site_id uuid)`. Pre-condition: caller's `auth.uid()` exists, no profile row exists for that user yet (otherwise raises `'You already have an account in <existing_org_name>'`).
>   - New RLS policy `profiles_self_insert` so a freshly-onboarded user CAN insert their own profile row via the `bootstrap_org_v1` SECURITY DEFINER call (the RPC bypasses RLS via security definer; this policy is for parity if anyone bypasses the RPC and inserts directly).
>   - No new permission keys — onboarding inherits from `seed_default_roles`'s site_admin grant set.

> **Demo mode behavior** (gated on `process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS === "8484"`, default ON in dev/preview, OFF in production):
> - Registration: succeeds without email delivery. The `auth.users` row is created with `email_confirmed_at` still NULL.
> - `/verify-otp`: typing `8484` → action uses admin client to `email_confirm: true` + signs the user in via the password they registered with (cached in a short-lived `pending_otp` cookie, see §"Cookie security" below).
> - `/forgot-password`: prints the magic link to the server console; user copy-pastes it into the URL bar to land on `/reset-password`.
> - `/onboarding`: same flow as production. No demo-specific bypass.
> - **In dev mode, `/verify-otp` shows a small "DEMO: enter `8484`" hint chip below the input** (gated on `process.env.NODE_ENV !== "production"`) — same convention as the demo-accounts panel on `/login`.

> **Not in this PR (deferred to v2 or post-demo):**
> - **No real SMTP wiring.** Production mode uses Supabase's hosted email (already configured in the project) — but for the demo we don't depend on email delivery to any real address. Real emails would land via `supabase.auth.signUp()` and `supabase.auth.resetPasswordForEmail()` automatically; we just don't validate that they're delivered.
> - **No SMS OTP.** Email-only OTP per Supabase's standard. SMS is a Phase 13+ item.
> - **No social SSO** (Google / Microsoft / GitHub). Email + password only.
> - **No 2FA / MFA enrollment.** Already deferred from Phase 8 Settings; same deferral here.
> - **No invite-only mode.** Anyone can register a new org. A future "private signup" flag (`orgs.public_signup_disabled`) would gate this; out of scope for v1.
> - **No org logo upload.** Onboarding collects org name + industry only; logo is a v2 polish.
> - **No team / department picker on Step 5 of `/admin/site-setup`** integrated into onboarding — onboarding stays at first-site-name only; the deeper 7-step wizard is reachable later from `/admin/site-setup` per the existing pattern.
> - **No bulk invite paste-list.** Onboarding's Step 3 takes 1–3 invite emails inline. Bulk import is v2.
> - **No CAPTCHA / rate-limiting.** Supabase auth has built-in rate limits; no app-level CAPTCHA in v1.
> - **No `/welcome` standalone page.** Post-onboarding lands on `/dashboard?welcome=1`; the dashboard's existing 6a polish handles the welcome cards.

> **Cookie security:**
> - The `pending_otp` cookie that briefly caches the password between `/register` and `/verify-otp` (so the demo OTP-success path can sign the user in) is `httpOnly`, `secure`, `sameSite=strict`, `maxAge=300` (5 min), and is deleted by `verifyOtp` immediately after success or by a `set-cookie: pending_otp=; max-age=0` from `/login` redirects. **Production mode** does NOT set this cookie — Supabase's email-OTP flow handles the password during `verifyOtp({ type: "signup" })` directly.

---

## Definition of done

A new stakeholder lands on `/login` cold and follows the click-path:

1. **Sign up** — clicks "Don't have an account? Sign up" → lands on `/register`.
2. Fills full name + email (e.g. `demo+1@example.com`) + password + confirm password → submits.
3. Lands on `/verify-otp?email=demo%2B1%40example.com` with a 4–6 digit input + the demo hint chip (`enter 8484` in dev).
4. Types `8484` → submits → lands on `/onboarding` (signed in, no profile row yet).
5. Step 1: types org name "Acme Safety", picks industry "Manufacturing", picks country "United States" → Save & continue.
6. Step 2: types first site "Acme HQ", picks timezone "America/Chicago" → Save & continue. (Behind the scenes: `bootstrap_org_v1` RPC creates org + profile + site + memberships + default roles in one transaction.)
7. Step 3 (optional): types up to 3 colleague emails → Send invites → land on done state. OR clicks "Skip for now" → straight to dashboard.
8. Lands on `/dashboard?welcome=1` — existing welcome cards from 6a Dashboard polish render with empty-state CTAs ("Log your first incident" / "Run your first inspection" / etc.).
9. **Re-login proves persistence:** sign out → sign in with same email + password → land back on dashboard with the same org + site visible.
10. **Forgot-password proves the recovery path:** on `/login` click "Forgot password?" → `/forgot-password` → submit email → "Check your inbox" → in dev, copy the link from the server console → `/reset-password?code=…` → set new password → toast → can sign in with the new password.
11. **The 4 seeded demo accounts still work** — sign in with `worker@demo.local` / `Demo!2026` → goes straight to dashboard (skips onboarding because their profile already has `onboarded_at` backfilled).
12. **Tab-crash recovery** — sign up + verify + complete Step 1+2 of onboarding (so org + site exist + profile.onboarded_at IS NULL) → close the tab → re-open the app → sign in → land on `/onboarding?step=invite` to finish, NOT on the dashboard with broken state.

---

## Task list (ordered)

### A. Schema + RPC

#### 1. Migration `20260513120000_phase12_auth_onboarding.sql`

```sql
-- 1. Add onboarded_at to profiles. NULL = mid-onboarding (or skipped invites);
-- timestamp = onboarding finished. Existing profiles get backfilled to now()
-- so the 4 seeded demo accounts don't trip the onboarding gate.
alter table profiles add column onboarded_at timestamptz;
update profiles set onboarded_at = now() where onboarded_at is null;

-- 2. Bootstrap RPC. SECURITY DEFINER lets it create the profiles row that
-- the user couldn't insert under RLS (profiles_read requires org_id =
-- current_org() which needs the row to already exist). Atomically creates
-- org + profile + first site + first membership + default roles.
create or replace function bootstrap_org_v1(
  p_org_name text,
  p_industry industry_type,
  p_country char(2),
  p_site_name text,
  p_timezone text
) returns table (org_id uuid, site_id uuid)
  language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_user_email text;
  v_user_full_name text;
  v_org_id uuid;
  v_site_id uuid;
  v_admin_role_id uuid;
  v_existing_org text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Reject if a profile already exists.
  select o.name into v_existing_org
    from profiles p join orgs o on o.id = p.org_id
   where p.id = v_user_id;
  if found then
    raise exception 'You already have an account in %', v_existing_org;
  end if;

  -- Read auth.users for email + raw_user_meta_data.full_name.
  select email, coalesce(raw_user_meta_data->>'full_name', email)
    into v_user_email, v_user_full_name
    from auth.users where id = v_user_id;

  -- Slug derivation: lowercase + hyphenate + 6-char random suffix to avoid collisions.
  insert into orgs (name, slug, industry)
  values (
    p_org_name,
    lower(regexp_replace(p_org_name, '[^a-zA-Z0-9]+', '-', 'g')) ||
      '-' || substr(md5(random()::text), 1, 6),
    p_industry
  ) returning id into v_org_id;

  -- Seed the 4 default roles (worker / supervisor / ehs_manager / site_admin)
  -- with their permission grants. Defined in init.sql + later migrations.
  perform seed_default_roles(v_org_id);

  -- Look up the new org's site_admin role for the membership.
  select id into v_admin_role_id
    from roles
   where org_id = v_org_id and key = 'site_admin' and is_default = true;

  insert into profiles (id, org_id, full_name, email)
  values (v_user_id, v_org_id, v_user_full_name, v_user_email);

  insert into sites (org_id, name, country, timezone)
  values (v_org_id, p_site_name, p_country, p_timezone)
  returning id into v_site_id;

  insert into site_members (site_id, profile_id, role_id, include_children)
  values (v_site_id, v_user_id, v_admin_role_id, true);

  -- onboarded_at stays NULL until finishOnboarding() flips it; that's how
  -- we detect "user crashed mid-onboarding and needs to finish Step 3".
  return query select v_org_id, v_site_id;
end $$;

grant execute on function bootstrap_org_v1(text, industry_type, char(2), text, text)
  to authenticated;

-- 3. Parity policy in case anyone bypasses the RPC (defense in depth).
create policy profiles_self_insert on profiles for insert to authenticated
  with check (id = auth.uid());
```

### B. Server actions

#### 2. `app/(auth)/register/actions.ts` — `signUp`

Standard Zod (`full_name + email + password + confirm_password`); password ≥ 8 chars; passwords match (refine). `auth.signUp({ email, password, options: { data: { full_name } } })`. On success, set the `pending_otp` cookie (httpOnly, secure, sameSite=strict, 5min, value = base64-encoded password — yes, base64; the cookie is httpOnly + sameSite=strict + 5min, and the demo-mode magic OTP is the only path that reads it). Redirect to `/verify-otp?email=…`. Error path: `fieldErrors.email = ["Email is already registered"]` on Supabase's `User already registered` error.

#### 3. `app/(auth)/verify-otp/actions.ts` — `verifyOtp` + `resendOtp`

```ts
const DEMO_OTP = process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS;

export async function verifyOtp(_p, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "");
  const code = String(fd.get("code") ?? "");

  if (DEMO_OTP && code === DEMO_OTP) {
    // Demo path: admin client confirms email + signs user in via cached pw.
    const admin = createAdminClient();
    const { data: { user } } = await admin.auth.admin.getUserByEmail(email);
    if (!user) return { ok: false, error: "Account not found" };
    await admin.auth.admin.updateUserById(user.id, { email_confirm: true });

    const cookieStore = await cookies();
    const pendingPw = cookieStore.get("pending_otp")?.value;
    if (!pendingPw) {
      // Cookie expired — user hit the verify page late. Send back to login.
      redirect("/login?after_verify=1");
    }
    const password = atob(pendingPw);
    cookieStore.delete("pending_otp");

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    redirect("/onboarding");
  }

  // Production path: Supabase's email-OTP verify.
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (error) {
    return {
      ok: false, error: "Validation failed",
      fieldErrors: { code: ["That code didn't match. Try again or resend."] },
    };
  }
  redirect("/onboarding");
}
```

`resendOtp` — server-side 60s cooldown via the same `pending_otp` cookie's age (or a separate `otp_resent_at` cookie).

#### 4. `app/(auth)/forgot-password/actions.ts` + `reset-password/actions.ts`

`requestPasswordReset` → `supabase.auth.resetPasswordForEmail(email, { redirectTo: <APP_URL>/reset-password })`. Always returns `{ ok: true }` regardless of whether the email exists (no enumeration leak); in demo mode, also `console.log("[DEMO] Magic link: <link>")` so the developer can copy-paste.

`setNewPassword` (on `/reset-password?code=…`) → exchange the code for a session via `auth.exchangeCodeForSession(code)` then `auth.updateUser({ password })` then redirect to `/login?password_reset=1`.

#### 5. `app/(onboarding)/onboarding/actions.ts` — `bootstrapOrg`, `inviteOnOnboarding`, `finishOnboarding`

`bootstrapOrg` is a single action covering Steps 1+2 (org + first site) — the user fills both and clicks Save & continue → server calls `bootstrap_org_v1` RPC → returns. The form is split into 2 visual steps client-side but commits in 1 server roundtrip. Reasoning: the org-without-site or site-without-org states are invalid, so we never want to persist halfway between them.

`inviteOnOnboarding` — for each entered email, calls `invite_member_to_site_v1(p_site_id, p_email, p_role_id, p_include_children)` (existing RPC from Phase 11c). The default role is `worker`; the include_children flag = true. Errors per-email collected and shown inline; partial success allowed.

`finishOnboarding` — `update profiles set onboarded_at = now() where id = auth.uid()` + `revalidatePath("/", "layout")` + `redirect("/dashboard?welcome=1")`.

### C. Pages

#### 6. `app/(auth)/register/page.tsx` + `register-form.tsx`

Full name + email + password + confirm-password form. Beneath the submit, "Already have an account? Log in" → `/login`. The `(auth)` layout's centered card chrome stays the same.

#### 7. `app/(auth)/verify-otp/page.tsx`

6 individual `<input maxLength={1}>` boxes side-by-side (per the standard OTP input UX) wired with arrow-key + paste-fill behavior — OR a single `<input inputMode="numeric" maxLength={6}>` (simpler, mobile-keyboard-friendly). **Recommend single-input** for v1; OTP grid is polish for v2. Below the input: "Didn't receive a code? Resend (60s)" cooldown link + the dev-only "DEMO: enter `8484`" hint chip when `process.env.NODE_ENV !== "production"` (gated server-side, passed as a prop).

#### 8. `app/(auth)/forgot-password/page.tsx` + `reset-password/page.tsx`

Email-only form on forgot. Single password + confirm form on reset. Standard centered card chrome.

#### 9. `app/(onboarding)/layout.tsx` + `app/(onboarding)/onboarding/page.tsx`

New route group. Layout is a centered card with a 3-step progress bar at the top (mirrors `<ProgressDots>` from `/admin/site-setup`'s wizard chrome — visually consistent but renamed `<OnboardingDots>` to avoid coupling). Each step renders inline (not separate sub-routes — onboarding is single-page-with-state to keep the form-state simple).

Steps:
- **Step 1 — Org.** Org name (required), industry select (the 7 enum values per `industry_type` from init.sql), country select (US / GB).
- **Step 2 — First site.** Site name (required), timezone select. Submit button: "Create my workspace" — calls `bootstrapOrg` action which commits both steps to the RPC.
- **Step 3 — Invite teammates** (optional). 3 email rows with email-only validation. Submit "Send invites & continue" → calls `inviteOnOnboarding` then `finishOnboarding`. **OR** "Skip for now" link → calls `finishOnboarding` directly.

#### 10. `app/(onboarding)/onboarding/loading.tsx` + `error.tsx`

Mirror the 6h/6j pattern. Loading = wizard shell skeleton. Error = brand destructive card with Try again + Back to login.

### D. Auth gate updates

#### 11. `lib/supabase/auth.ts` — split `requireUser` + add `requireAuthenticatedUser`

```ts
/**
 * For (app) routes: requires auth.user AND profile (full session).
 * Redirects to /login if no auth.user; to /onboarding if auth.user but
 * no profile row yet (mid-bootstrap).
 */
export async function requireUser() { … existing logic + onboarded_at gate … }

/**
 * For (onboarding) routes: requires auth.user but accepts no-profile state.
 * Redirects to /login if no auth.user.
 */
export async function requireAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
```

Inside `(app)/layout.tsx`, after the existing `requireUser()` call: if `profile.onboarded_at` is null AND the user has at least one site membership (i.e., they completed Step 2 but not Step 3), redirect to `/onboarding?step=invite`.

#### 12. Login form polish

Add "Don't have an account? **Sign up**" + "**Forgot password?**" links beneath the existing form. Read `searchParams.password_reset === "1"` and show a green success callout: "Password updated — sign in with your new password." Read `searchParams.after_verify === "1"` (the OTP-cookie-expired edge case) and show a neutral callout: "Verified — sign in to continue."

### E. Smoke test + docs

#### 13. `docs/smoke-test-phase12.md`

8-step walkthrough. Cold start → register → verify → onboard 3 steps → dashboard → sign out → sign back in. Plus 2 edge cases: tab-crash mid-onboarding + forgot-password loop.

#### 14. `docs/ui-flow.md`

Add the 6 new routes to the route inventory:
```
/register              All users · Sign up form
/verify-otp            All users · OTP verification (demo: 8484)
/forgot-password       All users · Request password reset
/reset-password        All users · Apply new password
/onboarding            New users · Onboarding wizard (org → site → invites)
```

#### 15. `docs/SPEC.md` §15 — add the deferred-to-v2 entries

Email SMTP wiring (current relies on Supabase hosted) · SMS OTP · social SSO · 2FA enrollment · invite-only signup mode · org logo upload · bulk invite paste-list · CAPTCHA / rate-limiting · org-level signup-disabled flag.

### F. Wrap

#### 16. `CLAUDE.md` status block bump (post-merge)

#### 17. `MEMORY.md` index pointer + new `project_phase_12_auth_onboarding.md`

---

## Open questions — resolve before §A kickoff

1. **Demo OTP magic value source — env var or hardcoded?** Recommend **env var** `NEXT_PUBLIC_DEMO_OTP_BYPASS=8484` (default value `8484`, presence enables demo bypass; unset disables for production). Lets us flip per-environment without code changes. ✅/❌
2. **OTP input shape — single `<input inputMode="numeric">` vs. 6 individual single-char boxes.** Recommend **single input** for v1 (lighter, mobile-keyboard-friendly, accepts paste natively). The 6-box pattern is polish for v2. ✅/❌
3. **Org name → slug derivation — `lower(name) + 6-char random suffix` vs. user-typed slug.** Recommend **auto-derived** with random suffix (slug must be unique on `orgs.slug` — collisions on common names like "acme" force user-typed slug to add UX friction; auto-derived hides the slug from users entirely). ✅/❌
4. **Country picker on Step 1 (US/GB) vs. defer to first site step.** Recommend **on first site step** — country drives the regulatory clock per-site, not per-org (e.g., a US-based org could open a UK site later). Org-level country is unused. So Step 1 = org name + industry only; Step 2 = site name + country + timezone. ✅/❌
5. **Onboarding Step 3 — invite-emails inline vs. defer entirely.** Recommend **inline + skippable** — 3 email inputs, "Send invites" and "Skip for now" buttons. The flow demos the post-signup invite UX in the same minute as registration. ✅/❌
6. **"Forgot password" demo behavior — `console.log` the magic link vs. show it in the UI.** Recommend **`console.log` only** (keeps the production-shape — server logs would also be where SMTP errors land in real life). The user can grep the dev server output. UI showing the link makes the demo feel like a hack. ✅/❌
7. **Public signup vs. invite-only mode.** Recommend **public signup ON by default** for the demo (anyone with an email can spin up a new org). Invite-only mode (every signup must come through `/admin/invitations`) is a v2 toggle on `orgs.public_signup_disabled`. Logged in SPEC §15. ✅/❌
8. **Cookie storing the pending password — base64-encoded vs. JWT-signed vs. server-side cache.** Recommend **base64-encoded in an httpOnly + sameSite=strict + 5min cookie**. The cookie is unreadable to JS (httpOnly), unreachable cross-site (sameSite), and short-lived (5min covers the verify step). JWT-signing is overkill given the 5min window; server-side cache (Redis-style) adds infra dependency. **Production path doesn't use this cookie** — Supabase's `auth.verifyOtp({ type: "signup" })` handles the password during verification. ✅/❌
9. **Existing `(auth)/callback/route.ts` usage.** It's already wired for OAuth/magic-link code exchange. Reset-password reuses it directly via `auth.exchangeCodeForSession`. Forgot-password's `redirectTo` points at `/reset-password` not `/callback` because we want the password-set form, not auto-login. ✅/❌
