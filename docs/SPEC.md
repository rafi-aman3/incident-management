# EHS Incident Management — Spec

**Status:** Living document
**Source PRD:** v1.0, 2026-05-02, Rafid Fahmid (SDS Manager)
**Last updated:** 2026-05-04

This spec is the single source of truth for what we are building. The PRD is the human-readable narrative; this document is the structured, queryable spec we work against. When the PRD and this file disagree, this file wins after we resolve the conflict here.

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
- Narrative description (voice-to-text option)
- Attachments (drag-and-drop photos/files)

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
- **Incident summary** — read-only snapshot of incident data
- **Evidence** — photos, documents, maintenance logs, SDS sheets
- **Root cause analysis** — 5-Why structured chain
- **Findings** — free-text narrative
- **Activity timeline** — chronological event log

### Close options
- **Close — no CAPA needed** — root cause addressed in-situ or one-off
- **Assign CAPA** — one or more corrective/preventive actions required

---

## 6. CAPA module (Module 3)

### Types
- **Corrective** — fixes the immediate problem (replace worn fitting)
- **Preventive** — prevents recurrence (update PM checklist)

### Lifecycle
1. `created` — title, description, owner, due date, type assigned
2. `in_progress` — owner implementing
3. `completed` — owner marks done; moves to verification queue
4. `pending_verification` — independent verifier reviews
5. `verified` / `closed` — verifier confirms; CAPA closed

### CRITICAL RULE
**The CAPA owner cannot close their own CAPA.** An independent verifier must confirm the action was properly implemented.

Enforced at three layers:
1. UI — "Verify Closure" button disabled with tooltip when viewer is owner
2. Server action — rejects request when `owner_id === verifier_id` or session user is owner
3. DB CHECK constraint — `verifier_id IS NULL OR verifier_id <> owner_id`

### Card fields
- CAPA ID (`CAPA-YYYY-NNNN`)
- Title / description
- Source investigation (linked)
- Type (corrective / preventive)
- Owner (responsible)
- Verifier (independent)
- Due date
- Progress bar
- Status badge (In Progress / Pending Verification / Overdue / Closed)

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

Both displayed on Dashboard and OSHA 300A.

### RIDDOR-specific fields captured
- Employment status (employee / contractor / self-employed / public)
- Dangerous occurrence type (scaffold collapse, explosion, electrical short, …)
- HSE reference number (after submission)

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
| Specified injury (fracture, amputation, …) | Phone HSE | F2508 within 10 days |
| Over-7-day incapacitation | — | F2508 within 15 days of accident |
| Occupational disease | — | F2508 on receipt of diagnosis |
| Dangerous occurrence | Phone HSE | F2508 within 10 days |

---

## 10. Data model (key entities)

| Entity | Key fields |
|---|---|
| **Incident** | `id, ref_code, title, type, description, occurred_at, site_id, area, location, severity, track, status, reporter_id, osha_recordable, riddor_reportable, created_at` |
| **Injured Person** | `incident_id, name, job_title, department, supervisor, employment_status, body_parts, injury_nature, mechanism, object_substance, treatment, days_away, days_restricted, fatality, hospitalized` |
| **Investigation** | `id, incident_id, lead_investigator, team, status, started_at, due_date, root_cause_summary, findings, rca_method` |
| **RCA Why** | `investigation_id, level (1–5), question, answer` |
| **Evidence** | `investigation_id, type, storage_path, file_name, mime_type, size_bytes, uploaded_by, uploaded_at` |
| **CAPA** | `id, ref_code, investigation_id, incident_id, type (corrective/preventive), title, description, owner_id, verifier_id (CHECK ≠ owner_id), due_date, status, progress, completed_at, verified_at` |
| **Site** | `id, name, address, country (US/GB), region, timezone` |
| **User / Profile** | `id (= auth.users.id), full_name, email, role, site_id, department` |
| **Notification** | `id, kind, incident_id, capa_id, recipient_id, site_id, title, body, deadline_at, acknowledged_at, resolved_at, created_at` |
| **Severity Override** | `id, incident_id, original_severity, new_severity, overridden_by, reason, created_at` (immutable) |
| **Activity Event** | `incident_id?, investigation_id?, capa_id?, actor_id, verb, payload, created_at` |
| **Witness** | `incident_id, name, contact, statement` |

### Enums
- `incident_type`: 8 values (above)
- `severity`: `S1, S2, S3, S4, S5`
- `track`: `A, B, C`
- `incident_status`: `draft, submitted, classified, under_investigation, awaiting_capa, closed`
- `investigation_status`: `pending_assignment, in_progress, awaiting_capa, closed`
- `capa_type`: `corrective, preventive`
- `capa_status`: `created, in_progress, completed, pending_verification, verified, closed`
- `user_role`: `worker, supervisor, ehs_manager, site_admin`
- `notification_kind`: `osha_8hr, osha_24hr, riddor_immediate, riddor_f2508_10d, riddor_7day, riddor_disease, capa_overdue, assigned`
- `body_part`: head, neck, chest, abdomen, back, left/right × {arm, hand, leg, foot, eye}, other

---

## 11. Roles & permissions (RLS)

| Role | Primary actions |
|---|---|
| **Worker** | Reports incidents, submits observations, sees own incidents |
| **Supervisor** | Reviews/overrides severity, manages team incidents within site |
| **EHS Manager** | Leads investigations, assigns CAPA, manages regulatory reports for their site |
| **Site Administrator** | Configures sites, users, roles, notification rules; access to everything |

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

### Open questions
1. **Hosting** — assume Vercel + Supabase. Confirm before Phase 0 wraps (affects cron job approach).
2. **Email delivery** — for demo, notifications stay in-app only. Confirm OK.
3. **Multi-tenancy** — single org, multi-site (US Houston + UK Manchester). Confirm OK (vs multi-org).
4. **Real-time updates** — polling on focus is good enough for the demo? (Supabase Realtime available but adds complexity.)
