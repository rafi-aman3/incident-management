# CLAUDE.md split — design

**Date:** 2026-05-12
**Status:** approved (in-session Q&A)
**Scope:** doc-only refactor — no code, no migrations, no behavior change

## Problem

`CLAUDE.md` is 98 lines but one line (line 79, the "Build status:" paragraph under `## Conventions`) is ~26 KB of inline phase-by-phase log that has accreted since PR #30 (Phase 9d). The log:

- duplicates content already in `docs/BUILD_STATUS.md` (which only goes up to Phase 9e — entries from PR #30 onward never made it across)
- is also triplicated in per-phase memory files (`project_phase_*.md`)
- inflates every conversation's context for content Claude rarely needs at the start of a task

Other CLAUDE.md sections (`## Modules` / `## Tenancy` / `## RBAC` / various `## Conventions` bullets) duplicate content already in `docs/SPEC.md` and `docs/onboarding.md`.

## Goal

Split `CLAUDE.md` so it carries only load-bearing context for every conversation, with non-load-bearing content moved to the canonical docs that already cover it.

## Non-goals

- No new build-rule extraction (Hard rules stay inline — they're the most-violated tripwires)
- No restructure of `SPEC.md` content
- No memory-file changes
- No plan-file changes
- No code, no migrations

## File-level plan

```
CLAUDE.md                ~50 lines  (was 98 — but 26 KB inline log dominates)
docs/BUILD_STATUS.md     +~10 new phase entries appended
docs/local-dev.md        NEW, ~30 lines
docs/SPEC.md             1 small addition (Modules table to §2)
```

## What stays in CLAUDE.md

Load-bearing for every conversation start:

1. `@AGENTS.md` import (Next.js breaking-changes tripwire)
2. `# EHS Operations Platform — Project Context` + 1-paragraph orientation
3. `## Read these in order before writing code` — pointer list (add `docs/local-dev.md`)
4. `## Tech stack (locked)` — 5 bullets; must stay loaded so we don't write Next 15 patterns
5. `## Hard rules (don't break)` — 14 bullets; the most-violatable list
6. `## Conflict resolution` — 2 bullets
7. `## Conventions` — slimmed to 3 bullets: GH workflow pointer · commit trailer · build-status pointer
8. `## Path aliases` — 1 line
9. `## Build status` — 1-line pointer (replaces the 26 KB log)

## What moves OUT of CLAUDE.md

| Removed | Destination | Why |
|---|---|---|
| `## Modules` table | `docs/SPEC.md` §2 (new at-a-glance table) | SPEC §4–§7 already has per-module detail; the index table belongs at SPEC's top |
| `## Tenancy` (3 bullets) | already in SPEC.md §2 + §10 | pure duplication; "Read these in order" still points there |
| `## RBAC` (5 bullets) | already in SPEC.md §11 | pure duplication; Hard rule "use the resolver" is the tripwire that stays |
| `## Verification` (boot commands) | `docs/local-dev.md` | rarely-needed reference, not load-bearing |
| Conventions: Database workflow bullet | `docs/local-dev.md` | with the rest of dev setup |
| Conventions: Industry types bullet | already in SPEC.md §10 enums | duplicate |
| Conventions: Pathways bullet | already in `docs/onboarding.md` | pathways are an onboarding concept |
| Conventions: Seed structure bullet | already in memory `project_site_names.md` | demo-specific |
| Conventions: Type-specific incident data bullet | already in SPEC.md §10 §361 | duplicate |
| Conventions: File storage bullet | already in SPEC.md §11 storage buckets | duplicate |
| **The 26 KB inline build log (line 79)** | `docs/BUILD_STATUS.md` (appended) | the actual bloat |

## `docs/BUILD_STATUS.md` additions

BUILD_STATUS.md currently goes Phase 0 → Phase 9e. Append entries for:

- Phase 7 — Global Search (PR #32)
- Phase 10 — Safety Bulletins (PR #33)
- Topbar responsive fix (PR #34)
- §HZ spec adoption (PR #35)
- §JSA spec adoption (PR #36)
- §SDS-INTEGRATION spec adoption (PR #37)
- V2 phases 14-16 research + plans (PR #38)
- Phase 14 Hazard Register + Phase 16 SDS stub (PR #40, combined)
- Phase 15 JSA (PR #41)
- Phase 17 Settings Redesign plan (PR #42)

Each entry condensed to match the existing entries' density (~1 paragraph of load-bearing facts: schema, RBAC, route surface, gotchas) — not a verbatim copy of the inline log. Source material:

- the inline log on `CLAUDE.md` line 79
- the merged-PR memory files (`project_phase_*.md`)

## `docs/local-dev.md` — new file

Sections:

- **Boot:** `pnpm install` · `pnpm dev`
- **Supabase project:** URL · `.env.local` keys (publishable, service role for seeds)
- **Database workflow:** `pnpm db:push` · `pnpm db:types` · `pnpm db:check` · migration timestamp naming rule (`YYYYMMDDhhmmss_<name>.sql`)
- **Diagnostics:** `pnpm db:check` purpose (service-role demo-state print)

## SPEC.md change

Single addition: insert the 6-row Modules table at the top of §2 "System architecture" as an at-a-glance index. Existing §4–§7 detail stays put.

## Cross-reference verification

Before commit, grep for stale refs:

```bash
rg -n 'CLAUDE\.md' docs/ plans/ .claude/ AGENTS.md
rg -n '## Tenancy|## RBAC|## Modules|## Verification' docs/ plans/
```

Any pointer that names a removed section gets rewritten to point to the new home.

## Branch + PR

Per `.claude/rules/github-workflow.md`:

- Branch: `docs/split-claude-md`
- Conventional Commits: `docs: split CLAUDE.md — move build log + duplicated sections out`
- PR title: same
- Co-Authored-By trailer

## Risks

| Risk | Mitigation |
|---|---|
| Removing Tenancy/RBAC sections weakens Claude's start-of-task grounding | Hard rules already encode the load-bearing parts ("use the resolver"; "site hierarchy is access-only"). "Read these in order" still points to SPEC.md §2 + §11. |
| Future PR descriptions can't be lifted verbatim from the inline log | BUILD_STATUS.md is now the canonical source — future entries get appended directly there, not back into CLAUDE.md. |
| Stale doc cross-refs after section removal | Grep step above before commit. |

## Verification (after execution)

- `wc -l CLAUDE.md` ≈ 50
- `wc -l docs/BUILD_STATUS.md` grows by ~150 lines
- `docs/local-dev.md` exists
- `rg 'CLAUDE\.md#' docs/ plans/` returns no broken anchors
- `pnpm dev` still boots (sanity check; no code changed but doc-imports are sometimes referenced from `next.config.ts` etc. — confirm no surprises)
