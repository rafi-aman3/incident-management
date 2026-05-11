# Phase 14 — Hazard Register (§HZ)

**Status:** drafted 2026-05-11 — informed by `docs/superpowers/specs/2026-05-11-v2-phases-14-16-research.md`
**Goal:** Ship the v2 Hazard Register module per SPEC §HZ: a live, ISO 45001 §6.1.2-aligned inventory of workplace hazards with risk assessments, hierarchy-of-controls, candidate review queue, and incident feedback loop. Refactor the 5×5 risk matrix to `lib/risk/matrix.ts` as the first commit so the new module and the existing incident severity engine share one source of truth.
**Branch:** `feat/phase-14-hazard-register` (off `main`)
**PR target:** `main`
**New deps:** none.
**Schema migration:** one new migration — 5 new tables (`hazards`, `hazard_risk_assessments`, `hazard_controls`, `hazard_candidates`, `incident_hazard_links`) + 5 new permission keys + RLS policies + `seed_default_roles()` update.

> **What this PR ships:**
> - Five new tables per SPEC §HZ.2 + RLS aligned with the existing `incidents` patterns.
> - Five new permission keys (`hazard:read_site`, `hazard:report`, `hazard:manage`, `hazard:close`, `hazard_candidate:review`) granted to the four default seeded roles (`worker` / `supervisor` / `ehs_manager` / `site_admin`).
> - Five new routes under `app/(app)/hazards/*` per SPEC §HZ.4: list / new / detail (4 tabs) / candidate queue / candidate review.
> - One new sidebar entry **Hazards** between **Inspections** and **Reports** (gated on `hazard:read_site`).
> - Four KPI tiles on `/hazards` per SPEC §HZ.8 — including the **PPE-only-control auditor warning** tile.
> - **Shared 5×5 matrix refactor:** new `lib/risk/matrix.ts` + `lib/risk/types.ts` modules. Existing `lib/workflow/severity.ts` becomes a thin adapter re-exporting from `lib/risk/matrix.ts`. Zero behavior change for incidents.
> - One new Argus magic-wand surface `suggest_hazard_controls` on the `convertCandidate` form (SPEC delta from research §HZ.R5).
> - Investigation-tab integration: an "Link to hazard register" action on `/investigations/[id]?tab=findings` writes `incident_hazard_links` rows.
> - Risk-owner auto-notification when an incident is linked to a hazard (SPEC delta from research §HZ.R5).
> - Control review-cadence tracking via new `hazard_controls.next_control_review_at date` column + KPI tile feed (SPEC delta from research §HZ.R5).

> **Not in this PR (deferred to v2.1 / v3 / future polish):**
> - **No bowtie visualization** — competitor differentiator (VelocityEHS / Cority+Salus) parked for v3.
> - **No configurable risk methodology** — locked to the shared 5×5 matrix. Multi-industry methodology config = v2.5.
> - **No HAZID / HAZOP / FMEA structured-analysis methods** — heavy process-industry; out of scope for our personas.
> - **No `suggest_step_hazards` / `suggest_step_controls` wands** — those belong to §JSA Step 3 (Phase 15 + v2.1).
> - **No worker-consultation first-class entity** — `worker_consultation` stays as one of the 8 reassessment triggers, not a separate workflow.
> - **No multi-language hazard text** — EN-only for v2.
> - **No bulk import** of hazards from CSV / Excel — the candidate queue is the only inbound path other than direct `/hazards/new`.
> - **No SDS Manager catalog modal** — that's Phase 16 (combinable with this PR; see §16 plan).

---

## Why this scope

The research doc (`docs/superpowers/specs/2026-05-11-v2-phases-14-16-research.md`) confirmed:
1. The locked SPEC §HZ is ISO 45001-aligned with no structural gaps.
2. All four major competitors (Cority, Intelex, VelocityEHS, EcoOnline) converge on the patterns we already spec'd: centralized register, incident↔register linkage, trackable controls, mobile capture, configurable methodology.
3. Three concrete spec deltas are worth landing in this phase rather than deferring (control review cadence, owner notification, Argus control-suggestion wand) — each is a small, defensible addition.

Phase 14 is the largest of the three v2 phases planned in this batch (14 / 15 / 16) because §HZ owns the canonical hazard data model that §JSA and §SDS-INTEGRATION both consume.

