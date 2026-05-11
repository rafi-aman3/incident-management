# Phase 15 — Job Safety Analysis (§JSA)

**Status:** shipped 2026-05-12 (PR pending) — informed by `docs/superpowers/specs/2026-05-11-v2-phases-14-16-research.md`. Scope landed as written EXCEPT the two Argus wands (`suggest_step_hazards` + `suggest_step_controls`) were pulled forward from v2.1 into this PR per kickoff Q&A direction (2026-05-12). Stricter "I've reviewed these" checkbox gate on Accept added to both wands.
**Goal:** Ship the v2 Job Safety Analysis module per SPEC §JSA: a 4-step authoring wizard, approver-≠-creator approval workflow, drag-reorderable steps, per-step hazards + controls scored on the shared 5×5 matrix, worker per-shift sign-off ledger, and selective step-hazard promotion to the §HZ Hazard Register. Adds two cross-module hooks not in the original spec but surfaced by research: incident → JSA backlink + event-triggered re-review.
**Branch:** `feat/phase-15-jsa` (off `main`, branched from `main` after Phase 14 merges)
**PR target:** `main`
**Hard dep:** Phase 14 must be on `main` first. `jsa_step_hazards` references `hazards(id)` and `hazard_candidates(id)`.
**New deps:** none. (`@dnd-kit` already in `package.json` from Phase 2 Kanban.)
**Schema migration:** one new migration — 5 new tables (`jsas`, `jsa_steps`, `jsa_step_hazards`, `jsa_step_controls`, `jsa_signoffs`) + 1 cross-link table (`jsa_incident_links`) + 5 new permission keys + RLS + `seed_default_roles()` update.

> **What this PR ships:**
> - Five JSA tables per SPEC §JSA.2 + one new `jsa_incident_links` table (SPEC delta from research).
> - Five new permission keys (`jsa:read_site`, `jsa:draft`, `jsa:approve`, `jsa:signoff`, `jsa:promote_step_hazard`) seeded onto the 4 default roles.
> - Five new routes under `app/(app)/jsa/*` per SPEC §JSA.3: list / new (4-step wizard) / detail / edit / perform (worker sign-off).
> - **Three-layer "approver ≠ creator" enforcement** (DB CHECK + server action + UI), mirroring the CAPA owner-≠-verifier pattern that's already shipped.
> - **Worker per-shift sign-off ledger** with `(jsa_id, worker_id, signed_for_session)` unique constraint — research-validated as a competitive differentiator over single-supervisor sign-off.
> - **Selective step-hazard promotion to the §HZ candidate queue** with one-way per-step-hazard semantics.
> - One new sidebar entry **JSA** between **Hazards** (Phase 14) and **Reports**, gated on `jsa:read_site`.
> - **`@dnd-kit` step reorder** on wizard Step 2.
> - **Mobile photo evidence per step / step-hazard** via the existing polymorphic `documents` table — `linked_to='jsa_step'` and `'jsa_step_hazard'` (SPEC delta from research §JSA.R5).
> - **Incident → JSA backlink** via new `jsa_incident_links` table + event-triggered re-review that flips `status` from `approved` → `under_review` when a causal incident is linked (SPEC delta from research §JSA.R5).
> - **Expiry-aware status job** — a daily SQL function call that flips `status` from `approved` → `expired` when `expires_at < today`. Implemented as a `pg_cron` job (extension already enabled by Supabase).

