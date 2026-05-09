# Phase 13 — Site Setup OSHA + RIDDOR smoke test

End-to-end walkthrough for the rewritten Site Setup wizard. Covers the RLS bug fix, slug URLs, country branching, computed-recordkeeping logic, hazard tags, lat/long round-trip, and Launch.

## Prerequisites

- `pnpm db:push` has applied `20260517120000_phase13_site_setup_osha_riddor.sql` to your Supabase project.
- `pnpm db:types` has regenerated `lib/supabase/types.ts`.
- `pnpm tsx scripts/seed.ts` has run at least once post-migration (Houston + Manchester have the new columns populated, plus emergency contacts and `site_ehs_lead_id`).
- Dev server: `pnpm dev`. Login: `admin@demo.local` / `Demo!2026`.

## Part A — RLS bug fix (the user-reported bug)

1. Sign in as `admin@demo.local`. Switch to a fresh in-progress site (or create one via `/admin/sites/new`).
2. Visit `/admin/site-setup` — you should land on the next-incomplete step.
3. Walk to the **Notification recipients** step (slug `recipients`).
4. Add a recipient for at least the OSHA 8-hr fatality kind. Click **Save & continue**.
5. **Expected:** redirect to `/admin/site-setup/confirm`; no "row violates row-level security policy" error.

If the form stays stuck with the error, the migration didn't apply or the `has_permission('site:configure', site_id)` policy isn't matching — confirm with:
```sql
select policyname, with_check, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'notification_recipients';
```
Should list 4 policies (read + insert + update + delete).

## Part B — URL slugs

1. From any step, edit the URL bar to `/admin/site-setup/jurisdiction` directly. Page renders the Jurisdiction step.
2. Try `/admin/site-setup/identifiers` — same.
3. Try `/admin/site-setup/9` (numeric URL — pre-13 worked) — should 404. The redirector at `/admin/site-setup` handles fallback for stale tabs.
4. Try `/admin/site-setup/garbage` — should 404.

## Part C — Country branching (US site)

Use Houston as the test site (US, NAICS 332710 manufacturing).

1. **Step 1 (basics):** Country shows "United States (OSHA jurisdiction)" as a read-only banner. State/region label reads "State". ZIP label reads "ZIP code".
2. **Step 2 (jurisdiction):** Shows `Federal OSHA` vs `A state plan` Select. Pick state plan → second select with 22+ state codes appears. Pick `CA — California (Cal/OSHA)`. Save.
3. **Step 3 (identifiers):** Shows the US block — EIN (with NN-NNNNNNN regex hint), NAICS (6-digit), SIC (4-digit), ITA establishment ID, legacy OSHA establishment ID. UK block hidden.
4. **Step 5 (hazards):** Shows the OSHA applicable-standards multi-select (1910/1926/1915/1917/1918/1928) AND the PSM toggle. Hazard tags below.
5. **Step 7 (people):** RIDDOR responsible person section is hidden.

## Part D — Country branching (GB site)

Switch site cookie to Manchester via the topbar SiteSwitcher, then `/admin/site-setup`.

1. **Step 1 (basics):** State/region label reads "Region / county". ZIP label reads "Postcode".
2. **Step 2 (jurisdiction):** Shows `HSE (Health and Safety Executive)` vs `Local authority` Select. Federal/state-plan widget hidden.
3. **Step 3 (identifiers):** Shows the GB block — Companies House CRN (8-char alnum), UK SIC 2007 (5 digits), HSE establishment number. US block hidden.
4. **Step 5 (hazards):** Applicable-standards multi-select + PSM toggle hidden. Hazard tags shown.
5. **Step 7 (people):** RIDDOR responsible person section visible with name + role inputs. Server enforces required-on-save for GB sites.

## Part E — Workforce + computed recordkeeping

1. Go to Houston → Step 4 (workforce).
2. Set peak employees to **8**. Save → re-load. Both badges:
   - "Partially exempt from routine recordkeeping" — **YES** (≤10 employees rule).
   - "Required to submit Form 300A via ITA" — **NO** (partially exempt).
