@AGENTS.md

# EHS Operations Platform — Project Context

## What this is

A production v1 EHS Operations Platform for SDS Manager. An organisation contains hierarchical sites; each site runs **Incidents** (capture → classify → route → investigate → CAPA → regulatory reports — OSHA in the US, RIDDOR in the UK), **Inspections** (against versioned templates, scheduled or one-off), and **Resources** (operational assets + linked documents). Everything surfaces in a unified **Planner** calendar.

Stakeholder demos are milestones inside the build, not a separate deliverable. `PLANNING/IMS_PLANNING.md` is the reference roadmap (a separate workstream pushes revisions directly to main); `docs/SPEC.md` §15 records where we intentionally diverge.

## Read these in order before writing code

1. `AGENTS.md` — **Next.js 16.2.4 has breaking changes** from training data; consult `node_modules/next/dist/docs/` first
2. `docs/SPEC.md` — single source of truth: tenancy, RBAC, surface modules table, data model, workflow rules, regulatory triggers, RLS, enums. **§15 decisions log records every choice that's been locked in.**
3. `docs/ui-flow.md` — page-by-page contract: every route, permission gates, modals, state machines, URL conventions, build priority
4. `docs/onboarding.md` — slim onboarding (signup → org → site → invite → pathway → guided dashboard); welcome cards; tooltip inventory
5. `docs/design.md` — visual tokens (OKLch palette, brand purple), typography, component recipes (5×5 risk matrix, body map, 5-Why chain, regulatory banner, template builder, inspection runner, calendar grid), dark mode
6. `docs/local-dev.md` — boot commands, Supabase env vars, db workflow, v1 domain facts (industry types, pathways, seed structure)
7. `docs/BUILD_STATUS.md` — phase-by-phase shipping log: what shipped on each PR, schema deltas, fix recipes, locked decisions
8. `plans/00-foundation.md` through `plans/17-settings-redesign.md` — per-phase execution detail
9. `PLANNING/IMS_PLANNING.md` — reference production roadmap; honor as default direction unless we've logged a divergence in SPEC §15

## Tech stack (locked)

- **Framework:** Next.js **16.2.4** + React 19.2.4 + Tailwind v4 + shadcn/ui (radix-vega style)
- **Database / Auth / Storage:** **Supabase**. Env var name uses the new convention: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT the older `ANON_KEY`)
- **Cache Components ON** (`cacheComponents: true` in `next.config.ts`); params are `Promise<...>` (must `await`); middleware is **`proxy.ts`** at the project root (NOT `middleware.ts`); `'use cache'` directive replaces old `fetch` cache options. **`export const runtime` is rejected by route handlers under Cache Components** — handlers default to nodejs anyway, so just omit the export (use `.tsx` extension when the handler returns JSX, e.g. for `@react-pdf/renderer`).
- **Forms:** `react-hook-form` + Zod + Server Actions + `useActionState`. Actions return `{ ok: true, data } | { ok: false, error, fieldErrors? }`
- **Other:** recharts (charts), @dnd-kit (Kanban drag), @react-pdf/renderer (OSHA 301 / RIDDOR PDF), date-fns

## Hard rules (don't break)

- **CAPA owner ≠ verifier** — enforced at 3 layers: UI (button disabled), Server Action (rejects), DB CHECK constraint (`verifier_id IS NULL OR verifier_id <> owner_id`). All three. The owner-cannot-verify property is independent of the role/team model — it's a per-CAPA invariant.
- **RBAC is roles + teams + permissions, not a role enum.** Use the resolver in `lib/rbac/resolve.ts`. Never write `if (role === 'site_admin')` — write `if (await can(user, 'permission_key', siteId))`. The 4 default role names (`worker` / `supervisor` / `ehs_manager` / `site_admin`) are seeded rows, not enum values, and admins can edit their permission sets. See SPEC §11.
- **Site hierarchy is access-only, not data.** Data attaches to one site; access propagates only via `site_members.include_children = true`. No template / asset / incident inheritance up or down the tree. See SPEC §2 Tenancy.
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
- **PII redaction before sending to the model provider.** `lib/argus/redact.ts` strips known names + emails + phone + UK NI before egress. Provider-agnostic: applies regardless of which adapter (`lib/argus/llm/`) is configured. Free-text descriptions can still re-leak; treat the redactor as defence-in-depth, not a guarantee. Cost guardrails are server-side: per-org daily token budget + per-user rate limit; both enforced in the route handlers before model calls.

## Conflict resolution

- Our docs (SPEC, design, ui-flow, onboarding, plans) are the source of truth for what we ship. When `PLANNING/IMS_PLANNING.md` and our docs disagree, resolve explicitly: either update our docs to match, or log the divergence in `docs/SPEC.md` §15. Never silently ignore an IMS_PLANNING update — it's owned by a separate workstream that pushes revisions to main, and we delta-check on each push.
- When two of our docs disagree: design.md wins for visual concerns; SPEC.md wins for data/workflow; ui-flow.md wins for page structure.

## Conventions

- Branch naming + commit conventions: `.claude/rules/github-workflow.md`. Commits use Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`).
- All commits include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer per the bash tool guidance.
- **Build status:** every shipped PR is logged in [`docs/BUILD_STATUS.md`](docs/BUILD_STATUS.md). Append a new entry there when a PR merges — do NOT accrete entries back into CLAUDE.md.

## Path aliases

`@/components`, `@/lib`, `@/ui`, `@/hooks` (configured in `components.json` + `tsconfig.json`).
