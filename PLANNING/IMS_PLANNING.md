# EHS Incident Management System — Master Planning Document

> This document brings together four sources: the SDS Manager PRD (`EHS_Incident_Forms_Latest.pdf` and `uploads/PRD.txt`), the printable forms package (`uploads/Forms.txt`), the React HTML demo (`IncidentManagementSystem-2/`), and current (2026) research about incident management systems.
>
> **Status:** Planning draft for the production build. Use it together with the PRD v1.0 (May 2026), the Forms Package v1.1, and the SDS Manager Design System.

---

## 0. Source Material We Reviewed

| Source | What it gives us |
|---|---|
| `docs/EHS_Incident_Forms_Latest.pdf` (10 chapters + 2 appendices, v1.1, May 2026) | Full paper forms for collecting field data. Covers Injury, Illness, Near-miss, Property Damage, Environmental Release, Unsafe Condition, Observation, Investigation, CAPA, and Dangerous Occurrence. Lists every field for each incident type. |
| `docs/IncidentManagementSystem-2/uploads/PRD.txt` | The 29-page PRD: goals, modules, three-track routing, risk matrix, OSHA and RIDDOR rules, data model, design tokens, and demo screen descriptions. |
| `docs/IncidentManagementSystem-2/uploads/Forms.txt` | A plain-text copy of the printable forms package. We use it as the field list. |
| `docs/IncidentManagementSystem-2/*.jsx` + `EHS Incident Management.html` | A working React + Babel demo in the browser: Shell, Dashboard, Incidents list and detail, 3-step ReportWizard with body map and 5×5 matrix, Investigation Kanban + Detail, CAPA module, Reports module (OSHA 300 / 300A / 301 / RIDDOR previews). |
| `docs/IncidentManagementSystem-2/styles.css` + `colors_and_type.css` | Ready-to-use visual tokens for the SDS Manager design system. |
| `uploads/Investigation Routing Logic.png` | A picture that shows the routing decision (Track A / B / C). |
| Web research (May 2026) | ISO 45001 standard, OSHA ITA 2026 deadlines, root-cause analysis methods (5-Why, Fishbone, TapRoot), CAPA effectiveness checks, 5×5 risk matrix rules, RIDDOR 2013 deadlines, EHS KPI strategy. |

---

## Foundational Concepts (read this first)

This section explains the five main words used in this document. Each word has a simple definition. Each one points to the longer section that explains the details.

### What is Incident Management?
**Incident Management** is the full process of handling every safety event at work. The process has five steps:
1. Record what happened.
2. Decide how serious it is.
3. Decide what action to take.
4. Fix the problem so it does not happen again.
5. Send the right report to the government safety office.

In this system, the work is split into three modules that follow each other: **Incidents → Investigation → CAPA**. There is also a **Reports** layer that runs at the same time as the three modules. Reports use data from all three.

The goal of the system is simple. When a worker says "something just happened," the system should turn that report into:
- The right paper for OSHA (US safety office) or HSE (UK safety office).
- The right action plan to fix the problem.
- A clear time line so no deadline is missed.

*(See §1 and §4 for the design. See §5 for the routing engine.)*

### What is an Incident?
An **incident** is any safety event reported at work. The word "event" is wide — it does not mean only accidents. The system supports **eight types** of incidents:

1. **Injury** — a worker is hurt.
2. **Illness** — a worker gets sick from work (for example, hearing loss from noise).
3. **Near-miss** — something almost caused harm but did not.
4. **Property damage** — equipment, machines, or buildings are damaged.
5. **Environmental release** — a spill, leak, or release of gas to the air, water, or soil.
6. **Unsafe condition** — a dangerous situation is found (for example, a missing machine guard).
7. **Observation** — a general safety note, good or bad.
8. **Dangerous occurrence** — a serious event that the UK rules (RIDDOR) require us to report.

Workers report each incident with a **3-step Report Wizard**:
1. What happened.
2. Type-specific details + a 5×5 risk matrix.
3. Review and submit.

The system then gives the incident an ID like `INC-2026-0142`. It also picks a severity level (S1 to S5) and a routing track (A, B, or C) by itself.

The incident record stores the facts: who, what, when, where. It also stores who was hurt, what PPE (safety gear) was worn, what object caused the harm, and any witnesses or photos.

**Important point:** an "incident" is not only an injury. The system also records **near-misses and observations**. The ISO 45001 standard and modern safety practice ask us to record these too. They warn us about problems before someone is hurt.

*(See §6 for the report flow. See §10 for the risk matrix. See §12 for the data model.)*

### What is an Investigation?
An **investigation** is the careful study of what happened after a Track A or Track B incident. The investigation answers two questions:
- Why did this happen?
- Could it happen again?

Track C incidents (S4 and S5, the smallest) skip the investigation. They close by themselves.

Each investigation has its own ID (for example, `INV-2026-0078`). It has a **lead investigator** and an optional **team**. It lives on a **Kanban board** with four columns:
1. **Pending assignment** — no lead picked yet.
2. **In progress** — the lead is doing the work.
3. **Awaiting CAPA** — the study is done; the action plan is being made.
4. **Closed** — the investigation is finished.

Inside the investigation, the team does three things:
- **Collects evidence** — photos, work procedures (SOPs), Safety Data Sheets (SDS), witness statements, machine repair logs.
- **Runs root-cause analysis** — uses the 5-Why method (asking "why?" five times). The Fishbone method is planned for version 1.5.
- **Writes findings** — a short report that describes the conclusions.

The investigation closes in one of two ways:
- **Close — no CAPA needed:** the cause was a one-time thing, or it was already fixed at the spot.
- **Assign CAPA:** one or more actions are needed to fix the cause for good.

**Important rule:** closing an investigation does NOT close the incident or the CAPAs. Each one closes by itself.

*(See §7 for the module. See §16.3 for the trade-offs of each RCA method.)*

### What is a CAPA?
**CAPA** stands for **Corrective and Preventive Action**. A CAPA is the actual fix. It is the work the company promises to do after an investigation. Each CAPA has:
- A clear deadline.
- An owner (the person who does the work).
- A verifier (a different person who checks the work).

There are two types:
- **Corrective action** — fixes the problem now (for example, "Replace the worn part on grinder #4").
- **Preventive action** — stops the problem from happening again (for example, "Add weekly part-checks to the maintenance list").

Each CAPA gets an ID like `CAPA-044`. It moves through five stages:
1. **Created** — the CAPA is opened.
2. **In progress** — the owner is doing the work.
3. **Completed** — the owner says the work is done.
4. **Pending verification** — a different person checks the work.
5. **Verified / Closed** — the checker confirms the work is good. The CAPA is finished.

The CAPA also shows on a board. The system tracks late CAPAs and sends daily reminders.

**The most important rule:** the **owner cannot close their own CAPA**. A different person (the verifier) must check that the action really worked. The verifier needs to see proof. Only then can the CAPA close.

This rule is the difference between a real safety system and a simple checklist tool. The system enforces this rule in the database, not only in the screen design. Without this rule, people just approve their own work without checking. With this rule, the company has a strong audit record.

*(See §8 for the full life cycle. See §16.4 for why this check is the most-skipped step in industry.)*

### What are Reports?
**Reports** are the **regulatory output layer**. They run all the time. They are NOT a workflow step that a person finishes and ticks off. They are auto-built views of the incident data. They update the moment a new case is recorded.

The system makes four reports:

1. **OSHA 300 Log** — a running list of all recordable injuries and illnesses. It has 13 columns (A to M). It must be updated within 7 days of a new case. It must be kept for 5 years.

2. **OSHA 300A Annual Summary** — a yearly total. It must be posted in the workplace from **February 1 to April 30**. It must be sent to the OSHA ITA portal by **March 2** for the year before.

3. **OSHA 301 Incident Report** — a detailed form for one incident. It has 18 fields. The system fills it out from the incident and investigation data. It must be filed within 7 days. Field 17 ("the object or substance that directly harmed the employee") is captured clearly.

4. **RIDDOR F2508** — a UK-only form. It is event-based (no annual list). For deaths, specified injuries, and dangerous occurrences: phone HSE without delay, then send the F2508 within 10 days. For more-than-7-day absences: report online within 15 days.

Reports also show **TRIR** and **DART** — the two standard safety numbers (per 200,000 hours worked) — on the Dashboard and inside the 300A.

The reports module supports:
- PDF and CSV export.
- Direct upload to OSHA ITA (in CSV format).
- HSE online submission.