---

## Pre-flight deps

- **None on `main`.** The five tables are entirely new and the `incidents` references are FK-only.
- **One pre-task refactor (`lib/risk/*`)** — must land in the first commit of this branch. See §Refactor section below.
- **Phase 16 (SDS stub) is combinable** — it writes into `hazard_candidates`. If shipping together, the modal + admin card from Phase 16 land in this PR; if shipping separately, Phase 14 ends with a "Manual" candidate-creation path only.

---

## Spec deltas from research

Three additions to SPEC §HZ that ship with this plan (the SPEC file gets edited in the same commit as the migration):

1. **§HZ.2 — `hazard_controls.next_control_review_at date` column** (nullable). Populates the "Overdue reviews" KPI tile alongside `hazard_risk_assessments.next_review_at`. Tile now reads both cadences via `UNION ALL` + `MIN(next_*)` per hazard.
2. **§HZ.6 — risk-owner auto-notification.** When `incident_hazard_links` is inserted, fire a notification to (a) the hazard's `identified_by`, (b) the most recent assessment's `assessor_id` if different, via the existing `lib/workflow/notifications.ts` engine. New `notification_kind = 'hazard_incident_linked'`.
3. **§HZ.6 — new Argus magic-wand `suggest_hazard_controls`.** Mounts on `components/hazards/candidate-review-form.tsx`. Smart-tier Gemini call returns a structured `{ controls: [{ level, description, rationale }] }`. Follows the Phase 9d pattern: zero new tables (reuses `argus_suggestions`), `argus:use` permission gate, Accept/Edit/Reject card.

These three are folded into the per-section task tables below.

---

## Shared risk matrix refactor (must land in commit 1)

**Why first:** every other change in this plan reads from `lib/risk/matrix.ts`. Refactoring after building the hazard UI would force a rewrite. Refactoring before keeps the diff mechanical.

**New files:**

```
lib/risk/types.ts          — TS types only (Likelihood, Consequence, RiskLevel, HazardCategory, ControlLevel)
lib/risk/matrix.ts         — 5×5 matrix + computeRisk() + computeResidual() per SPEC §HZ.3
lib/risk/coords.ts         — adapter mapping integer MatrixCoord ↔ string Likelihood/Consequence
```

**`lib/risk/types.ts`:**

```typescript
export type Likelihood = 'rare'|'unlikely'|'possible'|'likely'|'almost_certain';
export type Consequence = 'insignificant'|'minor'|'moderate'|'major'|'catastrophic';
export type RiskLevel = 'S1'|'S2'|'S3'|'S4'|'S5';

export type HazardCategory =
  | 'physical'|'chemical'|'biological'|'psychosocial'
  | 'mechanical'|'electrical'|'ergonomic'|'environmental';

export type ControlLevel =
  | 'elimination'|'substitution'|'engineering'|'administrative'|'ppe';
```

**`lib/risk/matrix.ts`:** Verbatim from SPEC §HZ.3. Exports `MATRIX`, `computeRisk(l,c)`, `computeResidual(inherent, controlLevels[])`, plus the integer-indexed lookup that the existing severity engine needs.

**`lib/risk/coords.ts`:**

```typescript
import type { Likelihood, Consequence } from './types';

export const LIKELIHOOD_BY_COORD = ['rare','unlikely','possible','likely','almost_certain'] as const;
export const CONSEQUENCE_BY_COORD = ['insignificant','minor','moderate','major','catastrophic'] as const;

export function likelihoodFromCoord(c: 1|2|3|4|5): Likelihood { return LIKELIHOOD_BY_COORD[c-1]; }
export function consequenceFromCoord(c: 1|2|3|4|5): Consequence { return CONSEQUENCE_BY_COORD[c-1]; }
```

**`lib/workflow/severity.ts` rewrite:** keep the public API (`computeSeverity({likelihood, consequence})` returning `SeverityCode`) but delegate internally:

