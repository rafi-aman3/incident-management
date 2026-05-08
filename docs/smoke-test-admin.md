# Admin smoke-test umbrella

This is the index for admin-surface smoke testing. Phase 11 shipped the
bulk of the admin module across three sub-PRs, each with its own
deep-dive smoke-test. Phase 6j layered polish on top of those surfaces
plus the original Phase-6 admin pages (/admin landing, /admin/demo,
/admin/site-setup).

## Per-feature smoke tests

| Surface | Walkthrough |
|---|---|
| Sites + per-site detail (overview/members/hours/setup tabs) | [`smoke-test-phase11a.md`](./smoke-test-phase11a.md) — 16 steps |
| Org-wide members + per-member detail | [`smoke-test-phase11b.md`](./smoke-test-phase11b.md) — 12 steps |
| Roles editor + invitations + public `/invite/[token]` | [`smoke-test-phase11c.md`](./smoke-test-phase11c.md) — Parts A–F, ~30 checkpoints |

The above stay authoritative — re-run the matching guide whenever the
relevant surface changes. They cover RBAC gating, perm regressions, RPC
guards, audit-events trail, and edge cases that a polish pass shouldn't
regress.

---

## Phase 6j polish checks (added 2026-05-08)

These augment the per-feature guides above. They validate the polish
layer 6j added on top of the shipped admin module.

### 1. State coverage
1. Visit `/admin` → throw inside `requireUser` (or revoke a perm key briefly) → brand destructive card with **Try again** + **Back to dashboard** renders. Restore.
2. Visit `/admin/demo` cold → calendar-shell skeleton renders during navigation; throw to verify error.tsx.
3. Visit `/admin/site-setup` cold → header band + step-list + form skeleton renders during navigation; force a server-action error mid-step → brand error card with **Try again** + **Resume setup** link.
4. Visit `/admin/sites/new` cold → form skeleton renders during navigation; throw to verify error.tsx.
5. Visit `/(auth)/invite/<bad-token>` → page renders the `not_found` branch (no error.tsx — the page renders branch-typed errors per Phase 11c precedent).

### 2. /admin landing
1. Org with `activeSites === 0` (cold bootstrap) → 1-line hint above the KPI tiles: "Org just created — get started with the Site setup wizard below." → click jumps to `/admin/site-setup`.
2. KPI tile group + admin-card group + admin-tools group each get an SR-readable region landmark (test with VoiceOver / NVDA: "Admin counts, list, 5 items" / "Admin sections, list, 4 items" / "Admin tools, navigation").
3. At md (768–1024px) the deep-link grid has 2 columns (was 1 before 6j).

### 3. /admin/demo Reset hardening
1. Sign in as a `demo:reset`-permitted user → /admin/demo → click **Reset demo data**.
2. AlertDialog (not plain Dialog) opens, focus is trapped inside, ESC closes, ARIA assertive.
3. Title: "Wipe all transactional data for `<orgName>`?" — org name appears explicitly.
4. The destructive button is disabled until you type the exact org name.
5. Type "wrong" → button stays disabled.
6. Type the exact org name → button enables → click → action fires → on success the dialog closes + toast.
7. **Curl bypass:** simulate by hitting the action with `confirm_name=wrong` → server returns `{ ok: false, error: "Type the org name exactly to confirm", fieldErrors: { confirm_name: [...] } }`. Server-side guard works independently of client.

### 4. /admin/demo a11y
1. is_demo warning callout has `role="status"` (announces on demo flag flip).
2. The 3-card grid has `<section aria-label="Demo affordances">` wrapping it.

### 5. /admin/site-setup wizard a11y
1. ProgressDots reads as a progressbar to the screen reader: "Setup progress, progressbar, Step N of 7 · M complete".
2. StepList reads as a navigation: "Site setup steps, navigation, list, 7 items"; per-item announce: "Step 1: Site basics, complete / current / not yet started".
3. Active step has `aria-current="step"`.
4. Force a save error on any step (e.g. drop a NOT NULL field) → inline alert with **Retry** button; clicking Retry re-submits the same form.

### 6. /(auth)/invite/[token] CTA a11y
1. Open an unauth invite URL → "Log in or sign up" CTA reads "Log in or sign up to accept invitation to `<siteName>`" via aria-label.
2. Open a mismatch case (sign in as wrong account) → "Sign out" CTA reads "Sign out (this invitation is for `<email>`, not `<currentEmail>`)".
3. Open a ready case (signed in as the right account) → "Accept and continue" CTA reads "Accept invitation to `<siteName>` as `<roleName>`".
4. Open an already-accepted case → "Go to dashboard" CTA reads "Go to dashboard (this invitation has already been accepted)".

### 7. Cross-cutting
1. `pnpm tsc --noEmit` clean.
2. `pnpm lint` matches the 42/16 baseline (the AlertDialog migration may add one transient dialog-state warning that already ships across change-role-dialog / archive-site-dialog / template-library-filters — acceptable per the existing baseline).

---

If any 6j step fails, fix before merging. Phase 11 surfaces (sites /
members / roles / invitations) are not expected to regress under 6j —
the per-feature guides cover those.
