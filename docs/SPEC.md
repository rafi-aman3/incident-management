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
| **9c** | `<ArgusInvestigator>` on `/investigations/[id]` — paste description + voice/text witness statements → streamed timeline + RCA narrative draft → "Push to investigation" approval gate |
| **9d** | `<ArgusMagicWand>` on risk-matrix cells, finding-→incident escalation, CAPA verification method, OSHA reportability confidence pane |
| **9e** | Global side panel page-context aware; 4 Dashboard `<ArgusInsightTile>` cards + tiles on CAPA / Inspections / Reports |
