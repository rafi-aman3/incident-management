# EHS Incident Management System — Master Planning Document

> This document brings together five sources: the SDS Manager PRD (`EHS_Incident_Forms_Latest.pdf` and `uploads/PRD.txt`), the printable forms package (`uploads/Forms.txt`), the React HTML demo (`IncidentManagementSystem-2/`), current (2026) research about incident management systems, and a **May 2026 SmartQHSE platform feature walkthrough** (see §20).
>
> **Status:** Planning draft for the production build. Use it together with the PRD v1.0 (May 2026), the Forms Package v1.1, and the SDS Manager Design System.
>
> **Revision history:**
> - **v2.2 (2026-05-05).** Scope consolidation pass. Replaced split-across-three-places data model (was §12.1, §15.7, §16.9) with one unified §12 organized by 19 domains and ~45 entities. Added §12.3 relationships diagram, §12.4 cross-linking primitive, §12.6 type-specific child tables explanation. Removed every `v1 / v1.5 / v2+` deferral tag — all modules in §15 are now in build scope. Replaced §18 7-phase roadmap with a 15-phase 45-week roadmap that covers the full scope (Document Control, Training, Audit, MOC, Permit, Inspection, Risk Register, Contractor, Toolbox Talks, BBS, JSA, Safety Bulletins, Emergency Management, Environmental Compliance, Onboarding, Hardening). Updated §15.6 and §16.10 summary tables — version-tag columns replaced with simple "in scope" markers. Updated §20.1 SmartQHSE comparison table — Status column replaced with Phase column pointing to §18. Worker-content multi-language (toolbox talks, onboarding copy) moved from non-goal to in-scope. AI features clarified as a permanent non-goal, not a deferred feature.
> - **v2.1 (2026-05-05).** End-to-end user-flow smoothness pass. Added §6.5 Worker-flow smoothness rules. Added §7.4 Investigator-flow smoothness rules. Added §8.6 CAPA-flow smoothness rules (separate owner / verifier flows). Added §11.2 Notification smoothness rules (severity-tiered channels, smart-batching, quiet hours, one-click actions). Added §16.13 End-to-End User-Flow Playbook (5 named flows, cross-role handoff matrix, smoothness measurement events). The goal: every role can do their part without ceremony, and every handoff is a clean read-only-context / write-only-delta contract.
> - **v2 (2026-05-05).** Added §20 SmartQHSE feature-gap analysis. Expanded §15.5.5 (Permit-to-Work) with gas-test, isolation-certificate, and live-permit-register requirements. Expanded §15.5.9 (BBS) to a 6-class observation taxonomy with stop-the-job. Added §15.5.11 Emergency Management and §15.5.12 Environmental Compliance modules (v2+). Strengthened §17.6 leading-indicator list and review cadence. Strengthened §17.7 with map-clustering for observations. Strengthened §17.8 with the concrete AI feature priority list. Added new entities to §15.7 (PermitGasTest, PermitIsolation, EmergencyResponsePlan, MusterPoint, EmergencyDrill, EmergencyContact, WasteStream, WasteManifest, EmissionPermit, EmissionLog). Refreshed §22 SmartQHSE reference list. Glossary moved to §21; References moved to §22.
> - v1. Original master planning document.

---

## 0. Source Material We Reviewed

| Source                                                                            | What it gives us                                                                                                                                                                                                                                  |
|-----------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `docs/EHS_Incident_Forms_Latest.pdf` (10 chapters + 2 appendices, v1.1, May 2026) | Full paper forms for collecting field data. Covers Injury, Illness, Near-miss, Property Damage, Environmental Release, Unsafe Condition, Observation, Investigation, CAPA, and Dangerous Occurrence. Lists every field for each incident type.    |
| `docs/IncidentManagementSystem-2/uploads/PRD.txt`                                 | The 29-page PRD: goals, modules, three-track routing, risk matrix, OSHA and RIDDOR rules, data model, design tokens, and demo screen descriptions.                                                                                                |
| `docs/IncidentManagementSystem-2/uploads/Forms.txt`                               | A plain-text copy of the printable forms package. We use it as the field list.                                                                                                                                                                    |
| `docs/IncidentManagementSystem-2/*.jsx` + `EHS Incident Management.html`          | A working React + Babel demo in the browser: Shell, Dashboard, Incidents list and detail, 3-step ReportWizard with body map and 5×5 matrix, Investigation Kanban + Detail, CAPA module, Reports module (OSHA 300 / 300A / 301 / RIDDOR previews). |
| `docs/IncidentManagementSystem-2/styles.css` + `colors_and_type.css`              | Ready-to-use visual tokens for the SDS Manager design system.                                                                                                                                                                                     |
| `uploads/Investigation Routing Logic.png`                                         | A picture that shows the routing decision (Track A / B / C).                                                                                                                                                                                      |
| Web research (May 2026)                                                           | ISO 45001 standard, OSHA ITA 2026 deadlines, root-cause analysis methods (5-Why, Fishbone, TapRoot), CAPA effectiveness checks, 5×5 risk matrix rules, RIDDOR 2013 deadlines, EHS KPI strategy.                                                   |

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

*(See §7 for the module. See §17.3 for the trade-offs of each RCA method.)*

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

*(See §8 for the full life cycle. See §17.4 for why this check is the most-skipped step in industry.)*

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

*(See §9 for the regulatory details. See §17.2 for the OSHA ITA 2026 deadlines. See §17.6 for the leading-vs-lagging KPI strategy.)*

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

### 2.1 Goals
- One guided report flow that handles all 8 incident types.
- Auto-set severity (with the 5×5 risk matrix) and route to Track A, B, or C.
- 5-Why root-cause analysis inside the Investigation module.
- CAPA tracking with a required independent check and overdue alerts.
- Auto-build the OSHA 300 Log, 300A Annual Summary, OSHA 301 per-incident reports, and RIDDOR F2508 packages from the captured data.
- Send regulatory-deadline reminders **at classification time**, not at the end.
- A live dashboard with TRIR, DART, open incidents, overdue CAPAs, and a regulatory deadline banner.

### 2.2 Non-Goals (deliberate decisions, not deferrals)
These are structural non-goals — product decisions, not roadmap items. They will not be built later.
- **No native iOS or Android app.** Responsive web only. Native mobile would be a separate platform stack and team.
- **No AI prediction or AI authoring.** A deliberate anti-bloat commitment (see §2.4.3 and §17.8). Competitors compete on AI; we compete on filing forms correctly.
- **No HRIS or payroll integration.** Different product domain.
- **No multi-tenant SaaS.** One SDS Manager tenant per install, many sites per tenant.
- **No Quality (Q in QHSE) modules.** No NCR, supplier audit, calibration, or customer complaints. See §15.5.13.

Worker-content multi-language (toolbox talks, onboarding copy in EN / AR / HI / UR / Tagalog) **is in scope** — see §15.5.8 and §16.10.

### 2.3 Sites in scope
- **Cleveland Plant** (US — under OSHA rules).
- **Sheffield Site** (UK — under HSE / RIDDOR rules).

**Future regulator scope (not in current build).** Other QHSE platforms (for example, SmartQHSE) cover GCC and Indian regulations as well. If we add new sites later, the routing engine and the `Site.regulator` field already support adding:
- **GCC** — UAE OSHAD-SF (Abu Dhabi), Saudi MOL, Qatar Labour Law.
- **India** — Factories Act 1948, BOCW Act, statutory compliance calendars.

These are tracked here only as a future-expansion path. They do not affect the current build.

### 2.4 Unique selling points and reducing user hesitation
This sub-section is the **product positioning** for the EHS module. It is the most important page in this document for two audiences:
- **Sales and marketing** — what to say when a customer asks "why your product and not SmartQHSE / VelocityEHS / EHS Insight / MasterControl?"
- **Designers and engineers** — every screen you build must either *prove a differentiator* or *remove a user hesitation*. If it does neither, cut it.

#### 2.4.1 The one-line positioning
> The only EHS Incident Management module that lives **natively inside your SDS data**, fires regulatory deadlines **the moment severity is set**, and never lets a CAPA owner **close their own action**.

If we cannot say this on the home page, the product has lost its identity.

#### 2.4.2 Five differentiators that no competitor matches today

1. **SDS-native, not SDS-adjacent.** This is the only EHS module built **inside** SDS Manager. When an injury report names "isopropyl alcohol 70%", the SDS auto-attaches to the investigation. No upload step. No re-keying. No "where is the SDS for this chemical?" delay during a CAPA review. Competitors sit *beside* SDS data; we sit *on* it. *(See §15.2, §15.3.)*

2. **Regulatory clock starts at classification, not at workflow end.** When severity is set to S1, the OSHA 8-hour clock starts **now**, not when the investigation finishes. Most competitors fire alerts on workflow completion — a slow investigation can blow a regulatory deadline. We architecturally cannot. *(See §11.)*

3. **CAPA owner ≠ verifier, enforced at the database level.** The rule that prevents rubber-stamping is a `CHECK` constraint in Postgres, not a JavaScript check in the screen. Even if our UI has a bug, the database refuses the write. Most competitors enforce this only in the screen, where it can be bypassed by a determined manager. *(See §8.3, §12.3.)*

4. **Three-track routing prevents alert fatigue.** Paper cuts go to Track C and auto-close. Workers see that minor things are not a big deal, and they trust that major things get full attention. Tools that route every incident through the same heavy workflow train workers to ignore notifications, which is how near-misses go unreported. *(See §5.)*

5. **Self-hosted Postgres, your data in your network.** No cloud vendor. No "what happens if our QHSE vendor goes away?" risk. Standard Postgres schemas you can read with any SQL client. No proprietary file format. *(See §12.4.)*

#### 2.4.3 Three "anti-bloat" commitments
These are **promises**, not just features. They tell the customer what we will *not* build, which is harder than telling them what we will:

- **We do not sell AI hype.** Competitors advertise "52 AI tools." We focus on filing OSHA 301 correctly. Our users trust the form, not a chatbot. AI is a permanent non-goal (§17.8).
- **We do not sell "120 modules."** We do EHS Incident Management. Quality, supplier audits, calibration — out of scope (§15.5.13). Adjacent buyers can pick the right tool for those.
- **We do not sell features that do not exist.** Every feature in this document is in build scope. Delivery order is in §18. No demo magic, no roadmap fiction.

#### 2.4.4 User-hesitation map (the most important table in this section)
For every common reason a buyer or worker hesitates, the system has a concrete answer. **Every design review must walk this table.**

| Who hesitates               | What they fear                                                  | Our concrete answer                                                                                                | Section                   |
|-----------------------------|-----------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|---------------------------|
| **Site Admin**              | "I do not trust the cloud with my safety data."                 | Self-hosted Postgres. Local-disk file storage in v1. Data never leaves your network.                               | §12.4, §15.3              |
| **Site Admin**              | "Will I get locked into a vendor?"                              | Standard Postgres schema. Open ORM. No proprietary file format.                                                    | §12.4                     |
| **Site Admin**              | "Setup will take us months."                                    | 7-step setup wizard, save & resume, default-and-skip on every step. Target: under 30 minutes.                      | §16.3                     |
| **EHS Manager**             | "Audit prep takes us 3 weeks every year."                       | Reports are a live projection of incident data. The OSHA 300 Log on screen *is* the OSHA 300 Log of record.        | §9, Foundational Concepts |
| **EHS Manager**             | "Will I miss an OSHA / RIDDOR deadline?"                        | Notifications fire at classification. Top-bar bell + dashboard banner with countdown.                              | §11                       |
| **EHS Manager**             | "What if a supervisor closes a CAPA they own?"                  | Cannot. Database `CHECK` constraint blocks it.                                                                     | §8.3, §12.3               |
| **EHS Manager**             | "Will my OSHA 301s be missing the right fields?"                | Field 17 ("object that directly harmed") is captured explicitly in the Report Wizard. Auto-drafted into 301.       | §6.2 Step 2, §9.3         |
| **Supervisor**              | "Investigation backlog will swallow my week."                   | Track A vs Track B vs Track C splits the load. Track C auto-closes. Only Track A is a full investigation.          | §5                        |
| **Supervisor**              | "I cannot tell which incident is urgent."                       | Severity badge + track badge on every list row. Sev 1–2 surfaces to the top with red banners.                      | §6.3, §11.1               |
| **Worker**                  | "Is reporting going to get me in trouble?"                      | Plain copy on the worker welcome card: "Nobody gets in trouble for reporting a near-miss." Anonymous mode for BBS. | §16.4, §15.5.9            |
| **Worker**                  | "How long will this take? I have actual work to do."            | 3-step wizard, target under 3 minutes. Voice-to-text. Body map. Drag-and-drop photos.                              | §6.2, §16.2               |
| **Worker**                  | "What if I do not know which category to pick?"                 | "If you are not sure, pick **Observation**." Stated explicitly on the welcome tour.                                | §16.4                     |
| **Worker**                  | "What if I make a mistake?"                                     | "Try a practice report (nothing is saved)" sandbox mode.                                                           | §16.6                     |
| **Worker on a coworker**    | "I do not want to name my colleague."                           | Anonymous toggle on BBS observations. Free-text observed_target supports a generic team name.                      | §15.5.9                   |
| **Verifier**                | "What if my team is too small to find an independent verifier?" | Cross-site verification supported. Risk and mitigation noted.                                                      | §19 item 9                |
| **Buyer comparing vendors** | "Will it integrate with my SDS data?"                           | It *is* your SDS data. Native auto-attach to chemical incidents.                                                   | §15.2                     |
| **Buyer comparing vendors** | "What if we expand to a new country?"                           | Routing engine is table-driven via `Site.regulator`. Adding a regulator is config, not code.                       | §5, §2.3                  |
| **Buyer comparing vendors** | "Will workers actually adopt it?"                               | Time-to-first-report metric tracked from day one. Onboarding success metrics in §16.11.                            | §16.11                    |

#### 2.4.5 The design rule for every screen
When a designer or engineer is unsure about a design choice, the rule is one sentence:

> **Pick the option that removes a hesitation.**

If a screen does not remove a hesitation from the table in §2.4.4, the screen is decoration. Cut it or rebuild it.

**Concrete examples of this rule applied:**
- The 5×5 risk matrix in Step 2 removes "I do not know how serious this is."
- The "OSHA 301 due in 6 days" banner on the investigation page removes "I forgot the deadline."
- The anonymous toggle on BBS removes "I do not want to name my colleague."
- The "Use example" link next to the title field removes "I do not know what to write."
- Plain-English copy removes "I do not understand what this form is asking."
- The sandbox mode removes "What if I break something on my first try?"
- The setup-progress dashboard after the admin wizard removes "Am I done? Did I miss a step?"

#### 2.4.6 Anti-features (what we say no to)
We will be asked for these. Saying yes makes the product worse:

- **"Add an AI chatbot that answers safety questions."** No — it would hallucinate regulatory rules. Liability risk too high. Document Control + tooltips do this safely instead.
- **"Add gamification (points, badges) for reporting incidents."** No — it incentivizes reporting trivial incidents and discourages reporting serious ones (workers fear losing their badge). It also trivializes safety culture.
- **"Add a free-text 'severity' field so the supervisor can write whatever they want."** No — the 5×5 matrix is the standard. Free text breaks reporting and ITA submission.
- **"Skip the verifier on small CAPAs."** No — owner ≠ verifier is the load-bearing rule. Exception requests are a sign the verifier pool is too small (§19 item 9), not that the rule should bend.
- **"Let workers edit their submitted incidents."** No — soft-delete and append-only audit trail only. Edits would break OSHA 5-year retention.

---

## 3. Target Users and Roles

| Role                     | Main actions                                                                   | Permissions                                                                                                     |
|--------------------------|--------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------|
| **Shop-floor worker**    | Reports incidents and observations. Sees their own reports.                    | Can create incidents (any type). Can view their own reports. Can attach evidence.                               |
| **Supervisor**           | Reviews and overrides severity. Assigns triage owners. Manages team incidents. | All worker permissions, plus override classification, assign within team, escalate to investigation.            |
| **EHS Manager**          | Leads investigations. Assigns CAPAs. Manages regulatory reports.               | All supervisor permissions, plus open and close investigations, submit OSHA / RIDDOR reports, assign verifiers. |
| **Independent verifier** | Confirms CAPA effectiveness and closes it (cannot be the owner).               | Can sign off on CAPAs they did not own.                                                                         |
| **Site administrator**   | Sets up sites, users, roles, notification rules, and regulator references.     | All EHS Manager permissions, plus system setup.                                                                 |

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

| Close event              | When it fires                                                                         | Who owns it              | What it ends            |
|--------------------------|---------------------------------------------------------------------------------------|--------------------------|-------------------------|
| **Incident closed**      | First capture and classification are done. The incident is routed to Track A / B / C. | Reporter or Supervisor   | The triage phase        |
| **Investigation closed** | RCA is finished. May or may not lead to CAPA.                                         | Lead investigator        | The investigation phase |
| **CAPA closed**          | Action is done AND a different person has confirmed it works.                         | Verifier (not the owner) | The action phase        |

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

| Track                       | Severity                       | What happens                                                                                                                                                             | Default outcome                          |
|-----------------------------|--------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------|------------------------------------------|
| **A — Full investigation**  | S1 (Critical), S2 (Major)      | Lead investigator + team. Full 5-Why RCA. Evidence is required. CAPA must be considered. All deaths, amputations, hospital cases, and RIDDOR specified injuries go here. | Investigation → CAPA(s) → verified close |
| **B — Light investigation** | S3 (Moderate)                  | Supervisor-led short review. Simple RCA. CAPA is optional. Used for high-potential near-misses and moderate injuries with medical care.                                  | Investigation → optional CAPA → close    |
| **C — Log and close**       | S4 (Minor), S5 (Insignificant) | No investigation. Log it, give first aid if needed, auto-close. Used for paper cuts and low-risk observations.                                                           | Auto-close with full audit trail         |

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
| Type                  | Definition                                                          |
|-----------------------|---------------------------------------------------------------------|
| Injury                | A person is physically hurt (cut, burn, fracture).                  |
| Illness               | A work-caused disease (hearing loss, dermatitis).                   |
| Near-miss             | An event that could have caused harm but did not.                   |
| Property damage       | Damage to equipment, machines, or buildings.                        |
| Environmental release | A spill, leak, or release to air, water, or soil.                   |
| Unsafe condition      | A dangerous situation found (missing guard, exposed wire).          |
| Observation           | A general safety note (good or bad).                                |
| Dangerous occurrence  | A RIDDOR-reportable event (collapse, explosion, scaffold over 5 m). |

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

### 6.4 Witness Statement, Category Type, and Safety Bulletin

This sub-section answers a common review question: "are these three features in v1?" The short answer for each: **Witness statement — partial, must be upgraded.** **Category type — partial, must be extended.** **Safety bulletin — missing, must be added.**

#### 6.4.1 Witness Statement
**Where it is now.** The Report Wizard Step 2 has a "Witnesses" field with a multi-select chip list. It only stores names. The printable Investigation Form (Forms PDF Chapter 8) defines a richer "Witness Interview Records" block with name, role, date, and statement text — but the demo does not yet model this as data.

**The gap.** A real witness statement is more than a name. It is a signed artifact that holds up in a regulatory audit. It needs structured fields, not free text inside the investigation findings.

**v1 plan — add a `WitnessStatement` entity.** See §12.1 for the new row. Fields:
- id, parent_type (`incident` or `investigation`), parent_id
- witness_name, witness_role (employee / contractor / member_of_public / other), witness_contact
- interviewed_by (user_id), interviewed_at
- statement_text (free text, minimum 50 words)
- signature_method (typed_name / drawn_signature / paper_form_uploaded), signed_at
- attachment_file_ids[] (optional audio, video, or scanned paper)
- created_at, updated_at

**v1 UI surfaces:**
- On the **incident detail** screen — a "Witnesses" card with a "+ Add witness statement" button. Clicking opens a modal with the structured form.
- On the **investigation detail** screen — the existing Witness Interview Records block now reads from the same `WitnessStatement` table. Statements added at the incident phase carry over to the investigation automatically.

**Why this matters.** OSHA 301 Field 14–16, RIDDOR F2508, and Track A investigations all expect signed witness records. Storing them as free text inside `Investigation.findings` is not enough for an audit.

#### 6.4.2 Category Type
**Where it is now.** The system has **two levels** of taxonomy today:
1. **Incident type** — 8 fixed types (Injury, Illness, Near-miss, Property damage, Environmental release, Unsafe condition, Observation, Dangerous occurrence). See §6.1.
2. **Category within a type** — for example, *illness category* (occupational asthma, NIHL, dermatitis, …), *hazard category* (mechanical, electrical, chemical), *observation category* (PPE, housekeeping, procedures). These live inside the type-specific Step 2 forms.

**The gap.** There is no **third, cross-cutting category** that works across types. Some companies want to tag every incident with a custom label like "ergonomic," "vehicle," "chemical exposure," "contractor," or "fatigue" — and then run trend reports grouped by that label. The 8 fixed types are too coarse for this.

**v1 plan — add a configurable category layer:**
- New entity `IncidentCategory` (id, name, color, site_id, active). Site admins manage the list.
- New optional field on `Incident`: `category_id` (foreign key to `IncidentCategory`, nullable).
- New filter on the Incidents list and on Reports: "filter by category."
- New chart on the Dashboard: "Incidents by category" (alongside the existing "Incidents by type" chart).

**Why "optional and configurable"?** Different sites use different category sets. Hard-coding categories would force every customer to use SDS Manager's labels. A per-site lookup table avoids that.

#### 6.4.3 Safety Bulletin
**Where it is now.** Missing. The Dashboard demo has an "announcements" panel but it is not a real feature — there is no entity, no audience model, no acknowledgement tracking.

**What a Safety Bulletin is.** After a serious incident (usually Track A), the EHS team writes a one-page "lessons learned" document and pushes it to all affected workers. The bulletin describes what happened (without PII), the root cause, the corrective action, and what every worker should now do differently. It is the main mechanism for sharing learnings across sites so the same incident does not happen twice.

**v1 plan — add a `SafetyBulletin` entity.** Fields:
- id, title, body (markdown), summary (one-line teaser)
- source_incident_id (optional), source_investigation_id (optional), source_capa_id (optional)
- created_by, created_at, published_at, archived_at
- audience: `sites[]` (multi-select), `roles[]` (worker / supervisor / EHS manager / all)
- requires_acknowledgement (boolean)
- attachment_file_ids[]
- status (`draft` / `published` / `archived`)

Plus a child entity `SafetyBulletinAcknowledgement` (id, bulletin_id, user_id, acknowledged_at). One row per user per bulletin once they click "I have read this."

**v1 UI surfaces:**
- New top-level sidebar item: **"Safety bulletins"** between Reports and Settings.
- A **list page** with tabs: All / Published / Drafts / Archived.
- A **detail page** with the bulletin body, attachments, audience, and acknowledgement count.
- A **create / edit page** with a markdown editor, audience picker, source-incident picker, and "publish" button.
- **Dashboard banner** on the worker view: "You have N unread safety bulletins" with a link.
- **Manager dashboard tile**: "Bulletin acknowledgement rate" — shows percentage of audience that has confirmed reading the latest bulletin.

**Auto-suggest hook.** When an investigation closes for a Track A incident, the system suggests creating a bulletin: "This was a Track A incident. Do you want to write a safety bulletin to share the lessons learned?" One click pre-fills title, source incident, source investigation, and a draft body from the investigation findings.

**Why this matters.** ISO 45001 clause 7.4 (Communication) and both OSHA and HSE guidance require that "lessons learned" be shared with workers who could be affected by the same hazard. Without a bulletin module, the same incident can repeat at another site, and the audit trail does not show that workers were informed.

**Roadmap placement.** This is part of **Phase 5 (Reports)** in §18 — bulletins are an output of the investigation/CAPA pipeline, not a separate workflow.

### 6.5 Worker-flow smoothness rules

The worker is the most-protected user in the system. They open the app under stress (something just happened) and they have other work to do. Every screen in the Report Wizard must follow the **30-second rule**: a confused worker who cannot understand a screen in 30 seconds will give up. The system must not let that happen.

**Friction reducers (built into the wizard).**
- **One decision per screen.** Step 1 asks "what" and "where". Step 2 asks "details". Step 3 confirms. Never split a single decision across two screens, never ask two unrelated questions on one screen.
- **Sensible defaults everywhere.** Date / time defaults to "now". Site defaults to the worker's home site. Reporter defaults to the logged-in user. Severity defaults to the matrix output. The worker confirms; they do not configure.
- **Auto-save every 5 seconds.** A draft is created the moment Step 1 is touched. If the worker is interrupted (a coworker calls them away, the phone dies), they can resume on the same device or a different device.
- **Resume banner.** On Dashboard load, "You have an unfinished report from 14 minutes ago. Continue or discard?" One click in either direction.
- **Voice-to-text on every text field.** The narrative box, the witness names, the description. Microphone icon visible on hover and on focus. SmartQHSE-confirmed pattern.
- **Camera-first attachment.** On mobile and tablet, the attachment button opens the camera, not the file picker. On desktop, drag-and-drop is primary; file picker is the fallback.
- **Body map is tap, not select.** Worker taps where they hurt. The system maps the tap to the canonical body part. No dropdown of "left distal phalanx of the third digit."
- **Plain-English regulator language.** "Did this person go to a hospital?" not "Was the case OSHA recordable per 1904.7(b)(1)?" Recordability is computed; the worker only describes the facts.
- **Inline examples.** Every non-obvious field has a "Use example" link that fills in a realistic placeholder. The placeholder shows what to write, not what to copy.
- **Step counter and progress bar at the top.** Worker always knows where they are: "Step 2 of 3 — about 1 minute left."

**Error recovery (what happens when something goes wrong).**
- **Validation runs on blur, not on submit.** The error appears next to the field the worker just left, not in a banner at the bottom they have to scroll to find.
- **Inline error copy is friendly.** "We need a date and time" not "ERROR: required field missing." Errors point to the fix, not the rule.
- **Submit is never destructive.** If submit fails (network down, server error), the draft stays in place. The worker sees "Could not submit — we'll retry. You can also try again now." The system retries automatically every 30 seconds for 5 minutes.
- **Offline submit is queued, not refused.** If the worker submits while offline (factory roof, basement), the wizard saves the report locally and shows "Saved — will send when you're back online." When connectivity returns, it auto-syncs. (Full native-mobile offline-first capture is later in the roadmap — see §17.7 and §18 — but the data submit path never loses data.)
- **Photo upload failure does not block submit.** If a 25 MB photo cannot upload, the rest of the report still submits; the photo enters a retry queue with a "tap to retry" badge on the incident detail.
- **Going back never deletes data.** Step 3 → Step 2 → Step 1 — each transition keeps everything the worker entered. The "Back" button never wipes a field.
- **"I picked the wrong type" recovery.** The Step 1 type cards stay editable from any step. A small "Change type" link in the breadcrumb. Switching type does not lose shared fields (title, time, location, narrative).

**The "I'm not sure" escape hatch.**
- "If you are not sure, pick **Observation**" is shown on the type-card grid (already in §16.4). The supervisor can re-classify later — the worker is not penalized for guessing.
- "I don't know" is a valid answer for non-mandatory fields. The form never asks for a fact the worker cannot supply.

**Empty-state and loading-state copy.**
- Empty Incidents list (worker view): "You have not reported any incidents yet. That's fine. Tap **Report incident** if you ever need to."
- Loading: "Saving — about a second." Never a bare spinner.
- Submitted: "Done. We sent it to your supervisor. You can close this page." Confirmation is concrete; the worker knows their part is over.

**The submit-confirmation pattern (most important screen in the worker flow).**
After Step 3 submit, the worker lands on a one-screen confirmation:
1. **Big green check + the incident ID** (`INC-2026-0142`).
2. **What we did**: "We classified this as Track A and notified your supervisor + EHS manager."
3. **What happens next** (one line each): "You may be asked to add details. Otherwise, your part is done."
4. **One button**: "Back to Dashboard." (No second-tier "rate your experience" survey, no "share with team" prompt — this is not a moment for product upsell.)

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

### 7.4 Investigator-flow smoothness rules

The EHS manager / lead investigator opens an investigation under time pressure (OSHA 301 is due in 7 days; an executive wants an update). The Investigation module must save them keystrokes, not add ceremony.

**Friction reducers.**
- **Pre-filled everything from the incident.** When an investigation is created, every shared field (people, location, narrative, photos, SDS) carries over read-only. The investigator never re-types what the worker already entered.
- **Default lead = current user.** The person opening the investigation becomes the lead; a single click changes it.
- **5-Why builder is keyboard-driven.** Tab moves to the next "why". `Enter` saves the current row and opens the next. `Cmd/Ctrl+Enter` marks the current row as ROOT CAUSE and closes the chain. No mouse needed for the analysis itself.
- **Evidence drawer is one panel, never a modal.** The investigator can drop photos and documents into a side drawer while reading the narrative. Modals that hide the underlying record cost time.
- **SDS auto-attach happens silently.** If the incident names a chemical, the SDS appears in the Evidence list with an "auto-attached" badge. The investigator does not initiate the attach.
- **Witness statements pull from §6.4.1 entity.** Statements added at the incident phase are visible in the investigation view immediately. No re-key, no re-upload.
- **Kanban drag is the primary state change.** Drag from "In progress" to "Awaiting CAPA" updates state, time-stamps the move, and writes the activity log. No status dropdown menu.
- **OSHA 301 draft is one click.** The "OSHA 301 due in N days" banner has a single button: **Open draft**. The form opens pre-populated; the investigator reviews and signs. No "select incident → select form type → confirm" sequence.

**Error recovery.**
- **Auto-save on every field blur.** No "save investigation" button required for in-progress work. The Close action is the only explicit save.
- **Lock contention.** If two investigators open the same case, the second sees "Sara is editing this investigation. View read-only or take over?" Take-over writes a log entry. No silent overwrite.
- **Closing without RCA is allowed but warned.** "This investigation has no root cause recorded. Close anyway?" Yes is one click. Some Track B cases truly do not need an RCA.
- **Re-opening a closed investigation** is a single action with a required reason. The case re-opens; CAPAs already created stay linked.