> **Not in this PR (deferred to v2.1 / v3):**
> - **No AI hazard / control suggestion wands** (Argus `suggest_step_hazards`, `suggest_step_controls`) — research-recommended deferral. Reason: AI control suggestions on a safety document need stronger guardrails than CAPA metadata (incorrect PPE could kill someone). The wands are designed at the spec level but built in v2.1 once we've shipped supervisory feedback from this phase.
> - **No permit-to-work execution.** `permits_required text[]` is descriptive metadata only. All 4 competitors (Cority / Intelex / VelocityEHS / EcoOnline) sell a separate PTW module that consumes JSA output; that's a v2+ phase.
> - **No FLRA / FLHA (field-level pre-task) layer.** EcoOnline-distinctive feature where workers re-assess at the actual location/crew/shift after the JSA. Significant new surface; flagged for v2.1.
> - **No parallel residual-risk modelling** (Intelex differentiator — compare control-option scores side-by-side). `computeResidual()` supports it mathematically; UI deferred.
> - **No personnel competency gating** at sign-off (VelocityEHS Control of Work feature). Requires a Training module that doesn't exist yet.
> - **No multilingual JSA body.** EN-only for v2. UCB seed is US + UK English-speaking.
> - **No formal `shifts` table.** `signed_for_session` stays freeform text with a `<datalist>` of `morning`/`afternoon`/`evening`/`night` suggestions; the formal model is v2.5.
> - **No `updateJsa` diffing logic.** Edits to a draft do a full transactional replace per SPEC §JSA.7 — simpler than diffing and the cascade `on delete` makes it cheap.

---

## Why this scope

Research validated the locked SPEC §JSA against OSHA 3071 ("Job Hazard Analysis") and HSE INDG163 ("5 steps to risk assessment"), plus the four major competitors. The core 4-step wizard, approver-≠-creator invariant, per-shift sign-off ledger, and selective candidate-queue promotion are all defensible. Three concrete additions worth landing in this phase rather than deferring (see §Spec deltas below) make the standards-alignment story cleaner and close a feedback loop the research uncovered.

The standards-baseline finding worth flagging in the PR description: **OSHA 3071 only names 3 control levels** (Engineering / Administrative / PPE). Our 5-level model from `lib/risk/types.ts` (Elimination / Substitution / Engineering / Administrative / PPE per ANSI Z10) **exceeds OSHA's published minimum**, not falls short of it. Auditors who probe will see strictness, not laxity.

---

## Pre-flight deps

- **Phase 14 must be merged.** `jsa_step_hazards.hazard_candidate_id` FKs into `hazard_candidates(id)` and `jsa_step_hazards.registered_hazard_id` FKs into `hazards(id)`. Both tables are created by Phase 14.
- **`lib/risk/matrix.ts` + `lib/risk/types.ts`** must be in place (also Phase 14). The wizard Step 3 consumes `computeRisk()` + `computeResidual()` + the `HazardCategory` / `ControlLevel` types.
- **`@dnd-kit/core` + `@dnd-kit/sortable`** already in `package.json` from Phase 2 (CAPA Kanban).
- **`pg_cron`** extension — already enabled on the Supabase project by default.

---

## Spec deltas from research

Three additions to SPEC §JSA that ship with this plan (the SPEC file gets edited in the same commit as the migration):

1. **§JSA.2 + new §JSA.10 — `jsa_incident_links` table + event-triggered re-review.** Mirrors §HZ's `incident_hazard_links` table. When an investigation closes and an incident is linked to a JSA with `link_type='causal'`, the JSA's `status` flips from `approved` → `under_review`. This makes the standards-mandated "review whenever you think it might no longer be valid" (HSE INDG163 Step 5) operational rather than documented.
2. **§JSA.4 / §JSA.9 — expiry clarification.** Update the Decisions Log to make explicit that the 12-month default is a **policy** choice, not a standards mandate. OSHA 3071 and HSE INDG163 both leave the period undefined and require event-triggered review. Add to SPEC: "`expires_at` is overridable per-JSA at approval time" (defaulted to `approved_at + 12 months`, editable down or up).
3. **§JSA.2 + §JSA.4 — explicit non-goal note for permit-to-work.** `permits_required text[]` is descriptive metadata only — the wizard's Step 1 picker IS NOT a permit-issuance workflow. Documented up-front so reviewers don't read it as a half-built PTW module.

A fourth delta (mobile photo evidence per step) is already enabled by the existing polymorphic `documents` table — no spec edit needed, just the new `linked_to` enum values.

---

## Schema migration plan

**File:** `supabase/migrations/20260522120000_phase15_jsa.sql`

### 15.1 Tables (verbatim from SPEC §JSA.2 + the one new cross-link table)

