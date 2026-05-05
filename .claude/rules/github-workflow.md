# GitHub Workflow Rules

## Branch Naming

Use the format: `<type>/<short-description>`

- `feat/` — new feature (e.g., `feat/incident-timeline`)
- `fix/` — bug fix (e.g., `fix/login-redirect`)
- `chore/` — tooling, deps, config (e.g., `chore/upgrade-next`)
- `refactor/` — code restructuring without behavior change
- `docs/` — documentation only
- `test/` — adding or updating tests
- `hotfix/` — urgent production fix

Rules:
- Use lowercase, kebab-case for the description
- Keep it short (max ~50 chars)
- No personal names, ticket IDs go at the end if needed: `feat/incident-timeline-IM-123`

## Target Branches

- `main` — production-ready code. All PRs target `main` unless stated otherwise.
- `develop` (if used) — integration branch for upcoming releases.
- `hotfix/*` — branched from `main`, merged back into `main` and `develop`.
- Never push directly to `main`. All changes go through a PR.

## Commit & Squash

- Write commits in imperative mood: "add login form", not "added login form".
- Keep commit subjects under 72 characters.
- Squash all commits when merging a PR — one PR = one commit on `main`.
- The squashed commit message should match the PR title and follow Conventional Commits:
  - `feat: add incident timeline view`
  - `fix: prevent duplicate alerts on retry`
  - `chore: bump shadcn to latest`

## PR Template

Every PR description must include:

```markdown
## Summary
<1-3 bullet points describing what changed and why>

## Changes
- <key change 1>
- <key change 2>

## Test Plan
- [ ] <how to verify locally>
- [ ] <edge cases checked>

## Screenshots / Demo
<for UI changes>

## Related Issues
Closes #<issue-number>
```

Rules:
- PR title follows Conventional Commits (same format as the squashed commit).
- Keep PRs small and focused — one concern per PR.
- Mark as draft if not ready for review.
- At least one approval required before merging.
- All CI checks must pass before merge.
