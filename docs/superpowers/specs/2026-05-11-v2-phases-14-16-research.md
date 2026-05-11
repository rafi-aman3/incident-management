# V2 Phases 14–16 — Competitor & Standards Research

> **Date:** 2026-05-11
> **Author:** Brainstorming pass — informs `plans/14-hazard-register.md`, `plans/15-jsa.md`, `plans/16-sds-manager-stub.md`
> **Scope:** Validate the three adopted v2 SPEC sections (§HZ, §JSA, §SDS-INTEGRATION) against competitor patterns and source-language standards. Identify must-add, nice-to-have, and intentional-skip features before the implementation plans are written.

---

## Executive summary

The three adopted specs (§HZ Hazard Register, §JSA Job Safety Analysis, §SDS-INTEGRATION SDS Manager stub) are **research-validated** — the core data models, lifecycle states, hierarchy of controls, and shared 5×5 matrix all align with ISO 45001 §6.1.2, OSHA 3071, HSE INDG163, OSHA HazCom 2012/2024, and the dominant patterns in Cority / Intelex / VelocityEHS / EcoOnline. No structural redesign is needed.

Research surfaced **eight concrete spec deltas worth landing alongside the implementation plans** (none are showstoppers; most are 1-table-column or 1-event additions):

| # | Module | Delta | Severity |
|---|---|---|---|
| 1 | §HZ | Add `hazard_controls.next_control_review_at date` + populate "Overdue reviews" KPI tile from both assessment cadence AND control-check cadence | 🔧 Should add |
| 2 | §HZ | Risk-owner auto-notification when an incident is linked to a hazard via `incident_hazard_links` | 🔧 Should add |
| 3 | §HZ | New Argus magic-wand surface `suggest_hazard_controls` on `convertCandidate` form | 🔧 Should add |
| 4 | §JSA | Clarify 12-month expiry is **policy default**, not standards-mandated. Neither OSHA 3071 nor HSE INDG163 mandates a fixed period | 🔧 Should add |
| 5 | §JSA | Add event-triggered re-review: linking an incident to a JSA flips its status from `approved` → `under_review` | 🔧 Should add |
| 6 | §JSA | Explicit non-goal: permit-to-work execution is v2+ scope (all 4 competitors sell a separate PTW module) | 🔧 Should add |
| 7 | §JSA | Mobile photo evidence per step / per step-hazard via the existing polymorphic `documents` table (`linked_to='jsa_step'` / `'jsa_step_hazard'`) | 🔧 Should add |
| 8 | §SDS | Pass GHS pictograms through into `proposed_metadata` so the candidate review queue can render them | 🔧 Should add |

Three **deferred-to-future** recommendations also surface and are noted but **NOT folded into v2**:

- 🤔 Bowtie visualization (VelocityEHS / Cority+Salus differentiator) — v3 candidate
- 🤔 Field-Level Risk Assessment / FLRA layer atop JSA (EcoOnline pattern) — v2.1 candidate
- 🤔 Parallel residual-risk modelling (Intelex differentiator) — v2.1 candidate

**Sequencing:** §HZ → §JSA → §SDS is correct and mechanically required (both §JSA and §SDS write into §HZ tables). §SDS is plausibly small enough (~300-500 LOC, zero migrations) to land in the **same PR** as §HZ; §JSA stays a separate phase because of its distinct supervisor/worker-facing surface and RBAC story.

---

## §HZ Hazard Register

### HZ.R1 Standards baseline — ISO 45001 §6.1.2

Direct "shall" requirements extracted from clauses **6.1.2.1** (hazard identification), **6.1.2.2** (assessment of OH&S risks), and **8.1.2** (hierarchy of controls):