```typescript
import { computeRisk } from '@/lib/risk/matrix';
import { likelihoodFromCoord, consequenceFromCoord } from '@/lib/risk/coords';

export type SeverityCode = 'S1'|'S2'|'S3'|'S4'|'S5';
export type MatrixCoord = 1|2|3|4|5;

export function computeSeverity(input: { likelihood: MatrixCoord; consequence: MatrixCoord }): SeverityCode {
  return computeRisk(
    likelihoodFromCoord(input.likelihood),
    consequenceFromCoord(input.consequence),
  );
}
// LIKELIHOOD_LABELS, CONSEQUENCE_LABELS, SEVERITY_LABELS retained verbatim for existing UI consumers
```

**Consumers verified by `grep` (see audit at branch cut-time):**
- `lib/workflow/finalize-incident.ts` — imports `computeSeverity` only; unaffected
- `components/risk-matrix/risk-matrix.tsx` — imports `computeSeverity` only; unaffected
- `components/argus/argus-magic-wand.tsx` — imports `computeSeverity` only; unaffected

**Acceptance for the refactor commit:** every existing risk-matrix UI on the incident wizard still renders the same colors and severity codes for the same likelihood/consequence selection. Open `/incidents/new` → Step 2 → click each of 25 cells → verify the severity badge matches the pre-refactor mapping. No DB changes in this commit.

**Commit:** `refactor: extract 5×5 matrix to lib/risk for hazard register share`

---

## Schema migration plan

**File:** `supabase/migrations/20260521120000_phase14_hazard_register.sql`

### 14.1 Tables (verbatim from SPEC §HZ.2 + the one delta column)

```sql
-- The live register
create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique not null,
  site_id uuid not null references public.sites(id),
  area text,
  title text not null,
  description text,
  hazard_category text not null check (hazard_category in (
    'physical','chemical','biological','psychosocial',
    'mechanical','electrical','ergonomic','environmental'
  )),
  hazard_source text not null check (hazard_source in (
    'routine_activity','non_routine_activity','past_incident',
    'emergency_situation','contractor_activity','design',
    'change','external_input','inspection','worker_report',
    'jsa','sds_import'
  )),
  status text not null default 'identified' check (status in (
    'identified','under_assessment','controlled','monitoring','closed','superseded'
  )),
  affects_workers text[] default '{}',
  affects_others  text[] default '{}',
  identified_by uuid references public.profiles(id),
  identified_at timestamptz not null default now(),
  identification_method text,
  current_risk_assessment_id uuid,
  source_candidate_id uuid,
  source_jsa_id uuid,
  source_incident_id uuid references public.incidents(id),
  source_sds_id text,
  source_sds_section text,
  superseded_by_hazard_id uuid references public.hazards(id),
  closed_at timestamptz,
  closed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.hazards (site_id, status) where deleted_at is null;
create index on public.hazards (hazard_category) where deleted_at is null;
create index on public.hazards (current_risk_assessment_id);

-- Periodic + event-driven risk assessments
create table public.hazard_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id),
  likelihood text not null check (likelihood in ('rare','unlikely','possible','likely','almost_certain')),
  consequence text not null check (consequence in ('insignificant','minor','moderate','major','catastrophic')),
  inherent_risk_score text not null,
  residual_risk_score text not null,
  trigger_type text not null check (trigger_type in (
    'initial','periodic_review','post_incident','management_of_change',
    'regulatory_change','worker_consultation','audit_finding','sds_revision'
  )),
  triggered_by_incident_id uuid references public.incidents(id),
  rationale text,
  assessor_id uuid not null references public.profiles(id),
  consulted_worker_ids uuid[] default '{}',
  next_review_at date,
  assessed_at timestamptz not null default now(),
  superseded_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.hazard_risk_assessments (hazard_id, assessed_at desc);

alter table public.hazards
  add constraint hazards_current_ra_fk
  foreign key (current_risk_assessment_id) references public.hazard_risk_assessments(id);

-- Controls (with SPEC delta: next_control_review_at)
create table public.hazard_controls (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id),
  control_level text not null check (control_level in (
    'elimination','substitution','engineering','administrative','ppe'
  )),
  control_description text not null,
  effectiveness text not null default 'not_yet_verified' check (effectiveness in (
    'effective','partially_effective','not_yet_verified','ineffective'
  )),
  responsible_party_id uuid references public.profiles(id),
  implemented_at timestamptz,
  last_verified_at timestamptz,
  next_verification_at date,
  next_control_review_at date,          -- SPEC delta from research
  origin text not null default 'from_initial_assessment' check (origin in (
    'pre_existing','from_initial_assessment','from_capa',
    'from_management_of_change','from_jsa','from_sds_section'
  )),
  origin_capa_id uuid,
  origin_jsa_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.hazard_controls (hazard_id) where deleted_at is null;
create index on public.hazard_controls (next_control_review_at)
  where deleted_at is null and next_control_review_at is not null;

-- Candidate review queue
create table public.hazard_candidates (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'sds_import','worker_report','inspection','incident_review',
    'management_of_change','audit_finding','external_advisory','jsa'
  )),
  source_reference_id text,
  site_id uuid references public.sites(id),
  area text,
  proposed_title text not null,
  proposed_category text not null,
  proposed_description text,
  proposed_metadata jsonb default '{}',
  status text not null default 'pending_review' check (status in (
    'pending_review','converted','dismissed','merged'
  )),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  conversion_hazard_id uuid references public.hazards(id),
  merged_into_hazard_id uuid references public.hazards(id),
  dismiss_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.hazard_candidates (status) where status = 'pending_review';
create index on public.hazard_candidates (site_id, status);

-- Incident feedback loop
create table public.incident_hazard_links (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  hazard_id uuid not null references public.hazards(id),
  was_in_register_at_time boolean not null,
  link_type text not null check (link_type in ('causal','contributing','exposed_but_not_causal')),
  triggered_reassessment boolean not null default false,
  identified_at timestamptz not null default now(),
  identified_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (incident_id, hazard_id)
);
create index on public.incident_hazard_links (incident_id);
create index on public.incident_hazard_links (hazard_id);
```

