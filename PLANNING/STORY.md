# EHS Operations Platform — Product Story

> This file tells the story of **why** we build this app. It also lists **the problems** we want to solve.
>
> Read this file before the spec. The spec answers "what" and "how". This file answers "why".

---

## Words You Need First

Before the story, here are the short words. Read them once. The story will make sense.

- **EHS** = Environment, Health, and Safety. The team that keeps workers safe.
- **Hazard** = something at work that **could** hurt someone. The fall has not happened yet. The hazard is the slippery floor.
- **Incident** = something that **did** happen at work. A fall. A near-miss. A spill. A fire.
- **Near-miss** = something almost caused harm, but no one got hurt.
- **JSA** = Job Safety Analysis. A short written plan **before** a risky job. It lists the steps, the hazards in each step, and how to stay safe.
- **PPE** = Personal Protective Equipment. Helmet, gloves, eyewear, hi-vis vest.
- **Inspection** = a planned check. For example: a daily forklift walk-around. A monthly fire-extinguisher check.
- **Template** = the reusable form behind an inspection. Built once, run many times. Versioned.
- **Severity** = how serious an incident is. We use a number: S1 (very bad) to S5 (very small).
- **Track A / B / C** = the three paths an incident can take.
  - Track A = critical. Must investigate. Tell people now.
  - Track B = standard. Investigate.
  - Track C = small. Just log it and close.
- **Investigation** = the work to find out **why** the incident happened.
- **CAPA** = Corrective and Preventive Action. The fix. What we do so it does not happen again.
- **Verifier** = a different person who checks if the fix really worked.
- **Bulletin** = a short safety note sent to the whole org or one site. "Here is what happened. Here is what to do."
- **OSHA** = the US government office for workplace safety.
- **RIDDOR** = the UK rule for reporting work injuries.
- **OSHA 300 Log** = a list of all work injuries. The US government wants this list.
- **OSHA 300A** = a yearly summary of the 300 Log.
- **TRIR** = a number that shows how safe a workplace is. Lower is better.
- **Asset** = a thing the company owns. A shelf, a forklift, a machine.
- **Document** = a file the company keeps. An SDS (chemical safety sheet), a training certificate, a procedure.
- **Planner** = a calendar that shows everything scheduled — inspections, CAPA due dates, asset maintenance, regulatory deadlines.
- **Dashboard** = the main screen with KPIs, quick actions, module cards, and trend charts.
- **Argus** = our AI copilot. **Argus suggests. Argus never decides.** A human always signs.

---

## The Story

### Part 1 — Before the morning shift starts

It is **05:30 on a Tuesday**. A factory in Houston wakes up.

The day did not start at 09:42 (when the incident later happens). The day started before sunrise:

- A new EHS manager joined the company last month. On her first day she walked through a **3-step onboarding** wizard on the laptop: sign up → pick the org → invite her team. The dashboard greeted her with a **Get Started** list — "create a template", "add your first hazard", "invite your team". She has been ticking items off all week.
- At **06:00**, the morning-shift driver opens our app on his phone. He runs the **daily forklift inspection** from a versioned template. He answers each question, takes two photos, signs, and submits. Saved.
- At **07:00**, the new chemical-handling job is about to start. Before anyone touches the chemical, the foreman opens the **JSA** for that job. The JSA lists every step and every hazard. The crew reads it. Each worker signs.
- At **08:30**, a worker in the loading area sees that the floor near Bay 4 is greasy. He does not wait for a meeting. He opens the **Hazard Register** on his phone and adds the hazard in under a minute. The risk score is computed by a 5×5 matrix on the screen.

The app already knows the day has a shape. Inspections, JSAs, hazards — all linked to the right site, the right assets, the right people.

### Part 2 — The event

At **09:42**, a forklift hits a shelf in the loading area. A box of cleaning chemicals falls. The box breaks. A small puddle is on the floor.

- Nobody is hurt.
- The driver is upset.
- The supervisor is in another aisle.

### Part 3 — The bad story (without our app)

In most workplaces, this is what happens next:

- Someone uses paper towels to clean it up.
- Someone says: "let us clean it up and move on."
- Someone sends a photo on WhatsApp.
- After one week, nobody remembers.

**Six months later**, a forklift hits the same shelf again. But this time:

- The box on top is heavier.
- The chemical is stronger.
- A worker is standing under it.

A worker gets hurt. Why? Because the **first** event was never recorded. Nobody fixed the real problem. Nobody read the hazard the loading-area worker raised that morning. Nobody connected the chemical-handling JSA to the forklift route. The lesson, if it had been learned, was never **shared** with the Detroit or Manchester sites.

**This is what we want to stop.**

### Part 4 — The good story (with our app)

The supervisor opens our app on her phone. The dashboard's **Quick actions** row puts "Report incident" one tap away. She taps it.

She fills three short steps:

1. **Step 1** — What happened? (forklift, shelf, chemical box)
2. **Step 2** — Who and what was there? (driver name, witness names, photo of the spill, **link to the forklift asset**, **link to the chemical SDS** from the document library)
3. **Step 3** — How serious is it? (she uses the 5×5 risk matrix on the screen)

She is finished. It took two minutes.

**Argus**, our AI copilot, gently asks: "This looks like a chemical spill near a worker. RIDDOR may apply because the substance is rated above the dangerous-occurrence threshold. Do you want to flag this for review?" She taps Yes. **Argus does not classify the incident. She does.** Every Argus suggestion is logged with the prompt, the response, and her decision — for audit and for cost.

### Part 5 — What the system does by itself

Now the system does **six jobs** for her. She does not type anything more.

| # | Job | What it means |
|---|---|---|
| 1 | Save the incident as `INC-2026-0142` | The record is in the database from step 1. Even if she stops in the middle, it is saved. |
| 2 | Set the severity | The 5×5 matrix decides. The system picks Track B (standard investigation). |
| 3 | Start the regulatory clock | The clock starts because the matrix says so. Not because someone remembers. |
| 4 | Send notifications | The EHS manager, the site admin, and the on-call investigator get a message. The notification bell shows it. |
| 5 | Surface today's hazard | The Hazard Register saw a hazard raised in the same area at 08:30. The dashboard shows it as a possible pattern. |
| 6 | Pre-fill from the morning's data | The forklift asset is already linked. The chemical SDS is already attached. The morning's JSA is referenced. |

### Part 6 — What happens next (the timeline)

Now follow the clock:

#### **At 10:15 (33 minutes after the incident)**

The investigator opens his **Planner**. He sees the new investigation on today's column. The witness names are **already there** — copied from the supervisor's report. The forklift asset is **already linked**. The chemical SDS is **already attached**.

He does not type the names again. He does not wait for an email.