```sql
create table public.jsas (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique not null,
  site_id uuid not null references public.sites(id),
  title text not null,
  job_description text,
  area text,
  performed_by_roles text[] default '{}',
  performed_by_workgroups text[] default '{}',
  frequency text check (frequency in (
    'daily','weekly','monthly','as_needed','one_off','continuous'
  )),
  estimated_duration_minutes integer,
  ppe_required text[] default '{}',
  permits_required text[] default '{}',           -- metadata only; see Spec delta #3
  status text not null default 'draft' check (status in (
    'draft','under_review','approved','expired','archived'
  )),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  expires_at date,                                -- defaults to approved_at + 12mo at approval time
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint jsas_approver_differs_from_creator
    check (approved_by is null or approved_by <> created_by)
);
create index on public.jsas (site_id, status) where deleted_at is null;
create index on public.jsas (expires_at) where status = 'approved';

create table public.jsa_steps (
  id uuid primary key default gen_random_uuid(),
  jsa_id uuid not null references public.jsas(id) on delete cascade,
  sequence integer not null,
  step_description text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (jsa_id, sequence)
);

create table public.jsa_step_hazards (
  id uuid primary key default gen_random_uuid(),
  jsa_step_id uuid not null references public.jsa_steps(id) on delete cascade,
  hazard_description text not null,
  hazard_category text not null check (hazard_category in (
    'physical','chemical','biological','psychosocial',
    'mechanical','electrical','ergonomic','environmental'
  )),
  likelihood text not null check (likelihood in (
    'rare','unlikely','possible','likely','almost_certain'
  )),
  consequence text not null check (consequence in (
    'insignificant','minor','moderate','major','catastrophic'
  )),
  inherent_risk_score text not null,
  residual_risk_score text not null,
  promoted_to_register boolean not null default false,
  hazard_candidate_id uuid references public.hazard_candidates(id),
  registered_hazard_id uuid references public.hazards(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.jsa_step_controls (
  id uuid primary key default gen_random_uuid(),
  jsa_step_hazard_id uuid not null references public.jsa_step_hazards(id) on delete cascade,
  control_level text not null check (control_level in (
    'elimination','substitution','engineering','administrative','ppe'
  )),
  control_description text not null,
  created_at timestamptz not null default now()
);

create table public.jsa_signoffs (
  id uuid primary key default gen_random_uuid(),
  jsa_id uuid not null references public.jsas(id),
  worker_id uuid not null references public.profiles(id),
  signed_at timestamptz not null default now(),
  signed_for_session text,
  notes text,
  unique (jsa_id, worker_id, signed_for_session)
);

-- SPEC delta from research: incident -> JSA backlink + event-triggered re-review
create table public.jsa_incident_links (
  id uuid primary key default gen_random_uuid(),
  jsa_id uuid not null references public.jsas(id),
  incident_id uuid not null references public.incidents(id),
  link_type text not null check (link_type in ('causal','contributing','exposed_but_not_causal')),
  triggered_review boolean not null default false,
  identified_at timestamptz not null default now(),
  identified_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (jsa_id, incident_id)
);
create index on public.jsa_incident_links (jsa_id);
create index on public.jsa_incident_links (incident_id);
```

### 15.2 Ref-code generator

```sql
create or replace function public.generate_jsa_ref_code(p_site_id uuid)
  returns text language plpgsql as $$
declare
  v_site_code text;
  v_year int := extract(year from now());
  v_seq int;
begin
  select coalesce(short_code, substring(name from 1 for 3)) into v_site_code
    from public.sites where id = p_site_id;
  select coalesce(max(cast(split_part(ref_code,'-',4) as int)), 0) + 1 into v_seq
    from public.jsas
    where ref_code like 'JSA-' || upper(v_site_code) || '-' || v_year || '-%';
  return 'JSA-' || upper(v_site_code) || '-' || v_year || '-' || lpad(v_seq::text, 4, '0');
end $$;
```

### 15.3 Expiry cron