### 14.2 Ref-code generator

```sql
create or replace function public.generate_hazard_ref_code(p_site_id uuid)
  returns text language plpgsql as $$
declare
  v_site_code text;
  v_year int := extract(year from now());
  v_seq int;
begin
  select coalesce(short_code, substring(name from 1 for 3)) into v_site_code
    from public.sites where id = p_site_id;
  select coalesce(max(cast(split_part(ref_code,'-',4) as int)), 0) + 1 into v_seq
    from public.hazards
    where ref_code like 'HAZ-' || upper(v_site_code) || '-' || v_year || '-%';
  return 'HAZ-' || upper(v_site_code) || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $$;
```

### 14.3 RLS

Policies follow the `incidents` pattern via `user_can_access_site(site_id)`:

```sql
alter table public.hazards                  enable row level security;
alter table public.hazard_risk_assessments  enable row level security;
alter table public.hazard_controls          enable row level security;
alter table public.hazard_candidates        enable row level security;
alter table public.incident_hazard_links    enable row level security;

-- hazards: SELECT for site members; INSERT requires hazard:report; UPDATE requires hazard:manage
create policy hazards_select on public.hazards
  for select using (user_can_access_site(site_id));
create policy hazards_insert on public.hazards
  for insert with check (
    user_can_access_site(site_id)
    and user_has_permission(auth.uid(), 'hazard:report', site_id)
  );
create policy hazards_update on public.hazards
  for update using (
    user_can_access_site(site_id)
    and user_has_permission(auth.uid(), 'hazard:manage', site_id)
  );
-- No DELETE policy — soft-delete via deleted_at managed by hazard:close

-- hazard_risk_assessments: read via parent; INSERT requires hazard:manage on parent's site
-- (write policies use a subquery to resolve site_id from hazards)
create policy hazard_ra_select on public.hazard_risk_assessments
  for select using (exists (
    select 1 from public.hazards h
    where h.id = hazard_id and user_can_access_site(h.site_id)
  ));
create policy hazard_ra_insert on public.hazard_risk_assessments
  for insert with check (exists (
    select 1 from public.hazards h
    where h.id = hazard_id
      and user_has_permission(auth.uid(), 'hazard:manage', h.site_id)
  ));

-- hazard_controls + hazard_candidates + incident_hazard_links follow the same pattern
-- (see migration file for verbatim policies; mirrors the per-table site_id-via-parent lookup
--  established in Phase 2 for investigations / capas)
```

### 14.4 Permissions + role seeds

