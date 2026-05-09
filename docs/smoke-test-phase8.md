# Phase 8 Settings — smoke test

~5-minute walkthrough validating the account-preferences surface shipped
in Phase 8. Run after `pnpm dev` boots clean and the demo orgs exist.

## Step 1 — Land on /settings

1. Sign in as `worker@demo.local` (password `Demo!2026`).
2. Click the avatar in the topbar → Settings → land on `/settings`.
3. Page renders 4 cards in a single max-w-3xl column: **Profile · Security · Appearance · Sign out**.
4. The header copy points at /admin for org-level settings.

## Step 2 — Profile edit (happy path)

1. In the Profile card, change Display name to "Worker (smoke test)".
2. Optionally fill in Department — e.g. "Operations".
3. Click **Save changes**.
4. Toast: "Profile updated".
5. Click any other nav item, then back — the topbar avatar dropdown shows the new display name.

## Step 3 — Profile edit (validation)

1. Clear the Display name field → Save → field error "Display name can't be empty" + `aria-invalid` flips on the input.
2. Type a 200+ char Department → Save → field error "Department is too long".
3. Restore valid values + save before continuing.

## Step 4 — Password change (wrong current)

1. Open the Security card.
2. Current password: `wrong-password`. New password: `NewPass2026!`. Confirm: `NewPass2026!`.
3. Click **Update password**.
4. Field error on Current password: "Current password is incorrect". Other fields stay clean.

## Step 5 — Password change (mismatched confirm)

1. Current: `Demo!2026`. New: `NewPass2026!`. Confirm: `NewPass2026!-typo`.
2. Click **Update password**.
3. Field error on Confirm new password: "Passwords don't match".

## Step 6 — Password change (success)

1. Current: `Demo!2026`. New: `NewPass2026!`. Confirm: `NewPass2026!`.
2. Click **Update password**.
3. Toast: "Password updated". All 3 password fields reset to empty.
4. Open a private/incognito window → /login → sign in with `worker@demo.local` + `NewPass2026!` → reaches /dashboard. (Roll back: change the password back to `Demo!2026` for the next demo session.)

## Step 7 — Sign out everywhere

1. Open `worker@demo.local` in a second browser (different tab is fine; another browser ideal).
2. In the first browser, Security card → **Sign out everywhere** → AlertDialog opens with descriptive copy.
3. Click **Yes, sign out everywhere**.
4. First browser lands on `/login?signed_out=everywhere` with a 1-line warning callout: "You've been signed out from all devices. Sign in again to continue."
5. Second browser: any page nav fails and lands on `/login` (the session is invalidated).

## Step 8 — Theme toggle

1. Settings → Appearance card.
2. Click **Dark** → page flips to dark mode (sidebar / topbar / cards all token-driven dark variants).
3. Reload → still dark (persisted in localStorage by next-themes).
4. Click **System** → reflects browser's `prefers-color-scheme` (toggle macOS / Windows OS-level dark mode to verify).
5. Click **Light** → returns to light.
6. The active button has `aria-checked="true"` and the brand-purple background.

## Step 9 — Same-device sign out

1. Settings → Sign out card → click **Sign out** (no confirm — same-device is reversible).
2. Lands on `/login` (no `?signed_out=everywhere` banner — that's only for the all-devices flow).

## Step 10 — A11y / SR sanity

1. With VoiceOver / NVDA on, Tab through Settings.
2. Each card reads as its own region (`<section aria-labelledby>` linked to the heading).
3. Theme toggle reads as a radio group ("Theme preference, radiogroup, 3 items"; per-button "Light, radio, selected" / "Dark, radio" / "System, radio").
4. Form fields announce their label + helper text + invalid state when applicable.

## Step 11 — Console hygiene

1. DevTools console open across all flows.
2. **No** hydration warnings (next-themes' `suppressHydrationWarning` on `<html>` covers the expected flash).
3. **No** Cache Components runtime errors.
4. **No** RSC import-boundary errors (the ThemeProvider wrapper handles the client/server split).

---

If any step fails, stop and fix before merging. Phase 8 has no schema
migrations, so failures here are typically (a) a server action returning
the wrong shape, (b) a `next-themes` setup quirk (verify the
`<ThemeProvider>` wraps `<TooltipProvider>` in `app/layout.tsx`), or (c)
a Supabase auth API change since the action was written.
