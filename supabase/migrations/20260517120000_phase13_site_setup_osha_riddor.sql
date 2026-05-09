-- ============================================================================
-- Phase 13 — Site Setup OSHA + RIDDOR alignment
-- ============================================================================
-- Replaces today's thin demo wizard with a real, audit-defensible site record
-- that captures the fields OSHA and RIDDOR actually require:
--
--   * Structured address + lat/long (universal — drives Form 300A, F2508,
--     and the future map-view dashboard).
--   * Jurisdiction: federal OSHA vs state plan (US); HSE vs local authority (GB).
--   * Identifiers: EIN + ITA establishment ID + NAICS + SIC (US); CRN +
--     UK SIC 2007 + HSE establishment number (GB).
--   * Workforce: peak + average employee counts (300A drivers).
--   * Recordkeeping override flag (voluntary recordkeeping for exempt sites).
--   * PSM applicability flag (29 CFR 1910.119).
--   * Applicable OSHA standards (1910/1926/1915/1917/1918/1928).
--   * Hazard profile tags (confined space / hot work / LOTO / silica / lead /
--     asbestos / working at height / manual handling / noise / chemicals).
--   * Site EHS lead pointer + RIDDOR responsible person (GB).
--   * Lifecycle: site_type, operational_status, opened_on, closed_on.
--   * Emergency contacts list (new child table).
--
-- Plus:
--   * Two computed-read SQL functions (`is_ita_required`, `is_partially_exempt`)
--     for derive-at-read recordkeeping logic. Static literal NAICS arrays curated
--     for V1 — Appendix A is voluminous; expand as more industries onboard.
--   * RLS fix on `notification_recipients` (init migration shipped SELECT only;
--     INSERT/UPDATE/DELETE now gated on `site:configure`).
--   * Backfill `sites.street_1 = sites.address` for existing rows so reads
--     don't break and admins re-split on next walkthrough.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Structured address + lat/long
-- ----------------------------------------------------------------------------
alter table sites
  add column street_1         text,
  add column street_2         text,
  add column city             text,
  add column state_or_region  text,
  add column postal_code      text,
  add column latitude         numeric(9, 6),
  add column longitude        numeric(9, 6);

-- Lat/long must be both-set or both-null (no half-state) and within range.
alter table sites
  add constraint sites_latlong_paired
    check ((latitude is null) = (longitude is null)),
  add constraint sites_latlong_range
    check (
      (latitude is null)
      or (latitude between -90 and 90 and longitude between -180 and 180)
    );

-- Per Q6 decision: copy legacy address into street_1 so reads don't break.
-- Admin re-splits during next wizard walkthrough.
update sites set street_1 = address where address is not null and street_1 is null;

-- ----------------------------------------------------------------------------
-- 2. Jurisdiction
-- ----------------------------------------------------------------------------
alter table sites
  add column osha_jurisdiction text
    check (osha_jurisdiction in ('federal', 'state_plan') or osha_jurisdiction is null),
  add column state_plan_code   char(2),
  add column gb_jurisdiction   text
    check (gb_jurisdiction in ('hse', 'local_authority') or gb_jurisdiction is null);

-- State plan code only meaningful when osha_jurisdiction = 'state_plan'.
alter table sites
  add constraint sites_state_plan_pairs_with_jurisdiction
    check (
      osha_jurisdiction is distinct from 'state_plan'
      or state_plan_code is not null
    );

-- ----------------------------------------------------------------------------
-- 3. Identifiers (US + GB)
-- ----------------------------------------------------------------------------
alter table sites
  add column ein                       text,
  add column ita_establishment_id      text,
  add column sic_code                  text,
  add column uk_sic_2007               text,
  add column crn                       text,
  add column hse_establishment_number  text;

