# EHS Platform — Spec vs. Current Build Gap Report

**Spec compared:** Worker → Supervisor → EHS Manager → CAPA Owner → Verifier flow you pasted (Track A, S1 incident).
**App tested:** `http://localhost:3001` — EHS Incident Management (`v0.1 · Phase 0`)
**Tested on:** 2026-05-06 with the **Supervisor** demo account (`supervisor@demo.local`); a real S1 incident was filed and accepted as `INC-2026-0035` / `INV-2026-0009`.

Status legend: **✅ implemented**, **🟡 partial**, **❌ missing/broken**.

---

## Stage-by-stage match

### Stage 1 — Worker submits the 3-step wizard

| Spec step | Current build | Status |
|---|---|---|
| Open app, tap **Report** | Sidebar has *Report Incident*, dashboard has *+ Report incident* and *+ Start a report* CTAs. | ✅ |
| 3-step wizard | Steps render: **1 Incident Report → 2 Witnesses & Details → 3 Review & Submit**. | ✅ |
| Submit | `Finalize report` redirects to the new incident detail page; `INC-2026-00xx` and `INV-2026-00xx` are created. | ✅ |

(Caveat: a Worker has to actually be on a site for the wizard to work; the *Site Admin* and *EHS Mgr.* demo accounts have no site assigned and the wizard fails them with `No site selected`. In a fresh environment that would block the spec'd flow for those roles.)

### Stage 2 — System auto-classifies + spins up paperwork

| Spec step | Current build | Status |
|---|---|---|
| Severity = S1 → Track A | Step 2 has a 5×5 likelihood × consequence matrix with the live label *"Selected: Almost Certain × Catastrophic → S1 (Critical)"*. The Review screen shows `Severity: S1 — Critical` and `Track: A — Severity S1 → Track A (matrix default).` Saved on the new incident as `S1 · Critical · Track A`. | ✅ |
| **OSHA 8-hour clock STARTS NOW (§11)** | Review screen says *"Notifications: fired immediately for any applicable regulatory clocks"* and *"Starts the regulatory clock and notifies anyone configured for Track A events at this site"* — but **no 8-hour clock is shown anywhere on the new incident or its investigation**. The only regulatory countdown I saw on any record was the `OSHA 301 due in 2 days` banner on the *seeded* INV-2026-0001 (a 7-day clock under §1904.29(b)(3), not the §1904.39 8-hour clock for fatalities/hospitalizations). The new INV-2026-0009 has **no banner at all**. | 🟡 (the language is there, the visible 8-hour countdown is not) |
| Investigation record auto-created | INV-2026-0009 was created automatically and shown on `/investigations` Kanban → *Pending Assignment* lane. ✅ |  ✅ |
| Notifies **Supervisor** in-app + email + SMS | The reporter (Sam Supervisor) has no in-app notification (bell shows *"All caught up."*). The dashboard does **not** show a *red banner*. There is no observable email/SMS pathway in this build. | ❌ |
| Notifies **EHS Manager** in-app + email + SMS | I cannot read Erin Manager's notifications without logging in as her, but there is no UI affordance for email/SMS configuration anywhere — Settings/Members are still placeholder pages ("coming in Phase 08"). | ❌ |
| OSHA 301 draft created in background | The seeded INV-2026-0001 has an *Open 301 form* button but the route `/reports/osha-301/<incidentId>` returns **404**. The newly created INV-2026-0009 doesn't even surface the banner. So 301 drafting is **not implemented**. | ❌ |

### Stage 3 — Supervisor triages

| Spec step | Current build | Status |
|---|---|---|
| **Red banner on Dashboard** | No red banner. The new S1 just appears as a plain row in *Recent incidents*. | ❌ |
| Open incident | Detail page works; UUID-only URLs (display refs `INC-2026-0035` are not URL-routable). | 🟡 |
| Reviews + (optionally) **overrides severity** (audit-logged) | New incident detail has an **Override severity** button. *Whether the override is audit-logged* I cannot confirm without trying the action — there is no visible audit trail panel on the detail page. | 🟡 |
| Confirms triage → **"Escalate to investigation"** | New incident detail also has an **Escalate** button. But because the investigation is auto-created on submit, "escalate" is effectively redundant — and tapping it is undocumented (no copy explains what it does). | 🟡 |

### Stage 4 — EHS Manager runs the investigation

| Spec step | Current build | Status |
|---|---|---|
| Sees the investigation in **"Pending assignment"** lane | `/investigations` Kanban has the four lanes (*Pending Assignment / In Progress / Awaiting CAPA / Closed*), each with cards showing severity, track, lead avatar, due date, and a drag handle. | ✅ |
| **Drags to "In progress"** | Drag handles render, but I did not test drag-drop end-to-end. (Likely works; not yet verified.) | 🟡 |
| **Assigns self as lead** | The detail page right rail says *"Team — 0 members · No team members yet."* with **no add-lead / assign-self button visible**. The seeded INV-2026-0001 even shows a contradictory `Lead: Erin Manager` on the linked *incident* page while the *investigation* page itself shows zero members. | ❌ |
| Reads pre-filled incident summary | Yes — the *Incident Summary (frozen snapshot)* card is there, including Type/Ref/When/Where/Reporter/Severity/Track/Description and the witness statements carry over. Copy literally says "Statements added at the incident phase carry over here automatically." | ✅ |
| **Adds team members (optional)** | No "Add member" button on the investigation page. | ❌ |
| **Builds 5-Why chain (keyboard-driven, §7.4)** | `?tab=why` renders five numbered Why blocks each with Question + Answer textareas, and the page promises "Each row autosaves 1 second after you stop typing." Whether *keyboard-driven* in the §7.4 sense (tab/enter to advance, jump to root cause, etc.) is implemented is not obvious from the markup. | 🟡 |
| Attaches evidence (photos auto-tagged from incident, SDS auto-attached) | `?tab=evidence` empty state says *"upload photos, maintenance logs, SDS sheets, or PDF reports"* but **there is no upload UI** — no drop zone, no file input, no button. Photos are not auto-carried from the incident. SDS auto-attach is also not visible. | ❌ |
| Writes findings | `?tab=findings` is a single textarea that autosaves. ✅ | ✅ |
| **Clicks "Assign CAPA" → inline form pre-filled from findings** | **No "Assign CAPA" button anywhere on the investigation page** (Summary, 5-Why, Evidence, Findings, or Timeline). Programmatic check confirmed the string "Assign CAPA" does not appear on the page. | ❌ |
| Sets owner + verifier + due date → submit | Not reachable from the investigation. CAPA records *do exist* on `/capa` (seeded), so somewhere an admin can create them, but there is no investigation-driven creation path. | ❌ |

### Stage 5 — CAPA Owner

| Spec step | Current build | Status |
|---|---|---|
| Gets in-app notification + email | Bell stays *"All caught up."* — no notifications fired for any seeded CAPA. | ❌ |
| Opens **"My CAPAs"** | `/capa` has a `Mine 6` tab. ✅ | ✅ |
| Sees the new item at the top | List sorts and shows owner + verifier + progress + due. ✅ | ✅ |
| Does the work | **Clicking any CAPA row navigates to `/capa/<uuid>` which 404s.** There is no detail page for a CAPA, so the Owner cannot open one to do work. | ❌ |
| Marks complete → uploads proof + one-sentence summary | Not reachable (no detail page). | ❌ |

### Stage 6 — Verifier

| Spec step | Current build | Status |
|---|---|---|
| Different person — DB-enforced | Help drawer FAQ states this is enforced at UI/server/RPC/DB layers. The seeded data respects it (Owner = Sam Supervisor, Verifier = Erin Manager on every CAPA). The list view enforces it visually. | ✅ (claim level — actual UI to override is not exposed) |
| Gets notification | None visible. | ❌ |
| Opens **"Pending verification"** lane | `/capa` has a `Pending verification 1` tab — but **clicking it does nothing**: URL doesn't change to `?tab=pending_verification`, table doesn't filter, *Mine* stays highlighted. (Same first-click swallow / non-functional tab behaviour seen on the investigation tabs.) | ❌ |
| **Side-by-side action vs. evidence** | No CAPA detail page exists, so this comparison view does not exist. | ❌ |
| Picks verdict → CAPA closes (or returns to owner) | No verdict UI. (The Help FAQ describes the *"partially effective"* outcome — and CAPA-2026-0010 is seeded as a follow-up to CAPA-2026-0009 to demonstrate it — but there is no UI to *make* the call.) | ❌ |

### Stage 7 — Closure cascade

| Spec step | Current build | Status |
|---|---|---|
| CAPA closed → Investigation can close → Incident can close | Seeded data shows the model works (a CAPA is *Closed*, an investigation is *Awaiting CAPA*, an incident is *Under investigation* — i.e. independent state machines). What's missing is the *user action* to close anything: no Close button on incident detail, no Close button on investigation detail, no Close button on a CAPA (because the CAPA detail doesn't exist). | 🟡 |
| Each close is an independent event (§4.2) | Independent state fields exist (Closed exists as an Incident status, an Investigation lane, and a CAPA status). | ✅ (model) / ❌ (UI to drive it) |
| **Auto-suggests "Create safety bulletin?" on Track A close (§6.4.3)** | No safety-bulletin module visible anywhere in the app. | ❌ |

