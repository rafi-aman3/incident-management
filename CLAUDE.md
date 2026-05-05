@AGENTS.md

# EHS Incident Management — Project Context

## What this is
A stakeholder demo of an EHS (Environmental Health & Safety) Incident Management System — a complementary module to SDS Manager. It owns the full lifecycle of workplace safety events: capture → classify → route → investigate → CAPA (Corrective & Preventive Actions) → regulatory reports (OSHA in the US, RIDDOR in the UK).

This is the demo build, not production. `PLANNING/IMS_PLANNING.md` describes the production-scope roadmap; we ship a focused subset.

## Read these in order before writing code

1. `AGENTS.md` — **Next.js 16.2.4 has breaking changes** from training data; consult `node_modules/next/dist/docs/` first
2. `docs/SPEC.md` — single source of truth: data model, workflow rules, regulatory triggers, RLS, enums. **§15 decisions log records every choice that's been locked in.**
3. `docs/ui-flow.md` — page-by-page contract: every route, role-based access, modals, state machines, URL conventions, build priority (P0–P4)
4. `docs/onboarding.md` — first-login welcome cards (one per role), 7-step Site Setup Wizard, sandbox mode, tooltip inventory (17 regulatory terms)
5. `docs/design.md` — visual tokens (OKLch palette, brand purple), typography, component recipes (5×5 risk matrix, body map, 5-Why chain, regulatory banner), dark mode
6. `plans/00-foundation.md` — Phase 0 execution detail; per-phase plans for 01/02/03 written at the start of each phase
7. `PLANNING/IMS_PLANNING.md` — production-scope roadmap (a separate workstream pushes heavy revisions; **we are a demo subset, not a full implementer**)
8. `.claude/plans/lets-plan-this-tidy-pillow.md` — umbrella demo build plan

## Tech stack (locked)

- **Framework:** Next.js **16.2.4** + React 19.2.4 + Tailwind v4 + shadcn/ui (radix-vega style)
- **Database / Auth / Storage:** **Supabase**. Env var name uses the new convention: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT the older `ANON_KEY`)
- **Cache Components ON** (`cacheComponents: true` in `next.config.ts`); params are `Promise<...>` (must `await`); middleware is **`proxy.ts`** at the project root (NOT `middleware.ts`); `'use cache'` directive replaces old `fetch` cache options
- **Forms:** `react-hook-form` + Zod + Server Actions + `useActionState`. Actions return `{ ok: true, data } | { ok: false, error, fieldErrors? }`
- **Other:** recharts (charts), @dnd-kit (Kanban drag), @react-pdf/renderer (OSHA 301 / RIDDOR PDF), date-fns

## Hard rules (don't break)

- **CAPA owner ≠ verifier** — enforced at 3 layers: UI (button disabled), Server Action (rejects), DB CHECK constraint (`verifier_id IS NULL OR verifier_id <> owner_id`). All three. Independent verifier is a **function**, not a 5th role; `user_role` enum stays at 4 (worker / supervisor / ehs_manager / site_admin).
- **Brand purple `#735CDD`** with a **separate success green `#16A34A`** — NOT the same color. Severity S4 (Minor) and Track C ("Log & close") use the success green, not the brand. Don't propose another color swap; it's locked.
- **Notifications fire at classification, NOT at workflow end** — the regulatory clock (OSHA 8hr fatality, OSHA 24hr amputation, RIDDOR immediate, etc.) cannot wait for investigation completion. Engine in `lib/workflow/notifications.ts`.
- **No tour-overlay libraries** (joyride / shepherd / intro.js / driver.js / etc.) — UI must be self-explanatory via labels, tooltips, useful empty states. Setup work goes through real multi-step wizards (Site Setup, Report Wizard) with dedicated routes.
- **Soft-delete only** on `incidents`, `investigations`, `capas` — never hard-delete (5y OSHA / 3y RIDDOR retention). Append-only audit tables (`severity_overrides`, `notifications`, `activity_events`) have UPDATE/DELETE revoked from PUBLIC.
- **3-step Report Wizard uses draft-row + per-step server actions**, not client-only state. The `incidents` row exists in DB from Step 1 with `status='draft'`; the regulatory clock starts on Step 3 finalize.
- **Workflow engine called from a Server Action, NOT a DB trigger** (severity engine, routing engine, notification engine all live in `lib/workflow/*.ts` and run inside `finalizeIncident`).
- **Verification result has 4 outcomes** (`effective` / `partially_effective` / `not_effective` / `too_early_to_verify`) plus a `verification_method` enum (`inspection` / `monitoring` / `audit_trend` / `re_interview` / `document_review`). `partially_effective` auto-creates a follow-up CAPA via `follow_up_capa_id`.

## Conflict resolution

- Our docs (SPEC, design, ui-flow, onboarding, plans) **vs** the PRD or `PLANNING/IMS_PLANNING.md` → **our docs win for the demo build**.
- Record any divergence in `docs/SPEC.md` §15 (decisions log).
- When two of our docs disagree: design.md wins for visual concerns; SPEC.md wins for data/workflow; ui-flow.md wins for page structure.

## Conventions

- Branch naming + commit conventions: `.claude/rules/github-workflow.md`. Commits use Conventional Commits prefix (`feat:`, `fix:`, `docs:`, `chore:`).
- All commits include the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer per the bash tool guidance.
- During the **planning phase** (where we currently are), direct commits + push to `main` are acceptable. Once **code-implementation phasing** starts (any change that affects runtime behavior), switch to feature branches and PRs per the workflow rules.
- Site names **"Houston"** (US) and **"Manchester"** (GB) in the seed script are **placeholders**, not real customer sites. Don't propose renaming unless explicitly asked.
- Type-specific incident data uses **sparse columns on `incidents`** (NOT child tables) for v1 demo — child tables per IMS_PLANNING §12.2 are deferred to v2.
- File storage uses **Supabase Storage** for the demo (NOT local disk per IMS_PLANNING §15.3 — that's their production v1, not ours).

## Path aliases

`@/components`, `@/lib`, `@/ui`, `@/hooks` (configured in `components.json` + `tsconfig.json`).

## Verification

Local boot:
```bash
pnpm install
pnpm dev
```
Supabase project: `https://uvziktjgrcosxirisiug.supabase.co` (URL + publishable key in `.env.local`; service role key needed for `scripts/seed.ts`).
