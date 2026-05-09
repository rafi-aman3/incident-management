# Phase 13 — Site Setup: OSHA + RIDDOR alignment

> **Status:** All 10 questions resolved 2026-05-09 — user said "ship it as recommended." Branch `feat/phase-13-site-setup-osha-riddor` cut from `main` at `97e4468`. Implementation in flight.

## What this phase ships

A real, audit-defensible Site Setup wizard that captures the fields OSHA and RIDDOR actually require — replacing today's 7-step demo wizard that collects only name + address text + NAICS + OSHA establishment ID. Plus an RLS bug fix that's currently blocking Step 6 in the live demo, plus URL slugs to make `/admin/site-setup/<step>` self-explanatory.

## Why now

User reported two concrete problems with the current wizard:
1. Step 6 (Notification recipients) returns `new row violates row-level security policy for table "notification_recipients"` on Save & continue. Audit found `notification_recipients` only has a SELECT policy in the Phase 0 init migration (`init.sql:749`); RLS enabled (line 638); INSERT/UPDATE/DELETE all silently rejected.
2. Step URLs are bare numbers (`/admin/site-setup/6`), which is not self-explanatory.

User also asked for OSHA + RIDDOR field completeness. Their research notes (cross-checked against current OSHA Appendix A + 29 CFR 1904 / RIDDOR 2013) accurately enumerate the missing fields. Today's `sites` row is too thin to drive Form 300A submission, ITA exemption logic, or RIDDOR responsible-person workflow.

## Locked decisions (from kickoff Q&A 2026-05-09)

1. **Single Phase 13 PR** — RLS fix + URL slugs + schema expansion + wizard rewrite all land together. No partial main state.
2. **Full field set** — every column on the gap table below ships.
3. **8-step wizard with country branching** — over keeping 7 steps + denser pages.
4. **Branch:** `feat/phase-13-site-setup-osha-riddor`. Plan: `plans/13-site-setup-osha-riddor.md`. Phase number: 13.

## Current state (audit)

**Routing:** `/admin/site-setup/[step]` parses `[step]` as integer 1–7 in `app/(app)/admin/site-setup/[step]/page.tsx`. Index `/admin/site-setup` redirects to `nextIncompleteStep()` per `setup_progress` JSON (`app/(app)/admin/site-setup/page.tsx`). Step catalog is `lib/site-setup/steps.ts` (clean shape — `{number, progressKey, title, description}`).

**Today's 7 steps:**
| # | Slug-to-be | What it collects |
|---|---|---|
| 1 | basics | name, address (single text blob), country (US/GB), timezone |
| 2 | regulator | OSHA / HSE / both — stored in `setup_progress.regulator` JSONB |
| 3 | establishment-ids | OSHA establishment ID + NAICS (US) / HSE establishment number (GB, JSONB-only) |
| 4 | departments | Department + areas — stored in `setup_progress.departments` JSONB |
| 5 | users | Existing site members (read-only summary, jumps off to `/admin/sites/[id]?tab=members`) |
| 6 | recipients | Notification recipients per kind — **RLS-blocked** |
| 7 | confirm | Summary + Launch button (sets `setup_completed_at`) |

**Schema today on `sites`:** id, org_id, parent_site_id, name, **address (single text)**, country (US/GB), region, timezone, osha_establishment_id, naics_code, archived_*, setup_completed_at, setup_progress (JSONB), created_at, updated_at. Site annual hours live in a separate `site_annual_hours` table (multi-year, already shipped).

## Gap analysis vs OSHA + RIDDOR

OSHA references: 29 CFR 1904.4 (recordkeeping), 1904.41 (electronic submission / ITA), 1910.119 (PSM), Appendix A (high-hazard NAICS list). RIDDOR references: Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 + HSE responsible-person guidance.

