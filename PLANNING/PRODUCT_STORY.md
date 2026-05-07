# EHS Operations Platform — Product Story

> This file tells the story of **why** we build this app. It also lists **five problems** we want to solve.
>
> Read this file before the spec. The spec answers "what" and "how". This file answers "why".

---

## Words You Need First

Before the story, here are the short words. Read them once. The story will make sense.

- **EHS** = Environment, Health, and Safety. The team that keeps workers safe.
- **Incident** = any safety event at work. A small one or a big one. For example: a fall, a near-miss, a spill.
- **Near-miss** = something almost caused harm, but no one got hurt.
- **Severity** = how serious the event is. We use a number: S1 (very bad) to S5 (very small).
- **Track A / B / C** = the three paths an incident can take.
  - Track A = critical. Must investigate. Tell people now.
  - Track B = standard. Investigate.
  - Track C = small. Just log it and close.
- **Investigation** = the work to find out **why** the incident happened.
- **CAPA** = Corrective and Preventive Action. The fix. What we do so it does not happen again.
- **Verifier** = a different person who checks if the fix really worked.
- **OSHA** = the US government office for workplace safety.
- **RIDDOR** = the UK rule for reporting work injuries.
- **OSHA 300 Log** = a list of all work injuries. The US government wants this list.
- **OSHA 300A** = a yearly summary of the 300 Log.
- **TRIR** = a number that shows how safe a workplace is. Lower is better.
- **Asset** = a thing the company owns. A shelf, a forklift, a machine.

---

## The Story

### Part 1 — A normal Tuesday

It is **09:42 on a Tuesday**. A factory in Houston is busy.

A forklift hits a shelf in the loading area. A box of cleaning chemicals falls. The box breaks. A small puddle is on the floor.

- Nobody is hurt.
- The driver is upset.
- The supervisor is in another aisle.

### Part 2 — The bad story (without our app)

In most workplaces, this is what happens next:

- Someone uses paper towels to clean it up.
- Someone says: "let us clean it up and move on."
- Someone sends a photo on WhatsApp.
- After one week, nobody remembers.

**Six months later**, a forklift hits the same shelf again. But this time:

- The box on top is heavier.
- The chemical is stronger.
- A worker is standing under it.

A worker gets hurt. Why? Because the **first** event was never recorded. Nobody fixed the real problem.

**This is what we want to stop.**

### Part 3 — The good story (with our app)

The supervisor opens our app on her phone. She taps the **Report Incident** button.

She fills three short steps:

1. **Step 1** — What happened? (forklift, shelf, chemical box)
2. **Step 2** — Who and what was there? (driver name, witness names, photo of the spill)
3. **Step 3** — How serious is it? (she uses the 5×5 risk matrix on the screen)

She is finished. It took two minutes.

### Part 4 — What the system does by itself

Now the system does **four jobs** for her. She does not type anything more.

| # | Job | What it means |
|---|---|---|
| 1 | Save the incident as `INC-2026-0142` | The record is in the database from step 1. Even if she stops in the middle, it is saved. |
| 2 | Set the severity | The 5×5 matrix decides. The system picks Track B (standard investigation). |
| 3 | Start the regulatory clock | The clock starts because the matrix says so. Not because someone remembers. |
| 4 | Send notifications | The EHS manager, the site admin, and the on-call investigator get a message. |

### Part 5 — What happens next (the timeline)

Now follow the clock:

#### **At 10:15 (33 minutes after the incident)**

The investigator opens his to-do list. He sees the new task. The names of the witnesses are **already there** — copied from the supervisor's report.

He does not type the names again. He does not wait for an email.

#### **By Friday (3 days later)**

The investigation is finished. The system creates a **CAPA** — a fix. The CAPA is given to the **maintenance lead** (the repair manager).

The CAPA has three tasks:

1. **Replace the broken upright** — the upright is the vertical metal post of the shelf. The forklift broke it.
2. **Check all shelves for damage** — maybe other shelves have damage too.
3. **Train forklift drivers on the new traffic plan** — teach drivers a safer way to drive.