3. Set peak employees to **300**, NAICS to a non-exempt code like `332710`. Save → re-load:
   - Partially exempt — **NO**.
   - ITA required — **YES** (250+ employees in any covered industry).
4. Set peak employees to **120**, NAICS to `332710` (manufacturing — high-hazard prefix `332`). Save → re-load:
   - Partially exempt — **NO**.
   - ITA required — **YES** (20–249 in high-hazard NAICS).
5. Set peak employees to `50`, NAICS to `541211` (CPA office — partially exempt prefix `5412`). Save → re-load:
   - Partially exempt — **YES**.
   - ITA required — **NO**.
6. Toggle "Voluntary recordkeeping override" on. Save. Re-load — checkbox stays checked, badges unaffected (override is independent).

## Part F — Hazards + applicable standards

1. Go to Step 5 (hazards) on Houston.
2. Pick `General Industry (1910)` + `Construction (1926)`. Toggle PSM on.
3. Pick hazard tags: confined_space, hot_work, hazardous_energy, chemicals.
4. Save → re-load. All five chips remain selected; PSM stays on.
5. Verify in DB:
   ```sql
   select applicable_standards, psm_applicable, hazard_tags
     from sites where name = 'Houston';
   ```
   Returns `{1910,1926}` + `t` + `{confined_space,hot_work,hazardous_energy,chemicals}`.

## Part G — Lat/long pairing

1. Go to Step 1 (basics) on a fresh site.
2. Enter latitude `29.7604`, leave longitude blank. Save — should fail with "Latitude and longitude must be both set or both blank".
3. Set both `29.7604` + `-95.3698`. Save → re-load. Both round-trip.
4. DB sanity:
   ```sql
   select latitude, longitude from sites where name = 'Houston';
   ```
   Returns the exact pair (NUMERIC(9,6) preserves 6 decimal places).

## Part H — Emergency contacts + EHS lead

1. Step 7 (people) on Houston:
   - EHS lead Select pre-populated with Erin Manager (seeded `ehs@demo.local`).
   - Emergency contacts list shows 2 rows from seed.
2. Add a third contact (name + email only — phone optional). Save → re-load. New contact persists.
3. Remove the seeded "Plant Manager" row. Save → re-load. Down to 2 contacts.
4. DB sanity:
   ```sql
   select name, role, phone, email, sort_order
     from site_emergency_contacts
     where site_id = (select id from sites where name = 'Houston')
     order by sort_order;
   ```

## Part I — Confirm step warnings

1. Pick a fresh site with no fields filled. Walk to Step 9 (confirm).
2. Should see 6+ warnings: "Street address is missing", "EIN is missing", "NAICS is missing", "Peak employees missing", "Site EHS lead is not set", "No emergency contacts".
3. Go back through the wizard, fill everything. Re-visit Step 9 — warnings list should be empty.
4. For a GB site with no RIDDOR responsible person: warning "RIDDOR requires a named responsible person" appears.

## Part J — Launch

1. Step 9 → click **Launch site**.
2. Redirect to `/dashboard`. Yellow "Finish setup" banner from `/dashboard` page goes away (since `setup_completed_at` is now set).
3. DB sanity:
   ```sql
   select setup_progress, setup_completed_at from sites where name = '<your test>';
   ```
   `setup_progress` has step1..step9 = true; `setup_completed_at` is a recent timestamp.

## Part K — RBAC gates

1. Sign in as `worker@demo.local`. Try `/admin/site-setup/basics` directly — should redirect to `/dashboard` (no `site:configure` permission).
2. Sign in as `ehs@demo.local`. Same URL — should render (ehs_manager gets `site:configure` per Phase 11a grants).
3. Sign in as `admin@demo.local`. Same URL — renders.

## Known edges (deferred to v2)

- Geocoding API helper (Q10 — manual paste only in V1).
- ITA portal API submission (still manual).
- HSE F2508 portal API submission (still manual).
- Cal/OSHA-, MIOSHA-specific extra fields beyond the state-plan flag.
- PSM covered-process registry beyond the yes/no flag.
- Hazard tag → required training derivation (Phase 14+ Templates tie-in).
- Address autocomplete / Google Places integration.
- Site cloning (copy setup from one site to another).