-- ----------------------------------------------------------------------------
-- 4. Workforce (300A inputs + override)
-- ----------------------------------------------------------------------------
alter table sites
  add column peak_employees_year       integer
    check (peak_employees_year is null or peak_employees_year >= 0),
  add column avg_employees_year        integer
    check (avg_employees_year is null or avg_employees_year >= 0),
  add column partially_exempt_override boolean not null default false;

-- ----------------------------------------------------------------------------
-- 5. Programs + standards + hazards
-- ----------------------------------------------------------------------------
alter table sites
  add column psm_applicable      boolean not null default false,
  add column applicable_standards text[] not null default '{}',
  add column hazard_tags          text[] not null default '{}';

-- Validate array contents at the DB layer — defense-in-depth alongside Zod.
alter table sites
  add constraint sites_applicable_standards_valid
    check (
      applicable_standards <@ array['1910', '1926', '1915', '1917', '1918', '1928']::text[]
    ),
  add constraint sites_hazard_tags_valid
    check (
      hazard_tags <@ array[
        'confined_space',
        'hot_work',
        'hazardous_energy',
        'respirable_silica',
        'lead',
        'asbestos',
        'working_at_height',
        'manual_handling',
        'noise',
        'chemicals'
      ]::text[]
    );

-- ----------------------------------------------------------------------------
-- 6. Lifecycle
-- ----------------------------------------------------------------------------
alter table sites
  add column site_type           text not null default 'fixed'
    check (site_type in ('fixed', 'mobile', 'office_only')),
  add column operational_status  text not null default 'active'
    check (operational_status in ('active', 'inactive', 'closed')),
  add column opened_on           date,
  add column closed_on           date;

-- closed_on is only valid when operational_status = 'closed'; not strict (admin
-- might un-close a site). Range guard: closed >= opened.
alter table sites
  add constraint sites_closed_after_opened
    check (closed_on is null or opened_on is null or closed_on >= opened_on);

-- ----------------------------------------------------------------------------
-- 7. People
-- ----------------------------------------------------------------------------
alter table sites
  add column site_ehs_lead_id              uuid references profiles(id) on delete set null,
  add column riddor_responsible_person_name text,
  add column riddor_responsible_person_role text;

-- ----------------------------------------------------------------------------
-- 8. Emergency contacts (new child table)
-- ----------------------------------------------------------------------------
create table site_emergency_contacts (
  id          uuid primary key default gen_random_uuid(),
  site_id     uuid not null references sites(id) on delete cascade,
  name        text not null,
  role        text,
  phone       text,
  email       text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  check (phone is not null or email is not null)
);
create trigger site_emergency_contacts_updated
  before update on site_emergency_contacts
  for each row execute function set_updated_at();

create index site_emergency_contacts_site_idx
  on site_emergency_contacts(site_id, sort_order);

alter table site_emergency_contacts enable row level security;

create policy site_emergency_contacts_read on site_emergency_contacts for select to authenticated
  using (user_can_access_site(site_id));

create policy site_emergency_contacts_insert on site_emergency_contacts for insert to authenticated
  with check (has_permission('site:configure', site_id));

create policy site_emergency_contacts_update on site_emergency_contacts for update to authenticated
  using (has_permission('site:configure', site_id));

create policy site_emergency_contacts_delete on site_emergency_contacts for delete to authenticated
  using (has_permission('site:configure', site_id));

-- ----------------------------------------------------------------------------
-- 9. RLS fix on notification_recipients
-- ----------------------------------------------------------------------------
-- Phase 0 init shipped a SELECT-only policy. RLS was enabled but no INSERT /
-- UPDATE / DELETE policies existed, so site setup Step 6 (`saveStep6`)
-- silently 401'd with "new row violates row-level security policy."
-- Fix gates writes on `site:configure` — same perm Phase 11a uses for
-- /admin/sites/[id] edits.
create policy notification_recipients_insert on notification_recipients for insert to authenticated
  with check (has_permission('site:configure', site_id));

create policy notification_recipients_update on notification_recipients for update to authenticated
  using (has_permission('site:configure', site_id));