```sql
create or replace function public.expire_overdue_jsas()
  returns int language plpgsql security definer as $$
declare
  v_count int;
begin
  with updated as (
    update public.jsas
       set status = 'expired', updated_at = now()
     where status = 'approved' and expires_at < current_date
     returning id
  )
  select count(*) into v_count from updated;
  return v_count;
end $$;

select cron.schedule('jsa-expiry-daily', '15 1 * * *', $$select public.expire_overdue_jsas();$$);
```

(Runs at 01:15 UTC daily. Idempotent — re-running flips no extra rows.)

### 15.4 RLS

Same pattern as §HZ + investigations: site-scoped via `user_can_access_site()`, write actions gated on permission keys. Per-table policies (verbatim in migration):

- **`jsas`**: SELECT for site members; INSERT requires `jsa:draft`; UPDATE requires `jsa:draft` AND `status='draft'` for body edits OR `jsa:approve` for the approval status transition only (action layer enforces the field-level rule, RLS gates table access).
- **`jsa_steps` / `jsa_step_hazards` / `jsa_step_controls`**: read via parent JSA; write via subquery to parent JSA's `site_id`.
- **`jsa_signoffs`**: SELECT for site members; INSERT requires `jsa:signoff` AND `worker_id = auth.uid()` (workers sign for themselves, no proxy sign-off).
- **`jsa_incident_links`**: SELECT for site members; INSERT requires `investigation:lead` on the linked incident's site (the EHS leading the investigation makes the link).

### 15.5 Permissions + role seeds

```sql
insert into public.permissions (key, description, surface) values
  ('jsa:read_site',           'Read JSAs at sites you belong to',  'jsa'),
  ('jsa:draft',               'Create + edit draft JSAs',          'jsa'),
  ('jsa:approve',             'Approve a JSA submitted for review','jsa'),
  ('jsa:signoff',             'Sign off on a JSA before performing the job','jsa'),
  ('jsa:promote_step_hazard', 'Promote a JSA step-hazard to the hazard register candidate queue','jsa')
on conflict (key) do nothing;

-- Default role grants (extending seed_default_roles + backfill)
-- worker:        jsa:read_site, jsa:signoff
-- supervisor:    + jsa:draft
-- ehs_manager:   + jsa:approve, jsa:promote_step_hazard
-- site_admin:    + all of the above (already implicit via wildcard)
```

### 15.6 Documents polymorphic linkage

Add two new values to the `documents.linked_to` enum (existing column):

```sql
alter table public.documents
  drop constraint documents_linked_to_check,
  add constraint documents_linked_to_check check (linked_to in (
    'incident','inspection','capa','asset','site','jsa_step','jsa_step_hazard'
  ));
```

This enables mobile photo evidence per step / per step-hazard per the SPEC delta. No new storage bucket — reuses the existing `documents` private bucket from Phase 4.

---

## Server actions

**File:** `actions/jsa.ts`

```typescript
'use server';
import { z } from 'zod';

export async function createJsaDraft(input)
  // requires jsa:draft
  // Creates jsas + jsa_steps + jsa_step_hazards + jsa_step_controls in a single transaction.
  // Each step-hazard's inherent_risk_score and residual_risk_score are computed server-side
  // via lib/risk/matrix.ts before insert — never trust client-computed values.

export async function updateJsa(id, input)
  // requires jsa:draft AND jsa.status='draft' (action-layer enforced)
  // Full transactional replace of steps/hazards/controls per SPEC §JSA.7.

export async function submitForReview(id)
  // draft -> under_review
  // requires jsa:draft

export async function approveJsa(id, expiresAt?)
  // under_review -> approved
  // requires jsa:approve AND approver != creator (action-layer + DB CHECK)
  // expiresAt defaults to approved_at + 12 months but is overridable per SPEC delta #2
  // Sets approved_by, approved_at, expires_at.

export async function unpublishJsa(id)
  // approved -> draft (re-edit)
  // requires jsa:draft AND original creator OR jsa:approve
  // Clears approved_by, approved_at, expires_at.

export async function archiveJsa(id)
  // any -> archived; requires jsa:draft AND original creator OR jsa:approve

export async function signOffJsa(id, session, notes?)
  // requires jsa:signoff
  // Inserts jsa_signoffs row with worker_id = auth.uid().
  // Unique constraint enforces one sign-off per (jsa, worker, session).

export async function promoteStepHazard(stepHazardId)
  // requires jsa:promote_step_hazard
  // Creates hazard_candidates row with source_type='jsa', source_reference_id=stepHazardId.
  // Flips promoted_to_register=true + sets hazard_candidate_id on the step-hazard.
  // One-way per step-hazard: button hides after invocation regardless of candidate resolution.
```

