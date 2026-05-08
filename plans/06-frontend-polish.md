# Phase 6 — Frontend Polish (page-by-page)

**Status:** **CLOSED 2026-05-08.** All 12 module-level polish PRs merged. V1 demo polish-complete.

| # | Module | PR | Plan |
|---|---|---|---|
| 1 | Dashboard | [#7](https://github.com/rafi-aman3/incident-management/pull/7) | [`06a-dashboard-polish.md`](06a-dashboard-polish.md) |
| 2 | Sidebar (global) | [#8](https://github.com/rafi-aman3/incident-management/pull/8) | [`06k-sidebar-polish.md`](06k-sidebar-polish.md) |
| 3 | Topbar (global) | [#9](https://github.com/rafi-aman3/incident-management/pull/9) | [`06l-topbar-polish.md`](06l-topbar-polish.md) |
| 4 | Incidents | [#10](https://github.com/rafi-aman3/incident-management/pull/10) | [`06b-incidents-polish.md`](06b-incidents-polish.md) |
| 5 | Investigations | [#11](https://github.com/rafi-aman3/incident-management/pull/11) | [`06c-investigations-polish.md`](06c-investigations-polish.md) |
| 6 | CAPA | [#17](https://github.com/rafi-aman3/incident-management/pull/17) | [`06d-capa-polish.md`](06d-capa-polish.md) |
| 7 | Reports | [#18](https://github.com/rafi-aman3/incident-management/pull/18) | [`06e-reports-polish.md`](06e-reports-polish.md) |
| 8 | Templates | [#19](https://github.com/rafi-aman3/incident-management/pull/19) | [`06f-templates-polish.md`](06f-templates-polish.md) |
| 9 | Inspections | [#20](https://github.com/rafi-aman3/incident-management/pull/20) | [`06g-inspections-polish.md`](06g-inspections-polish.md) |
| 10 | Resources | [#21](https://github.com/rafi-aman3/incident-management/pull/21) | [`06h-resources-polish.md`](06h-resources-polish.md) |
| 11 | Planner | [#22](https://github.com/rafi-aman3/incident-management/pull/22) | [`06i-planner-polish.md`](06i-planner-polish.md) |
| 12 | Admin | [#23](https://github.com/rafi-aman3/incident-management/pull/23) | [`06j-admin-polish.md`](06j-admin-polish.md) |

See [`docs/BUILD_STATUS.md`](../docs/BUILD_STATUS.md) §"Phase 6 — Closed 2026-05-08" for the cross-cutting outcomes summary. Roadmap continues at Phase 7 (global search backend → consumes the 6l shell) → 8 (Settings) → 9 (Argus AI) → 10 (Safety Bulletin).

---

**Original status (preserved for record):** drafted 2026-05-06, immediately after Phase 5 merge / V1 feature-complete
**Goal:** A page-by-page polish + small-functional-gap pass across every shipped V1 surface (10 modules · 35 routes). Each module ships as its own PR. The bar is consistency to `docs/design.md` tokens, complete state coverage (empty / loading / error), keyboard + a11y correctness, copy quality, dark-mode parity, and Cache Components correctness. Small functional gaps surfaced during the audit (missing empty-state CTA, broken keyboard trap, dead deep-link, missing tooltip, etc.) are fixed in-line — anything bigger gets logged in `docs/SPEC.md` §15 as a v2 item and skipped.
**Estimated duration:** ~2 weeks (10 module PRs, ~1 day each on average; reports + templates are heavier)
**Depends on:** Phase 0–5 (all merged on `main` 2026-05-06). No new schema, no new RPCs, no new perm keys (unless an audit surfaces a missing gate, in which case it's logged + slotted into the relevant module PR).

> **What this phase ships:**
> - 10 module PRs against `main`, each rolling up the polish + small-gap fixes for one module's pages.
> - Updated `docs/SPEC.md` §15 entries for any deferred-to-v2 decision the audit surfaces.
> - Updated `docs/ui-flow.md` for any page contract that drifted vs. shipped reality.
> - One smoke-test pass per module before the PR merges (re-run the matching `docs/smoke-test-phase*.md` and patch it for any new affordances).
> - No new tables, no new RPCs, no new RLS policies (unless a gap is found — in which case it's small and atomic and lives in its module's PR).
>
> **Not in this phase (deferred to v2 or later):**
> - **No redesigns.** The visual language is locked (`docs/design.md`); we polish to it, we don't repaint.
> - **No new modules.** This is a polish pass on shipped surface only.
> - **No new schema migrations** unless a small gap genuinely needs one — in which case it's flagged in the module plan and pre-cleared with the user.
> - **No mobile-specific layouts** beyond what `docs/design.md` §8 already mandates. The inspection runner is the one mobile-first surface; everything else is desktop-first with sensible sm-breakpoint collapse, no app-shell rework.
> - **No i18n.** UI chrome stays English (per `PLANNING/IMS_PLANNING.md` §16.10 — Phase 14 deferred).
> - **No tour-overlays.** Per locked rule + `feedback_no_tour_overlays.md`.
> - **No new tests.** V1 ships without an automated test suite by design; smoke-test guides remain the verification surface.

---

## Why this phase

V1 is feature-complete on `main` as of 2026-05-06 (PR #6). Smoke tests cover the golden path per phase but miss the long tail: empty states that never got designed because seed data always populated them, error states that throw a raw exception instead of the brand error card, focus rings that disappeared under a hover state, dark-mode tokens that drifted on a card we shipped late, copy that says "Submit" where "Finalize report" would be unambiguous, RegTooltips placed on the wrong element, etc.

We will not catch these by re-reading the smoke tests — they exist precisely because the smoke test passes. Instead, we audit each page against a **fixed checklist** (below), fix the gaps, and ship one PR per module so review stays tight. By the end of Phase 6, every page can be entered cold by a stakeholder with no warm-up data and still feel finished.

---

## The shared polish checklist (every page)

Each per-module plan applies this checklist to every page it covers. Items that don't apply (e.g. a list page has no form-error UX) get marked `n/a` in the audit table; items that fail get logged as fixes in the same PR.

| # | Dimension | What we check |
|---|---|---|
| 1 | **Visual fidelity** | Tokens used vs. raw hex; spacing scale honored; brand purple `#735CDD` used only for primary affordance, success green `#16A34A` only where success applies (incl. S4-Minor + Track C); `radius` + elevation per `docs/design.md` §4–§5; severity / status colors map to the right enum value. |
| 2 | **Empty state** | When the table / list / grid is empty, do we show a helpful card (illustration or icon + 1-line headline + 1-line helper + a primary CTA that creates the first row)? Empty states never just say "No data". |
| 3 | **Loading state** | Suspense boundary present? Skeleton shape matches the post-load layout? No layout shift on hydration? |
| 4 | **Error state** | If the server action / RPC throws, do we render the brand error card with retry, or does the page blank out? Field-level errors render under the field; form-level errors render in a dismissible alert at the top. |
| 5 | **Responsive** | At sm-breakpoint (640px), does the page degrade per `docs/design.md` §8 (sidebar collapses to 80px; multi-column tables go to vertical card list; modals go full-screen)? No horizontal scrollbars on the body. |
| 6 | **A11y / keyboard** | Tab order matches reading order; visible focus ring on every interactive element (`outline-2 outline-brand-500 outline-offset-2`); modals trap focus + restore on close; ESC closes modals; ARIA roles on custom components (Kanban columns, calendar grid, body map); icon-only buttons have `aria-label`; color is never the only signal. |
| 7 | **Form-error UX** | Server actions return `{ ok, error, fieldErrors }`; wired into `useActionState`; submit button shows pending state; pending action is idempotent (no double-submit). |
| 8 | **Copy** | Button labels are verbs (`Finalize report`, not `Submit`); helper text under inputs explains the *consequence* of the value (e.g., "Used to bucket the regulatory clock") not its definition; tooltips use sentence case; placeholder text is an example, not an instruction. RegTooltips placed on the *exact* element they explain (per `feedback_brand_color.md` style: precise, not blanket). |
| 9 | **Dark mode** | Page renders correctly under `class="dark"`; no `text-white` / raw hex; tokens only; severity tokens use the dark-mode variants from `docs/design.md` §2 dark mode block; PDFs (OSHA 301, F2508) stay light-mode regardless (paper artifact). |
| 10 | **Cache Components correctness** | `'use cache'` boundaries placed at the right granularity (org-scoped reads cached, user-scoped reads dynamic); `params` / `searchParams` properly `await`ed (`Promise<...>`); no `export const runtime` on route handlers (rejected under Cache Components — handlers default to nodejs anyway); middleware logic in `proxy.ts` not `middleware.ts`; no stale-data warnings in `pnpm dev` console. |

In addition, two cross-cutting checks run at the **module** level (not per-page):

- **RBAC gating** — every action that exists on the page is also gated server-side via `can()` from `lib/auth/can.ts`; the UI hides the affordance for users who lack the perm rather than letting them click and fail.
- **Activity / notifications** — every state change worth observing posts to `activity_events`; every action that should ping a stakeholder fires the right notification kind. (Audit, don't add new event types unless one is missing.)

---

## Cross-module standards (locked — don't re-debate)

These are already locked in `docs/SPEC.md` / `docs/design.md` / `CLAUDE.md`. If the audit finds a violation, fix it; if the audit finds a gap *in* the standard, raise it before the module PR opens.

- Brand purple `#735CDD` and success green `#16A34A` are **distinct** colors. S4-Minor + Track C use the success green. Don't propose a third semantic.
- No tour-overlay libraries. Empty states + tooltips + RegTooltip do the teaching.
- Soft-delete only on `incidents` / `investigations` / `capas`. Audit tables are append-only; no UI affordance creates a DELETE.
- 3-step Report Wizard uses draft-row + per-step server actions. Step transitions never lose state.
- Workflow engine called from a Server Action, not a DB trigger. No page should fire a notification client-side.
- Templates are versioned; in-flight inspections snapshot the version. Builder UI must show "Draft v2 of 1.0 published" lineage clearly.
- CAPA owner ≠ verifier — UI button disabled, server action rejects, DB CHECK constraint. All three must remain.

---

## Sequencing (user-flow priority)

The order ships modules in the order a stakeholder would actually click through them on a demo morning. Earliest modules set the bar; later modules reuse the same affordances.

| # | Module | Plan file | Pages covered | Est. PR |
|---|---|---|---|---|
| 1 | Dashboard | [06a-dashboard-polish.md](06a-dashboard-polish.md) | `/dashboard`, `/` (root marketing), `/login` | small |
| 2 | Incidents | [06b-incidents-polish.md](06b-incidents-polish.md) | `/incidents`, `/incidents/new/[step]` (3-step Wizard), `/incidents/[id]` | medium |
| 3 | Investigations | [06c-investigations-polish.md](06c-investigations-polish.md) | `/investigations` (Kanban), `/investigations/[id]` (5-tab) | medium |
| 4 | CAPA | [06d-capa-polish.md](06d-capa-polish.md) | `/capa`, `/capa/[id]` | medium |
| 5 | Reports | [06e-reports-polish.md](06e-reports-polish.md) | `/reports`, `/reports/osha-300`, `/reports/osha-300a`, `/reports/osha-301/[id]`, `/reports/riddor-f2508/[id]` | medium-large |
| 6 | Templates | [06f-templates-polish.md](06f-templates-polish.md) | `/templates`, `/templates/browse`, `/templates/browse/[id]`, `/templates/new`, `/templates/[id]`, `/templates/[id]/edit`, `/templates/[id]/assign` | large |
| 7 | Inspections | [06g-inspections-polish.md](06g-inspections-polish.md) | `/inspections`, `/inspections/[id]`, `/inspections/[id]/findings/[findingId]` | medium-large (mobile) |
| 8 | Resources | [06h-resources-polish.md](06h-resources-polish.md) | `/resources/assets/{,new,[id],[id]/edit}`, `/resources/documents/{,new,[id]}` | medium |
| 9 | Planner | [06i-planner-polish.md](06i-planner-polish.md) | `/planner` | small-medium |
| 10 | Admin | [06j-admin-polish.md](06j-admin-polish.md) | `/admin`, `/admin/demo`, `/admin/site-setup/[step]` | small-medium |
| 11 | Sidebar (global) | [06k-sidebar-polish.md](06k-sidebar-polish.md) | App shell sidebar — pin/hover-drawer behavior across every app page | small-medium |

**Branching:** one branch per module, `feat/phase-6-<module>-polish` (e.g. `feat/phase-6-incidents-polish`), branched off `main`. Each PR uses the project's standard PR template + a fresh "What changed" gallery for visual diffs (before/after screenshots for any swap that's not just a token).

**Cadence:** the user kicks off each module with "start phase 6 <module>". I draft no code beyond the plan until that signal. Inside a module, I ship the audit table → fixes → updated smoke-test in one PR.

---

## Definition of done — phase level

Phase 6 closes when all 10 module PRs are merged on `main` AND:

1. **Every shipped page passes the 10-item checklist** in its module's plan, with `n/a`s explained.
2. **Every empty state has a helpful card** with a primary CTA that creates the first row (or, for read-only views like Reports, a clear next-step pointer).
3. **Every page has a Suspense boundary** at the sensible granularity. No page renders a raw spinner where a skeleton would have helped.
4. **Every page renders correctly in dark mode** with no raw hex / no `text-white` literals.
5. **Every keyboard-only walkthrough succeeds** for the canonical flow per module (e.g., file an incident; investigate; verify a CAPA; run an inspection; share a planner URL).
6. **No `pnpm dev` console warnings** across any page (hydration, Cache Components, key collisions, missing `alt`).
7. **`docs/SPEC.md` §15 has 10 new entries** logging anything the audit decided to defer rather than fix in-phase. This includes any new perm gap, missing notification kind, or missing schema field that we decided to slot into v2 instead of patching.
8. **`docs/ui-flow.md` is in sync with the shipped routes** (any drift the audit finds is fixed here, not later).
9. **All 4 smoke-test guides (`docs/smoke-test-phase2.md` through `docs/smoke-test-phase5.md`) re-run green** with the polish in place. Any new affordance the polish surfaces gets a smoke-step added; any removed affordance gets the step deleted.
10. **`CLAUDE.md` status block updated** with one line per merged module PR plus a closing line marking V1 as polish-complete.

Phase 6 explicitly does NOT include: redesigns; new modules; i18n; tour overlays; new tests; mobile-specific layouts beyond `design.md` §8; any v2 work (Document Control deep, Training & Audit, MOC/Permit, Risk Register, etc.).

---

## Open questions (resolve before module 1 starts)

1. **Should we run a dependency / dev-deps update in this phase?** Tailwind v4, shadcn, Next 16.2.4 — minor bumps may have shipped between Phase 0 and now. Recommend: **no**, keep the polish PRs scoped to surface changes; bumps land in a separate `chore/deps-bump` after Phase 6 closes.
2. **Should we run a Lighthouse / axe pass per module?** Recommend: **yes, lightly** — capture a Lighthouse score + axe-core findings per module page in the PR description, fix anything Critical or Serious; defer Moderate / Minor unless trivial.
3. **Should we capture before/after screenshots in the PR descriptions?** Recommend: **yes** for visual changes, **no** for pure copy / a11y fixes (callouts in the description suffice).
4. **What's the bar for "small functional gap" vs. v2-defer?** Heuristic: if it's <30 min of work AND doesn't touch schema / RPC / RLS, fix it in-phase; otherwise log it in `SPEC.md` §15 with a one-line justification and skip.
