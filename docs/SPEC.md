# EHS Incident Management — Spec

**Status:** Living document
**Source PRD:** v1.0, 2026-05-02, Rafid Fahmid (SDS Manager)
**Last updated:** 2026-05-05

This spec is the single source of truth for what we are building. The PRD is the human-readable narrative; this document is the structured, queryable spec we work against. When the PRD and this file disagree, this file wins after we resolve the conflict here.

**Companion docs:** `docs/design.md` (visual tokens, component recipes) · `docs/ui-flow.md` (page-by-page UI flow, modals, state machines, build priority) · `docs/onboarding.md` (per-role first-run flows, admin setup wizard, sandbox mode, tooltip inventory) · `PLANNING/IMS_PLANNING.md` (the 22-week production roadmap; ours is its demo subset)

---

## 1. Goals & non-goals

### Goals
- A simple, guided workflow for any worker to report an incident from the floor
- Auto-classify severity via a 5×5 risk matrix and route to the correct investigation track
- Structured root cause analysis (5-Why) inside the investigation module
- Track corrective and preventive actions (CAPA) with **independent verification** and closure
- Auto-generate OSHA 300 / 300A / 301 and RIDDOR F2508 reports from captured data
- Fire regulatory notification reminders **at the moment of classification**, not at workflow end

### Non-goals (v1)
- Mobile-native app (responsive web is enough)
- AI-based predictive analytics or trend forecasting
- Integration with external HRIS / payroll systems
- Multi-language support

---

## 2. System architecture

Three workflow modules + one continuous reporting output layer.

| Component | Purpose | Key rule |
|---|---|---|
| **Module 1: Incidents** | Capture, classify, route | All incidents enter here; classification triggers routing |
| **Module 2: Investigation** | Root cause analysis | Only Track A (S1–S2) and Track B (S3) are investigated |
| **Module 3: CAPA** | Correct & prevent | Optional after investigation. **Owner cannot close their own CAPA** |
| **Reports** (output layer) | Regulatory compliance | Continuously generated; not a workflow step |

### Three independent close events
- **Incident closed** — capture + classification complete, incident is routed
- **Investigation closed** — RCA finalized; may or may not trigger CAPA
- **CAPA closed** — action implemented AND independently verified

---

## 3. Incident types (8)

| Type | Definition |
|---|---|
| `injury` | Physical harm to a person (cut, burn, fracture, …) |
| `illness` | Occupational disease/health condition (hearing loss, dermatitis, …) |
| `near_miss` | Event that could have caused harm but did not |
| `property_damage` | Damage to equipment, machinery, facilities |
| `environmental_release` | Spill, leak, emission to air/water/soil |
| `unsafe_condition` | Hazardous situation found (missing guard, exposed wiring) |
| `observation` | General safety observation (positive or negative) |
| `dangerous_occurrence` | Reportable event under RIDDOR (collapse, explosion, …) |

---

## 4. Incident reporting (Module 1) — 3-step wizard

### Step 1 — What happened
- Incident type (8 cards)
- Short title (free text, ≤ 200 chars)
- Date and time of incident
- Site, area, specific location
- Narrative description (≥ 50 words; voice-to-text option deferred to v1.5)
- Attachments (drag-and-drop photos/files; **max 25 MB per file**, common image + PDF MIME types)

### Step 2 — Details (conditional on type)
For **Injury / Illness**:
- Injured person (name, job title, department, supervisor, employment status)
- Body part affected (body-map selector)
- Injury nature and mechanism
- Object/substance that directly caused harm (OSHA 301 Field 17)
- Treatment required (none / first aid / medical / hospitalization)
- **Risk matrix auto-classification** with supervisor override
- OSHA recordability determination (days away, restricted duty, transfer, other)
- PPE worn at time of incident (multi-select)
- Witnesses

For other types, Step 2 carries type-appropriate fields (substance + quantity for environmental, equipment for property damage, dangerous-occurrence type, etc.).

### Step 3 — Review & Submit
Summary view of all entered data. On submit:
1. Severity is computed from risk matrix
2. Track is assigned by routing engine
3. Regulatory notifications are fired (if applicable)
4. Investigation is auto-created if track A/B
5. Status moves `draft` → `classified`

**Implementation note:** Wizard uses **draft row + per-step server actions**, not client-only state. The incident row exists in DB from Step 1 with `status='draft'`; finalize on Step 3 starts the regulatory clock.

### Incident detail — triage modals
After submission, the incident detail screen surfaces three context-aware action modals:
- **Assign** — assign a triage owner (Track B path), records who/when/why
- **Escalate** — escalate to investigation (Track A path), creates the investigation row
- **Close** — close as no-action (Track C path), captures reason

Modal availability is severity-driven: S1/S2 surface **Escalate** by default; S3 surfaces **Assign**; S4/S5 surface **Close**. Each modal writes to `activity_events`.

---

## 5. Investigation module (Module 2)

### Trigger
Auto-created when incident is classified S1, S2, or S3 (Track A or B).

### Kanban columns
1. `pending_assignment` — created, no lead yet
2. `in_progress` — lead actively investigating
3. `awaiting_capa` — RCA done, CAPA recommended/pending
4. `closed` — finalized (with or without CAPA)