He opens the **5-tab investigation page**:
- Summary
- 5-Why (a structured form, not free text)
- Evidence (photos + documents, dragged from the library)
- Findings (turn into CAPAs in one click)
- Timeline (every action recorded — investigation Kanban makes sure nothing is forgotten in someone's inbox)

#### **By Friday (3 days later)**

The investigation is finished. The investigator writes 3 findings. Each finding becomes a **CAPA** — a fix.

The CAPAs are given to the right owners:

1. **Replace the broken upright** → maintenance lead.
2. **Check all shelves for damage** → maintenance lead.
3. **Train forklift drivers on the new traffic plan** → training coordinator.

When the third CAPA is created, the EHS manager decides to publish a **Safety Bulletin** to all forklift drivers across all sites. Each driver must **acknowledge**. The dashboard shows the acknowledgment rate so nobody slips through.

#### **Two weeks later — the check**

A **different person** (not the maintenance lead) checks the work. This is an important rule:

> **The person who fixes the problem cannot be the person who checks it.**

The verifier opens the CAPA. He picks one of four answers:

- ✅ `effective` — the fix worked.
- ⚠️ `partially_effective` — the fix worked a little. **The system makes a follow-up CAPA by itself.**
- ❌ `not_effective` — the fix did not work.
- ⏳ `too_early_to_verify` — too soon to know.

He also picks a **method**. How did he check?

- Inspection
- Monitoring
- Audit trend
- Re-interview
- Document review

So "I checked" cannot be the audit answer. The system asks: **how** did you check?

#### **The same day (back to Tuesday)**

The incident is **already** in the OSHA 300 Log. Nobody types it in.

The morning's JSA, the morning's hazard, and the morning's forklift inspection are now linked together with the incident. Anyone can trace the chain.

#### **At year-end**

The yearly OSHA 300A summary updates TRIR, DART, and Severity Rate by itself.

- No Excel file.
- No rush.
- No missed deadline.
- One-click CSV upload to the OSHA ITA portal.
- OSHA 301 and RIDDOR F2508 PDFs are generated per incident, with the HSE notification record card built in.

### Part 7 — Six months later

A different forklift hits a different shelf. A new incident.

An inspector opens the **asset history** for that shelf. He sees a list:

- 🔴 Three impact events (forklifts hit shelves like this **three times** before).
- 🟡 One CAPA that only worked a little.
- 🟠 One follow-up that is still open.
- 🟢 Two bulletins acknowledged by drivers.

Argus paints a tile on the dashboard: "CAPA overdue cluster — 3 impacts on similar shelves in 90 days. Trend is up." The inspector reads the tile and decides. Argus does not push a button.

He hits `⌘K` and searches "Bay 4". The global search returns hits across 9 entity types — incidents, investigations, CAPAs, inspections, templates, assets, documents, sites, people — all in one list, filtered by the user's permissions.

This is a **pattern**. The same problem keeps coming back.

Before our app, this pattern was hidden. The information was in many places: emails, paper files, people's memory.

Now, the inspector can say: "Stop. We need to do something different. **Before** a worker is standing under the next falling box."

### Part 8 — Our goal

> Take every safety event — small or big.
> Capture it. Classify it. Investigate it. Close it. Report it.
>
> Take every routine task — inspections, JSAs, hazard reviews, bulletins.
> Make it part of the daily rhythm.
>
> **Make it easy for the worker on the floor. Make it automatic for the regulator at year-end.**

---

## The Ten Problems We Solve

These problems cover the full app. They run from the start of the day on the factory floor to the end of the year in the regulator's inbox. Each problem connects to one or more modules.

### Problem 1 — "Nobody reports the small things."

**The pain.**
Workers do not report near-misses or small events. Why? It is too hard.

- Paper forms get lost.
- The shared Excel file is on one laptop.
- The breakroom PC needs a login that nobody remembers.

So the small events are never recorded. But the small events are the warning signs!

**Why it matters.**
OSHA research shows a clear pattern:

```
1 fatality (death)
        ↑ comes after
30 lost-time injuries
        ↑ comes after
300 near-misses
```

If we miss the **300 near-misses**, we cannot stop the **30 injuries** or the **1 death**.

**How we solve it.**

- A **3-step Report Wizard**. Any worker can finish it on a phone in less than two minutes.
- Step 1 saves the incident at once. Even if the user stops in the middle, the data is safe.
- One simple flow handles all 8 incident types.
- Witnesses, body map, asset search, and photo upload are all on the same screen.
- The dashboard's **Quick actions** row puts "Report incident" one tap away from every page.

**Modules:** Incidents, Resources, Dashboard.

---

### Problem 2 — "Severity depends on who is free at the moment."

**The pain.**
Different people decide different things.

- A site admin marks a serious injury as "moderate" because the worker walked out.
- A supervisor marks a chemical splash as "minor" because nobody complained.

Decisions are not the same across sites or shifts.

Big incidents and small cuts go in the same queue. Government deadlines (OSHA 8 hours for death, OSHA 24 hours for amputation, RIDDOR "without delay") are missed. Why? **Nobody started the clock.**

**Why it matters.**
This is the first thing regulators look for. Inconsistent severity = the safety program is not working.

**How we solve it.**

- A **5×5 risk matrix**. Two engines: severity engine + routing engine.
- Both run together when the user finalizes the report.
- Track A (S1/S2 critical) → investigation is required + notifications go out at once.
- Track B (S3) → standard investigation.
- Track C (S4) → log and close.
- A user can override the severity, but the override is saved in an append-only log that nobody can change.
- Notifications go out at **classification**, not at the end. The clock starts when severity is set.
- Argus may **suggest** a severity from the description, but the human signs.

**Modules:** Incidents, Notifications, Argus.

---

### Problem 3 — "Investigations blame the worker and stop there."

**The pain.**
Old systems write things like:

- "Worker was not paying attention."
- "Operator did not follow the procedure."

This is **not** root-cause analysis. It is just blame.

- No 5-Why method.
- No fishbone diagram.
- No look at the **system** that let the worker fail.

Evidence (photos, witness statements, maintenance logs) is in many places: email, Slack, someone's phone.

Six months later, the same incident happens. The same blame is given. The system has learned **nothing**.

**Why it matters.**
ISO 45001 §10.2 (the international safety rule) is clear: corrective actions must fix the **root cause**, not the symptom.

> "Be more careful" is **not** a corrective action.

**How we solve it.**

- A real **Investigation module** with a 5-tab page:
  - Summary
  - 5-Why
  - Evidence
  - Findings
  - Timeline
- A Kanban board so no investigation is forgotten in someone's inbox.
- Witness names from the report wizard carry over to the investigation page.
- Evidence files are linked from the Document Library. The same file can be used in many places.
- The 5-Why is a structured form, not free text.
- Findings create CAPAs in one step. So an investigation **cannot close** without clear corrective actions.

**Modules:** Investigations, Resources/Documents.

---

### Problem 4 — "The same person who owns a CAPA closes it."

**The pain.**
The maintenance lead gets a CAPA: "replace the broken upright and train operators."

Two weeks later, he clicks **Mark Complete**. The CAPA is closed.

But:

- Nobody else looked at it.
- Nobody checked if the training really happened.
- Nobody checked if the new upright matches the spec.
- Nobody checked if the traffic plan really changed.

On paper, the CAPA closure rate is **100%**. In real life, the same incident happens again.

Auditors call this *paper compliance*. Regulators call it *findings* (problems they will fine you for).

**Why it matters.**
A missing independent check is the **#1 reason** for repeat incidents. This is why we put the rule into the **architecture**, not just into the **process**.

**How we solve it.**

> **CAPA owner ≠ verifier.**
> The person who fixes the problem cannot be the person who checks it.

This rule is enforced at **three layers**:

1. **UI layer** — the button is disabled if the user is the owner.
2. **Server Action layer** — the server rejects the request.
3. **Database layer** — a CHECK constraint blocks the row.

Verification has **four outcomes**, not two:

| Outcome | What it means |
|---|---|
| `effective` | The fix worked. |
| `partially_effective` | The fix worked a little. **A follow-up CAPA is created by the system.** |
| `not_effective` | The fix did not work. |
| `too_early_to_verify` | Too soon to know. |

The verifier also picks a **method**: inspection, monitoring, audit trend, re-interview, or document review.

So "I checked" cannot be the audit answer. The system asks: how did you check?

**Modules:** CAPA, Inspections, Resources/Documents.

---

### Problem 5 — "Year-end is a regulatory rush."

**The pain.**
It is **January 31st**. The OSHA 300A is due today.

- Someone is comparing spreadsheets, HR's hours-worked report, and last year's incident emails.
- The TRIR is being calculated by hand.
- The OSHA ITA upload (the official portal) rejects the file because the format is wrong.
- A RIDDOR report from October was never sent. Nobody noticed.

The same rush happens every year. Data quality drops every year. Legal risk grows every year.

**Why it matters.**

- OSHA now requires the 300A through the ITA digital portal for many sites (since the 2024 rule expansion).
- RIDDOR fines are real. HSE prosecutions in the UK are public.

**How we solve it.**

> Reports are a **live view** of incident data. **Not** a year-end task.

- The **OSHA 300 Log** on the screen is the official OSHA 300 Log. It updates live.
- The **300A** calculates TRIR, DART, and Severity Rate in the browser.
- ITA-format CSV export takes **one click**.
- OSHA 301 and RIDDOR F2508 are PDFs (one for each incident).
- The HSE notification record card is built in.
- Soft-delete only on incidents, investigations, and CAPAs. (5 years for OSHA, 3 years for RIDDOR.) The data model **blocks** any path to lose history.

**Modules:** Reports, Incidents, CAPA.

---

### Problem 6 — "Hazards live in someone's head, not in a register."

**The pain.**
A worker sees a wet patch on the warehouse floor. He tells his supervisor at the next break.

- The supervisor forgets.
- The wet patch is the same wet patch every week.
- Three months later, someone slips. Now it is an **incident**.

The hazard was known. It was just never written down.

**Why it matters.**
ISO 45001 calls this **hazard identification**. It is the **first** step of every safety system. If you do not have a register, you have nothing.

**How we solve it.**

- A **Hazard Register**. Any worker can add a hazard in under one minute on a phone.
- Each hazard has: where it is, what type, how likely it is, how bad it could be, who owns it.
- A **5×5 risk matrix** scores each hazard. The score updates when controls change. The risk-assessment history is preserved.
- Hazards link to incidents. The incident-report wizard surfaces open hazards on the same site, so the chain is visible.
- Hazards flow into **JSAs**. When a high-risk job is planned, the open hazards in the same area are pulled in.

**Modules:** Hazards, Incidents, JSA.

---

### Problem 7 — "High-risk jobs start without a written plan."

**The pain.**
A team is about to clean a chemical tank. A confined space. The wrong gloves. No oxygen meter.

The team-lead says: "we have done this before." They start.

Five minutes in, one worker feels dizzy.

**Why it matters.**
A **JSA (Job Safety Analysis)** is the difference between "we did the job safely" and "we hoped the job would be safe." OSHA cites missing JSAs as a top finding in serious-injury reviews.

**How we solve it.**

- A **JSA module** with a wizard:
  1. Name the job + add the assets used.
  2. Break the job into steps.
  3. For each step: list the hazards + the controls (engineering, administrative, PPE).
- Argus suggests hazards and controls for each step. The crew must tick an **"I have reviewed these"** checkbox before they can accept. PPE-only output flashes an ISO 45001 §8.1.2 warning — PPE alone is not a control.
- Every JSA has a **creator** and an **approver**. They must be different people. Same rule as CAPA. Enforced at the DB + server + UI.
- The crew signs the JSA before work starts. The signoff is saved.
- A JSA expires (12 months by default). The system reminds the team before it expires.
- A JSA can be linked to incidents — so when something goes wrong, the JSA that was in force is traceable.

**Modules:** JSA, Hazards, Resources/Assets, Argus.

---

### Problem 8 — "Inspections are paper checklists with no audit trail."

**The pain.**
The fire-extinguisher check is on paper. The paper is on a clipboard. The clipboard is on a shelf.

- Nobody knows which extinguisher was checked last month.
- The form is initialed but not signed.
- The "OK" tick is the only field. There is no photo. There is no problem description.

When a fire happens and the extinguisher is empty, the paper trail is silent.

**Why it matters.**
A **template** is the difference between "we inspect things" and "we have evidence we inspect things." Auditors want evidence. Regulators want evidence.

**How we solve it.**

- A **Template** builder. Versioned. Each template can be edited; in-flight inspections **snapshot the version** so mid-cycle edits never silently rewrite history.
- A **library** of system presets: forklift daily, ergonomic, fire-extinguisher monthly, electrical, food-safety, and more. One-click import into the org.
- Template **assignments** schedule inspections per site (or all sites) on a cron string with a local start time, honoring site-hierarchy access.
- A mobile **inspection runner** with photo + signature upload, structured questions, and required-field guards before complete. Autosave throughout.
- Failed answers create **findings**. A finding can become an **incident** in one click — the wizard pre-fills from the finding.
- Each inspection lives on the **Planner** with its due date. Each completed inspection shows on the asset's history.

**Modules:** Templates, Inspections, Resources/Assets, Planner.

---

### Problem 9 — "Safety lessons never reach the rest of the org."

**The pain.**
A forklift incident at Houston teaches the team to slow down at Bay 4.

- The Houston team learns the lesson.
- The Detroit team does not.
- The Manchester team does not.

Six months later, the same incident happens at Detroit. The lesson was learned. It was just never shared.

**Why it matters.**
A safety lesson is only valuable if it travels. The first time something happens, you learn. The second time the **same** thing happens at a different site, you failed to spread the lesson.

**How we solve it.**

- A **Safety Bulletin** module. Anyone with the right permission can publish a short note from an incident, a CAPA, or a near-miss.
- A bulletin targets one site, a list of sites, or the whole org.
- Each recipient must **acknowledge**. The dashboard shows the acknowledgment rate.
- Bulletins live alongside the document library, so they show up in search and audit reviews.

**Modules:** Bulletins, Resources/Documents, Dashboard.

---

### Problem 10 — "The same information lives in many places."

**The pain.**
A new safety manager joins the company. She asks:

- "How many open incidents do we have?"
- "What inspections are overdue?"
- "Which CAPAs are late?"
- "Where is the SDS for the new degreaser?"

The answer is the same every time: "Let me ask three people and get back to you."

**Why it matters.**
Time spent looking for data is time not spent reducing risk.

**How we solve it.**

- One **org dashboard** at `/dashboard`: KPIs, trend charts, severity donut, sites map, module cards (Incidents · Inspections · Hazards · JSA · CAPA · Investigations), Quick actions row, Argus insight tiles.
- One **per-site dashboard** at `/sites/[id]` with the same shape, scoped to one site.
- One **Planner** that aggregates 7 event sources: incidents, inspections started + completed, CAPA due dates, asset PM dates, investigation deadlines, regulatory deadlines.
- One **global search** (⌘K) that fan-outs across 9 entity types — Incidents, Investigations, CAPAs, Inspections, Templates, Assets, Documents, Sites, People — RLS-gated.
- One **Argus** AI copilot that summarizes context, drafts text, suggests classifications, and flags trends — but **never finalizes** an incident, closes a CAPA, or submits a report. Argus is gated by the same RBAC keys as the underlying actions, and every interaction is logged for audit + cost accounting. PII is redacted before any model call.
- One **/settings** for personal preferences (account, notifications, sidebar, theme) and one **/admin** for operations (sites, members, roles, invitations, integrations, site-setup, demo).
- A guided **onboarding** flow (signup → org → first site → invite → industry pathway), and a **Get Started** progress surface that nudges admins through first-run tasks.

**Modules:** Dashboard, Planner, Search, Argus, Settings, Admin, Onboarding.

---

## How the Ten Problems Connect

The ten problems are not separate. They form a **flow**. Some problems live **before** an incident (prevention). Some live **during** an incident (response). Some live **after** an incident (learning + reporting). Some are cross-cutting (they help all of the above).

```
BEFORE                  DURING                       AFTER
(prevention)            (capture → close)            (learning + reporting)
   │                    │                            │
   ▼                    ▼                            ▼
Problem 6   →   Problem 1 → 2 → 3 → 4         →   Problem 9 → 5
"hazards in     "capture"   "classify"             "lessons      "year-end
 someone's      "wizard"    "severity"              travel"       reports
 head"                       ↓ ↑                                   live"
                            Problem 3
                            "investigate"
                             ↓
                            Problem 4
                            "verify"

Problem 7 — JSAs run before any high-risk job
Problem 8 — Inspections run on a schedule, all year
Problem 10 — Search · Dashboard · Planner · Argus · Settings · Admin (cross-cutting)
```

**What happens if we skip a problem?**

| Skip | Result |
|---|---|
| Problem 1 | There is nothing to classify. The data is empty. |
| Problem 2 | The wrong incidents get the wrong attention. |
| Problem 3 | CAPAs only fix symptoms. The same incident comes back. |
| Problem 4 | The CAPA record is fake. 100% closed, 0% fixed. |
| Problem 5 | The regulator finds the gap before we do. |
| Problem 6 | Hazards turn into incidents nobody saw coming. |
| Problem 7 | High-risk jobs run on luck. |
| Problem 8 | Inspections are clipboards, not evidence. |
| Problem 9 | The same lesson must be re-learned at every site. |
| Problem 10 | The data exists, but nobody can find it. |

The job of this platform: make all ten problems solvable by default.

**Not** ten separate tools that we glue together. **One flow**, where the data from one step becomes the input of the next step. Worker → supervisor → investigator → owner → verifier → regulator. Hazard → JSA → inspection → incident → CAPA → bulletin → report.

---

## What This Document Is Not

This is the product story, **not** the spec. It explains *why*. For *what* and *how*, read these:

| File | What it is |
|---|---|
| `IMS_PLANNING.md` | The master planning document (data model, modules, screens, roadmap). |
| `../docs/SPEC.md` | The locked source of truth (tenancy, RBAC, workflow rules, RLS, enums). |
| `../docs/ui-flow.md` | Page-by-page UI contract. |
| `../docs/design.md` | Visual tokens and component recipes. |
| `../docs/BUILD_STATUS.md` | The shipping log — every PR, schema delta, locked decision. |
| `../CLAUDE.md` | Engineering ground rules for anyone who writes code in this repo. |

**Who should read this file?**

- **Investor or stakeholder** → read this file.
- **Engineer about to write code** → read this file **first**, then read the spec.