The maintenance lead does the work over two weeks.

#### **Two weeks later — the check**

A **different person** (not the maintenance lead) checks the work. This is an important rule:

> **The person who fixes the problem cannot be the person who checks it.**

The verifier opens the CAPA. He picks one of four answers:

- ✅ `effective` — the fix worked.
- ⚠️ `partially_effective` — the fix worked a little. **The system makes a follow-up CAPA by itself.**
- ❌ `not_effective` — the fix did not work.
- ⏳ `too_early_to_verify` — too soon to know.

#### **The same day (back to Tuesday)**

The incident is **already** in the OSHA 300 Log. Nobody types it in.

#### **At year-end**

The yearly OSHA 300A summary updates the TRIR by itself.

- No Excel file.
- No rush.
- No missed deadline.

### Part 6 — Six months later

A different forklift hits a different shelf. A new incident.

An inspector opens the **asset history** for that shelf. He sees a list:

- 🔴 Three impact events (forklifts hit shelves like this **three times** before).
- 🟡 One CAPA that only worked a little.
- 🟠 One follow-up that is still open.

This is a **pattern**. The same problem keeps coming back.

Before our app, this pattern was hidden. The information was in many places: emails, paper files, people's memory.

Now, the inspector can say: "Stop. We need to do something different. **Before** a worker is standing under the next falling box."

### Part 7 — Our goal

> Take every safety event — small or big.
> Turn it into a clear record.
> Turn it into a clear action.
> Turn it into a clear report.
>
> **Make it easy to report. Make it automatic to follow up.**

---

## The Five Problems We Solve

These five problems cover the full app. They go from the worker on the floor to the regulator at year-end. Each problem connects to one or two modules.

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

**Modules:** Incidents, Resources.

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
- A user can override the severity, but the override is saved in a log that nobody can change.
- Notifications go out at **classification**, not at the end. The clock starts when severity is set.

**Modules:** Incidents, Notifications.

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

## How the Five Problems Connect

The five problems are not separate. They form a **chain**. Each problem can only be solved if the one before it is solved first.

```
Capture       Classify        Investigate     Close out       Report
   ▼             ▼                ▼               ▼              ▼
Problem 1  →  Problem 2   →   Problem 3   →   Problem 4   →  Problem 5
"small         "severity        "blame the       "owner          "year-end
 things         depends on       worker"          closed own      rush"
 lost"          who is free"                      CAPA"
   │             │                │                │              │
   └─ Wizard     └─ Workflow      └─ Investig.    └─ CAPA         └─ Reports
      + Assets      engine           5-tab           verify_v1       live OSHA
                    + Notify         + Findings      + 4 outcomes    + RIDDOR
```

**What happens if we skip a problem?**

| Skip | Result |
|---|---|
| Problem 1 | There is nothing to classify. The data is empty. |
| Problem 2 | The wrong incidents get the wrong attention. |
| Problem 3 | CAPAs only fix symptoms. The same incident comes back. |
| Problem 4 | The CAPA record is fake. 100% closed, 0% fixed. |
| Problem 5 | The regulator finds the gap before we do. |

The job of this platform: make all five problems solvable by default.

**Not** five separate tools that we glue together. **One flow**, where the data from one step becomes the input of the next step.

---

## What This Document Is Not

This is the product story, **not** the spec. It explains *why*. For *what* and *how*, read these:

| File | What it is |
|---|---|
| `IMS_PLANNING.md` | The master planning document (data model, modules, screens, roadmap). |
| `../docs/SPEC.md` | The locked source of truth (tenancy, RBAC, workflow rules, RLS, enums). |
| `../docs/ui-flow.md` | Page-by-page UI contract. |
| `../docs/design.md` | Visual tokens and component recipes. |
| `../CLAUDE.md` | Engineering ground rules for anyone who writes code in this repo. |

**Who should read this file?**

- **Investor or stakeholder** → read this file.
- **Engineer about to write code** → read this file **first**, then read the spec.
