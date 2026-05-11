# Local Development

Boot, database workflow, and v1 domain facts useful for setting up a dev or demo environment.

## Boot

```bash
pnpm install
pnpm dev
```

## Supabase project

- URL: `https://uvziktjgrcosxirisiug.supabase.co`
- Required in `.env.local`:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (NOT the older `ANON_KEY` — Supabase renamed it)
  - `SUPABASE_SERVICE_ROLE_KEY` (only needed for `scripts/seed.ts` and `pnpm db:check`)
  - `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` (for the migration / types CLI)
  - `GEMINI_API_KEY` (Argus runtime — see Phase 9d notes in `docs/BUILD_STATUS.md`)
  - `NEXT_PUBLIC_SDS_MANAGER_URL` (placeholder OK in dev)

## Database workflow

```bash
pnpm db:push       # apply migrations
pnpm db:types      # regen TS types from current schema
pnpm db:check      # service-role diagnostic: prints users/profiles/memberships/sites/roles for demo accounts (bypasses RLS, used to debug RLS recursion)
```

Both `db:push` and `db:types` load `SUPABASE_ACCESS_TOKEN` + `SUPABASE_DB_PASSWORD` from `.env.local` via `scripts/with-env-file.mjs` — no interactive `supabase login` needed.

Migration files follow Supabase CLI's required timestamp prefix: `YYYYMMDDhhmmss_<name>.sql`.

## v1 domain facts

- **Industry types** seeded for v1: `healthcare`, `education`, `manufacturing`, `warehouse`, `office`, `construction`, `lab`. Drives template presets. Extensible by `site_admin`.
- **Pathways** offered at onboarding: `report_incidents`, `run_inspections`, `manage_assets`, `compliance_reports`, `manage_documents`. Personalize the dashboard; do NOT gate modules — every org gets every module.
- **Seed structure:** one org "UCB" with two top-level sites Houston (US) + Manchester (GB) plus 1–2 child sites under each to exercise hierarchy + include-children. All names are placeholders.
- **Type-specific incident data** uses sparse columns on `incidents` (NOT child tables) for v1; per-type child tables (per IMS_PLANNING §12.2) deferred to v2.
- **File storage** uses Supabase Storage with private buckets + path-prefix RLS. See `docs/SPEC.md` §11.