```sql
insert into public.permissions (key, description, surface) values
  ('hazard:read_site',       'Read hazards at sites you belong to', 'hazards'),
  ('hazard:report',          'Report a new hazard at your site',     'hazards'),
  ('hazard:manage',          'Manage assessments + controls',        'hazards'),
  ('hazard:close',           'Close or supersede a hazard',          'hazards'),
  ('hazard_candidate:review','Review candidate queue (convert/dismiss/merge)','hazards')
on conflict (key) do nothing;

-- Default role grants — extend seed_default_roles() to grant these on every new org
-- (worker: read_site only; supervisor: + report; ehs_manager: + manage + candidate:review; site_admin: + close)
```

Existing orgs get the grants via a backfill `insert ... from existing roles ... on conflict do nothing` block in the same migration.

---

## Server actions

**File:** `actions/hazards.ts`

```typescript
'use server';
import { z } from 'zod';
// All actions return ActionResult<T> = { ok: true, data } | { ok: false, error, fieldErrors? }

export async function createHazard(input)         // requires hazard:report
export async function updateHazard(id, input)     // requires hazard:manage
export async function createRiskAssessment(hazardId, input)
                                                  // appends new RA + updates hazards.current_risk_assessment_id
                                                  // requires hazard:manage
export async function addControl(hazardId, input) // requires hazard:manage
export async function updateControl(id, input)    // requires hazard:manage
export async function verifyControl(controlId, effectiveness, notes)
                                                  // sets last_verified_at + next_control_review_at
                                                  // requires hazard:manage
export async function closeHazard(id, reason)     // requires hazard:close
```

**File:** `actions/hazard-candidates.ts`

```typescript
export async function createCandidate(input)      // worker report path + future inbound sources
export async function convertCandidate(candidateId, contextualization)
                                                  // transactional: creates hazard + initial RA + initial controls
                                                  // requires hazard_candidate:review
export async function dismissCandidate(candidateId, reason)
export async function mergeCandidate(candidateId, intoHazardId)
```

**File:** `actions/incident-hazards.ts`

```typescript
export async function linkIncidentToHazard(input)
                                                  // inserts incident_hazard_links row
                                                  // ALSO fires notification (SPEC delta) to hazard.identified_by +
                                                  // current assessment's assessor_id
                                                  // ALSO if link_type='causal' and no recent RA, flips hazard.status
                                                  // to 'under_assessment' (auditor-defensible automatic re-evaluation)
export async function triggerReassessment(hazardId, fromIncidentId)
                                                  // creates new RA with trigger_type='post_incident'
                                                  // sets incident_hazard_links.triggered_reassessment = true
```

**Notification engine touch:** `lib/workflow/notifications.ts` gets a new `notification_kind = 'hazard_incident_linked'` enum value. Template: "Incident {incident.ref_code} ({severity}) has been linked to hazard {hazard.ref_code} as a {link_type} factor."

---

## Routes + components

**Routes (per SPEC §HZ.4):**

| Route | Description | Permission |
|---|---|---|
| `app/(app)/hazards/page.tsx` | List + KPI tiles + filters (site / category / status / risk band) | `hazard:read_site` |
| `app/(app)/hazards/new/page.tsx` | New-hazard form (direct creation by EHS) | `hazard:report` |
| `app/(app)/hazards/[id]/page.tsx` | Detail with 4 tabs (Overview / Assessments / Controls / Linked Incidents) | `hazard:read_site` |
| `app/(app)/hazards/candidates/page.tsx` | Review queue (filterable by source_type) | `hazard_candidate:review` |
| `app/(app)/hazards/candidates/[id]/page.tsx` | Single candidate review form (Convert / Dismiss / Merge) | `hazard_candidate:review` |

**Components (per SPEC §HZ.5 + new shared-matrix-driven pieces):**