---

## Summary

| Stage | What works | What's missing |
|---|---|---|
| **1. Worker submits 3-step wizard** | The wizard exists, validates, classifies, persists, and creates an investigation. | Demo accounts without a site cannot use it. |
| **2. Auto-classification + paperwork** | Severity matrix, Track derivation, investigation auto-create. | OSHA 8-hour clock display, in-app/email/SMS notifications, OSHA 301 draft (route 404s). |
| **3. Supervisor triage** | Override-severity & escalate buttons exist on incident detail. | No red banner; audit log not visible; "escalate" does what exactly? |
| **4. EHS Manager runs investigation** | Kanban with four lanes; Summary / 5-Why / Evidence / Findings / Timeline tabs; Findings autosave; pre-filled incident summary + carried-over witness statements. | Assign-self-as-lead, add-team-member, evidence upload, photo auto-tag from incident, SDS auto-attach, **Assign CAPA button**. |
| **5. CAPA Owner** | "Mine" list with progress bars and due dates. | **CAPA detail page (404)**, mark-complete + proof upload. |
| **6. Verifier** | Owner ≠ Verifier rule enforced at the data level. | Notifications, Pending-verification tab filter (click is a no-op), side-by-side review, verdict UI. |
| **7. Closure cascade** | The data model supports independent closes; "partially effective" follow-up CAPA chain is seeded as evidence the rule works. | No close buttons in any UI; no safety-bulletin auto-suggest; safety bulletins module doesn't exist. |