| Bucket | Field | Today | Regime | Required for |
|---|---|---|---|---|
| **Address** | street_1, street_2 | Single `address text` | Universal | Form 300A, RIDDOR F2508 |
| | city, state_or_region, postal_code | ❌ | Universal | Same |
| | latitude, longitude | ❌ | Universal | Future map-view dashboard |
| **Jurisdiction** | osha_jurisdiction (federal / state_plan_<code>) | ❌ | OSHA | Reporting portal routing |
| | gb_jurisdiction (hse / local_authority) | ❌ | RIDDOR | Reporting portal routing |
| **Identifiers** | ein (Employer ID) | ❌ | OSHA | ITA submission |
| | ita_establishment_id | ❌ | OSHA | ITA submission (post-registration) |
| | sic_code | ❌ | OSHA | Legacy/insurer requests |
| | uk_sic_2007 | ❌ | RIDDOR | HSE classification |
| | crn (Companies House Reg #) | ❌ | RIDDOR | Reporting attribution |
| | hse_establishment_number | JSONB-only | RIDDOR | F2508 (when issued) |
| **Industry** | naics_code | ✅ column | OSHA | ITA + 300A + recordkeeping exemption |
| **Workforce** | peak_employees_year | ❌ | OSHA | 300A + size-based exemption |
| | avg_employees_year | ❌ | OSHA | 300A |
| | annual hours | ✅ via `site_annual_hours` | OSHA | TRIR / DART / 300A |
| **Lifecycle** | site_type (fixed / mobile / office_only) | ❌ | Universal | Establishment rules for traveling crews |
| | operational_status (active / inactive / closed) | ❌ | Universal | Historical retention (5y OSHA / 3y RIDDOR) |
| | opened_on, closed_on | ❌ | Universal | Same |
| **Recordkeeping** | partially_exempt_override (bool) | ❌ | OSHA | Voluntary recordkeeping for exempt sites |
| **Programs** | psm_applicable (bool) | ❌ | OSHA | 1910.119 trigger flag |
| **Standards** | applicable_standards (text[]: 1910 / 1926 / 1915 / 1928) | ❌ | OSHA | Per-site program/training set |
| **Hazards** | hazard_tags (text[]: confined_space / hot_work / loto / silica / lead / asbestos / working_at_height / manual_handling / noise / chemicals) | ❌ | Universal | Program/training derivation |
| **People** | site_ehs_lead_id (FK profiles) | ❌ | Universal | Incident routing default |
| | riddor_responsible_person_name | ❌ | RIDDOR | F2508 dutyholder |
| | riddor_responsible_person_role | ❌ | RIDDOR | F2508 dutyholder |
| **Contacts** | emergency_contacts (child table) | ❌ | Universal | Incident response |

**Computed (no storage):** `is_ita_required(naics, peak_employees)`, `is_partially_exempt(naics, peak_employees)` — derived from the Appendix A list + size thresholds at read time via SQL functions. Override flag `partially_exempt_override` exists separately for voluntary recordkeepers.

## Schema migration plan

**New columns on `sites`:**
- `street_1 text`, `street_2 text`, `city text`, `state_or_region text`, `postal_code text` — structured address
- `latitude numeric(9,6)`, `longitude numeric(9,6)` — both nullable; CHECK constraint `(latitude IS NULL) = (longitude IS NULL)` so you can't half-set; range checks `latitude between -90 and 90` + `longitude between -180 and 180`. ~11 cm precision. Stays as plain numerics (NOT PostGIS) — future map dashboard just reads two numbers per row. If we ever need real spatial queries ("sites within 50 mi of incident"), promote to PostGIS in a future phase via a one-shot conversion.
- `osha_jurisdiction text` — `federal` | `state_plan` (free-form `state_plan_code` text alongside, since CA / MI / WA / etc. are 22+ values)
- `state_plan_code char(2)` — only when `osha_jurisdiction='state_plan'`
- `gb_jurisdiction text` — `hse` | `local_authority`
- `ein text` — US Employer Identification Number (NN-NNNNNNN format)
- `ita_establishment_id text` — assigned post-ITA-registration
- `sic_code text` — 4-digit SIC (legacy)
- `uk_sic_2007 text` — UK SIC 2007 5-digit
- `crn text` — Companies House Registration Number
- `hse_establishment_number text` — promotes from JSONB to column
- `peak_employees_year integer`
- `avg_employees_year integer`
- `site_type text` — `fixed` | `mobile` | `office_only`
- `operational_status text` — `active` | `inactive` | `closed`
- `opened_on date`
- `closed_on date`
- `partially_exempt_override boolean default false`
- `psm_applicable boolean default false`
- `applicable_standards text[]` — subset of `{'1910','1926','1915','1917','1918','1928'}`
- `hazard_tags text[]` — subset of the fixed catalog enum
- `site_ehs_lead_id uuid references profiles(id)`
- `riddor_responsible_person_name text`
- `riddor_responsible_person_role text`

**New table `site_emergency_contacts`:**
```sql
create table site_emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references sites(id) on delete cascade,
  name text not null,
  role text,
  phone text,
  email text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```
RLS: read = `user_can_access_site(site_id)`; write = `has_permission('site:configure', site_id)`.

**RLS fix on `notification_recipients`** (closes the user-reported bug):
```sql
create policy notification_recipients_insert on notification_recipients for insert to authenticated
  with check (has_permission('site:configure', site_id));
create policy notification_recipients_update on notification_recipients for update to authenticated
  using (has_permission('site:configure', site_id));
create policy notification_recipients_delete on notification_recipients for delete to authenticated
  using (has_permission('site:configure', site_id));
```

**Computed-read SQL functions:**
```sql
create or replace function is_ita_required(p_naics text, p_peak_employees integer)
  returns boolean
  language sql immutable parallel safe as $$
  select case
    when p_naics is null or p_peak_employees is null then false
    when p_peak_employees >= 250 and p_naics in (<full Appendix A list>) then true
    when p_peak_employees between 20 and 249 and p_naics in (<high-hazard subset>) then true
    else false
  end;
$$;

create or replace function is_partially_exempt(p_naics text, p_peak_employees integer)
  returns boolean
  language sql immutable parallel safe as $$
  select case
    when p_peak_employees is not null and p_peak_employees <= 10 then true
    when p_naics is not null and p_naics in (<low-hazard exempt NAICS list>) then true
    else false
  end;
$$;
```
Appendix A list and exempt-NAICS list come from the OSHA codified tables — exact values curated in the migration as a static array literal.

**Address column legacy:** keep `sites.address text` for one phase as a denormalized concat (auto-populated via trigger from the structured fields) so existing read paths don't break; mark for removal in Phase 14+. Backfill on migration: best-effort copy current `address` value into `street_1` for rows that don't have structured fields yet.

## Wizard re-shape (8 steps + slugs)

| # | Slug | Title | Country branching | Fields |
|---|---|---|---|---|
| 1 | `basics` | Site basics | — | name, structured address, **latitude + longitude**, timezone, site_type, operational_status, opened_on, (closed_on when status=closed) |
| 2 | `jurisdiction` | Jurisdiction | US: Federal vs State Plan + state code; GB: HSE vs Local Authority | regulator (legacy `osha`/`hse`/`both` field), osha_jurisdiction, state_plan_code, gb_jurisdiction |
| 3 | `identifiers` | Identifiers | US block: EIN, NAICS, SIC, ITA establishment ID; GB block: CRN, UK SIC 2007, HSE establishment number | ein, naics_code, sic_code, ita_establishment_id, crn, uk_sic_2007, hse_establishment_number |
| 4 | `workforce` | Workforce | US-leaning (300A driver) | peak_employees_year, avg_employees_year, in-place editor for `site_annual_hours`, computed read-only badges for `is_ita_required` + `is_partially_exempt` with override toggle for the latter |
| 5 | `hazards` | Hazard profile | US: applicable_standards multi-select + psm_applicable; both: hazard_tags multi-select | applicable_standards, psm_applicable, hazard_tags |
| 6 | `departments` | Departments & areas | — | unchanged from today |
| 7 | `people` | People | GB: RIDDOR responsible person fields shown | site_ehs_lead_id (profile picker from `site_members`), riddor_responsible_person_{name,role}, emergency_contacts editor (name/role/phone/email rows) |
| 8 | `recipients` | Notification recipients | — | unchanged from today + the RLS fix |
| 9 | `confirm` | Confirm & launch | — | summary + Launch |

> Note: 9 routes total but the user-facing "step count" is still 8 because Confirm is the launch screen, not a data-collection step. Today's wizard already has Confirm as Step 7.

## URL slug migration

**Catalog change** in `lib/site-setup/steps.ts`:
```ts
export const SETUP_STEPS = [
  { number: 1, slug: 'basics', progressKey: 'step1', title: 'Site basics', ... },
  { number: 2, slug: 'jurisdiction', ... },
  // ...
] as const;
export type SetupStepSlug = typeof SETUP_STEPS[number]['slug'];
export function isValidSlug(s: string): s is SetupStepSlug { ... }
export function stepBySlug(slug: SetupStepSlug): SetupStep { ... }
```

**Route file:** rename `app/(app)/admin/site-setup/[step]/page.tsx` → `app/(app)/admin/site-setup/[slug]/page.tsx`. Update parsing to look up by slug, not parse int. `nextIncompleteStep()` returns the slug string directly.

**Backward compat:** drop entirely (no redirector for old `/admin/site-setup/1` URLs). Rationale: this is internal admin chrome, no external links exist, breaking change is contained. If a user has an old tab open, they'll 404 → redirector at `/admin/site-setup` sends them to the right place.

**Other call sites that hardcode numeric URLs:** the actions file does `redirect('/admin/site-setup/2')` etc. between steps. Audit all `redirect("/admin/site-setup/N")` strings and replace with slug-based paths.

## Demo seed updates

`scripts/seed.ts` currently sets `setup_completed_at = now()` on demo sites without populating the new fields. Plan to:
- Backfill structured address fields on Houston, Manchester, etc. with realistic placeholder values.
- Backfill `latitude` + `longitude` with real coordinates: Houston `(29.7604, -95.3698)`, Manchester `(53.4808, -2.2426)`, Houston / Building A offset slightly from Houston (`(29.7610, -95.3705)`), Manchester / North offset slightly from Manchester. Drives the future map-view dashboard.
- Set EIN to a fake but format-valid `12-3456789` for Houston (US sites).
- Set peak_employees_year + avg_employees_year to seeded numbers (Houston: 145 / 132; Manchester: 65 / 60).
- Pick `site_type='fixed'`, `operational_status='active'` for all.
- For Manchester (GB): set `riddor_responsible_person_name='Erin Manager'`, role 'EHS Manager'.
- Pick reasonable hazard_tags (Houston: confined_space + hot_work + loto + chemicals; Manchester: chemicals + manual_handling + noise).
- Add 2 emergency contacts per site (site EHS lead + plant manager).

This keeps the demo dashboard's KPIs honest (TRIR formula uses `peak_employees_year` once we ship; pre-13 reads from `site_annual_hours`).

## RBAC

No new permission keys. The existing `site:configure` (granted to `site_admin` + `ehs_manager` per Phase 11a) gates every new write path:
- `sites` UPDATE — already gated
- `notification_recipients` INSERT/UPDATE/DELETE — new policies, this PR
- `site_emergency_contacts` all writes — new policies

## Smoke test outline

New `docs/smoke-test-phase13.md`:
1. RLS bug — log in as `admin@demo.local` → /admin/site-setup → walk to recipients step → save & continue → succeeds (was failing pre-13).
2. Slug URLs — navigate to `/admin/site-setup/basics` directly; verify deep-link works. Numeric `/admin/site-setup/1` → 404 (or redirector handles, depending on Q5 below).
3. Country branching — US site (Houston): jurisdiction step shows Federal/State-Plan picker; identifiers step shows EIN/NAICS/SIC/ITA fields, hides UK fields. GB site (Manchester): jurisdiction step shows HSE/Local-Authority picker; identifiers step shows CRN/UK-SIC/HSE-establishment fields. People step shows RIDDOR responsible person only on GB.
4. Workforce step — enter peak=15 employees → "Partially exempt? — likely YES (≤10 employees rule N/A — over 10)" badge. Set NAICS to a low-hazard exempt code → badge flips to YES.
5. Hazards multi-select — pick `confined_space` + `hot_work`; verify saved as text[] in `sites.hazard_tags`.
6. Emergency contacts — add 2 contacts; reorder via sort_order; remove one; persist.
7. Confirm step — every previously-flagged warning still surfaces (OSHA establishment ID missing, etc.); new warnings for missing EIN, missing peak_employees_year.
8. Launch — `setup_completed_at` set; redirect to dashboard.

## Decisions (locked 2026-05-09 — user said "ship it as recommended")

1. **`address` column** — KEEP for Phase 13 as denormalized text; the migration writes `street_1 = address` for existing rows so legacy reads keep working. Drop scheduled for Phase 14+.
2. **Hazard tags storage** — `text[]` on `sites`. Display labels live in `lib/site-setup/hazard-tags.ts`. Promote to lookup table only when Templates module needs to derive required training (Phase 14+).
3. **Applicable standards** — `text[]`. OSHA part numbers are stable; constants module mirrors hazard-tags.
4. **State Plan list** — hardcoded TS constant (22 states + PR + VI), validated server-side via Zod enum.
5. **Old numeric URL backward-compat** — DROP. No redirector. `/admin/site-setup` index already routes to next-incomplete; old open tabs hit 404 + index recovery.
6. **Existing demo sites with `address` text** — copy `address → street_1` on migration. No regex parsing. Admin re-splits during next wizard walkthrough; missing structured fields surface as warnings on the Confirm step.
7. **`site_ehs_lead_id`** — nullable column (schema-level), required at Step 7 save (wizard-level). Standard pattern (mirrors `setup_completed_at` etc.).
8. **Annual hours integration on Step 4** — embed the multi-year editor inline. Wizard fatigue is real; sending users to a different tab mid-setup is jarring.
9. **Emergency contacts minimum** — zero allowed; Confirm-step warning fires when zero.
10. **Lat/long capture UX** — V1 = manual paste with help text "right-click in Google Maps → click the coordinates pair → paste". Geocoding API (Nominatim) deferred to V2 when the future map dashboard ships and the field becomes load-bearing.

## Out of scope (defer to v2)

- **Map-view dashboard** — Phase 13 ships the lat/long *columns* + populates them in the demo seed; the actual `<MapView sites={...} />` component (Leaflet + OpenStreetMap tiles is the lightest path) is a future phase. This phase is the schema unblock.
- **Geocoding API integration** — manual lat/long paste only in V1 (see Q10).
- ITA portal API integration — manual ITA submission stays
- HSE F2508 portal API integration — same
- Multi-establishment EIN handling (one EIN per legal employer can cover multiple establishments — this PR uses one EIN per site, simpler model)
- Cal/OSHA-, MIOSHA-specific field collection beyond the state-plan flag
- PSM covered-process registry (just a yes/no flag at site level for now)
- Hazard tag → required training/program derivation (Phase 14+ tie-in to Templates module)
- Site EHS lead change history / audit trail beyond the existing `activity_events`
- Address autocomplete / Google Places integration
- Site cloning (copy setup from one site to another)

## Files to touch

**New:**
- `supabase/migrations/20260517120000_phase13_site_setup_osha_riddor.sql` — schema additions + RLS fix + computed functions + RLS for new table
- `lib/site-setup/hazard-tags.ts` — code → display label map
- `lib/site-setup/applicable-standards.ts` — same
- `lib/site-setup/state-plans.ts` — same
- `lib/site-setup/naics.ts` — Appendix A list + exempt list (truncated to what we cite at runtime)
- `components/site-setup/step-2-jurisdiction.tsx` (replaces step-2-regulator.tsx)
- `components/site-setup/step-4-workforce.tsx`
- `components/site-setup/step-5-hazards.tsx`
- `components/site-setup/step-7-people.tsx` (replaces step-5-users.tsx for the EHS lead + responsible person + contacts shape)
- `docs/smoke-test-phase13.md`

**Modified:**
- `lib/site-setup/steps.ts` — add `slug`, `isValidSlug`, `stepBySlug`
- `lib/site-setup/schemas.ts` — Zod schemas for new fields
- `app/(app)/admin/site-setup/[step]/page.tsx` → renamed to `[slug]/page.tsx` + slug routing
- `app/(app)/admin/site-setup/page.tsx` — redirector returns slug
- `app/(app)/admin/site-setup/actions.ts` — new save actions per new step + slug-based redirects
- `components/site-setup/wizard-chrome.tsx` — StepList now uses slug-based hrefs
- `components/site-setup/step-1-basics.tsx` — structured address fields
- `components/site-setup/step-3-establishment-ids.tsx` — country-branched identifier blocks
- `components/site-setup/step-6-recipients.tsx` — no UI change, RLS fix is migration-only
- `components/site-setup/step-7-confirm.tsx` → renumber to `step-9-confirm.tsx`, surface new warnings (missing EIN, peak employees, etc.)
- `scripts/seed.ts` — backfill new fields on demo sites
- `docs/SPEC.md` — log the schema decisions in §15
- `docs/onboarding.md` — refresh the wizard description

## Branch + commit shape

One feature branch (`feat/phase-13-site-setup-osha-riddor`), one or two commits before squash-merge:
1. `feat(phase-13): site setup OSHA + RIDDOR alignment` — schema + RLS + slugs + wizard rewrite + seed update
2. (optional) `docs(phase-13): smoke test + SPEC §15 update`

Squash on merge to keep `main` history flat.

## Effort estimate

~2-3 days of focused work:
- Half-day: schema migration + RLS + computed SQL functions + Appendix A curation
- Half-day: slug routing + URL migration + redirector
- 1 day: 8 step components rewrite + zod schemas + actions
- Half-day: demo seed backfill + smoke test guide + SPEC update