- The organization **shall** "establish, implement and maintain a process(es) for hazard identification that is **ongoing and proactive**." ([blog.auditortrainingonline.com 6.1.2.1](https://blog.auditortrainingonline.com/blog/understanding-iso-45001-clause-6.1.2.1-hazard-id))
- The process **shall** take into account (but is not limited to) eight inputs: organizational / social factors (workload, hours, bullying), leadership and culture; routine **and** non-routine activities; past incidents; emergency situations; people in and around the workplace; workplace design / conditions; organizational changes; and evolving hazard knowledge. ([preteshbiswas.com 6.1.2](https://preteshbiswas.com/2023/09/23/iso-450012018-clause-6-1-2-hazard-identification-and-assessment-of-risks-and-opportunities/))
- The organization **shall** "assess OH&S risks from the identified hazards, **while taking into account the effectiveness of existing controls**." ([6.1.2.2](https://blog.auditortrainingonline.com/blog/understanding-iso-45001-clause-6.1.2.2-assessment-of-ohs-risks))
- Methodology and criteria **shall** be defined "to ensure they are **proactive rather than reactive** and are used in a systematic way." ([6.1.2.2](https://blog.auditortrainingonline.com/blog/understanding-iso-45001-clause-6.1.2.2-assessment-of-ohs-risks))
- Documented information for methodology and criteria **shall be maintained and retained**.
- Hazard ID must include **consultation and participation of workers** — a separately auditable hook (Clause 5.4).
- Clause **8.1.2** mandates the five-level **hierarchy of controls applied in order of effectiveness**: elimination → substitution → engineering → administrative → PPE. ([8.1.2](https://blog.auditortrainingonline.com/blog/iso-45001-clause-8-1-2))

### HZ.R2 Competitor matrix

| Capability | Cority | Intelex | VelocityEHS | EcoOnline |
|---|---|---|---|---|
| **Lifecycle / workflow states** | "centralizes hazards, controls, tasks and mitigations in one risk record"; specific state names **unverified** ([Cority Risk SW](https://www.cority.com/corityone/risk-management-software/)) | "identifies, analyzes and manages" + risk-owner notifications + scheduled control checks ([Intelex ERR](https://www.intelex.com/products/applications/enterprise-risk-register-software/)) | Worksheet-driven; states **unverified** | Implicit periodic-review cycle; explicit state list **unverified** ([EcoOnline Hazard](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/hazard-assessment-software/)) |
| **Identification methods** | JSA, FMEA, What-If, configurable | JSA, Process Hazard Analysis, Field-Level Hazard Assessment, observations, incidents — integrated since Q2 2025 ([Intelex Q2 2025](https://blog.intelex.com/2025/07/16/q2-product-launch/)) | HAZID, HAZOP, FMEA, JSA, bowtie + AI **Hazard Analyzer** | Job Hazard Analysis, Task-Based Risk Assessments, observations |
| **Risk matrix** | "validated risk assessment methods **or configure their own**" | Configurable scoring | Configurable worksheets; qualitative / semi-quantitative / quantitative | "Severity matrix" + "local and further controls" |
| **Controls model** | Centralized controls/tasks/mitigations per risk record; ISO hierarchy referenced in their content ([Cority blog](https://www.cority.com/blog/hierarchy-of-controls-chemical-hazards/)) | Define controls, assess + track, scheduled control checks | Bowtie barriers with key risk indicators per control | Two-tier ("local + further" controls) — likely not full 5-level |
| **Mobile capture** | Yes ([Cority](https://www.cority.com/corityone/risk-management-software/)) | Yes ([Intelex H&S RM](https://www.intelex.com/risk-management/health-and-safety-risk)) | **unverified** for risk module | Yes ([EcoOnline JHA](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/job-hazard-analysis-software/)) |
| **Incident integration** | "connects risk data to incidents…" | Q2 2025 Global Risk Management App = "instant access to incidents, observations, tasks, controls, and CAPAs" | Risk data linked to incidents for root-causing | Integrated with incident management |
| **KPIs / dashboards** | Trend analysis + mitigation ROI tracking | Configurable dashboards + advanced search | KPIs per bowtie control | "2-click dashboards", custom real-time KPIs |
| **Regulatory output** | Not specifically called out for risk register; **unverified** | **unverified** | **unverified** | "Audit-ready documentation"; specific forms **unverified** |
| **Distinctive feature** | Q1 2025 **visual modelling tools** + Salus Technical bowtie partnership (Feb 2025) ([Cority+Salus](https://www.globenewswire.com/news-release/2025/02/04/3020128/0/en/Cority-Partners-with-Salus-Technical-Bringing-Advanced-Bowtie-Risk-Analysis-to-CorityOne-Ecosystem.html)) | Q2 2025 **risk-owner auto-notifications** + scheduled control-effectiveness checks | **Bowtie analysis** + AI Hazard Analyzer + AI Control Recommendations | Strongly task-based (TBRA); chemical-safety SDS integration is a separate strength |

### HZ.R3 Convergent patterns (≥3 of 4 vendors)

- **Centralized risk register as single source of truth** — all 4 vendors
- **Explicit incident ↔ register linkage** — all 4 vendors
- **Trackable, assignable controls with effectiveness review** — Cority, Intelex, EcoOnline call this out explicitly
- **Mobile field hazard capture** — Cority, Intelex, EcoOnline confirmed; VelocityEHS unverified for this module specifically
- **Configurable risk methodology** rather than a fixed matrix — all 4

### HZ.R4 Divergent / differentiator features

- **Bowtie visual analysis** — VelocityEHS headline; Cority via Salus partnership (Feb 2025). Genuine differentiator.
- **AI Hazard Analyzer + AI Control Recommendations** — VelocityEHS only (publicly advertised). Direct fit for Argus.
- **Risk-owner auto-notifications + scheduled control-effectiveness checks** — Intelex Q2 2025 launch.
- **Local + further controls (two-tier)** — EcoOnline-specific wording; weaker than full 5-level hierarchy.
- **HAZID / HAZOP / FMEA native to the register** — VelocityEHS clear, Cority partial. Heavy process-industry; out of scope for our personas.

### HZ.R5 Gap analysis vs. our locked §HZ spec

| Finding | Verdict | Note |
|---|---|---|
| ISO 45001 "ongoing and proactive" identification | ✅ Already covered | 12 identification sources + `hazard_candidates` review queue + 8 reassessment triggers operationalize this |
| ISO 45001 "effectiveness of existing controls" in assessment | ✅ Already covered | `hazard_risk_assessments` is history-preserving with residual risk via `computeResidual()` against applied control level |
| ISO 45001 documented methodology maintained | ✅ Already covered | Shared `lib/risk/matrix.ts` + history-preserving assessment table = the documented methodology |
| ISO 45001 worker consultation | ✅ Already covered | `worker_consultation` is one of 8 reassessment triggers; `worker_report` is one of 12 identification sources; `consulted_worker_ids[]` on each assessment |
| ISO 45001 5-level hierarchy in order of effectiveness | ✅ Already covered | Spec locks elim/sub/eng/admin/PPE with reduction factors 4/3/2/1/1 |
| Centralized register as single source of truth | ✅ Already covered | `hazards` table is canonical |
| Incident ↔ register linkage | ✅ Already covered | `incident_hazard_links` with 3 link types is more granular than competitors advertise |
| **Scheduled control-effectiveness checks (Intelex Q2 2025)** | 🔧 **Should add to spec** | We have `monitoring` lifecycle state but no explicit "next control review due" date or notification. Add `hazard_controls.next_control_review_at date` + feed the "Overdue reviews" KPI tile from both assessment cadence AND control-check cadence. Auditor-defensible under ISO 6.1.2.2. |
| **Risk-owner auto-notification on linked-event change (Intelex)** | 🔧 **Should add to spec** | When an incident is linked to a hazard via `incident_hazard_links`, the assessment's `assessor_id` and the hazard's `identified_by` should be notified. Reuses the existing notification engine. Small spec delta. |
| **AI Hazard Analyzer / Control Recommendations (VelocityEHS)** | 🔧 **Should add to spec** | Direct fit for an Argus magic-wand surface. Add `suggest_hazard_controls` wand on the `convertCandidate` form to suggest controls per level from category + description. Zero new tables; reuses Phase 9d pattern + `argus_suggestions` table. Stays "assistive, never authoritative" — human commits. |
| Configurable risk methodology (all 4 vendors) | 🤔 Consider adding | We're locked to one shared 5×5 matrix. For v1 this is a feature (consistency with incident severity). Multi-industry / multi-methodology = defer to v2.5. |
| Bowtie visualization | 🤔 Consider adding (v3) | Powerful and ties to ISO 8.1.2 control effectiveness. Out of v2 scope. Read-only bowtie rendered from existing `hazard_controls` + `incident_hazard_links` is achievable later. |
| Structured methods: HAZID / HAZOP / FMEA | ❌ Intentionally skip | Heavy process-industry methods; over-scoped for our healthcare/education/warehouse/office personas. §JSA covers the activity-level case. |
| Worker consultation as a first-class entity (vs. trigger) | 🤔 Consider adding | ISO §5.4 is a separate audit hook. Could surface a "Consult workers" CTA on draft hazards. Low cost; defer to a polish PR. |
| Mobile field capture | ✅ Already covered | v1 surfaces are responsive; `worker_report` identification source is the inbound path |
| Local + further controls (EcoOnline) | ❌ Intentionally skip | Our 5-level hierarchy supersedes this two-tier abstraction |
| OSHA/HSE regulatory form output from register | ❌ Intentionally skip | None of the 4 competitors advertise this; register data feeds incident reports (OSHA 300 / RIDDOR F2508) which we already cover |

### HZ.R6 Sequencing implication

Phase 14 (§HZ first) is correct and reinforced by research:

- §JSA's `jsa_step_hazards` FKs into `hazard_candidates(id)` and `hazards(id)` — these must exist first.
- §SDS-INTEGRATION writes into `hazard_candidates` with `source_type='sds_import'` — confirmed dependency.
- Intelex's Q2 2025 release order (Global Risk Management → integrates with JSA + FLHA) externally validates the build order: register-first, then workflow modules consume it.
- The **shared 5×5 matrix refactor to `lib/risk/matrix.ts`** must land in the first §HZ commit. Both §JSA Step-3 hazard scoring and the existing incident severity engine consume it.

---

## §JSA Job Safety Analysis

### JSA.R1 Standards baseline — OSHA 3071 + HSE INDG163

#### OSHA 3071 "Job Hazard Analysis" (2002, still canonical as of 2026)

- **Definition (verbatim):** "A job hazard analysis is a technique that focuses on job tasks as a way to identify hazards before they occur. It focuses on the relationship between the worker, the task, the tools, and the work environment." ([OSHA 3071](https://obis.osha.gov/Publications/osha3071.html))
- **Hazard (verbatim):** "A hazard is the potential for harm. In practical terms, a hazard often is associated with a condition or activity that, if left uncontrolled, can result in an injury or illness."
- **Preparation steps:** (1) Involve employees; (2) Review accident history; (3) Conduct preliminary job review; (4) List, rank, and prioritize hazardous jobs; (5) Outline steps or tasks for analysis.
- **Worksheet columns:** Task Description · Hazard Type · Hazard Description · Consequence · Hazard Controls · Rationale.
- **Hierarchy of controls (verbatim):** "The order of precedence and effectiveness of hazard control is the following: 1. Engineering controls. 2. Administrative controls. 3. Personal protective equipment." — OSHA's text names **only 3 levels**, not the ANSI Z10 5-level (Elimination → Substitution → Engineering → Administrative → PPE). Our 5-level model exceeds OSHA's published minimum.
- **Review cadence:** "Periodically reviewing your job hazard analysis ensures that it remains current…" — OSHA does **NOT** specify a fixed period. Event triggers: near-miss, new process. ([SafetyPro Resources](https://www.safetyproresources.com/blog/how-to-audit-your-job-safety-analysis-jsa-program))
- **Employee involvement:** "It is very important to involve your employees in the hazard analysis process. They have a unique understanding of the job, and this knowledge is invaluable for finding hazards."

#### HSE INDG163 — 5 steps to risk assessment (UK equivalent)

- **Step 1 — Identify hazards** + involve employees + review accident records ([HSE](https://www.hse.gov.uk/simple-health-safety/risk/steps-needed-to-manage-risk.htm))
- **Step 2 — Assess the risks:** likelihood + severity + "who might be harmed and how"
- **Step 3 — Control the risks:** "Can I get rid of the hazard altogether? If not, how can I control the risks so that harm is unlikely?" — controls must be "reasonably practicable"
- **Step 4 — Record your findings:** mandatory for 5+ employees
- **Step 5 — Review the controls:** "You must review the controls you have put in place to make sure they are working." Trigger events: staffing/process/equipment/substance change, worker feedback, near-miss. **No fixed annual cadence prescribed.**

### JSA.R2 Competitor matrix

| Vendor | Wizard/layout | Steps reorder | Hazards per step | Controls model | Approval | Expiry/review | Worker sign-off | Mobile | Hazard register link | Permit-to-work | Distinctive |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cority** | Configurable worksheet inside Operational Risk (JHA, FMEA, What-If, bowtie) ([Cority blog](https://www.cority.com/blog/digital-risk-management/)) | **unverified** | Step-task → hazard mapping | Pre/post-control with risk reduction factors; bowtie barriers | Approval workflow with designated authorities; bowtie example uses **6-month approval cycle** | Driven by approval cycle; JSA cadence **unverified** | **unverified** | Yes (CorityOne) | Shared org-wide assessment library | Separate Permit to Work module | Bowtie via Salus Technical (Feb 2025); FMEA, What-If |
| **Intelex** | "most configurable JSA tool available for large organizations" ([Intelex JSA](https://www.intelex.com/products/applications/job-safety-analysis-software/)) | **unverified** | Job → steps → hazards → trigger events → consequences | Custom likelihood/severity scales; **parallel residual-risk modelling for multiple control options** ([Intelex demo](https://www.intelex.com/resources/product-demo/job-safety-analysis-software/)) | Approval pattern referenced; JSA-specific **unverified** | **unverified** | Single supervisor sign-off pattern per comparison ([BasinCheck](https://basincheck.com/resources/best-jsa-software)) | Yes | Centralised hazard/control library | Dedicated PTW module ([Intelex PTW](https://www.intelex.com/products/applications/permit-work-software/)) | Residual-risk comparison across control options |
| **VelocityEHS** | Configurable JSA template; multilingual; bulk import/export ([VelocityEHS JSA](https://www.ehs.com/solution/operational-risk/jsa/)) | **unverified** | Job-task breakdown attending to worker/tools/environment | **Library of base controls + risk-reduction factors; auto-calculated post-control risk scores** | Action assignment + auto-notifications; specific multi-step approval **unverified** | "Automatically flags missing qualifications, expired documents… prevents unsafe personnel from being approved" (Control of Work) | **unverified** | Yes — Accelerate Platform | Risk Analysis module: HAZID/HAZOP/FMEA/bowtie + "instantly link findings to your bowties and risk register" | Control of Work suite | **AI assistant "Vēlo" + "Hazard Analyzer"** — reviews job descriptions, identifies hidden hazards, recommends tailored controls |
| **EcoOnline** | Mobile-first JHA on eCompliance app; "Identify key hazards from the app in less than 3 clicks" ([EcoOnline JHA](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/job-hazard-analysis-software/)) | **unverified** | Pre-job hazard assessment templates with photo + annotation | Hierarchy referenced in surrounding Risk Manager | ePermits has "automated approval workflows" ([EcoOnline ePermits](https://www.ecoonline.com/en-us/ehs-software/control-of-work/epermits/)); JSA-specific **unverified** | Predictive trend dashboards rather than fixed cadence | Worker signed declarations on linked PTW; **FLRA/FLHA pattern: JSA before permit, FLRA after permit before work begins** ([EcoOnline guide](https://www.ecoonline.com/topics/permit-to-work-ultimate-guide/)) | Strong (3-click capture, photo annotate) | Integrated with incident/risk management | Distinct Control of Work suite (ePermits) coupled to JSA | Worker-friendly mobile-first capture; predictive leading-indicator dashboards |

### JSA.R3 Convergent patterns (≥3 of 4)

- **Library of reusable hazards + controls** with pre/post-control risk scoring
- **Configurable risk matrix** (not fixed 5×5) — all 4
- **Mobile capture with photo evidence** — all 4
- **Tight permit-to-work coupling** — all 4 sell a separate PTW module that consumes JSA output
- **Cross-platform linkage** (incident → JSA, audit → JSA, training → JSA)

### JSA.R4 Divergent / differentiator features

- **AI hazard suggestion + control recommendation** — VelocityEHS only (Vēlo / Hazard Analyzer)
- **Bowtie barrier analysis** — Cority (via Salus) and VelocityEHS
- **Parallel residual-risk modelling** (compare control candidates side-by-side) — Intelex only
- **Field-Level Risk Assessment (FLRA/FLHA)** as a layer atop JSA at the actual job site — EcoOnline explicit
- **Personnel competency gating** (block sign-on if training expired) — VelocityEHS Control of Work
- **Multilingual JSA support** — VelocityEHS explicit
- **Individual per-worker digital signature** (vs. single supervisor) — BasinCheck called this out as a *competitive gap* in enterprise tools including Intelex

### JSA.R5 Gap analysis vs. our locked §JSA spec

| Finding | Verdict | Note |
|---|---|---|
| OSHA 3071 worksheet structure (steps → hazards → controls) | ✅ Already covered | 4-step wizard cleaner than free-form worksheets |
| OSHA 3071 employee involvement | ✅ Already covered | `signed_for_session` ledger + `/perform` view |
| 5-level hierarchy of controls (ANSI Z10) | ✅ Already covered | Exceeds OSHA 3071's 3-level minimum |
| HSE INDG163 5-step framework | ✅ Already covered | Steps 1-3 map to wizard steps 2-3; step 4 = approval; step 5 = re-review trigger |
| Approver ≠ creator | ✅ Already covered | Three-layer enforcement (DB CHECK + server action + UI) mirrors CAPA pattern |
| 5×5 shared matrix | ✅ Already covered | BasinCheck flagged "built-in 5×5 + enforced hierarchy of controls" as a *competitive gap* in enterprise tools — we have it. |
| Steps reorder via @dnd-kit | ✅ Already covered | Dep already in package.json |
| Worker sign-off per shift | ✅ Already covered | `signed_for_session` unique constraint is **stronger** than the typical single-supervisor pattern (BasinCheck gap) |
| Selective step-hazard promotion to §HZ | ✅ Already covered | One-way per step-hazard; auto-promotion avoided |
| **12-month default expiry — clarify it's policy, not standards** | 🔧 **Should add to spec** | Neither OSHA 3071 nor HSE INDG163 mandates a fixed period; both demand **event-triggered review** (near-miss, change of process, change of equipment). Spec should make `expires_at` overridable per JSA and document the rationale. **Single biggest standards-alignment delta.** |
| **Event-triggered re-review (incident link → JSA `under_review`)** | 🔧 **Should add to spec** | Pairs with #4. Add an `incident_jsa_links` table OR add `incident_id` columns to existing structures? Lighter: a JSA `linked_incident_ids[]` column or new `jsa_incident_links(jsa_id, incident_id, link_type)` table. When inserted, fire a status transition `approved → under_review` via the JSA action layer. Mirrors §HZ's `incident_hazard_links` pattern. |
| **Permit-to-work execution is v2+ scope (explicit non-goal)** | 🔧 **Should add to spec** | All 4 competitors sell a separate PTW module. Spec currently stores `permits_required text[]` as metadata; should be explicit that this is **descriptive metadata only**, NOT a permit-issuance workflow. |
| **Mobile photo evidence per step / step-hazard** | 🔧 **Should add to spec** | Every competitor supports photo + annotation in the field. The existing polymorphic `documents` table can absorb this with `linked_to='jsa_step'` / `'jsa_step_hazard'`. Small spec addition, **no new table**. |
| Individual per-worker signature (BasinCheck gap) | ✅ Already covered | Our `jsa_signoffs (jsa_id, worker_id, signed_for_session)` unique key is exactly the individual-signature pattern competitors don't ship |
| AI hazard suggestion (VelocityEHS Vēlo) | 🤔 Consider adding | Argus magic-wand pattern (Phase 9d) fits. `suggest_step_hazards` + `suggest_controls` wand on wizard Step 3. Caveat: AI control suggestions on a safety document need stronger guardrails (incorrect PPE could kill someone) — gate harder than CAPA metadata. Defer to v2.1 |
| Bowtie analysis | ❌ Intentionally skip | Out of v2 JSA scope; belongs in Process Safety / Major Accident Hazard module if ever needed |
| FLRA / FLHA layer | 🤔 Consider adding (v2.1) | Distinct from JSA (JSA = generic task; FLRA = specific instance at this location, crew, shift). EcoOnline pattern: JSA before permit, FLRA after. Significant new surface; keep on roadmap |
| Parallel residual-risk modelling (Intelex) | 🤔 Consider adding (v2.1) | `computeResidual()` already supports this mathematically; needs UI for side-by-side comparison. Low priority |
| Multilingual JSA body | 🤔 Consider adding (v3) | Workers signing off must read the JSA. Site-language metadata + i18n on body/step/hazard text. Out of v2 scope (UCB seed has US + UK sites, both English) |
| Personnel competency gating (VelocityEHS) | 🤔 Consider adding (v3) | Requires Training module; not built |
| OSHA's 3-level vs our 5-level | ✅ Already covered + we exceed minimum | OSHA 3071 lists Engineering / Administrative / PPE; we add Elimination + Substitution per ANSI Z10. **Note in spec rationale: we're stricter, not weaker.** |

### JSA.R6 Sequencing implication

- **Phase 15 after §HZ is correct.** `jsa_step_hazards` FKs into `hazards(id)` and `hazard_candidates(id)` per the locked spec.
- **Merging §HZ + §JSA into one phase is defensible** but **not recommended:**
  - Argument *for* merging: shared `lib/risk/matrix.ts`, shared 5-level controls hierarchy, shared candidate-queue review pattern. Combined phase eliminates a context switch.
  - Argument *against* (recommended): §HZ owns the org-wide risk picture (ISO 45001 §6.1.2 compliance, auditor persona); §JSA owns task-level safe-work practices (OSHA 3071, supervisor + worker persona). Separate phases let §HZ ship and be validated before §JSA piles on supervisor-facing UI. Different RBAC surfaces.
- **Cross-dependencies surfaced by research that should land in §JSA spec/plan:**
  1. **Incident → JSA backlink** (parallel to `incident_hazard_links`)
  2. **Event-triggered re-review** flipping `status` from `approved` → `under_review` when the linked incident is finalised
- **Recommendation:** keep §HZ → §JSA as separate phases. Ship the shared matrix refactor (`lib/risk/matrix.ts`) in §HZ so §JSA inherits a battle-tested module.

---

## §SDS-INTEGRATION SDS Manager Stub

### SDS.R1 Standards baseline — OSHA HazCom 2012/2024 + GHS Rev 9 + EU CLP

#### OSHA Hazard Communication Standard (29 CFR 1910.1200)

- All **16 SDS sections** required, but sections **12–15** (ecological, disposal, transport, regulatory) are explicitly **non-enforced by OSHA** — outside its jurisdiction. ([OSHA 1910.1200](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200))
- Mandatory shipped-container label elements: product identifier, **signal word (`Danger` or `Warning`)**, **hazard statements (H-codes)**, **eight standardized GHS pictograms**, **precautionary statements (P-codes)**, responsible-party contact.
- **Worker training** must cover detection methods, physical/health/asphyxiation/combustible-dust hazards, employer-specific protective procedures, and how to read labels + navigate SDSs.

#### OSHA HazCom 2024 final rule (compliance dates 2026-2028)

Moves the US to **GHS Rev 7** with select Rev 8 elements. Adds desensitized explosives (4 categories), splits flammable gases into 1A/1B, codifies small-container (≤100 mL) labeling, requires Section 2 to address "known or reasonably anticipated uses" including reaction products. Compliance: substance manufacturers **19-Jan-2026**, substance users **20-Jul-2026**, mixtures **19-Jul-2027 / 19-Jan-2028**. ([VelocityEHS blog](https://www.ehs.com/blogs/a-closer-look-at-oshas-final-rule-updating-the-hazcom-standard/); [LearnTastic HazCom 2025](https://learntastic.com/blog/hazcom-2025-osha-s-updates-to-hazard-communication-standards))

#### GHS Rev 9 (Sep 2021) vs Rev 8 / OSHA / CLP

UNECE Rev 9 PDF was 403 from this environment (direct quote **unverified**), but secondary sources are consistent: **Rev 9 is largely a Chapter 2.1 Explosives overhaul** with new decision logic and revised P-statements, but **no major changes to the 16-section SDS template**. ([UL Solutions on Rev 9](https://www.ul.com/news/ghs-revision-9-released-big-updates-explosives-guidelines); [TotalSDS Rev 9 summary](https://www.totalsds.com/summary-of-new-changes-in-ghs-revision-9/))

EU CLP sits further ahead of OSHA: enforces sections 12–15, implements all environmental hazard classes including aquatic toxicity, added a Category 2 aspiration hazard. EU's 2024/2865 (in force 10-Dec-2024) requires digital labeling for online sales. ([Quantum Compliance EU vs OSHA](https://www.usequantum.com/difference-between-eu-and-us-sds-regulations/))

### SDS.R2 Competitor matrix — SDS / chemical management modules

| Vendor | SDS source | Count claimed | GHS parsing | H→control suggestion | Hazard-register tie-in | Inventory / usage | Mobile + QR | Revision alerts | Multi-language | Distinctive |
|---|---|---|---|---|---|---|---|---|---|---|
| **EcoOnline Chemical Manager** | Both (proprietary + customer) | **unverified** count | Pre-filled GHS classification | **Yes — "automatically maps hazard groups alongside required measures"** | Native (COSHH/risk-assessment builder) | Live inventory + storage-compatibility alerts | Mobile + QR + shareable links | Auto SDS updates with revision/date | Yes (COSHH/REACH/HAZCOM) | Condensed "Safety Protection Sheets"; chemical-substitution workflow ([EcoOnline Chemical Mgmt](https://www.ecoonline.com/chemical-safety/chemical-management-software/)) |
| **VelocityEHS MSDSonline** | Proprietary "biggest SDS database in the industry" | Millions; ~20k new/updated weekly | GHS-aligned labels generated | **unverified** explicit H→control mapping | Hazard data feeds inventory; no explicit hazard-register | Container-level inventory + barcode | Mobile online/offline; barcode; QR **unverified** | Continuously refreshed | Yes | "Right-to-Know" mobile binders by location/work-area ([VelocityEHS SDS Mgmt](https://www.ehs.com/solution/chemical-management/sds-management/)) |
| **Cority Chemical Mgmt** | Both (proprietary via 3E partnership) | **20M+ SDS via 3E** | CAS-based risk + GHS/WHMIS labels | **unverified** | Yes — IH module integration | Onsite quantities + thresholds + locations | Barcode + mobile | Auto-update via 3E feed | Yes (3E 70+ languages) | "Chemical approval workflow" gate before material onboarded ([Cority 3E partnership](https://www.cority.com/news-media/3e-partnership-chemical-management-datasheet-library/)) |
| **Intelex SDS Library** | Customer-uploaded primarily | **unverified** | **unverified** | **unverified** | Via wider EHSQ no-code workflow builder | Via apps | App-store presence; specifics **unverified** | **unverified** | Multi-language sites | Distinctive: 100+ pre-built apps + no-code workflow designer ([Intelex SDS Library](https://www.intelex.com/products/applications/sds-library)) |
| **3E / Verisk 3E** (reference) | Proprietary | **20M+ SDS, 70+ languages** | API hazard classifications | n/a (data layer) | n/a — OEM data layer | n/a | 3E Protect mobile app | Yes | The dominant SDS-data-layer OEM behind Cority and others ([Verisk 3E](https://www.verisk.com/company/newsroom/verisk-3e-unlocks-worlds-most-comprehensive-and-up-to-date-database-of-safety-data-sheets/)) |

### SDS.R3 Convergent patterns (≥3 of 4)

1. **Proprietary millions-scale SDS library + auto-revision feed** — the catalog *is* the product (VelocityEHS, Cority/3E, EcoOnline)
2. **Inventory / container-level tracking with locations** — VelocityEHS, Cority, EcoOnline
3. **Mobile SDS lookup** (online + offline) — all 3 major vendors; QR codes explicit on EcoOnline + 3E
4. **Secondary-container / GHS workplace label generation** — VelocityEHS, Cority, EcoOnline
5. **GHS-aligned multi-jurisdiction (OSHA / CLP / WHMIS / REACH) compliance reporting**
6. **Chemical approval / request workflow gate before onsite use** — Cority + EcoOnline explicit

### SDS.R4 Divergent / differentiator features

- **H-statement → control measure auto-mapping**: **EcoOnline alone** documents this explicitly. Our stub's `suggested_controls` array per chemical **is the same pattern** — direct competitive parity on the one feature that matters for the §HZ feed.
- **Storage-compatibility / segregation alerts** — EcoOnline distinctive
- **Chemical-substitution workflow** — EcoOnline + Cority
- **Industrial hygiene exposure-monitoring integration** — Cority
- **No-code workflow builder for chemical approval chains** — Intelex
- **Condensed "Safety Protection Sheets"** — EcoOnline (worker-friendly summary)

### SDS.R5 Gap analysis vs. our locked stub spec

| Finding | Verdict | Note |
|---|---|---|
| 16-section SDS structure | ✅ Already covered | Catalog stores GHS-derived subset (Section 2 + Section 8 distillate); stub never claims to render full SDS PDFs |
| Signal word + GHS pictograms + H-codes | ✅ Already covered | Each catalog chemical carries these literally |
| H-statement → suggested controls (EcoOnline flagship) | ✅ Already covered | This **is** the spec's core demo value |
| Auto SDS revision feed | 🚧 Defer to real-API v2.5 | Stub catalog is static; deferred correctly |
| Inventory / container-level tracking + locations | ❌ Intentionally skip | Spec calls out `sds_chemical_uses` as a non-goal |
| Secondary-container / GHS label generation | 🚧 Defer | Not in §HZ-feeder scope |
| Mobile SDS lookup + QR codes | 🚧 Defer | Future module |
| Multi-language SDS | 🚧 Defer | Catalog is EN-only for demo |
| Chemical approval workflow gate (Cority/EcoOnline) | 🤔 Consider | The `hazard_candidates` review queue IS structurally similar — frame imports as "review queue items," not auto-approved hazards. Already the case in spec. |
| Storage-compatibility alerts | ❌ Intentionally skip | Belongs to a Resources/Assets-adjacent module |
| Worker training tie-in (OSHA 1910.1200(h)) | 🤔 Consider (v3) | Hazard candidate could trigger a "training due" tile later |
| CAS number on each chemical | ✅ Already covered | `proposed_metadata.cas_number` per spec |
| GHS Rev 9 explosives revisions | ❌ Intentionally skip | The 6 chemicals contain zero explosives; not relevant |
| OSHA 2024 §1 / §9 fields | 🚧 Defer | SDS-authoring fields, not consumer-side |
| `Danger` vs `Warning` signal-word distinction | ✅ Already covered | Per spec |
| Condensed worker-facing SDS summary (EcoOnline) | 🤔 Consider | The hazard candidate row IS effectively a one-line summary; spec is fine as-is |
| Real-API swap path | ✅ Already covered | `actions/sds.ts` indirection explicit |
| **GHS pictograms passed through to `proposed_metadata`** | 🔧 **Should add to spec** | The spec mentions "realistic GHS pictograms" on the catalog row but is silent on whether they pass through into the candidate. Passing them through costs nothing and dramatically improves the §HZ candidate-review-queue's visual demo quality. **Add `pictograms: string[]` to `proposed_metadata`** alongside CAS, H-statement, suggested_controls. |

### SDS.R6 Realism of the 6-chemical catalog

Strong but biased toward labs/manufacturing. Coverage check against the 3 hazard families:

- **Flammables (3):** Toluene (BTX-class solvent, automotive paint), IPA, Acetone — all top-10 lab solvents per university EHS pages ([UVA EHS SDS](https://ehs.virginia.edu/Chemical-Safety/SDS); [Harvard EHS](https://ehs.harvard.edu/programs/safe-chemical-work-practices)). IPA + Acetone overlap heavily (both flammable oxygenated solvents, similar pictograms).
- **Corrosives (2):** Sulfuric Acid (acid) + Sodium Hydroxide (base) — textbook pairing.
- **Low-hazard + environmental (1):** Hydraulic Oil — only environmental pictogram in catalog.

**Pictogram gaps in current catalog:**
- No **health-hazard pictogram** (skull-and-crossbones or health-hazard without flammability)
- No **oxidizer pictogram**
- No **gas-under-pressure pictogram**

**Recommendation:** the 6-chemical set is **acceptable for v1 demo**. If we want maximum pictogram coverage in a single demo session, swap one of `{IPA, Acetone}` for either:
- **Formaldehyde** (healthcare/labs, IARC Group 1 carcinogen — adds health-hazard pictogram + healthcare-industry relevance), OR
- **Compressed Nitrogen** (manufacturing/labs — adds gas-cylinder pictogram)

Either swap is a one-file change in `lib/sds/dummy-catalog.ts` and adds genuine demo value. **Not blocking** — the current 6 are fine.

### SDS.R7 Sequencing implication

**Yes, §SDS-INTEGRATION is correctly positioned after §HZ.** The dependency is mechanical: the stub's sole write path is into `hazard_candidates`, which is a §HZ table.

**Same PR as §HZ is feasible and arguably preferable.** The stub is genuinely small:
- 1 new route (`/admin/integrations`) + 1 card
- 1 new modal mounted on `/hazards/candidates`
- 1 catalog file + 1 server action
- 0 migrations (writes into §HZ tables)
- 0 new tables

Plausibly ~300–500 LOC. Bundling it into the §HZ PR avoids a "§HZ shipped but candidate queue looks bare" interim state, lets reviewers see the proposed-metadata contract end-to-end, and means the `proposed_metadata.suggested_controls` shape is co-designed with the §HZ `convertCandidate` form that consumes it.

**Recommendation:** plan §HZ and §SDS-INTEGRATION such that they CAN ship as one combined PR, but with separate phase numbers (14 + 16) so docs/BUILD_STATUS.md retains clean attribution. Plan 14 carries §HZ; plan 16 carries the SDS stub and explicitly notes "can land in same PR as Phase 14."

Cross-dependencies to flag explicitly:
1. `hazard_candidates.proposed_metadata` jsonb shape — agreed between §HZ and §SDS-INTEGRATION before either ships
2. `hazard_candidates.source_type` enum must include `'sds_import'` (spec says it does; verify the §HZ migration adds it)
3. `hazard_candidates` RLS write must permit the SDS importer user
4. `proposed_metadata` shape forward-compatible with future real API (free-form jsonb already is)

---

## Cross-cutting recommendations

### Phase ordering — recommended

| Phase | Module | Shipping mode | Rationale |
|---|---|---|---|
| **14** | §HZ Hazard Register | Standalone PR | Heavy lift: 5 new tables, RLS, matrix refactor, full UI surface |
| **15** | §JSA Job Safety Analysis | Standalone PR | Distinct supervisor/worker-facing UI + 5 new tables + approval workflow; depends on §HZ |
| **16** | §SDS-INTEGRATION stub | Combinable with Phase 14 | Tiny scope (~300-500 LOC, 0 migrations); shares no dependencies with §JSA — only with §HZ tables. Can ship in same PR as Phase 14 OR separately after Phase 14 |

### Spec deltas summary (8 items)

Re-listed from executive summary for ease of reference when writing plans:

1. **§HZ:** `hazard_controls.next_control_review_at date` + "Overdue reviews" tile feeds both cadences
2. **§HZ:** Risk-owner auto-notification on `incident_hazard_links` insert
3. **§HZ:** New Argus magic-wand `suggest_hazard_controls` on `convertCandidate` form
4. **§JSA:** Clarify 12-month expiry is policy default; document standards rationale
5. **§JSA:** Event-triggered re-review: incident link → JSA `approved → under_review`
6. **§JSA:** Explicit non-goal: permit-to-work execution is v2+ scope
7. **§JSA:** Mobile photo evidence per step / step-hazard via existing `documents` polymorphic table
8. **§SDS:** GHS pictograms passed through into `proposed_metadata`

These will be referenced from the respective plan files as "Spec deltas from research" — the plans propose the SPEC edits land alongside the implementation, not before. The current SPEC sections remain authoritative until the plan ships.

### Backlog (v2.1 / v3 candidates)

Surfaced by research, not folded into v2:

- 🤔 Bowtie visualization (VelocityEHS / Cority+Salus differentiator) — v3
- 🤔 Field-Level Risk Assessment / FLRA layer atop JSA (EcoOnline pattern) — v2.1
- 🤔 Parallel residual-risk modelling for control-option comparison (Intelex) — v2.1
- 🤔 Argus `suggest_step_hazards` + `suggest_controls` wands on JSA Step-3 — v2.1 (with stronger guardrails than CAPA metadata)
- 🤔 Worker consultation as first-class entity (vs. trigger flag) — polish PR
- 🤔 Multilingual JSA body — v3 (multi-country deployments)
- 🤔 Personnel competency gating at JSA sign-off — depends on Training module — v3
- 🤔 Configurable risk methodology beyond fixed 5×5 — v2.5 (multi-industry adoption)
- 🤔 Catalog swap: Formaldehyde or Compressed Nitrogen for IPA/Acetone (pictogram coverage) — v2 polish

### Argus integration touchpoints surfaced

Three concrete Argus surfaces emerge from research (each follows the Phase 9d magic-wand pattern: prompt-cached system prompt + Zod-validated structured output + `argus_suggestions` row + Accept/Edit/Reject):

| Phase | Surface | Tool name (proposed) | Rationale |
|---|---|---|---|
| 14 (§HZ) | `convertCandidate` form on `/hazards/candidates/[id]` | `suggest_hazard_controls` | Mirrors VelocityEHS Control Recommendations; high EHS-time-saver |
| 15 (§JSA) — v2.1 | Wizard Step 3 hazard rows | `suggest_step_hazards` | Mirrors VelocityEHS Vēlo / Hazard Analyzer |
| 15 (§JSA) — v2.1 | Wizard Step 3 controls per hazard | `suggest_step_controls` | Same as `suggest_hazard_controls` but JSA-scoped; gated harder (PPE recommendations life-critical) |

Page-context provider (Phase 9e) reads each route and surfaces appropriate suggestion chips on the side panel — no additional work for these surfaces beyond shipping the tool definitions.

### What the research did NOT change

The following spec decisions are **reaffirmed** by research, not revised:

- 8 hazard categories (`physical/chemical/biological/psychosocial/mechanical/electrical/ergonomic/environmental`) — sufficient coverage; none added or dropped
- 6 hazard lifecycle states (`identified → under_assessment → controlled → monitoring → closed → superseded`) — internally consistent; no competitor has a meaningfully different state machine
- 12 identification sources — wider than any competitor's enumeration; no gaps
- 5-state JSA lifecycle (`draft → under_review → approved → expired → archived`) — matches industry default
- 5-level hierarchy of controls with 4/3/2/1/1 reduction factors — exceeds OSHA 3071 minimum, matches ANSI Z10
- 5×5 risk matrix shared via `lib/risk/matrix.ts` — competitors are configurable but our consistency-with-incident-severity argument is strong
- 6-chemical SDS catalog scope — acceptable for v1 demo; pictogram-coverage swap is nice-to-have
- "Approver ≠ creator" three-layer enforcement on JSAs — mirrors CAPA pattern, defensible
- Workers re-sign per shift session — competitive differentiator (BasinCheck explicitly flagged single-supervisor sign-off as a gap in enterprise tools)
- `hazard_candidates` single review queue for 6+ identification methods — cleaner than competitor-specific quirks

---

## Source bibliography

### Standards
- [ISO 45001:2018 clause 6.1.2.1 commentary](https://blog.auditortrainingonline.com/blog/understanding-iso-45001-clause-6.1.2.1-hazard-id)
- [ISO 45001:2018 clause 6.1.2.2 commentary](https://blog.auditortrainingonline.com/blog/understanding-iso-45001-clause-6.1.2.2-assessment-of-ohs-risks)
- [ISO 45001:2018 clause 8.1.2 hierarchy of controls](https://blog.auditortrainingonline.com/blog/iso-45001-clause-8-1-2)
- [Pretesh Biswas — ISO 45001:2018 Clause 6.1.2 deep dive](https://preteshbiswas.com/2023/09/23/iso-450012018-clause-6-1-2-hazard-identification-and-assessment-of-risks-and-opportunities/)
- [OSHA 3071 Job Hazard Analysis (HTML)](https://obis.osha.gov/Publications/osha3071.html)
- [OSHA 3071 (PDF reference)](https://www.osha.gov/sites/default/files/publications/OSHA3071.pdf)
- [HSE — Steps needed to manage risk (INDG163 framework)](https://www.hse.gov.uk/simple-health-safety/risk/steps-needed-to-manage-risk.htm)
- [OSHA 1910.1200 Hazard Communication](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.1200)
- [VelocityEHS blog — Closer Look at OSHA HazCom 2024 Final Rule](https://www.ehs.com/blogs/a-closer-look-at-oshas-final-rule-updating-the-hazcom-standard/)
- [LearnTastic — HazCom 2025 explainer](https://learntastic.com/blog/hazcom-2025-osha-s-updates-to-hazard-communication-standards)
- [UL Solutions — GHS Revision 9 explosives changes](https://www.ul.com/news/ghs-revision-9-released-big-updates-explosives-guidelines)
- [TotalSDS — Summary of GHS Revision 9 changes](https://www.totalsds.com/summary-of-new-changes-in-ghs-revision-9/)
- [CIRS Group — UN GHS 9th revised edition](https://www.cirs-group.com/en/chemicals/un-ghs-the-9th-revised-edition-has-been-published)
- [Quantum Compliance — EU CLP vs OSHA SDS differences](https://www.usequantum.com/difference-between-eu-and-us-sds-regulations/)
- [Compliance & Risks — 2025 Global GHS implementation guide](https://www.complianceandrisks.com/blog/global-ghs-implementation-differences-by-country-a-definitive-guide-for-multinational-compliance-teams/)
- [SafetyPro Resources — How to Audit Your JSA Program](https://www.safetyproresources.com/blog/how-to-audit-your-job-safety-analysis-jsa-program)

### Competitors

**Cority:**
- [CorityOne Risk Management Software](https://www.cority.com/corityone/risk-management-software/)
- [Cority Digital Risk Management blog](https://www.cority.com/blog/digital-risk-management/)
- [Cority hierarchy of controls for chemical hazards](https://www.cority.com/blog/hierarchy-of-controls-chemical-hazards/)
- [Cority Chemical Management](https://www.cority.com/environmental-cloud/chemical-management/)
- [Cority + 3E partnership](https://www.cority.com/news-media/3e-partnership-chemical-management-datasheet-library/)
- [Cority + Salus Technical bowtie partnership (Feb 2025)](https://www.globenewswire.com/news-release/2025/02/04/3020128/0/en/Cority-Partners-with-Salus-Technical-Bringing-Advanced-Bowtie-Risk-Analysis-to-CorityOne-Ecosystem.html)

**Intelex:**
- [Intelex Enterprise Risk Register](https://www.intelex.com/products/applications/enterprise-risk-register-software/)
- [Intelex Health & Safety Risk Management](https://www.intelex.com/risk-management/health-and-safety-risk)
- [Intelex JSA Software](https://www.intelex.com/products/applications/job-safety-analysis-software/)
- [Intelex JSA Product Demo](https://www.intelex.com/resources/product-demo/job-safety-analysis-software/)
- [Intelex Permit to Work Software](https://www.intelex.com/products/applications/permit-work-software/)
- [Intelex blog — Identifying Hazards Using JSA Software](https://blog.intelex.com/2022/11/01/identifying-and-tracking-hazards-using-job-safety-analysis-software/)
- [Intelex Q2 2025 Product Launch (Global Risk Management App)](https://blog.intelex.com/2025/07/16/q2-product-launch/)
- [Intelex SDS Library](https://www.intelex.com/products/applications/sds-library)
- [Intelex Chemical Industry page](https://www.intelex.com/industries/chemical/)

**VelocityEHS:**
- [VelocityEHS Risk Analysis](https://www.ehs.com/solution/operational-risk/risk-analysis/)
- [VelocityEHS Operational Risk](https://www.ehs.com/solution/operational-risk/)
- [VelocityEHS JSA](https://www.ehs.com/solution/operational-risk/jsa/)
- [VelocityEHS Control of Work](https://www.ehs.com/solution/contractor-safety-permit-to-work/control-of-work/)
- [VelocityEHS Bowtie blog pt 3](https://www.ehs.com/blogs/the-bowtie-analysis-blog-part-3-using-risk-bowties-to-visualize-and-manage-risk-controls/)
- [VelocityEHS SDS Management](https://www.ehs.com/solution/chemical-management/sds-management/)
- [LabManager — VelocityEHS MSDSonline launch](https://www.labmanager.com/velocityehs-launches-newly-designed-msdsonline-chemical-management-platform-3265)

**EcoOnline:**
- [EcoOnline Risk Management Software](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/)
- [EcoOnline Hazard Assessment](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/hazard-assessment-software/)
- [EcoOnline Job Hazard Analysis Software](https://www.ecoonline.com/en-us/ehs-software/risk-management-software/job-hazard-analysis-software/)
- [EcoOnline ePermits / Control of Work](https://www.ecoonline.com/en-us/ehs-software/control-of-work/epermits/)
- [EcoOnline Permit to Work Ultimate Guide (FLRA sequencing)](https://www.ecoonline.com/topics/permit-to-work-ultimate-guide/)
- [EcoOnline Chemical Management](https://www.ecoonline.com/chemical-safety/chemical-management-software/)
- [EcoOnline Chemical Manager Key Benefits](https://insights.ecoonline.com/nam/product-brochure/ecoonline-chemical-manager/key-benefits)
- [EcoOnline COSHH Risk Assessment](https://www.ecoonline.com/chemical-safety/coshh-assessment-software)

**Reference (SDS data layer):**
- [Verisk 3E — World's most comprehensive SDS database](https://www.verisk.com/company/newsroom/verisk-3e-unlocks-worlds-most-comprehensive-and-up-to-date-database-of-safety-data-sheets/)
- [3E Protect mobile chemical safety](https://www.3eco.com/3e-solutions/chemical-workplace-safety/3e-protect/)

**Comparison sources:**
- [BasinCheck — Best JSA Software](https://basincheck.com/resources/best-jsa-software)
- [GoAudits — Top JHA Software](https://goaudits.com/blog/job-hazard-analysis-software/)
- [HSE Network — Best Permit to Work Software](https://www.hse-network.com/best-permit-to-work-software/)
- [UVA EHS — SDS guidance](https://ehs.virginia.edu/Chemical-Safety/SDS)
- [Harvard EHS — Safe Chemical Work Practices](https://ehs.harvard.edu/programs/safe-chemical-work-practices)
