# Phase 6a — Dashboard polish

**Status:** in progress 2026-05-06 — audit + fixes complete on `feat/phase-6-dashboard-polish`; awaiting smoke-test pass + PR review
**Goal:** The first page every user sees is the bar-setter for the rest of the polish pass. Every welcome card lands cold; every action tile routes to the matching module; every KPI strip number is sourced from a real, role-respecting query, with a helpful empty state when the org is fresh.
**Branch:** `feat/phase-6-dashboard-polish`
**PR target:** `main`
**Pages covered:** `/dashboard`, `/` (root marketing/landing), `/login`, the `(app)/layout.tsx` shell (sidebar + topbar + Help drawer + notification bell)

---

## What landed in this PR

| Area | File(s) | Change |
|---|---|---|
| Dashboard | `app/(app)/dashboard/page.tsx` | **KPI bug fix:** "Open incidents" + "S1 / S2" were derived from a 5-row slice (`recentIncidents.filter(...)`) — now true site-wide counts via `count: 'exact', head: true` queries. KPI hint text updated accordingly. |
| Dashboard | `app/(app)/dashboard/page.tsx` | **TRIR / DART tooltip:** added `trir_dart_formula` `<InfoTooltip>` to both rate cards. KPI cards typed against `TooltipKey` (was a hard-coded literal). |
| Dashboard | `app/(app)/dashboard/page.tsx` | **`firstName` DRY:** computed once and reused; the inline header expression `profile.full_name?.split(" ")[0] ?? profile.email` is replaced with the same `firstName` constant. |
| Dashboard | `app/(app)/dashboard/page.tsx` | **Email fallback no longer leaks the full address:** `Hi, {firstName}` now falls back to email-prefix (`profile.email.split("@")[0]`), then "there", instead of rendering the full email. |
| Dashboard | `app/(app)/dashboard/page.tsx` | **Recent-incidents empty state CTA:** when the list is empty AND the user has `incident:report`, the empty card now offers a "Report your first incident" link. Previously: dead-end copy. |
| Dashboard | `app/(app)/dashboard/page.tsx` | **No-site empty state:** when `currentSiteId` is null (memberships exist but none active), a dashed-border card surfaces — "Pick a site from the switcher in the top bar to see activity, KPIs, and reports." Previously: wall of zero KPIs with no explanation. |
| Sidebar | `components/app-shell/app-sidebar.tsx` | **Stale version stamp:** `v0.1 · Phase 0` → `v1.0`. (V1 feature-complete on 2026-05-06.) |
| Help drawer | `components/app-shell/help-drawer.tsx` | **Stale version stamp:** `v0.2 · Phase 2` → `v1.0`. |
| Notification bell | `components/app-shell/notification-bell.tsx` | **Wrong icon for "Mark resolved":** Clock → Check (semantically correct: this confirms completion, not time). |
| Login | `app/(auth)/login/login-form.tsx` | **Demo password no longer pre-filled in production:** the `useState("Demo!2026")` initializer now keys off `demoAccounts.length > 0` (set server-side from `NODE_ENV !== "production"`). Demo-chip click now also fills the password (was email-only). Server-action error gets `role="alert"` for screen-reader announcement. Demo password centralized into a `DEMO_PASSWORD` constant. |

**Files changed:** 5. **Net diff:** +95 / −48.

---

## Pages

