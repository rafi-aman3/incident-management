@AGENTS.md

# EHS Operations Platform — Project Context

## What this is
A production v1 EHS Operations Platform for SDS Manager. An organisation contains hierarchical sites; each site runs **Incidents** (capture → classify → route → investigate → CAPA → regulatory reports — OSHA in the US, RIDDOR in the UK), **Inspections** (against versioned templates, scheduled or one-off), and **Resources** (operational assets + linked documents). Everything surfaces in a unified **Planner** calendar.

Stakeholder demos are milestones inside the build, not a separate deliverable. `PLANNING/IMS_PLANNING.md` is the reference roadmap (a separate workstream pushes revisions directly to main); `docs/SPEC.md` §15 records where we intentionally diverge.

## Modules

| Module | Scope | What it does |
|---|---|---|
| **Incidents** | per-site | Report → classify (5×5 risk matrix) → route (Track A/B/C) → investigate (5-Why + evidence) → CAPA (with independent verification) → regulatory reports (OSHA 300/300A/301, RIDDOR F2508) |
| **Templates** | org-scoped, industry-typed | System presets per industry → cloned to org-level → optional per-site assignment. Versioned; in-flight inspections snapshot the template version. |
| **Inspections** | per-site | Run a template; scheduled (daily/weekly/monthly/custom) or one-off; failed items become findings; manual escalation to incident |
| **Resources / Assets** | per-site (org roll-up view) | Operational asset registry: location, condition, last-inspected, PM dates, SDS link |
| **Resources / Documents** | org-scoped | File uploads (PDF/DOC) polymorphically linkable to incident / inspection / CAPA / asset / site |
| **Planner** | unified | Read-only calendar of past + upcoming events across all modules |

## Tenancy

- An **organisation** owns everything. A user belongs to exactly one org.
- An org has multiple **sites**. Sites form a tree via `parent_site_id` (self-FK, nullable).
- Hierarchy is **user-centric** for inheritance: data (templates, assets, incidents, …) attaches to the specific site it was created on; access propagates down the tree only when `site_members.include_children = true`. See memory: `project_site_hierarchy.md`.

## RBAC

- **Roles** are org-defined rows (NOT an enum). Org owners can edit role permission sets. 4 default seeded roles per new org: `worker`, `supervisor`, `ehs_manager`, `site_admin`.
- **Teams** are **site-scoped**: a team binds to one or more sites (`team_sites`) and grants its permissions only within them.
- **Permissions** are system-keyed strings (`template:create`, `incident:close`, `capa:verify`, `member:invite`, `role:edit`, …). Not user-editable.
- Resolver in `lib/rbac/resolve.ts` unions role permissions (per `site_members`) with team permissions (per `team_members ∩ team_sites`). UI / Server Actions / RLS all key off this — never hardcode role checks.
- See memory: `project_rbac_model.md`.

## Read these in order before writing code

1. `AGENTS.md` — **Next.js 16.2.4 has breaking changes** from training data; consult `node_modules/next/dist/docs/` first
2. `docs/SPEC.md` — single source of truth: tenancy, RBAC, data model, workflow rules, regulatory triggers, RLS, enums. **§15 decisions log records every choice that's been locked in.**
3. `docs/ui-flow.md` — page-by-page contract: every route, permission gates, modals, state machines, URL conventions, build priority
4. `docs/onboarding.md` — slim onboarding (signup → org → site → invite → pathway → guided dashboard); welcome cards; tooltip inventory
5. `docs/design.md` — visual tokens (OKLch palette, brand purple), typography, component recipes (5×5 risk matrix, body map, 5-Why chain, regulatory banner, template builder, inspection runner, calendar grid), dark mode
6. `plans/00-foundation.md` (shipped) and `plans/01-incidents-capture.md` (shipped) — execution detail for Phases 0 and 1; per-phase plans for 02–06 written at the start of each phase
7. `PLANNING/IMS_PLANNING.md` — reference production roadmap; honor as default direction unless we've logged a divergence in SPEC §15

## Tech stack (locked)

- **Framework:** Next.js **16.2.4** + React 19.2.4 + Tailwind v4 + shadcn/ui (radix-vega style)
- **Database / Auth / Storage:** **Supabase**. Env var name uses the new convention: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT the older `ANON_KEY`)
- **Cache Components ON** (`cacheComponents: true` in `next.config.ts`); params are `Promise<...>` (must `await`); middleware is **`proxy.ts`** at the project root (NOT `middleware.ts`); `'use cache'` directive replaces old `fetch` cache options. **`export const runtime` is rejected by route handlers under Cache Components** — handlers default to nodejs anyway, so just omit the export (use `.tsx` extension when the handler returns JSX, e.g. for `@react-pdf/renderer`).
- **Forms:** `react-hook-form` + Zod + Server Actions + `useActionState`. Actions return `{ ok: true, data } | { ok: false, error, fieldErrors? }`
- **Other:** recharts (charts), @dnd-kit (Kanban drag), @react-pdf/renderer (OSHA 301 / RIDDOR PDF), date-fns

## Hard rules (don't break)