create policy notification_recipients_delete on notification_recipients for delete to authenticated
  using (has_permission('site:configure', site_id));

-- ----------------------------------------------------------------------------
-- 10. Computed read functions — recordkeeping logic
-- ----------------------------------------------------------------------------
-- These derive ITA-submission and partial-exemption status from NAICS +
-- employee count at read time. Static array literals curated for V1 — the
-- full Appendix A tables run ~150 rows; expand as more industries onboard.
--
-- Sources (cited for future reviewers):
--   * 29 CFR 1904 Subpart B Appendix A (partially-exempt low-hazard NAICS).
--   * 29 CFR 1904.41 Appendix A (ITA submission high-hazard NAICS,
--     20-249-employee tier).
--   * Establishments with 250+ employees in any covered industry submit
--     regardless of NAICS; the function captures that as the first branch.
-- ----------------------------------------------------------------------------

-- High-hazard NAICS (3-digit prefix match — function does substring lookup) —
-- the 20-249-employee tier under 1904.41 Appendix A. Curated representative set.
-- Codes are stored as 3-digit prefixes; the function matches any NAICS that
-- starts with one of these.
create or replace function _phase13_high_hazard_naics_prefixes()
  returns text[] language sql immutable parallel safe as $$
  select array[
    -- Agriculture, forestry, fishing, hunting
    '111', '112', '113', '114', '115',
    -- Mining, quarrying, oil & gas extraction
    '211', '212', '213',
    -- Utilities
    '221',
    -- Construction
    '236', '237', '238',
    -- Manufacturing (selected high-injury subsectors)
    '311', '312', '313', '314', '315', '316', '321', '322', '323', '324',
    '325', '326', '327', '331', '332', '333', '335', '336', '337', '339',
    -- Wholesale trade
    '423', '424',
    -- Retail trade (high-hazard subset)
    '441', '444', '445', '447', '452',
    -- Transportation & warehousing
    '481', '482', '483', '484', '485', '486', '487', '488', '492', '493',
    -- Healthcare (selected — hospitals + nursing care)
    '622', '623',
    -- Accommodation
    '721',
    -- Repair & maintenance
    '811',
    -- Waste management & remediation
    '562'
  ]::text[];
$$;

-- Partially-exempt NAICS (low-hazard) — 1904.2 Appendix A representative set.
create or replace function _phase13_partially_exempt_naics_prefixes()
  returns text[] language sql immutable parallel safe as $$
  select array[
    -- Finance, insurance
    '521', '522', '523', '524', '525',
    -- Real estate
    '531', '532', '533',
    -- Professional, scientific, technical services
    '5411', '5412', '5413', '5414', '5415', '5416', '5417', '5418', '5419',
    -- Management of companies
    '551',
    -- Administrative & support (some subsectors)
    '5611', '5613', '5614', '5615', '5616', '5618', '5619',
    -- Educational services
    '611',
    -- Performing arts, spectator sports (partial)
    '7113', '7114', '7115',
    -- Religious / civic / professional orgs
    '813',
    -- Public administration (selected)
    '921', '922', '923', '924', '925', '926', '927', '928'
  ]::text[];
$$;

-- True if the site is partially exempt from routine 300/300A/301 recordkeeping.
-- Logic per 29 CFR 1904.2:
--   * ≤10 employees at all times during the prior calendar year → exempt.
--   * NAICS in the partially-exempt low-hazard list → exempt.
--   * Otherwise → not exempt.
-- Defined first because is_ita_required references it.
create or replace function is_partially_exempt(p_naics text, p_peak_employees integer)
  returns boolean
  language sql immutable parallel safe as $$
  select case
    when p_peak_employees is not null and p_peak_employees <= 10 then true
    when p_naics is not null
         and exists (
           select 1
             from unnest(_phase13_partially_exempt_naics_prefixes()) as prefix
            where p_naics like prefix || '%'
         )
      then true
    else false
  end;
