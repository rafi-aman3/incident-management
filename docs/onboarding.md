# EHS Incident Management — Onboarding & First-Run

**Status:** Living document
**Companion docs:** `docs/SPEC.md` · `docs/design.md` · `docs/ui-flow.md` · `PLANNING/IMS_PLANNING.md` §16
**Last updated:** 2026-05-05

This document is the contract for every user's **first 60 seconds** in the system, plus the always-on guidance that follows. In an EHS app, onboarding is not decorative — it's the difference between an incident that gets recorded and one that gets told to the supervisor verbally and forgotten.

**Design philosophy:** the UI itself should be self-explanatory. We rely on **plain labels, helpful tooltips, useful empty states, and focused wizards** — not on guided tour overlays that point arrows at buttons. Workers who only open this app once a year don't want to be lectured by a tutorial; they want to file a report and leave. Tour overlays get skipped instantly anyway.

---

## 1. Goals & non-goals

### Goals
- Every user reaches their **first success** within their role's time-to-success target (§3)
- A site administrator can configure a brand-new tenant in under 30 minutes via the **Site Setup Wizard** (§5)
- Every regulatory term has a one-hover tooltip explanation
- A worker can practice the Report Wizard without polluting real data via **Sandbox Mode** (§8)
- A presenter can fully reset the demo dataset in under 30 seconds (§9.2)

### Non-goals (v1 demo)
- **Guided tour overlays** (the floating "click here" cards) — too easy to skip, condescending, library overhead. The UI must be self-explanatory instead.
- Auto-training trigger when an SOP changes (depends on Document Control module — IMS_PLANNING.md §15.4, deferred)
- Force-acknowledgement workflow that blocks work until SOP is read (deferred)
- Multi-language onboarding copy (English-only for v1)
- Native mobile push for re-onboarding nudges (responsive web only)

---

## 2. Two onboarding patterns

The system uses two patterns. They layer.

| Pattern | When | Lifespan |
|---|---|---|
| **First-login welcome** | A user logs in for the first time | One-time per role; dismiss → never shows again |
| **Always-on help** | Any user, any session | Permanent (tooltips, empty states, help drawer) |

There is **no tour-overlay pattern**. There is **no proactive nudge pattern**. If a feature is hard to discover, fix the UI — don't bolt a hint on top.

---

## 3. Per-role journeys overview

Five roles, five journeys, five **first-success** definitions.

| Role | First success | Time-to-success target |
|---|---|---|
| **Site Administrator** | Configure site, add 5 users, send first invite (via Site Setup Wizard) | < 30 min |
| **Shop-floor Worker** | Submit one real (or sandbox) incident | < 3 min |
| **Supervisor** | Triage one incident (assign / escalate / close) | < 5 min |
| **EHS Manager** | Open an investigation, run 5-Why, assign a CAPA | < 15 min |
| **Independent Verifier** | Verify and close one CAPA | < 5 min |

Each role gets exactly **one welcome card** on first login. After dismiss, the system gets out of the way.

---

## 4. State model

Onboarding state lives on `profiles` and on the `sites` row. The model intentionally stores **what the user has seen / completed**, not "what's next" — derive next-step from current state.

### 4.1 `profiles` columns
```
profiles
└── seen_welcome   boolean   default false   -- dismissed the role welcome card
```

### 4.2 `sites` columns
```
sites
├── setup_completed_at   timestamptz nullable      -- admin finished the setup wizard
└── setup_progress       jsonb default '{}'        -- per-step completion {step1:true, step2:true, ...}
```

### 4.3 `incidents` columns
```
incidents
└── is_sandbox    boolean   default false   -- practice submission, hidden from KPIs / dashboards
```

### 4.4 New table: `notification_recipients`
```
notification_recipients
├── id                       uuid PK
├── site_id                  uuid REFERENCES sites
├── notification_kind        notification_kind
├── recipient_profile_id     uuid REFERENCES profiles  (nullable)
├── external_email           text                       (nullable)
├── created_at               timestamptz
└── CHECK (recipient_profile_id IS NOT NULL OR external_email IS NOT NULL)
```
Configured in admin Site Setup Wizard Step 6.