### Net answer to your question

**The current build implements the front of the funnel — the 3-step wizard, the auto-classification, and the investigation Kanban — but the back half of your spec (notifications, evidence handling, the Assign-CAPA inline form, the CAPA owner→verifier loop, the closure cascade, and the safety-bulletin nudge) is largely missing.**

Roughly:

- **~60%** of *Stages 1–2* (the reporting + classification) is built and works end-to-end.
- **~40%** of *Stages 3–4* (Supervisor triage + Investigation work) is visible in the UI; the heaviest gaps are *Assign CAPA*, *evidence upload*, *team/lead assignment*, and the regulatory clocks/notifications.
- **~10%** of *Stages 5–7* (CAPA owner→verifier→close→bulletin) — only the seeded list views and the data-model rule. The actual user actions a CAPA owner or verifier needs are not implemented (CAPA detail page itself 404s).

### Top fixes to land your spec next

1. Build `/capa/<id>` (CAPA detail with mark-complete + proof upload + verifier verdict). Without it Stages 5–6 cannot exist.
2. Add the **Assign CAPA** button on the Investigation Findings tab and pre-fill from the findings textarea.
3. Wire the **OSHA 8-hour clock** + the OSHA 301 draft route (`/reports/osha-301/<id>` is currently a 404) so the regulatory promise the system already makes on the Review screen has somewhere to land.
4. Wire **notifications** (in-app first; email/SMS later) and the Supervisor-dashboard **red banner** for new S1/S2 Track A events.
5. Add **assign-lead / add-team-member** controls on the investigation, plus **evidence upload** (and the auto-tag-from-incident / SDS auto-attach behaviours).
6. Make the **Pending verification** tab on `/capa` actually filter, and fix the dashboard "Open Incidents" KPI so it agrees with the analytics view.
7. Once the closure cascade exists, plug in the **"Create safety bulletin?"** prompt on Track A close.