$$;

-- True if the site must submit Form 300A data via OSHA's ITA portal.
-- Logic per 29 CFR 1904.41:
--   * 250+ employees in any covered industry → required (unless partially exempt).
--   * 20-249 employees in a high-hazard NAICS → required.
--   * Otherwise → not required.
create or replace function is_ita_required(p_naics text, p_peak_employees integer)
  returns boolean
  language sql immutable parallel safe as $$
  select case
    when p_naics is null or p_peak_employees is null then false
    when is_partially_exempt(p_naics, p_peak_employees) then false
    when p_peak_employees >= 250 then true
    when p_peak_employees between 20 and 249
         and exists (
           select 1
             from unnest(_phase13_high_hazard_naics_prefixes()) as prefix
            where p_naics like prefix || '%'
         )
      then true
    else false
  end;
$$;

comment on function is_ita_required(text, integer) is
  'Returns true if the site is required to submit Form 300A via the OSHA ITA portal. '
  'Per 29 CFR 1904.41: 250+ employees in any covered industry, OR 20-249 in a '
  'high-hazard NAICS. Falls through to false when partially exempt under 1904.2.';

comment on function is_partially_exempt(text, integer) is
  'Returns true if the site is partially exempt from routine 300/300A/301 '
  'recordkeeping per 29 CFR 1904.2: ≤10 employees in the prior calendar year, '
  'OR NAICS in the partially-exempt low-hazard list (Subpart B Appendix A).';

-- ----------------------------------------------------------------------------
-- 11. Indexes for common reads
-- ----------------------------------------------------------------------------
create index sites_country_status_idx on sites(country, operational_status)
  where archived_at is null;

create index sites_ehs_lead_idx on sites(site_ehs_lead_id)
  where site_ehs_lead_id is not null;

-- ----------------------------------------------------------------------------
-- 12. Comments — discoverability for future-Claude
-- ----------------------------------------------------------------------------
comment on column sites.latitude is
  'WGS84 latitude in decimal degrees. Paired with longitude (both null or both set). '
  '~11cm precision at numeric(9,6). Plain numeric, not PostGIS — promote when actual '
  'spatial queries land.';
comment on column sites.longitude is
  'WGS84 longitude in decimal degrees. See sites.latitude.';
comment on column sites.osha_jurisdiction is
  'federal | state_plan. When state_plan, sites.state_plan_code names which (e.g. CA, MI, WA).';
comment on column sites.gb_jurisdiction is
  'hse | local_authority. RIDDOR enforcement is split — HSE for high-hazard premises, '
  'local authority for offices / retail / leisure.';
comment on column sites.ein is
  'US Employer Identification Number (NN-NNNNNNN). Required for OSHA ITA submission.';
comment on column sites.ita_establishment_id is
  'Establishment ID assigned by OSHA after ITA registration. Optional pre-registration.';
comment on column sites.partially_exempt_override is
  'Override flag — true when admin opts into voluntary recordkeeping despite '
  'is_partially_exempt(naics, peak_employees) returning true.';
comment on column sites.applicable_standards is
  'Subset of 1910 (General Industry) / 1926 (Construction) / 1915-1918 (Maritime) / '
  '1928 (Agriculture). Drives per-site program/training requirements.';
comment on column sites.hazard_tags is
  'Subset of confined_space / hot_work / hazardous_energy / respirable_silica / '
  'lead / asbestos / working_at_height / manual_handling / noise / chemicals.';
comment on column sites.site_ehs_lead_id is
  'profiles.id of the EHS lead for this site. Nullable column, required by wizard '
  'Step 7 — pre-Phase-13 sites have NULL until admin walks the wizard.';

comment on table site_emergency_contacts is
  'Per-site emergency contacts list (name + role + phone + email). RLS read = '
  'user_can_access_site; writes gated on site:configure permission.';