### 4.5 Derived states (no DB column needed)
- "Show welcome card?" → `profile.seen_welcome === false` AND user is logged in
- "Show site setup wizard?" → user is `site_admin` AND `site.setup_completed_at IS NULL`
- "Show verifier welcome?" → `profile.seen_welcome === false` AND user has at least one CAPA where `verifier_id = uid AND status = 'pending_verification'`

---

## 5. Site Administrator — Setup Wizard

This is the **one real wizard** in onboarding (Report Wizard is the other, but it's incident-flow not onboarding). A site admin landing on a tenant with `setup_completed_at IS NULL` is routed to `/admin/site-setup` instead of `/dashboard`. The wizard has 7 small steps; each is one decision; admin can save & resume at any time. Each step writes to `sites.setup_progress` so progress is visible and recoverable.

### 5.1 Wizard chrome
- Top: progress bar (7 dots, current highlighted in brand purple `#735CDD`, completed in success green `#16A34A`)
- Left: step list with check marks
- Right: form panel (one step at a time)
- Footer: Back · Save & exit · Save & continue

### 5.2 Step 1 — Site basics

- **Route:** `/admin/site-setup/1`
- **Fields:** name (text), address (textarea), country (select: US/GB), timezone (auto-detected from country, editable)
- **Why:** drives time-zone-aware deadlines (CAPA overdue check at site-local midnight) and the regulator default
- **Server action:** `saveSiteStep1()` → upsert site row, mark `setup_progress.step1 = true`

### 5.3 Step 2 — Regulator

- **Route:** `/admin/site-setup/2`
- **Fields:** regulator radio (OSHA / HSE / Both — auto-pre-selected from country in Step 1)
- **Why:** decides which reports show in `/reports` and which notification kinds the routing engine fires
- **UX detail:** US-only sites hide the RIDDOR F2508 card on Reports. GB-only sites hide OSHA cards. "Both" shows all four.

### 5.4 Step 3 — Establishment IDs

- **Route:** `/admin/site-setup/3`
- **Fields (US sites):** OSHA Establishment ID (text, validation: numeric, exactly 8 digits per OSHA spec), NAICS code (text, validation: 6 digits, with a "look up NAICS" link to OSHA's reference)
- **Fields (GB sites):** HSE Establishment Number (optional)
- **Why:** **mandatory for valid 300A / ITA submission**. Without these, the report won't validate.
- **UX detail:** show the OSHA NAICS lookup tool inline; "I'll fill this in later" button allows skipping but flags the site with a warning chip on the dashboard.

### 5.5 Step 4 — Departments and areas

- **Route:** `/admin/site-setup/4`
- **Fields:** repeater of department names (e.g., "Production", "Maintenance", "Logistics"), each with optional list of areas (e.g., Production → "Line 1", "Line 2")
- **Why:** populates the location dropdowns in the Report Wizard Step 1
- **UX detail:** chips-style input. Suggested defaults loaded from a starter list. CSV upload supported (one dept per row, areas comma-separated).

### 5.6 Step 5 — Users

- **Route:** `/admin/site-setup/5`
- **Fields:** invite by email (one row per user: email + name + role select); CSV upload alternative
- **Action:** "Send invites" → triggers Supabase Auth invitation emails (deferred for demo — currently just creates `profiles` rows; emails wired up in Phase 4 polish)
- **Why:** pre-populates the user directory and notification recipients
- **UX detail:** allows skipping with a "I'll do this later" button. Shows a count "0 / 5 invited" and warns at end-of-wizard if 0 users.

### 5.7 Step 6 — Notification recipients

- **Route:** `/admin/site-setup/6`
- **Fields:** for each notification kind (`osha_8hr`, `osha_24hr`, `riddor_immediate`, `riddor_f2508_10d`, `riddor_7day`, `riddor_disease`, `capa_overdue`, `capa_escalated`), pick which users receive in-app + email
- **Why:** **critical** — without recipients, the regulatory clock fires into the void. See SPEC §9.
- **UX detail:** sensible defaults — `osha_8hr` and `riddor_immediate` default to "all users with role `ehs_manager` OR `site_admin`" + a free-text email field for off-system contacts (HSE phone line, OSHA Area Office). Defaults can be overridden per-recipient, per-kind.
- **Server-side validation:** must have at least one recipient (user OR external email) for `osha_8hr` and `riddor_immediate`. Other kinds can be empty (still routed to in-app banner only).

### 5.8 Step 7 — Confirm & launch

- **Route:** `/admin/site-setup/7`
- **Body:** read-only summary of all 6 prior steps + checklist of what's configured ("✅ Site basics · ✅ Regulator · ⚠️ NAICS code skipped · ✅ 4 departments · ✅ 5 users · ✅ Notification recipients")
- **Primary action:** "Launch site" → sets `setup_completed_at = now()`, redirects to `/dashboard`
- **UX detail:** post-launch, the admin lands on a **setup-progress dashboard** (a tile on the regular Dashboard) that shows what's still optional but useful: branding, custom incident categories, custom approval flows, etc. None of these block real use.

### 5.9 Re-running the wizard

The wizard is also accessible from `/admin/site-setup` for an admin to reconfigure or to demo the fresh-tenant story. The route always reads current `sites.setup_progress` and resumes from the next incomplete step. Any step can be re-edited from the **Site Settings** page (§9.6).

---

## 6. Welcome cards (one per role)

Every role except Site Admin sees a single welcome card on first dashboard visit. The card is a centered modal with a backdrop blur (per `docs/design.md` Dialog spec). Dismissing sets `profile.seen_welcome = true` and never shows again.

### 6.1 Worker

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│           👋  Welcome, {{first_name}}                    │
│                                                         │
│   This is where you report any safety event at work.    │
│   Reporting takes about 3 minutes.                      │
│                                                         │
│   Nobody gets in trouble for reporting a near-miss.     │
│   Reporting helps everyone stay safe.                   │
│                                                         │
│   ┌────────────────┐    ┌──────────────────────┐        │
│   │ Try a practice │    │       Got it         │        │
│   │     report     │    │                      │        │
│   └────────────────┘    └──────────────────────┘        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **"Try a practice report"** → `/incidents/new/1?sandbox=true` (sets `is_sandbox=true` on the draft) — see §8
- **"Got it"** → dismisses, sets `profile.seen_welcome = true`, lands on dashboard

### 6.2 Supervisor

```
👋  Welcome, {{first_name}}

You're a supervisor. Your job here:

  • Review incidents reported by your team
  • Override severity if your judgment differs from the auto-classification
  • Triage: Assign, Escalate, or Close

The system will alert you when there's something that needs attention.

[ Got it ]
```

### 6.3 EHS Manager

```
👋  Welcome, {{first_name}}

As EHS Manager, you own the deeper safety work:

  • Lead investigations (5-Why root cause, evidence, findings)
  • Assign Corrective and Preventive Actions (CAPAs)
  • Review regulatory reports (OSHA 300, 300A, 301, RIDDOR F2508)

Regulatory deadlines fire the moment an incident is classified —
not at the end of the investigation. Watch the banner at top of every screen.

[ Got it ]
```

### 6.4 Independent Verifier (contextual — fires on first pending CAPA, not first login)

```
👋  You've been assigned as a verifier

Someone has completed a CAPA and assigned you to verify it works.

Your job:
  • Review the implementation evidence
  • Choose how you verified (inspection / monitoring / audit / re-interview / document review)
  • Decide: Effective · Partially effective · Not effective · Too early to verify

You **cannot** verify a CAPA that you own. The system enforces this.

[ Open the CAPA ]
```

The "Open the CAPA" button deep-links to `/capa/[id]`.

### 6.5 Site Administrator

Site Admin doesn't see a welcome card on first login — they're sent straight to the **Site Setup Wizard** (§5). On wizard completion (Step 7 "Launch site"), they land on the dashboard with no card. The wizard itself is the welcome.

---

## 7. Subsequent logins

After the welcome card has been dismissed:

- The card never reappears (`seen_welcome=true` and the role hasn't changed)
- Empty states are still helpful (see `docs/ui-flow.md` §14)
- Tooltips on regulatory terms still appear on hover (always-on; see §9)
- The help drawer is always available via the "?" icon top-right

If the user's `role` is changed by an admin, `profile.seen_welcome` is reset to `false` so the new-role welcome fires next login. See §11.

---

## 8. Sandbox mode

### 8.1 Why
- Lets workers practice the Report Wizard without polluting the dataset (training, demos, exploration)
- Lets stakeholders interact with the app during a live demo without breaking the seeded narrative

### 8.2 Activation
- From the worker welcome card "Try a practice report" button → `/incidents/new/1?sandbox=true`
- From the wizard Step 1 — toggle in the header: "Practice mode" switch
- From the post-launch dashboard — "Train your team in sandbox mode" link (admin only)

### 8.3 UX in sandbox mode
- **Yellow banner** sticky at top of all wizard pages: "🧪 Practice mode — this report will not be saved permanently."
- **Submit button** label changes from "Submit" to "Submit (practice)"
- On submit, lands on a **modified incident detail** page with a banner: "Practice report — invisible to your team and won't appear on dashboards or reports."
- "Convert to real report" button on practice incident detail (admin/manager only — sets `is_sandbox=false`, requires re-confirming severity)

### 8.4 Visibility rules
- Sandbox incidents are **hidden** from: `/dashboard` activity feed, KPI tiles (TRIR/DART/Severity Rate), `/incidents` list (default; user can toggle "Show practice" filter), `/investigations`, `/capa`, all `/reports/*`
- Sandbox incidents are **visible** in: the worker's "My Reports" tab if they filter `?show_sandbox=true`, the practice-report detail page itself, and admin-only views with a "Sandbox" filter chip
- Severity engine, routing engine, and notification engine all **skip** sandbox incidents — no investigation row created, no notifications fired, no audit entries beyond the practice-mode marker

### 8.5 Cleanup
- Sandbox incidents auto-delete (hard-delete, since they were never real) after **7 days** via daily cron (`/api/cron/sandbox-cleanup`)
- "Delete now" button on the practice incident detail page

### 8.6 Schema
- `incidents.is_sandbox boolean default false` (added to migration 0001)
- All RLS policies on `incidents` add `AND (is_sandbox = false OR reporter_id = auth.uid() OR current_role() IN ('site_admin'))` to enforce visibility rules

---

## 9. Always-on help patterns

These patterns are permanent — they don't dismiss when the user becomes proficient. They're chrome, not training.

### 9.1 Tooltips on regulatory terms

Any regulatory term that a worker or supervisor might not know gets an inline `<InfoIcon>` with a hover tooltip. Implementation: shadcn `Tooltip` primitive, content authored as a single sentence + (optional) "Learn more" link to the help center.

**Tooltip inventory** (canonical list — `lib/constants/tooltips.ts`):

| Term | Where it appears | Tooltip copy |
|---|---|---|
| OSHA recordable | Wizard Step 2, Incident detail, Reports | An injury is OSHA-recordable if it required more than first aid: medical treatment, days away from work, restricted duty, transfer, or loss of consciousness. |
| OSHA 8-hour deadline | Banner, Reports | OSHA must be notified within 8 hours of a workplace fatality. Phone call required. |
| OSHA 24-hour deadline | Banner | OSHA must be notified within 24 hours of an amputation, eye loss, or in-patient hospitalization. |
| RIDDOR specified injury | Wizard Step 2 (UK sites), Reports | Specified injuries under RIDDOR include fractures (except fingers/thumbs/toes), amputations, sight loss, crush injuries, serious burns >10% body, scalping, and others. See HSE INDG453. |
| RIDDOR over-7-day | Banner | An injury causing more than 7 consecutive days of incapacitation must be reported to HSE within 15 days via online F2508. |
| Dangerous occurrence | Wizard Step 1 type card, Routing rules | A RIDDOR-reportable event under Schedule 2 — collapse, explosion, gas escape, electrical short, etc. Always Track A. |
| TRIR | Dashboard, Reports | Total Recordable Incident Rate = (Recordable Cases × 200,000) / Total Hours Worked. Industry-standard lagging indicator. |
| DART | Dashboard, Reports | Days Away, Restricted, or Transferred rate = (DART Cases × 200,000) / Total Hours Worked. |
| Severity Rate | Dashboard, Reports | (Total Lost Workdays × 200,000) / Total Hours Worked. Measures severity, not just frequency. |
| 5×5 risk matrix | Wizard Step 2 | A grid that scores risk by Likelihood (rare → almost certain) × Consequence (insignificant → catastrophic). The cell's color sets severity (S1–S5). |
| Severity S1–S5 | Wizard Step 2, Detail, badges | S1 Critical → S5 Insignificant. Drives investigation depth: S1/S2 → full investigation, S3 → light, S4/S5 → log & close. |
| Track A / B / C | Investigation Kanban, Routing rules | Routing tiers: A = Full investigation, B = Light investigation, C = Log and close. Set automatically by severity + type. |
| 5-Why | Investigation detail | A root-cause method — keep asking "why?" five times to get past surface causes to the underlying root. |
| CAPA | CAPA module | Corrective and Preventive Action — the structured fix for an investigation finding. Includes implementation + independent verification. |
| Owner ≠ Verifier rule | CAPA detail, Verify form | A CAPA's owner cannot close their own CAPA. An independent verifier must confirm the action worked. The database enforces this. |
| Verification result outcomes | Verify CAPA form | Effective (action worked), Partially effective (residual risk, follow-up CAPA created), Not effective (back to in-progress), Too early to verify (set re-verify date). |
| Object/substance (OSHA 301 #17) | Wizard Step 2 (injury), 301 form | The specific object, substance, or environmental factor that directly harmed the employee. Required by OSHA Form 301. |

### 9.2 Empty states

Already cataloged in `docs/ui-flow.md` §14. Onboarding implication: every empty state must be a **helpful starting point**, not a void.

### 9.3 Help center side panel

A "Help" link in the sidebar footer + a "?" icon top-right of every page header opens a side drawer (Sheet) with:
- A short article about the current screen (markdown, ~200 words each)
- Inline GIFs/screenshots where they help (post-demo polish; v1 = text-only)
- Search across all articles
- "Contact support" footer link (deferred — opens mailto for v1)

Articles are seeded as markdown files in `lib/help/articles/*.md` and rendered on the fly. **Per-page help is keyed off the route path** — the drawer auto-loads the article matching `pathname`.

Article inventory (one per major page):
- `/dashboard.md` · `/incidents.md` · `/incidents-new.md` · `/investigations.md` · `/investigation-detail.md` · `/capa.md` · `/capa-detail.md` · `/reports.md` · `/admin-site-setup.md` (10 articles total — small content scope)

### 9.4 Demo affordances (dev/demo only)

Hidden by `process.env.DEMO_MODE !== 'true'` (or NODE_ENV check):

- Login page demo-account chips (one click pre-fills) — already in `ui-flow.md` §2.5
- "Reset demo data" button on `/settings` (admin-only) — calls `pnpm db:seed` programmatically via a server action
- "Skip wizard" button on `/admin/site-setup/1` that calls `markSiteSetupComplete()` and lands on dashboard — for demoing the post-setup state quickly
- "Trigger OSHA 8hr banner" button on `/settings` — fires a fake `osha_8hr` notification for demo storytelling

### 9.5 Site Settings page (`/settings`)

After site setup wizard completes, the admin can revisit settings any time:

- General — name, address, timezone, regulator
- Establishment IDs — OSHA + NAICS / HSE numbers
- Departments & areas — add / edit / archive
- Users — invite, change role, deactivate
- Notification recipients — per-kind picker
- Demo controls (DEMO_MODE only) — Reset data, trigger banner, etc.

Site settings is **not** the wizard re-run — it's a sticky settings page. Wizard re-run is only triggered by `setup_completed_at = NULL` (which an admin can do from `/settings → Reset onboarding`).

---

## 10. Sample / demo data

### 10.1 The seeded dataset

Per `plans/00-foundation.md` task #11, the seed script creates:
- 2 sites (placeholders "Houston" + "Manchester" — see SPEC §15 decisions log) with `setup_completed_at` already set so the demo skips the admin wizard by default
- 4 demo users (worker / supervisor / ehs_manager / site_admin, password `Demo!2026`) with `seen_welcome=false` so welcomes still fire on first login
- ~30 incidents across 12 months for realistic TRIR/DART
- 5 investigations in different Kanban columns
- 8 CAPAs at various lifecycle stages (1 overdue, 1 pending verification, 1 closed, 5 active)
- 2 active OSHA/RIDDOR notifications, 1 resolved
- Activity events for realism
- Notification recipients populated for both sites

All seeded rows have `is_sandbox=false`. Sandbox-mode rows are user-generated during the demo.

### 10.2 Reset

`pnpm db:reset` — wipes all data + re-runs migrations + re-runs seed. **Must complete in <30 seconds** so it can be used between back-to-back demos.

### 10.3 "Sample data load" admin button

For tenants where the admin wants demo data without resetting (e.g., training a new site), a button on `/settings` calls a dedicated `loadSampleData()` server action that inserts the same dataset as the seed but scoped to the current `site_id`. Sample rows are tagged so they can be cleared later via "Clear sample data."

### 10.4 Demoing the fresh-tenant story

To demo the Site Setup Wizard from scratch:
1. Sign in as `admin@demo.local`
2. Go to `/settings → Reset onboarding` → confirms → sets `sites.setup_completed_at = NULL` for the current site
3. Refresh → admin is auto-routed to `/admin/site-setup/1`
4. Walk the 7 steps live
5. After "Launch site" the admin lands on the dashboard with the configured values

Total time: ~5 min. After demo, "Reset demo data" restores everything to seeded state.

---

## 11. Re-onboarding triggers

Onboarding doesn't end at first login. Two triggers re-engage users:

### 11.1 Role change
- If a user's `role` is updated by an admin, set `profile.seen_welcome = false` so the new-role welcome fires next login
- In scope for v1 demo (small change; just resetting one flag on role update)

### 11.2 New feature shipped (deferred to P4)
- When a feature affecting a user's role lands, show a "What's new" card on next login
- Out of scope for v1 demo

### 11.3 SOP version changed (deferred — depends on Document Control)
- Auto-training trigger when SOPs are updated. Force-acknowledgement workflow blocks work until read.
- Depends on Document Control module — out of scope for v1 demo

---

## 12. Schema delta (additions to migration 0001)

```sql
-- profiles additions
ALTER TABLE profiles ADD COLUMN seen_welcome boolean NOT NULL DEFAULT false;

-- sites additions
ALTER TABLE sites ADD COLUMN setup_completed_at timestamptz NULL;
ALTER TABLE sites ADD COLUMN setup_progress jsonb NOT NULL DEFAULT '{}';

-- incidents additions
ALTER TABLE incidents ADD COLUMN is_sandbox boolean NOT NULL DEFAULT false;
CREATE INDEX incidents_sandbox_idx ON incidents(is_sandbox) WHERE is_sandbox = true;

-- New table: notification_recipients (Step 6 of admin wizard)
CREATE TABLE notification_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id uuid NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  notification_kind notification_kind NOT NULL,
  recipient_profile_id uuid REFERENCES profiles(id),
  external_email text,
  CHECK (recipient_profile_id IS NOT NULL OR external_email IS NOT NULL),
  created_at timestamptz DEFAULT now()
);
CREATE INDEX ON notification_recipients(site_id, notification_kind);

-- RLS update: hide sandbox incidents from non-reporter non-admin
-- (added to existing incidents SELECT policy in 0001)
```

The new fields are all backward-compatible defaults — existing seed data lights up correctly without re-seeding.

---

## 13. Build priority

| Priority | Item | Where it lives |
|---|---|---|
| **P0** | Schema delta (above) | `supabase/migrations/0001_init.sql` |
| **P0** | Welcome card component (renders the right copy per role; reads `profile.seen_welcome`) | `components/onboarding/WelcomeCard.tsx` |
| **P0** | `/admin/site-setup` route stub (renders `<EmptyState>` for now) | `app/(app)/admin/site-setup/page.tsx` |
| **P0** | Auto-redirect logic in `(app)/layout.tsx` — admin with `setup_completed_at IS NULL` → `/admin/site-setup` | `app/(app)/layout.tsx` |
| **P1** | Sandbox mode on wizard (banner + `is_sandbox` flag through engine layers) | `components/incident/Wizard.tsx` |
| **P1** | Tooltip component on regulatory terms (top 8 from §9.1) | `components/InfoTooltip.tsx` + `lib/constants/tooltips.ts` |
| **P2** | Help center side panel (text-only articles) | `components/help/HelpDrawer.tsx` + `lib/help/articles/*.md` |
| **P2** | Verifier welcome card trigger (contextual, on first pending CAPA) | `components/onboarding/VerifierWelcome.tsx` |
| **P3** | Admin 7-step Site Setup Wizard (full functionality) | `app/(app)/admin/site-setup/[step]/page.tsx` (7 routes) |
| **P3** | Site settings page `/settings` | `app/(app)/settings/page.tsx` |
| **P3** | "Reset demo data" + "Reset onboarding" + "Trigger OSHA 8hr banner" + "Skip wizard" demo affordances | `lib/actions/demo.ts` |
| **P3** | "Sample data load" admin button | `lib/actions/demo.ts → loadSampleData(siteId)` |
| **P3** | Sandbox auto-cleanup cron (`/api/cron/sandbox-cleanup`) | `app/api/cron/sandbox-cleanup/route.ts` |
| **P3** | Tooltips for the remaining 9 regulatory terms | extend `lib/constants/tooltips.ts` |
| **P4** | Re-onboarding: new feature "What's new" cards | feature flag system |
| **P4** | Re-onboarding: SOP change forced acknowledgement | depends on Document Control module |

---

## 14. Demo presenter notes

When walking the stakeholder demo, here's how onboarding shows off the system:

1. **Open in incognito** → `/login` — show demo-account chips (DEMO_MODE-only affordance)
2. **Click "Worker"** → land on welcome card → "Try a practice report" — show sandbox banner on the wizard. Submit. Show that the practice report doesn't appear on the EHS Manager dashboard.
3. **Open another incognito as Site Admin** → if you want to demo the fresh-tenant story: `/settings → Reset onboarding` → refresh → walk Site Setup Wizard steps 1-7. Otherwise skip and stay on the configured dashboard.
4. **Open as EHS Manager** → see the welcome card → dismiss → land on dashboard → click an incident → run 5-Why → assign CAPA — show `owner ≠ verifier` enforcement in the verifier picker.
5. **Open as Independent Verifier** (= a different EHS Manager profile or a Supervisor) → see contextual verifier welcome card → click "Open the CAPA" → verify with `effective` outcome → show CAPA closes, investigation can close.
6. **Reset demo data** at the end — `/settings → Reset demo data` → demo is fresh for the next stakeholder.

Total time: ~6 minutes. Skip step 3 if stakeholders don't ask about admin setup (most won't — they want the worker → manager arc).

---

## 15. Open questions

- **Welcome card style** — full-screen modal vs centered card with backdrop. **Recommend centered card** with brand-purple-tinted backdrop blur (matches `docs/design.md` Dialog spec).
- **Sandbox visibility for site admin** — should site admin see ALL sandbox incidents (for cleanup), or only their own? **Recommend admin sees all** with a "Sandbox" filter chip on `/incidents`.
- **External email recipients** — Step 6 allows free-text email for off-system contacts. Should we validate they're real / send a confirmation? **For demo: no validation. For production: send confirmation email with opt-out link before adding.**
- **"Skip wizard" demo affordance** — should it commit fake values to all 7 steps, or just set `setup_completed_at = now()` and leave fields empty? **Recommend commit reasonable defaults** so the dashboard renders meaningfully.

---

## 16. Cross-references

- `docs/SPEC.md` — schema fields above land in §10; tooltip terms appear throughout
- `docs/ui-flow.md` — onboarding chrome is layered onto the pages described there; cross-link from §3 (App shell) and §14 (empty states)
- `docs/design.md` — visual specs for welcome card, tooltip, help drawer go in §6 component recipes
- `plans/00-foundation.md` — schema delta added to task #6 (migration); welcome card + sandbox flag added to P0
- `plans/01-reporting-dashboard.md` (TBD) — sandbox banner on wizard, top-8 tooltips
- `plans/02-investigation-capa.md` (TBD) — verifier welcome trigger, help drawer
- `plans/03-reports-polish.md` (TBD) — full admin wizard, settings page, demo affordances
- `PLANNING/IMS_PLANNING.md` §16 — the production-scope onboarding spec our demo is a subset of (heavier than what we ship)