**File:** `actions/jsa-incident-links.ts`

```typescript
export async function linkJsaToIncident(input)
  // requires investigation:lead on the incident's site
  // Inserts jsa_incident_links row.
  // If link_type='causal' AND jsa.status='approved': flips jsa.status to 'under_review' +
  // sets jsa_incident_links.triggered_review=true.
  // Fires notification to jsa.created_by + jsa.approved_by (if different).
```

**Notification engine touch:** `lib/workflow/notifications.ts` gets a new `notification_kind = 'jsa_review_required'` template: "Incident {incident.ref_code} ({severity}) has been linked to JSA {jsa.ref_code} as a {link_type} factor — review required."

---

## Routes + components

**Routes (per SPEC §JSA.3):**

| Route | Description | Permission |
|---|---|---|
| `app/(app)/jsa/page.tsx` | List with status filter chips (draft / under_review / approved / expired / archived) | `jsa:read_site` |
| `app/(app)/jsa/new/page.tsx` | 4-step wizard. URL slugs: `?step=identity\|steps\|hazards\|approve`. Draft row exists in DB from Step 1 with `status='draft'` (same pattern as the Report Wizard). | `jsa:draft` |
| `app/(app)/jsa/[id]/page.tsx` | Detail (read view). Shows ref_code + status badge + tabs: Overview / Steps / Hazards / Sign-offs / Linked incidents. Promote-to-register buttons inline per step-hazard. | `jsa:read_site` |
| `app/(app)/jsa/[id]/edit/page.tsx` | Edit (drafts only). Forces redirect to detail if `status != 'draft'`. | `jsa:draft` |
| `app/(app)/jsa/[id]/perform/page.tsx` | Worker-facing pre-job view + sign-off button. Disabled if `status != 'approved'`. | `jsa:signoff` |

**Components:**

```
components/jsa/
  jsa-list.tsx                    — list table with status badges + expiry countdown
  jsa-wizard.tsx                  — 4-step container reading ?step= from searchParams
  steps/jsa-step-1-identity.tsx   — title/area/roles/frequency/duration/PPE/permits
  steps/jsa-step-2-steps.tsx      — drag-reorderable list via @dnd-kit/sortable
  steps/jsa-step-3-hazards.tsx    — per-step: add hazards, score on 5×5 matrix,
                                    add controls per hazard. Uses <RiskMatrixHazard>
                                    from Phase 14.
  steps/jsa-step-4-approve.tsx    — approver picker (excludes creator), expiry date,
                                    "Save draft" / "Submit for approval" buttons
  jsa-detail.tsx                  — server component; tabs
  jsa-step-card.tsx               — single step with its hazards/controls + promote button
  jsa-signoff-button.tsx          — worker /perform-page action
  jsa-signoff-list.tsx            — read-only ledger
  jsa-incident-link-modal.tsx     — opened from /investigations/[id]?tab=findings
                                    Picks a JSA + link_type + optional notes
  jsa-photo-evidence.tsx          — wraps existing <DocumentUploader> with
                                    linked_to='jsa_step' or 'jsa_step_hazard'
```

**Sidebar entry:** `components/app-shell/app-sidebar.tsx` gets one new nav item:

```typescript
{ href: '/jsa', label: 'JSA', icon: ClipboardCheck, perm: 'jsa:read_site' }
```

Placed between Hazards (Phase 14) and Reports.

**Investigation tab integration:** `app/(app)/investigations/[id]/page.tsx` (Findings tab) gets a new "Link to JSA" button alongside the existing "Link to hazard register" button shipped in Phase 14. Opens `<JsaIncidentLinkModal>`.