- **CAPA owner ≠ verifier** — enforced at 3 layers: UI (button disabled), Server Action (rejects), DB CHECK constraint (`verifier_id IS NULL OR verifier_id <> owner_id`). All three. The owner-cannot-verify property is independent of the role/team model — it's a per-CAPA invariant.
- **RBAC is roles + teams + permissions, not a role enum.** Use the resolver in `lib/rbac/resolve.ts`. Never write `if (role === 'site_admin')` — write `if (await can(user, 'permission_key', siteId))`. The 4 default role names (`worker` / `supervisor` / `ehs_manager` / `site_admin`) are seeded rows, not enum values, and admins can edit their permission sets.
- **Site hierarchy is access-only, not data.** Data attaches to one site; access propagates only via `site_members.include_children = true`. No template / asset / incident inheritance up or down the tree.
- **Brand purple `#735CDD`** with a **separate success green `#16A34A`** — NOT the same color. Severity S4 (Minor) and Track C ("Log & close") use the success green, not the brand. Don't propose another color swap; it's locked.
- **Notifications fire at classification, NOT at workflow end** — the regulatory clock (OSHA 8hr fatality, OSHA 24hr amputation, RIDDOR immediate, etc.) cannot wait for investigation completion. Engine in `lib/workflow/notifications.ts`.
- **No tour-overlay libraries** (joyride / shepherd / intro.js / driver.js / etc.) — UI must be self-explanatory via labels, tooltips, useful empty states. Setup goes through real multi-step wizards (Onboarding, Report Wizard, Template Builder) with dedicated routes. The dashboard is "guided" via empty-state cards and action tiles, not floating overlays.
- **Soft-delete only** on `incidents`, `investigations`, `capas` — never hard-delete (5y OSHA / 3y RIDDOR retention). Append-only audit tables (`severity_overrides`, `notifications`, `activity_events`) have UPDATE/DELETE revoked from PUBLIC.
- **3-step Report Wizard uses draft-row + per-step server actions**, not client-only state. The `incidents` row exists in DB from Step 1 with `status='draft'`; the regulatory clock starts on Step 3 finalize.
- **Workflow engine called from a Server Action, NOT a DB trigger** (severity engine, routing engine, notification engine all live in `lib/workflow/*.ts` and run inside `finalizeIncident`).
- **Verification result has 4 outcomes** (`effective` / `partially_effective` / `not_effective` / `too_early_to_verify`) plus a `verification_method` enum (`inspection` / `monitoring` / `audit_trend` / `re_interview` / `document_review`). `partially_effective` auto-creates a follow-up CAPA via `follow_up_capa_id`.
- **Templates are versioned; in-flight inspections snapshot the version.** Editing a template publishes a new version; running inspections keep their `template_version_id` snapshot so mid-cycle edits never silently rewrite history.
- **Argus is assistive, not authoritative.** The AI co-pilot suggests; humans decide. Severity, track, CAPA closure, OSHA/RIDDOR submission must always carry a named human signature. No tool-use call may finalize an incident, write a regulatory report, or close a CAPA. Inverts the IMS_PLANNING §17.8 / §2.4.3 "AI is a permanent non-goal" stance — see `docs/SPEC.md` §15 (2026-05-10) and §16. Never auto-classifies severity, auto-routes incidents, or auto-closes CAPAs.
- **Every Argus interaction is logged.** `argus_suggestions` row + `activity_events` row with `actor_kind='argus'`. Includes model, prompt + completion + cache tokens, and the user's outcome. Required for audit + cost accounting. Argus actions still gate through existing RBAC (`capa:create`, etc.) — there is no separate `argus:*` permission set; `argus:use` is the single feature-availability flag.
- **PII redaction before sending to Anthropic.** `lib/argus/redact.ts` strips known names + emails + phone + UK NI before egress. Defence-in-depth on top of Anthropic's no-training policy — free-text descriptions can still re-leak. Cost guardrails are server-side: per-org daily token budget + per-user rate limit; both enforced in `app/api/argus/stream/route.ts` before model calls.

## Conflict resolution

- Our docs (SPEC, design, ui-flow, onboarding, plans) are the source of truth for what we ship. When `PLANNING/IMS_PLANNING.md` and our docs disagree, resolve explicitly: either update our docs to match, or log the divergence in `docs/SPEC.md` §15. Never silently ignore an IMS_PLANNING update — it's owned by a separate workstream that pushes revisions to main, and we delta-check on each push.
- When two of our docs disagree: design.md wins for visual concerns; SPEC.md wins for data/workflow; ui-flow.md wins for page structure.

## Conventions

