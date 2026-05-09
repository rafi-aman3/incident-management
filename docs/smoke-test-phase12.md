# Phase 12 — Auth & Onboarding smoke test

~10-minute walkthrough validating the end-to-end signup → verify →
onboard → dashboard flow shipped in Phase 12. Run after `pnpm dev`
boots clean.

## Prerequisites

- `.env.local` has `NEXT_PUBLIC_DEMO_OTP_BYPASS=8484` set (default in dev).
- Supabase project is on the Phase 12 migration (`pnpm db:push` shows up-to-date).
- The 4 seeded demo accounts (`worker@demo.local` etc.) have `profiles.onboarded_at` backfilled to `now()`.

---

## Step 1 — Visit `/login`

1. `pnpm dev` → open <http://localhost:3000/login>.
2. Form renders with demo-account chips.
3. Below the form: **Forgot password?** link + "Don't have an account? Sign up" link.

## Step 2 — Sign up new account

1. Click **Sign up** → land on `/register`.
2. Form fields: Full name · Email · Password · Confirm password.
3. Type:
   - Full name: `Demo One`
   - Email: `demo+one@example.com` (use a fresh email — Supabase rejects duplicates)
   - Password: `DemoPass2026!`
   - Confirm: `DemoPass2026!`
4. Submit → redirect to `/verify-otp?email=demo%2Bone%40example.com`.
5. Page shows the email + 6-digit OTP input + a **DEMO: enter 8484** hint chip (visible only in dev).

## Step 3 — Verify with magic OTP

1. Type `8484` → submit.
2. Server: admin client confirms email + signs user in via cookie-cached password.
3. Land on `/onboarding` (signed in, no profile yet).

## Step 4 — Onboarding Step 1+2 (atomic)

1. Wizard renders header + 3-dot progress bar (Step 1 active = brand-purple).
2. **Organization** fieldset: type "Acme Safety", pick industry "Manufacturing".
3. **First site** fieldset: type "Acme HQ", country "United States (OSHA)", timezone "America/Chicago".
4. Click **Create my workspace** → calls `bootstrap_org_v1` RPC.
5. Toast "Workspace created"; progress bar advances to Step 2 (Invite teammates).

## Step 5 — Onboarding Step 3 (optional invites)

1. Type 1-2 emails (e.g., `colleague1@example.com\ncolleague2@example.com`).
2. Click **Send invites & continue** → server calls `invite_member_to_site_v1` for each.
3. Toast per success; progress bar advances to Step 3 (All set).
4. **OR** click **Skip for now** → straight to Step 3.

## Step 6 — Done step → dashboard

1. Step 3 renders centered checkmark + "You're all set" copy.
2. Click **Go to dashboard** → server flips `profiles.onboarded_at = now()` + redirects to `/dashboard?welcome=1`.
3. Land on `/dashboard` with the welcome cards from 6a Dashboard polish (empty-state CTAs).

## Step 7 — Persistence: sign out + sign back in

1. Click avatar in topbar → **Sign out** → land on `/login`.
2. Type `demo+one@example.com` + `DemoPass2026!` → sign in.
3. Land on `/dashboard` (NOT `/onboarding` — `onboarded_at` is set).
4. Topbar shows "Acme Safety" org context; sidebar shows the modules; "Acme HQ" is the current site.

## Step 8 — Validation: duplicate email

1. Sign out → `/register` → enter the same email `demo+one@example.com` again.
2. Submit → field error on email: "This email is already registered. Try signing in instead."

## Step 9 — Validation: password mismatch

1. `/register` with a fresh email + mismatched passwords.
2. Submit → field error on Confirm: "Passwords don't match".

## Step 10 — Tab-crash recovery

1. Sign up a fresh account (e.g., `demo+two@example.com`); verify with 8484.
2. On `/onboarding`, complete **Step 1+2** (Create my workspace).
3. **Close the tab** before clicking Send invites or Skip.
4. Re-open the app → `/login` → sign in as `demo+two@example.com`.
5. Land on `/onboarding?step=invite` (NOT `/dashboard` — `onboarded_at` is still NULL).
6. Skip or send invites → finish → `/dashboard`.

## Step 11 — Forgot password loop (demo)

1. `/login` → click **Forgot password?** → `/forgot-password`.
2. Type `demo+one@example.com` → submit → success card "Check your inbox".
3. Server console shows: `[DEMO] Password reset requested for demo+one@example.com — Supabase will email a magic link landing at <APP_URL>/reset-password`.
4. (For demo purposes, the actual email goes through Supabase's hosted SMTP; if no email arrives, that's expected — the magic link can also be triggered via Supabase Dashboard → Auth → user → "Send magic link".)
5. When the link arrives, click → land on `/reset-password` with a session.
6. Type new password + confirm → submit → land on `/login?password_reset=1` with green banner.
7. Sign in with the new password → reach dashboard.

## Step 12 — Existing demo accounts unchanged

1. Sign in as `worker@demo.local` / `Demo!2026`.
2. Land on `/dashboard` directly — onboarding skipped because `profiles.onboarded_at` was backfilled to `now()` in the migration.

## Step 13 — A11y / SR sanity

1. With VoiceOver / NVDA on `/onboarding`:
   - Progress bar reads "Onboarding progress, progressbar, Step N of 3 · `<step name>`".
   - Each fieldset reads as a group with its legend.
2. On `/verify-otp`: OTP input reads "Verification code, edit text, required" + the demo hint chip is reachable via Tab.
3. On `/register`: every form field has labels + helper text + invalid-state announces.

## Step 14 — Console hygiene

1. DevTools console open across all flows.
2. **No** hydration warnings.
3. **No** Cache Components runtime errors.
4. **No** missing-SelectItem warnings (industry / country / timezone all default-valued).
5. Server logs show:
   - `[AppShell]` debug line on each authenticated render (existing instrumentation).
   - `[DEMO] Password reset requested for …` for the forgot-password test.
   - No "RLS" or "permission denied" rows during onboarding.

---

If any step fails, stop and fix before merging. Phase 12 has 1
schema migration (additive — `profiles.onboarded_at`), 1 RPC
(`bootstrap_org_v1`), and 1 RLS policy (`profiles_self_insert` for
defense in depth). Failures here typically mean: (a) the migration
didn't apply (run `pnpm db:push`); (b) the OTP env var isn't set
(check `.env.local`); (c) the cookie expired between register and
verify (>5 min, harmless — user retries via `?after_verify=1`
banner from /login).