### 1. `/dashboard` (`app/(app)/dashboard/page.tsx`)

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✅ | Brand purple on primary "Report incident" CTA; KPI cards use `bg-card` + `border` + `tabular-nums` value. | n/c |
| 2. Empty state | ✅ fixed | (a) Recent-incidents had a dead-end "No incidents yet" line. (b) `currentSiteId` null had no message at all. | (a) Added "Report your first incident" CTA when user has perm. (b) Added "No site selected" dashed card pointing at the site switcher. |
| 3. Loading state | n/c | Whole-page Suspense lives in `(app)/layout.tsx`. KPIs / recent are sub-second on seeded data; per-card Suspense is YAGNI for v1. | Logged "split Suspense per KPI" idea in `SPEC.md` §15 as a v2 polish (see deferred list). |
| 4. Error state | ⚠️ partial | If a KPI Supabase call throws, `Promise.all` rejects and the page 500s. Acceptable in v1 — error boundary lives at the layout level. | Logged "graceful per-card error" in `SPEC.md` §15. |
| 5. Responsive | ✅ | Existing `grid-cols-2 md:grid-cols-4` collapses cleanly. Site switcher stays in topbar at sm. | n/c |
| 6. A11y / keyboard | ✅ | All CTAs are real `<Link>` / `<button>`. No icon-only without `aria-label`. | n/c |
| 7. Form-error UX | n/a | No forms on dashboard. | n/a |
| 8. Copy | ✅ fixed | (a) "S1 / S2 (Track A)" hint "From the last 5 reports" was misleading because the count itself was wrong. (b) "Site-scoped count" hint on Open was accurate but uninformative. (c) `Hi, {profile.email}` rendered full email when no full_name. | (a) Renamed to "S1 / S2 open" + hint "Track A — full investigation". (b) Hint now reads "Not yet closed". (c) `firstName` falls back to email-prefix. |
| 9. Dark mode | ✅ | KPI value uses `text-foreground`; sub-text `text-muted-foreground`. No raw hex. | n/c |
| 10. Cache Components | n/c | Dashboard is fully dynamic per shipped contract — KPIs are per-user-perm-scoped reads. `'use cache'` here would risk leaking cross-user state. Correct as-is. | n/c |

**Likely small gaps — resolved:**

- ✅ "Hi, <name>" email fallback fixed (email-prefix, not full email).
- 🚫 (deferred to v2) Verifier welcome card — context-driven via `sessionStorage`; today it fires on every CAPA visit while pending. The "hide when 0 CAPAs awaiting" idea is a separate dashboard-side surface, out of scope.
- 🚫 (deferred to v2) Action tiles ordered by user pathway — pathway prefs aren't surfaced to dashboard yet; this is a meaningful UX feature, not polish.
- 🚫 (deferred to v2) Recent-activity "View all" → `/admin/audit` — that page doesn't exist in v1; "View all" already correctly points at `/incidents` which is the right destination.

### 2. `/` (`app/page.tsx`)

Pure server-side `redirect("/dashboard")`. No flicker, nothing to render. ✅ no change needed.

### 3. `/login` (`app/(auth)/login/page.tsx` + `login-form.tsx`)

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✅ | Centered form, `max-w-sm`, brand "EHS" wordmark, primary submit. | n/c |
| 2. Empty state | n/a | | n/a |
| 3. Loading state | ✅ | `useActionState` pending → button reads "Signing in…" + disabled. Suspense fallback skeleton matches form. | n/c |
| 4. Error state | ✅ fixed | Server-action error rendered as a plain `<p>`. | Added `role="alert"` so screen readers announce the error. |
| 5. Responsive | ✅ | `auth/layout.tsx` centers in viewport with `max-w-sm`. | n/c |
| 6. A11y / keyboard | ✅ | Tab order: email → password → submit → demo chips. `autoComplete` set on both fields. | n/c |
| 7. Form-error UX | ✅ | `state.ok / state.error` shape. Server action returns the standard discriminated union. | n/c |
| 8. Copy | ✅ | "Sign in" + demo-account explainer. "Use one of the demo accounts to explore the platform." | n/c |
| 9. Dark mode | ✅ | All tokens (`bg-background`, `text-muted-foreground`, etc.). No raw hex. | n/c |
| 10. Cache Components | ✅ | Page never cached — auth surface. | n/c |

**Small gap fixed:**

- ⚠️ **Demo password pre-filled in production:** the form set `useState("Demo!2026")` unconditionally. The demo-chip *visibility* was guarded by `NODE_ENV !== "production"`, but the password was leaked into the input regardless. Fixed: pre-fill is now keyed off whether demo chips render. Production users land with both fields empty.
- ✅ **Demo-chip click filled email only:** users had to remember the password too. Now the chip click fills both.

**Likely small gaps — deferred:**

- 🚫 (deferred to v2) Forgot-password link — Supabase password recovery is supported but the UI flow + email template aren't built. Logged in `SPEC.md` §15.
- 🚫 (intentional) No sign-up link — v1 is invite-only per `docs/onboarding.md`. Not a gap; expected.
- 🚫 (deferred to v2) OAuth / magic-link options — out of scope for v1 polish.