**Smoothness in the close-out.**
- The two close options ("no CAPA" / "assign CAPA") are radio buttons on the same screen, not separate flows. Switching between them is instant and does not lose data.
- "Assign CAPA" opens an inline form (not a modal). The form is pre-filled with title and description from the findings — the investigator typically only sets the owner, verifier, and due date.

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

### 8.6 CAPA-flow smoothness rules

The CAPA module has two distinct user flows and they must not interfere with each other.

**Owner flow — "I have to do the work."**
- **"My CAPAs" tab is the default landing.** The owner sees only what they own, sorted by due date ascending. No filtering required to find work.
- **Progress is granular but optional.** A simple slider (0%, 25%, 50%, 75%, 100%) plus a checklist of sub-tasks if the CAPA is complex. The owner can mark complete without filling the checklist.
- **Mark complete is one button + one upload.** "Mark complete" opens a small modal: upload one piece of proof, write one sentence on what was done. Submit. The CAPA enters Pending Verification automatically.
- **Cannot accidentally close.** "Mark complete" is not "Close" — the owner-cannot-verify-own-CAPA rule (§8.3) means the database refuses any attempt to close. Mark complete is the maximum scope of the owner action.
- **Inline comments on the CAPA card.** The owner can ask "do I need to attach the maintenance log too?" and tag the verifier. Threaded reply, no email round-trip.

**Verifier flow — "I have to check the work."**
- **"Pending verification" inbox is one tab, one click.** All CAPAs awaiting this verifier's sign-off, sorted by completed-at descending. Verifiers do their queue, not a search.
- **Side-by-side: action vs. evidence.** The verification screen shows the CAPA description on the left, the owner's evidence on the right. No tab switching to compare what was promised vs. delivered.
- **Four verdict buttons, one screen.** Effective / Partially effective / Not effective / Too early to verify. Each opens a small reason field. Submit closes (or re-opens) the CAPA atomically.
- **"Too early to verify" sets a calendar reminder.** Verifier picks a date; the CAPA returns to their inbox on that date with the prior context intact.
- **Cannot verify own work.** If a verifier somehow lands on a CAPA where they are also the owner (admin error, role change), the verdict buttons are disabled with an inline note: "You are the owner of this CAPA — an independent verifier must sign off."

**Overdue smoothness — escalation without nagging.**
- Reminders are **smart-batched**: one email per owner per day listing all their overdue CAPAs, not one email per CAPA. Spam → ignored email → missed deadline.
- Reminders respect **quiet hours** (default: send between 8am–6pm site-local). A 2am alert is noise.
- Escalation to the EHS manager at day 3 includes the owner on the email, not a private side-channel. The owner sees that the manager has been notified and can act before it becomes a meeting.
- The Dashboard "Overdue CAPAs" tile is a clickable list, not just a count. One click → owner-grouped view. The EHS manager can see at a glance that "Sara has 4 overdue, everyone else has 0" — that is a Sara conversation, not a system problem.

**Empty-state copy.**
- Empty owner inbox: "Nothing on your plate. Nice."
- Empty verifier inbox: "All clear. Nothing waiting on you."

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

These are **lagging indicators** (they measure things that already happened). v1 will show them clearly. The 2026 industry view says we should also show **leading indicators** (early warnings). See §17 for the list.

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

### 11.2 Notification smoothness rules — do not become noise

A regulatory notification system that gets ignored is worse than no system at all. Three rules govern every alert.

**Severity-tiered channels.**
- **Critical (S1, OSHA 8-hour, RIDDOR "without delay"):** in-app banner + push notification + email + SMS to the named on-call phone. Bypasses quiet hours. Cannot be silenced by the user.
- **High (S2, OSHA 24-hour, CAPA overdue ≥3 days):** in-app banner + email. Respects quiet hours.
- **Normal (S3, CAPA due today, investigation idle 7+ days):** in-app + smart-batched daily digest email. Quiet hours apply.
- **Low (S4 / S5 closed, FYI events):** in-app only, no email, no badge.

**Smart-batching rules.**
- One **morning digest** (8am site-local) per role: "Here is what is on your plate today." Replaces one-email-per-event for normal-tier alerts.
- One **on-event email** for critical and high tiers — these cannot wait for the digest.
- The owner gets **one** overdue-CAPA email per day, not one per CAPA. List inside.
- Reminders for the same item back off: day 1 email → day 2 in-app only → day 3 escalate. No daily ping forever.

**Quiet hours and time zones.**
- Default quiet hours: 6pm–8am **site-local**. Each user can set their own override.
- Critical alerts always fire (deaths, RIDDOR specified injuries) — quiet hours are for noise reduction, not regulatory blindness.
- Daily-overdue and digest jobs run at **site-local midnight / 8am**, not server UTC. A US site at 2am UTC midnight should not get a notification.
- Site time zones come from `Site.timezone` (set in step 1 of the setup wizard, §16.3).

**One-click actions on every alert.**
- Every notification (in-app, email, SMS) ends with a deep link that opens the exact record needing attention. Two-step "open the app, search for the case" sequences cost minutes per alert, hours per week.
- Email subject line is the action: `[Action needed] CAPA-044 due today` not `Notification: status update`.
- SMS for critical only, ≤160 chars: `OSHA 8-hr deadline. Death at Cleveland. Call OSHA Area Office now: 216-447-4194. Open: <link>`.

**Silencing a noisy alert is one click, not a setting page.**
- Each notification has an "I'm not the right person" link. One click reassigns the alert to the user's manager and logs the reason. The user is not punished for honest delegation.
- For non-critical alerts only — a worker cannot silence "OSHA 8-hour" by reassigning.

---

## 12. Data Model

### 12.1 One section, all entities — read this first
**This is the only data-model section in the document.** The previous version (v1) split the entities across three places: §12 (core), §15.7 (future modules), and §16.9 (onboarding). That was confusing. Now everything is here, in one place, organized by domain.

**Scope rule:** every entity listed in this section is in build scope. There is no "future" or "v2+" entity. Phasing belongs in §18 (delivery order), not in the data model.

**Three platform rules every entity follows.** These are non-negotiable:
1. **Stable UUID id.** Every row has a UUID `id`. Any record can link to any other record by id. There is no module-specific identifier scheme.
2. **Append-only audit trail.** Every write goes to one shared `ActivityLog` table. Modules do not invent their own logs.
3. **Soft delete only.** Hard deletion happens only by the explicit retention job after the regulatory window (5 years for OSHA, 3 years for RIDDOR).

Every entity in §12.2 below carries these standard columns implicitly: `id` (UUID), `created_at`, `updated_at`, `deleted_at` (nullable, soft-delete), and `tenant_id` if the platform team confirms multi-tenant deployment.

### 12.2 Entities by domain

#### 12.2.1 Core (users, sites, infrastructure)

| Entity | Purpose | Key fields |
|---|---|---|
| `Site` | A physical location under regulation. | id, name, address, country, region, timezone, regulator (osha / hse / both), establishment_id, naics_code, hse_establishment_number |
| `User` | A person who uses the system. | id, name, email, role (worker / supervisor / ehs_manager / verifier / admin), site_id, department, employment_status, manager_id |
| `File` | Any uploaded file (photos, PDFs, signed forms). | id, parent_type, parent_id, filename, mime_type, size_bytes, uploaded_by, uploaded_at, storage_location (`local:/var/data/files/2026/05/abc.jpg`), checksum |
| `ActivityLog` | One append-only row per write across the whole system. The audit trail. | id, entity_type, entity_id, action (create / update / soft_delete / state_change), actor_user_id, before (JSONB), after (JSONB), at |
| `OverrideLog` | Records every supervisor override of an auto-classification. | id, entity_type, entity_id, field, old_value, new_value, user_id, reason, at |
| `Notification` | Each regulatory or system alert that fired, with its deadline. | id, source_entity_type, source_entity_id, type (osha_fatality / osha_24hr / riddor_immediate / riddor_15day / riddor_disease / riddor_do / capa_overdue / sop_acknowledge), deadline, status (pending / sent / acknowledged), notified_at, notified_by, channel (in_app / email / sms) |

#### 12.2.2 Incident pipeline (Module 1)