**Key idea:** the reports are never out of date. They are not written by hand. They are a real-time view of the incident data. So the OSHA 300 Log on the screen is the OSHA 300 Log of record.

*(See §9 for the regulatory details. See §16.2 for the OSHA ITA 2026 deadlines. See §16.6 for the leading-vs-lagging KPI strategy.)*

---

## 1. Executive Summary

The EHS Incident Management System (IMS) is an extra module for the SDS Manager platform. It owns the **full life of a workplace safety event**. It starts when a shop-floor worker reports something. It ends when the CAPA is verified and the regulator-ready report is sent. The system has four key ideas:

1. **Capture is fast and easy.** A 3-step wizard with type-specific fields. Any worker can file a report in a few minutes. The wizard handles all eight incident types defined by OSHA and RIDDOR.
2. **Routing is automatic but can be overridden.** A 5×5 risk matrix sets the severity and picks the track. Supervisors can override the result. The system keeps an audit log that cannot be changed.
3. **Notifications fire at classification, not at the end.** OSHA 8-hour and 24-hour deadlines, and RIDDOR "without delay" deadlines, start the moment severity is set. They do not wait for the investigation to finish.
4. **CAPA closure needs a different person.** The owner cannot close their own CAPA. This rule is in the data model, not only in the screen.

This planning document is the bridge between the source files (PRD, forms, demo) and the production build.

---

## 2. Goals and Non-Goals

### 2.1 Goals (v1)
- One guided report flow that handles all 8 incident types.
- Auto-set severity (with the 5×5 risk matrix) and route to Track A, B, or C.
- 5-Why root-cause analysis inside the Investigation module.
- CAPA tracking with a required independent check and overdue alerts.
- Auto-build the OSHA 300 Log, 300A Annual Summary, OSHA 301 per-incident reports, and RIDDOR F2508 packages from the captured data.
- Send regulatory-deadline reminders **at classification time**, not at the end.
- A live dashboard with TRIR, DART, open incidents, overdue CAPAs, and a regulatory deadline banner.

### 2.2 Non-Goals (v1)
- No native iOS or Android app (the responsive web is enough).
- No AI prediction of trends (we show KPIs only, no machine learning).
- No HRIS or payroll integration.
- No multiple languages (English only).
- No multi-tenant SaaS (one SDS Manager tenant per install, but many sites per tenant).

### 2.3 Sites in scope for v1
- **Cleveland Plant** (US — under OSHA rules).
- **Sheffield Site** (UK — under HSE / RIDDOR rules).

---

## 3. Target Users and Roles

| Role | Main actions | Permissions |
|---|---|---|
| **Shop-floor worker** | Reports incidents and observations. Sees their own reports. | Can create incidents (any type). Can view their own reports. Can attach evidence. |
| **Supervisor** | Reviews and overrides severity. Assigns triage owners. Manages team incidents. | All worker permissions, plus override classification, assign within team, escalate to investigation. |
| **EHS Manager** | Leads investigations. Assigns CAPAs. Manages regulatory reports. | All supervisor permissions, plus open and close investigations, submit OSHA / RIDDOR reports, assign verifiers. |
| **Independent verifier** | Confirms CAPA effectiveness and closes it (cannot be the owner). | Can sign off on CAPAs they did not own. |
| **Site administrator** | Sets up sites, users, roles, notification rules, and regulator references. | All EHS Manager permissions, plus system setup. |

> **Separation-of-duties rule:** the system MUST NOT let the same person be both `owner` and `verifier` on a CAPA. This rule is in the API layer, not only in the screen.

---

## 4. System Architecture

### 4.1 The big picture (3 modules + a continuous reports layer)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         EHS INCIDENT MANAGEMENT                          │
│                                                                          │
│  Module 1: INCIDENTS  ─►  Module 2: INVESTIGATION  ─►  Module 3: CAPA    │
│  (capture, classify,      (5-Why RCA, evidence,       (corrective +      │
│   route)                   findings)                   preventive,       │
│                                                        verified close)   │
│                                                                          │
│            └───────────────────  REPORTS  ────────────────────┘          │
│                  (OSHA 300 / 300A / 301 · RIDDOR F2508)                  │
│                  Continuous output — not a workflow step                 │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Three close events, all separate
The life cycle has **three close events**. Each one is independent. Each one is in the audit log.

| Close event | When it fires | Who owns it | What it ends |
|---|---|---|---|
| **Incident closed** | First capture and classification are done. The incident is routed to Track A / B / C. | Reporter or Supervisor | The triage phase |
| **Investigation closed** | RCA is finished. May or may not lead to CAPA. | Lead investigator | The investigation phase |
| **CAPA closed** | Action is done AND a different person has confirmed it works. | Verifier (not the owner) | The action phase |

Closing an incident does **not** close its investigation. Closing an investigation does **not** close its CAPAs. This is a key design rule. The data model must reflect it (each entity has its own `closed_at` timestamp).

### 4.3 Tech-stack notes (must confirm with platform team)

- **Frontend:** This repo is a Next.js project with breaking changes from normal Next.js (see `AGENTS.md`). Before writing any app code, read `node_modules/next/dist/docs/`. Do not assume App Router or Pages Router behavior from prior knowledge.
- **UI library:** MUI v5+ with Emotion (per PRD §13). The demo uses hand-written CSS. The production build should use MUI components and keep the SDS Manager tokens.
- **State / data:** TBD — likely TanStack Query against an SDS Manager backend. The save model needs platform-team confirmation.
- **Database:** PostgreSQL 16+ recommended (see §12.4 for the full reasoning, ORM options, hosting, and migration plan). Final choice must align with the existing SDS Manager stack.
- **Charts:** TBD (the demo uses simple CSS bars; for production, pick a library that uses the SDS color tokens).

---

## 5. The Three-Track Workflow Engine

This is the decision gate at the heart of the system. A classified incident goes to exactly one track.

| Track | Severity | What happens | Default outcome |
|---|---|---|---|
| **A — Full investigation** | S1 (Critical), S2 (Major) | Lead investigator + team. Full 5-Why RCA. Evidence is required. CAPA must be considered. All deaths, amputations, hospital cases, and RIDDOR specified injuries go here. | Investigation → CAPA(s) → verified close |
| **B — Light investigation** | S3 (Moderate) | Supervisor-led short review. Simple RCA. CAPA is optional. Used for high-potential near-misses and moderate injuries with medical care. | Investigation → optional CAPA → close |
| **C — Log and close** | S4 (Minor), S5 (Insignificant) | No investigation. Log it, give first aid if needed, auto-close. Used for paper cuts and low-risk observations. | Auto-close with full audit trail |

### 5.1 Routing rules per incident type
- **Injury** — based on severity. First aid only → C. Medical treatment → B. Hospital, amputation, or death → A.
- **Illness** — confirmed work disease → A or B. Watching only → C.
- **Near-miss** — could have been fatal → A. All others → B at minimum.
- **Property damage** — major equipment loss → A. Minor → B or C.
- **Environmental release** — reportable amount → A. Small contained spill → B or C.
- **Unsafe condition** — immediate danger → A. Other cases → use the risk matrix.
- **Observation** — almost always C (log only). Move up if a hazard is found.
- **Dangerous occurrence** — **always A** (RIDDOR rules require it).

### 5.2 The override rule
Supervisors can override the auto-classification. The override writes a log entry: original severity, new severity, who, when, and the reason. The audit trail **cannot be changed** (append-only `override_log` table).

---

## 6. Module 1 — Incident Reporting

### 6.1 The eight incident types
| Type | Definition |
|---|---|
| Injury | A person is physically hurt (cut, burn, fracture). |
| Illness | A work-caused disease (hearing loss, dermatitis). |
| Near-miss | An event that could have caused harm but did not. |
| Property damage | Damage to equipment, machines, or buildings. |
| Environmental release | A spill, leak, or release to air, water, or soil. |
| Unsafe condition | A dangerous situation found (missing guard, exposed wire). |
| Observation | A general safety note (good or bad). |
| Dangerous occurrence | A RIDDOR-reportable event (collapse, explosion, scaffold over 5 m). |

### 6.2 The 3-step reporting wizard

**Step 1 — What happened (same for all types)**
- Type selection (8 visual cards).
- Title (free text. The system suggests an example based on the chosen type).
- Date and time.
- Site, area, and specific location.
- Narrative description (50 words minimum, with voice-to-text option).
- Attachments (drag-and-drop photos or files, up to 25 MB each).