---

## RBAC additions

| Permission key | Default role grants |
|---|---|
| `jsa:read_site` | worker / supervisor / ehs_manager / site_admin |
| `jsa:draft` | supervisor / ehs_manager / site_admin |
| `jsa:approve` | ehs_manager / site_admin |
| `jsa:signoff` | worker / supervisor / ehs_manager / site_admin |
| `jsa:promote_step_hazard` | ehs_manager / site_admin |

`seed_default_roles()` extended; existing orgs backfilled in migration.

The `jsa:approve` action layer further enforces `approver != creator` regardless of role — three-layer pattern (DB CHECK + server action + UI disabled-option in picker).

---

## Argus integration touchpoints

### 15.A1 Page context (existing Phase 9e provider)

`lib/argus/page-context.ts` gets five new route handlers:
- `/jsa` → `{ route: 'jsa.list', counts: { draft, under_review, approved, expired_unaddressed } }`
- `/jsa/new` → `{ route: 'jsa.wizard', step: <slug> }`
- `/jsa/[id]` → `{ route: 'jsa.detail', record: redact({ ref_code, title, status, steps_count, hazards_count, signoff_count, expires_at }) }`
- `/jsa/[id]/edit` → same as detail with `editable: true`
- `/jsa/[id]/perform` → `{ route: 'jsa.perform', record: redact({ ref_code, title, status, has_signed_for_session }) }`

`hasActiveSignal` is true when: `expired_unaddressed > 0` (list) OR `status='under_review'` (detail; an approver action is pending) OR `is_overdue_for_signoff` (perform; computed when worker last signed > 14 days ago).

### 15.A2 Insight tile on `/jsa`

New `<ArgusInsightTile>` mount surface key: `jsa.list`. Idle by default ("Analyse with Argus" button). Returns a paragraph summarizing expiry-overdue JSAs, JSAs flagged for re-review by incident links, and high-risk JSAs (containing S5 step-hazards).

### 15.A3 Deferred — `suggest_step_hazards` + `suggest_step_controls`

**Designed but not built in this phase.** Spec lives in v2.1 backlog. The Phase 9d magic-wand framework already supports new structured-output tools — both surfaces will mount on `<JsaStep3Hazards>` with stricter accept/reject guardrails (require user-typed rationale before Accept) because incorrect PPE recommendations are life-critical. Tool definitions sketched in `docs/superpowers/specs/2026-05-11-v2-phases-14-16-research.md` §Argus integration touchpoints.

No code in this phase. Listed here so the next plan that picks up v2.1 has the design context.

---

## Verification steps

Local boot:

```bash
pnpm install
pnpm db:push
pnpm db:types
pnpm dev
```

**Acceptance checks (manual):**