```
components/hazards/
  hazard-list.tsx                 — list table with status badges + risk-band chips
  hazard-form.tsx                 — used by both /new and edit; uses <RiskMatrixHazard> for inherent risk
  hazard-detail-tabs.tsx          — server component; tabs Overview / Assessments / Controls / Linked Incidents
  risk-assessment-form.tsx        — appends a new RA row; trigger_type selector; <RiskMatrixHazard>
  controls-section.tsx            — list + add + verify; surfaces next_control_review_at
  candidate-queue.tsx             — list with source-type filter chips
  candidate-review-form.tsx       — Convert (pre-fills hazard form + initial RA + initial controls from
                                    proposed_metadata) / Dismiss (reason) / Merge (hazard picker)
                                    Hosts the suggest_hazard_controls magic-wand mount.
  incident-hazard-link-modal.tsx  — opened from /investigations/[id]?tab=findings
  kpi-tiles.tsx                   — 4 tiles per SPEC §HZ.8

components/risk-matrix/
  risk-matrix-hazard.tsx          — NEW: 5×5 picker for string-named likelihood/consequence
                                    (the existing risk-matrix.tsx stays integer-based for incidents
                                    to avoid a wizard rewrite; the adapter in lib/risk/coords.ts
                                    is the bridge)
```

**Sidebar entry:** `components/app-shell/app-sidebar.tsx` gets one new nav item:

```typescript
{ href: '/hazards', label: 'Hazards', icon: TriangleAlert, perm: 'hazard:read_site' }
```

Placed between Inspections and Reports per the IMS_PLANNING information architecture.

---

## RBAC additions

| Permission key | Default role grants |
|---|---|
| `hazard:read_site` | worker / supervisor / ehs_manager / site_admin |
| `hazard:report` | supervisor / ehs_manager / site_admin |
| `hazard:manage` | ehs_manager / site_admin |
| `hazard:close` | site_admin |
| `hazard_candidate:review` | ehs_manager / site_admin |

`seed_default_roles()` gets updated so new orgs inherit these. Existing orgs are backfilled via the migration's role-grant block.

`lib/auth/can.ts` needs no change — it's permission-string-driven and already polymorphic.

---

## Argus integration touchpoints

### 14.A1 New magic-wand: `suggest_hazard_controls`

Mounts on `components/hazards/candidate-review-form.tsx` and `components/hazards/controls-section.tsx`.

**Tool definition** (`lib/argus/tools/suggest-hazard-controls.ts`, OpenAPI-3.0-subset schema per Phase 9d):

```typescript
{
  name: 'suggest_hazard_controls',
  description: 'Suggest a set of hazard controls following the ISO 45001 hierarchy (elimination → PPE) for a given hazard description and category.',
  parameters: {
    type: 'object',
    properties: {
      controls: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            level: { type: 'string', enum: ['elimination','substitution','engineering','administrative','ppe'] },
            description: { type: 'string', minLength: 10, maxLength: 300 },
            rationale: { type: 'string', minLength: 10, maxLength: 200 }
          },
          required: ['level','description','rationale']
        },
        minItems: 2,
        maxItems: 6
      }
    },
    required: ['controls']
  }
}
```

**Route handler:** `app/api/argus/wand/route.ts` already handles the `suggest_*` family per Phase 9d — add a new switch case for the surface name. **No new route file.**

**System prompt:** `lib/argus/system-prompts/suggest-hazard-controls.md` — instructs the model to (a) prefer higher-tier controls (elimination/substitution/engineering) over PPE, (b) flag if the only achievable control is PPE so the user is forewarned about the auditor warning, (c) cite the hazard category when justifying a control class.

**Cache:** 24h cache keyed by `{ hazard.category, normalized(hazard.title), normalized(hazard.description) }` — same chemical title from two candidates should return the same suggestions instantly.

**RBAC:** existing `argus:use` org-level flag. No new permission key.

**Acceptance:** click "Suggest controls with Argus" on the candidate review form → wand returns 3-5 controls with mixed levels → Accept-all populates the controls draft + flips back to user-editable cards.

### 14.A2 Page context (existing Phase 9e provider)

`lib/argus/page-context.ts` gets four new route handlers for the five hazard routes:
- `/hazards` → page-context: `{ route: 'hazards.list', counts: { open, high_risk_s4_s5, overdue_reviews, ppe_only } }`
- `/hazards/[id]` → `{ route: 'hazards.detail', record: redact({ ref_code, title, category, current_risk, control_count, link_count }) }`
- `/hazards/candidates` → `{ route: 'hazards.candidates', counts: { pending_review_by_source: {...} } }`
- `/hazards/candidates/[id]` → `{ route: 'hazards.candidate.detail', record: redact({...}) }`

Per Phase 9e pattern, each emits a `hasActiveSignal` flag (true when open count > 0, or overdue reviews > 0, or PPE-only count > 0).

