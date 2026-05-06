# Phase 6a — Dashboard polish

**Status:** drafted 2026-05-06 (Phase 6 module 1 of 10)
**Goal:** The first page every user sees is the bar-setter for the rest of the polish pass. Every welcome card lands cold; every action tile routes to the matching module; every KPI strip number is sourced from a real, role-respecting query, with a helpful empty state when the org is fresh.
**Branch:** `feat/phase-6-dashboard-polish`
**PR target:** `main`
**Pages covered:** `/dashboard`, `/` (root marketing/landing), `/login`, the `(app)/layout.tsx` shell (sidebar + topbar + Help drawer + notification bell)

> **What this PR ships:**
> - Audit table per page below, applying the 10-item shared checklist from `plans/06-frontend-polish.md`.
> - Fixes for every flagged item.
> - Updated welcome-card copy where it's vague or generic.
> - Sidebar + topbar + Help drawer hardening (these render on every app page; fixing here means the rest of Phase 6 inherits a clean shell).
> - Smoke-test re-run.

> **Not in this PR:**
> - No new dashboard widgets (those are v2 — see `PLANNING/IMS_PLANNING.md`).
> - No new welcome-card variants.
> - No re-architecture of role-aware dashboard logic.

---

## Pages

### 1. `/dashboard` (`app/(app)/dashboard/page.tsx`)
The role-aware landing. Renders welcome cards (worker / supervisor / EHS-manager / site-admin / verifier), action tiles, KPI strip, recent-activity feed.

**Audit table (fill during execution):**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | | |
| 2. Empty state | TBD | Org-fresh case: any KPIs that read 0 should show "Nothing yet — file your first incident" not just "0". | |
| 3. Loading state | TBD | KPI strip needs skeleton; activity feed needs skeleton | |
| 4. Error state | TBD | If a KPI query fails, does the whole strip blank or does that one card show "—"? | |
| 5. Responsive | TBD | sm-breakpoint: cards collapse to single column? | |
| 6. A11y / keyboard | TBD | Action tiles tabbable? aria-labels on icon-only? | |
| 7. Form-error UX | n/a | No forms on dashboard | |
| 8. Copy | TBD | Welcome card copy: too generic? Vague verbs like "Get started"? | |
| 9. Dark mode | TBD | KPI strip number colors in dark mode? | |
| 10. Cache Components | TBD | KPI queries should be `'use cache'` per-org with revalidation; activity feed must stay dynamic. | |

**Likely small gaps to fix:**
- "Welcome, <name>" header — does it actually pull `auth.users.user_metadata.first_name` or fall back to email-prefix?
- Verifier welcome card — does it hide when there are 0 CAPAs awaiting verification, or just say "0"?
- Action tiles — does the order match the user's pathway preference (`onboarding` → `pathways[]`)?
- Recent activity — limit (10? 20?) and "View all" deep-link to `/admin/audit` (does that page exist? if not, hide the link).

### 2. `/` (`app/page.tsx`)
Root route. Either redirects to `/dashboard` (signed-in) or to `/login` (signed-out), or it's a marketing/landing page.

**Audit:**
- Confirm redirect logic in `proxy.ts` covers this; the page itself should be near-empty.
- If it renders any HTML, audit visual + copy + dark mode.
- Make sure the redirect happens server-side, not via a client-side flicker.

### 3. `/login` (`app/(auth)/login/page.tsx`)
The auth surface. First impression for anonymous users.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Brand purple on primary submit; logo lockup correct | |
| 2. Empty state | n/a | Forms have no empty state | |
| 3. Loading state | TBD | Submit shows pending state? | |
| 4. Error state | TBD | "Invalid credentials" — does it differentiate from "Email not found"? (Probably shouldn't, security). | |
| 5. Responsive | TBD | Single-column mobile layout works? | |
| 6. A11y / keyboard | TBD | Tab order: email → password → submit. Caps Lock warning on password? | |
| 7. Form-error UX | TBD | Server action error shape correct? Field-level for invalid-email format. | |
| 8. Copy | TBD | "Sign in" / "Forgot password?" / link to "Create account" — present? | |
| 9. Dark mode | TBD | Login renders fine in dark? | |
| 10. Cache Components | TBD | This page must NOT be cached (auth state). | |

**Likely small gaps:**
- Forgot-password link — does it route to a page that exists, or 404?
- Sign-up link — is org self-signup gated? If so, link should be hidden or route to a "request access" form.
- Magic-link / OAuth options — Supabase supports them; do we offer any? If yes, audit. If no, document the omission.

### 4. App shell (`app/(app)/layout.tsx`)
Sidebar (Planner ↔ Documents ↔ Reports navigation), topbar (notification bell, Help drawer, user menu), `<Toaster />` mount.

**Audit table:**

| Dimension | Status | Finding | Fix |
|---|---|---|---|
| 1. Visual fidelity | TBD | Sidebar 80/240 collapse per design.md §6.5 | |
| 2. Empty state | n/a | | |
| 3. Loading state | TBD | Notification bell loads without spinner flash? | |
| 4. Error state | TBD | If notifications fetch fails, bell shows 0 without error toast spam | |
| 5. Responsive | TBD | sm: sidebar becomes overlay; topbar remains | |
| 6. A11y / keyboard | TBD | Sidebar items tabbable; expanded/collapsed announces; Help drawer ESC closes; notification bell aria-label includes count | |
| 7. Form-error UX | n/a | | |
| 8. Copy | TBD | User menu items ("Settings" / "Sign out" / "Switch site"?) — labels match what they do | |
| 9. Dark mode | TBD | Sidebar + topbar tokens correct | |
| 10. Cache Components | TBD | Sidebar nav can be cached per-user; notification count must be dynamic | |

**Likely small gaps:**
- Notification bell — capa deep-links work; do all kinds have a deep-link (e.g. `inspection_assigned` → `/inspections/[id]`)?
- Help drawer — role-aware shortcuts: do they match the user's actual perm set, or are they hardcoded by role name? If role-name-based, file a v2 ticket: "Help drawer should query perm set, not role label."
- Sidebar — does the active-route highlight survive nested routes (e.g., `/incidents/new/2` highlights "Incidents")?

---

## Definition of done — Dashboard PR

The PR can merge when:

1. The 10-item checklist passes for `/dashboard`, `/login`, `/`, and the app shell.
2. All "Likely small gaps" above are either fixed or logged in `docs/SPEC.md` §15.
3. A signed-out user lands on `/login` with no flicker; a signed-in user lands on `/dashboard` with no flicker.
4. A fresh org (no incidents, no inspections, no documents) shows a useful dashboard, not a wall of zeros.
5. The Help drawer ESC-closes; the notification bell aria-label reads correctly under VoiceOver / NVDA.
6. `pnpm dev` console is clean for these pages.
7. Dark mode toggle (set OS to dark; reload) renders all four surfaces correctly.
8. Smoke-test guide updated if any affordance moved.
9. PR description includes before/after screenshots for any visual swap.
