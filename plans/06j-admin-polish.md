# Phase 6j — Admin polish

**Status:** re-audited 2026-05-08 against shipped reality on `main` (replaces the 2026-05-06 stub which was written before Phase 11 shipped — sites + members + roles + invitations + public `/invite/[token]` all landed 2026-05-07/08, multiplying the admin surface ~3×). Phase 6 module 10 of 10 — **last per-module polish PR**.
**Goal:** Admin surfaces are seen rarely but are decision-critical when seen. Phase 11 already shipped substantial polish (loading/error files at every route, ARIA on dialogs + tabs, RPC-level guards on every mutation). 6j focuses on the remaining gaps: missing state files at the 3 surfaces Phase 11 didn't cover (`/admin/error.tsx`, `/admin/demo`, `/admin/site-setup` + `[step]`, `/admin/sites/new`); harden the Demo Reset to match the Stripe-style type-the-name guard already shipped on 11a's `<ArchiveSiteDialog>` (the existing Reset is a plain Dialog with a yes-button — destructive without the type-the-name forcing function); migrate the Reset confirm to the AlertDialog primitive that 6c established as the destructive-action standard; cross-cutting a11y pass on `/admin` landing + `/admin/site-setup` step list; consolidate three Phase 11 smoke-tests into one `docs/smoke-test-admin.md` index.
**Branch:** `feat/phase-6-admin-polish`
**PR target:** `main`
**Pages covered (12 routes):** `/admin` · `/admin/demo` · `/admin/site-setup` · `/admin/site-setup/[step]` · `/admin/sites` · `/admin/sites/new` · `/admin/sites/[id]` · `/admin/members` · `/admin/members/[profileId]` · `/admin/roles` · `/admin/roles/[id]` · `/admin/invitations` · `/(auth)/invite/[token]` (public)