**Step 2 — Details (different for each type) + risk matrix**

This step changes based on the type. See `ReportWizard.jsx` and the PRD/Forms appendix for the full field list.
- **Injury:** injured-person info, body map (a clickable picture), injury type, mechanism, **OSHA 301 #17 object that caused the harm**, treatment, OSHA recordability, PPE, witnesses, severity, employment status (RIDDOR).
- **Illness:** affected-person info, illness category (long list), exposure type, substance or agent, occupational class, medical status.
- **Near-miss:** potential severity (what could have happened), hazard category, contributing factors, immediate actions, "is this a repeat?" flag.
- **Property damage:** equipment details, damage type, cost estimate, status, impact, repair plan.
- **Environmental release:** substance info (CAS, quantity), where it went, containment status, regulatory flags (EPA, state, NRC, RIDDOR), cleanup method.
- **Unsafe condition:** hazard type, risk level, urgency, current controls, suggested action.
- **Observation:** observation type (positive or negative), category, action taken, follow-up.
- **Dangerous occurrence:** Schedule 2 type, persons at risk, equipment, possible consequences, immediate actions, **HSE notification record** (date, time, reference number).

This step also has the 5×5 risk matrix. The system shows the auto-set severity. The user can override it (and must give a reason).

A witnesses field is shared across all types.

**Step 3 — Review and submit**
- Summary view (type, title, when, where, reporter, severity, track, OSHA / RIDDOR flags).
- "What happens next" timeline (auto-classification → notifications → investigation creation → OSHA 301 draft).
- Submit fires classification, notification triggers, and (for Track A or B) auto-creates the investigation record.

### 6.3 Triage actions on the incident detail screen
After submission, the incident appears in the Incidents list. From the detail view, the system suggests the next action based on severity:
- **Sev 1 or 2** → Escalate to investigation (Track A).
- **Sev 3** → Assign a triage owner (Track B).
- **Sev 4 or 5** → Close — no action (Track C).

Three modals support these actions: Assign, Escalate, Close. All write to the activity timeline.

---

## 7. Module 2 — Investigation

### 7.1 Kanban board (default view)
Four columns:
1. **Pending assignment** — created but no lead picked.
2. **In progress** — the lead is doing the analysis.
3. **Awaiting CAPA** — investigation done, CAPA suggested, action pending.
4. **Closed** — finished (with or without CAPA).

A flat list view is also available with the same data and lane filter.

### 7.2 Investigation detail view
- **Incident summary card** — a read-only copy of the original incident (saved when the investigation is created, so later edits to the incident do not silently change history).
- **Investigation team** — lead + members, each with a role label.
- **Evidence collection** — photos, documents (SOPs, SDS), maintenance logs, witness statements. Auto-attaches the SDS file from the SDS Manager library when chemicals are involved.
- **Root cause analysis (5-Why)** — a chain of "why" questions. Why 5 is marked as ROOT CAUSE. The forms PDF also defines a Fishbone view (People / Process / Equipment / Materials / Environment / Management). It should be a togglable second view in v1.
- **Findings** — free-text narrative.
- **Activity timeline** — time-ordered, append-only.
- **OSHA 301 draft banner** — when the source incident is OSHA-recordable, the system shows "OSHA 301 due in N days" and a one-click open-form button.

### 7.3 Investigation close options
The investigator picks one:
- **Close — no CAPA needed** (the cause was already fixed or was a one-time thing; reason field optional but suggested).
- **Assign CAPA** (one or more actions are needed; opens the CAPA-creation modal already filled in from the investigation).

---

## 8. Module 3 — CAPA

### 8.1 CAPA types
- **Corrective action** — fixes the problem now (for example, replace a worn part).
- **Preventive action** — stops it from happening again (for example, add a check to the maintenance plan).

### 8.2 CAPA life cycle (5 stages)
1. **Created** — title, description, type, owner, verifier, due date, source investigation.
2. **In progress** — the owner is doing the work.
3. **Completed** — the owner marks it done. It moves to the verification queue automatically.
4. **Pending verification** — a different person reviews the proof.
5. **Verified / Closed** — the verifier signs off. (Or `Reject` → back to In progress with a reason.)

### 8.3 The independent-check rule (most important rule)
- The CAPA owner **cannot** close their own CAPA. The system enforces this at the database layer.
- The verifier is set when the CAPA is created. The verifier MUST be a different user from the owner.
- If the verifier needs to be changed (for example, they leave the company), an admin must do it. The change is logged in the activity feed.
- Verification can result in: **Effective**, **Partially effective** (open a new CAPA), **Not effective** (reopen the CAPA), **Too early to verify** (set a re-verify date).

### 8.4 Card and record fields
Auto-built CAPA ID (for example `CAPA-044`), title, description, source investigation (linked), type (corrective or preventive), owner, verifier, due date, progress %, status badge, closed date.

### 8.5 Overdue handling
- Daily check at midnight in the site's time zone.
- On the due date, the system emails the owner.
- If the CAPA stays open after the due date, the system sends daily reminders. After 3 days late, it escalates to the EHS manager.
- Overdue CAPAs show on the Dashboard ("Overdue CAPAs" KPI tile) and in the Reports module.

---

## 9. Reports — Continuous Regulatory Output Layer

Reports are **not a workflow step**. They are auto-built from the incident data. They can be viewed, exported, or submitted at any time.

### 9.1 OSHA 300 — Log of work-related injuries and illnesses (US)
- A running list with **13 columns (A to M)**: case #, employee + job title, date, location, description, classification, death, days away, restriction, other, days-away count, restricted days, type code.
- Updated within 7 days of a new recordable case.
- Kept for 5 years.
- Live preview table on the Reports screen with PDF / CSV / "Submit to ITA" buttons.

### 9.2 OSHA 300A — Annual summary
- A yearly total of the 300 Log for the year before.
- **Posted from February 1 to April 30** (visible in the workplace).
- **Submitted to OSHA ITA by March 2** (calendar 2025 data is due **March 2, 2026**).
- Sites with **250+ employees** (or **20–249** in industries listed in Appendix A to Subpart E) must submit the 300A.
- Sites with **100+ employees** in industries listed in Appendix B must submit detailed 300/301 case data starting in the 2024 reporting year.
- Submission methods: web form, CSV upload, or API.

### 9.3 OSHA 301 — Injury and illness incident report
- One form per incident, **18 fields**, with the narrative core in fields 14 to 17.
- **Field 17 ("the object or substance that directly harmed the employee")** is a v1.1 emphasis. The report wizard captures it clearly.
- Must be done within **7 days** of a recordable case.

### 9.4 RIDDOR F2508 (UK — Sheffield Site only)
RIDDOR is **event-based**, not yearly. There are five reportable categories:

| Event | First action | Written F2508 |
|---|---|---|
| Death | Phone HSE without delay (0345 300 9923) | Within 10 days |
| Specified injury (fracture, amputation, sight loss, crush, burn over 10% of body, scalping, hypothermia, etc.) | Phone HSE without delay | Within 10 days |
| Over-7-day absence | — | Online F2508 within **15 days** |
| Occupational disease | — | Written report on diagnosis |
| Dangerous occurrence (Schedule 2) | Phone HSE without delay | Within 10 days |

Online portal: `https://notifications.hse.gov.uk/riddorforms/`.

The RIDDOR report screen tracks: phone-call date and time, person who called, HSE reference number, written-report date, RIDDOR online reference.

### 9.5 KPIs (auto-calculated, on the Dashboard and 300A)
- **TRIR** = (Recordable Cases × 200,000) / Total Hours Worked
- **DART** = (DART Cases × 200,000) / Total Hours Worked
- **Severity rate** = (Total Lost Workdays × 200,000) / Total Hours Worked

These are **lagging indicators** (they measure things that already happened). v1 will show them clearly. The 2026 industry view says we should also show **leading indicators** (early warnings). See §16 for the list.

---

## 10. Risk Matrix and Severity Classification

### 10.1 The 5×5 matrix
A standard Likelihood × Consequence grid. It is used in Step 2 of the wizard.

|   | Insignificant | Minor | Moderate | Major | Catastrophic |
|---|---|---|---|---|---|
| Almost certain | Medium | High | Critical | Critical | Critical |
| Likely | Low | Medium | High | Critical | Critical |
| Possible | Low | Medium | High | High | Critical |
| Unlikely | Low | Low | Medium | High | High |
| Rare | Low | Low | Medium | Medium | High |