| Entity | Purpose | Key fields |
|---|---|---|
| `Incident` | The root record of a reported safety event. | id, title, type (8 enum values), description, date_time, site_id, area, location, severity (s1–s5), track (a / b / c), status, reported_by, assigned_to, osha_recordable, riddor_reportable, category_id (nullable), is_sandbox (bool), classified_at, closed_at |
| `IncidentCategory` | Site-configurable cross-cutting category (ergonomic, vehicle, contractor, etc.). | id, name, color, site_id, active |
| `InjuredPerson` | Who was hurt. One row per affected person; an incident can have many. | id, incident_id, name, job_title, department, supervisor_id, employment_status, body_part[], injury_nature, mechanism, object_substance (OSHA 301 #17), treatment, days_away, days_restricted, date_of_death, ppe_worn[] |
| `IncidentDetailInjury` | Type-specific child table — Injury fields. | incident_id, injury_type, severity_classification, recordable_classification, riddor_classification |
| `IncidentDetailIllness` | Type-specific child table — Illness fields. | incident_id, illness_category, exposure_type[], substance_or_agent, occupational_classification, medical_status, physician_name |
| `IncidentDetailNearMiss` | Type-specific child table — Near-miss fields. | incident_id, potential_severity, potential_outcomes[], hazard_category, contributing_factors[], is_recurring |
| `IncidentDetailPropertyDamage` | Type-specific child table — Property damage fields. | incident_id, equipment_name, asset_id, damage_types[], repair_cost, replace_cost, equipment_status |
| `IncidentDetailEnvironmentalRelease` | Type-specific child table — Environmental release fields. | incident_id, substance_name, cas_number, quantity, unit, release_medium[], containment_status, regulatory_flags[] |
| `IncidentDetailUnsafeCondition` | Type-specific child table — Unsafe condition fields. | incident_id, hazard_type, risk_level, urgency, current_controls[], recommended_action |
| `IncidentDetailObservation` | Type-specific child table — Observation fields. | incident_id, observation_type, category, action_taken[], follow_up_required |
| `IncidentDetailDangerousOccurrence` | Type-specific child table — Dangerous occurrence (RIDDOR Schedule 2). | incident_id, do_types[], persons_at_risk_count, equipment_name, hse_phone_at, hse_reference, written_report_at |
| `WitnessStatement` | A signed witness record — structured, not free text. | id, parent_type (incident / investigation), parent_id, witness_name, witness_role, witness_contact, interviewed_by, interviewed_at, statement_text, signature_method (typed / drawn / paper), signed_at, attachment_file_ids[] |
| `Evidence` | A file linked to an investigation as evidence. Wraps a `File` record with extra context. | id, investigation_id, file_id, type (photo / document / sds / sop / log), description, uploaded_by, uploaded_at |

#### 12.2.3 Investigation (Module 2)

| Entity | Purpose | Key fields |
|---|---|---|
| `Investigation` | The root record of an investigation triggered by a Track A or B incident. | id, incident_id, lead_investigator_id, team[], status (pending / in_progress / awaiting_capa / closed), started_at, due_date, rca_method (5_why / fishbone / both), root_cause, findings, closed_at |
| `FiveWhy` | The five-why chain for an investigation. One row per "why" level. | id, investigation_id, level (1–5), question, answer, is_root_cause, created_by, created_at |
| `FishboneCategory` | Categorized contributing factors per investigation (people / process / equipment / materials / environment / management). | id, investigation_id, category, factors[] |

#### 12.2.4 CAPA (Module 3)

| Entity | Purpose | Key fields |
|---|---|---|
| `CAPA` | A corrective or preventive action assigned out of an investigation. | id, source_investigation_id, source_audit_finding_id (nullable), source_inspection_finding_id (nullable), title, description, type (corrective / preventive), owner_id, verifier_id, due_date, status (created / in_progress / completed / pending_verification / verified_closed / rejected), progress, completed_at, verified_at, verification_result (effective / partially / not_effective / too_early) |

#### 12.2.5 Documents and document control

| Entity | Purpose | Key fields |
|---|---|---|
| `Document` | A controlled document (SOP, SDS, policy, training material). | id, title, type (sop / sds / policy / training / form), site_id, current_version_id, status (draft / review / approved / published / under_revision / retired), owner_id, effective_date, expiry_date |
| `DocumentVersion` | A version of a document. The file lives in `File`. | id, document_id, version_number (semver), change_summary, file_id, approved_by, approved_at, status |
| `DocumentAcknowledgement` | Forced acknowledgement record. One row per user per version. | id, document_version_id, user_id, acknowledged_at, method (in_app / kiosk / paper_uploaded) |
| `DocumentApproval` | Approval workflow step record. | id, document_version_id, approver_id, role, decision (approve / reject / request_changes), comment, decided_at |

#### 12.2.6 Training

| Entity | Purpose | Key fields |
|---|---|---|
| `TrainingCourse` | A course definition (forklift, first aid, hot work, etc.). | id, name, description, document_id (course material), required_for_roles[], required_for_sites[], expiry_months |
| `TrainingAssignment` | A specific user is assigned a specific course. | id, training_course_id, user_id, assigned_at, due_date, completed_at, expires_at, score, signature_method |

#### 12.2.7 Audit management

| Entity | Purpose | Key fields |
|---|---|---|
| `Audit` | A planned audit (internal, supplier, regulatory). | id, type, scope, site_id, scheduled_date, completed_date, auditor_id, checklist_id, status (scheduled / in_progress / completed / closed) |
| `AuditChecklist` | A reusable audit template. | id, name, regulator (osha / hse / iso_45001 / custom), questions (JSONB), version |
| `AuditFinding` | One finding from an audit. May escalate to a CAPA. | id, audit_id, description, severity (major / minor / observation), evidence_file_ids[], capa_id (nullable) |

#### 12.2.8 Change management (MOC)

| Entity | Purpose | Key fields |
|---|---|---|
| `Change` | A management-of-change record (chemical, SOP, equipment, process). | id, type, description, requester_id, risk_assessment_jsa_id, approver_ids[], status (proposed / risk_assessed / approved / rejected / implemented / closed), approved_at, implemented_at |

#### 12.2.9 Inspections

| Entity | Purpose | Key fields |
|---|---|---|
| `InspectionTemplate` | A reusable inspection checklist (forklift pre-use, fire-extinguisher, etc.). | id, name, items (JSONB), schedule (daily / weekly / monthly / yearly / on_demand), assigned_to_role, site_id |
| `Inspection` | One run of an inspection. | id, template_id, site_id, area, inspector_id, conducted_at, gps_lat, gps_lng, status (passed / failed / partial), photo_file_ids[] |
| `InspectionFinding` | A failed item from an inspection. May escalate to a CAPA or Unsafe Condition incident. | id, inspection_id, item_id, finding, severity, capa_id (nullable), incident_id (nullable) |

#### 12.2.10 Permit-to-Work

| Entity | Purpose | Key fields |
|---|---|---|
| `Permit` | A permit-to-work record. | id, type (15 standard types), area, requester_id, approvers[] (multi-signatory), valid_from, valid_to, status (draft / pending_approval / issued / suspended / closed), related_jsa_id |
| `PermitGasTest` | A gas reading taken to validate confined-space or hot-work permit. | id, permit_id, instrument_id, instrument_calibration_date, o2_pct, lel_pct, h2s_ppm, co_ppm, sampler_id, sampled_at |
| `PermitIsolation` | A lockout/tagout (LOTO) record attached to a permit. | id, permit_id, energy_source, isolation_point, lock_id, tag_id, isolator_id, witness_id, applied_at, removed_at, zero_energy_verified_at |

#### 12.2.11 Risk register

| Entity | Purpose | Key fields |
|---|---|---|
| `RiskRegister` | Master list of standing hazards at a site. Distinct from incident-side 5×5 matrix. | id, hazard, site_id, area, current_risk, residual_risk, controls (JSONB), owner_id, review_date, last_reviewed_at |

#### 12.2.12 Supplier and contractor

| Entity | Purpose | Key fields |
|---|---|---|
| `Contractor` | A contractor company that works on site. | id, name, contact_name, contact_phone, insurance_expiry, status (pre_qualified / approved / suspended) |
| `ContractorInduction` | Per-contractor-worker induction record. | id, contractor_id, worker_name, induction_date, ppe_check[], training_records[], expires_at |

#### 12.2.13 Toolbox Talks

| Entity | Purpose | Key fields |
|---|---|---|
| `ToolboxTalk` | A short safety-meeting record. | id, title, body (markdown), topic, presenter_id, scheduled_at, site_id, attachment_file_ids[], status (draft / scheduled / completed), source_incident_id (nullable) |
| `ToolboxTalkAttendance` | One row per attendee per talk. | id, toolbox_talk_id, user_id, signed_at, signature_method (qr / typed / drawn / paper) |

#### 12.2.14 Behavior-Based Safety (BBS)

| Entity           | Purpose                                    | Key fields                                                                                                                                                                                                                                                                                                                                                    |
|------------------|--------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `BBSObservation` | High-volume / low-detail observation card. | id, observer_id, observed_target (free text or user_id), is_anonymous, category (ppe / housekeeping / procedure / ergonomics / driving / lifting / other), classification (safe_act / unsafe_act / unsafe_condition / near_miss / environmental / stop_work), note, photo_file_id, observed_at, site_id, area, gps_lat, gps_lng, converted_capa_id (nullable) |

#### 12.2.15 JSA / HIRA

| Entity | Purpose | Key fields |
|---|---|---|
| `JSA` | Pre-work risk assessment for one task. | id, task_title, work_area, site_id, hazards (JSONB — each hazard has description, risk_before, controls[], risk_after), approver_id, approved_at, status (draft / approved / expired), related_permit_id |

#### 12.2.16 Safety Bulletins

| Entity | Purpose | Key fields |
|---|---|---|
| `SafetyBulletin` | A "lessons learned" announcement pushed to a defined audience. | id, title, body (markdown), summary, source_incident_id, source_investigation_id, source_capa_id, created_by, created_at, published_at, archived_at, sites[], roles[], requires_acknowledgement, attachment_file_ids[], status (draft / published / archived) |
| `SafetyBulletinAcknowledgement` | One row per user who acknowledged the bulletin. | id, bulletin_id, user_id, acknowledged_at |

#### 12.2.17 Emergency management

| Entity | Purpose | Key fields |
|---|---|---|
| `EmergencyResponsePlan` | A versioned response plan per hazard type per site. | id, site_id, hazard_type (fire / chemical / medical / weather / security), document_id, effective_from, effective_to, requires_acknowledgement |
| `MusterPoint` | A muster (assembly) point at a site. | id, site_id, label, capacity, gps_lat, gps_lng, photo_file_id |
| `EmergencyDrill` | A drill record with timing data. | id, site_id, drill_type, scheduled_at, conducted_at, evacuation_seconds, participants[], findings_capa_ids[] |
| `EmergencyContact` | Phone book of regulators and responders. | id, site_id, role (fire / ambulance / hse_hotline / hospital / environmental_authority), name, phone, address |

#### 12.2.18 Environmental compliance

| Entity | Purpose | Key fields |
|---|---|---|
| `WasteStream` | A category of waste generated by the site. | id, site_id, name, classification (hazardous / non_hazardous / universal), unit_of_measure, disposal_vendor |
| `WasteManifest` | A shipment record for a waste stream. | id, site_id, waste_stream_id, quantity, generated_at, transferred_at, transporter, destination, manifest_number, file_id |
| `EmissionPermit` | An air or water emission permit issued to the site. | id, site_id, source (stack / fugitive / vehicle), pollutant, limit_value, limit_period, regulator |
| `EmissionLog` | A measured emission reading against a permit. | id, emission_permit_id, period_start, period_end, measured_value, breach_incident_id (nullable) |

#### 12.2.19 Onboarding and system

| Entity | Purpose | Key fields |
|---|---|---|
| `OnboardingProgress` | Per-user onboarding state. | id, user_id, role, step (welcome / tour / first_report / done), completed_at, dismissed_at |
| `SiteSetupChecklist` | Per-site admin-wizard progress. | id, site_id, step (1–7), status (not_started / in_progress / done / skipped), completed_at, completed_by |
| `WhatsNew` | A release-note card targeted at a role. | id, version, role[], title, body (markdown), published_at |
| `WhatsNewSeen` | Per-user dismissal of a `WhatsNew` card. | id, whats_new_id, user_id, seen_at |

### 12.3 Relationships at a glance

The arrows below are the load-bearing links. Read them as "X points to Y."

```
Site ◄── User ◄── Incident ──► IncidentCategory
                     │
                     ├──► InjuredPerson ──► (PPE worn list)
                     ├──► IncidentDetail{Type} (one of 8 child tables)
                     ├──► WitnessStatement
                     ├──► Notification (regulator deadlines)
                     └──► Investigation
                              │
                              ├──► Evidence ──► File
                              ├──► FiveWhy
                              ├──► FishboneCategory
                              └──► CAPA ◄── Verifier (User, ≠ Owner)
                                     │
                                     └──► File (verification evidence)

Audit ──► AuditFinding ──► CAPA
Inspection ──► InspectionFinding ──► CAPA or Incident
Change ──► JSA (risk assessment) ──► approval

Document ──► DocumentVersion ──► File
                  │
                  └──► DocumentAcknowledgement (one per user per version)

Permit ──► JSA, PermitGasTest, PermitIsolation
ToolboxTalk ──► ToolboxTalkAttendance (one per attendee)
SafetyBulletin ──► SafetyBulletinAcknowledgement (one per audience user)

ActivityLog records every write across all entities (no exceptions).
OverrideLog records every change to severity / classification.
File is the universal storage for any uploaded artifact.
```

### 12.4 Cross-linking primitive
Three concrete rules every API endpoint follows:
1. Every entity exposes its UUID `id` via every list and detail endpoint.
2. Any record can link to any other record by id, in any direction. The link table is `EntityLink (from_type, from_id, to_type, to_id, relation, created_at)`. Used for soft cross-references (a CAPA "relates to" an Audit even though the canonical link is via `AuditFinding`).
3. The frontend never invents an id-to-record mapping. It calls `GET /api/{entity_type}/{id}` and trusts the API.

### 12.5 Constraints and rules
1. **`CAPA.owner_id ≠ CAPA.verifier_id`** — Postgres `CHECK` constraint. Database refuses the write even if the UI has a bug.
2. **`Investigation.status ∈ { pending, in_progress, awaiting_capa, closed }`** — Postgres `ENUM` type.
3. **`Incident.severity` change requires `OverrideLog` row** — enforced by trigger or service layer.
4. **`Notification` is append-only** — `notified_at` is set at the deadline-action time.
5. **Soft delete only** — no `DELETE` SQL except the retention job.
6. **`ActivityLog` is append-only** — `INSERT` only, no `UPDATE`, no `DELETE` (except retention).
7. **`DocumentAcknowledgement` is one row per user per version** — unique index on (`document_version_id`, `user_id`).
8. **`SafetyBulletinAcknowledgement` is one row per user per bulletin** — unique index on (`bulletin_id`, `user_id`).
9. **`Site.regulator` drives routing and reporting** — table-driven, no hardcoded country branches.
10. **Sandbox sub-tree is segregated** — when `Incident.is_sandbox = true`, no `Notification` row is created, no `OverrideLog` is required, and the row is excluded from every regulatory report. Sandbox rows auto-purge after 7 days by a daily job.
11. **Type-specific child tables** — the `IncidentDetail{Type}` tables are mutually exclusive. Only the matching one for `Incident.type` has a row.

### 12.6 Type-specific child tables vs. JSON
The forms package defines different field sets for each of the 8 incident types. We use **child tables** (`IncidentDetailInjury`, `IncidentDetailIllness`, …) for the structured columns and a `details_json JSONB` column on `Incident` only for free-form extensions (PPE list, witnesses chip array). Reasons: child tables are queryable, indexable, and fit the regulatory column maps (OSHA 300 Column E, RIDDOR F2508). JSON is a backup, not the primary store.

Shared lookup tables span types: `BodyPart`, `HazardCategory`, `ExposureType`, `MechanismOfInjury`, `IllnessCategory`. Each has a stable id and is the foreign-key target for the child tables.

### 12.7 Database engine choice

> **Recommendation: PostgreSQL 16 (or newer) with a TypeScript ORM. Self-hosted.**
> Final choice must be confirmed with the SDS Manager platform team. They own the wider stack.

#### Why PostgreSQL?
Our data model needs five things. PostgreSQL gives us all of them in one engine, with no extra add-on services.

| Need | Why we need it | What PostgreSQL gives us |
|---|---|---|
| **Strong relational shape** | The data model is full of one-to-many and many-to-many links (Incident → Investigation → CAPA → Verifier). We need foreign keys and JOINs. | First-class foreign keys, JOINs, indexes. |
| **CHECK constraints at the DB level** | The `CAPA.owner ≠ CAPA.verifier` rule and severity / status enums must hold even if the app has a bug. | `CHECK` constraints, `ENUM` types. |
| **Append-only audit trail** | `OverrideLog` and `ActivityLog` must never be edited. | Trigger-based row-versioning patterns (pgMemento, custom triggers). PostgreSQL's `pgaudit` extension also gives session-level audit logs for compliance. |
| **Per-type detail tables AND optional JSON** | §12.6 uses child tables, with a `JSONB` column for free-form extensions. | `JSONB` columns store flexible data while still being indexable and queryable. |
| **Row-level security by site / role** | A user from Cleveland Plant must not see Sheffield's incidents. | `Row-Level Security (RLS)` policies move multi-site isolation to the storage layer. |

#### Why not the alternatives?
- **MySQL / MariaDB** — works, but `JSONB` (indexable, fast) is a Postgres-only feature. Postgres has stronger CHECK constraint support and easier RLS.
- **MongoDB / document stores** — wrong shape for this data. The model has many strict relationships and audit rules. Document stores make these harder, not easier.
- **SQLite** — fine for the demo, not for production. No real concurrency, no row-level security.
- **Cloud-only stores (DynamoDB, Firestore)** — vendor lock-in, no JOINs, weak constraint support. Avoid.

#### Data-access layer (ORM)
Two safe options. Both work well with PostgreSQL.

| Option | Best for | Trade-offs |
|---|---|---|
| **Prisma** | Faster developer experience. Schema-first design. Mature ecosystem. Lots of guides. | Larger bundle, slower cold starts on serverless. A code-gen step is needed before each run. |
| **Drizzle** | Closer to plain SQL. Smaller bundle. Faster cold starts. Better for serverless / edge. Type updates are instant. | Smaller community than Prisma. Less abstract — you write more SQL-like code. |

**Recommendation: start with Prisma** unless the platform team has a strong reason for Drizzle. The data model is large (40+ entities). Prisma's schema file scales better, and the team's onboarding cost is lower.

#### Database hosting — self-hosted PostgreSQL
**Decision:** we run our own PostgreSQL instance. **No managed services** (no AWS RDS, no Neon, no Supabase, no Cloud SQL).

- The SDS Manager platform team already runs its own database. We use the same instance / cluster.
- No extra vendor bills, no vendor lock-in.
- Full control over `postgresql.conf`, extensions, backup schedule, and replication.
- Data stays inside our own network, which simplifies the GDPR / HIPAA / SOC 2 review (see §19.3).

**Required extensions:** `pgaudit` (session audit log), `pgcrypto` (UUIDs and hashing), `pg_trgm` (fast text search). Optional: `pgMemento` for schema-versioning audit.

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
The backup plan is fully on our team. Four layers:
- **Daily logical dump** — a nightly `pg_dump` of the full database, stored on a different host than the DB server. Keep dumps for at least 35 days.
- **Continuous WAL archiving for point-in-time recovery (PITR).** Configure `archive_mode = on` and `archive_command` to ship WAL segments off-server. PITR is required by the 5-year OSHA / 3-year RIDDOR retention rules.
- **Weekly base backup** with `pg_basebackup`, kept off-server. Used as the starting point for PITR replays.
- **File backups** — the `File` table follows the same nightly schedule but writes to a separate off-server target.

**Application-side rules:** soft-delete only; hard delete only by the retention job; quarterly restore drill into staging — a backup that has never been tested is not a backup.

#### Search
Search uses PostgreSQL full-text search (`tsvector` + `tsquery`) on incident title, description, investigation findings, and toolbox talk body. If full-text across attached PDFs and OCR'd photos is needed later, OpenSearch or Elastic can be added without changing the data model.

#### Caching and sessions
- Sessions: cookie-based JWT or database-backed session table. The platform team's existing pattern wins.
- Cache: Redis only when a measured slow path needs it. Not by default.

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

This section explains how our system handles these features. **All of them are in build scope.** Delivery order is in §18.

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

### 15.3 Basic file handling (in scope, used by every module)
Basic file handling is the foundation that every other module depends on. The Document Control module in §15.4 sits on top of these primitives. Production must support all of the following:

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

### 15.4 Full document control (in scope)
A real Document Control module, in build scope. This is the standard set of features every QMS has:

- **Version history** — major and minor versions. Every change is a new version. Old versions stay viewable.
- **Document life cycle** — Draft → In review → Approved → Published → Under revision → Retired.
- **Approval workflow** — author submits → reviewer approves → manager signs off. The flow can have many steps.
- **Electronic signatures** — meet 21 CFR Part 11 if the platform sells into life sciences (drug, device, lab).
- **Auto-training trigger** — when an SOP version changes, every employee assigned to that SOP must be re-trained. The system tracks who has read the new version.
- **Effective date and expiry date** — show "next review due in 30 days" warnings on the Dashboard.
- **Document-to-event linking** — every CAPA points to the SOP it changed. Every investigation points to the SDS it consulted. The audit trail must show "the SOP version in effect at the time the incident happened."
- **Role-based access** — view, edit, approve, retire — each is a different permission.
- **Forced acknowledgement workflow** — when a critical SOP version changes, every affected user must click "I have read the new version" before they can do work that the SOP governs. The system blocks the work screen until the acknowledgement is on file. This is what tools like SmartQHSE call "controlled distribution."
- **Distribution audit-trail visualization** — a screen that shows, for any document, who has read which version, when, and on which device. This makes audit prep one click instead of one week.

### 15.5 Other standard modules every QMS / IMS has
These modules are common in tools like MasterControl, EHS Insight, ETQ Reliance, AssurX, and Riskonnect. **All of them are in build scope.** Delivery order is in §18.

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
- Link training to SOPs (auto-trigger on new SOP version — see §15.4).
- Show "training overdue" on the Dashboard.
- Could integrate with an external LMS (Learning Management System).
- **Training matrix.** A grid of *roles × required courses* with a status cell for each user (not started / in progress / passed / expired). The site admin views one screen and sees every coverage gap.
- **Certification expiry alerts.** Many courses expire (forklift, first aid, hot work, confined space). The Dashboard surfaces "N certifications expiring in the next 30 days" so the EHS manager can schedule the refresher before the gap.

#### 15.5.4 Inspection management
**Inspections** are short, regular checks. Examples: daily forklift pre-use check, weekly fire-extinguisher check, monthly PPE-station check.
- Mobile-friendly checklist.
- A failed check should be able to trigger an Unsafe Condition incident.
- Photo and signature on each check.

#### 15.5.5 Permit-to-work
A **permit-to-work** is a controlled approval for high-risk work. Examples: hot work (welding, cutting), confined-space entry, working at height, energized electrical work.
- Workflow: requester → safety review → permit issued → work done → permit closed.
- A permit must be on file when an incident happens in a permit-required area. The system links the permit to the incident.

**Standard permit types (about 15).** Industry tools like SmartQHSE ship with a built-in catalog. Our roadmap should plan for the same set:
- Hot work (welding, cutting, grinding)
- Confined-space entry
- Lockout / Tagout (LOTO)
- Excavation
- Working at height
- Electrical isolation / energized work
- Line breaking
- Radiation work
- Diving operations
- Lifting operations (cranes, rigging)
- Hot tap
- Cold work in hazardous areas
- Vehicle entry into restricted areas
- Demolition
- Emergency overrides

**Multi-signatory workflow.** Each permit type needs different approvers (for example, hot work needs a fire watch sign-off; confined space needs a competent-person attendant). The workflow is configurable per permit type.

**SIMOPS conflict detection.** SIMOPS = Simultaneous Operations. The system blocks two high-risk permits in the same area at the same time (for example, hot work + a chemical transfer in the same bay). On submit, the system checks for overlapping permits and flags the conflict to the safety officer.

**JSA prerequisite.** Every permit must reference a completed JSA (see §15.5.10). No JSA, no permit.

**Permit pre-conditions captured in the form (SmartQHSE pattern).** A permit is not just a paper signature — the form must capture the **measurements that prove the work is safe to start**. From SmartQHSE's PTW module we adopt three concrete data-capture requirements:
- **Gas-test records** for every confined-space, hot-work, and tank-entry permit. Fields: instrument id, calibration date, O₂ %, LEL %, H₂S ppm, CO ppm, sampler name, sample time. Re-test interval (typically 4 hours) is enforced — when the interval expires, the permit auto-suspends until a re-test is logged.
- **Isolation (LOTO) certificates** for every electrical / mechanical isolation. Fields: energy source, isolation point, lock id, tag id, isolator name, witness name, verified-zero-energy timestamp. Each lock is tracked from "applied" to "removed" so an open isolation can be queried at any time.
- **Live permit register / map.** A site-wide register shows every active permit with location, type, start time, expiry, and status (active / suspended / closed). Useful for shift handover and emergency response — the fire team must know in seconds where every hot work is happening.

#### 15.5.6 Risk register
A **risk register** is the company's master list of known standing hazards. It is different from the per-incident risk matrix.
- Each entry: hazard, risk rating, controls in place, owner, review date.
- The risk register is the source of leading indicators (open hazards count by site).

#### 15.5.7 Supplier and contractor management
- Track contractor inductions and PPE checks before site entry.
- Link contractors to incidents. The "employment status" field on the incident form (Employee / Self-employed / Contractor / Volunteer / Member of public) already supports this.
- Pre-qualify contractors before work starts (insurance, training, certifications).

#### 15.5.8 Toolbox Talks
A **toolbox talk** is a short safety meeting (5–15 minutes) led by a supervisor at the start of a shift or before a high-risk task. It is the most common day-to-day safety touchpoint on a worksite. Tools like SmartQHSE ship with hundreds of templates and AI-assisted authoring.

**Minimum viable feature:**
- A talk record stores: title, markdown body, topic, presenter, scheduled date and time, attachments (photos, PDFs).
- An attendance record per worker. Each worker signs off (typed name, drawn signature, or **QR-code scan** for in-person attendance).
- A talk can reference a recent incident as the topic. This closes the loop between an investigation and the workforce.
- A library of starter templates (toolbox talk on slips and trips, on hot work, on PPE, etc.).
- A list page with filters by topic, presenter, and site.
- A monthly summary on the Dashboard: "X talks delivered, Y average attendance."

**Multilingual content** is in scope for toolbox talks and other worker-facing content (§16.10): English, Arabic, Hindi, Urdu, and Tagalog. The `body` and `title` fields are Unicode and accept any language. The UI language switcher rolls out in Phase 14 of §18 — until then, content can be authored in any language but the UI chrome is English.

**Reference-incident link (SmartQHSE pattern).** When a Track A investigation closes, the "create safety bulletin" suggestion (§6.4.3) should also offer a one-click "create toolbox talk on this topic." The talk pre-fills title and body from the investigation findings. This closes the **investigation → workforce → behavior change** loop in one click.

#### 15.5.9 Behavior-Based Safety (BBS) Observation Cards
A **BBS observation** is a short note where one worker observes another worker's behavior and records whether it was safe or at-risk. Volume is the point — the target is **one card per worker per week**. The aggregate becomes a leading indicator (see §17.6).

**How is this different from the existing "Observation" incident type?**
- The existing observation incident type is a **detailed, audited record** with 8-card type selection, location, narrative, follow-up. Volume is low.
- A BBS observation is **high volume, low detail** — one screen, three taps. It is for trend analysis, not for investigation.

**Minimum viable feature:**
- Observer (auto-filled), observed target (free text or user_id, **anonymous mode allowed** to encourage honest reporting).
- Category: PPE / housekeeping / procedure / ergonomics / driving / lifting / other.
- **Classification (5 classes — SmartQHSE pattern):** `safe_act` (positive recognition) / `unsafe_act` (worker behavior to correct) / `unsafe_condition` (workplace hazard) / `near_miss` (event without harm) / `environmental` (spill, leak, waste). The 5-class taxonomy is wider than the original safe/at-risk split because it lets one capture flow feed both BBS trend reports and the near-miss / environmental incident pipelines without re-keying.
- **Auto-severity** assigned by classification (for example, `unsafe_condition` of type "missing machine guard" auto-rates higher than a "loose cable" finding). Severity flows into the leading-indicator dashboard.
- **Photo capture with geo-tag.** Each observation accepts photos taken on mobile, GPS-pinned and timestamped — so the safety manager can see clusters on a map view.
- Short note (1–2 sentences). Site, area, observed_at timestamp.
- **Auto-conversion to a tracked corrective action.** Any `unsafe_act`, `unsafe_condition`, or `environmental` observation can be converted to a CAPA in one click — owner, deadline, escalation alert. No unsafe condition lands in the system without a closure path.
- Aggregates into a Dashboard tile: "BBS observations this week: N safe, M unsafe acts, L unsafe conditions." Trend chart over time. Map view shows clustering by area.

**Why anonymous mode matters.** Workers will not report a peer's at-risk behavior if their name is attached. Anonymous mode is what gets the volume up. SmartQHSE's published guidance is the same: higher reporting rates correlate directly with lower injury rates.

**Stop-the-Job authority (related leading indicator).** Any worker can stop work they believe is unsafe and the stop is logged as a `safe_act` observation with category `stop_work`. The dashboard tracks "stop-work events per month" — a healthy number is non-zero. A site that never logs a stop is suppressing them, not safer.

#### 15.5.10 Job Safety Analysis (JSA) / HIRA
A **JSA** (US term) or **HIRA** (Hazard Identification and Risk Assessment, common in GCC and India) is a **pre-work** risk assessment. The team breaks a task into steps, lists the hazards in each step, and lists the controls that bring the risk down.

**How is this different from the incident risk matrix in §10?**
- The §10 matrix is **investigative** — used after an incident to score how serious it was.
- A JSA is **preventive** — used before work starts to decide if the work is safe to do.

Both use the same 5×5 grid, so the underlying severity and likelihood scales are shared.

**Minimum viable feature:**
- Task title, work area, planned start time.
- A list of hazards (JSONB array). Each hazard has: description, risk before controls, controls (list), risk after controls.
- An approver (typically the supervisor) signs off before work begins.
- A JSA is often **required as a prerequisite for a permit-to-work** (see §15.5.5). The permit form pulls the linked JSA in read-only.
- A library of starter JSAs by task type (working at height JSA, hot work JSA, chemical handling JSA).

**Why the same matrix?** Workers should see one risk grid across the whole system. A different scale per module is confusing and error-prone.

#### 15.5.11 Emergency Management
A direct gap surfaced when comparing our plan to SmartQHSE: there is no entity that owns **emergency preparedness**. The current incident pipeline assumes the event already happened. A grown-up EHS platform also covers **what we do before and during** an emergency.

**Minimum viable feature:**
- **Emergency response plans** stored as a versioned `Document` (§15.4) — fire, chemical spill, medical, security, severe weather. Each plan has an effective date, an expiry, and an acknowledgement requirement for the affected workforce.
- **Muster point register.** Each site has named muster points (id, label, capacity, GPS, photo). Muster points are referenced from the response plans and from drill records.
- **Drill scheduling and execution.** Drill record fields: drill type (fire / chemical / medical / shelter-in-place), scheduled date, actual date, participants[], evacuation time, observations[], findings → CAPA link. Quarterly fire drills are usually mandatory by code.
- **Emergency-contact directory** per site — fire department, ambulance, HSE / OSHA hotline, environmental authority, hospital nearest-to-site. Also visible on the Dashboard top banner during an active incident.
- **Active-incident command-post screen.** When an S1 / S2 incident is open, a one-screen command view shows: which permits are active in the affected area (§15.5.5), which workers have signed in (badge / sign-in log), the response plan for this hazard type, and the muster point assignment.

**Delivery order.** Emergency Management lands in Phase 13 of §18, after Document Control (Phase 7) and Permit (Phase 9). It depends on both: response plans live as `Document` records, and active permits surface on the command-post screen. Build order matters; scope does not.

#### 15.5.12 Environmental Compliance
The "E" in EHS is largely missing from v1. We capture **environmental release** as one of the eight incident types, but a real environmental program is wider than the incident form. SmartQHSE bundles waste, emissions, and EIA into one module — for completeness, we plan the same.

**Module scope:**
- **Waste management.** Hazardous and non-hazardous waste streams, generation logs, manifests (US EPA hazardous waste manifest, UK duty-of-care notes), disposal vendors, transfer station logs.
- **Emissions monitoring.** Stack-test records, fugitive-emission logs, air-permit limits and rolling totals against the limit. Breach → auto-creates an environmental release incident.
- **Environmental impact assessment (EIA).** A structured form filled out before any new process or expansion. Same controlled-document life cycle as MOC (§15.5.2).
- **ISO 14001 alignment.** Mirror what we did for ISO 45001 in §17.1 — clause-by-clause map, stored in the help-center side panel.
- **Cross-link to incidents.** When an environmental release incident is filed, the system suggests "log to waste manifest? log to emission log?" so the bookkeeping stays in one place.

**Data model:** `WasteStream`, `WasteManifest`, `EmissionLog`, `EmissionPermit` — all in §12.2.18, all hang off `Site` and link into `CAPA` and `File`.

#### 15.5.13 Quality side (Q in QHSE) — out of scope
This project is **EHS Incident Management**, not full QHSE. The Quality side — non-conformance reports (NCR), supplier audit workflows, calibration tracking, customer complaint handling — is **out of scope**. This is a deliberate product decision, not a deferral.

We mention it here for one reason: if the Quality side is ever added later, the architectural rules from §15.8 (one cross-linking primitive, one shared audit trail, one shared file storage) mean it is additive work, not a rewrite. The data model can grow new entity types (`NonConformance`, `SupplierAudit`, `Calibration`, `CustomerComplaint`) that link into the existing `CAPA`, `File`, `Document`, and audit-trail infrastructure.

If a customer ever asks for the full QHSE platform, this is the door to walk through.

### 15.6 What we build — full scope
Every module in §15 is in build scope. There is no separate "v1.5" or "v2+" backlog. Delivery order is in §18 (the phased roadmap), not module scope.

| Module | In scope | Notes |
|---|---|---|
| File upload + storage on incidents (local disk) | ✅ | |
| Audit trail (`ActivityLog`) + soft delete | ✅ | |
| Auto-attach SDS from library | ✅ | |
| Cross-linking (any record to any record) | ✅ | |
| Export bundle (ZIP / merged PDF) | ✅ | |
| Document Control (version history, approvals, e-signatures, forced acknowledgement) | ✅ | |
| Training management + LMS link | ✅ | |
| Audit management module | ✅ | |
| Change control / Management of Change (MOC) | ✅ | |
| Inspection management | ✅ | |
| Permit-to-Work + gas-test records + isolation (LOTO) certificates + live permit register | ✅ | |
| Risk register | ✅ | |
| Risk register → leading-indicator dashboard | ✅ | |
| Supplier / contractor management | ✅ | |
| Toolbox Talks (with QR sign-off) | ✅ | |
| BBS Observation Cards (anonymous mode + 6-class taxonomy + GPS map clusters + stop-the-job) | ✅ | |
| JSA / HIRA pre-work risk assessment | ✅ | |
| Multi-language toolbox talks (EN / AR / HI / UR / Tagalog) | ✅ | |
| Emergency Management (response plans, muster points, drill scheduling, contact directory, command-post screen) | ✅ | |
| Environmental Compliance (waste streams, emissions monitoring, EIA, ISO 14001 mapping) | ✅ | |
| Stop-the-Job logging + dashboard tile | ✅ | |
| Move file storage to cloud (S3 / GCS / Azure Blob) | ❌ | Out of scope — we self-host (see §12.7). Reconsider only if data volume or geo-distribution forces it. |
| Quality module suite (NCR / supplier audit / calibration / complaints) | ❌ | Out of scope — project is EHS, not full QHSE. See §15.5.13. |

### 15.7 Data model
**See §12.** All entities for every module described in this section live in the unified data model. There is no separate "future entities" table. The whole list — File, Document, DocumentVersion, DocumentAcknowledgement, TrainingCourse, TrainingAssignment, Audit, AuditChecklist, AuditFinding, Change, InspectionTemplate, Inspection, InspectionFinding, Permit, PermitGasTest, PermitIsolation, RiskRegister, Contractor, ContractorInduction, ToolboxTalk, ToolboxTalkAttendance, BBSObservation, JSA, EmergencyResponsePlan, MusterPoint, EmergencyDrill, EmergencyContact, WasteStream, WasteManifest, EmissionPermit, EmissionLog — is in §12.2.

### 15.8 Cross-cutting infrastructure principles
Three platform rules every module follows. These are how the modules stay consistent and how new ones plug in cleanly.

1. **Cross-linking is a first-class data primitive.** Every record has a stable UUID id. The API lets any record link to any other record by id, in any direction. The shared `EntityLink` table (see §12.4) supports soft cross-references. No module invents its own linking pattern.
2. **Audit trail is shared infrastructure.** One append-only `ActivityLog` table that every module writes to. Modules do not build per-module logs.
3. **File storage is shared infrastructure.** One file-storage service. Files have an owner (user), a parent (any entity), a version, and an access role. Files are stored on the server's local disk (see §15.3). The service hides the storage location behind a stable URL — a switch to S3 / GCS / Azure Blob later is a config change, not a rewrite.

---

## 16. Onboarding and First-Run Experience

### 16.1 Why this matters
In an EHS app, onboarding is not a "nice to have." It is the difference between a system that gets used and a system that gets ignored. Three reasons:

1. **Workers do not open EHS apps daily.** They open it once a year — when something just happened. If the first 60 seconds are confusing, they will give up and tell their supervisor verbally instead. The incident never gets recorded.
2. **The cost of an unreported incident is high.** A near-miss not reported is a fatality not prevented. ISO 45001 calls this out directly.
3. **Each role uses the system differently.** A worker reports. A supervisor triages. An EHS manager investigates. An admin configures. One generic welcome screen does not fit all four.

**The goal:** every user reaches their first **success** within their first few minutes. "Success" is different per role.

### 16.2 Onboarding journey by role
Each role gets a different welcome flow on first login.

| Role | First success | Time-to-success target |
|---|---|---|
| **Shop-floor worker** | Submit one real incident report | Under 3 minutes |
| **Supervisor** | Triage one incident (assign / escalate / close) | Under 5 minutes |
| **EHS Manager** | Open an investigation, run 5-Why, assign a CAPA | Under 15 minutes |
| **Independent verifier** | Verify and close one CAPA | Under 5 minutes |
| **Site administrator** | Configure the site, add 5 users, send the first invite | Under 30 minutes |

If a role is not on track to hit its target, the help panel gets more proactive (suggests the next action).

### 16.3 First-time site setup (admin wizard)
When a brand-new site signs in for the first time, the system runs a **setup wizard**. It is one screen broken into 7 small steps. The admin can save & resume at any time. Each step is a single decision.

| Step | What it asks | Why we ask |
|---|---|---|
| 1 | **Site basics** — name, address, country, time zone | Drives time-zone-aware deadlines and the regulator default |
| 2 | **Regulator** — OSHA only / HSE only / both (auto-detected from country) | Decides which reports show in §9 |
| 3 | **OSHA Establishment ID + NAICS** (US sites) **or HSE Establishment Number** (UK sites) | Required for valid 300A and F2508 submission |
| 4 | **Departments and areas** — short list, one per row | Used in the incident location dropdowns |
| 5 | **Users** — invite by email with role (or CSV upload) | Pre-populates the user directory |
| 6 | **Notification recipients** — who receives OSHA 8-hour and RIDDOR "without delay" alerts | Critical — see §11 |
| 7 | **Confirm & launch** — system shows a checklist of what is configured and a "you are ready" message | Gives the admin confidence |

After the wizard finishes, the admin lands on a **setup-progress dashboard** that shows what is still **optional but useful**: incident categories (§6.4.2), branding, custom approval flows, etc. None of these block real use.

### 16.4 Worker first-run flow
A worker sees a different welcome. It is **shorter and more visual**. The goal is not to teach the whole system. The goal is to make them comfortable enough to file the **next real incident**.

**Step 1 — Welcome card (one screen):**
> "Welcome. This is where you report any safety event at work. It takes about 3 minutes. Nobody gets in trouble for reporting a near-miss. Reporting helps everyone stay safe."

**Step 2 — Quick tour (4 dismissable cards):**
1. "Tap **Report incident** at the top right whenever you need to."
2. "Pick the type of event from the 8 cards. If you are not sure, pick **Observation**."
3. "Add photos with drag and drop. Voice-to-text works for the description."
4. "After you submit, the system handles the paperwork. You are done."

**Step 3 — Optional sandbox:**
A button: **"Try a practice report (nothing is saved)."** Opens the wizard in **sandbox mode** with a yellow banner: "Practice mode — this report will not be saved."

**Step 4 — Done.** The worker lands on the Dashboard with a small empty-state message: "You can report an incident any time."

### 16.5 In-app guidance (always-on)
Onboarding never really ends. The system uses three patterns to keep helping users without getting in the way.

| Pattern | Where it shows | Example |
|---|---|---|
| **Tooltips** | On any field with a regulatory term | Hover **OSHA recordability** → "An injury is recordable if it required more than first aid, days away from work, or medical treatment." |
| **Empty states** | On any list with zero rows | Incidents list is empty → "No incidents reported yet. Tap **Report incident** to file the first one." |
| **Contextual help link** | Top right of every page | **Open EHS help center** — opens a side panel with a short article about the current screen |

The **voice-to-text** and **body map** (already in the demo) also count as onboarding aids. They reduce the typing burden for workers who are not comfortable with English forms.

### 16.6 Sample data and sandbox
For demos, training, and self-learning:

- **Sandbox mode** — any worker can run the Report Wizard with a "practice" toggle on. Submissions land in a row with `is_sandbox = true`, never reach the OSHA 300 Log, never trigger notifications. Sandbox rows auto-delete after 7 days.
- **Sample dataset** — for training and demos, the site admin can load a pre-built set of 10 incidents, 5 investigations, 3 CAPAs, and 1 safety bulletin. Every row is clearly marked **DEMO**. One-click clear.

### 16.7 Re-onboarding (when something changes)
Onboarding is not just "first login." Users need light re-onboarding when:

- A **new feature ships** (for example, the Document Control module from §15.4 lands in Phase 7 of §18). Show a one-screen "What's new" card next time the affected role logs in.
- An **SOP changes** that the user is assigned to. Show "Please read the updated SOP for [name]" on next login. This is the auto-training trigger from §15.4.
- The user's **role changes** (worker promoted to supervisor). Show the supervisor tour the first time they see a triage action.

### 16.8 Accessibility and language
Smooth onboarding means accessible onboarding. Even though v1 is English-only (see §2.2), the design must:

- Meet **WCAG 2.2 AA** (already in §18 Phase 7).
- Use **plain English (B1 / level 4 reading level)** — same as this document.
- Avoid acronyms in the first-run flow. Spell them out: "OSHA (US safety office)" the first time, "OSHA" after.
- Work **with a keyboard only** (no required mouse actions).
- Work with a **screen reader**.

### 16.9 Data model
**See §12.2.19.** Onboarding entities (`OnboardingProgress`, `SiteSetupChecklist`, `WhatsNew`, `WhatsNewSeen`) and the `Incident.is_sandbox` column live in the unified data model. There is no separate "onboarding entities" table here.

### 16.10 Onboarding scope — all in
Every onboarding feature listed below is in build scope. Delivery order is in §18.

| Feature | In scope |
|---|---|
| Site setup wizard (7 steps, save & resume) | ✅ |
| Worker welcome card + quick tour | ✅ |
| Empty states with helpful copy | ✅ |
| Tooltips on every regulatory field | ✅ |
| Side-panel help center | ✅ |
| Sandbox / practice mode | ✅ |
| Sample dataset for demos | ✅ |
| What's new cards on release | ✅ |
| Role-change re-onboarding | ✅ |
| In-app product tours (multi-step) | ✅ |
| Onboarding analytics (drop-off, time-to-first-report) | ✅ |
| Multi-language onboarding (EN / AR / HI / UR / Tagalog) | ✅ |
| Video walkthroughs | ✅ |

### 16.11 Onboarding success metrics
How do we know onboarding works? Track these from day 1.

- **Time-to-first-report** — for a worker, how long between first login and first submitted incident.
- **Setup-wizard completion rate** — what percentage of admins finish all 7 steps.
- **First-report drop-off** — what percentage of workers start the Report Wizard but do not submit.
- **Help-center open rate** — high opens on a single screen = the screen is confusing, fix it.
- **Sandbox usage** — high usage = a sign workers are unsure; pair with extra in-product help.

These metrics surface in the analytics dashboard. Underlying events are logged from day 1 so the dashboard can read the full history.

### 16.12 Anti-patterns to avoid
Things we will **not** do, because they make onboarding worse, not better:

- **No long video on first login.** Workers will not watch it.
- **No 20-step "wizard."** The 7-step admin setup is already the limit. More steps = drop-off.
- **No mandatory training quiz before the first incident report.** The point of v1 is to lower the barrier to reporting, not raise it.
- **No clippy-style mascot or "did you mean?" pop-ups.** Tooltips on hover only. Help is pulled, not pushed.
- **No dark patterns** ("Are you sure you want to skip this important step?"). Skip is always one click. The help center is always one click.

### 16.13 End-to-End User-Flow Playbook (the smooth path for every role)

This sub-section is the **single source of truth for end-to-end smoothness**. It walks each role through their typical day in the system, calls out the handoffs between roles, and lists the smoothness rules that apply at each step. The module-level rules in §6.5 (Worker), §7.4 (Investigator), §8.6 (CAPA owner / verifier), and §11.2 (Notifications) are the building blocks. This section is how they fit together.

#### 16.13.1 The five end-to-end flows

| Flow | Trigger | Key roles touched | Target end-to-end time |
|---|---|---|---|
| **A. Worker reports → Track A investigation → CAPA → verified close** | Severe injury, fatality, dangerous occurrence | Worker → Supervisor → EHS Manager → CAPA Owner → Verifier | ≤ 60 days from report to verified close |
| **B. Worker reports → Track B light review → optional CAPA → close** | Moderate injury, high-potential near-miss | Worker → Supervisor → optional EHS Manager → optional CAPA Owner | ≤ 30 days |
| **C. Worker reports → Track C log-and-close** | Minor near-miss, observation, paper-cut injury | Worker → Supervisor (auto-close) | ≤ 1 day |
| **D. Worker submits BBS observation → trend dashboard / converted to CAPA** | Routine BBS card | Worker → Supervisor (review) → optional CAPA Owner | ≤ 1 day for review; ≤ 7 days for action |
| **E. Admin sets up a new site → first real incident reported** | New site goes live | Admin → first Worker | ≤ 30 minutes setup + worker report ≤ 3 minutes |

#### 16.13.2 Flow A — the "full incident" happy path

This is the most-protected flow because it carries the most regulatory weight. The system must do **all the chasing**; the human roles do their part and hand off cleanly.

```
[Worker]  Open app → tap Report → 3-step wizard → submit
            │
            ▼  (auto-classification fires immediately)
[System]  Severity = S1 → Track A
          OSHA 8-hour clock STARTS NOW (§11)
          Investigation record auto-created
          Notifies Supervisor (in-app + email + SMS)
          Notifies EHS Manager (in-app + email + SMS)
          OSHA 301 draft created in background
            │
            ▼
[Supervisor]  Sees red banner on Dashboard → opens incident
              Reviews + (optionally) overrides severity (audit-logged)
              Confirms triage → "Escalate to investigation"
            │
            ▼
[EHS Manager]  Sees the investigation in "Pending assignment" lane
               Drags to "In progress" → assigns self as lead
               Reads pre-filled incident summary
               Adds team members (optional)
               Builds 5-Why chain (keyboard-driven, §7.4)
               Attaches evidence (photos auto-tagged from incident, SDS auto-attached)
               Writes findings
               Clicks "Assign CAPA" → inline form pre-filled from findings
               Sets owner + verifier + due date → submit
            │
            ▼
[CAPA Owner]  Gets in-app notification + email
              Opens "My CAPAs" → sees the new item at the top
              Does the work
              Marks complete → uploads proof + one-sentence summary
            │
            ▼
[Verifier]  Gets notification (different person — DB-enforced)
            Opens "Pending verification" → side-by-side action vs. evidence
            Picks verdict → CAPA closes (or returns to owner)
            │
            ▼
[System]  CAPA closed → Investigation can close → Incident can close
          Each close is an independent event (§4.2)
          Auto-suggests "Create safety bulletin?" on Track A close (§6.4.3)
```

**Smoothness rules specific to Flow A.**
- **The Worker never sees the regulatory paperwork.** OSHA 301 is drafted by the system; the EHS manager reviews and signs. The worker is not asked to fill 18 fields.
- **No re-entry between roles.** Every field captured at one step is read-only at the next. If the EHS manager spots an error, the correction goes through `OverrideLog` with a reason, not a free edit.
- **The clock ticks visibly.** A countdown lives at the top of the incident page from classification onward — "OSHA 8-hour: 04:38:12 left", then "OSHA 301 due in 5 days", then "CAPA due in 12 days". One countdown at a time, the most-urgent one.
- **One activity timeline per incident.** Every action across roles writes to the same timeline. A new lead investigator sees the full history without three clicks.

#### 16.13.3 Flow B — the "light incident" happy path

The Track B flow looks like Flow A but with a smaller team and an optional CAPA step. The smoothness payoff is in **what is removed**, not what is added.

```
[Worker]  Submits report → System classifies S3 → Track B
[Supervisor]  Reviews the case → does a short RCA inline on the incident page
              Picks one of three outcomes:
                a) Close — no action (most paper-cut-equivalent cases)
                b) Open one CAPA inline (fix only, no full investigation)
                c) Escalate to Track A (rare — found something serious)
[CAPA Owner / Verifier]  Same as Flow A if a CAPA was opened
```

**Smoothness rule:** Track B does **not** force the supervisor through the full Investigation module. The triage modal on the incident detail page is sufficient (§6.3). Forcing every Track B through the Kanban is the most common reason supervisors stop using the system.

#### 16.13.4 Flow C — the "log and close" happy path

The shortest happy path in the system. Everything happens automatically.

```
[Worker]  Submits Observation or low-severity case → System classifies S4 / S5 → Track C
[System]  Logs the record. Auto-closes after submit confirmation.
          No notifications fire to anyone except the worker's confirmation screen.
[Supervisor]  Sees the row in their "Recent" tab next time they open the Dashboard.
              No action required.
```

**Smoothness rule:** Track C is **invisible** to anyone except the worker and the Reports module. No emails. No supervisor inbox row. If we make Track C noisy, supervisors will start ignoring all rows and miss Track A.

#### 16.13.5 Flow D — the "BBS observation" happy path

This flow is high-volume, low-detail (target: one card per worker per week, §15.5.9). Smoothness is everything.

```
[Worker]  Pulls phone → opens app → "Quick observation" tile on Dashboard
          One screen: 3 taps + 1 photo + 1 sentence + (optional) anonymous toggle
          Submit
[System]  Logs the observation, geo-tags it, classifies it, surfaces it on:
            - The site map view (§17.7)
            - The "BBS this week" Dashboard tile
            - If unsafe condition → optional one-click conversion to CAPA
[Supervisor]  Reviews the BBS feed once a week (cadence from §17.6)
              Converts unsafe items to CAPAs as needed
```

**Smoothness rule:** A BBS card must take **under 30 seconds** end-to-end on mobile. If it takes longer, workers will not hit the once-a-week target and the leading-indicator dashboard goes dark.

#### 16.13.6 Flow E — the "site setup → first report" cold-start

The end-to-end first-impression flow. If this is broken, everything else does not matter.

```
[Admin]  Receives invite email → clicks link → lands on the 7-step wizard (§16.3)
         Save & resume on every step → completes in < 30 minutes
         Lands on the setup-progress dashboard with a "well done" message
         Sends invites to first 5 workers
[Worker]  Receives invite → clicks link → first-time welcome (§16.4)
          Reads 4-card tour
          Lands on Dashboard with empty-state message
          Files first real or sandbox report → Confirmation screen
[System]  First-report event logged. Time-to-first-report metric written.
```

**Smoothness rule:** The admin must never need to write a config file, ask support, or read a 30-page manual to reach the first invited worker. The 7-step wizard is the contract.

#### 16.13.7 Cross-role handoff matrix

Every handoff between roles is a moment where smoothness either survives or dies. This matrix lists every handoff in the system and the **specific smoothness contract** for each.

| Handoff | Trigger | Carries (read-only at next step) | Smoothness contract |
|---|---|---|---|
| Worker → Supervisor | Incident submit (Track A or B) | All Step 1–3 fields, attachments, computed severity | Supervisor sees a one-page summary, no re-entry, one-click escalate / close |
| Supervisor → EHS Manager | Escalate to investigation (Track A) | Same as above + supervisor's triage notes | EHS manager opens straight into Investigation Detail, lead defaulted to self |
| EHS Manager → CAPA Owner | Assign CAPA | CAPA title, description, source investigation, due date | Owner gets one notification with a deep link to the CAPA card; no second login needed |
| CAPA Owner → Verifier | Mark complete | Owner's evidence + summary sentence | Verifier sees side-by-side action vs. evidence; cannot accidentally mis-verify |
| Verifier → CAPA close | Verdict = Effective | Verification reason, evidence reviewed | CAPA closes, investigation can close, incident can close — all separate events |
| Investigation close → Safety Bulletin | Track A close | Findings narrative, source incident | One-click bulletin draft pre-filled from findings (§6.4.3) |
| BBS observation → CAPA | Unsafe condition flagged | Photo, location, observer | One-click conversion; CAPA carries the photo + location |
| Permit gas-test expiry → permit suspend | Re-test interval missed | Permit ID, last sample time | Permit auto-suspends; permit holder gets push + SMS |

**Universal smoothness contracts that apply to every handoff above:**
1. **No re-entry of data captured upstream.** If upstream entered it, downstream sees it. Edits go through the audit trail, not silent overwrite.
2. **One-click deep link.** Every notification (in-app, email, SMS) carries a deep link to the exact record needing action. No navigating from a bare app shell.
3. **Read-only context, write-only delta.** The downstream role sees full upstream context as read-only, and only their delta is editable. This is the source of the no-re-entry rule.
4. **Activity-timeline single source of truth.** Every handoff is an entry in the shared, append-only activity log. Anyone can reconstruct the full case history without asking around.
5. **Time zone is site-local.** All deadlines, reminders, and quiet hours respect `Site.timezone` (§11.2).

#### 16.13.8 Smoothness measurement (what to log from day 1)

These events feed the analytics module (§16.11). Logged from day 1.

| Event | Why it tells us about smoothness |
|---|---|
| `report_wizard_started` / `report_wizard_submitted` | Drop-off rate per step = which step is friction |
| `report_wizard_step_duration` | Steps that take > 90 seconds need simplification |
| `incident_to_classification_seconds` | Should be ≤ 1 second; latency here is the worst friction |
| `classification_to_first_supervisor_view_seconds` | How fast does the supervisor actually see the case? |
| `investigation_pending_to_in_progress_hours` | A long lag = supervisors do not know it is theirs |
| `capa_owner_to_complete_days` | Median should be well under the due-date window |
| `capa_complete_to_verified_days` | If high, verifier pool is too small (§19 item 9) |
| `notification_clickthrough_rate` | Per channel and per severity. Low click = ignored alert |
| `quiet_hours_overrides_per_user` | Many overrides = quiet hours are wrongly set |

**Single rule for every metric above:** if the number trends the wrong way, we change the product, not the user.

---

## 17. Industry Best-Practice Notes (May 2026 research)

These notes add current outside practice to the PRD. They guide the build but they do not change the spec.

### 17.1 ISO 45001 alignment
ISO 45001 is the international standard for workplace health and safety. It needs a written process for incident reporting and investigation that:
- Captures injuries, illnesses, AND near-misses.
- Finds root causes, contributing factors, and related hazards.
- Uses the data to improve EHS performance.

Our three-module pipeline (Incidents → Investigation → CAPA) maps to clauses 10.1 and 10.2 of ISO 45001. The Reports layer covers clauses 9.1 to 9.3.

### 17.2 OSHA ITA 2026 deadlines (verified)
- 300A annual summary: posted **Feb 1 – Apr 30, 2026**. Submitted by **March 2, 2026** for calendar-year 2025 data.
- 250+ employees → 300A required.
- 20–249 employees in Appendix A industries → 300A required.
- 100+ employees in Appendix B industries → 300 + 301 case detail required (started reporting year 2024).
- Submission methods: web form, CSV upload, or API.
- PDFs cannot be submitted. ITA validates the CSV format strictly.

### 17.3 Notes on RCA methods
- **5-Why** is required by the PRD. It is good for first-aid and minor cases. But it is "too simple" for complex events. It tends to find only one cause chain.
- **Fishbone (Ishikawa)** is more thorough. The Forms PDF (Chapter 8) already defines a 6-category Fishbone (People / Process / Equipment / Materials / Environment / Management). We add it as a togglable second view alongside 5-Why. Both methods are in scope.
- **TapRoot®** needs a paid license. It is the industry standard for deaths and high-potential events. Out of scope for v1. But the design should not block it (an `rca_method` field on `Investigation` exists for this reason).
- Suggested escalation: first-aid → 5-Why; lost-time → Fishbone; death or high-potential → full Fault Tree or TapRoot®.

### 17.4 CAPA effectiveness check
In industry, the most-skipped step is the **effectiveness check** — and it is the most common audit finding. Our protections:
- A required "Too early to verify — re-verify on YYYY-MM-DD" option closes the verification step without marking a CAPA effective too early.
- Verification methods to support: follow-up inspection, repeat monitoring, audit-trend review, re-interview of affected workers, document review.
- The audit log must show evidence files plus the verifier's signature timestamp.

### 17.5 Risk-matrix conventions
- A 5 × 5 grid with Likelihood (Rare → Almost Certain) and Severity (Insignificant → Catastrophic) is the most common form. It matches IOSH and SafetyCulture.
- Risk score = Likelihood × Severity, grouped into 5 bands: Negligible (1–2), Low (3–6), Moderate (7–12), High (13–20), Very High (21–25). The PRD uses 4 cell labels (Low / Medium / High / Critical) — slightly simpler. Keep the PRD bands. Document the score-to-band mapping for the future.

### 17.6 Leading vs. lagging indicators
We balance lagging indicators (TRIR, DART) with leading indicators on the same dashboard. Both sets are in scope:
- Near-miss reporting rate (per 100 FTE).
- Observation rate.
- Inspection completion rate.
- Training completion rate.
- CAPA cycle time (average days from creation to verified close).
- Open hazards count by site.
- **Stop-the-Job rate** (events per month) — a healthy site has a non-zero number. See §15.5.9.
- **Permit-to-work close-out rate** — what fraction of permits are closed correctly at the end of the work window.
- **Toolbox talk attendance rate** — average attendance per scheduled talk, per crew.
- **Hazard closure rate and time-to-close** — from BBS / observation through to verified CAPA closure (SmartQHSE pattern).

**Review cadence (SmartQHSE-confirmed pattern).** Leading indicators should be reviewed **weekly at the operational level** (supervisor with crew) and **monthly at the management level** (EHS manager / site GM). The Dashboard supports this with two views: a "this week" snapshot for operations and a "rolling 30 days" view for management. Without a cadence, leading indicators become dashboard wallpaper.

The dashboard already has the chart and card skeleton. We can add these without rework.

### 17.7 Mobile and field use
The PRD scopes v1 to responsive web. Worth knowing: ISO 45001-aligned EHS systems all converge on **mobile-first capture** with photo upload, voice-to-text, and offline drafts. The wizard already has voice-to-text and drag-and-drop attach. The responsive web layout should keep these features working end to end.

**Patterns from 2026 tools (SmartQHSE and similar):**
- **QR-code sign-off.** Toolbox talks (§15.5.8) and permits-to-work (§15.5.5) print a QR code. Workers scan it from their phone to sign attendance or permit acknowledgement. No paper sheets, instant audit trail.
- **GPS / geo-tagging + map clustering.** Inspections (§15.5.4), BBS observations (§15.5.9), and near-miss reports save the worker's location with the report. Useful for large sites where "Bay 3" is ambiguous and for confirming the worker was actually present. We add a **map view of the site** that shows where observations and near-misses cluster, so high-frequency hazard zones jump out without anyone running a report — the difference between "we have data" and "we know where to act." Map view is in scope; it lands in Phase 13 of §18 alongside the command-post screen.
- **Offline-first forms.** A worker on a refinery roof or in a basement loading dock often has no signal. The form should work fully offline (capture data, photos, voice notes, GPS) and sync on reconnect. Conflict resolution rule: server-wins for status fields, client-wins for narrative content.
- **Photo-first capture.** On mobile, the camera is the primary input. The Report Wizard should open the camera before any keyboard input.

All four patterns are in scope. The responsive web build delivers QR sign-off, GPS tagging, and photo-first capture from day 1. True offline-first form caching is a later phase (see §18) but the data model and API support it from day 1: every entity has a stable UUID and accepts a `client_uuid` field for offline sync.

### 17.8 AI assistance
Tools like SmartQHSE (their "ARIA" assistant) and most 2026 EHS platforms now use AI for content generation. SmartQHSE markets a catalog of roughly **14 ARIA generators** covering: risk assessments, method statements, HSE plans, JSAs, toolbox talks, HIRA, HAZOP, root-cause analysis, CAPA drafts, audit findings summary, training content, and regulatory guidance lookups across 50+ countries. ARIA also offers a chat assistant ("real-time HSE guidance") for "what does the regulator say about X?" queries.

**AI is a deliberate non-goal**, listed in §2.2, aligned with our anti-bloat commitment in §2.4.3 ("we do not sell AI hype"). This is not a deferred feature — it is a product decision. Competitors compete on AI; we compete on filing forms correctly.

We document AI here only so the data model is not painted into a corner if the position ever changes. Three rules keep the door open without forcing AI work:
1. Every text field that a human writes (toolbox-talk body, JSA hazards, investigation findings) is stored as plain markdown, not as a vendor-specific format. AI generation, if ever added, is text-in / text-out.
2. The `ActivityLog` records *who* wrote each piece of text. If AI authoring is ever added, the log gains an `actor_kind` field (human / ai_assisted) — additive, not breaking.
3. Any AI feature, if ever added, must be **assistive, not authoritative**. AI never closes a CAPA, never sets severity, never submits to OSHA / HSE on its own. The human signs.

**Permanently out of scope** (these are red lines, not roadmap items): AI that auto-classifies severity, AI that auto-routes (Track A / B / C), AI that closes CAPAs, AI that generates regulatory submissions. These are load-bearing decisions that require a named human signature. They will not be automated.

---

## 18. Implementation Roadmap (phased)

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

### Phase 7 — Document Control (Weeks 20–22)
- `Document`, `DocumentVersion`, `DocumentAcknowledgement`, `DocumentApproval` entities.
- Version history, draft → review → approved → published → retired lifecycle.
- Approval workflow + electronic signatures.
- Forced-acknowledgement workflow on SOP version change.
- SDS-Manager library integration (auto-attach to incidents).

### Phase 8 — Training and Audit (Weeks 23–25)
- `TrainingCourse`, `TrainingAssignment` entities. Training matrix view (role × course).
- Certification expiry alerts on Dashboard.
- Auto-trigger on new SOP version (links to Phase 7).
- `Audit`, `AuditChecklist`, `AuditFinding` entities. Audit scheduler, checklist runner, finding → CAPA pipeline.

### Phase 9 — MOC, Permit, Inspection (Weeks 26–29)
- `Change` entity + Management of Change workflow.
- `Permit` + `PermitGasTest` + `PermitIsolation` entities. 15 permit types, multi-signatory, SIMOPS conflict detection, live permit register.
- `InspectionTemplate`, `Inspection`, `InspectionFinding` entities. Mobile checklist, GPS tagging, photo-on-each-item.

### Phase 10 — Risk Register, Supplier, Contractor (Weeks 30–32)
- `RiskRegister` entity + per-site master hazard list with review-date alerts.
- `Contractor`, `ContractorInduction` entities. Pre-qualification, PPE check on entry, expiry alerts.
- Leading-indicator dashboard tile fed by RiskRegister.

### Phase 11 — Toolbox Talks, BBS, JSA (Weeks 33–35)
- `ToolboxTalk` + `ToolboxTalkAttendance` entities. QR-code sign-off, multilingual content (EN / AR / HI / UR / Tagalog).
- `BBSObservation` entity. 6-class taxonomy (safe_act / unsafe_act / unsafe_condition / near_miss / environmental / stop_work). Anonymous mode. GPS map clusters. Stop-the-Job dashboard tile.
- `JSA` entity. Pre-work risk assessment, links into `Permit` as a prerequisite.

### Phase 12 — Safety Bulletins (Weeks 36–37)
- `SafetyBulletin` + `SafetyBulletinAcknowledgement` entities.
- Auto-suggest a bulletin when a Track A investigation closes.
- Audience picker (sites + roles), forced acknowledgement, manager dashboard tile for ack rate.

### Phase 13 — Emergency Management and Environmental (Weeks 38–40)
- `EmergencyResponsePlan`, `MusterPoint`, `EmergencyDrill`, `EmergencyContact` entities. Active-incident command-post screen.
- `WasteStream`, `WasteManifest`, `EmissionPermit`, `EmissionLog` entities. ISO 14001 mapping.

### Phase 14 — Onboarding and Help Center (Weeks 41–42)
- 7-step site setup wizard (save & resume).
- Worker welcome card + 4-card quick tour.
- Sandbox / practice mode (`Incident.is_sandbox`).
- Sample dataset loader. What's new cards (`WhatsNew`, `WhatsNewSeen`).
- Side-panel help center.
- Onboarding analytics (drop-off, time-to-first-report).

### Phase 15 — Hardening (Weeks 43–45)
- Accessibility (WCAG 2.2 AA), performance, retention / archival, regression suite.
- Quarterly restore drill from backup.
- Run a real submission cycle in a staging tenant before the next ITA window.
- Multi-language onboarding rollout.

**Total timeline: about 45 weeks (~10 months) for the full scope.** This is the honest number for shipping every module in §15. Phases 1–6 (Weeks 3–19) deliver the EHS Incident Management core. Phases 7–13 deliver the surrounding QMS and EHS modules. Phases 14–15 deliver onboarding polish and audit hardening.

---

## 19. Risks and Open Questions

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

## 20. SmartQHSE Feature-Gap Analysis (May 2026 walkthrough)

> **Why this section exists.** SmartQHSE markets itself as the #1 AI-powered HSE platform for 2026 (120+ modules, 14 AI generators, 50+ country regulator coverage). It is the most direct comparator for our build, and several customers will evaluate us alongside it. This section lists what we saw in the SmartQHSE platform (per their published feature pages — the dashboard at `app.smartqhse.com/platform/dashboard` is their gated tenant view), maps each item to **our build plan**, and calls out the **gaps we close** vs. the **gaps we deliberately leave open**.
>
> The table is the single source of truth for "what SmartQHSE does that we have not planned." If a row is in scope, it must be referenced from the relevant module section. If a row is out of scope, the reason must be in §2.4.6 (Anti-features).

### 20.1 Mapping table — SmartQHSE features → our plan

The "Phase" column is the delivery phase from §18 (the roadmap). All in-scope rows are in build plan. "Out of scope" rows are deliberate non-goals listed in §2.2 / §2.4.6 / §15.5.13.

| # | SmartQHSE feature (observed) | Our equivalent | Phase | Section |
|---|---|---|---|---|
| 1 | **Incident, near-miss, unsafe-act, unsafe-condition capture from any device** | 8 incident types + 3-step Report Wizard, responsive web | Phase 1 | §6 |
| 2 | **OSHA 300 / 300A auto-population** | OSHA 300 Log live preview, 300A annual generator | Phase 5 | §9 |
| 3 | **Three-track auto-routing** (full / light / log-and-close) | Three-track routing engine | Phase 2 | §5 |
| 4 | **5×5 risk matrix** | 5×5 matrix + override audit | Phase 1 | §10 |
| 5 | **Independent CAPA verification** | `owner ≠ verifier` enforced at DB level | Phase 4 | §8.3, §12.5 |
| 6 | **Document Control with version history** | Document module with version + approval + forced acknowledgement | Phase 7 | §15.4 |
| 7 | **Training records linked to documents** | Training module + auto-trigger on SOP version change | Phase 8 | §15.5.3, §15.4 |
| 8 | **Toolbox Talks with template library and QR-code attendance** | ToolboxTalk + ToolboxTalkAttendance with QR sign-off | Phase 11 | §15.5.8 |
| 9 | **Multi-language toolbox talks (EN / AR / HI / UR / Tagalog)** | Markdown-first body + Unicode-clean DB; UI language switcher in Phase 14 | Phase 11 (data) → Phase 14 (UI) | §15.5.8, §16.10 |
| 10 | **Permit-to-Work (15+ permit types) with multi-signatory and SIMOPS detection** | Permit module with type catalog, multi-sig, SIMOPS | Phase 9 | §15.5.5 |
| 11 | **Permit gas-test records and isolation (LOTO) certificates** | `PermitGasTest` and `PermitIsolation` entities | Phase 9 | §15.5.5, §12.2.10 |
| 12 | **Live permit register / map view** | "Active permits" dashboard tile + command-post screen | Phase 9 (register) → Phase 13 (command-post) | §15.5.5, §15.5.11 |
| 13 | **JSA / HIRA pre-work risk assessment** | JSA module with shared 5×5 matrix | Phase 11 | §15.5.10 |
| 14 | **BBS / Behavior-Based Safety with 5-class taxonomy** | `BBSObservation` with 6-class taxonomy (incl. `stop_work`) | Phase 11 | §15.5.9 |
| 15 | **Anonymous BBS reporting** | `is_anonymous` flag on observations | Phase 11 | §15.5.9 |
| 16 | **GPS-tagged near-miss / observation with site-map clustering** | `gps_lat` / `gps_lng` on observations + map view | Phase 11 (data) → Phase 13 (map view) | §15.5.9, §17.7 |
| 17 | **Audit management** | Audit + AuditChecklist + AuditFinding modules | Phase 8 | §15.5.1 |
| 18 | **Inspection management** | InspectionTemplate + Inspection + InspectionFinding modules | Phase 9 | §15.5.4 |
| 19 | **Risk register** | RiskRegister entity feeding leading indicators | Phase 10 | §15.5.6 |
| 20 | **Contractor / supplier pre-qualification** | Contractor + ContractorInduction modules | Phase 10 | §15.5.7 |
| 21 | **Change Control / MOC** | Change entity with safety risk-assessment workflow | Phase 9 | §15.5.2 |
| 22 | **Emergency response plans, muster points, drill scheduling, contact directory** | Emergency Management module | Phase 13 | §15.5.11 |
| 23 | **Waste management, emissions monitoring, EIA, ISO 14001** | Environmental Compliance module | Phase 13 | §15.5.12 |
| 24 | **KPI dashboard auto-populating leading + lagging indicators** | TRIR / DART in Phase 5; broader leading-indicator set in Phase 11 | Phase 5 → Phase 11 | §9.5, §17.6 |
| 25 | **Real-time compliance dashboards (no spreadsheet consolidation)** | Dashboard is a live projection of incident data | Phase 1+ | Foundational Concepts, §9 |
| 26 | **Stop-the-Job authority with logging** | `stop_work` BBS classification + dashboard tile | Phase 11 | §15.5.9 |
| 27 | **Action tracking with deadlines, owners, escalation alerts** | CAPA module with overdue handling | Phase 4 | §8.5 |
| 28 | **Safety bulletins / lessons-learned distribution** | SafetyBulletin + SafetyBulletinAcknowledgement modules | Phase 12 | §6.4.3, §12.2.16 |
| 29 | **ARIA AI assistant — generates risk assessments, method statements, HSE plans, JSAs, toolbox talks, RCA drafts, regulatory chat** | Permanent non-goal — competitors compete on AI, we compete on filing forms correctly | Out of scope | §2.2, §2.4.3, §17.8 |
| 30 | **Non-conformance, supplier audit, calibration, customer complaints (Quality)** | Permanent non-goal — project is EHS, not full QHSE | Out of scope | §2.2, §15.5.13 |
| 31 | **50+ country regulator coverage (GCC, UK, US, India, EU)** | OSHA + HSE / RIDDOR are in scope; routing engine is table-driven via `Site.regulator` so adding a new regulator is config, not code | In scope (scope-limited to OSHA + HSE) | §2.3, §5 |
| 32 | **Multi-language UI (EN / AR / HI / UR / Tagalog)** | Worker-content multi-language is in scope; UI chrome English-only | In scope (worker content) / Out of scope (UI chrome) | §2.2, §15.5.8, §16.10 |
| 33 | **Native mobile app (iOS / Android)** | Permanent non-goal — responsive web only. Native would be a separate platform team. | Out of scope | §2.2, §17.7 |

### 20.2 Where we will *not* match SmartQHSE — and why

The §2.4.3 anti-bloat commitments mean some SmartQHSE features are deliberately out of scope for us. Those are not "missing features" — they are "decisions."

| What we say no to | Why | Where it is recorded |
|---|---|---|
| **AI chatbot answering safety questions** | Liability on hallucinated regulatory rules. Tooltips + Document Control cover the safe path. | §2.4.6 |
| **120-module mega-suite** | Adjacent modules (Quality, calibration, customer complaints) are a different product. We focus on Incident → Investigation → CAPA → Reports. | §2.4.3, §15.5.13 |
| **Gamification on safety reporting** | Incentivizes trivial reports, suppresses serious ones. | §2.4.6 |
| **Free-text severity** | Breaks ITA submission. 5×5 matrix is the standard. | §2.4.6 |
| **AI auto-classifying severity, auto-routing tracks, or auto-closing CAPAs** | Load-bearing decisions need a named human signature. AI is assistive only. | §17.8 |

### 20.3 Where we have something SmartQHSE does not (our differentiators)

These are the §2.4.2 differentiators restated in the SmartQHSE-comparison context. **Every salesperson and engineer must be able to recite this list.**

1. **SDS-native.** SDS auto-attaches to chemical incidents and to the investigation. SmartQHSE is *adjacent* to SDS data; we sit *on* it.
2. **Regulatory clock starts at classification, not at workflow end.** Most competitors fire alerts on workflow completion. We architecturally cannot.
3. **`CAPA.owner ≠ CAPA.verifier` is a Postgres `CHECK` constraint.** Most competitors enforce this only in the screen layer.
4. **Three-track routing prevents alert fatigue.** Track C auto-closes paper cuts. Sites that route every incident through the same heavy workflow train workers to ignore notifications.
5. **Self-hosted Postgres.** Standard schema, no proprietary file format, no cloud lock-in. SmartQHSE is cloud-only.

### 20.4 Backlog opened by this comparison (concrete tickets)

These are the items that this comparison surfaced *and* that did not already have a home in the planning document. Each one needs a ticket in the backlog before Phase 5 ends.

1. **Site map view for observations and near-misses** — needs a base-map vendor decision (OpenStreetMap vs. Mapbox vs. site-supplied floor plan).
2. **Permit gas-test data model + re-test enforcement** — service-layer scheduler tied to `PermitGasTest.sampled_at`.
3. **Permit isolation register with applied / removed lifecycle** — query: "show all open isolations across all sites."
4. **Active-incident command-post screen** — composite view that pulls from `Permit`, `MusterPoint`, `EmergencyResponsePlan`, and the active `Incident`.
5. **Stop-the-Job dashboard tile** — count and trend of `BBSObservation.classification = stop_work`.
6. **Investigation → toolbox-talk one-click create** — pre-fills body from investigation findings.
7. **Multi-language toolbox-talk body field** — `body` and `title` accept Unicode from Phase 11; UI language switcher in Phase 14.
8. **Leading-indicator weekly / monthly dashboard split** — two views feeding the cadence rule from §17.6.
9. **Hazard-closure-rate KPI** — derived from BBS / observation → CAPA verified-close pipeline.
10. **Emergency-contact dashboard banner during active S1 / S2** — small, but high signal during a real event.

---

## 21. Glossary

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

## 22. References and Sources

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

**SmartQHSE competitive R&D (added in §2.3, §15.4, §15.5.5, §15.5.3, §15.5.8, §15.5.9, §15.5.10, §15.5.11, §15.5.12, §15.5.13, §17.6, §17.7, §17.8, §20)**
- [SmartQHSE — homepage](https://www.smartqhse.com/)
- [HSE Software 2026 — #1 AI-Powered HSE Management Platform](https://www.smartqhse.com/hse-software)
- [Best EHS Software 2026 — SmartQHSE](https://www.smartqhse.com/ehs-software)
- [HSE Management Software — Complete Digital Safety Platform](https://www.smartqhse.com/hse-management-software)
- [QHSE Software Comparison 2026 — SmartQHSE blog](https://www.smartqhse.com/safety-blog/qhse-software-comparison-2026)
- [SmartQHSE vs VelocityEHS](https://www.smartqhse.com/vs/velocityehs)
- [Safety Management Software USA 2026](https://www.smartqhse.com/safety-management-software-usa)
- [Workplace Safety Software USA — SmartQHSE](https://www.smartqhse.com/workplace-safety-software-usa)
- [Workplace Safety Software — SmartQHSE](https://www.smartqhse.com/workplace-safety-software)
- [Best EHS Software in the USA 2026 — Buyer's Guide](https://www.smartqhse.com/safety-blog/ehs-software-comparison-usa)
- [Best HSE Software for US Manufacturing 2026](https://www.smartqhse.com/safety-blog/best-hse-software-us-manufacturing-2026)
- [Construction Safety Software USA 2026](https://www.smartqhse.com/construction-safety-software-usa)
- [10 Best EHS Software in 2026 — Reviewed & Compared](https://www.smartqhse.com/safety-blog/best-ehs-software-2026)
- [10 Best Health and Safety Software in 2026](https://www.smartqhse.com/safety-blog/best-health-and-safety-software-2026)
- [Safety Inspection Software — SmartQHSE](https://www.smartqhse.com/safety-inspection-software)
- [HSE Inspection Software — Digital Safety Inspections & Audits](https://www.smartqhse.com/hse-inspection-software)
- [Audit Management Software 2026](https://www.smartqhse.com/audit-management-software)
- [ISO 45001 Compliance Software](https://www.smartqhse.com/compliance/iso-45001-software)
- [Behaviour-Based Safety (BBS) — SmartQHSE](https://www.smartqhse.com/features/behaviour-based-safety)
- [Safety Observation Software — Behaviour-Based Safety](https://www.smartqhse.com/safety-observation-software)
- [Safety Observation Software — Behavioural Safety Cards](https://www.smartqhse.com/features/observations)
- [Safety Observation Programs — How to build a system that works](https://www.smartqhse.com/safety-blog/safety-observation-program)
- [What Is a Safety Observation? — Leading Indicator Guide](https://www.smartqhse.com/what-is/safety-observation)
- [Near Miss Reporting Software — SmartQHSE](https://www.smartqhse.com/near-miss-reporting-software)
- [Near Miss vs Incident — Reporting Differences](https://www.smartqhse.com/safety-blog/near-miss-vs-incident-difference)
- [20 Near Miss Examples (2026)](https://www.smartqhse.com/safety-blog/near-miss-examples)
- [Permit-to-Work Software — SmartQHSE](https://www.smartqhse.com/permit-to-work-software)
- [Toolbox Talk Software — SmartQHSE](https://www.smartqhse.com/toolbox-talk-software)
- [Digital Toolbox Talk Software — AI-Generated Briefings](https://www.smartqhse.com/features/toolbox-talks)
- [How to Write and Deliver a Toolbox Talk — Complete Guide](https://www.smartqhse.com/safety-blog/how-to-write-toolbox-talk)
- [Document Control Software — SmartQHSE](https://www.smartqhse.com/document-control-software)
- [Contractor Management Software — SmartQHSE](https://www.smartqhse.com/contractor-management-software)
- [HSE Software for Contractors — Prequalification to Close-Out](https://www.smartqhse.com/for/contractors)
- [Free Job Hazard Analysis Template (JHA / JSA)](https://www.smartqhse.com/job-hazard-analysis-template)
- [Job Safety Analysis (JSA) — Step-by-Step Guide](https://www.smartqhse.com/safety-blog/job-safety-analysis-guide)
- [What Is HIRA? Hazard Identification and Risk Assessment Explained](https://www.smartqhse.com/what-is/hira-risk-assessment)
- [AI HSE Assistant Guide 2026 — SmartQHSE blog](https://www.smartqhse.com/safety-blog/ai-hse-assistant-guide-2026)
- [Leading vs Lagging Indicators in HSE — KPI Framework](https://www.smartqhse.com/safety-blog/leading-vs-lagging-indicators)
- [How to Measure Safety Performance — KPIs & Metrics Guide](https://www.smartqhse.com/safety-blog/how-to-measure-safety-performance)
- [Safety Performance KPIs — HSE Metrics Guide](https://www.smartqhse.com/what-is/safety-performance-kpis)
- [Proactive vs Reactive Safety — Why Leading Indicators Matter](https://www.smartqhse.com/safety-blog/proactive-vs-reactive-safety)
- [Safety Management System — Digital SMS Platform](https://www.smartqhse.com/safety-management-system)
- [Utilities HSE Software — Water, Gas & Power Safety](https://www.smartqhse.com/hse-software/utilities)