> **What this PR ships:**
> - 10-item polish checklist applied across all 12 admin routes (audit table per page below).
> - **State coverage** — fill in 5 missing state files:
>   - `app/(app)/admin/error.tsx` (only loading.tsx exists)
>   - `app/(app)/admin/demo/loading.tsx` + `error.tsx`
>   - `app/(app)/admin/site-setup/loading.tsx` + `error.tsx` (covers both the redirector and the [step] page via parent boundary; per-step error catches mid-wizard server-action throws)
>   - `app/(app)/admin/sites/new/loading.tsx` + `error.tsx`
>   - `app/(auth)/invite/[token]/error.tsx` is **intentionally skipped** per Phase 11c precedent (the page itself renders 7 branch-typed error variants — `not_found` / `expired` / `revoked` / `accepted` / `unauth` / `mismatch` / `ready` — adding an `error.tsx` would only fire on `requireUser`-style throws that don't apply to a public unauth route)
> - **Demo Reset hardening** — migrate `<ResetDataButton>` from plain Dialog → AlertDialog primitive (mirrors 6c/6f/6g destructive-action precedent: AlertDialog used wherever the action is destructive); add a Stripe-style "Type `<org_name>` to confirm" guard (mirrors the shipped `<ArchiveSiteDialog>` from 11a — same pattern, server validates the typed name independently so a curl bypass still fails); show the org name explicitly in the dialog body (was implicit). Affects `components/admin/demo-buttons.tsx` + the `resetDemoData` action's Zod schema.
> - **`/admin` landing a11y** — KpiTile group gets a `<section aria-label="Admin counts">` wrapper; AdminCard group similarly; per-card icons get `aria-hidden`. The 4 admin cards' headings become `<h2>` (currently `<h2>` already — verify); the wizard + demo cards become an explicit `<nav aria-label="Admin tools">` section since they're cross-section deep-links rather than counts.
> - **`/admin/site-setup` polish:** `StepList` migrates from a presentation-only div tree to `<nav aria-label="Site setup steps">` with each step `aria-current="step"` for the active one + `aria-label="Step N: <title>, <state>"` per item. Progress dots get `role="progressbar"` + `aria-valuenow={completedCount}` + `aria-valuemax={7}`. Per-step `<form>` save-failed indicator gains a Retry button (mirrors 6c/6d/6e/6g/6h Retry pattern). Re-audit confirms the wizard already (a) refresh-survives via per-step server actions writing to `setup_progress` JSONB; (b) honors back navigation; (c) lands on the next-incomplete step on `/admin/site-setup` (redirector); (d) exits to dashboard on completion — no behavior changes needed, just a11y.
> - **`/admin/demo` polish:** drop the unused `Sparkles` import from page.tsx (carryover); add a `role="region" aria-label="Demo affordances"` to the 3-card grid; ensure the back-to-Admin link uses the standard `<ArrowLeft>` aria-hidden pattern (already does — verify). The "is this org demo?" warning callout gets `role="status"` per the 6e precedent.
> - **`/(auth)/invite/[token]` polish:** the `<AcceptInvitationCard>` already covers the 7 branches; the audit fix is small — each branch heading becomes an `<h1>` (currently `<h2>` per the page chrome); CTA buttons get descriptive `aria-label`s ("Sign in to accept invitation to <Site>"); the Copy link button on the success branch (when admin re-enters their own /invite link) gets `aria-live="polite"` confirmation toast.
> - **`/admin/sites/new` polish:** add `aria-label`s to the form's per-field labels; loading shell skeleton mirrors the 6h `assets/new` loading pattern.
> - **Cross-cutting fixes** found during the audit are listed in the per-page tables below — e.g. the `<NewRoleDialog>` URL-sync pattern (`?action=new`) doesn't get cleared on programmatic close in some edge paths (verified in 11c PR but worth re-verifying in the audit).
> - **Smoke-test consolidation:** new `docs/smoke-test-admin.md` is an index that points at the existing `smoke-test-phase11a.md` / `smoke-test-phase11b.md` / `smoke-test-phase11c.md` per-feature guides (don't duplicate ~60 checkpoints) and adds a 6j-only section with the polish-specific checks (state files / Demo Reset guard / wizard a11y / invite branch a11y).

> **Not in this PR (explicitly deferred to v2):**
> - **No new admin pages.** Org-info / billing / SSO / SCIM / IDP / audit-trail viewer all stay v2.
> - **No new RPCs.** Demo-Reset Zod gets one new field (`confirmation_text`) but the underlying `reset_demo_data_v1` RPC signature is unchanged.
> - **No org settings page.** Settings live ad-hoc on /admin/sites/[id] and per-role /admin/roles/[id] for V1.
> - **No member-invite flow rework.** 11c shipped the full invite-by-email path (best-effort SMTP + always-show-link); 6j doesn't touch the action shape, only its surrounding UI a11y.
> - **No Phase 11 RPC behavior changes.** The `is_default = true` rename guard, the per-site last-admin guard on member removal, the case-insensitive email match on `accept_invitation_v1` — all stay exactly as shipped.
> - **No pathway-picker integration.** The original 06j stub mentioned wiring the `/admin/site-setup` pathway picker into the dashboard's first render — but pathway selection lives at `profiles.preferred_pathway` (Phase 0) and the dashboard already keys off it. Re-audit confirms the integration is already shipped; no work needed.
> - **No "demo cleanup last-run" surface.** The stub mentioned showing "Last cleanup: <when>" from the Vercel Cron — that cron isn't shipped yet (it's a v2 deploy-infra item). Skip.
> - **No `?action=new` URL-sync regression hunt.** Phase 11c's NewRoleDialog already clears the URL on close per the BUILD_STATUS narrative; assume shipped behavior is correct unless the audit surfaces a real broken path.

---

## Audit tables — per page

### 1. `/admin` (landing)

`app/(app)/admin/page.tsx` — 5 KPI tiles (Active sites · Archived sites · Members · Roles · Pending invites) + 4 admin cards (Sites · Members · Roles · Invitations) + 2 deep-link cards (Site setup wizard · Demo affordances). Permission gate accepts `site:configure` OR `member:invite` OR `role:read` OR `invitation:read`.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ | `text-primary` icon coloring on KPI tiles + first deep-link card mixes "primary" Tailwind alias with brand purple — they resolve to the same value in our setup, no visible drift. AdminCard hover treatment clean. | None. |
| 2 | Empty state | ⚠️ | When no perms match, renders the org-fresh `<EmptyState>` "Admin is for site admins" — copy is good. But when an admin has perms AND the org has zero sites/members yet (rare; bootstrap), the KPI tiles show 5 zeros without explanation. | Add a helper line "Org just created — start with the Site setup wizard" when `activeSites === 0`. |
| 3 | Loading state | ✅ | `loading.tsx` exists at the route level. | None. |
| 4 | Error state | ❌ | Only `loading.tsx` ships at `app/(app)/admin/`; no `error.tsx`. RLS errors / `requireUser` throws blank the page. | Add `app/(app)/admin/error.tsx` mirroring the 6h pattern (brand destructive card with **Try again** + **Back to dashboard**). |
| 5 | Responsive | ⚠️ | KPI tiles `grid-cols-2 lg:grid-cols-5` and admin cards `grid-cols-1 lg:grid-cols-2 xl:grid-cols-4` work, but the deep-link grid is `sm:grid-cols-2` only — at md (768–1024) the wizard + demo cards stack vertically, looking lonely. | Add `md:grid-cols-2` to the deep-link grid for parity. |
| 6 | A11y / keyboard | ⚠️ | Icons are mostly `aria-hidden`, but the 5-tile KPI section + 4-card admin section + 2-card deep-link section have no group landmarks. Heading order is good (`<h1>` → `<h2>`). | Wrap each group in `<section aria-label>` so SR users navigate by region. |
| 7 | Form-error UX | n/a | No forms on the landing. | — |
| 8 | Copy | ✅ | "Org configuration · sites, members, and role permissions." — clear. AdminCard bodies say what each section DOES. | None. |
| 9 | Dark mode | ✅ | All token-driven. | None. |
| 10 | Cache Components | ✅ | All reads are user-scoped via RLS; no `'use cache'` candidate. | None. |

### 2. `/admin/demo`

`app/(app)/admin/demo/page.tsx` — 3-card grid (Trigger banner · Load sample chain · Reset demo data) + "is_demo" warning callout + EnableDemoButton when `is_demo = false`.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ⚠️ | `Sparkles` icon imported but never used (line 2 — verified). Reset card uses `border-destructive/40` + `bg-destructive/5` which is the right destructive treatment. | Drop unused import. |
| 2 | Empty state | n/a | — | — |
| 3 | Loading state | ❌ | No `loading.tsx`. | Add — header skeleton + 3-card grid skeleton. |
| 4 | Error state | ❌ | No `error.tsx`. | Add — same brand destructive card pattern. |
| 5 | Responsive | ✅ | 3-card grid stacks at sm; max-w-3xl container constrains overall width. | None. |
| 6 | A11y / keyboard | ⚠️ | Reset Dialog uses Dialog (not AlertDialog). Per the 6c/6f/6g/6h precedent, destructive-action confirms should use AlertDialog (the radix primitive forces a focus-trap + assertive ARIA + heading/description ids that improve SR experience). The is_demo warning has `role` not set despite being a status-style callout. The 3-card grid has no group landmark. | Migrate Reset to AlertDialog (existing primitive at `components/ui/alert-dialog.tsx` from 6c). Add `role="status"` to the is_demo warning (mirrors 6e Reports `<HseRecordCard>` pattern). Wrap the 3-card grid in `<section aria-label="Demo affordances">`. |
| 7 | Form-error UX | ⚠️ | Reset confirm is a single yes-button — no forcing function. Org name would type "Yes, wipe it" without thinking. The shipped 11a `<ArchiveSiteDialog>` solved this with a "Type `<site_name>` to confirm" Stripe-style guard. | Migrate to the same pattern: type the org name to enable the destructive button; server-side `resetDemoData` Zod adds `confirmation_text` field that must equal `org.name` (case-sensitive — matches 11a). Without the typed match the action returns `{ ok: false, error: "Type the org name exactly to confirm" }`. Re-uses the BUILD_STATUS principle: "server validates the typed name independently so a curl bypass still requires the name". |
| 8 | Copy | ⚠️ | "Wipes all transactional rows back to seed state" — accurate. But the dialog says the org name would be wiped only via implication ("This deletes every incident…"). The Stripe-style guard makes the org name explicit AND forces the user to confirm scope. | Updated copy lands with the dialog migration. |
| 9 | Dark mode | ✅ | Token-driven. | None. |
| 10 | Cache Components | ✅ | Per-org reads via RLS. | None. |

### 3. `/admin/site-setup`

`app/(app)/admin/site-setup/page.tsx` (redirector) + `[step]/page.tsx` (per-step renderer) + `layout.tsx` + 7 step components (basics → regulator → establishment IDs → departments → users → recipients → confirm).

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ | Step pill row + sidebar StepList; primary on Next; secondary on Back. Eyebrow "Site setup" is intentional (wizard surface — keep it; matches the Report Wizard precedent where the eyebrow stays as a wizard cue). | None. |
| 2 | Empty state | n/a | Wizard always lands on a step. | — |
| 3 | Loading state | ❌ | No `loading.tsx` at either `site-setup/` or `site-setup/[step]/`. | Add `site-setup/loading.tsx` (header band + step-list skeleton + form skeleton); covers both the redirector flash and per-step navigations via the parent boundary. |
| 4 | Error state | ❌ | No `error.tsx`. Mid-wizard server-action throws blank the page. | Add `site-setup/error.tsx` — brand destructive card with **Try again** + a "Resume setup" link that jumps to `/admin/site-setup` (the redirector picks the next-incomplete step). |
| 5 | Responsive | ✅ | `grid-cols-1 md:grid-cols-[220px_1fr]` — sidebar collapses cleanly at sm. | None. |
| 6 | A11y / keyboard | ❌ | StepList is a presentation-only `<div>` tree — no nav landmark, no aria-current on the active step, no per-step aria-label. ProgressDots has no `role="progressbar"` / `aria-valuenow` / `aria-valuemax`. Per-step forms are fine; per-step `<h1>` reads as the site name (good). | StepList → `<nav aria-label="Site setup steps">` with `aria-current="step"` on active + `aria-label="Step N: <title>, <state>"` per item where state is one of `done` / `current` / `not_started`. ProgressDots → `role="progressbar"` + `aria-valuenow={completedCount}` + `aria-valuemax={7}` + `aria-valuetext="<N> of 7 steps complete"`. |
| 7 | Form-error UX | ⚠️ | Per-step server actions return `{ ok, error, fieldErrors }` correctly (verified — actions live in `app/(app)/admin/site-setup/actions.ts`). On save-fail, no Retry button (the user has to re-submit by clicking Next again, which works but doesn't match the 6c/6d/6e/6g/6h Retry pattern). | Add a Retry button next to the per-step save-fail error message (mirrors `<SaveIndicator>` retry pattern shipped in 6f templates editor). |
| 8 | Copy | ✅ | "Seven small steps. Save and resume any time — nothing locks until you click Launch." — clear. Per-step intros are descriptive. | None. |
| 9 | Dark mode | ✅ | Token-driven. | None. |
| 10 | Cache Components | ✅ | Wizard is fully dynamic (per-user state). | None. |

### 4. `/admin/sites` (list)

Phase 11a-shipped. Table + tree views toggle, URL-driven filters, `loading.tsx` + `error.tsx` already at the route level.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ | Polished in 11a. | None. |
| 2 | Empty state | ✅ | "No sites yet — start the Site setup wizard" with a deep-link CTA (per 11a). | None. |
| 3 | Loading state | ✅ | Shipped 11a. | None. |
| 4 | Error state | ✅ | Shipped 11a. | None. |
| 5 | Responsive | ⚠️ | Table view on the sites list collapses to horizontal scroll at sm. Per `docs/design.md` §8 "data tables: full → priority columns + horizontal scroll → key/value card stack" — for V1 the scroll is acceptable. | None (logged as v2 polish). |
| 6 | A11y / keyboard | ✅ | View-toggle has `aria-pressed`; sites table has `aria-label`; tree-view items have `aria-expanded`. (Re-verified during audit.) | None. |
| 7 | Form-error UX | n/a | List page; no forms. | — |
| 8 | Copy | ✅ | Polished 11a. | None. |
| 9 | Dark mode | ✅ | Token-driven. | None. |
| 10 | Cache Components | ✅ | User-scoped via RLS. | None. |

### 5. `/admin/sites/new`

Phase 6a-shipped (the create-site flow + `create_site_v1` RPC). Single `<CreateSiteForm>` with bootstrap-aware copy.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ | Standard form layout. | None. |
| 2 | Empty state | n/a | — | — |
| 3 | Loading state | ❌ | No `loading.tsx`. | Add — header band + form skeleton (4 fields). |
| 4 | Error state | ❌ | No `error.tsx`. | Add — brand destructive card with Retry + Back to /admin/sites. |
| 5 | Responsive | ✅ | max-w form, full-width fields. | None. |
| 6 | A11y / keyboard | ⚠️ | Re-check labels on every field (name / address / country / parent — RBAC-gated). Field-level errors via `aria-invalid` + `aria-describedby` already shipped per 11a's `<EditSiteForm>` pattern; verify same on Create. | If gaps found, mirror 11a's edit-site-form patterns. |
| 7 | Form-error UX | ✅ | `create_site_v1` RPC returns Zod field errors via the standard ActionResult shape. | None. |
| 8 | Copy | ✅ | "Create a site" + bootstrap nudge for first-site case. | None. |
| 9 | Dark mode | ✅ | Token-driven. | None. |
| 10 | Cache Components | ✅ | User-scoped action. | None. |

### 6. `/admin/sites/[id]`

Phase 11a — 4-tab detail (overview · members · annual hours · setup). loading + error shipped 11a.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11a (per BUILD_STATUS narrative — `<SiteDetailTabs>` has `role="tab/tablist"` + `aria-current`; AnnualHoursEditor has AlertDialog confirm on delete; ArchiveSiteDialog has Stripe-style type-the-name guard). | None. |

### 7. `/admin/members`

Phase 11b. Org-wide list, URL filters. loading + error shipped 11b.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11b (members-list table, members-filters URL-driven, last-seen via single grouped query no N+1, info card explaining email invitations live in 11c — now stale, audit caught it). | Drop the "Email invitations ship in Phase 11c" info card if still rendered post-11c (per BUILD_STATUS: 11c-merge replaced this with a live `<InviteMemberDialog>` — verify no stale copy remains). |

### 8. `/admin/members/[profileId]`

Phase 11b. Per-member detail. loading + error shipped 11b.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11b. The "Profile editing lands in Phase 8" hint stays — Phase 8 isn't shipped. | None. |

### 9. `/admin/roles`

Phase 11c. List with system / custom / all chip + name search. loading + error shipped 11c.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11c. | None. |

### 10. `/admin/roles/[id]`

Phase 11c. 2 tabs (permissions · members). loading + error shipped 11c.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11c. PermissionChecklist has grouped sections + per-group "Select all / Clear" + dirty-state save. | None. |

### 11. `/admin/invitations`

Phase 11c. List with status pill (pending/expired/accepted/revoked) + per-row Copy link + Revoke. loading + error shipped 11c.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| All | All | ✅ | Polished 11c. | None. |

### 12. `/(auth)/invite/[token]` (public accept page)

Phase 11c. Public route — middleware whitelisted; loads invitation via service-role client; renders 7 branches via `<AcceptInvitationCard>`.

| # | Dimension | Status | Finding | Fix |
|---|---|---|---|---|
| 1 | Visual fidelity | ✅ | Auth-shell layout; brand consistent. | None. |
| 2 | Empty state | n/a | The 7 branches ARE the states. | — |
| 3 | Loading state | ✅ | `loading.tsx` shipped 11c. | None. |
| 4 | Error state | n/a | Per BUILD_STATUS: "the public accept page doesn't need an error.tsx since the page itself renders branch-typed errors" — `not_found` / `expired` / `revoked` / `accepted` / `unauth` / `mismatch` / `ready` all render branch-specific copy + CTAs. Adding `error.tsx` would only fire on requireUser-style throws that don't apply to a public unauth route. | Skip — log in plan as deliberately deferred. |
| 5 | Responsive | ✅ | Single-column auth shell. | None. |
| 6 | A11y / keyboard | ⚠️ | Per-branch heading is `<h2>` (the auth shell renders the page chrome with its own `<h1>`). On a standalone /invite/[token] page the branch heading should arguably be the `<h1>` since there's no broader page context. CTA buttons read fine but lack descriptive `aria-label`s ("Sign in to accept invitation to <Site>" vs. just "Sign in"). | Bump branch heading to `<h1>` + drop the auth-shell `<h1>` for this route, OR keep as-is and add `aria-labelledby` linkage (simpler — keep `<h2>` and add `aria-label` to the CTAs). Recommend the simpler fix per Q3 below. |
| 7 | Form-error UX | n/a | No forms — branches render server-rendered. | — |
| 8 | Copy | ✅ | Per-branch copy is precise (per 11c BUILD_STATUS narrative). | None. |
| 9 | Dark mode | ✅ | Token-driven. | None. |
| 10 | Cache Components | ✅ | Service-role client load on every render — never cached. | None. |

---

## Cross-cutting fixes

These ride along in the same PR (one commit per scope makes review easier).

1. **AlertDialog primitive** is shipped (`components/ui/alert-dialog.tsx` from 6c) — `<ResetDataButton>` is the last destructive surface still on plain Dialog. Migrate.
2. **Stripe-style type-the-name guard** is shipped (`<ArchiveSiteDialog>` from 11a) — extract the typed-confirmation pattern into a reusable building block? **Recommend NO** for v1 — the two confirms have different scopes (per-site vs. per-org) and copy; abstracting now is premature. Just port the pattern inline into the new Reset AlertDialog.
3. **Smoke-test consolidation** — three Phase 11 smoke tests already exist. New `docs/smoke-test-admin.md` is a 1-page index pointing at each plus a 6j-only polish section (state files / Reset hardening / wizard a11y / invite a11y).
4. **Audit-trail / activity events** — every action this PR touches still logs through the existing activity-events table. No new event types.

---

## Definition of done — 6j PR

1. 10-item checklist passes for all 12 routes (✅ rows untouched, ⚠️ rows resolved, ❌ rows fixed).
2. State coverage: 5 missing files added (`/admin/error.tsx`, `/admin/demo/{loading,error}.tsx`, `/admin/site-setup/{loading,error}.tsx`, `/admin/sites/new/{loading,error}.tsx`). `/(auth)/invite/[token]/error.tsx` is intentionally skipped (logged in §"Not in this PR").
3. **Demo Reset hardened**: `<ResetDataButton>` migrated to AlertDialog; Stripe-style "Type `<org_name>` to confirm" guard added; `resetDemoData` Zod adds `confirmation_text` field; server validates independently of the client gate.
4. `/admin/site-setup` a11y: StepList is a `<nav aria-label>` with per-step `aria-current="step"` + `aria-label`; ProgressDots is a `role="progressbar"` with `aria-valuenow` + `aria-valuemax` + `aria-valuetext`; per-step Retry button on save-fail.
5. `/admin` landing: section landmarks on KPI / admin-card / deep-link groups; bootstrap-empty hint when `activeSites === 0`; deep-link grid bumps to `md:grid-cols-2`.
6. `/admin/demo` a11y: 3-card grid wrapped in `<section aria-label>`; is_demo warning gets `role="status"`; unused Sparkles import dropped.
7. `/(auth)/invite/[token]` a11y: CTA buttons gain descriptive `aria-label`s.
8. Stale "Phase 11c" placeholder copy on /admin/members audited and removed if still present.
9. Smoke test: new `docs/smoke-test-admin.md` lands as the umbrella; phase11a/b/c stay as the per-feature deep-dives.
10. `pnpm tsc --noEmit` clean.
11. `pnpm lint` matches the 42/16 baseline (no new findings introduced; AlertDialog migration may add 1 transient dialog-state warning that already ships across `change-role-dialog.tsx`, `archive-site-dialog.tsx`, `template-library-filters.tsx`).
12. **Phase 6 closes** when this merges — see §"Phase 6 closeout" below.

---

## Open questions — resolve before §implementation

1. **Demo Reset dialog migration scope.** Two parts: (a) Dialog → AlertDialog primitive migration, (b) adding the type-the-org-name guard. (a) is pure UX uplift; (b) adds a new field to the Zod schema + server action. Recommend **ship both together** — the AlertDialog migration without the guard would deliver only modest value, and the guard without the AlertDialog primitive would mismatch the destructive-action precedent. ✅/❌
2. **`/(auth)/invite/[token]` heading hierarchy.** Two options: (a) bump per-branch heading to `<h1>` + drop the auth-shell `<h1>` (proper landmark structure but invasive); (b) keep `<h2>` and add descriptive `aria-label`s on the CTA buttons (simpler, mostly fixes the SR experience). Recommend **(b)** — the auth shell's `<h1>` ("Accept invitation" or similar) already names the page; the branch headings are sub-states, semantically correct as `<h2>`. ✅/❌
3. **`/admin/site-setup` Retry button placement.** Two options: (a) inline next to the per-step error message (matches 6c/6d/6e/6g/6h pattern — "save failed" + Retry alongside); (b) replace the Next button entirely when an error occurs ("Retry" subsumes "Next" until success). Recommend **(a)** — keeps the Next button visible and grouped with Back; the Retry button is small + secondary; matches every other Retry surface in the app. ✅/❌
4. **`/admin` bootstrap-empty hint placement.** Recommend rendering it as a 1-line note above the KPI tile row, not as a full empty state (we still want to show the zeros — they're informative — and the wizard deep-link is already in the lower section). One line: "Org just created — get started with the Site setup wizard below." ✅/❌
5. **AlertDialog vs. Dialog for the Demo `LoadSampleChain` button.** Currently a plain form-submit. Loading sample data isn't destructive (it ADDS data), but it does materially mutate the demo workspace. Recommend **keep as plain form submit** — only Reset is destructive. Adding a confirm step here is friction without a forcing reason. ✅/❌
6. **`docs/smoke-test-admin.md` shape.** Two options: (a) a thin index pointing at the 3 phase-11 smoke tests + a short 6j-only polish section (recommend); (b) a full re-walkthrough of every admin surface that supersedes the phase-11 docs. Recommend **(a)** — the phase-11 docs are still accurate and per-feature focused; an umbrella index with deep-links is the lighter v1 form. ✅/❌

---

## Phase 6 closeout (after this PR merges)

After 6j merges, **Phase 6 closes**. Update on merge:

- `CLAUDE.md` — bump status block: `6a..6j shipped + 6k/6l shipped — Phase 6 polish-complete`. Drop the "module 10 of 10" wording; replace with "V1 polish-complete. Surfaces audited across all 35 routes."
- `docs/BUILD_STATUS.md` — add the 6j section + a Phase 6 closeout marker section ("Phase 6 closes 2026-05-08 (or whenever)"). Workflow-notes line at bottom flips to "All Phase 6 polish PRs merged. Next: stakeholder cycle 2 / Phase 7 (global search backend) / Phase 8 (Settings) / Phase 9 (Argus AI assistant) / Phase 10 (Safety Bulletin) per the deferred roadmap."
- `docs/SPEC.md` §15 — confirm all per-PR v2 deferrals are logged.
- Memory: `project_phase_6_status.md` — flip status to "Phase 6 complete"; `MEMORY.md` index pointer rewritten to reflect closeout.
- `plans/06-frontend-polish.md` — add a "Closed YYYY-MM-DD" line + summary table of merged PRs (#7 dashboard · #8 sidebar · #9 topbar · #10 incidents · #11 investigations · #17 capa · #18 reports · #19 templates · #20 inspections · #21 resources · #22 planner · #<this PR> admin).

No memory updates from 6j alone are needed mid-flight — the closeout is one batch on Phase-6 close.