### 10.2 Severity → track mapping
| Severity | Cell label | Track | Action | Color |
|---|---|---|---|---|
| **S1 Critical** | Critical | A | Full investigation required | Red `#D32F2F` |
| **S2 Major** | Critical | A | Full investigation required | Orange `#ED6C02` |
| **S3 Moderate** | High | B | Light investigation | Yellow `#FFC93C` |
| **S4 Minor** | Medium | C | Log and close | Green `#2E7D32` |
| **S5 Insignificant** | Low | C | Auto-close | Gray |

### 10.3 Override audit
An override writes a record that cannot be changed: `(incident_id, original_sev, new_sev, user_id, timestamp, reason)`. The reason field is required for an override.

---

## 11. Notifications and Regulatory Triggers

> **Key design choice:** notifications fire **at classification**, NOT at the end of the workflow. Time-sensitive regulatory deadlines must not depend on an investigation finishing.

| Event | Deadline | Action required | Trigger point |
|---|---|---|---|
| OSHA — Death | **8 hours** | Phone the OSHA Area Office at once | At classification |
| OSHA — Amputation, eye loss, hospital stay | **24 hours** | Phone or online to OSHA | At classification |
| RIDDOR — Death or specified injury | Without delay | Phone HSE + F2508 within 10 days | At classification |
| RIDDOR — Over-7-day absence | 15 days | Written F2508 to HSE | When day 7 is confirmed |
| RIDDOR — Occupational disease | On diagnosis | Written F2508 to HSE | At classification |
| RIDDOR — Dangerous occurrence | Without delay | Phone HSE + F2508 within 10 days | At classification |
| CAPA overdue | On due date | Email owner + escalate to EHS manager | Daily check |

### 11.1 Showing the deadlines
- **Top-bar bell icon** with a badge count for active regulatory notifications.
- **Dashboard banner** with a red left border for urgent deadlines and a countdown timer (for example `04:38:12`).
- **Investigation detail banner** on the related incident's investigation page.
- **Direct action links** (Open ITA, Call HSE, Open notification).

---

## 12. Data Model