- Branch naming + commit conventions: `.claude/rules/github-workflow.md`. Commits use Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`).
- All commits include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer per the bash tool guidance.
- **Build status:** see [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md) for the full phase-by-phase shipping log. Current state in one line: **V1 polish-complete + Phase 8 + Phase 12 + Phase 13 shipped on `main`** — all 5 modules shipped 2026-05-06 + Phase 6 frontend polish closed 2026-05-08 (12 PRs: 6a Dashboard #7 · 6k Sidebar #8 · 6l Topbar #9 · 6b Incidents #10 · 6c Investigations #11 · 6d CAPA #17 · 6e Reports #18 · 6f Templates #19 · 6g Inspections #20 · 6h Resources #21 · 6i Planner #22 · 6j Admin #23) + Phase 11 org admin console (11a sites #14 · 11b members #15 · 11c roles + invitations #16) + Phase 8 Settings shipped 2026-05-09 (PR #24 — `/settings` account preferences) + Phase 12 Auth & Onboarding merged 2026-05-09 (PR #25 — public `/register` · `/verify-otp` (DEMO OTP `8484`) · `/forgot-password` · `/reset-password` · 3-step `/onboarding` wizard backed by `bootstrap_org_v1` RPC; auth gate split; proxy middleware uses `getUser()` for auto-refresh) + Phase 13 Site Setup OSHA + RIDDOR alignment merged 2026-05-09 (PR #26 — wizard reshape from 7 numeric steps to 9 slug-based steps `basics → jurisdiction → identifiers → workforce → hazards → departments → people → recipients → confirm` with country branching at every layer; 22 new columns on `sites` covering structured address + lat/long + jurisdiction + EIN/NAICS/CRN/UK SIC identifiers + workforce + applicable_standards/hazard_tags `text[]` + EHS lead + RIDDOR responsible person; new `site_emergency_contacts` child table; computed-read SQL functions `is_ita_required` + `is_partially_exempt` from 29 CFR 1904 Appendix A; INSERT/UPDATE/DELETE RLS policies on `notification_recipients` (closed a Phase-0-era SELECT-only bug that blocked Step 6 saves); localStorage draft persistence on every step's form survives tab-close / refresh / browser crash with a "Draft restored" banner + Discard CTA, 24h TTL, auto-clears on next-step mount + on Launch). Surfaces audited across all 35 routes; every org-admin task that previously required the Supabase SQL editor now has a UI path; brand-new emails self-onboard end-to-end with no service-role intervention. **Roadmap:** Phase 9a Argus Foundation merged 2026-05-10 (PR #27); **Phase 9b Argus Copilot — IN PROGRESS on `feat/phase-9b-argus-copilot` (PR #28)**: inline `<ArgusFormAssistant>` collapsible strip mounted ABOVE WizardProgress on Report Wizard Steps 2 + 3 (matches `assets/incident-reporting-2.png`); mic via Web Speech API (`useVoice()`); camera capture via `<input capture="environment">`; **four** Anthropic tool-use schemas (`update_incident_field` for auto-fill of title/description/area/location/substance/equipment + `log_observation` + `attach_photo` + `raise_stop_work`); agentic loop in `app/api/argus/copilot/route.ts` with prompt caching on system + tools; system prompt at `lib/argus/system-prompts/copilot.md` instructing aggressive auto-fill; Step components carry `key={incident.updated_at}` so they remount with fresh server values after `router.refresh()` triggered by any fill tool call; new `notification_kind='stop_work_raised'` enum value; sticky `<StopWorkBanner>` on (app) shell with one-click Acknowledge action; `profiles.argus_copilot_disabled` per-user opt-out. **No floating FAB** — the global topbar Sparkles (9a) remains the org-wide Argus chat surface. → 9c AI Investigator → 9d magic-wands → 9e global panel + Dashboard tiles → Phase 7 (global search backend → consumes the 6l search shell) → Phase 10 (Safety Bulletin step + wizard 3→4 step restructure). Every runtime change goes through a feature branch + PR per `.claude/rules/github-workflow.md`; direct push to `main` is reserved for doc-only updates the user explicitly asks for.
- **Database workflow:** `pnpm db:push` (apply migrations) and `pnpm db:types` (regen TS types) both load `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` from `.env.local` via `scripts/with-env-file.mjs` — no interactive `supabase login` needed. New migrations follow Supabase CLI's required `YYYYMMDDhhmmss_<name>.sql` timestamp prefix.
- **Industry types** seeded for v1: `healthcare`, `education`, `manufacturing`, `warehouse`, `office`, `construction`, `lab`. Drives template presets. Extensible by `site_admin`.
- **Pathways** offered at onboarding: `report_incidents`, `run_inspections`, `manage_assets`, `compliance_reports`, `manage_documents`. Personalize the dashboard; do NOT gate modules — every org gets every module.
- **Seed structure:** one org "UCB" with two top-level sites Houston (US) + Manchester (GB) plus 1–2 child sites under each to exercise hierarchy + include-children. All names are placeholders (see memory: `project_site_names.md`).
- **Type-specific incident data** uses sparse columns on `incidents` (NOT child tables) for v1; per-type child tables (per IMS_PLANNING §12.2) deferred to v2.
- **File storage** uses Supabase Storage with private buckets + path-prefix RLS.

## Path aliases

`@/components`, `@/lib`, `@/ui`, `@/hooks` (configured in `components.json` + `tsconfig.json`).

## Verification

Local boot:
```bash
pnpm install
pnpm dev
```
Supabase project: `https://uvziktjgrcosxirisiug.supabase.co` (URL + publishable key in `.env.local`; service role key needed for `scripts/seed.ts`).