### Detail view sections
- **Incident summary** — read-only snapshot of incident data (frozen at investigation creation, so later edits to the incident don't silently rewrite history)
- **Investigation team** — lead + members with role labels (see `investigation_team_members` join table in §10)
- **Evidence** — photos, documents, maintenance logs, SDS sheets
- **Root cause analysis** — 5-Why structured chain. **Why-5 is rendered with a "ROOT CAUSE" badge** to make the conclusion obvious. (`rca_method='5_why'` in v1; field is enum-extensible for Fishbone / TapRoot in v2.)
- **Findings** — free-text narrative
- **Activity timeline** — chronological event log
- **OSHA 301 draft banner** — when the source incident is OSHA-recordable, the page surfaces a sticky "OSHA 301 due in N days" banner with a one-click "Open 301 form" action

### Investigation `due_date`
Investigations get an SLA: Track A → 14 days; Track B → 7 days. Stored on `investigations.due_date`. Surfaced as a yellow chip on the Kanban card when ≤ 3 days remain, red when overdue.

### Close options
- **Close — no CAPA needed** — root cause addressed in-situ or one-off
- **Assign CAPA** — one or more corrective/preventive actions required

---

## 6. CAPA module (Module 3)

### Types
- **Corrective** — fixes the immediate problem (replace worn fitting)
- **Preventive** — prevents recurrence (update PM checklist)

### Lifecycle
1. `created` — title, description, owner, verifier, due date, type assigned
2. `in_progress` — owner implementing; updates `progress_pct` (0–100) as work proceeds
3. `completed` — owner marks done; moves to verification queue
4. `pending_verification` — independent verifier reviews
5. `verified` / `closed` — verifier confirms; CAPA closed

### Verification outcomes (`verification_result` enum)
The verifier picks one of four outcomes when reviewing a completed CAPA:
- **`effective`** — action worked. CAPA → `verified` → `closed`.
- **`partially_effective`** — action helped but residual risk remains. CAPA closes; a new follow-up CAPA is auto-created and linked.
- **`not_effective`** — action did not solve the problem. CAPA → back to `in_progress` with `rejection_reason` populated.
- **`too_early_to_verify`** — implementation needs more time before effectiveness can be judged. Verifier sets `re_verify_at` (date); CAPA stays in `pending_verification`.

The verifier also picks how they verified (`verification_method` enum): `inspection` / `monitoring` / `audit_trend` / `re_interview` / `document_review`.

### CRITICAL RULE
**The CAPA owner cannot close their own CAPA.** An independent verifier must confirm the action was properly implemented.

Enforced at three layers:
1. UI — "Verify Closure" button disabled with tooltip when viewer is owner
2. Server action — rejects request when `owner_id === verifier_id` or session user is owner
3. DB CHECK constraint — `verifier_id IS NULL OR verifier_id <> owner_id`

### Overdue handling
- Daily check at **site-local midnight** (not UTC) — so an overdue CAPA in Sheffield triggers when London passes midnight, not when San Francisco does.
- On the due date: in-app notification + email to owner.
- After **3 calendar days late**: auto-escalate to the EHS Manager for the site.
- Overdue CAPAs surface on the Dashboard "Overdue CAPAs" KPI tile and the Reports module.

### Card fields
- CAPA ID (`CAPA-YYYY-NNNN`)
- Title / description
- Source investigation (linked)
- Type (corrective / preventive)
- Owner (responsible) · Verifier (independent)
- Due date · `progress_pct` (driving the progress bar)
- Status badge (In Progress / Pending Verification / Overdue / Closed)
- (When applicable) `verification_result`, `verification_method`, `rejection_reason`, `re_verify_at`

---

## 7. Reports (continuous output layer)

| Report | Purpose | Rules |
|---|---|---|
| **OSHA 300 Log** | Running log of recordable injuries/illnesses | 13 columns A–M; updated within 7 calendar days; retained 5 years |
| **OSHA 300A Summary** | Annual summary | Posted Feb 1 – Apr 30; totals + hours + TRIR + DART; e-submit by March 2 via ITA |
| **OSHA 301 Report** | Per-incident detail | 18 fields; complete within 7 days |
| **RIDDOR F2508** | UK event-triggered HSE report | Death/specified injury → phone immediate + written 10 days; over-7-day → 15 days; disease on diagnosis |

### OSHA 300 Log columns (A–M)
| Col | Content |
|---|---|
| A | Case number |
| B | Employee name and job title |
| C | Date of injury/illness |
| D | Where the event occurred |
| E | Description of injury, body part, object/substance |
| F | Classification (injury / skin / respiratory / poisoning / hearing loss / other) |
| G | Death |
| H | Days away from work |
| I | Job transfer or restriction |
| J | Other recordable cases |
| K | Number of days away |
| L | Number of restricted/transferred days |
| M | Injury or illness type code |

### Key metrics (auto-calculated)
- **TRIR** = (Recordable Cases × 200,000) / Total Hours Worked
- **DART** = (DART Cases × 200,000) / Total Hours Worked
- **Severity Rate** = (Total Lost Workdays × 200,000) / Total Hours Worked

All three displayed on Dashboard and OSHA 300A. Calculation lives in `lib/format/kpi.ts`.

### OSHA ITA submission format
The Injury Tracking Application accepts **CSV upload, web form, or API** — NOT PDF. Our PDF exports (300A poster, 301 case form) are for paper retention; ITA submission requires us to also generate ITA-format CSV. Establishment ID + NAICS code on each `Site` are mandatory for valid submission.

### RIDDOR-specific fields captured
- Employment status (employee / contractor / self-employed / public)
- Dangerous occurrence type (scaffold collapse, explosion, electrical short, …)
- HSE reference number (after submission)
- Phone-call timestamp + caller (when initial phone notification was made)
- Written-report submission timestamp + RIDDOR online reference

---

## 8. Workflow engine

### 5×5 risk matrix (severity = f(likelihood, consequence))

|  | Insignificant | Minor | Moderate | Major | Catastrophic |
|---|---|---|---|---|---|
| **Almost Certain** | Medium | High | Critical | Critical | Critical |
| **Likely** | Low | Medium | High | Critical | Critical |
| **Possible** | Low | Medium | High | High | Critical |
| **Unlikely** | Low | Low | Medium | High | High |
| **Rare** | Low | Low | Medium | Medium | High |

### Severity → Track mapping

| Severity | Track | Action | Color |
|---|---|---|---|
| **S1 – Critical** | A | Full investigation mandatory | Red |
| **S2 – Major** | A | Full investigation mandatory | Orange |
| **S3 – Moderate** | B | Light investigation | Yellow |
| **S4 – Minor** | C | Log and close | Green |
| **S5 – Insignificant** | C | Auto-close | Gray |

### Type-specific routing overrides
| Type | Override |
|---|---|
| `dangerous_occurrence` | Always Track A (RIDDOR-reportable by definition) |
| `observation` | Almost always Track C (escalate only if hazard identified) |
| `unsafe_condition` | Imminent danger → A; others by risk matrix |
| `near_miss` | High potential (could have been fatal/serious) → A; otherwise Track B minimum |
| `injury` | First-aid only → C; medical → B; hospitalization/amputation/fatality → A |
| `illness` | Confirmed occupational disease → A or B; monitoring only → C |
| `property_damage` | Major equipment → A; minor → B or C |
| `environmental_release` | Reportable quantity → A; minor contained → B or C |

### Supervisor override
The auto-calculated severity can be overridden by a supervisor. The system logs an **immutable audit row** in `severity_overrides`:
- Original severity
- New severity
- Who overrode (`overridden_by`)
- Timestamp
- Reason (required, free text)

The audit trail cannot be edited or deleted. Re-firing notifications is idempotent (skip kinds already present for the incident).

---

## 9. Notification & regulatory triggers

**Critical: notifications fire at the moment of classification, NOT at workflow end.**

| Event | Deadline | Action | Trigger point |
|---|---|---|---|
| OSHA — Fatality | **8 hours** | Immediate phone call to OSHA Area Office | At classification |
| OSHA — Amputation, eye loss, hospitalization | **24 hours** | Phone or online report to OSHA | At classification |
| RIDDOR — Death or specified injury | **Immediate** | Phone to HSE + written F2508 within 10 days | At classification |
| RIDDOR — Over-7-day incapacitation | **15 days** | Written F2508 to HSE | When 7th day confirmed |
| RIDDOR — Occupational disease | **On diagnosis** | Written F2508 to HSE | At classification |
| RIDDOR — Dangerous occurrence | **Immediate** | Phone to HSE + written F2508 within 10 days | At classification |
| CAPA overdue | **On due date** | Email CAPA owner + escalate to EHS manager | Daily check |

### Dashboard banners
When a notification deadline is active, the system displays a prominent banner on both the Dashboard and the relevant Investigation Detail page. Error styling (red left border, light red background) for urgent notifications. Includes a direct action link and a live countdown.

### RIDDOR-specific deadlines (UK only — site country = `GB`)
| Event | Immediate action | Written report |
|---|---|---|
| Death | Phone HSE | F2508 within 10 days |
| Specified injury (see list below) | Phone HSE | F2508 within 10 days |
| Over-7-day incapacitation | — | F2508 within 15 days of accident |
| Occupational disease | — | F2508 on receipt of diagnosis |
| Dangerous occurrence | Phone HSE | F2508 within 10 days |

### RIDDOR specified-injury list (`lib/constants/riddor.ts`)
Per RIDDOR 2013, "specified injuries" trigger immediate phone notification. Canonical list:
- Fracture (other than to fingers, thumbs, toes)
- Amputation (arm, hand, finger, thumb, leg, foot, or toe)
- Permanent loss of sight or reduction of sight
- Crush injury leading to internal organ damage
- Serious burn covering more than 10% of the body, or causing damage to eyes / respiratory system / vital organs
- Scalping requiring hospital treatment
- Loss of consciousness caused by head injury or asphyxia
- Any injury arising from work in an enclosed space leading to hypothermia, heat-induced illness, or requiring resuscitation / 24-hour hospital admission

Stored as a `riddor_specified_injury` enum on `injured_persons` plus a boolean derived flag `riddor_reportable_specified` for routing.

---

## 10. Data model (key entities)

| Entity | Key fields |
|---|---|
| **Incident** | `id, ref_code, title, type, description, occurred_at, site_id, area, location, severity, track, status, reporter_id, osha_recordable, riddor_reportable, is_sandbox boolean, classified_at, closed_at, deleted_at, created_at` |
| **Injured Person** | `incident_id, name, job_title, department, supervisor_id, employment_status, body_parts, injury_nature, mechanism, object_substance, treatment, days_away, days_restricted, fatality, hospitalized, riddor_specified_injury (enum, nullable), date_of_death (nullable)` |
| **Investigation** | `id, incident_id, lead_investigator, status, started_at, due_date, root_cause_summary, findings, rca_method, closed_at, deleted_at, created_at` |
| **Investigation Team Member** | `investigation_id, profile_id, role (lead/member/observer), added_at` (join table — replaces the `team[]` array) |
| **RCA Why** | `investigation_id, level (1–5), question, answer, is_root_cause (computed: level=5 OR explicit flag), created_at` |
| **Evidence** | `id, investigation_id, type, storage_path, file_name, mime_type, size_bytes, uploaded_by, uploaded_at` |
| **CAPA** | `id, ref_code, investigation_id, incident_id, type (corrective/preventive), title, description, owner_id, verifier_id (CHECK ≠ owner_id), due_date, status, progress_pct (0-100), verification_result (enum, nullable), verification_method (enum, nullable), rejection_reason (nullable), re_verify_at (date, nullable), follow_up_capa_id (nullable, set when verification_result='partially_effective'), completed_at, verified_at, closed_at, deleted_at, created_at` |
| **Site** | `id, name, address, country (US/GB), region, timezone, osha_establishment_id (nullable), naics_code (nullable, US sites), setup_completed_at (nullable), setup_progress jsonb` |
| **User / Profile** | `id (= auth.users.id), full_name, email, role, site_id, department, seen_welcome boolean DEFAULT false` |
| **Notification** | `id, kind, incident_id, capa_id, recipient_id, site_id, title, body, deadline_at, acknowledged_at, resolved_at, created_at` (append-only — UPDATE/DELETE revoked) |
| **Notification Recipient** | `id, site_id, notification_kind, recipient_profile_id (nullable), external_email (nullable), CHECK (one of recipient_profile_id or external_email NOT NULL)` (configured in admin Site Setup Wizard Step 6 — see `docs/onboarding.md` §5.7) |
| **HSE Notification Record** | `id, incident_id, phone_called_at, phoned_by, hse_phone_reference, written_submitted_at, riddor_online_reference, created_at` (one per RIDDOR-reportable incident) |
| **Severity Override** | `id, incident_id, original_severity, new_severity, overridden_by, reason, created_at` (immutable — UPDATE/DELETE revoked) |
| **Activity Event** | `id, incident_id?, investigation_id?, capa_id?, actor_id, verb, payload, created_at` |
| **Witness** | `id, incident_id, name, contact, statement` |

### Enums
- `incident_type`: 8 values (above)
- `severity`: `S1, S2, S3, S4, S5`
- `track`: `A, B, C`
- `incident_status`: `draft, submitted, classified, under_investigation, awaiting_capa, closed`
- `investigation_status`: `pending_assignment, in_progress, awaiting_capa, closed`
- `investigation_team_role`: `lead, member, observer`
- `capa_type`: `corrective, preventive`
- `capa_status`: `created, in_progress, completed, pending_verification, verified, closed`
- `verification_result`: `effective, partially_effective, not_effective, too_early_to_verify`
- `verification_method`: `inspection, monitoring, audit_trend, re_interview, document_review`
- `user_role`: `worker, supervisor, ehs_manager, site_admin` (4 roles — see §11; "independent verifier" is a function, not a role)
- `notification_kind`: `osha_8hr, osha_24hr, riddor_immediate, riddor_f2508_10d, riddor_7day, riddor_disease, capa_overdue, capa_escalated, assigned`
- `body_part`: head, neck, chest, abdomen, back, left/right × {arm, hand, leg, foot, eye}, other
- `riddor_specified_injury`: `fracture, amputation, sight_loss, crush_internal, serious_burn, scalping, loss_of_consciousness, enclosed_space_injury` (list per `lib/constants/riddor.ts`)
- `treatment`: `none, first_aid, medical, hospitalization`

### Schema constraints & invariants
1. **CAPA owner ≠ verifier** — DB CHECK constraint: `verifier_id IS NULL OR verifier_id <> owner_id`
2. **Severity-change audit** — DB trigger: any `UPDATE` on `incidents.severity` requires a matching row in `severity_overrides` (same transaction)
3. **Append-only audit tables** — `severity_overrides`, `notifications`, `activity_events` have `UPDATE`/`DELETE` revoked from PUBLIC
4. **Soft-delete** — `incidents`, `investigations`, `capas` use `deleted_at` (timestamptz nullable). All queries filter `WHERE deleted_at IS NULL` by default. Hard-delete is forbidden by retention policy (5 yr OSHA, 3 yr RIDDOR)
5. **Three independent close events** — each entity has its own `closed_at`. Closing a parent does not cascade.

### Type-specific data — design decision
The PRD defines different field sets per incident type (injury vs environmental vs near-miss). Two approaches:
- **(A) Sparse columns on `incidents`** — one wide table, type-irrelevant columns left NULL.
- **(B) Child tables per type** — `injury_details`, `illness_details`, `environmental_details`, etc.

**v1 demo decision:** approach (A) — sparse columns. Lower friction at demo scale. Production (v2) should migrate to (B) per IMS_PLANNING.md §12.2 — query ergonomics and reporting are noticeably better.

---

## 11. Roles & permissions (RLS)

| Role | Primary actions |
|---|---|
| **Worker** | Reports incidents, submits observations, sees own incidents |
| **Supervisor** | Reviews/overrides severity, manages team incidents within site |
| **EHS Manager** | Leads investigations, assigns CAPA, manages regulatory reports for their site |
| **Site Administrator** | Configures sites, users, roles, notification rules; access to everything |

> **"Independent verifier" is a function, not a role** — it's not in the `user_role` enum. Any user (Supervisor, EHS Manager, even another Worker assigned for the case) can be the verifier on a CAPA, provided `verifier_id ≠ owner_id`. This keeps the org chart simple and avoids forcing companies to designate a dedicated verifier headcount. Production (v2) may add an explicit `independent_verifier` role to support sites with strict separation-of-duties policy (see IMS_PLANNING.md §17 #9 — "small sites with 2 or fewer EHS staff may need cross-site verification").

### RLS sketch (per table)
- **`incidents` SELECT** — `site_admin` always; `ehs_manager` / `supervisor` where `site_id = current_site()`; `worker` where `reporter_id = auth.uid()`
- **`incidents` INSERT** — any authenticated user; `reporter_id = auth.uid()`, `site_id = current_site()`
- **`incidents` UPDATE** — `worker` only on own draft (`status='draft'`); `supervisor` on classification fields within site; `ehs_manager`/`site_admin` full
- **`severity_overrides` INSERT** — `supervisor` / `ehs_manager` / `site_admin`; UPDATE/DELETE denied
- **`investigations`** — same SELECT scope as incidents; UPDATE = assignee or `ehs_manager`+
- **`capas` SELECT** — site-scoped; UPDATE = `owner_id = auth.uid()` for execution fields; verification fields require `verifier_id = auth.uid()` AND `owner_id <> auth.uid()`
- **`profiles`** — SELECT same site; UPDATE self or `site_admin`
- **`notifications`** — SELECT where `recipient_id = auth.uid()` OR (`site_id = current_site()` AND `recipient_id IS NULL`)

### Storage buckets
- `incident-attachments` — private; path `<incident_id>/<uuid>-<filename>`
- `investigation-evidence` — private; path `<investigation_id>/<uuid>-<filename>`

Storage RLS joins `storage.objects.name` prefix against the user's incident/investigation visibility.

---

## 12. Screen inventory (8)

| # | Screen | Path |
|---|---|---|
| 1 | Dashboard | `/dashboard` |
| 2 | Incidents list | `/incidents` |
| 3 | Report Incident — Step 1 | `/incidents/new/1` |
| 4 | Report Incident — Step 2 | `/incidents/new/2` (Step 3 = `/3`) |
| 5 | Investigation Kanban | `/investigations` |
| 6 | Investigation Detail | `/investigations/[id]` |
| 7 | CAPA module | `/capa` |
| 8 | Reports | `/reports` |

Plus: incident detail (`/incidents/[id]`), CAPA detail (`/capa/[id]`), per-report views (`/reports/osha-300`, `/reports/osha-300a`, `/reports/osha-301/[incidentId]`, `/reports/riddor-f2508/[incidentId]`).

---

## 13. Design tokens

> See **`docs/design.md`** for the full design system (palette, typography, spacing, components, dark mode, suggestions). This section is a quick-reference summary.

**Inspired by SmartQHSE** — QHSE enterprise aesthetic, recolored around brand purple. Replaces the PRD's §13 SDSM/MUI direction.

| Token | Hex | OKLch |
|---|---|---|
| Primary (brand purple) | `#735CDD` | `oklch(0.554 0.196 285.0)` |
| Brand hover | `#5E47C8` | `oklch(0.475 0.188 285.0)` |
| Brand pressed | `#4A36AE` | `oklch(0.402 0.180 285.0)` |
| Navy (text emphasis only) | `#0A2540` | `oklch(0.215 0.044 252.5)` |
| Foreground | `#191919` | `oklch(0.180 0 0)` |
| Background | `#FFFFFF` | `oklch(1 0 0)` |
| Background (page) | `#F8FAFC` | `oklch(0.984 0.003 247.9)` |
| Border | `#E5E7EB` | `oklch(0.918 0.005 247.9)` |
| Destructive | `#DC2626` | `oklch(0.577 0.245 27.4)` |
| Warning | `#F59E0B` | `oklch(0.753 0.165 70.0)` |
| Success | `#16A34A` | `oklch(0.594 0.158 152.0)` |
| Cyan (info / reserved AI) | `#00D4FF` | `oklch(0.823 0.139 224.0)` |

**Severity palette (EHS-specific):** S1 `#B91C1C` · S2 `#EA580C` · S3 `#F59E0B` · S4 `#16A34A` (uses success green) · S5 `#6B7280`. See `docs/design.md` §2 for OKLch and badge variants.

| Property | Value |
|---|---|
| Primary font | **Inter** (Google) — single typeface, hierarchy via weight 400/500/600/700 |
| UI framework | Tailwind v4 + shadcn/ui (radix-vega style) |
| Card radius | `8px` (`--radius: 0.5rem`) |
| Button radius | `12px` (override of shadcn default) |
| Input radius | `6px` · height `36px` desktop / `44px` mobile |
| Badges | Full pill (`9999px`), 12/500, tinted bg + colored text |
| Alerts (regulatory banner) | Left 4px destructive border + 6%-alpha tint + level-4 shadow |
| Sidebar | 80px collapsed / 240px expanded, white bg, right-border `1px solid #E5E7EB` |

---

## 14. Tech stack (locked)

| Layer | Choice | Notes |
|---|---|---|
| Framework | **Next.js 16.2.4** (App Router, React 19.2.4) | Cache Components, async params, `proxy.ts` |
| UI library | shadcn/ui (radix-vega) | Only `Button` installed at scaffold time |
| Styling | Tailwind v4 (config inline in `globals.css`) | OKLch palette |
| Database | **Supabase** (Postgres) | RLS-driven authorization |
| Auth | **Supabase Auth** | Email magic link or password; 4 roles |
| Storage | **Supabase Storage** | Private buckets with path-prefix RLS |
| Validation | Zod | Per-step schemas for the wizard |
| Forms | `react-hook-form` + Server Actions + `useActionState` | |
| Drag-and-drop | `@dnd-kit/core` + `@dnd-kit/sortable` | Investigation Kanban |
| Charts | `recharts` | TRIR/DART trend, KPI tiles |
| PDF | `@react-pdf/renderer` | OSHA 301 + RIDDOR F2508 export |
| Date handling | `date-fns` | |

---

## 15. Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-04 | Use **shadcn/ui + Tailwind v4** (override PRD §13's MUI v5 stack) | Lighter, plays well with React 19 RSC; visual parity ~95% via token remap |
| 2026-05-04 | Use **Supabase** (Postgres + Auth + Storage) | Fastest path to a "lived-in" demo with persistence, file uploads, multi-role |
| 2026-05-04 | Demo strategy: **all 8 screens, phased depth** | Stakeholders see full vision; each phase ends demo-ready |
| 2026-05-04 | Demo data: **rich seed script** (~30 incidents, 5 investigations, 8 CAPAs, 2 sites, 4 demo users) | Real-feel system out of the box |
| 2026-05-04 | Wizard state: **draft row + per-step server actions** (not client-only) | Survives refresh; regulatory clock starts at finalize, not draft save |
| 2026-05-04 | Workflow engine called from **Server Action**, not DB trigger | Clearer ownership of the regulatory-clock semantics |
| 2026-05-04 | **Adopt SmartQHSE-inspired design system** | QHSE enterprise aesthetic better fits safety-critical software than the PRD's SDSM/MUI direction. Inter has tabular numerals (matters for OSHA 300 Log) and is already loaded in the scaffold. Full design spec in `docs/design.md`. Severity/track/status palettes added on top for EHS specificity. |
| 2026-05-04 | **Brand color: purple `#735CDD`** (overrides initial teal placeholder) | User-provided brand color. Required splitting "success" off the brand into a dedicated green `#16A34A` since purple cannot carry "safe outcome" semantics. S4 (Minor severity) and Track C ("Log & close") now use success green. |
| 2026-05-05 | **Reconciled `docs/SPEC.md` against `PLANNING/IMS_PLANNING.md`** (which was committed to main earlier) | Adopted: Severity Rate KPI, CAPA `verification_result` + `verification_method` enums, CAPA reject path with `rejection_reason` + `re_verify_at`, `progress_pct` field, soft-delete on incidents/investigations/CAPAs, `osha_establishment_id` + `naics_code` on Site, investigation `due_date`, `hse_notification_records` table, `investigation_team_members` join table, ROOT CAUSE marker on Why-5, OSHA 301 draft banner, Assign/Escalate/Close triage modals, RIDDOR specified-injury list, append-only audit constraints, severity-change DB trigger, type-tables-vs-sparse-columns decision documented (sparse for demo, tables for v2). |
| 2026-05-05 | **Independent verifier is a function, not a 5th role** (deviates from IMS_PLANNING §3) | Keeps `user_role` enum at 4. Verification is enforced by `owner_id ≠ verifier_id` at DB + service + UI layers. v2 may add an explicit role to support strict separation-of-duties policies. |
| 2026-05-05 | **Type-specific data: sparse columns on `incidents` for v1 demo** (defers IMS_PLANNING §12.2 child-tables recommendation to v2) | Lower friction at demo scale; production migration to per-type tables planned for v2 for query/reporting ergonomics. |
| 2026-05-05 | **Use `severity_overrides` (incident-severity-specific) for v1**; polymorphic `override_log` is a v2 option | Severity is the only override surface in v1. Polymorphic shape is over-engineering until we add more overridable fields. |
| 2026-05-05 | **Site names ("Houston", "Manchester") are placeholders** | Will replace with the customer's actual site names before stakeholder demo. IMS_PLANNING uses "Cleveland Plant" + "Sheffield Site" as illustrative names. Either is fine — the schema is name-agnostic. |
| 2026-05-05 | **Production roadmap lives in `PLANNING/IMS_PLANNING.md` §16** (22 weeks, 7 phases) | Our `lets-plan-this-tidy-pillow.md` umbrella + per-phase plan files are the **stakeholder-demo roadmap** (~2 weeks, 4 phases) — a scoped subset, not a replacement. Both coexist; the demo plan trades production hardening (Phase 6 ITA submission, Phase 7 hardening/WCAG/retention) for speed. **Superseded 2026-05-05 (later same day) — see scope-expansion entry below.** |
| 2026-05-05 | **MUI v5 is fully removed in favor of shadcn/ui** | Reaffirms the 2026-05-04 design-system decision after IMS_PLANNING.md §4.3 + §13 still referenced MUI. IMS_PLANNING is now stale on UI/font for our build; `docs/design.md` is the canonical source. |
| 2026-05-05 | **Onboarding spec adopted** — see `docs/onboarding.md` | Two patterns: (1) one-time welcome card per role on first login; (2) always-on help (tooltips, empty states, help drawer). Plus the 7-step Site Setup Wizard for admin (real wizard, not tour overlays). Sandbox mode on Report Wizard. Demo-mode "Reset" affordances. Schema delta: `profiles.seen_welcome`, `sites.setup_completed_at`, `sites.setup_progress`, `incidents.is_sandbox`, new table `notification_recipients`. |
| 2026-05-05 | **No tour-overlay library** (rejected react-joyride / shepherd / intro.js) | Tour overlays get skipped instantly and feel condescending. The UI must be self-explanatory via labels, tooltips, useful empty states, and the help drawer. Setup work goes through real multi-step **wizards** (Site Setup, Report Wizard) with dedicated routes, not floating cards on top of the dashboard. |
| 2026-05-05 | **Sandbox incidents (`is_sandbox=true`) are excluded from KPIs, dashboards, reports, investigations, CAPAs** | Lets workers/stakeholders practice the wizard without polluting the demo dataset. Engine layers (severity, routing, notifications) all skip sandbox rows. Auto-deleted after 7 days via cron. RLS update: sandbox rows visible only to reporter + site_admin. |
| 2026-05-05 | **Demo file storage stays on Supabase Storage** | IMS_PLANNING.md §15.3 now specifies "v1 stores files on local disk, no cloud bucket" — that's the production v1, not our demo. Our demo uses Supabase Storage with private buckets + path-prefix RLS. Migration to local-disk-with-stable-URL pattern deferred to v2. |
| 2026-05-05 | **V1 demo scope expanded to all 5 modules** — Incidents, Templates, Inspections, Resources (Assets + Documents), Planner. Supersedes the earlier same-day "stakeholder-demo subset (~2 weeks, 4 phases)" framing. | Stakeholder requirement: demo the whole product surface, not a single-module slice. CLAUDE.md was already written this way; the older `plans/00-foundation.md` "demo subset" framing and the SPEC §15 entry above are now stale. **Phase split TBD** — `plans/00-foundation.md` is shipped as-is (Phase 0 done 2026-05-05, PR #1); Phases 1+ to be re-cut to cover all five modules. `docs/ui-flow.md` §13 build-priority table flagged for revision pending the new split. |
| 2026-05-06 | **V1 phase split agreed: 6 phases after Phase 0, ~6.5 weeks total** — vertical slicing, demo-ready at end of every phase, full depth, single dev (user). Order: Phase 1 Incidents capture/classify/route → Phase 2 Investigation+CAPA+Reports → Phase 3 Templates → Phase 4 Inspections → Phase 5 Resources (Assets+Documents) → Phase 6 Planner. | Incidents gets two phases because it's the largest module by far (matching IMS_PLANNING's Phases 1–6 collapsed). Vertical preserves "module fully done before next." `/admin/users` role-permission editor UI deferred to post-v1 (RBAC tables shipped in Phase 0; default roles editable via DB/seed in v1). Industry presets seeded thoroughly for manufacturing + warehouse + office; one placeholder template each for healthcare / education / construction / lab. Documents file uploads land in two stages: thin `incident-attachments` write in Phase 1, full Documents library UI in Phase 5. Site Setup Wizard moves to Phase 1 (was P3 in old ui-flow §13) so admin onboarding and the worker reporting flow demo together. See `docs/ui-flow.md` §13 (rewritten) and `plans/0[1-6]-*.md` (written at start of each phase). **Superseded same day for the 3+4 boundary — see two entries below.** |
| 2026-05-06 | **Phase 3 + 4 collapsed into a single Phase 3: Templates + Inspections** | The editor and the inspection runner share their full item-type rendering surface (sections / categories / questions / signature / media / etc., reusable answer_sets, validation walking, mobile layout). Splitting them into two phases meant rebuilding the same components twice. Studied the production reference at `/Users/rafiaman/Desktop/office-projects/workplace-safety-frontend` (SafetyCulture-shaped) — they ship templates + inspections together for the same reason. Phase 3 now ~2.5 weeks instead of 1+1.5. Phase numbering shifts: old-Phase-5 Resources → new Phase 4; old-Phase-6 Planner → new Phase 5. `docs/ui-flow.md` §13 phase table rewritten to match. Plan: `plans/03-templates.md`. |
| 2026-05-06 | **Phase 3 data model: SafetyCulture-shaped flat-items-with-`parent_id`, JSONB on `template_versions`** | Adopts the data shape from the workplace-safety-frontend reference verbatim — flat `items[]` array where each item has `item_id`, optional `parent_id`, `type`, `label`, `options`; reusable `answer_sets` keyed in `template_data`; separate `header[]` for title-page items. Lets us seed real SafetyCulture-library JSON payloads as system presets without translation. Stored as JSONB on `template_versions.{header,items,template_data}` rather than normalized item rows — keeps version-immutability as a single row revision. Inspection answers also stored JSONB on `inspections.{header_responses,answers}`, keyed by `item_id`, with a normalized `inspection_uploads` table for photo/signature files (path-prefix RLS on Supabase Storage bucket `inspection-uploads`). MVP supports 8 editable item types (`section`, `category`, `information`, `question`, `text`, `datetime`, `signature`, `media`); deferred types render as a read-only fallback in the runner and don't appear in the editor's Add picker. Trade-off: harder to query "all inspections that failed item X" — acceptable for v1, may add JSONB index or normalized answers table in v2. |
| 2026-05-06 | **No real SafetyCulture API integration; library is curated static seed** | The user provided sample SafetyCulture API responses (`/api/v1/templates/library` + per-template detail) as the reference data shape. We seed ~14 templates curated across our 7 industries directly into our `templates` table as system presets (`org_id IS NULL`, `is_system_preset=true`), one published `template_versions` row each. Industries from SC kebab-case (`health-care`) map to our enum (`healthcare`) via `lib/templates/industry-map.ts`. Real API proxy / live import deferred to v2. |
| 2026-05-06 | **Recurring-inspection auto-creation cron deferred** | PRD §15.5.4 calls for a daily cron that materializes `inspections` rows from active `template_assignments` based on `schedule_kind`. Phase 3 lands the schedule columns on the assignment row but does NOT ship the cron handler — inspections are started manually via the `<StartInspectionDialog>` picker (matches the SafetyCulture reference's behavior; their schedules don't auto-create runs either). The cron is targeted for a v2 "production hardening" pass alongside the Vercel Cron handlers shipped in Phase 2. |
| 2026-05-06 | **Phase 4 ships flat documents — no versioning, approvals, e-signatures, forced ack, or distribution audit-trail viz** | IMS_PLANNING.md §15.4 specifies a full Document Control module (Draft → Review → Approved → Published → Under-revision → Retired life cycle, semver versions, `DocumentApproval` workflow rows, 21 CFR Part 11 e-signatures, `DocumentAcknowledgement` blocking work screens, distribution-read audit). All of that is **deferred to Phase 7 of the IMS_PLANNING 15-phase roadmap (v2)**. Phase 4's `documents` table is flat: replace-file overwrites the storage object in place + bumps `updated_at`; archive is a metadata flag (`archived_at` + `archived_reason`); audit signal is the `document.replaced` / `document.archived` activity event. Trade-off accepted: no version-pinning of CAPAs to a specific document revision until v2. |
| 2026-05-06 | **Phase 4 keeps `incident_attachments` + `investigation_evidence` as legacy back-compat tables; new uploads land via the documents library and the legacy widgets** | Two file-upload paths coexist post-Phase-4: (1) legacy direct-upload from the wizard / investigation evidence drawer writes `incident_attachments` / `investigation_evidence` rows + uploads into the matching bucket; (2) the new `<DocumentLinkPicker>` writes `documents` + `document_links` rows + uploads into the `documents` bucket. Both surface side-by-side on the detail pages — existing list views render unchanged. **No data migration of the legacy rows in this phase.** The `attachments_unified` view (when added) UNIONs both, used by activity feeds + audit exports. Cleanup of the legacy tables tracked as a v1.5 task. |
| 2026-05-06 | **Phase 4 polymorphic link parent enum spans 7 types: incident · investigation · capa · asset · site · inspection · finding** | One `document_links` table with `parent_type document_link_parent` + `parent_id uuid` typed-pair. Adding a parent type is a 3-step change: (1) add the enum value, (2) add a clause to `can_edit_parent()` so the link / unlink RPCs can dispatch perms, (3) add a column to `activity_events` so `org_id_of_event` can resolve the org for RLS. `inspection` and `finding` are deliberately included — even though Phase 3's `inspection_uploads` already exists for runner-time photo / signature uploads, the v1 `<DocumentLinkPicker>` lets a manager attach a library document (printable form, training cert, audit report) to an inspection or a finding without re-uploading. The runner keeps writing to `inspection_uploads`; library links are an additive layer. |
| 2026-05-06 | **Phase 4 deferred: SDS Manager API integration, asset PM cron, asset hero photo as denormalized field** | (1) **SDS Manager API** — chemical incidents already get a one-click SDS attach via the picker filtered to `type=sds`, but the system does NOT auto-suggest the SDS from a real SDS Manager library lookup. v1 ships dummy seeded SDS PDFs in the `documents` bucket. The auto-suggest integration lands in v2. (2) **Asset PM cron** — `assets.next_pm_at` is surfaced in the list (red when overdue) and on the asset detail, but there is NO cron that auto-creates inspections / notifications from the date. Same family as the recurring-inspection cron deferred from Phase 3. (3) **Asset hero photo** — uses `document_links` with `link_role='photo'` rather than a denormalized `assets.photo_url` field, to keep one source of truth. The asset detail Documents tab surfaces the photo; a future denorm could land if hot-loop list rendering needs it. |
| 2026-05-06 | **Phase 5 ships an app-level aggregator over 6 sources, NOT a Postgres union view** | `lib/planner/aggregate.ts` runs up to 6 parallel `supabase.from(...)` queries (one per source kind), merged + sorted in TS. Each query reads through the existing per-table RLS — the caller-provided `siteIds` is an extra `.in()` filter on top, so per-source perm filtering is "free." Trade-off: N=6 round trips per render, vs a single union-view query. For seed-scale data (dozens of events per month) this stays well under any cache budget, and each fetcher swallows its own error so one source failing never blanks the calendar. v2 may add a `planner_events` materialized view if dashboard widgets need the same shape; until then the JS aggregator is easier to extend. |
| 2026-05-06 | **Phase 5 is read-only by design — no event creation, drag-to-reschedule, iCal export, conflict detection, or team-lane grouping** | The planner is observability over the existing 4 modules; every dated artefact already has a create flow at its source (Report Wizard, CAPA-create modal, asset edit, inspection runner) and we don't duplicate it here. Drag-to-reschedule would require write-back across 4 different tables (`incidents.occurred_at`, `capas.due_date`, `assets.next_pm_at`, `investigations.due_date`) plus per-source permission gating — all deferred to v2 alongside iCal / Google Calendar export, conflict detection, printable view, mobile-optimized week layout, and the recurring-inspection materialization that would let unstarted scheduled inspections surface as a "future" lane. URL filter shape is verbose (`?incident=0&capa_due=0` — absence = enabled) so each chip self-documents in shared links. |

| 2026-05-10 | **Phase 9 — Argus AI assistant; AI inverted from "permanent non-goal" to flagship pillar** | `PLANNING/IMS_PLANNING.md` §17.8 + §2.4.3 declared AI a permanent non-goal ("competitors compete on AI; we compete on filing forms correctly"). User direction reframes AI as the headline product surface — voice copilot, AI investigator, magic-wands across decision points. New hard rule replaces the non-goal: **Argus is assistive, not authoritative** — never auto-classifies severity, auto-routes incidents, auto-closes CAPAs, or files OSHA/RIDDOR. Every load-bearing decision keeps a named human signature. Foundation (Phase 9a, this PR): `@anthropic-ai/sdk` + env vars + `lib/argus/` library + SSE route handler at `app/api/argus/stream` + empty `<ArgusSidePanel>` mounted from topbar (gated by org-flag `argus_enabled` AND user perm `argus:use`) + new audit table `argus_suggestions` + `activity_events.actor_kind` enum (`'human' \| 'argus'`) + `incidents.stop_work*` columns. Voice = browser Web Speech API (zero infra; text-input fallback for Firefox). Stop-work = boolean flag on incidents (no new entity). Per-org daily token budget + per-user rate limit enforced server-side. PII redactor strips known names + emails + phone + UK NI before requests; not a guarantee, defence-in-depth on top of Anthropic's no-training policy. Phase 9 splits into 9a foundation (this PR) → 9b Copilot in Report Wizard → 9c AI Investigator on Investigation detail → 9d magic-wands → 9e global panel + Dashboard insight tiles. See `plans/09-argus-ai-assistant.md` for the full sub-phase plan and §16 below for the Argus runtime architecture. |

| 2026-05-10 | **Phase 9d — LLM provider pivot Anthropic → Gemini behind a thin abstraction** | Phase 9d bundles two changes in one PR: (1) introduces `lib/argus/llm/` provider abstraction (`generateStructured` + `streamText` interface, JSONSchema → OpenAPI-3.0-subset translator, Gemini adapter as v1 implementation) and rips `@anthropic-ai/sdk` out of the codebase entirely. `MODEL_HAIKU/SONNET/OPUS` become `TIER_FAST/SMART` (fast → `gemini-2.5-flash`, smart → `gemini-2.5-pro`). All three shipped route handlers (9a ping, 9b Copilot agentic loop, 9c Investigator forced-tool) rewrite onto the abstraction; SSE wire formats preserved end-to-end. Anthropic's `tool_choice: { type: 'tool', name }` becomes Gemini's `toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames }`. Existing 5 tools migrated `input_schema → parameters`. (2) Adds 5 magic-wand surfaces: risk-matrix on Step 2, finding→incident severity (informational), CAPA verification method, CAPA Create Type+Title (when modal opened from investigation), and OSHA-301 + RIDDOR-F2508 reportability (read-only, auto-load with 24h cache keyed on `incident.updated_at`). Reasons for the provider pivot: (a) cost — Gemini Flash is ~5× cheaper per output token than Haiku; (b) the user's existing infra has Gemini available; (c) future provider flexibility (interface ready for OpenAI / others). Trade-off: Anthropic's free ephemeral prompt caching is gone — Gemini's `cachedContents` has a 32K-token minimum that doesn't fit our ~1–2K system prompts; revisit when payloads grow. Default org daily token budget bumped 5M → 10M to absorb the per-call overhead; net cost still lower thanks to Flash pricing. Env: `ANTHROPIC_API_KEY` → `GEMINI_API_KEY`. The "assistive, not authoritative" 2026-05-10 hard rule is unaffected. The `argus_suggestions.model` column accepts any provider's concrete model id string — old `claude-*` rows stay valid for audit; new rows store `gemini-2.5-flash` / `gemini-2.5-pro`. Adding OpenAI later is a single new adapter file plus an `ARGUS_PROVIDER` env switch. The Reportability surface was originally planned for the OSHA-300 log table — moved to the per-incident OSHA-301 / RIDDOR-F2508 pages because the 13-column print-friendly log row would balloon with an inline pane. See `plans/09d-argus-magic-wands.md` for the full plan. |

| 2026-05-11 | **§SDS-INTEGRATION adopted — SDS Manager stub (v2 spec; build deferred, depends on §HZ)** | The SDS Manager is a separate sub-company application with no API credentials yet. Rather than wait for the real integration, spec a **demo-grade stub** that lights up the integration story end-to-end: Admin → Integrations card with configurable external link (`NEXT_PUBLIC_SDS_MANAGER_URL`), plus an "Import from SDS Manager" button on `/hazards/candidates` that opens a modal listing 6 hardcoded chemicals (Toluene · Sulfuric Acid · Hydraulic Oil · Isopropanol · Acetone · Sodium Hydroxide). Multi-select → batch creates N `hazard_candidates` rows per SDS (one per GHS H-statement) with `source_type='sds_import'` and `proposed_metadata` carrying the SDS reference + suggested controls for the EHS Manager to apply on conversion. Hardcoded catalog lives at `lib/sds/dummy-catalog.ts` — swap-in for a real API call when credentials arrive, candidate creation flow stays identical. No `sds_records` or `sds_chemical_uses` tables in v1 — candidate queue does double duty; lifecycle (revisions, usage tracking) deferred to a v2.5 / real-API phase. Surface lives at `/admin/integrations` (not `/settings`) — integrations are org-scoped, not user account preferences (Phase 8 `/settings` is personal). **Depends on §HZ shipping first** — `hazard_candidates` is the target write surface. **Build status: spec only — implementation queued after §HZ in the v2 surface scoping pass.** |
| 2026-05-11 | **§JSA Job Safety Analysis adopted as a standalone module (v2 spec; build deferred)** | Pre-job structured analysis per OSHA 3071 / HSE INDG163. Job → ordered steps → per-step hazards (sharing §HZ's 5×5 matrix via `lib/risk/matrix.ts`) → per-hazard controls → approver sign-off → worker pre-job sign-off. 5 new tables (`jsas`, `jsa_steps`, `jsa_step_hazards`, `jsa_step_controls`, `jsa_signoffs`). JSA is **both a methodology and a document**: produces hazards proactively + workers acknowledge before performing the job. **Step-hazards promote to §HZ selectively** — EHS Manager picks which ones earn a permanent register entry via the `hazard_candidates` queue with `source_type='jsa'` + back-pointer `jsa_step_hazards.registered_hazard_id`. **Approver ≠ creator** (separation of duties, same invariant pattern as CAPA owner ≠ verifier). Default 12-month expiry; expired JSAs require re-approval before reuse. Worker `jsa_signoffs` unique per `(jsa_id, worker_id, signed_for_session)` so the same worker re-signs per shift session, not once-forever. 4-step wizard (Identity → Steps → Hazards & Controls → Review & Approve), `@dnd-kit` for step reorder, status lifecycle `draft → under_review → approved → expired → archived`. PPE + permits stored as `text[]`; `performed_by_roles` / `performed_by_workgroups` also `text[]` — formal workgroups table deferred to v2 (premature abstraction). **Depends on §HZ shipping first** — both `hazard_candidates(id)` and `hazards(id)` are referenced by `jsa_step_hazards.{hazard_candidate_id,registered_hazard_id}`. **Build status: spec only — implementation queued after §HZ in the v2 surface scoping pass.** |
| 2026-05-12 | **Phase 15 — JSA built (§JSA)** | Migration `20260522120000_phase15_jsa.sql` ships 5 §JSA-spec tables (`jsas`, `jsa_steps`, `jsa_step_hazards`, `jsa_step_controls`, `jsa_signoffs`) + the new `jsa_incident_links` table (SPEC delta — mirrors §HZ's incident_hazard_links) + 5 new permission keys (`jsa:read_site`, `jsa:draft`, `jsa:approve`, `jsa:signoff`, `jsa:promote_step_hazard`) + `seed_default_roles()` patched + RLS + `notification_kind='jsa_review_required'` enum value + `document_link_parent` extended with `'jsa_step'` and `'jsa_step_hazard'` for mobile photo evidence per the existing polymorphic `documents` table. Three SPEC deltas land: (1) `jsa_incident_links` causal-link auto-flip from `approved → under_review` (auditor-defensible: a causal incident invalidates the prior risk assessment); (2) 12-month default `expires_at` clarified as **policy**, not standards-mandated — overridable per JSA at approval time; (3) `permits_required text[]` explicit non-goal as descriptive metadata only (not a permit-issuance workflow — all 4 competitors sell PTW as a separate module). `expire_overdue_jsas()` SQL function + defensive `pg_cron` schedule at 01:15 UTC daily (silently skipped if pg_cron not enabled). **Two Argus wands pulled forward from v2.1 into this PR** per kickoff Q&A: `suggest_step_hazards` (per step on Step 3) and `suggest_step_controls` (per hazard on Step 3) — both gated on `jsa:draft` with an explicit "I've reviewed these" checkbox before Accept enables (stricter than CAPA metadata because workers act on the contents and incorrect PPE recommendations are life-critical). PPE-only outputs surface an amber ISO 45001 §8.1.2 auditor warning. Both wands use the smart tier (Pro) with `thinking: 'auto'`. Routes: `/jsa` (status filter tabs) · `/jsa/new` (Step 1 identity form, creates draft + redirects) · `/jsa/[id]` (read-only detail with steps/hazards/controls/sign-offs/linked-incidents) · `/jsa/[id]/edit?step=steps\|hazards\|approve` (3-step wizard with @dnd-kit step reorder, full-replace `updateJsa` per SPEC §JSA.7) · `/jsa/[id]/perform` (worker pre-job sign-off; disabled unless `status='approved'`). Investigation Findings tab gets `<IncidentJsaLinkSection>` alongside the existing `<IncidentHazardLinkSection>`. Page-context provider extended with 4 new route keys (`jsa_index/detail/edit/perform`) + panel suggestion chips. Three-layer "approver ≠ creator" enforcement: DB CHECK constraint + action-layer guard + wizard's approve view shows different copy for creator vs approver. Worker per-shift sign-off uses a unique INDEX (not constraint) with `coalesce(signed_for_session, '')` so NULL sessions still gate. The `updateJsa` "wipe and re-insert" path costs ~100 rows per save on a 10×3×3 JSA; acceptable at v1 scale per kickoff Q&A. |
| 2026-05-11 | **Phase 14 — Hazard Register built (§HZ)** | Migration `20260521120000_phase14_hazard_register.sql` ships 5 new tables (`hazards`, `hazard_risk_assessments`, `hazard_controls`, `hazard_candidates`, `incident_hazard_links`) + 5 new permission keys (`hazard:read_site`, `hazard:report`, `hazard:manage`, `hazard:close`, `hazard_candidate:review`) + `seed_default_roles()` patched so future orgs inherit the grants + RLS via the existing `user_can_access_site` + `has_permission` helpers. Three SPEC deltas folded in: (1) `hazard_controls.next_control_review_at` cadence column so the "Overdue reviews" KPI tile reads both assessment-review and control-review schedules; (2) new `notification_kind = 'hazard_incident_linked'` enum value so the workflow notification engine can fire on `incident_hazard_links` insert; (3) **SPEC §HZ.3 matrix orientation corrected** from the v2-spec draft (S5=worst) to match the shipped incident severity engine (S1=worst, S5=best). The drafted §HZ matrix's inversion would have flipped every incident severity classification on the wizard — caught at kickoff Q&A. `hazard_risk_assessments.{inherent,residual}_risk_score` use the existing `severity` enum rather than a parallel scale. `lib/risk/matrix.ts` is the now-canonical lookup shared with `lib/workflow/severity.ts` via `lib/risk/coords.ts`. §HZ.8 KPI criterion follows: high-risk = `('S1','S2')`. |
| 2026-05-11 | **§HZ Hazard Register adopted as a standalone module (v2 spec; build deferred)** | ISO 45001 §6.1.2 demands a live, contextualized inventory of workplace hazards distinct from the incident record. Adopts the spec in §HZ below: one `hazards` table (live register) + `hazard_risk_assessments` (history-preserving, periodic + event-driven) + `hazard_controls` (5-level hierarchy: elimination / substitution / engineering / administrative / PPE) + `hazard_candidates` (review queue funnel from 6 identification methods: worker report · inspection · incident review · MOC · JSA promotion · SDS import) + `incident_hazard_links` (closes the feedback loop). Six-state lifecycle (`identified` → `under_assessment` → `controlled` → `monitoring` → `closed`, plus `superseded` for merges). **Shared 5×5 risk matrix extracted to `lib/risk/matrix.ts`** so both incident severity (existing) and hazard risk assessment (new) consume the same lookup; `computeResidual()` returns the post-control level via reduction factors keyed off the highest-tier control applied (elimination = -4 levels, substitution = -3, engineering = -2, administrative/PPE = -1). SDS Manager integration stubbed in v1 — candidate rows can be created with `source_type='sds_import'` but no live SDS API; v2 wires the real lookup. Hazard categories (8) + sources (12) are `text + CHECK` constraints rather than enums to keep future expansion as a one-line migration. Routes scoped to `/hazards/*` + `/hazards/candidates/*`. KPI tiles: identified count, S4/S5 high-risk count, overdue reviews, **PPE-only-control count (auditor warning signal)**. **Build status: spec only — implementation queued for the v2 surface scoping pass.** |
| 2026-05-09 | **Phase 13 — Site Setup OSHA + RIDDOR alignment** | Reshapes the wizard from 7 steps to 9 with self-explanatory slugs (`/admin/site-setup/<slug>` instead of `/<n>`). Adds 22 new columns on `sites` covering structured address (street_1/2 + city + state_or_region + postal_code), lat/long (`numeric(9,6)` paired-or-null with range CHECK; PostGIS deferred until spatial queries land), jurisdiction (`osha_jurisdiction` federal vs state_plan + `state_plan_code`; `gb_jurisdiction` HSE vs local-authority), identifiers (US: `ein`, `sic_code`, `ita_establishment_id`; GB: `crn`, `uk_sic_2007`, `hse_establishment_number` promoted from JSONB), workforce (`peak_employees_year`, `avg_employees_year`, `partially_exempt_override`), hazards (`applicable_standards text[]` ⊆ {1910/1926/1915/1917/1918/1928}, `psm_applicable`, `hazard_tags text[]` ⊆ 10-tag catalog), lifecycle (`site_type`, `operational_status`, `opened_on`, `closed_on`), and people (`site_ehs_lead_id` FK to profiles, `riddor_responsible_person_{name,role}`). New child table `site_emergency_contacts` (name + role + phone + email + sort_order) for per-site contacts. Two computed-read SQL functions (`is_ita_required(naics, peak_employees)`, `is_partially_exempt(naics, peak_employees)`) curated from 29 CFR 1904.2 + 1904.41 Appendix A — derive recordkeeping flags at read time so the wizard's badges stay live without storage drift. Tag/standard/state-plan catalogs live as TS constants under `lib/site-setup/` (text[] over lookup tables — premature abstraction otherwise). **Also** fixes a Phase-0-era RLS bug: `notification_recipients` shipped with a SELECT-only policy, so site setup Step 6 (now Step 8 — recipients) silently 401'd on Save. Adds INSERT/UPDATE/DELETE policies gated on `site:configure`, mirroring 11a's site-edit perms. URL slugs add `slug` field to `SETUP_STEPS` catalog; `nextIncompleteStep()` returns slug strings; numeric URL backward-compat dropped (admin-only chrome, no external links, redirector at `/admin/site-setup` handles stale tabs). Existing `address text` column stays as legacy denormalized string for one phase; migration runs `update sites set street_1 = address` for backfill — no regex parsing (US/GB formats vary too much; admin re-splits on next walkthrough). All recommendations in `plans/13-site-setup-osha-riddor.md` locked as decisions per kickoff Q&A. |

### Open questions
1. **Hosting** — assume Vercel + Supabase. Confirm before Phase 0 wraps (affects cron job approach).
2. **Email delivery** — for demo, notifications stay in-app only. Confirm OK.
3. **Multi-tenancy** — single org, multi-site (US Houston + UK Manchester). Confirm OK (vs multi-org).
4. **Real-time updates** — polling on focus is good enough for the demo? (Supabase Realtime available but adds complexity.)

## 16. Argus (AI assistant)

Phase 9 introduces Argus — a voice + text co-pilot that lives across the product. This section is the runtime reference; per-phase scope and timeline are in `plans/09-argus-ai-assistant.md`.

### Hard rules

1. **Assistive only, never authoritative.** Every Argus output renders into a human-controllable form field with accept / edit / reject. The model never finalizes severity, track, CAPA closure, or regulatory submissions — those keep a named human signature.
2. **Every suggestion is logged.** `argus_suggestions` rows + `activity_events` rows with `actor_kind='argus'`. Includes model, prompt + completion + cache tokens, and the user's outcome (`pending` → `accepted` | `edited` | `rejected` | `expired`).
3. **Existing RBAC governs actions.** A magic-wand that "creates a CAPA" requires the user to hold `capa:create`. The single feature gate is `argus:use` (default-on for all four seeded roles).
4. **No auto-classification, no auto-routing, no auto-closure** — carried forward from `PLANNING/IMS_PLANNING.md` §2.4.3 even after the AI pivot. Non-negotiable.
5. **PII redaction before egress.** `lib/argus/redact.ts` strips known names (profiles + injured persons), emails, phone numbers, UK NI codes. Defence-in-depth on top of Anthropic's no-training-on-API-input policy — free-text descriptions can still re-leak.
6. **Server-side cost guardrails.** `orgs.argus_daily_token_budget` is a per-org cap (soft warn at 80%, hard block at 100%). Per-user rate limit: 10 inline / 3 deep / minute. Prompt caching on system + tool blocks via the SDK's `cache_control: ephemeral`.

### Architecture (Phase 9a foundation)

| Layer | Path | Notes |
|---|---|---|
| SDK singleton | `lib/argus/client.ts` | `getArgusClient()` — lazy-init; `ArgusOfflineError` when key missing (route handler returns 503 + SSE error frame, never a 500) |
| Models | `lib/argus/models.ts` | Aliases only — `claude-haiku-4-5` (inline classifiers), `claude-sonnet-4-6` (RCA + reportability), `claude-opus-4-7` reserved |
| Streaming | `lib/argus/stream.ts` + `app/api/argus/stream/route.ts` | Route handler returns `text/event-stream` with three event names: `token` (delta), `usage` (one-shot at end), `done`. Client consumes via `fetch + getReader()` (not `EventSource` — needs POST body) |
| PII redactor | `lib/argus/redact.ts` | Replaces known names with initials; emails → `[EMAIL]`; phones → `[PHONE]`; UK NI → `[NI]` |
| Budget | `lib/argus/budget.ts` | Sums tokens for org from start-of-UTC-day; uses admin client to bypass RLS for the aggregate |
| Rate limit | `lib/argus/ratelimit.ts` | In-memory map keyed `userId:bucket` (single-instance only — escalate to Upstash Redis if/when horizontally scaled) |
| Audit logger | `lib/argus/log.ts` | `logArgusSuggestion()` writes both `argus_suggestions` and `activity_events`; `setSuggestionOutcome()` flips outcome within 24h |
| Voice contracts | `lib/argus/voice.ts` | Type surface only; impl in `components/argus/use-voice.ts` (Phase 9b) |

### Schema additions

- `activity_events.actor_kind text not null check (in 'human','argus')` — grandfathers existing rows as `'human'`.
- `orgs.argus_enabled boolean default true` + `orgs.argus_daily_token_budget bigint default 5_000_000`.
- `argus_suggestions(id, org_id, site_id, user_id, surface, target_kind, target_id, model, prompt_tokens, completion_tokens, cache_read_tokens, cache_create_tokens, payload jsonb, outcome, outcome_at, created_at)`. RLS: SELECT/INSERT for site members via `user_can_access_site`; UPDATE only on `outcome` columns by author within 24h; DELETE revoked from PUBLIC.
- `incidents.stop_work boolean default false` + `stop_work_raised_at` + `stop_work_raised_by` + `stop_work_reason` + `stop_work_acknowledged_at` + `stop_work_acknowledged_by`. The `_by` columns are plain `uuid` (no FK to `profiles`) — adding three FKs from `incidents` → `profiles` broke PostgREST relationship inference for the existing `reporter_id` join, so we trade referential integrity (which we never relied on; profiles are soft-delete only) for clean Supabase type generation. See migration `20260518130000_phase9a_drop_stop_work_profile_fks.sql`.
- New permission `argus:use` granted to all four default roles (worker / supervisor / ehs_manager / site_admin). `seed_default_roles()` updated for new orgs.

### Wire format (SSE)

```
event: token   data: {"text": "..."}      // delta of model output
event: usage   data: {"inputTokens": N, "outputTokens": N, "cacheReadTokens": N, "cacheCreateTokens": N}
event: done    data: {"reason": "end_turn"}
event: error   data: {"message": "..."}   // gate-failure path; same shape as success terminus
```

Gates run in order: `requireUser` → `orgCan('argus:use')` → `argus_enabled` flag → `checkRateLimit` → `checkArgusBudget` → `isArgusConfigured`. Each gate returns the SSE error frame so the client renders a friendly message instead of a 500.

### Phase 9.0 sub-phase split

| Sub-phase | What ships |
|---|---|
| **9a (this PR)** | Foundation: SDK + env + library + migration + RLS + permission + empty side-panel shell mounted from topbar |
| **9b** | Floating `<ArgusCopilot>` on all 3 Report Wizard steps; mic + photo capture + log-observation + raise-stop-work tool calls |
| **9c (shipped 2026-05-10)** | `<ArgusInvestigator>` on `/investigations/[id]?tab=ai` — paste description + voice/text witness statements → Sonnet 4.6 with forced `tool_choice` returns a structured `{ timeline, 5-Why, root_cause_summary, findings }` draft → per-section "Push to investigation" approval gate |
| **9d** | `<ArgusMagicWand>` on risk-matrix cells, finding-→incident escalation, CAPA verification method, OSHA reportability confidence pane |
| **9e** | Global side panel page-context aware; 4 Dashboard `<ArgusInsightTile>` cards + tiles on CAPA / Inspections / Reports |

### 9c — AI Investigator (runtime reference)

**Surface.** New `ai` tab on `/investigations/[id]` between Findings and Timeline (Sparkles + cyan accent). Hidden when `orgs.argus_enabled = false`, when caller lacks `argus:use` or `investigation:edit`, or when the investigation is closed. URL `?tab=ai` falls back to Summary in any of those cases.

**Wire.** POST `/api/argus/investigator` `{ investigationId, paste, witnessAdds[] }` → SSE: `progress` (heartbeat) → `draft` (structured payload + suggestionId) → `usage` → `done`. One Sonnet 4.6 call per Generate (no agentic loop). `tool_choice: { type: 'tool', name: 'propose_investigation_draft' }` is forced so the model emits exactly one `tool_use` block; the route handler captures its `input` directly as the structured draft and streams it back. Half-formed JSON deltas are not streamed — the user sees a thinking indicator, then the full draft lands at once.

**Tool.** `lib/argus/tools/propose-investigation-draft.ts` — structured-output schema with no `execute()`. Required fields: `timeline[]`, `whys[5]`, `root_cause_summary`, `findings`, `insufficient_input` (escape valve when input is too thin).

**Inputs.** Read-only seed = incident description + type + area + location + occurredAt + existing witnesses (initials only). Editable input = paste textarea (with mic) + add-witness rows (text or voice via `useVoice`). Witnesses added via the tab stay client-side until first Push.

**Push semantics.** Each output card has a per-section Push button:
- *Timeline* → prepended to `findings` under `## Timeline`. Confirm dialog (Replace / Append / Cancel) when `findings` already has content.
- *5-Why chain* → `saveWhy` for levels 1–5 in order. Replace-only (no append for a structured chain). Confirm dialog when any level already has an answer.
- *Root cause summary* → `saveInvestigationText('root_cause_summary')`. Same confirm-and-merge logic.
- *Findings narrative* → `saveInvestigationText('findings')`. Same confirm-and-merge logic.

Push commits via the existing `saveInvestigationText` / `saveWhy` actions — no new write paths and the `investigation:edit` gate is unchanged. After a successful Push, `acceptArgusSuggestion()` flips the `argus_suggestions.outcome` to `accepted` (no diff) or `edited` (diff payload attached) and writes a `verb='argus.investigator_pushed'` activity event with `actor_kind='human'`. `rejectArgusSuggestion()` flips outcome to `rejected` and writes `argus.investigator_rejected`.

**Audit trail.** Generate writes one `argus_suggestions` row (`surface='investigator'`, `target_kind='investigation'`, `outcome='pending'`) plus one `activity_events` row (`actor_kind='argus'`, `verb='argus.investigator_drafted'`). Each Push or Discard flips the outcome and writes a sibling `actor_kind='human'` activity row. Diff payloads (`{ before, after }`) are attached to the activity row when the user edited the draft before pushing.

**Hallucination defenses.** Three layers:
1. *Server-side input gate* — pre-flight 400 when zero witnesses AND <50 words combined input.
2. *System prompt* — hard rule "do not invent details," `insufficient_input` escape valve, redactor strips known names to initials before egress.
3. *Output gate* — model returns `insufficient_input` non-empty → UI renders the explanation banner and skips the four output cards entirely.

**Schema.** No migration. Reuses `argus_suggestions` (9a) + `activity_events` (9a) + `investigations.{findings, root_cause_summary}` + `rca_whys` (Phase 2) + `witnesses` (Phase 1). Two new activity verbs (`verb` is `text`, no enum change).

**Cost guardrails.** `runArgusGates("investigator")` puts the call in the **heavy** rate-limit bucket (3/min/user). Per-org daily token budget is enforced unchanged. Sonnet 4.6 is ~5× Haiku per token; a 5M-token org daily cap absorbs ~250 Generates.

### 9e — Global panel page-context + Insight Tiles (runtime reference)

**Surface 1 — page-context-aware side panel.** The 9a side-panel shell stays at the topbar Sparkles avatar (now positioned right of `<NotificationBell>`). Pages opt in by rendering `<ArgusContextPayload context={ctx} />` inside their server tree; the client-side `<ArgusContextProvider>` wrapping `(app)/layout.tsx` registers the latest mount and exposes it via `useArgusPageContext()`. The panel reads the route + redacted record summaries + small numeric aggregates and:

- shows a header chip — e.g. `Incident IR-014 · UCB Houston (US)` — so the user can see what Argus is grounded on;
- offers per-route suggestion chips (`ARGUS_PANEL_SUGGESTIONS` keyed by `route`) that auto-fill + auto-submit;
- POSTs to `/api/argus/stream` with `surface: 'panel_chat'`. The route handler builds the system prompt from `lib/argus/system-prompts/panel.md` plus a `# Page context` block (route, label, aggregates, records); free-text fields run through `redactText()` a second time server-side as defence-in-depth;
- writes `argus_suggestions` rows with `target_kind` keyed to the page's primary record (`'incident' | 'investigation' | 'capa' | 'inspection'`) on detail pages and `'page'` on index pages.

A `pageContext.hasActiveSignal` flag — set by tile-rendering pages when any aggregator signals attention — paints a small cyan dot on the Sparkles trigger. No multi-turn yet (single user turn → single Argus turn per panel open); tracked in 9.1.

**Surface 2 — Insight Tiles.** Seven `<ArgusInsightTile>` mounts share one route handler at `/api/argus/tile` and one structured-output tool (`tile_insight`). **Tiles never auto-fire** — each card opens in an idle state with an "Analyse with Argus" button; the user clicks to spend any tokens. The Sparkles trigger's `hasActiveSignal` dot is still set server-side from the aggregator output (no model call), so users can tell where attention is needed before clicking. Output envelope is identical across tiles so the component never branches:

```ts
{ summary, rationale, confidence, nothing_to_flag?, recommended_action_label? }
```

| Tile | Mount | Permission | TTL | Tier |
|---|---|---|---|---|
| `overdue_investigations` | `/dashboard` | `investigation:lead` | 24h | smart |
| `stop_work_active` | `/dashboard` | `incident:read_site` | 1h | smart |
| `reportability_uncertain` | `/dashboard` | `report:read` | 24h | smart |
| `capa_overdue` | `/dashboard` | `capa:complete` | 24h | smart |
| `capa_index_summary` | `/capa` | `capa:complete` | 24h | smart |
| `inspections_due_summary` | `/inspections` | `inspection:read_site` | 24h | smart |
| `reports_pending_summary` | `/reports` | `report:read` | 24h | smart |

Smart-tier with `thinking: 'off'` — Pro produces tighter prose for the same cost as Flash here, and the latency overhead from thinking would be visible on first-paint.

**Cache strategy.** Each aggregator computes a `freshnessKey` that flips the moment the underlying data changes (e.g. `count + max(updated_at)`, or `count + max(stop_work_raised_at)` for the high-stakes stop-work tile). The route handler hashes `tile + freshnessKey` to a deterministic UUIDv5 and looks up `argus_suggestions WHERE surface='tile_<key>' AND target_kind='page' AND target_id=<hash> AND created_at >= now() - TTL`. Cache hits skip the model entirely; cache misses write a fresh row (`outcome='pending'`, `payload.kind='tile'`). The deterministic UUID means multiple users on the same org can share a single model call per (tile, freshness) snapshot — useful even with the explicit-Analyse default, because the second viewer to click on the same signal hits the cache for free.

**Wire format.** Non-streaming JSON envelope, mirroring 9d's wand route:

```
POST /api/argus/tile
{ tile, payload: { siteId, aggregates, recordRefs, freshnessKey } }

→ { ok: true,  suggestionId, output, modelUsed, cached }
→ { ok: false, error }
```

**Rate limit.** New `tile` bucket (20/min/user) — wider than `inline` (10/min) since dashboard first-paint can fan out 4 tiles in one go. Heavy bucket (3/min) is reserved for the deep-analysis surfaces (Investigator, CAPA-draft, Reportability wand). `runArgusGates(surface)` infers the bucket from `surface.startsWith('tile_')`.

**Recommended-action link.** The model can suggest a label via `recommended_action_label`; the destination URL is server-controlled via `TILE_CONFIG[tile].defaultHref`. The tile component never renders a model-supplied URL — keeps the model from steering users to arbitrary routes.

**Schema.** No migration. Reuses `argus_suggestions` (9a) — eight new `surface` strings (`panel_chat` + seven `tile_*` keys), `target_kind='page'` for tile rows, `target_id` carrying the deterministic UUIDv5 cache key. Old `'incident' | 'investigation' | 'capa' | 'finding'` target_kinds stay valid; new strings (`'inspection' | 'report' | 'page'`) widen the TS union without touching the Postgres column (it's `text`).

**RBAC.** No new permission keys. Visibility per tile uses the site's existing read permission (mirroring how each index page gates itself). The single feature flag is `argus:use`. `argus_enabled` on the org turns every Argus surface off.

**PII.** Aggregators only send small integer counts + ref_codes to the model. Free-text titles never enter the user block. Detail-page payloads pass redacted record summaries (`severity + type` instead of free-text titles for v1).

## §HZ Hazard Register

> **Build status (2026-05-11):** Schema + RLS + permissions + shared-matrix refactor shipped in Phase 14. UI + Argus integration ship in the same PR. Cross-reference §15 decisions log (2026-05-11 rows: spec adoption + Phase 14 build).

### HZ.1 Purpose

The Hazard Register is the live, contextualized inventory of workplace hazards. Each row represents a source of potential harm at a specific site/area, with its assessed risk and applied controls. Aligned to ISO 45001 §6.1.2.

The register is fed by six identification methods, all converging on a single `hazard_candidates` review queue:

- Worker report (floor, QR, app)
- Inspection (routine site walks)
- Incident review (during investigation)
- Management of change (when something changes)
- JSA promotion (when a JSA's step-hazard is promoted to register)
- SDS import (stubbed in v1; live SDS Manager API lookup deferred to v2)

Identification = the human conversion act, performed by a competent person who supplies the workplace context the methodology couldn't.

### HZ.2 Data model

```sql
-- The live register: hazards
create table public.hazards (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique not null,                -- "HAZ-HOU-2026-0042"
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
    'identified','under_assessment','controlled',
    'monitoring','closed','superseded'
  )),

  affects_workers text[] default '{}',
  affects_others  text[] default '{}',

  identified_by uuid references public.profiles(id),
  identified_at timestamptz not null default now(),
  identification_method text,

  current_risk_assessment_id uuid,              -- FK added after table create

  source_candidate_id uuid,                     -- references hazard_candidates(id)
  source_jsa_id uuid,
  source_incident_id uuid references public.incidents(id),
  source_sds_id text,                           -- external; SDS Manager owns it
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

-- Periodic and event-driven risk assessments (history-preserving)
create table public.hazard_risk_assessments (
  id uuid primary key default gen_random_uuid(),
  hazard_id uuid not null references public.hazards(id),

  likelihood text not null check (likelihood in (
    'rare','unlikely','possible','likely','almost_certain'
  )),
  consequence text not null check (consequence in (
    'insignificant','minor','moderate','major','catastrophic'
  )),
  inherent_risk_score text not null,            -- 'S1'..'S5' from matrix
  residual_risk_score text not null,            -- after controls applied

  trigger_type text not null check (trigger_type in (
    'initial','periodic_review','post_incident',
    'management_of_change','regulatory_change',
    'worker_consultation','audit_finding','sds_revision'
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

-- Add the FK now that both tables exist
alter table public.hazards
  add constraint hazards_current_ra_fk
  foreign key (current_risk_assessment_id) references public.hazard_risk_assessments(id);

-- Controls (hierarchy of controls)
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
  next_control_review_at date,                  -- cadence delta from Phase 14

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

-- The review queue (system-generated; not yet a hazard)
create table public.hazard_candidates (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in (
    'sds_import','worker_report','inspection','incident_review',
    'management_of_change','audit_finding','external_advisory','jsa'
  )),
  source_reference_id text,                     -- text; some sources external

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

-- Feedback loop: incidents link to hazards during investigation
create table public.incident_hazard_links (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id),
  hazard_id uuid not null references public.hazards(id),

  was_in_register_at_time boolean not null,
  link_type text not null check (link_type in (
    'causal','contributing','exposed_but_not_causal'
  )),
  triggered_reassessment boolean not null default false,

  identified_at timestamptz not null default now(),
  identified_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),

  unique (incident_id, hazard_id)
);

create index on public.incident_hazard_links (incident_id);
create index on public.incident_hazard_links (hazard_id);
```

### HZ.3 Shared risk matrix

Extracted to `lib/risk/matrix.ts` (Phase 14). Shared with the incident severity engine via `lib/workflow/severity.ts`, which now delegates through `lib/risk/coords.ts` for the integer-coordinate API the Phase-1 wizard still uses.

**Orientation:** `S1 = Critical (worst residual risk)` … `S5 = Insignificant (best)`, matching the shipped incident severity scale. The earlier §HZ.3 draft inverted this (S5=worst); the inversion was caught at Phase 14 kickoff (2026-05-11) and corrected to keep a single canonical S-number convention across both surfaces. See §15 decisions log row for that date.

```typescript
// lib/risk/matrix.ts (excerpt — full file in repo)
export type Likelihood  = 'rare'|'unlikely'|'possible'|'likely'|'almost_certain'
export type Consequence = 'insignificant'|'minor'|'moderate'|'major'|'catastrophic'
export type RiskLevel   = 'S1'|'S2'|'S3'|'S4'|'S5'

export const MATRIX: Record<Likelihood, Record<Consequence, RiskLevel>> = {
  rare:           { insignificant:'S4', minor:'S4', moderate:'S3', major:'S3', catastrophic:'S2' },
  unlikely:       { insignificant:'S4', minor:'S4', moderate:'S3', major:'S2', catastrophic:'S2' },
  possible:       { insignificant:'S4', minor:'S3', moderate:'S2', major:'S2', catastrophic:'S1' },
  likely:         { insignificant:'S4', minor:'S3', moderate:'S2', major:'S1', catastrophic:'S1' },
  almost_certain: { insignificant:'S3', minor:'S2', moderate:'S1', major:'S1', catastrophic:'S1' },
}

export function computeRisk(l: Likelihood, c: Consequence): RiskLevel {
  return MATRIX[l][c]
}

// Residual after controls. Reduction factor = highest control level applied.
const REDUCTION: Record<string, number> = {
  elimination:    4,
  substitution:   3,
  engineering:    2,
  administrative: 1,
  ppe:            1,
}

// In this orientation, "reducing risk" moves the S-number UP toward S5 (best),
// capped at 5. Cohort: elimination on S1 → S5; PPE-only on S3 → S4.
export function computeResidual(inherent: RiskLevel, controlLevels: string[]): RiskLevel {
  if (controlLevels.length === 0) return inherent
  const best = Math.max(...controlLevels.map(l => REDUCTION[l] ?? 0))
  const inherentNum = parseInt(inherent.slice(1))
  const residualNum = Math.min(5, inherentNum + best)
  return `S${residualNum}` as RiskLevel
}
```

> **Note.** `hazard_risk_assessments.inherent_risk_score` and `residual_risk_score` use the existing `severity` Postgres enum (`S1..S5`), reusing the type already in `lib/supabase/types.ts` rather than a parallel hazard scale.

### HZ.4 Routes

- `app/(app)/hazards/page.tsx` — list + KPI tiles + filters
- `app/(app)/hazards/new/page.tsx` — report a hazard
- `app/(app)/hazards/[id]/page.tsx` — detail with tabs
- `app/(app)/hazards/candidates/page.tsx` — review queue
- `app/(app)/hazards/candidates/[id]/page.tsx` — review one candidate

### HZ.5 Components

- `components/hazards/hazard-list.tsx`
- `components/hazards/hazard-detail-tabs.tsx` (Overview / Assessments / Controls / Linked Incidents)
- `components/hazards/hazard-form.tsx` (new + edit)
- `components/hazards/risk-assessment-form.tsx`
- `components/hazards/controls-section.tsx`
- `components/hazards/candidate-queue.tsx`
- `components/hazards/candidate-review-form.tsx` (convert / dismiss / merge)
- `components/hazards/kpi-tiles.tsx`

### HZ.6 Server actions

`actions/hazards.ts`:
- `createHazard(input)` — direct creation by EHS Manager
- `updateHazard(id, input)`
- `createRiskAssessment(hazardId, input)` — appends new row; updates `current_risk_assessment_id`
- `addControl(hazardId, input)`
- `verifyControl(controlId, effectiveness, notes)`
- `closeHazard(id, reason)`

`actions/hazard-candidates.ts`:
- `createCandidate(input)` — used by worker report path and SDS stub
- `convertCandidate(candidateId, contextualization)` — creates hazard + initial RA + initial controls in a transaction
- `dismissCandidate(candidateId, reason)`
- `mergeCandidate(candidateId, intoHazardId)`

`actions/incident-hazards.ts`:
- `linkIncidentToHazard(input)` — called during investigation
- `triggerReassessment(hazardId, fromIncidentId)` — creates new RA with `trigger_type='post_incident'`

### HZ.7 RLS

Same patterns as `incidents`:

- **Worker:** SELECT hazards at sites they belong to
- **Supervisor:** + INSERT hazards at their sites
- **EHS Manager:** + UPDATE/manage assessments and controls
- **Site Admin:** full access to their org's sites

Permission keys (proposed, finalized at build time): `hazard:read_site`, `hazard:report`, `hazard:manage`, `hazard:close`, `hazard_candidate:review`. Aligns with the project's RBAC pattern (system-keyed strings, granted to default roles via `seed_default_roles()`).

### HZ.8 KPI tiles on /hazards

Four tiles:

- **Hazards identified** — count of `status not in ('closed','superseded')` (excludes soft-deleted)
- **High-risk hazards** — count where `residual_risk_score in ('S1','S2')` (S1=Critical, S2=Major per the shared scale)
- **Overdue reviews** — count where `next_review_at < today` OR `next_control_review_at < today` (union across both cadences per Phase 14 delta)
- **PPE-only controls** — count of hazards whose only applied control_level is `'ppe'` — auditor warning signal (ISO 45001 hierarchy violation indicator), rendered with the amber warning color

### HZ.9 Acceptance

A hazard can be reported via `/hazards/new`. A candidate created from any source can be converted, dismissed, or merged. A converted hazard has an initial risk assessment and at least one control. The hazard detail page shows all four tabs. The candidate queue shows pending candidates with source attribution.

### HZ.10 Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-11 | **Hazard Register is a distinct module from incidents** | ISO 45001 §6.1.2 demands a live inventory of hazards independent of whether they have caused incidents. Hazards predate incidents (proactive identification) and persist after them (residual + monitoring). Coupling them would force every hazard through the incident workflow. |
| 2026-05-11 | **Single `hazard_candidates` queue funnels six identification methods** | One human-review gate keeps quality high without forcing every method (SDS import, worker report, etc.) to invent its own review UI. Candidates are the *system-generated proposal*; conversion is the *competent-person decision*. Lets us add new identification sources later by appending to the `source_type` CHECK. |
| 2026-05-11 | **Risk matrix extracted to `lib/risk/matrix.ts` — shared with incident severity engine** | Two surfaces (incident Step-2 and hazard risk assessment) consume the same 5×5 lookup. Inlining it twice invites drift. The refactor is mechanical (no behavior change for incidents); the new hazard module is the forcing function. `computeResidual()` is hazard-specific (incidents don't apply controls before classification) but lives in the same file for cohesion. |
| 2026-05-11 | **Controls follow the ISO 45001 hierarchy with deterministic residual** | Five levels (elimination · substitution · engineering · administrative · PPE) with reduction factors (4/3/2/1/1). Residual = inherent + max-reduction-from-applied-controls, capped at S5 (safest). Makes the residual derivable rather than EHS-typed → eliminates a guessable subjective field. Trade-off: doesn't model interaction effects (two engineering controls aren't better than one); demo-grade fidelity is fine for v1. |
| 2026-05-11 | **§HZ.3 matrix orientation locked to incident scale (S1=worst, S5=best) at Phase 14 kickoff** | The original v2-spec draft of §HZ.3 inverted the scale (rare+insignificant → S1, almost_certain+catastrophic → S5). Routing the incident wizard through this would have flipped severity / Track A-B-C routing / regulatory triggers / colors for every cell. Resolved by re-keying the §HZ.3 matrix to match incidents (`rare × insignificant → S4`, `almost_certain × catastrophic → S1`), capping `computeResidual()` at S5, and updating the §HZ.8 high-risk KPI criterion to `('S1','S2')`. Single shared canonical scale; SPEC §HZ.3 rewritten in-place. |
| 2026-05-11 | **`hazard_controls.next_control_review_at` cadence column added** | Phase 14 SPEC delta. §HZ KPI "Overdue reviews" tile reads both `hazard_risk_assessments.next_review_at` AND `hazard_controls.next_control_review_at`; controls have a verification cadence distinct from assessment review. One nullable date column, no new table. |
| 2026-05-11 | **`notification_kind = 'hazard_incident_linked'` added** | Phase 14 SPEC delta. Risk-owner auto-notification fires when `incident_hazard_links` insert succeeds with `link_type='causal'` — alerts the hazard's `identified_by` + the most recent assessment's `assessor_id`. Reuses the existing `lib/workflow/notifications.ts` engine and `notifications` / `notification_recipients` tables; just one new enum value. |
| 2026-05-11 | **`status` includes `superseded` for hazard mergers/replacements** | A safer redesign that retires a hazard (e.g. eliminate vs. control) is auditable as `status='superseded'` + `superseded_by_hazard_id`. Distinct from `closed` (no longer a hazard) and from soft-delete (`deleted_at`). |
| 2026-05-11 | **`hazard_categories` (8) and `hazard_sources` (12) are `text + CHECK`, not enums** | Adding a category is a one-line migration vs an `ALTER TYPE ... ADD VALUE` that locks the table on enum rewrite. The set is stable enough that an enum would be tidier; the deciding factor is that v2 may introduce industry-specific categories (e.g. radiation for healthcare/lab), and we want that to be a 30-second migration. |
| 2026-05-11 | **`incident_hazard_links` closes the feedback loop separately from `source_incident_id`** | `hazards.source_incident_id` records the *single incident that birthed this hazard* (during investigation review). `incident_hazard_links` is the many-to-many of *every incident that exposed this hazard*, with `link_type` (causal / contributing / exposed_but_not_causal) + `was_in_register_at_time` for compliance trend analysis. Two separate columns, distinct semantics. |
| 2026-05-11 | **SDS Manager integration stubbed in v1** | `hazard_candidates.source_type = 'sds_import'` + a `source_sds_id` text column on `hazards` are present from day one, but no live API. v2 wires the actual lookup. Demo-grade scope: an admin can create candidates with `source_type='sds_import'` manually for demo purposes. |
| 2026-05-11 | **PPE-only control count is an auditor-warning KPI tile** | The hierarchy of controls explicitly de-prioritizes PPE as a last-resort barrier. Hazards whose *only* applied control is PPE signal that engineering / administrative options weren't pursued — an ISO 45001 review red flag. Surfacing this as a tile makes it discoverable without an audit. |

## §JSA Job Safety Analysis

> **Build status (2026-05-11):** Specification adopted; implementation queued **after §HZ** in the v2 surface scoping pass. The data shapes, route layout, 4-step wizard flow, and step-hazard promotion path below are locked decisions. **Depends on §HZ shipping first** — both `hazard_candidates(id)` and `hazards(id)` are referenced as FKs by `jsa_step_hazards`. Cross-reference §15 decisions log (2026-05-11 row).

### JSA.1 Purpose

A JSA is a structured pre-job analysis. It breaks a job into sequential steps, identifies hazards per step, and applies controls per step. A JSA is **both a methodology** (it produces hazards) **and a document** (workers sign off before performing the job).

JSAs feed the Hazard Register **selectively**: the EHS Manager picks which step-hazards to promote as candidates after the JSA is approved. Not every step-hazard deserves a permanent register entry — some are job-specific and disappear when the job ends.

Regulatory anchor: OSHA 3071 (Job Hazard Analysis) and HSE INDG163 (Five steps to risk assessment).

### JSA.2 Data model

```sql
create table public.jsas (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique not null,                -- "JSA-HOU-2026-0017"
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
  permits_required text[] default '{}',         -- e.g. ['hot_work','confined_space']

  status text not null default 'draft' check (status in (
    'draft','under_review','approved','expired','archived'
  )),

  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  expires_at date,                              -- typically approved_at + 12 months

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
  signed_for_session text,                      -- e.g. "2026-05-15-morning-shift"
  notes text,

  unique (jsa_id, worker_id, signed_for_session)
);
```

> **Enum-list sync note.** `jsa_step_hazards.hazard_category` and `jsa_step_controls.control_level` must stay in sync with `hazards.hazard_category` / `hazard_controls.control_level` in §HZ. The two modules use the same `text + CHECK` constraint copy rather than a shared lookup table — easier expansion (one-line migration vs `ALTER TYPE`) but requires a 2-file edit when adding values. Worth a comment in each migration cross-pointing.

### JSA.3 Routes

- `app/(app)/jsa/page.tsx` — list with status filters
- `app/(app)/jsa/new/page.tsx` — 4-step wizard
- `app/(app)/jsa/[id]/page.tsx` — detail (read view)
- `app/(app)/jsa/[id]/edit/page.tsx` — edit (only when `status='draft'`)
- `app/(app)/jsa/[id]/perform/page.tsx` — worker pre-job view + sign-off

### JSA.4 4-step wizard

**Step 1: Job identity.** Title, site, area, job description, performed-by roles, frequency, estimated duration, PPE required, permits required.

**Step 2: Steps.** Repeating list of step descriptions. Drag to reorder (use `@dnd-kit` — already in `package.json` from Phase 2 Kanban). Each step has a sequence number, auto-assigned on save.

**Step 3: Hazards & controls per step.** For each step, add 0..n hazards. Each hazard has description, category, likelihood × consequence (computed inherent risk via `lib/risk/matrix.ts`). Add controls per hazard (level + description). Residual risk computed using `computeResidual()` per the §HZ matrix.

**Step 4: Review & approve.** Approver selector (must differ from creator, `ehs_manager+` role). Expiry date default = today + 12 months. "Save draft" or "Submit for approval" buttons. After approval, sets `status='approved'`, `approved_by`, `approved_at`, `expires_at`.

### JSA.5 Promoting step-hazards to the register

After approval, on the JSA detail page, EHS Manager sees a "Promote to hazard register" button next to each step-hazard. Clicking creates a `hazard_candidates` row with `source_type='jsa'` and `source_reference_id=jsa_step_hazard.id`.

The candidate goes through the normal review flow in §HZ. On conversion, `jsa_step_hazards.registered_hazard_id` is back-filled so the JSA detail page can show "Already in register: HAZ-HOU-2026-0042 →" instead of the promotion button.

Promotion is **selective and one-way per step-hazard** — once a step-hazard has a `hazard_candidate_id`, the button hides regardless of candidate resolution (the candidate review flow decides whether it converts/dismisses/merges).

### JSA.6 Worker sign-off

The `/perform` page is read-only with a prominent "I have read and understood this JSA" button. Clicking creates a `jsa_signoffs` row.

Session string format: `"{YYYY-MM-DD}-{shift}"` — worker picks the session before signing. Sign-offs are unique per `(jsa, worker, session)` so a worker who signs the same JSA for the morning shift can't sign again the same morning, but **can** sign for the evening shift.

For v1, `signed_for_session` is a freeform text field with a small set of suggested values via a `<datalist>` (`morning`, `afternoon`, `evening`, `night`). A formal `shifts` table is deferred to v2.

### JSA.7 Server actions

`actions/jsa.ts`:
- `createJsaDraft(input)` — creates `jsas` + `jsa_steps` + `jsa_step_hazards` + `jsa_step_controls` in a single transaction
- `updateJsa(id, input)` — only when `status='draft'`; full replace of steps/hazards/controls in a transaction (simpler than diffing)
- `submitForReview(id)` — `draft → under_review`
- `approveJsa(id, expiresAt)` — `under_review → approved`, sets `approved_by` to the caller (must differ from `created_by`), enforced at DB CHECK + server action + UI
- `signOffJsa(id, session)` — worker acknowledges
- `promoteStepHazard(stepHazardId)` — creates `hazard_candidate` with `source_type='jsa'`; flips `promoted_to_register=true`

### JSA.8 RLS + permissions

Same patterns as `incidents`:

- **Worker:** SELECT JSAs at sites they belong to + INSERT `jsa_signoffs` for themselves
- **Supervisor:** + create + edit drafts at their sites
- **EHS Manager:** + approve (when not creator) + promote step-hazards
- **Site Admin:** full access to their org's sites

Proposed permission keys (finalized at build time): `jsa:read_site`, `jsa:draft`, `jsa:approve`, `jsa:signoff`, `jsa:promote_step_hazard`. The `jsa:approve` check at action time still enforces `approver ≠ creator` regardless of role.

### JSA.9 Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-11 | **JSA is its own module, not a §HZ sub-feature** | A JSA is a *pre-job document* with its own approval workflow, sign-off ledger, and expiry. The hazard-register feed is a side effect, not the primary purpose. Coupling would force every JSA hazard through the register's lifecycle (and force `status='superseded'` on expired-JSA hazards, which is wrong — those hazards may still be valid in the register). |
| 2026-05-11 | **Step-hazards promote to the register selectively, via the candidate queue** | Auto-promotion would flood the register with job-specific noise. The promote-button-per-step-hazard model lets EHS pick the few that genuinely deserve a permanent register entry. Reuses the §HZ `hazard_candidates` queue rather than inventing a separate JSA-only pathway. |
| 2026-05-11 | **Approver ≠ creator enforced at DB, server action, and UI** | Same invariant pattern as CAPA owner ≠ verifier (an existing hard rule in the project). Implemented as a `CHECK (approved_by IS NULL OR approved_by <> created_by)` constraint, plus a server-action guard, plus a disabled-approver-option in the picker. Three-layer enforcement mirrors the project convention. |
| 2026-05-11 | **Default 12-month expiry; expired JSAs require re-approval** | OSHA 3071 expects periodic review of JHAs; HSE INDG163 says "review whenever you think it might no longer be valid." 12 months is the industry default for stable jobs (industry / contractor toolkits all converge here). Expiration is a `status` flip via cron, not a hard delete — workers can still see the expired text for context but can't sign off against it. |
| 2026-05-11 | **`jsa_signoffs` unique per `(jsa, worker, session)` — workers re-sign per shift, not once-forever** | A worker signing "I read this JSA" once doesn't carry forward across shifts (memory degrades, conditions change, contractors rotate). Session-scoped sign-offs match the toolbox-talk / shift-briefing cadence safety teams already use. `signed_for_session` is freeform text in v1; a formal `shifts` table is v2. |
| 2026-05-11 | **PPE + permits + performed-by stored as `text[]`** | Same rationale as §HZ's `hazard_categories` — `text[]` is a one-line migration to add a value, and the lookup tables are tiny and slow-moving. Workgroups in particular have no formal table yet (deferred to v2 when training/competency module lands). |
| 2026-05-11 | **JSA shares the §HZ 5×5 risk matrix via `lib/risk/matrix.ts`** | Two surfaces (JSA step-hazard scoring + Hazard Register risk assessment) use the same 5×5 grid + the same `computeResidual()` reduction. Splitting them would invite drift. Reaffirms the §HZ matrix-extraction commitment. |
| 2026-05-11 | **Steps reorder via `@dnd-kit`** | Dep already in `package.json` from Phase 2 (CAPA Kanban). No new dep needed. Sequence is an `integer` column with `UNIQUE (jsa_id, sequence)`; reorder rewrites the sequence range in a transaction. |
| 2026-05-11 | **Edits gated to `status='draft'`** | Once a JSA is `under_review` or `approved`, the body is immutable. Edits require unpublishing (draft revert) — same protection pattern as Phase 10 published bulletins. Re-approval kicks the lifecycle back to `under_review`. |
| 2026-05-11 | **`updateJsa` does a full transactional replace of steps/hazards/controls, not a diff** | The wizard's edit experience is already render-the-whole-tree; diffing on save adds complexity without UX benefit. The cascade `on delete` from `jsa_steps → jsa_step_hazards → jsa_step_controls` makes the delete-then-reinsert cheap. Trade-off: PKs change on every save, so any external reference to a `jsa_step_hazard.id` mid-draft is unstable — promotion only fires post-approval, when edits are locked, so this doesn't bite. |
| 2026-05-11 | **JSA depends on §HZ shipping first** | `jsa_step_hazards` references `hazard_candidates(id)` and `hazards(id)`. The v2 build order is: §HZ migration + UI → §JSA migration + UI. Could be one phase or two; spec'd as separable so a single PR can land both if scope allows. |

## §SDS-INTEGRATION SDS Manager Integration (Stub)

> **Build status (2026-05-11):** Specification adopted; implementation queued **after §HZ** in the v2 surface scoping pass. The SDS Manager is a separate sub-company application with no API credentials available yet — this section documents the **demo-grade stub** so the integration story is visible end-to-end. When credentials arrive, swap `lib/sds/dummy-catalog.ts` for the API call; the candidate creation flow stays identical. **Depends on §HZ shipping first** — `hazard_candidates` is the write target.

### SDS.1 Behavior

**External link.** `/admin/integrations` page shows an "SDS Manager" card with an "Open SDS Manager" button (`target="_blank"`) pointing at a configurable external URL via `NEXT_PUBLIC_SDS_MANAGER_URL` (default `https://sds.placeholder.example`). The card also shows a brief description of what the integration does and the import-flow CTA below.

**Import flow.** On `/hazards/candidates`, an "Import from SDS Manager" button opens a modal with a hardcoded catalog of 6 chemicals. User selects 1+ chemicals and clicks "Import". For each selected SDS, the system creates 1..n `hazard_candidates` rows with `source_type='sds_import'` and `source_reference_id=<sds.id>`, populated from the chemical's GHS classification. The `proposed_metadata` jsonb stores the full SDS reference (id, product name, CAS, H-statement, suggested controls) so the EHS Manager can apply controls automatically when converting the candidate.

### SDS.2 Dummy catalog

`lib/sds/dummy-catalog.ts`:

```typescript
import type { HazardCategory, ControlLevel } from "@/lib/risk/types";

export type DummySds = {
  id: string;                          // "SDS-TOL-001"
  product_name: string;                // "Toluene"
  manufacturer: string;
  cas_number: string;
  ghs_pictograms: string[];            // ['GHS02','GHS07','GHS08','GHS09']
  signal_word: "danger" | "warning";
  hazards: {                           // each becomes a hazard_candidate
    category: HazardCategory;          // matches hazard_category enum
    title: string;                     // "Flammable liquid"
    description: string;
    h_statement: string;               // "H225"
  }[];
  suggested_controls: {
    level: ControlLevel;
    description: string;
  }[];
};

export const DUMMY_SDS_CATALOG: DummySds[] = [
  {
    id: "SDS-TOL-001",
    product_name: "Toluene",
    manufacturer: "ChemCo Industries",
    cas_number: "108-88-3",
    ghs_pictograms: ["GHS02", "GHS07", "GHS08"],
    signal_word: "danger",
    hazards: [
      { category: "chemical", title: "Highly flammable liquid and vapor",
        description: "Flash point 4°C. Vapor can travel to ignition source.",
        h_statement: "H225" },
      { category: "chemical", title: "Skin irritation",
        description: "Causes skin irritation on prolonged contact.",
        h_statement: "H315" },
      { category: "chemical", title: "Reproductive toxicity",
        description: "Suspected of damaging the unborn child.",
        h_statement: "H361d" },
      { category: "chemical", title: "Specific target organ toxicity",
        description: "May cause drowsiness or dizziness.",
        h_statement: "H336" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Use in fume hood or with local exhaust ventilation." },
      { level: "engineering", description: "Bond and ground all transfer equipment." },
      { level: "administrative", description: "Eliminate ignition sources within 10 m." },
      { level: "ppe", description: "Nitrile gloves, splash goggles, chemical apron." },
    ],
  },
  {
    id: "SDS-SUL-001",
    product_name: "Sulfuric Acid 98%",
    manufacturer: "AcidWorks Ltd.",
    cas_number: "7664-93-9",
    ghs_pictograms: ["GHS05"],
    signal_word: "danger",
    hazards: [
      { category: "chemical", title: "Corrosive to metals",
        description: "Reacts with most metals to release hydrogen gas, which may ignite.",
        h_statement: "H290" },
      { category: "chemical", title: "Severe skin burns and eye damage",
        description: "Causes severe skin burns and permanent eye damage on contact.",
        h_statement: "H314" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Closed transfer / acid-resistant containment with secondary catch." },
      { level: "engineering", description: "Eyewash station and safety shower within 10 m of the work area." },
      { level: "administrative", description: "Buddy system; written acid-handling procedure with H&S sign-off." },
      { level: "ppe", description: "Acid-resistant gauntlets, full face shield, chemical apron, splash boots." },
    ],
  },
  {
    id: "SDS-HYD-001",
    product_name: "Hydraulic Oil ISO VG 46",
    manufacturer: "PetroLine",
    cas_number: "64742-65-0",
    ghs_pictograms: [],
    signal_word: "warning",
    hazards: [
      { category: "chemical", title: "Eye irritation",
        description: "May cause mild eye irritation on direct contact.",
        h_statement: "H319" },
      { category: "environmental", title: "Aquatic toxicity (chronic)",
        description: "Toxic to aquatic life with long-lasting effects if released to drains or waterways.",
        h_statement: "H413" },
      { category: "physical", title: "Slip / fall on spilled oil",
        description: "Spilled hydraulic oil creates a slip hazard until absorbed.",
        h_statement: "n/a (workplace)" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Drip trays under all couplings and reservoirs." },
      { level: "administrative", description: "Spill response kit within 5 m; immediate clean-up SOP." },
      { level: "ppe", description: "Nitrile gloves; oil-resistant footwear." },
    ],
  },
  {
    id: "SDS-IPA-001",
    product_name: "Isopropanol (IPA) 99%",
    manufacturer: "ChemCo Industries",
    cas_number: "67-63-0",
    ghs_pictograms: ["GHS02", "GHS07"],
    signal_word: "danger",
    hazards: [
      { category: "chemical", title: "Highly flammable liquid and vapor",
        description: "Flash point 12°C. Vapor forms explosive mixtures with air.",
        h_statement: "H225" },
      { category: "chemical", title: "Serious eye irritation",
        description: "Causes serious eye irritation on contact.",
        h_statement: "H319" },
      { category: "chemical", title: "Specific target organ toxicity",
        description: "May cause drowsiness or dizziness on inhalation.",
        h_statement: "H336" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Local exhaust ventilation at the point of use." },
      { level: "engineering", description: "Bonded / grounded dispensing." },
      { level: "administrative", description: "No-smoking / no-open-flame zone within 10 m." },
      { level: "ppe", description: "Nitrile gloves; splash goggles." },
    ],
  },
  {
    id: "SDS-ACE-001",
    product_name: "Acetone",
    manufacturer: "SolvSource",
    cas_number: "67-64-1",
    ghs_pictograms: ["GHS02", "GHS07"],
    signal_word: "danger",
    hazards: [
      { category: "chemical", title: "Highly flammable liquid and vapor",
        description: "Flash point -20°C. Extremely flammable; vapor heavier than air, can travel long distances.",
        h_statement: "H225" },
      { category: "chemical", title: "Serious eye irritation",
        description: "Causes serious eye irritation.",
        h_statement: "H319" },
      { category: "chemical", title: "Specific target organ toxicity",
        description: "May cause drowsiness or dizziness.",
        h_statement: "H336" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Use only with mechanical ventilation; closed containers when not in use." },
      { level: "administrative", description: "Restrict to designated solvent-handling area." },
      { level: "ppe", description: "Solvent-resistant gloves; chemical goggles." },
    ],
  },
  {
    id: "SDS-NAH-001",
    product_name: "Sodium Hydroxide (caustic soda) 50%",
    manufacturer: "AlkaliCo",
    cas_number: "1310-73-2",
    ghs_pictograms: ["GHS05"],
    signal_word: "danger",
    hazards: [
      { category: "chemical", title: "Corrosive to metals",
        description: "May be corrosive to metals — store away from aluminum and zinc.",
        h_statement: "H290" },
      { category: "chemical", title: "Severe skin burns and eye damage",
        description: "Causes severe skin burns and permanent eye damage on contact.",
        h_statement: "H314" },
    ],
    suggested_controls: [
      { level: "engineering", description: "Closed transfer; bunded storage with secondary containment." },
      { level: "engineering", description: "Eyewash station and safety shower within 10 m." },
      { level: "administrative", description: "Caustic-handling permit + buddy system." },
      { level: "ppe", description: "Alkali-resistant gauntlets, full face shield, chemical apron." },
    ],
  },
];
```

> **`HazardCategory` and `ControlLevel`** are TS types exported from `lib/risk/types.ts` — the same source used by §HZ and §JSA. Keeps the catalog type-checked against the canonical enum sets.

### SDS.3 Component

`components/sds/sds-import-modal.tsx` — shadcn Dialog wrapping a multi-select list of chemicals from `DUMMY_SDS_CATALOG`. Each row shows product name + CAS number + signal-word badge + pictogram chips + hazard count. On submit, calls `importSdsHazards` server action which creates `hazard_candidates` rows. Returns a toast with the count of candidates created.

`components/admin/sds-integration-card.tsx` — Server Component for the `/admin/integrations` page. Renders the SDS Manager card with the configurable external link, a brief description, and a button linking to `/hazards/candidates` (for the import flow).

### SDS.4 Server action

`actions/sds.ts`:

- `importSdsHazards(siteId, sdsIds[])` — for each SDS in the catalog, iterates `sds.hazards[]` and creates one `hazard_candidates` row per H-statement:
  - `source_type = 'sds_import'`
  - `source_reference_id = sds.id` (e.g. `"SDS-TOL-001"`)
  - `site_id = siteId`
  - `proposed_title = hazard.title`
  - `proposed_category = hazard.category`
  - `proposed_description = hazard.description` (includes H-statement reference)
  - `proposed_metadata = { sds_id, product_name, cas_number, h_statement, suggested_controls }` so the EHS Manager can apply suggested controls automatically when converting the candidate (the §HZ `convertCandidate` action reads `proposed_metadata.suggested_controls` and pre-fills the controls form)
  - Returns `{ ok: true, count: number }`

Auth: gated on `hazard_candidate:create` permission (proposed name, finalized at build time alongside the §HZ permission keys).

### SDS.5 What this stub does NOT do

- **No `sds_records` table** — no tracking of which SDSs have been imported into the org, no SDS-list management surface in `/admin`. The hazard candidate queue is the only persistence layer.
- **No `sds_chemical_uses` table** — no tracking of which sites / processes / chemicals are in active use.
- **No SDS revisions** — no version history, no "this SDS was updated by the manufacturer" workflow.
- **No real API calls** to a live SDS Manager backend.

When real API credentials are available, replace `DUMMY_SDS_CATALOG` with an API call (likely `lib/sds/api-client.ts` wrapping the SDS Manager REST endpoints) and add the deferred tables. The candidate creation flow in `actions/sds.ts` stays identical — only the data source changes.

### SDS.6 Acceptance

- The `/admin/integrations` page shows the SDS Manager card with an external link to `NEXT_PUBLIC_SDS_MANAGER_URL`.
- The `/hazards/candidates` page has an "Import from SDS Manager" button.
- The modal shows 6 chemicals.
- Selecting Toluene + clicking Import creates 4 `hazard_candidates` rows (one per H-statement).
- Candidates appear in the queue with `source_type='sds_import'`, source attribution shown ("SDS-TOL-001 · Toluene").
- Converting a candidate pre-fills the controls form with `proposed_metadata.suggested_controls`.

### SDS.7 Decisions log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-11 | **Stub the SDS integration end-to-end rather than skip it** | The integration story is part of the product narrative — SDS Manager is a sister sub-company, and "we feed hazards from SDS Manager into the safety platform" is a load-bearing demo moment. Skipping it would mean every demo conversation answers "where do hazards come from?" with "imagination." The stub costs ~200 LOC + 1 modal and lights up the whole flow. |
| 2026-05-11 | **Hardcoded TS catalog `lib/sds/dummy-catalog.ts`, not a seed table** | When the real API arrives, the swap-in is a one-file refactor of `actions/sds.ts` (replace catalog import with API client). A seed table would add a migration to remove later, plus complicate the demo reset story. Catalog ships as a typed const checked against `HazardCategory` / `ControlLevel`. |
| 2026-05-11 | **6 chemicals covering 3 hazard families** | Toluene + IPA + Acetone (flammable), Sulfuric Acid + Sodium Hydroxide (corrosive), Hydraulic Oil (low-hazard with environmental + slip risk). Enough variety that a demo can pick any one and tell a different story. Each entry has realistic GHS pictograms, CAS, H-statements, and suggested controls so the candidates look plausible. |
| 2026-05-11 | **No `sds_records` or `sds_chemical_uses` tables in v1** | The hazard candidate queue does double duty as the SDS-import landing pad. Full SDS lifecycle (revisions, usage tracking, expiry) needs its own module — deferred to a v2.5 / real-API phase once the live integration shape is known. |
| 2026-05-11 | **Integration surface lives at `/admin/integrations`, not `/settings`** | Integrations are org-scoped, not user account preferences. The existing Phase 8 `/settings` is personal (Profile / Security / Appearance / Sign out). Creating `/admin/integrations` establishes a home for future integrations (HSE/OSHA submission APIs, training providers, contractor portals, etc.). Spec text says "Settings → Integrations" reflecting the user's mental model; the actual route is admin-scoped. |
| 2026-05-11 | **External link target is a configurable env var, not hardcoded** | `NEXT_PUBLIC_SDS_MANAGER_URL` (default `https://sds.placeholder.example`). Production deploys may have a real SDS Manager URL before the API is ready, and customers running on-prem will have their own. Build-time and deploy-time both stay clean. |
| 2026-05-11 | **`proposed_metadata` jsonb carries suggested controls** | The §HZ `convertCandidate` server action already accepts a "contextualization" payload (the human review step). Surfacing the SDS-suggested controls into that payload via `proposed_metadata` lets the convert form pre-fill the controls section, which is the highest-value EHS time-saver from this integration. JSONB keeps the schema clean — no new control-pre-fill table. |
| 2026-05-11 | **Multi-select catalog → batch import (N candidates per SDS)** | A single click can create 4–8 candidates (e.g. selecting Toluene generates 4 rows for the 4 H-statements). The queue surfaces them grouped by `source_reference_id` so the EHS Manager can review the whole SDS context in one pass. Single-record import would force tedious one-by-one click-through. |
| 2026-05-11 | **Depends on §HZ shipping first** | `hazard_candidates` is the only write target for the import action. Build order: §HZ migration + candidate queue UI → §SDS-INTEGRATION (1 modal + 1 admin card + 1 action + 1 catalog file). Could land in the same v2 phase as §HZ if scope allows. |