### 14.A3 Insight tile on `/hazards`

New `<ArgusInsightTile>` mount surface key: `hazards.list`. Idle by default ("Analyse with Argus" button), reuses `app/api/argus/tile/route.ts` per Phase 9e. Returns a 1-paragraph summary of the overdue-reviews + PPE-only-controls + S4-S5 backlog, surfacing the highest-leverage attention items.

---

## Verification steps

Local boot:

```bash
pnpm install
pnpm db:push          # applies the migration
pnpm db:types         # regenerates supabase/types.ts
pnpm dev
```

**Acceptance checks (manual):**

1. **Refactor smoke test.** Open `/incidents/new` → Step 2 → click all 25 risk-matrix cells → severity badge matches pre-refactor for every cell.
2. **New hazard direct.** As an `ehs_manager`, navigate `/hazards/new` → fill form → submit → land on detail page with `status='under_assessment'`, ref_code `HAZ-<SITE>-2026-0001`.
3. **Initial RA + control.** Add an initial RA (likelihood × consequence → inherent S3) + an engineering control → residual auto-computes to S1.
4. **Candidate convert.** Create a `hazard_candidates` row manually (via Supabase SQL editor for now, since the SDS modal is Phase 16) → load `/hazards/candidates/[id]` → click "Suggest controls with Argus" → Accept → Convert → resulting hazard has the suggested controls pre-populated.
5. **Incident link + notification.** Open an investigation in progress → Findings tab → "Link to hazard register" → pick a hazard → confirm link_type=causal → verify (a) row in `incident_hazard_links`, (b) notification fires to hazard.identified_by, (c) hazard.status flips to `under_assessment` if it was `controlled`/`monitoring`.
6. **KPI tiles.** On `/hazards`, all 4 tiles render with non-zero counts for the seed data. PPE-only-controls tile is **red/warning-styled** per design.
7. **RLS.** A `worker` at Site Houston cannot read a hazard at Site Manchester (verify in browser as that user).
8. **`seed_default_roles()` update.** Create a new org via `/register` → /onboarding → confirm the 4 default roles have the new hazard permissions per the matrix above.

**Database diagnostic:** `pnpm db:check` shows the 5 new tables + permission keys.

---

## Out-of-scope (explicit deferrals)

- Bowtie visualization (v3)
- Configurable risk methodology (v2.5)
- HAZID / HAZOP / FMEA structured methods
- Worker consultation as first-class entity
- Multilingual hazard text (v3)
- Bulk CSV import
- §JSA-driven hazard candidate (lands in Phase 15)
- §SDS-INTEGRATION import modal (lands in Phase 16 — combinable with this PR)
- `suggest_step_hazards` / `suggest_step_controls` Argus wands (lands in Phase 15 v2.1)
- Hazard PDF export (no competitor has it from the register itself; defer)

---

## Open questions for kickoff Q&A

These mirror the format used at the start of Phases 12 and 13 — answer before cutting `feat/phase-14-hazard-register`:

1. **Combine Phase 14 + Phase 16 in one PR?** Research recommends yes (SDS stub is ~300-500 LOC, zero migrations, writes into `hazard_candidates` which only exists after this phase). Pro: candidate queue isn't bare at merge. Con: PR bigger. Defaults to **yes, combined PR** unless overridden.
2. **Migrate existing severity engine consumers to string-named API?** No — the refactor section above keeps `MatrixCoord`-based callers working. Migrating the wizard from integer to string takes more diff than it's worth and risks regressing the shipped incident flow. **Default: keep both APIs.**
3. **Sidebar position for Hazards entry.** Default: **between Inspections and Reports**. Alternative: under Reports as a sub-item. Going with top-level since hazards are operational, not regulatory output.
4. **PPE-only KPI tile color.** Brand purple `#735CDD` or warning amber? Going with **amber** (`oklch(0.7 0.18 60)` from the design token set) — it's an auditor-warning signal, not a brand surface.
5. **`incident_hazard_links` auto-status-flip on causal link.** Default: **yes** — flips `hazard.status` to `under_assessment` if it was `controlled`/`monitoring`. Auditor-defensible: a causal incident invalidates the prior assessment. Override path: the EHS can immediately add a new RA with `trigger_type='post_incident'` and the status auto-progresses back.