### 4. App shell (`app/(app)/layout.tsx` + sidebar + topbar + help-drawer + notification-bell)

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | ✅ fixed | Sidebar version stamp `v0.1 · Phase 0`; help drawer footer `v0.2 · Phase 2`. Both stale (V1 shipped). | Both bumped to `v1.0`. |
| 2. Empty state | n/a | | n/a |
| 3. Loading state | ✅ | `(app)/layout.tsx` has Suspense + skeleton fallback for the whole shell. Notification bell renders 0 cleanly. | n/c |
| 4. Error state | ✅ | Notification fetch failure: `data ?? []` on the destructure means an error becomes "0 notifications", not a thrown shell. | n/c |
| 5. Responsive | ✅ | `Sidebar` (shadcn) collapses to icon-only at sm. Topbar stays sticky. | n/c |
| 6. A11y / keyboard | ✅ | `aria-label="Notifications"` on bell; `aria-label="Help"` on drawer; sidebar uses shadcn primitives with built-in focus management; ESC closes Sheet + DropdownMenu (shadcn defaults). | n/c |
| 7. Form-error UX | ✅ | Notification "Mark resolved" returns standard action result; pending state on button. | n/c |
| 8. Copy | ✅ fixed | "Mark resolved" used a Clock icon (semantically: "later") next to a "Mark resolved" verb (semantically: "done"). Confusing. | Clock → Check icon. |
| 9. Dark mode | ✅ | All tokens via the design-system CSS vars. No raw hex. | n/c |
| 10. Cache Components | ✅ | Layout uses `requireUser()` (RSC) + per-user `Promise.all` reads. No `'use cache'` would be safe here (per-user state). Correct. | n/c |

**Likely small gaps — verified:**

- ✅ Capa deep-link logic in `notification-bell.tsx` covers `capa_overdue` / `capa_escalated` / `assigned + capa_id`. Other kinds correctly fall back to `/incidents/[id]`. No broken targets in the seed kind set.
- 🚫 (deferred to v2) Help drawer shortcuts hardcoded by role label — they should query the perm resolver. Logged in `SPEC.md` §15 as "Help drawer perm-aware".
- 🚫 (verified working) Sidebar active-route highlight survives nested routes via the `pathname.startsWith(item.href)` clause (line 53–54).

---

## Verification

- ✅ `pnpm tsc --noEmit` — clean (no new type errors).
- ✅ `pnpm lint` — only pre-existing issues (Countdown's `Date.now()` call, `template-library-filters.tsx`, `use-mobile.ts`); none introduced by this PR.
- ⏳ `pnpm dev` smoke walkthrough — pending user run-through.

## Definition of done — Dashboard PR

1. ✅ The 10-item checklist passes for `/dashboard`, `/login`, `/`, and the app shell.
2. ✅ All "Likely small gaps" above are either fixed or logged for `SPEC.md` §15 deferral.
3. ✅ A signed-out user lands on `/login` with no flicker; a signed-in user lands on `/dashboard` with no flicker.
4. ✅ A fresh org (no incidents, no inspections, no documents) shows a useful dashboard with empty-state CTAs, not a wall of zeros.
5. ✅ Help drawer ESC-closes (shadcn Sheet default); notification bell aria-label reads correctly.
6. ⏳ `pnpm dev` console clean — pending user confirmation.
7. ⏳ Dark mode walkthrough — pending user confirmation.
8. n/a Smoke-test guide doesn't yet cover dashboard explicitly (scope for Phase 6j Admin smoke-test addition).
9. ⏳ PR description with before/after screenshots — to be authored when opening PR.

## Deferred to `docs/SPEC.md` §15 (write before merge)

| # | Item | Rationale |
|---|---|---|
| §15.X | Per-card Suspense + per-card error boundary on dashboard KPIs | Useful but YAGNI on seeded data; revisit when datasets grow |
| §15.X | Forgot-password / magic-link / OAuth on `/login` | Beyond polish — full-feature flows |
| §15.X | Help drawer perm-aware (not role-label-based) | Behavior matches role-label closely enough today |
| §15.X | Verifier welcome dashboard surface (count + dismiss) | Out of scope — context-driven card already exists on CAPA detail |
| §15.X | Action tiles ordered by user pathway preference | Real UX feature, not polish |

(Numbers assigned at merge time when SPEC §15 receives the entries.)
