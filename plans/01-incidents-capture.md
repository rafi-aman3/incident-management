# Phase 1 — Incidents: capture → classify → route

**Status:** ready to start (drafted 2026-05-06)
**Goal:** A worker logs in, files an incident through the 3-step Report Wizard, and the system classifies + routes + notifies — entirely automated. A supervisor sees the incident in the list and can run the 4 triage modals. Site setup, RBAC enforcement, and sandbox mode are live.
**Estimated duration:** ~1.5 weeks
**Depends on:** Phase 0 (shipped 2026-05-05, PR #1)

> **What this phase ships of the Incidents module:** capture (wizard) + classification (severity engine) + routing (Track A/B/C) + notifications (regulatory clocks fired at classification) + triage (4 modals on incident detail). **Not in this phase:** investigation Kanban, 5-Why, evidence, CAPA lifecycle, OSHA/RIDDOR PDF reports — those are Phase 2.

---

## Definition of done

A stakeholder dropping in unannounced after Phase 1 sees:

1. **Site setup works.** Sign in as `admin@demo.local` → `/admin/site-setup/1` → 7-step wizard runs end-to-end → `sites.setup_completed_at` is set; re-entry resumes from last incomplete step (`sites.setup_progress` jsonb).
2. **RBAC drives the UI.** Sidebar items for each of the 4 demo accounts are computed via `can(user, perm, siteId)`, not via role-key string matches. Removing a permission from `role_permissions` for `worker.report_incident` instantly hides "Report Incident" from the worker.
3. **Worker reports an incident.** Sign in as `worker@demo.local` → click "Report Incident" → 3-step wizard → submit → land on `/incidents/[id]`. The incident has a real `INC-2026-####` ref code; severity (S1–S5) and track (A/B/C) are auto-filled; `classified_at` is set; if track A/B, an `investigations` row exists in `pending_assignment`; regulatory deadlines are inserted into `notifications` per the type/severity matrix in SPEC §11.
4. **Notifications fire visibly.** Top-bar bell shows unread count; clicking opens dropdown with countdowns to each deadline. If any "high-priority" (OSHA 8h fatality / OSHA 24h amputation / RIDDOR immediate / RIDDOR specified injury) is unresolved, the dashboard regulatory banner is sticky-mounted with a live countdown.
5. **Supervisor triages.** Sign in as `supervisor@demo.local` → `/incidents` list (filters: type, severity, status, occurred_at range) → click a row → `/incidents/[id]` → all 4 modals work end-to-end:
   - **Severity Override** writes a `severity_overrides` row in the same transaction as the `incidents` UPDATE (DB trigger enforces); track and notifications recompute.
   - **Assign Triage Owner** writes an `activity_events` row.
   - **Escalate to Investigation** creates the `investigations` row (if not already) and redirects.
   - **Close (Track C only)** sets `closed_at`.
6. **Sandbox mode works.** Wizard step 1 has a "Practice mode" toggle; turning it on adds a yellow banner through all 3 steps; the resulting incident has `is_sandbox=true`; the dashboard KPI placeholder excludes sandbox rows; supervisor can still see them with a "Show sandbox" toggle.
7. **Thin file upload works.** Wizard step 2 has a "Add photos" affordance; uploads write to the `incident-attachments` Supabase Storage bucket under `<site_id>/<incident_id>/<uuid>.<ext>`; the incident detail page lists thumbnails.
8. **Welcome card shows once.** First login as worker shows the welcome card (per `docs/onboarding.md` §6.1); dismissing sets `profiles.seen_welcome=true`; doesn't show again.
9. **Regulatory tooltips render.** The 8 highest-priority `<RegTooltip>` placements (per `docs/onboarding.md` §8) are present and explain the rule on hover/click.
10. **`pnpm dev` console is clean** (no React hydration warnings, no Next deprecation notices, no Supabase RLS noise).

Phase 1 explicitly does **not** include: investigation Kanban, 5-Why, CAPA lifecycle, reports rendering, daily-overdue cron, demo "reset data" affordance, or sandbox auto-cleanup cron — all Phase 2.

---

## Task list (ordered)

### A. RBAC resolver + permission gates

#### 1. `lib/rbac/resolve.ts`

Per `docs/SPEC.md` §6 + memory `project_rbac_model.md`. Export:

- `resolvePermissions(userId, siteId): Promise<Set<permission_key>>` — unions:
  - role permissions from `role_permissions` joined via `site_members` (filtered by `siteId` or by `include_children=true` walking `parent_site_id`)
  - team permissions from `team_permissions` joined via `team_members` ∩ `team_sites` (filtered by `siteId`)
- Cache per-request via `React.cache()` keyed on `(userId, siteId)` so multiple `can()` calls in one request don't re-query.
- No cross-site leakage: a user with `incident:create` on site A and `incident:close` on site B must not see `incident:close` when querying site A.

#### 2. `lib/auth/can.ts`

Server-only helper:
```ts
export async function can(perm: PermissionKey, siteId: string): Promise<boolean>
export async function require(perm: PermissionKey, siteId: string): Promise<void>  // throws → action result {ok:false, error:'Forbidden'}
```
Reads the user via `requireUser()`, then `resolvePermissions(user.id, siteId).has(perm)`. Use in every Server Action that mutates per-site data.

#### 3. Sidebar/nav swap

Update `components/app-shell/Sidebar.tsx` so each nav item is gated by a `can(perm, currentSiteId)` await. Replace any remaining role-key string matches. Site switcher now also writes `selected_site` cookie used by `can()`.

#### 4. Permission seed

`scripts/seed.ts` already seeds 4 default roles. Extend it to insert `role_permissions` for the standard set per CLAUDE.md (`incident:create`, `incident:classify`, `incident:close`, `member:invite`, `role:edit`, …). Permission keys are system-defined strings; list them in `lib/rbac/permissions.ts` as a const enum so callsites are type-checked.

### B. Site Setup Wizard (`/admin/site-setup/[1..7]`)

Per `docs/onboarding.md` §5. Each step is a server-rendered page with a `react-hook-form` form + `useActionState` server action that updates a single jsonb path on `sites.setup_progress` and advances to the next step. Step 7 sets `sites.setup_completed_at`.

5. **Wizard chrome** — `app/(app)/admin/site-setup/layout.tsx` with progress bar, step list, "Save and exit" affordance.
6. **Step 1: Site basics** — name, timezone, address.
7. **Step 2: Regulator** — country/jurisdiction (US → OSHA, GB → HSE/RIDDOR), `naics_code` if US.
8. **Step 3: Establishment IDs** — `osha_establishment_id` if US.
9. **Step 4: Departments & areas** — list of areas (used in wizard step 1 location picker).
10. **Step 5: Users** — invite by email, assign role + `include_children` flag.
11. **Step 6: Notification recipients** — per-kind picker; writes `notification_recipients` rows. Supports profile pick OR external email; CHECK constraint on the table enforces one-of.
12. **Step 7: Confirm & launch** — review summary, "Launch site" button → sets `setup_completed_at`, redirects to `/dashboard`.

Re-entry rule: if `setup_completed_at IS NULL`, admin pages other than `/admin/site-setup/*` redirect to the wizard's resume step.

### C. Workflow engines (the classification brain)

Each engine is a pure function: takes the incident row + lookups, returns the computed result. **All three are called by `finalizeIncident`, NOT by DB triggers** — per CLAUDE.md hard rule.

13. **`lib/workflow/severity.ts`** — `computeSeverity({probability, impact}): SeverityCode` per the 5×5 matrix in SPEC §10. Returns `'S1'` … `'S5'`.
14. **`lib/workflow/routing.ts`** — `computeTrack({severity, type}): TrackCode` per SPEC §5. S1–S2 → A, S3 → B, S4–S5 → C (with type-specific overrides for `dangerous_occurrence` and `environmental_release`).
15. **`lib/workflow/notifications.ts`** — `computeRegulatoryDeadlines({type, severity, jurisdiction, occurredAt, riddorSpecifiedInjury, dateOfDeath}): RegulatoryDeadline[]` per SPEC §11. Returns the OSHA 8h / 24h, RIDDOR immediate / specified-injury / over-7-day / dangerous-occurrence rows to insert into `notifications`. Site jurisdiction comes from `sites.jurisdiction`.
16. **`lib/workflow/finalizeIncident.ts`** — Server Action used by Wizard step 3:
    1. Update `incidents` row: status `draft → submitted → classified`; set `severity`, `track`, `classified_at`.
    2. If track A/B: insert `investigations` row in `pending_assignment` (default lead = creating user if EHS Manager, else null).
    3. Insert `notifications` rows from the engine output.
    4. Insert `activity_events` row `incident.classified`.
    All in one transaction; rollback on any failure.

### D. Report Wizard (3 steps with draft row)

Per SPEC §6 and ui-flow §8.5–8.7. Wizard owns a draft `incidents` row from step 1 forward (`status='draft'`). Regulatory clock starts at step 3 finalize, NOT at draft save.

17. **`/incidents/new/1`** — what happened. Server action `createDraftIncident(formData)` inserts the draft row, redirects to `/incidents/new/2?id=<uuid>`. Sandbox toggle here.
18. **`/incidents/new/2`** — type-specific form + body map (for injury) + 5×5 risk matrix. 8 sub-forms in `components/wizard/step2/`: `Injury`, `Illness`, `NearMiss`, `PropertyDamage`, `EnvironmentalRelease`, `UnsafeCondition`, `Observation`, `DangerousOccurrence`. Each writes its sparse columns on `incidents` (per SPEC §10's sparse-column decision). Server action `saveStep2(id, formData)`.
19. **`/incidents/new/3`** — review + submit. Server action `submitIncident(id)` calls `finalizeIncident(id)`, redirects to `/incidents/[id]`.
20. **Body map component** — `components/body-map/BodyMap.tsx`. SVG with clickable regions; canonical body-part IDs match OSHA 300 Column E + RIDDOR fields (per IMS_PLANNING §19.5 + Forms Chapter 1). Keyboard alternative: dropdown (per ui-flow §15).
21. **5×5 risk matrix component** — `components/risk-matrix/RiskMatrix.tsx`. 5×5 grid; click a cell to set probability + impact; output is a `SeverityCode` via `computeSeverity()`. Arrow-key navigation between cells.
22. **Wizard sandbox banner** — when `is_sandbox=true`, all 3 steps render a yellow `Banner` reading "Practice mode — this incident won't show up in KPIs or reports."

### E. Incidents list + detail + triage

23. **`/incidents`** — list page. Server-rendered with filters (`?type=`, `?severity=`, `?status=`, occurred_at range), sort (`?sort=&dir=`), pagination (`?page=`). Sandbox rows hidden by default; "Show sandbox" toggle queries with the flag included. Reads `incidents_active` view (auto-filters `deleted_at IS NULL`).
24. **`/incidents/[id]`** — detail page. Sections per ui-flow §8.8: header (ref code, type, severity badge, track badge, status), people (reporter, injured, witnesses), facts (location, occurred_at, description), classification (severity matrix snapshot, regulatory deadlines list), activity timeline.
25. **Triage modals — URL-driven** per ui-flow §9. Each modal is a server-rendered page that overlays `/incidents/[id]` when `?action=...` is present.
    - `?action=override` — Severity Override: `overrideSeverity(id, severity, reason)` writes `severity_overrides` row in same transaction as `incidents.severity` UPDATE (deferred constraint trigger enforces pairing); recomputes track + notifications.
    - `?action=assign` — Assign Triage Owner: `assignTriageOwner(id, ownerId, notes)`.
    - `?action=escalate` — Escalate to Investigation: `escalateToInvestigation(id, leadId, teamIds, dueDate)` creates investigation row if missing.
    - `?action=close` — Close (Track C only): `closeIncident(id, reason)`.

### F. Dashboard + bell + banner + welcomes + tooltips

26. **`/dashboard`** — basic shell per ui-flow §8.3. KPI cards (TRIR/DART are placeholders in Phase 1 — not enough data; show "—" with tooltip explaining), "Report Incident" CTA, "My open items" stub list (will populate as Phase 2 lands).
27. **`<NotificationBell>`** — top-bar; server component reading `notifications` for the current user/site. Shows unread count; click opens a `<DropdownMenu>` with rows. Click a row → `acknowledgeNotification(id)` server action.
28. **`<RegulatoryBanner>`** — sticky banner under topbar; mounts only if at least one `notification` is unresolved AND `kind` is in the high-priority set. Live countdown via client component (re-rendered every minute).
29. **`<WorkerWelcomeCard>`** — first-login per `docs/onboarding.md` §6.1; gated on `profiles.seen_welcome=false`. Dismiss action sets the flag.
30. **`<RegTooltip>`** — `components/RegTooltip.tsx` wrapping a "?" icon. Top-8 placements per `docs/onboarding.md` §8: 5×5 probability + impact axis labels (×2), severity → reportability mapping, OSHA 8h fatality clock, OSHA 24h amputation, RIDDOR specified injury, RIDDOR over-7-day, near-miss vs observation distinction.

### G. Sandbox + thin file upload

31. **Sandbox flag enforcement** — RLS update so `incidents` rows with `is_sandbox=true` are visible to (a) the reporter and (b) `site_admin`. Severity engine, routing engine, notification engine all early-return / no-op for sandbox rows. KPI views exclude sandbox.
32. **Thin file upload** — `incident-attachments` Storage bucket already exists (Phase 0). Add `incident_attachments` table (`id`, `incident_id`, `storage_path`, `uploaded_by`, `mime_type`, `size_bytes`, `created_at`). Wizard step 2 uses a signed-URL upload from the browser → server action `attachToIncident(id, storagePath, ...)` writes the metadata row. Storage RLS keys on path prefix `<site_id>/<incident_id>/`. Full Documents library UI is Phase 5.

---

## File deltas (Phase 1)

### New files

**RBAC**
- `lib/rbac/resolve.ts`
- `lib/rbac/permissions.ts` (const enum of permission keys)
- `lib/auth/can.ts`

**Site Setup Wizard**
- `app/(app)/admin/site-setup/layout.tsx`
- `app/(app)/admin/site-setup/[step]/page.tsx`
- `app/(app)/admin/site-setup/[step]/actions.ts`
- `components/site-setup/{StepNav,StepFooter,RegulatorPicker,DepartmentList,UserInviteList,NotificationRecipientPicker}.tsx`

**Workflow engines**
- `lib/workflow/severity.ts`
- `lib/workflow/routing.ts`
- `lib/workflow/notifications.ts`
- `lib/workflow/finalizeIncident.ts`
- `lib/workflow/__tests__/` (unit tests for the three pure engines — happy path + 5–10 edge cases each; not full coverage, just the regulatory-critical paths)

**Wizard**
- `app/(app)/incidents/new/[step]/page.tsx`
- `app/(app)/incidents/new/[step]/actions.ts`
- `components/wizard/{WizardLayout,WizardProgress,SandboxBanner}.tsx`
- `components/wizard/step1/Step1Form.tsx`
- `components/wizard/step2/{Injury,Illness,NearMiss,PropertyDamage,EnvironmentalRelease,UnsafeCondition,Observation,DangerousOccurrence}.tsx`
- `components/wizard/step3/ReviewForm.tsx`
- `components/body-map/BodyMap.tsx` (+ canonical body-part-id constants)
- `components/risk-matrix/RiskMatrix.tsx`

**Incidents list + detail + triage**
- `app/(app)/incidents/page.tsx`
- `app/(app)/incidents/[id]/page.tsx`
- `app/(app)/incidents/[id]/actions.ts`
- `components/incidents/{IncidentsTable,IncidentFilters,IncidentDetail,ActivityTimeline,SeverityBadge,TrackBadge,StatusBadge}.tsx`
- `components/incidents/modals/{SeverityOverrideModal,AssignTriageModal,EscalateModal,CloseTrackCModal}.tsx`

**Dashboard + bell + banner + welcomes**
- `app/(app)/dashboard/page.tsx` (replaces stub)
- `components/dashboard/{KpiCards,MyOpenItems,ReportIncidentCta}.tsx`
- `components/app-shell/NotificationBell.tsx` (replaces stub)
- `components/app-shell/RegulatoryBanner.tsx`
- `components/onboarding/WorkerWelcomeCard.tsx`
- `components/RegTooltip.tsx`

**Migrations**
- `supabase/migrations/<ts>_phase1_incident_attachments.sql` — `incident_attachments` table + RLS
- `supabase/migrations/<ts>_phase1_role_permissions_seed.sql` — extends `seed_default_roles` to include the standard permission set

### Modified files
- `components/app-shell/Sidebar.tsx` — swap role-key matches for `can()` checks
- `scripts/seed.ts` — seed `role_permissions` for the 4 default roles; seed sample `notification_recipients`; ensure `setup_completed_at` is set on the seed sites so demo accounts skip the wizard
- `lib/supabase/types.ts` — regenerate after migration

---

## Risks & unknowns

1. **`finalizeIncident` is the regulatory-clock atom.** All three engines + investigation row insert + notifications insert + activity event must be one transaction. If any insert fails, the incident must NOT advance to `classified`. Wrap in a Postgres function called from the Server Action so we get atomicity, or use Supabase's `rpc()` pattern. Test the rollback path with a deliberately failing `notifications` insert.
2. **Severity-change deferred trigger interaction with override.** Phase 0 shipped a `BEFORE UPDATE` deferred-constraint trigger requiring a `severity_overrides` row in the same transaction whenever `severity` changes. The Severity Override modal must write the audit row in the same `rpc()` call as the `incidents` UPDATE — not two round-trips. Confirm the trigger fires only on `UPDATE`, not on the initial `INSERT` from `finalizeIncident`.
3. **RBAC resolver is on the hot path.** Every page render and every Server Action calls `can()`. `React.cache()` per-request is essential; without it the sidebar alone fires 5 round-trips. Verify with the Supabase log dashboard during development.
4. **Body-map canonical IDs.** The OSHA 300 Column E + RIDDOR field list must match. Pull from `docs/EHS_Incident_Forms_Latest.pdf` Chapter 1 (Forms package). Get this right in Phase 1 because Phase 2 OSHA 300 generator reads these IDs back out.
5. **Wizard step navigation under Cache Components.** Wizard pages must be uncached (`requireUser()` + draft data is uncached I/O). Confirm no accidental `'use cache'` directive sneaks in.
6. **Sandbox RLS edge case.** A site_admin browsing `/incidents` should see sandbox rows. A worker who didn't report it must not. Test with two worker accounts.
7. **Site Setup Wizard re-entry under partial completion.** If admin closes the browser at step 4, returning to `/admin` must redirect to step 4 — not step 1, not step 7. Drive off `setup_progress.last_completed_step`.
8. **Supabase Storage signed-URL TTL.** Default is 1 hour; for the wizard's "upload then finalize" flow, that's plenty. Don't extend it.

---

## Smoke test checklist

- [ ] `pnpm install` (no new deps in this phase, but verify lockfile clean)
- [ ] `pnpm db:push` applies the two new migrations
- [ ] `pnpm db:seed` succeeds; second run idempotent; `role_permissions` table populated; `setup_completed_at` set on seed sites
- [ ] `pnpm dev` boots; sign in as each of 4 demo accounts; sidebar items match the seeded permission sets
- [ ] **Worker flow:** report an injury (Track A) → confirm severity, track, deadlines on detail page
- [ ] **Worker flow:** report a near-miss in sandbox mode → confirm `is_sandbox=true`; KPI placeholder excludes it
- [ ] **Photo attachment:** upload during wizard step 2; confirm storage path + DB metadata; thumbnail renders on detail page
- [ ] **Notification visibility:** logged in as the user listed in `notification_recipients` for OSHA fatality, file a Track A fatality → bell shows unread, banner sticky-mounts, countdown ticks
- [ ] **Triage modals (4):** override severity (audit row written, track recomputed); assign owner; escalate to investigation (investigation row exists); close Track C
- [ ] **Severity override audit:** attempt `UPDATE incidents SET severity='S1' WHERE id=...` directly via the SQL editor — confirm the deferred trigger rejects it
- [ ] **Site Setup Wizard:** new admin account → wizard runs end-to-end; close at step 4 → re-enter → resumes at step 4
- [ ] **RBAC enforcement:** remove `incident:create` from `worker` role in DB → reload → "Report Incident" disappears from sidebar
- [ ] **Welcome card:** worker first-login shows it; dismiss → never returns
- [ ] **8 RegTooltips render** at the placements in `docs/onboarding.md` §8
- [ ] `pnpm build` succeeds; `pnpm dev` console clean
- [ ] All routes return < 500ms on cached cold-cache load with seed data

---

## Out of scope (defer to Phase 2)

- Investigation Kanban (`/investigations`, `/investigations/[id]`)
- 5-Why builder + evidence collection
- CAPA module (`/capa`, `/capa/[id]`, verification flow)
- OSHA 300 / 300A / 301 + RIDDOR F2508 reports
- TRIR / DART real calculations (Phase 1 shows placeholder dashes)
- Vercel cron for daily overdue check + sandbox auto-cleanup
- Demo "Reset data" + "Trigger banner" + "Load sample data" affordances
- `hse_notification_records` UI (table exists from Phase 0; UI in Phase 2)
- Help center side panel
- Supervisor / EHS Manager / Verifier welcome cards (worker-only here)
- Remaining 9 regulatory tooltips