### 12.1 Core entities (the v1 contract, from the PRD)
| Entity | Key fields |
|---|---|
| `Incident` | id, title, type, description, date_time, site_id, area, location, severity, status, reported_by, assigned_to, osha_recordable, riddor_reportable, created_at, classified_at, closed_at, override_log |
| `InjuredPerson` | incident_id, name, job_title, department, supervisor, employment_status, body_part[], injury_nature, mechanism, object_substance (OSHA 301 #17), treatment, days_away, days_restricted, date_of_death |
| `Investigation` | id, incident_id, lead_investigator, team[], status, started_at, due_date, root_cause, findings, rca_method, closed_at |
| `Evidence` | id, investigation_id, type (photo / document / log), filename, description, uploaded_by, uploaded_at |
| `CAPA` | id, investigation_id, title, description, type (corrective / preventive), owner, verifier, due_date, status, progress, completed_at, verified_at, verification_result |
| `Site` | id, name, address, country, region, timezone, regulator (osha / hse / both) |
| `User` | id, name, email, role, site_id, department |
| `Notification` | id, incident_id, type (osha_fatality / osha_24hr / riddor_immediate / riddor_15day / riddor_disease / riddor_do / capa_overdue), deadline, status, notified_at, notified_by |
| `OverrideLog` | id, entity_type, entity_id, field, old_value, new_value, user_id, reason, timestamp |

### 12.2 Type-specific child tables or JSON columns
The forms package defines different field sets for each incident type. In a relational schema we have two options:
- **One child table per type** (`injury_details`, `illness_details`, `near_miss_details`, …) — clean and easy to query.
- **A polymorphic JSON column** on `Incident` (`details JSONB`) — faster to build, harder to report on.

Recommendation: use child tables. Use shared lookup tables for taxonomies that span many types (body parts, hazard categories, exposure types).

### 12.3 Constraints and rules
1. `CAPA.owner ≠ CAPA.verifier` (a CHECK constraint).
2. `Investigation.status ∈ { pending, in_progress, awaiting_capa, closed }`.
3. A change to `Incident.severity` requires a row in `OverrideLog` (enforced by a trigger or the service layer).
4. `Notification` rows are append-only. `notified_at` is set when the deadline action is recorded.
5. Soft-delete only — incidents and investigations are never hard-deleted (legal retention: 5 years for OSHA, 3 years for RIDDOR).

### 12.4 Database engine choice

> **Recommendation: PostgreSQL 16 (or newer) with a TypeScript ORM.**
> Final choice must be confirmed with the SDS Manager platform team. They own the wider stack.

#### Why PostgreSQL?
Our data model needs five things. PostgreSQL gives us all of them in one engine, with no extra add-on services.

| Need | Why we need it | What PostgreSQL gives us |
|---|---|---|
| **Strong relational shape** | The data model is full of one-to-many and many-to-many links (Incident → Investigation → CAPA → Verifier). We need foreign keys and JOINs. | First-class foreign keys, JOINs, indexes. |
| **CHECK constraints at the DB level** | The `CAPA.owner ≠ CAPA.verifier` rule and severity / status enums must hold even if the app has a bug. | `CHECK` constraints, `ENUM` types. |
| **Append-only audit trail** | `OverrideLog` and the activity timeline must never be edited. | Trigger-based row-versioning patterns (pgMemento, custom triggers). PostgreSQL's `pgaudit` extension also gives session-level audit logs for compliance. |
| **Per-type detail tables AND optional JSON** | §12.2 recommended one child table per incident type, with shared lookup tables. But some fields suit JSON better (PPE checklist, witnesses array). | `JSONB` columns store flexible data while still being indexable and queryable. |
| **Row-level security by site / role** | A user from Cleveland Plant must not see Sheffield's incidents. We could put this in app code, but having it in the DB is much safer. | `Row-Level Security (RLS)` policies move multi-site isolation to the storage layer. |

#### Why not the alternatives?

- **MySQL / MariaDB** — works, but `JSONB` (indexable, fast) is a Postgres-only feature. Postgres has stronger CHECK constraint support and easier RLS.
- **MongoDB / document stores** — wrong shape for this data. The model has many strict relationships and audit rules. Document stores make these harder, not easier.
- **SQLite** — fine for the demo, not for production. No real concurrency, no row-level security.
- **Cloud-only stores (DynamoDB, Firestore)** — vendor lock-in, no JOINs, weak constraint support. Avoid.

#### Data-access layer (ORM) — TBD, with two safe options

The Next.js / TypeScript world in 2026 has two leading ORMs. Both work well with PostgreSQL.

| Option | Best for | Trade-offs |
|---|---|---|
| **Prisma** | Faster developer experience. Schema-first design. Mature ecosystem. Lots of guides. | Larger bundle, slower cold starts on serverless. A code-gen step is needed before each run. |
| **Drizzle** | Closer to plain SQL. Smaller bundle. Faster cold starts. Better for serverless / edge. Type updates are instant. | Smaller community than Prisma. Less abstract — you write more SQL-like code. |

**Recommendation:** start with **Prisma** unless the platform team has a strong reason for Drizzle. The data model is large (12+ entities + child tables + future Document / Audit / Permit modules in §15). Prisma's schema file scales better for that size, and the team's onboarding cost is lower.

A third option (**Kysely**) is a SQL query builder, not an ORM. It is good for hand-tuned queries but does not generate types from a schema. Use it if we hit a Prisma performance wall, not before.

#### Database hosting — self-hosted PostgreSQL

**Decision:** we run our own PostgreSQL instance. **No managed services** (no AWS RDS, no Neon, no Supabase, no Cloud SQL). Reasons:

- The SDS Manager platform team already runs its own database. We use the same instance / cluster.
- No extra vendor bills, no vendor lock-in.
- Full control over `postgresql.conf`, extensions, backup schedule, and replication.
- Data stays inside our own network, which simplifies the GDPR / HIPAA / SOC 2 review (see §18.3).

**What we need to operate ourselves (the trade-off):**
- A running PostgreSQL 16+ server (Linux host or container).
- Required extensions installed and enabled: `pgaudit` (session audit log), `pgcrypto` (UUIDs and hashing), `pg_trgm` (fast text search). Optional: `pgMemento` if we use a schema-versioning audit pattern.
- A daily backup job (see "Backup and retention" below) — this is on us, not a vendor.
- Monitoring (disk usage, connection count, slow queries, replication lag if any).
- A patch / minor-version upgrade plan.
- A connection pool (PgBouncer or the ORM's built-in pool) to keep connection count under control.

**Environments:**
- **Production** — one primary, optional read replica for heavy reports.
- **Staging** — one instance, restored weekly from a production backup (with PII scrubbed).
- **Local dev** — Docker `postgres:16` container, seeded with a small fixture dataset.

#### Migrations
Use the ORM's migration tool (`prisma migrate` or `drizzle-kit`). Migrations must:
- Live in version control.
- Be reviewed in pull requests.
- Run automatically in CI on a fresh test database before any merge.
- Never be hand-edited after they are merged.

#### Backup and retention (self-hosted)
Because we host our own Postgres, the backup plan is fully on our team. The plan has four layers:

- **Daily logical dump** — a nightly `pg_dump` of the full database, stored on a different host than the DB server. Keep dumps for at least 35 days.
- **Continuous WAL archiving for point-in-time recovery (PITR).** Configure `archive_mode = on` and `archive_command` to ship WAL segments to an off-server location. With WAL archiving + a base backup, we can restore the database to any moment within the retention window. PITR is required by the 5-year OSHA / 3-year RIDDOR retention rules.
- **Weekly base backup** with `pg_basebackup`, kept off-server. Used as the starting point for PITR replays.
- **File backups** — the `File` table from §15.7 (local-disk uploads in v1) follows the same nightly schedule but writes to a separate off-server target. See §15.3.

**Application-side rules:**
- **Soft-delete only** at the application level (§12.3 rule 5). Hard delete only by an explicit retention job that runs after the regulatory window.
- **Restore drill** — we run a restore from backup into the staging environment at least once per quarter. A backup that has never been tested is not a backup.

#### Search
v1 search is small and can use PostgreSQL full-text search (`tsvector` + `tsquery`) on the incident title and description. v2+ may add OpenSearch / Elastic if free-text search across all attached files (PDFs, photos with OCR) is needed.

#### Caching and sessions
- Sessions: cookie-based JWT or database-backed session table. The platform team's existing pattern wins.
- Cache: not needed in v1. Add Redis only if a measured slow path needs it.

---

## 13. Design System (SDS Manager v1.0)

| Token | Value |
|---|---|
| Primary font | Montserrat (Google Fonts) + sans-serif fallback |
| UI framework | MUI v5+ with Emotion CSS-in-JS |
| Primary color | `#626DF9` (purple) |
| Secondary | `#5C00FF` (deep purple) |
| Success | `#2E7D32` (green) |
| Error | `#D32F2F` (red) |
| Warning | `#ED6C02` (orange) |
| Info | `#0DB4F0` (cyan) |
| Page background | `#F2F5F7` |
| Card background | `#FFFFFF` with shadow `rgba(58,53,65,0.1) 0 2px 10px` |
| Sidebar | 80 px collapsed, white, icon + label nav, right shadow |
| Border color | `#E0E0E0` |
| Card radius | 8 px |
| Button | 10 × 24 padding, 14 px / 600 weight, 8 px radius |
| Input | 12 × 16 padding, 5 px radius, focus = purple ring |
| Tabs | underline, active = `#626DF9` with 2 px bottom border |
| Badges | pill-shaped (50 px radius), 13 px / 600 |
| Alerts | 4 px left accent border + tinted background |

The HTML demo uses these tokens through CSS variables (`--sds-brand-primary`, `--sds-fg-primary`, and so on). The production build should keep the same token names so themes stay in sync across SDS modules.

---

## 14. Screens (demo catalog)

The demo ships eight screens. All work in `EHS Incident Management.html`:

1. **Dashboard** — KPI cards (TRIR, DART, open incidents, overdue CAPAs), incident-by-type bar chart, three-track summary, recent incidents, activity feed.
2. **Incidents list** — tabs (All / Open / My team / Closed), filters (type, severity, site), table with severity and track badges.
3. **Incident detail** — header with badges, "what happened" card, attachments, triage state, activity, plus Assign / Escalate / Close modals.
4. **Report wizard (Step 1)** — type-card grid, title, location, narrative, attachments.
5. **Report wizard (Step 2)** — type-specific form + 5×5 matrix + PPE + witnesses.
6. **Report wizard (Step 3)** — review summary + "what happens next" timeline.
7. **Investigation Kanban** — four columns, severity-coded cards, list-view toggle.
8. **Investigation detail** — incident summary, evidence, 5-Why with ROOT CAUSE marker, findings, team, activity, OSHA 301 banner.
9. **CAPA module** — board / list / cards toggle, lane definitions, KPIs, tabs (All / Mine / Active / Pending verification / Overdue / Closed), CAPA card and detail.
10. **CAPA detail** — action description, progress checklist, verification evidence, owner and verifier, life-cycle activity.
11. **Reports** — four report-type cards + nested previews of OSHA 300 Log, OSHA 300A Annual Summary, OSHA 301 with selectable per-incident forms, RIDDOR F2508 register.

---

## 15. Document Management and Other Standard QMS Modules

### 15.1 Why this section exists
The PRD scopes v1 to three EHS modules (Incidents → Investigation → CAPA) plus the Reports layer. But every modern QMS (Quality Management System) and incident management tool — MasterControl, Veeva Vault, ETQ Reliance, AssurX, EHS Insight, Riskonnect, SafetyCulture, Ideagen, ComplianceQuest — shares a common backbone of extra features. The 2026 research shows five features in every serious tool:

1. **Document control** with version history.
2. **Training records** linked to documents.
3. **Audit trail** for every change.
4. **Electronic signatures** for sign-off.
5. **Cross-linking** between documents, incidents, investigations, and CAPAs.

This section explains how our system handles these features. Some belong in v1 (we already have them or need them now). Some belong in v1.5 or later. The architecture must not block any of them.

> **Quote from industry research:** "Document management is the connective tissue of the quality system — the layer through which SOPs govern nonconformance investigations, change controls govern document revisions, and CAPAs govern procedural corrections."

### 15.2 Document Management — what it covers
A "document" in this system is any file that supports the safety process. There are six main types:

| Document type | Examples | Where it lives in v1 | Owner |
|---|---|---|---|
| **SDS (Safety Data Sheets)** | Chemical SDS files for products in use | SDS Manager library (already exists; we link to it) | EHS Manager |
| **SOPs (Standard Operating Procedures)** | "How to decant IPA in the fume hood" | Linked from incidents and CAPAs (read-only in v1) | Department head |
| **Evidence files** | Photos of scene, witness statements, maintenance logs, training records | Stored on the incident / investigation record | Lead investigator |
| **Training records** | Sign-off sheets, certificates | Stored on the affected person's profile | EHS Manager |
| **Regulatory output** | OSHA 300 Log, 300A, 301 PDF, F2508 | Auto-built from data, stored against the report cycle | System |
| **Audit trail / activity log** | Every system action — who did what, when | Append-only log table per entity | System |

### 15.3 What v1 must do (basic file handling)
Even though a full document control module is out of v1, v1 must already do these things. Most are in the demo today; production must keep them.

- **File upload** with size limits (25 MB per file) and allowed types (PNG, JPG, PDF). This is already in the Report Wizard Step 1.
- **File storage on local disk (v1 decision).** For now, uploaded files are saved to the server's local file system, not to a cloud bucket (S3, GCS, Azure Blob). The reasons are:
  - Faster to build and test in v1.
  - No cloud bills or vendor lock-in during early development.
  - The team can move to cloud storage later without changing the API. The file-storage service must hide the storage location behind a stable URL and a `file_id`. Calling code must never see the disk path.
  - **What to plan for from day 1:** a stable URL pattern (for example `/api/files/:file_id`), a file-record table (`File` entity with `id`, `parent_type`, `parent_id`, `filename`, `mime_type`, `size_bytes`, `uploaded_by`, `uploaded_at`, `storage_location`), and a `storage_location` field that is just `local:<path>` for v1 but can hold `s3://bucket/key` later.
  - **Backups:** because files are on local disk in v1, the server's disk must be backed up nightly to an off-server location. Without this, a disk failure loses every piece of evidence.
  - **Limits to watch:** disk space (set a per-site quota), file count per record (cap at 20 attachments), and total upload size per request.
- **Access control** at the API layer. Only users with the right role can view a file. The `parent_id` on the file record decides which incident / investigation / CAPA the file belongs to. The same role rules that govern that record govern the file.
- **Auto-attach** SDS files from the SDS Manager library when a chemical is named in the incident. The demo's investigation detail screen already does this.
- **Audit trail** — record who uploaded, when, what file, and to which record. The trail cannot be edited.
- **Soft delete** — files can be hidden but never hard-deleted. Regulatory retention rules: 5 years for OSHA, 3 years for RIDDOR.
- **Cross-linking** — every uploaded file points to its parent record (incident, investigation, or CAPA). Following the link must work in both directions.
- **Export bundle** — when a regulator asks, we can export the incident with all evidence in one ZIP or one merged PDF.

### 15.4 What v1.5+ should add (full document control)
For v1.5 or later, add a real Document Control module. This is the standard set of features in every QMS:

- **Version history** — major and minor versions. Every change is a new version. Old versions stay viewable.
- **Document life cycle** — Draft → In review → Approved → Published → Under revision → Retired.
- **Approval workflow** — author submits → reviewer approves → manager signs off. The flow can have many steps.
- **Electronic signatures** — meet 21 CFR Part 11 if the platform sells into life sciences (drug, device, lab).
- **Auto-training trigger** — when an SOP version changes, every employee assigned to that SOP must be re-trained. The system tracks who has read the new version.
- **Effective date and expiry date** — show "next review due in 30 days" warnings on the Dashboard.
- **Document-to-event linking** — every CAPA points to the SOP it changed. Every investigation points to the SDS it consulted. The audit trail must show "the SOP version in effect at the time the incident happened."
- **Role-based access** — view, edit, approve, retire — each is a different permission.

### 15.5 Other standard modules every QMS / IMS has
These modules are common in tools like MasterControl, EHS Insight, ETQ Reliance, AssurX, and Riskonnect. They are out of v1 scope. But the architecture must not block them.

#### 15.5.1 Audit management
A **safety audit** is a planned check of a workplace area against a checklist. Audits are different from incident investigations — they look for problems before something goes wrong.
- Schedule audits to repeat (daily, weekly, monthly, yearly).
- Use a checklist tied to a regulation or standard (ISO 45001, OSHA, RIDDOR).
- Findings from audits can become CAPAs. The PRD form Chapter 9 already lists "Audit finding" as a valid CAPA source.
- Audit trail per audit.

#### 15.5.2 Change control / Management of Change (MOC)
**MOC** is the safety-side process for any change to equipment, process, chemical, or procedure. Before a change goes live, it must be reviewed for safety impact.
- Trigger MOC when a new chemical is added, an SOP is changed, or equipment is replaced.
- Risk assessment is required.
- Sign-off by EHS and the affected department.
- Link to the SDS Manager library when chemicals are involved.
- Industry quote: "the change must be tracked, justified, risk-assessed, and approved before it goes live."

#### 15.5.3 Training management
- Assign training to roles or individuals.
- Track completion (who, when, score).
- Link training to SOPs (auto-trigger on new SOP version).
- Show "training overdue" on the Dashboard.
- Could integrate with an external LMS (Learning Management System).

#### 15.5.4 Inspection management
**Inspections** are short, regular checks. Examples: daily forklift pre-use check, weekly fire-extinguisher check, monthly PPE-station check.
- Mobile-friendly checklist.
- A failed check should be able to trigger an Unsafe Condition incident.
- Photo and signature on each check.

#### 15.5.5 Permit-to-work
A **permit-to-work** is a controlled approval for high-risk work. Examples: hot work (welding, cutting), confined-space entry, working at height, energized electrical work.
- Workflow: requester → safety review → permit issued → work done → permit closed.
- A permit must be on file when an incident happens in a permit-required area. The system links the permit to the incident.

#### 15.5.6 Risk register
A **risk register** is the company's master list of known standing hazards. It is different from the per-incident risk matrix.
- Each entry: hazard, risk rating, controls in place, owner, review date.
- The risk register is the source of leading indicators (open hazards count by site).

#### 15.5.7 Supplier and contractor management
- Track contractor inductions and PPE checks before site entry.
- Link contractors to incidents. The "employment status" field on the incident form (Employee / Self-employed / Contractor / Volunteer / Member of public) already supports this.
- Pre-qualify contractors before work starts (insurance, training, certifications).

### 15.6 Summary — what we build, and when

| Module | v1 | v1.5 | v2+ |
|---|---|---|---|
| File upload + storage on incidents (local disk) | ✅ | | |
| Audit trail + soft delete | ✅ | | |
| Auto-attach SDS from library | ✅ | | |
| Cross-linking (incident ↔ investigation ↔ CAPA) | ✅ | | |
| Export bundle (ZIP / merged PDF) | ✅ | | |
| Move file storage to cloud (S3 / GCS / Azure Blob) | | ✅ | |
| Document Control (version history, approvals, e-sig) | | ✅ | |
| Training management + LMS link | | ✅ | |
| Audit management module | | ✅ | |
| Change control / MOC | | ✅ | |
| Inspection management | | | ✅ |
| Permit-to-work | | | ✅ |
| Risk register | | | ✅ |
| Supplier / contractor management | | | ✅ |
| Risk register → leading-indicator dashboard | | | ✅ |

### 15.7 Data model additions (for future modules)
The v1 data model (§12.1) does not need to change. But for v1.5+ we should plan these new entities:

| Entity | Purpose |
|---|---|
| `File` (v1) | id, parent_type (incident / investigation / capa), parent_id, filename, mime_type, size_bytes, uploaded_by, uploaded_at, storage_location (`local:/var/data/files/2026/05/abc.jpg` in v1, `s3://bucket/key` later) |
| `Document` | id, title, type (sop / sds / policy / training), version, status (draft / review / approved / published / retired), owner, effective_date, expiry_date, file_url |
| `DocumentVersion` | id, document_id, version_number, change_summary, approved_by, approved_at, file_url |
| `Training` | id, user_id, document_id, document_version, completed_at, score, signature |
| `Audit` | id, type, scope, scheduled_date, completed_date, auditor, findings[], status |
| `AuditFinding` | id, audit_id, description, severity, capa_id (if escalated) |
| `Change` | id, type (chemical / sop / equipment), description, risk_assessment, approver, status, approved_at |
| `Permit` | id, type (hot_work / confined_space / height / electrical), area, requester, approver, valid_from, valid_to, status |
| `RiskRegister` | id, hazard, site_id, area, current_risk, residual_risk, controls[], owner, review_date |

### 15.8 Why this matters for v1
Even if these modules are out of v1, three points must guide our v1 build:

1. **Cross-linking is a first-class data primitive.** Every record must have a stable ID and the API must let any record point to any other record. Do not invent new linking patterns later.
2. **Audit trail is shared infrastructure.** Build one append-only log table that every module writes to. Do not build per-module logs.
3. **File storage is shared infrastructure.** Build one file-storage service that every module uses. Files have an owner (user), a parent (incident / investigation / CAPA), a version, and an access role. Do not let each module invent its own. v1 stores files on the server's local disk (see §15.3). The service must hide the storage location behind a stable URL so that switching to S3 / GCS / Azure Blob later is a config change, not a rewrite.

If we get these three things right in v1, adding Document Control, Training, Audit, MOC, and the rest in v1.5+ is additive work, not a rewrite.

---

## 16. Industry Best-Practice Notes (May 2026 research)

These notes add current outside practice to the PRD. They guide the build but they do not change the spec.

### 16.1 ISO 45001 alignment
ISO 45001 is the international standard for workplace health and safety. It needs a written process for incident reporting and investigation that:
- Captures injuries, illnesses, AND near-misses.
- Finds root causes, contributing factors, and related hazards.
- Uses the data to improve EHS performance.

Our three-module pipeline (Incidents → Investigation → CAPA) maps to clauses 10.1 and 10.2 of ISO 45001. The Reports layer covers clauses 9.1 to 9.3.

### 16.2 OSHA ITA 2026 deadlines (verified)
- 300A annual summary: posted **Feb 1 – Apr 30, 2026**. Submitted by **March 2, 2026** for calendar-year 2025 data.
- 250+ employees → 300A required.
- 20–249 employees in Appendix A industries → 300A required.
- 100+ employees in Appendix B industries → 300 + 301 case detail required (started reporting year 2024).
- Submission methods: web form, CSV upload, or API.
- PDFs cannot be submitted. ITA validates the CSV format strictly.

### 16.3 Notes on RCA methods
- **5-Why** is required by the PRD. It is good for first-aid and minor cases. But it is "too simple" for complex events. It tends to find only one cause chain.
- **Fishbone (Ishikawa)** is more thorough. The Forms PDF (Chapter 8) already defines a 6-category Fishbone (People / Process / Equipment / Materials / Environment / Management). We should add it as a togglable second view in v1.5+.
- **TapRoot®** needs a paid license. It is the industry standard for deaths and high-potential events. Out of scope for v1. But the design should not block it (an `rca_method` field on `Investigation` exists for this reason).
- Suggested escalation: first-aid → 5-Why; lost-time → Fishbone; death or high-potential → full Fault Tree or TapRoot®.

### 16.4 CAPA effectiveness check
In industry, the most-skipped step is the **effectiveness check** — and it is the most common audit finding. Our protections:
- A required "Too early to verify — re-verify on YYYY-MM-DD" option closes the verification step without marking a CAPA effective too early.
- Verification methods to support: follow-up inspection, repeat monitoring, audit-trend review, re-interview of affected workers, document review.
- The audit log must show evidence files plus the verifier's signature timestamp.

### 16.5 Risk-matrix conventions
- A 5 × 5 grid with Likelihood (Rare → Almost Certain) and Severity (Insignificant → Catastrophic) is the most common form. It matches IOSH and SafetyCulture.
- Risk score = Likelihood × Severity, grouped into 5 bands: Negligible (1–2), Low (3–6), Moderate (7–12), High (13–20), Very High (21–25). The PRD uses 4 cell labels (Low / Medium / High / Critical) — slightly simpler. Keep the PRD bands. Document the score-to-band mapping for the future.

### 16.6 Leading vs. lagging indicators
v1 focuses on lagging indicators (TRIR, DART). The 2026 best practice says we should **balance** them with leading indicators in v1.5+:
- Near-miss reporting rate (per 100 FTE).
- Observation rate.
- Inspection completion rate.
- Training completion rate.
- CAPA cycle time (average days from creation to verified close).
- Open hazards count by site.

The dashboard already has the chart and card skeleton. We can add these without rework.

### 16.7 Mobile and field use
The PRD scopes v1 to responsive web. Worth knowing: ISO 45001-aligned EHS systems all converge on **mobile-first capture** with photo upload, voice-to-text, and offline drafts. The wizard already has voice-to-text and drag-and-drop attach. The responsive web layout should keep these features working end to end.

---

## 17. Implementation Roadmap (phased)

### Phase 0 — Foundation (Weeks 1–2)
- Set up the Next.js app inside the existing SDS Manager monorepo. **Read `node_modules/next/dist/docs/` first.** This repo has breaking changes from upstream Next.js (see `AGENTS.md`).
- Wire the SDS Manager design tokens into the MUI v5 theme.
- Auth, role model (Worker / Supervisor / EHS Manager / Verifier / Admin), site model.
- Activity-log infrastructure (append-only, used by every module).

### Phase 1 — Capture (Weeks 3–6)
- Incidents list + detail.
- 3-step Report Wizard with all 8 type-specific Step 2 forms.
- 5 × 5 risk matrix + auto-classification.
- Body map (injury) + PPE selector.
- Attachments + drafts.
- Activity timeline integration.

### Phase 2 — Routing and Notifications (Weeks 7–8)
- Three-track routing engine.
- Notification triggers fired at classification.
- Top-bar bell + dashboard banner with countdown.
- Override logging.

### Phase 3 — Investigation (Weeks 9–11)
- Kanban board + list view.
- Investigation detail with 5-Why builder.
- Evidence collection (including SDS auto-attach from the SDS Manager library).
- Findings, team management, OSHA 301 draft banner.

### Phase 4 — CAPA (Weeks 12–14)
- CAPA board / list / cards.
- Owner ≠ verifier rule (DB constraint + service layer).
- 5-stage life cycle, verification queue.
- Overdue check + escalation.

### Phase 5 — Reports (Weeks 15–17)
- OSHA 300 Log live preview, PDF / CSV export.
- OSHA 300A annual summary generator.
- OSHA 301 per-incident form (auto-drafted, manual review).
- RIDDOR F2508 generator + HSE notification record.
- TRIR / DART calculations.

### Phase 6 — ITA / HSE submission (Weeks 18–19)
- OSHA ITA CSV format generator + validation.
- HSE online reference capture.
- Manager certification + sign-off flow.

### Phase 7 — Hardening (Weeks 20–22)
- Audit, accessibility (WCAG 2.2 AA), performance, retention / archival, regression suite.
- Run a real submission cycle in a staging tenant before the next ITA window.

---

## 18. Risks and Open Questions

1. **Tech stack details — confirm with platform team.** AGENTS.md flags this Next.js fork as having breaking changes. The production stack (App Router? data-fetching pattern? auth provider?) must be confirmed before Phase 0 ends.
2. **Multi-jurisdictional sites.** Cleveland is OSHA only. Sheffield is HSE / RIDDOR only. A third site (for example, a Canadian plant) would need OHS provincial reporting. The data model has `Site.regulator` for this. The routing engine must be table-driven, not hard-coded to OSHA / RIDDOR.
3. **Privacy of injured-person data.** Names, body-part details, and medical info are PII / health data. Confirm GDPR (UK), HIPAA (US), and SOC 2 obligations with legal before we save any of it.
4. **OSHA 301 5-year retention vs. user soft-delete.** We need a clear policy on what users can delete and what we keep for the regulator regardless of user action.
5. **Body-map data model.** SVG selection needs canonical body-part IDs that match OSHA 300 Column E and RIDDOR fields. Use the body-part list from Forms Chapter 1.
6. **Notification fan-out.** Email, in-app, SMS for deaths? Fallback if the main channel fails? Define the delivery SLA.
7. **Time zones.** All timestamps stored in UTC. Display in site-local time. The daily-overdue check runs at site-local midnight, not UTC midnight.
8. **OSHA Establishment ID + NAICS** must be set per site for valid 300A / ITA submission.
9. **Independent verifier pool.** If a small site has 2 or fewer EHS staff, the owner ≠ verifier rule may force cross-site verification. Confirm the company has the people.
10. **RCA method extensibility.** The `rca_method` field allows future Fishbone / Fault Tree / TapRoot®. Keep the RCA UI in layers so adding a method is additive.

---

## 19. Glossary

| Term | Definition |
|---|---|
| **CAPA** | Corrective and Preventive Action — a structured fix + recurrence prevention with a required check. |
| **DART** | Days Away, Restricted, or Transferred (rate per 200,000 hours). |
| **EHS** | Environment, Health, and Safety. |
| **F2508** | UK HSE form series for RIDDOR reports. |
| **HSE** | UK Health and Safety Executive. |
| **ITA** | OSHA Injury Tracking Application. |
| **NIHL** | Noise-Induced Hearing Loss. |
| **OSHA** | US Occupational Safety and Health Administration. |
| **PPE** | Personal Protective Equipment. |
| **RCA** | Root Cause Analysis. |
| **RIDDOR** | Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013 (UK). |
| **SDS** | Safety Data Sheet. |
| **SOP** | Standard Operating Procedure. |
| **Track A / B / C** | Three routing tiers — Full / Light / Log-and-close. |
| **TRIR** | Total Recordable Incident Rate (per 200,000 hours). |

---

## 20. References and Sources

### Internal source documents
- `docs/EHS_Incident_Forms_Latest.pdf` — Printable forms package v1.1 (May 2026).
- `docs/IncidentManagementSystem-2/uploads/PRD.txt` — Project Requirements Document v1.0 (Rafid Fahmid, May 2, 2026).
- `docs/IncidentManagementSystem-2/uploads/Forms.txt` — Plain-text forms list.
- `docs/IncidentManagementSystem-2/uploads/Investigation Routing Logic.png` — Routing decision-gate diagram.
- `docs/IncidentManagementSystem-2/EHS Incident Management.html` + `*.jsx` + `styles.css` — Working design demo.

### External research (May 2026)
**ISO 45001 / EHS architecture**
- [Aligning Incident Management with ISO 45001 — AssurX](https://www.assurx.com/aligning-incident-management-with-iso-45001-requirements/)
- [What is EHS Management System: ISO 14001 & ISO 45001 — 4cpl](https://www.4cpl.com/blog/ehs-management-system-iso-14001-iso-45001/)
- [ISO 45001:2018 — ISO.org](https://www.iso.org/standard/63787.html)
- [ISO 45001 Implementation Best Practices — ComplianceQuest](https://www.compliancequest.com/blog/iso-45001/)

**OSHA 300 / 300A / 301 and ITA 2026**
- [OSHA Injury Tracking Application (ITA)](https://www.osha.gov/injuryreporting/)
- [OSHA ITA Coverage Application](https://www.osha.gov/itareportapp)
- [OSHA Recordkeeping Final Rule](https://www.osha.gov/recordkeeping/final-rule)
- [OSHA 300 Requirements for 2026 — Safety By Design](https://www.safetybydesigninc.com/reminder-osha-300-reporting-requirements-for-2022-deadlines-exemptions/)
- [OSHA 300A 2026 Posting and ITA Reporting Deadlines — PCS Safety](https://www.pcs-safety.com/osha-form-300a-2026-posting-and-ita-reporting-deadlines-what-employers-must-do/)
- [OSHA Form 300A March 2, 2026 deadline — Vensure](https://vensure.com/employment-law-updates/reminder-federal-osha-form-300a-posting-begins-on-february-1-2026-and-electronic-submission-is-due-by-march-2-2026/)

**Root-cause analysis methodology**
- [Fast RCA — TapRoot](https://taproot.com/a-look-at-3-popular-quick-idea-based-root-cause-analysis-techniques-5-whys-fishbone-diagrams-and-brainstorming/)
- [What is the Best Root Cause Analysis Method? — TapRoot](https://taproot.com/what-is-the-best-root-cause-analysis-method/)
- [Root Cause Analysis: A Key Guide for EHS Leaders — Dakota Software](https://www.dakotasoft.com/blog/root-cause-analysis-a-key-guide-for-ehs-leaders/)
- [How 5 Whys & Fishbone Relate to KT Problem Analysis — Kepner-Tregoe](https://kepner-tregoe.com/blogs/how-5-whys-and-fishbone-diagrams-relate-to-kt-problem-analysis/)

**CAPA workflow and verification**
- [CAPA Systems — 5 Essential Elements — Arena](https://www.arenasolutions.com/resources/articles/capa-system-corrective-preventive-action/)
- [Corrective and Preventive Action (CAPA) — SafetyCulture](https://safetyculture.com/health-and-safety/corrective-and-preventive-action)
- [The CAPA Process — Deltek](https://www.deltek.com/en/manufacturing/capa-corrective-and-preventive-action)
- [CAPA Software Guide — SafetyChain](https://safetychain.com/blog/guide-corrective-preventive-action)

**Risk matrix conventions**
- [What is a 5x5 Risk Matrix — SafetyCulture](https://safetyculture.com/topics/risk-assessment/5x5-risk-matrix)
- [How to Use a 5x5 Risk Matrix — HASpod](https://www.haspod.com/blog/paperwork/5x5-risk-matrix)
- [IOSH 5×5 Risk Matrix — The Knowledge Academy](https://www.theknowledgeacademy.com/blog/iosh-5x5-risk-matrix/)

**RIDDOR**
- [RIDDOR — HSE](https://www.hse.gov.uk/riddor/)
- [Reporting accidents and incidents at work — HSE INDG453](https://www.hse.gov.uk/pubns/indg453.htm)
- [The Ultimate Guide to RIDDOR — Worksafe UK](https://www.worksafe.uk.com/health-and-safety/the-ultimate-guide-to-riddor-reporting-of-injuries-diseases-and-dangerous-occurrences-regulations-2013/)
- [RIDDOR 2013 — Arinite](https://www.arinite.com/riddor)

**EHS KPIs**
- [Top OSHA-Recommended Safety Metrics & KPIs — ComplianceQuest](https://www.compliancequest.com/blog/safety-metrics-kpi-for-osha-ehs-leaders/)
- [Measuring Safety: Leading & Lagging Indicators — EHS Insight](https://www.ehsinsight.com/blog/safety-metrics-leading-lagging-indicators)
- [TRIR vs DART — Ecesis](https://www.ecesis.net/Incident-Management-Software/TRIR-vs-DART-Rate.aspx)
- [6 Best Safety Dashboard Software for Real-Time EHS Visibility 2026 — BasinCheck](https://basincheck.com/resources/best-safety-dashboard-software)

**Database engine and ORM (added in §12.4)**
- [Drizzle vs Prisma in 2026 — MakerKit](https://makerkit.dev/blog/tutorials/drizzle-vs-prisma)
- [Prisma vs Drizzle: Performance, DX & Migration Paths — DesignRevision](https://designrevision.com/blog/prisma-vs-drizzle)
- [Prisma vs Drizzle vs ZenStack: Choosing a TypeScript ORM in 2026 — DEV](https://dev.to/zenstack/prisma-vs-drizzle-vs-zenstack-choosing-a-typescript-orm-in-2026-5cba)
- [Next.js with a Database: Prisma, Drizzle, and Server Actions — Raghuveer](https://www.iamraghuveer.com/posts/nextjs-database-server-actions/)
- [Best ORMs for the Next.js App Router — Shinagawa Labs](https://shinagawa-web.com/en/blogs/nextjs-app-router-orm-comparison)
- [Postgres Audit Logging Guide — Bytebase](https://www.bytebase.com/blog/postgres-audit-logging/)
- [Postgres RLS Implementation Guide — Permit.io](https://www.permit.io/blog/postgres-rls-implementation-guide)
- [What Is Audit Logging in PostgreSQL — Tiger Data](https://www.tigerdata.com/learn/what-is-audit-logging-and-how-to-enable-it-in-postgresql)
- [Production-Ready Audit Logs in PostgreSQL — Sehban Alam](https://medium.com/@sehban.alam/lets-build-production-ready-audit-logs-in-postgresql-7125481713d8)
- [PostgreSQL Audit Extension — PGAudit](https://www.pgaudit.org/)
- [pgMemento — schema-versioning audit trail for PostgreSQL](https://github.com/pgMemento/pgMemento)
- [How to Implement Audit Trails with Triggers in PostgreSQL — OneUptime](https://oneuptime.com/blog/post/2026-01-25-postgresql-audit-trails-triggers/view)

**Document management and QMS modules (added in §15)**
- [Document Management Software — AssurX](https://www.assurx.com/document-management-software/)
- [Document Control Software for QMS — eLeaP](https://quality.eleapsoftware.com/qms-document-management/)
- [What to know about document control software in 2026 — Qualio](https://www.qualio.com/blog/document-version-control-software-reviews)
- [QMS Documentation — SimplerQMS](https://simplerqms.com/qms-documentation/)
- [How to build a QMS in SharePoint — Ideagen](https://www.ideagen.com/thought-leadership/blog/how-to-build-qms-in-sharepoint-complete-guide)
- [14 Best Quality Management Systems (QMS) in 2026 — Whatfix](https://whatfix.com/blog/quality-management-systems/)
- [Document Control and Management Software — EHS Insight](https://www.ehsinsight.com/document-control-software)
- [Why Use Document Management Software — Ecesis](https://www.ecesis.net/Document-Management-Software/Why-Use-Document-Management-Software.aspx)
- [How EHS Platforms Improve Documentation and Recordkeeping — Simple But Needed](https://sbnsoftware.com/blog/how-ehs-platforms-improve-documentation-and-recordkeeping/)
- [What Is EHS Software? Top Features — EHS Insight](https://www.ehsinsight.com/blog/what-is-ehs-software-how-it-works-why-it-matters-and-key-features-to-know)
- [Streamlining the Safety Data Sheets (SDS) Workflow — ComplianceQuest](https://www.compliancequest.com/blog/streamlining-sds-workflow/)
- [Change Control in Quality Management System — Qualityze](https://www.qualityze.com/blogs/change-control-in-qms)
- [Change Control Management Software — AssurX QMS](https://www.assurx.com/change-control-management-software/)
- [QMS Software comprehensive guide — eLeaP](https://quality.eleapsoftware.com/qms-software/)
- [Top QMS Software 2026 — Dot Compliance](https://www.dotcompliance.com/blog/eqms/what-is-the-top-qms-software-to-use-in-2026/)
- [FDA QMSR & ISO 13485: Key Changes Effective 2026 — IntuitionLabs](https://intuitionlabs.ai/articles/fda-qmsr-iso-13485-changes-2026)
- [Incident Management Software — Riskonnect](https://riskonnect.com/incident-management-software/)
- [Incident Reporting and Investigation Management Software — ComplianceQuest](https://www.compliancequest.com/bloglet/incident-reporting-and-investigation-management-software/)
- [Best Incident Management Software — ISMS.online](https://www.isms.online/compliance-software/what-is-the-best-incident-management-software/)