1. **Wizard end-to-end.** As `supervisor`, `/jsa/new` → Step 1 (title + roles + frequency) → Step 2 (3 steps, drag to reorder) → Step 3 (1-2 hazards per step with controls) → Step 4 (pick `ehs_manager` as approver, submit for approval) → land on `/jsa/[id]` with `status='under_review'`.
2. **Approver ≠ creator.** As the same supervisor, try `approveJsa` via dev console → action rejects. As `ehs_manager`, the approver picker in Step 4 doesn't list the creator (UI), and even crafting a request with `approved_by=created_by` hits the DB CHECK.
3. **Approve + expiry default.** As `ehs_manager`, approve the JSA → `status='approved'`, `expires_at = today + 12 months`. Override `expires_at` to a custom date → persists.
4. **Step reorder via @dnd-kit.** In edit mode (status=draft), drag step #2 above step #1 → sequence numbers update, server-side renumbering on save.
5. **Worker sign-off per shift.** As `worker` on `/jsa/[id]/perform`, pick session=`morning`, sign → row in `jsa_signoffs`. Try to sign again same morning → unique constraint error surfaced with friendly message. Pick `afternoon` → sign succeeds.
6. **Promote step-hazard.** As `ehs_manager` on `/jsa/[id]`, click "Promote to hazard register" next to a step-hazard → row in `hazard_candidates` with `source_type='jsa'`, `source_reference_id=<step_hazard_id>`. Button hides. Convert candidate via Phase 14 flow → back on JSA detail, the row now shows "Already in register: HAZ-… →" instead of the button.
7. **Incident → JSA backlink.** Open a closed investigation → Findings tab → "Link to JSA" → pick a JSA + link_type=causal → notification fires to JSA creator + approver, JSA `status` flips to `under_review`. Re-approve → status returns to `approved`.
8. **Expiry cron.** Manually `select public.expire_overdue_jsas();` after setting a JSA's `expires_at = current_date - 1` → JSA flips to `status='expired'`. Worker on `/perform` sees the sign-off button disabled with "JSA expired — request re-approval" copy.
9. **Mobile photo evidence.** On `/jsa/[id]/edit` Step 2 (or Step 3 per-hazard), drop a JPEG → uploads to `documents` bucket with `linked_to='jsa_step'` or `'jsa_step_hazard'`. Visible on detail page.
10. **RLS.** A worker at Site Houston cannot read a JSA at Site Manchester. A worker at Site Houston CAN read a JSA at Site Houston-Child if their `site_members.include_children=true`.
11. **Re-edit gating.** As `supervisor`, navigate to `/jsa/[id]/edit` for an approved JSA → forced redirect to detail with "JSA is approved — unpublish to edit" banner. Click Unpublish → status reverts to draft → edit page loads.

**Database diagnostic:** `pnpm db:check` shows the 6 new tables + 5 new permission keys.

---

## Out-of-scope (explicit deferrals)

- AI hazard / control suggestion wands (v2.1)
- Permit-to-work execution workflow (v2+)
- FLRA / FLHA layer (v2.1)
- Parallel residual-risk modelling UI (v2.1)
- Personnel competency gating at sign-off (v3, requires Training module)
- Multilingual JSA body (v3)
- Formal `shifts` table (v2.5)
- `updateJsa` diffing (full replace is fine)
- JSA PDF export (no competitor has it standalone; defer)
- Bulk JSA import from CSV
- Approval multi-stage / second approver (consider for v2.5 high-risk JSA tier)

---

## Open questions for kickoff Q&A

1. **JSA wizard route shape.** Going with `/jsa/new?step=identity|steps|hazards|approve` (URL-driven slugs, same pattern as Phase 13 site-setup). Alternative: `/jsa/new/[step]` segmented routes. Slugs win for the same reasons as Phase 13 — direct linking, browser-back-friendly.
2. **Sidebar position.** Default: between **Hazards** and **Reports**. Alternative: nested under Hazards as `/jsa`. Going top-level — JSA is a heavy enough surface to deserve its own entry and the supervisor/worker personas don't think of it as a Hazards sub-feature.
3. **Per-shift session text.** Default: freeform `text` with a `<datalist>` of `morning`/`afternoon`/`evening`/`night`. Alternative: enum. Going freeform — contractors use shift names we don't anticipate (`A-shift`/`night-2`); enum locks us in.
4. **Wizard draft row existence.** Default: `jsas` row exists from Step 1 with `status='draft'` (mirrors Report Wizard). Alternative: client-only state until Step 4. Going DB-from-Step-1 — same rationale as Report Wizard (resume-on-disconnect, partial-progress visibility for the EHS team).
5. **Causal-incident-link auto-flip.** Default: **yes** — `link_type='causal'` flips JSA `status` from `approved` → `under_review`. Override path: re-approve immediately after reviewing. Auditor-defensible: a causal incident invalidates the prior risk assessment of the job.
6. **`updateJsa` full-replace transactional cost.** A JSA with 10 steps × 3 hazards × 3 controls = 100 rows replaced on every save. Acceptable at v1 scale (Manchester JSAs in the seed have ~5 steps). If this becomes a bottleneck post-demo, the migration to diffing is straightforward; not a concern now.
7. **Expiry cron schedule.** Default: 01:15 UTC daily. Alternative: hourly. Going daily — JSAs don't expire mid-shift, and avoiding hourly load on the cron infrastructure matters more than 1-day precision on expiry.
