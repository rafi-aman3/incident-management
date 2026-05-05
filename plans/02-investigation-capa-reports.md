# Phase 2 — Incidents: investigate → CAPA → reports

**Status:** ready to start (drafted 2026-05-06)
**Goal:** A Track A incident from Phase 1 gets fully RCA'd, has a CAPA assigned and verified by an independent person, and produces correct OSHA 300 / 300A / 301 + RIDDOR F2508 paperwork. The daily overdue cron runs at site-local midnight. The Incidents module is shippable on its own at the end of this phase.
**Estimated duration:** ~2 weeks
**Depends on:** Phase 1 (shipped 2026-05-06, PR #2)

> **What this phase ships of the Incidents module:** investigation Kanban + 5-tab detail (Summary / 5-Why / Evidence / Findings / Timeline), witness statements carrying over from incident phase, OSHA 301 draft banner, CAPA lifecycle (create → in_progress → completed → pending_verification → verified/closed) with all 4 verification outcomes, follow-up CAPA auto-creation, all 4 regulatory reports (OSHA 300 Log, 300A Annual Summary, 301 per-incident, RIDDOR F2508 per-incident) with PDF + ITA-format CSV exports, daily-overdue + sandbox-cleanup crons, supervisor / EHS manager / verifier welcome cards, the remaining 9 regulatory tooltips, the help center side panel, and demo affordances (reset data, trigger banner, load sample data).
>
> **Not in this phase:** Templates, Inspections, Resources (Assets + Documents library UI — thin upload from Phase 1 is enough for incident/investigation/CAPA evidence), Planner. Phases 3–6.

---

## Definition of done

A stakeholder dropping in unannounced after Phase 2 sees:

1. **Investigation Kanban works.** Sign in as `ehs@demo.local` → `/investigations` → 4 columns (Pending Assignment / In Progress / Awaiting CAPA / Closed) with seed data populated. Drag a card between columns → status updates server-side; activity event written. View toggle to `?view=list` renders the same data as a sortable table. Filters (lead, severity, site, date range) drive `?` URL state. Cards show ref code, title, severity badge, lead avatar, due-date chip (yellow ≤ 3 days, red overdue).
2. **Investigation detail runs end-to-end.** Click a card → `/investigations/[id]` → 5 tabs render. Summary tab shows the frozen incident snapshot + team list. 5-Why tab autosaves each row at 1s debounce; Why-5 row has a **ROOT CAUSE** badge. Evidence tab supports drag-drop to upload to the `investigation-evidence` Storage bucket; thumbnails render. Findings tab autosaves rich text. Timeline tab shows reverse-chrono `activity_events`. OSHA 301 draft banner sticky-mounts when the source incident is OSHA-recordable.
3. **Witness statements carry over from incident phase.** A witness statement added during Phase 1's incident wizard (or via the incident-detail page) is visible on the investigation detail page in a "Witness Statements" sub-section without re-keying. Adding a new statement on the investigation page also writes to the same `witnesses` table and is visible on the incident detail.
4. **Investigation close paths work.**
   - "Close — no CAPA" sets `closed_at`, writes `incident.investigation_closed` activity event, returns to `/investigations`.
   - "Assign CAPA" opens the CAPA-create modal pre-filled with the investigation context; on submit, creates the CAPA (status=`created`) AND closes the investigation (status=`closed`, `closed_at` set).
5. **CAPA list works.** Sign in as `worker@demo.local` (assigned as CAPA owner in seed) → `/capa` → KPI strip shows Active / Pending Verification / Overdue / Closed counts. Tabs for `?tab=mine | active | pending_verification | overdue | closed | all` filter the table. "+ New CAPA" is visible only to EHS Manager+ per `can('capa:create')`.
6. **CAPA lifecycle runs end-to-end.** Sign in as the CAPA owner → `/capa/[id]` → progress slider updates `progress_pct` (auto-promotes status from `created` → `in_progress` on first update). "Mark complete" sets status=`pending_verification`. Verification form is **hidden** when viewer is the owner — even if they manually navigate, the server action rejects. Sign in as the verifier → verification form renders → submit each of the 4 outcomes:
   - **`effective`** → status=`verified`, then `closed`; `verified_at` and `closed_at` set.
   - **`partially_effective`** → status=`verified` then `closed` AND a new follow-up CAPA row exists in `created`, linked via `follow_up_capa_id`.
   - **`not_effective`** → status reverts to `in_progress`, `rejection_reason` populated.
   - **`too_early_to_verify`** → status stays `pending_verification`, `re_verify_at` set.
7. **CAPA owner ≠ verifier enforced at all 3 layers.** UI hides the verification form for the owner. Server action rejects with `{ ok: false, error: 'forbidden' }` if the session user is the owner. The DB CHECK constraint (already shipped in Phase 0) rejects any direct `UPDATE capas SET verifier_id = owner_id` from the SQL editor.
8. **OSHA 300 Log renders.** Sign in as EHS Manager on a US site → `/reports/osha-300?year=2026` → 13 columns A–M render with seed-data rows (recordable cases only, sandbox excluded). Month filter narrows the table. "Export PDF" streams a paper-format PDF; "Export CSV" streams the ITA-format CSV. "Submit to ITA" opens a guidance modal with the OSHA ITA URL + the same CSV download.
9. **OSHA 300A Annual Summary renders.** `/reports/osha-300a?year=2026` → counts grid (total cases / days-away / restriction or transfer / other recordable / total days away / total days restricted), 6 injury-type counts, manual annual-hours input (persists to `site_annual_hours`), computed TRIR / DART / Severity Rate. Print / Export PDF works.
10. **OSHA 301 per-incident report renders.** `/reports/osha-301/[incidentId]` → 18 fields pre-filled from `incidents` + `injured_persons` + `witnesses`. Inline edits save back to source rows. "Generate PDF" downloads.
11. **RIDDOR F2508 renders for UK incidents only.** `/reports/riddor-f2508/[incidentId]` → form pre-filled with HSE-specific fields. The HSE Notification Record card lets EHS managers record phone-call timestamp + caller + HSE phone reference + written-submission timestamp + RIDDOR online reference (writes `hse_notification_records` row). PDF generates. Route returns 404 for non-GB sites.
12. **Daily overdue cron runs.** Vercel Cron hits `/api/cron/daily-overdue` at 23:59 UTC and again at 13:00 UTC (covers most timezones' midnight); the handler iterates sites grouping by `sites.timezone` and only fires for sites whose local clock is at midnight. For each overdue CAPA: insert `capa_overdue` notification + email owner. After 3 calendar days late: insert `capa_escalated` notification to the site's `notification_recipients` for kind `capa_escalated` (or fall back to all EHS Managers).
13. **Sandbox auto-cleanup cron runs.** Same cron handler scans `incidents` with `is_sandbox=true AND created_at < now() - interval '7 days'` and soft-deletes them. Cascading FKs handle child rows.
14. **TRIR / DART / Severity Rate compute correctly.** `lib/format/kpi.ts` returns matching numbers on the dashboard KPI strip and the OSHA 300A. Formula matches SPEC §7: `(cases × 200,000) / hours_worked`. Sandbox rows excluded.
15. **Welcome cards show once per role.** First login as supervisor / ehs_manager / a CAPA verifier each renders their dedicated welcome card. Dismiss → `profiles.seen_welcome=true` → never shows again. (Worker card already shipped Phase 1.)
16. **Help center side panel works.** Top-bar `?` icon opens a slide-in `<Sheet>` with role-aware short links (per `docs/onboarding.md` §7).
17. **Remaining 9 regulatory tooltips render.** `<RegTooltip>` placements 9–17 from `docs/onboarding.md` §8 are present (CAPA verifier independence, partial-effectiveness follow-up, OSHA 300 vs 301 distinction, OSHA 300A annual posting window, ITA submission deadline, RIDDOR F2508 immediate vs 10-day vs 15-day, "specified injury" definition, dangerous-occurrence definition, body-map vs description guidance).
18. **Demo affordances visible to site_admin only.** "Reset data" wipes non-seed rows and re-runs the seed; "Trigger banner" inserts a high-priority test notification expiring in 1 hour; "Load sample data" creates a representative Track A incident → investigation → CAPA chain in `pending_verification` so verification can be demoed without a 20-minute setup. All gated on `can('demo:reset')` (a new permission key seeded only on the `site_admin` default role).
19. **`hse_notification_records` UI is wired.** EHS Manager on a UK incident sees the RIDDOR record card (on `/incidents/[id]` and `/reports/riddor-f2508/[id]`); editing populates the row.
20. **`pnpm dev` console is clean** (no React hydration warnings, no `'use cache'` errors on uncached server actions, no Supabase RLS noise, no PDF-renderer SSR warnings).

Phase 2 explicitly does **not** include: Templates, Inspections, Asset registry, Documents library UI (thin attachments + investigation-evidence are enough), Planner, full WCAG 2.2 AA pass, real OSHA ITA API submission, dark-mode UI toggle, or the role-permission editor at `/admin/users` (RBAC tables + resolver shipped Phase 0/1; defaults remain editable via DB / seed).

---

## Task list (ordered)

### A. Schema deltas + RBAC additions

#### 1. Migration: `phase2_site_annual_hours`

```sql
create table site_annual_hours (
  site_id     uuid not null references sites(id) on delete cascade,
  year        smallint not null check (year between 2000 and 2100),
  hours_worked bigint not null check (hours_worked >= 0),
  updated_by  uuid references profiles(id) on delete set null,
  updated_at  timestamptz not null default now(),
  primary key (site_id, year)
);
alter table site_annual_hours enable row level security;
-- RLS: same site visibility as `sites`; UPDATE = ehs_manager+ via can('report:edit_hours', site_id).
```

Rationale: ui-flow §8.15 floats "`sites.annual_hours_<year>` JSONB or similar" — a dedicated child table is cleaner for the OSHA 300A query and lets us track `updated_by` / `updated_at` for audit.

#### 2. Migration: `phase2_capa_lifecycle_rpc`

Atomic `verify_capa_v1(capa_id, result, method, notes, re_verify_at)` Postgres function that:
1. Asserts session user ≠ owner (raises if violated — last-line defense in addition to UI + server action).
2. Branches by `result`:
   - `effective` → set status=`verified`, `verified_at=now()`, then status=`closed`, `closed_at=now()`.
   - `partially_effective` → set status=`verified`/`closed_at` AS ABOVE, plus insert a new CAPA row (type+title+description copied, owner=current owner, verifier=null, status=`created`), update parent's `follow_up_capa_id` to the new row's id.
   - `not_effective` → set status=`in_progress`, `rejection_reason=notes`, clear `completed_at`.
   - `too_early_to_verify` → status stays `pending_verification`, `re_verify_at=$5`.
3. Inserts an `activity_events` row (`capa.verified`, `capa.partially_effective`, `capa.rejected`, `capa.deferred`).

Wrapping in an RPC — same pattern as Phase 1's `classify_incident_v1` — so the partial-effectiveness branch is atomic. Per CLAUDE.md hard rule, this is workflow logic called from a Server Action, **not** a DB trigger; the RPC is just the transaction boundary.

#### 3. Migration: `phase2_report_permissions_seed`

Seed permission keys + grants:
- `report:view` → all 4 default roles
- `report:export` → `supervisor`, `ehs_manager`, `site_admin`
- `report:edit_hours` → `ehs_manager`, `site_admin` (annual-hours input on 300A)
- `capa:reassign_verifier` → `ehs_manager`, `site_admin`
- `notification:hse_record_edit` → `ehs_manager`, `site_admin`
- `demo:reset` → `site_admin` only (gates the 3 demo affordances)

Add the keys to `lib/rbac/permissions.ts` const enum.

#### 4. Migration: `phase2_investigation_due_date_backfill`

If Phase 1's `finalizeIncident` did not set `investigations.due_date` (verify on the existing seed rows), patch it:
```sql
update investigations
   set due_date = (
     case (select track from incidents where id = investigations.incident_id)
       when 'A' then (started_at::date + interval '14 days')::date
       when 'B' then (started_at::date + interval '7 days')::date
     end)
 where due_date is null;
```
And update `lib/workflow/finalizeIncident.ts` to set `due_date` going forward (Track A → +14d, Track B → +7d, both from `classified_at`).

### B. Investigation Kanban + 5-tab detail

#### 5. `/investigations` page

Server-rendered Kanban + List toggle. Pulls `investigations_active` joined to `incidents` (for severity badge + title). Per ui-flow §8.9. Filters drive `?lead=&severity=&site=&from=&to=&view=`.

- `<KanbanBoard>` — 4 columns; `@dnd-kit` `<DndContext>` + `<SortableContext>` per column. On drag end → optimistic state update + `advanceInvestigation(id, newStatus)` server action.
- `<InvestigationsList>` — `<DataTable>` view; same row data, sortable by ref code, due date, severity, lead.
- Card chip rules: due-date chip hidden when due_date null; yellow when ≤ 3 days remain; red when overdue (negative or `due_date < today`).

Cache strategy per ui-flow: Kanban is uncached (status changes mid-session); investigation list cached with `cacheTag('investigations:'+siteId)`.

#### 6. `/investigations/[id]` page

5-tab detail. URL state: `?tab=summary|why|evidence|findings|timeline` (default summary). Per ui-flow §8.10. Pulls:
- `investigations_active.findOne(id)`
- `incidents.findOne(investigation.incident_id)` (frozen-snapshot card)
- `investigation_team_members` joined to `profiles`
- `rca_whys` ordered by `level`
- `investigation_evidence`
- `witnesses` joined to the source `incident_id` (witness statements section)
- `activity_events where investigation_id = ? OR incident_id = source_incident.id` (timeline)

##### 6a. Summary tab

- `<IncidentSummaryCard>` — read-only snapshot (ref code, type, severity, classified_at, location, description, reporter, injured persons).
- `<TeamPanel>` — list of investigation_team_members with role labels; "Add member" picker; "Reassign lead" picker (calls `reassignInvestigationLead`).
- `<WitnessStatementsSection>` — reads from `witnesses` (incident-scoped); "Add statement" form writes back to the same table; statements added at incident phase appear here without a write step. Per SPEC §6.4 "statements added at the incident phase carry over to the investigation automatically."
- `<OshaThirtyOneBanner>` — sticky top of detail when `incidents.osha_recordable=true` AND no PDF generated yet; shows `Math.max(0, 7 - daysSince(occurred_at))` countdown; click → `/reports/osha-301/[incidentId]`.

##### 6b. 5-Why tab

- `<FiveWhyChain>` — 5 numbered rows; each row has a question + answer textarea; debounced 1s autosave via `saveWhy(level, question, answer)`. Why-5 has a colored "ROOT CAUSE" badge.
- Optimistic UI on autosave (no loader spinner; tiny "Saved" indicator).

##### 6c. Evidence tab

- `<EvidenceUploader>` — drag-drop zone → signed-URL upload to `investigation-evidence/<investigation_id>/<uuid>-<filename>` → server action `attachEvidence(investigationId, storagePath, fileName, mime, size)` writes the metadata row.
- `<EvidenceGrid>` — thumbnails for images (signed download URL); icon-only cards for non-images.
- Delete button per evidence row (soft-rule: only the uploader or EHS manager+ can delete; enforced via `can('investigation:edit', siteId)` AND uploaded_by check).

##### 6d. Findings tab

- `<FindingsEditor>` — single rich-text-ish textarea (no full TipTap for v1 demo; just a styled `<textarea>` with autosave). Calls `saveFindings(investigationId, content)` debounced 1s.

##### 6e. Timeline tab

- `<ActivityTimeline>` — reverse-chrono list of `activity_events` for this investigation + the source incident. Each row: actor avatar, verb-driven label ("classified incident as S2 Track A", "uploaded evidence — front-of-machine.jpg", "added why-3 answer", "closed investigation"), timestamp.

#### 7. Investigation server actions

All in `app/(app)/investigations/[id]/actions.ts` and `app/(app)/investigations/actions.ts`. Each runs `await require('investigation:edit', siteId)` first (or `'investigation:lead'` for lead-only actions like reassign).

| Action | Effect |
|---|---|
| `advanceInvestigation(id, newStatus)` | Validates transition (`pending_assignment → in_progress → awaiting_capa → closed`); writes `activity_events` |
| `addInvestigationTeamMember(invId, profileId, role)` | Insert into `investigation_team_members` |
| `removeInvestigationTeamMember(invId, profileId)` | Delete from join table; reject if profileId is current lead (must reassign first) |
| `reassignInvestigationLead(invId, newLeadId)` | Update `lead_investigator_id`; update join table role; activity event |
| `saveWhy(invId, level, question, answer)` | Upsert into `rca_whys` (unique key on `investigation_id, level`) |
| `attachEvidence(invId, storagePath, fileName, mime, size)` | Insert into `investigation_evidence` |
| `deleteEvidence(invId, evidenceId)` | Soft-rule check; delete row; storage object delete |
| `saveFindings(invId, content)` | Update `investigations.findings` |
| `addWitnessStatement(incidentId, name, contact, statement)` | Insert into `witnesses` (incident-scoped) |
| `closeInvestigation(invId, withCapa: boolean)` | Set `status='closed'`, `closed_at`; if `withCapa=false`, also bump source incident status if appropriate; activity event |

### C. CAPA list + detail + verification

#### 8. `/capa` page

KPI strip + tab strip + table. Per ui-flow §8.11. Pulls `capas_active` joined to `investigations` + `profiles`. KPI counts run as 4 lightweight queries (or one CTE) per the active site.

- Tab counts visible in tab labels: `Mine (3)`, `Active (12)`, `Pending Verification (4)`, `Overdue (2)`, `Closed (28)`, `All (49)`.
- Filter chips (type, owner, due range) drive `?type=&owner=&from=&to=`.
- "+ New CAPA" button gated `can('capa:create', siteId)`; opens `/capa/new` modal-route (URL-driven).

#### 9. `/capa/[id]` page

60/40 layout per ui-flow §8.12.

##### 9a. Left column

- `<CapaDescriptionCard>` — title, description, type, source investigation link, due date.
- `<CapaProgressSection>` (owner-only edit) — slider 0–100; calls `updateCapaProgress(id, pct)` debounced 500ms; auto-promotes `status='created' → 'in_progress'` on first call.
- `<CapaImplementationEvidence>` (owner-only upload) — same pattern as investigation evidence; uploads to `investigation-evidence` bucket under `capa-<id>/` prefix (or new `capa-evidence` bucket — see Risks).
- `<CompleteCapaButton>` (owner-only when status=`in_progress`) — prompts confirm; calls `completeCapa(id)` → status=`pending_verification`; triggers verifier notification.
- `<VerificationForm>` — **only rendered when** status=`pending_verification` AND viewer ≠ owner. Three-field form:
  - `verification_method` select (5 enum values)
  - `verification_result` radio (4 enum values; renders different help text per option)
  - `notes` textarea (required when `not_effective` — relabel as "Rejection reason")
  - `re_verify_at` date picker (only visible when `too_early_to_verify` selected; required in that branch)
  - "Submit verification" button → `verifyCapa(id, ...)` → calls the `verify_capa_v1` RPC

##### 9b. Right column

- `<SourceInvestigationLink>` — chip linking to `/investigations/[id]`; if no investigation, "(stand-alone CAPA)".
- `<OwnerCard>` / `<VerifierCard>` — avatars + names + emails; "Reassign verifier" button gated `can('capa:reassign_verifier')`.
- `<ActivityTimeline>` — same component as investigation, scoped by `capa_id`.

#### 10. CAPA-create modal

URL-driven at `/investigations/[id]?action=create-capa` (from "Assign CAPA") or `/capa/new` (from list "+ New CAPA"). Per ui-flow §9. Form:
- type (corrective / preventive radio)
- title (required)
- description (required)
- owner (user picker; defaults to source investigation lead if available)
- verifier (user picker; **must ≠ owner — UI blocks the owner row in the verifier picker**)
- due_date (date picker; default = today + 30 days)

Submit calls `createCapa({investigationId?, ...fields})`. From an investigation, also calls `closeInvestigation(invId, withCapa=true)` in the same transaction (server action wraps both in a single RPC `assign_capa_from_investigation_v1`).

#### 11. CAPA server actions

All in `app/(app)/capa/[id]/actions.ts` and `app/(app)/capa/actions.ts`.

| Action | Permission | Effect |
|---|---|---|
| `createCapa(input)` | `capa:create` | Insert; if `investigationId` supplied, runs `assign_capa_from_investigation_v1` RPC |
| `updateCapaProgress(id, pct)` | `capa:update_progress` (= owner only — checked in code, not perm key) | Update `progress_pct`; if `status='created'` → bump to `in_progress` |
| `attachCapaEvidence(id, storagePath, ...)` | owner only | Insert into evidence (CAPA-prefix); activity event |
| `completeCapa(id)` | owner only | Status `in_progress → pending_verification`; `completed_at=now()`; insert verifier-assigned notification |
| `verifyCapa(id, method, result, notes, re_verify_at?)` | `capa:verify` AND `auth.uid() <> owner_id` | Calls `verify_capa_v1` RPC |
| `reassignVerifier(id, newVerifierId)` | `capa:reassign_verifier` | Update `verifier_id` (must ≠ owner); activity event |

### D. Reports module

#### 12. `/reports` landing page

4 cards in 2×2 grid per ui-flow §8.13. Year + Site filter in header. Each card pulls a count query (recordable cases YTD for 300; current calendar year for 300A; same for 301; UK-only count for F2508). RIDDOR card hidden if no GB sites visible to viewer.

#### 13. `/reports/osha-300` page

- Pulls all `incidents_active` joined `injured_persons` where `osha_recordable=true AND occurred_at::year = ? AND site_id IN (...)`.
- Sandbox excluded (`is_sandbox=false`).
- Renders 13-column table A–M; `lib/format/osha300.ts` derives each column from incident + injured_person fields.
- Toolbar: Export PDF → `/api/reports/osha-300/pdf?year=&site=`; Export CSV → `/api/reports/osha-300/csv?year=&site=`; "Submit to ITA" → opens guidance modal with the OSHA ITA URL + the same CSV download link.

#### 14. `/reports/osha-300a` page

- Counts grid + 6-category injury counts (derived from `injured_persons.injury_nature`).
- Annual hours input — reads from `site_annual_hours(site_id, year)`; on edit, calls `updateAnnualHours(siteId, year, hours)` server action gated `can('report:edit_hours', siteId)`.
- TRIR / DART / Severity Rate displayed via `lib/format/kpi.ts` with the count + hours inputs.
- Print-friendly stylesheet (poster-format A4); "Print / Export PDF" → `/api/reports/osha-300a/pdf`.

#### 15. `/reports/osha-301/[incidentId]` page

- 18 fields rendered top-to-bottom matching OSHA Form 301 layout. Field map in `lib/format/osha301.ts`.
- Inline editable; "Save" button calls `updateIncidentReportFields(id, patch)` and `updateInjuredPersonReportFields(id, patch)`.
- "Generate PDF" → `/api/reports/301/[incidentId]/pdf`.
- 7-day deadline countdown chip top-right.

#### 16. `/reports/riddor-f2508/[incidentId]` page

- Server check: 404 if `sites.country !== 'GB'`.
- Pre-filled F2508 fields from incident + injured_person + RIDDOR-specific fields (employment_status, dangerous_occurrence type if applicable, riddor_specified_injury enum).
- `<HseNotificationRecordCard>` — reads/writes `hse_notification_records`:
  - "Mark phone notification recorded" — calls `recordHsePhoneCall(incidentId, hsePhoneRef)`; sets `phone_called_at`, `phoned_by`, `hse_phone_reference`.
  - "Mark online submission recorded" — calls `recordHseOnlineSubmission(incidentId, riddorOnlineRef)`; sets `written_submitted_at`, `riddor_online_reference`.
- "Generate PDF" → `/api/reports/riddor-f2508/[incidentId]/pdf`.

#### 17. PDF + CSV route handlers

`@react-pdf/renderer` for all 4 PDFs. Each PDF lives in `lib/pdf/<form>.tsx` as a React component. Route handlers stream via `new Response(pdfStream, { headers: { 'content-type': 'application/pdf' } })`.

Files:
- `lib/pdf/Osha300LogPdf.tsx` — paper retention format, 13-column landscape
- `lib/pdf/Osha300APdf.tsx` — A4 portrait poster
- `lib/pdf/Osha301Pdf.tsx` — A4 portrait single-incident
- `lib/pdf/RiddorF2508Pdf.tsx` — A4 portrait
- `app/api/reports/osha-300/pdf/route.ts`
- `app/api/reports/osha-300/csv/route.ts` — ITA-format streaming CSV (no PDF dep)
- `app/api/reports/osha-300a/pdf/route.ts`
- `app/api/reports/301/[incidentId]/pdf/route.ts`
- `app/api/reports/riddor-f2508/[incidentId]/pdf/route.ts`

ITA CSV columns: per OSHA ITA spec — establishment_id, naics_code, year + the 300 column data per case. Document the column mapping in `lib/format/itaCsv.ts`.

#### 18. KPI calculator

`lib/format/kpi.ts`:
```ts
export function trir(recordableCases: number, hoursWorked: number): number;
export function dart(dartCases: number, hoursWorked: number): number;
export function severityRate(totalLostWorkdays: number, hoursWorked: number): number;
```
All three formulas use the OSHA 200,000 multiplier per SPEC §7. Returns `null` (rendered as "—") when `hoursWorked` is 0 or null.

Wire into the dashboard KPI strip (replacing Phase 1's "—" placeholders) and the 300A page.

### E. Crons + demo affordances + welcome cards + tooltips + help drawer

#### 19. Daily overdue cron

Vercel Cron config in `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/daily-overdue", "schedule": "59 23 * * *" },
    { "path": "/api/cron/daily-overdue", "schedule": "0 13 * * *" }
  ]
}
```

Two firings cover the 24-hour clock with enough granularity that every site's local midnight gets hit within an hour. The handler:
1. For each site, compute `siteLocalNow = now().setZone(site.timezone)`. Skip unless `siteLocalNow.hour === 0` (midnight bucket).
2. For each CAPA on that site where `status NOT IN ('verified','closed') AND due_date < siteLocalToday`:
   - If no `capa_overdue` notification exists for this CAPA today: insert one (recipient = `capas.owner_id`); enqueue email job (deferred — log a TODO; actual SMTP wiring is out of v1 demo scope).
   - If `due_date < siteLocalToday - interval '3 days'` AND no `capa_escalated` notification exists: insert one (recipient = site's `notification_recipients` for kind `capa_escalated`, fall back to all EHS Managers).

Auth: handler validates `Authorization: Bearer ${process.env.CRON_SECRET}` per Vercel Cron docs.

#### 20. Sandbox auto-cleanup cron

Same handler does:
```sql
update incidents
   set deleted_at = now()
 where is_sandbox = true
   and created_at < now() - interval '7 days'
   and deleted_at is null;
```
Soft-delete; cascading FKs to investigations / capas don't fire on `deleted_at`, but those rows reference the incident and become orphan-but-hidden via existing soft-delete views. Activity event written per row.

#### 21. Demo affordances

`/admin/demo` page (or top-bar utility menu) gated `can('demo:reset', siteId)`:
- **Reset data** — runs `scripts/seed.ts` re-seeding step (idempotent). Server action calls a Postgres function `reset_demo_data_v1(org_id)` that truncates non-foundational rows + reinserts seed rows. Confirmation modal: "This wipes all incidents, investigations, CAPAs, and notifications back to the seed dataset. Continue?"
- **Trigger banner** — inserts a `notifications` row of kind `osha_8hr` with `deadline_at = now() + interval '1 hour'`, recipient = current user. Lets you screencap the regulatory banner.
- **Load sample data** — calls `load_sample_chain_v1()` Postgres function that creates Track A injury → investigation in `awaiting_capa` → CAPA in `pending_verification` (with deliberately non-self verifier) so verification can be demoed in 30 seconds.

#### 22. Welcome cards for supervisor / EHS manager / verifier

Per `docs/onboarding.md` §6.2–6.4. Same `<WelcomeCard>` shell as Phase 1's worker card, role-aware copy + CTA. Gated on `profiles.seen_welcome=false` AND user has the relevant role AS DEFAULT — but: a "verifier" is not a role, it's a function (per CLAUDE.md hard rule), so the verifier welcome card fires the first time a user lands on `/capa/[id]` where they are the assigned verifier and the status is `pending_verification`. This is the one card driven by context, not role.

#### 23. Remaining 9 regulatory tooltips

Placements 9–17 from `docs/onboarding.md` §8. New `<RegTooltip>` mounts in:
- `/capa/[id]` near the verification form heading — "Why an independent verifier?" tooltip
- Verification result radio "Partially effective" — "Auto-creates a follow-up CAPA" tooltip
- `/reports/osha-300` header — "OSHA 300 vs OSHA 301" tooltip
- `/reports/osha-300a` header — "Annual posting window: Feb 1 – Apr 30" tooltip
- `/reports/osha-300a` toolbar — "ITA submission deadline: March 2" tooltip
- `/reports/riddor-f2508/[id]` header — "Immediate phone vs 10-day F2508 vs 15-day over-7-day" tooltip
- Wizard step 2 (injury sub-form) field — "Specified injury — what counts" tooltip
- Wizard step 1 (type picker) — "Dangerous occurrence — definition" tooltip
- Wizard step 2 (injury sub-form) — "Body map vs description guidance" tooltip

#### 24. Help center side panel

`<HelpDrawer>` — top-bar `?` icon opens a slide-in `<Sheet>`. Content per `docs/onboarding.md` §7: role-aware short links + a static FAQ + version + build hash. Closes on Esc / outside click / backdrop click.

### F. Dashboard upgrades + bell upgrades

#### 25. Dashboard KPIs go live

Replace Phase 1's "—" placeholders on `/dashboard` with real TRIR / DART / Severity Rate via `lib/format/kpi.ts`. Tooltip on each explains the formula (these tooltips are part of the "remaining 9" count above).

#### 26. Notification bell rich types

Phase 1's bell renders all `notifications` for the user. Phase 2 adds:
- `capa_overdue` and `capa_escalated` rendering (icon + countdown to "X days overdue")
- Click on a notification deep-links to `/capa/[id]` or `/incidents/[id]` per kind
- "Mark as resolved" affordance (sets `resolved_at`) for `capa_overdue` once verified or `capa_escalated` once acknowledged

---

## File deltas (Phase 2)

### New files

**Migrations**
- `supabase/migrations/<ts>_phase2_site_annual_hours.sql`
- `supabase/migrations/<ts>_phase2_capa_lifecycle_rpc.sql` (`verify_capa_v1`, `assign_capa_from_investigation_v1`)
- `supabase/migrations/<ts>_phase2_report_permissions_seed.sql`
- `supabase/migrations/<ts>_phase2_investigation_due_date_backfill.sql`
- `supabase/migrations/<ts>_phase2_demo_affordance_rpcs.sql` (`reset_demo_data_v1`, `load_sample_chain_v1`)

**Investigations**
- `app/(app)/investigations/page.tsx`
- `app/(app)/investigations/actions.ts`
- `app/(app)/investigations/[id]/page.tsx`
- `app/(app)/investigations/[id]/actions.ts`
- `components/investigations/{KanbanBoard,KanbanColumn,InvestigationCard,InvestigationsList,InvestigationFilters}.tsx`
- `components/investigations/detail/{IncidentSummaryCard,TeamPanel,WitnessStatementsSection,OshaThirtyOneBanner,FiveWhyChain,EvidenceUploader,EvidenceGrid,FindingsEditor,ActivityTimeline}.tsx`
- `components/investigations/modals/{AddTeamMemberModal,ReassignLeadModal,CloseNoCapaModal,AssignCapaModal}.tsx`

**CAPA**
- `app/(app)/capa/page.tsx`
- `app/(app)/capa/actions.ts`
- `app/(app)/capa/[id]/page.tsx`
- `app/(app)/capa/[id]/actions.ts`
- `app/(app)/capa/new/page.tsx` (modal route — URL-driven)
- `components/capa/{CapaList,CapaKpiStrip,CapaTabs,CapaFilters}.tsx`
- `components/capa/detail/{CapaDescriptionCard,CapaProgressSection,CapaImplementationEvidence,CompleteCapaButton,VerificationForm,OwnerCard,VerifierCard,SourceInvestigationLink}.tsx`
- `components/capa/modals/{CapaCreateModal,ReassignVerifierModal}.tsx`

**Reports**
- `app/(app)/reports/page.tsx`
- `app/(app)/reports/osha-300/page.tsx`
- `app/(app)/reports/osha-300a/page.tsx`
- `app/(app)/reports/osha-300a/actions.ts` (annual hours editor)
- `app/(app)/reports/osha-301/[incidentId]/page.tsx`
- `app/(app)/reports/osha-301/[incidentId]/actions.ts`
- `app/(app)/reports/riddor-f2508/[incidentId]/page.tsx`
- `app/(app)/reports/riddor-f2508/[incidentId]/actions.ts`
- `components/reports/{ReportCard,ReportsHeader,Osha300Table,Osha300AGrid,Osha301Form,RiddorF2508Form,HseNotificationRecordCard,IcaSubmissionGuidanceModal}.tsx`
- `lib/format/{kpi,osha300,osha301,riddorF2508,itaCsv}.ts`
- `lib/pdf/{Osha300LogPdf,Osha300APdf,Osha301Pdf,RiddorF2508Pdf}.tsx`
- `app/api/reports/osha-300/pdf/route.ts`
- `app/api/reports/osha-300/csv/route.ts`
- `app/api/reports/osha-300a/pdf/route.ts`
- `app/api/reports/301/[incidentId]/pdf/route.ts`
- `app/api/reports/riddor-f2508/[incidentId]/pdf/route.ts`

**Crons**
- `app/api/cron/daily-overdue/route.ts`
- `vercel.json` (cron schedule entries)

**Demo + onboarding**
- `app/(app)/admin/demo/page.tsx` (or top-bar utility menu component)
- `components/demo/{ResetDataButton,TriggerBannerButton,LoadSampleDataButton}.tsx`
- `components/onboarding/{SupervisorWelcomeCard,EhsManagerWelcomeCard,VerifierWelcomeCard,HelpDrawer}.tsx`

**Tests** (lightweight — engine + reports correctness only)
- `lib/format/__tests__/kpi.test.ts` — TRIR / DART / Severity Rate edge cases (zero hours, null counts, sandbox exclusion)
- `lib/format/__tests__/osha300.test.ts` — column derivation per case type
- `lib/workflow/__tests__/verifyCapa.test.ts` — branch-by-result coverage of all 4 outcomes incl. follow-up CAPA creation

### Modified files

- `lib/workflow/finalizeIncident.ts` — set `investigations.due_date` (Track A → +14d, Track B → +7d)
- `lib/rbac/permissions.ts` — add `report:view`, `report:export`, `report:edit_hours`, `capa:reassign_verifier`, `notification:hse_record_edit`, `demo:reset`
- `lib/supabase/types.ts` — regenerate after migrations
- `components/app-shell/Sidebar.tsx` — add Reports + CAPA nav items (gated by `can('report:view')` / `can('capa:create')`-or-existing-CAPA)
- `components/app-shell/NotificationBell.tsx` — handle `capa_overdue` + `capa_escalated` rendering and deep-link routing
- `components/app-shell/TopBar.tsx` — add `?` icon → opens `<HelpDrawer>`
- `app/(app)/dashboard/page.tsx` — replace KPI placeholders with real `lib/format/kpi.ts` output
- `app/(app)/incidents/[id]/page.tsx` — add `<HseNotificationRecordCard>` for UK incidents
- `scripts/seed.ts` — extend to seed: 5 investigations across 4 statuses, 8 CAPAs across 5 statuses incl. one `partially_effective` (with follow-up), 4 RIDDOR-eligible UK cases, sample annual hours per site, witness statements on 3–4 incidents
- `docs/SPEC.md` §15 — add a Phase 2 decisions-log entry summarizing notable choices (RPC pattern for verify, two-firing cron, demo affordances permission-gated)

### Removed / replaced

- Phase 1's `/dashboard` "TRIR / DART placeholder" copy is replaced by real numbers — delete the placeholder copy
- Phase 1's stub `/investigations`, `/investigations/[id]`, `/capa`, `/capa/[id]`, `/reports*` (if any are still EmptyState pages) are replaced by the real implementations

---

## Risks & unknowns

1. **`@react-pdf/renderer` + Cache Components.** The renderer is React but renders to PDF, not HTML — confirm it works inside a Next 16 route handler with no `'use client'` issues. Pre-flight: write a "hello world" PDF in `/api/reports/test/pdf/route.ts` first; if it works we're good. Backup plan: render PDF in a Node script invoked via `child_process` in the route handler (slower but isolates the renderer).
2. **CAPA evidence bucket — reuse or new.** The simplest path is to reuse `investigation-evidence` with a `capa-<id>/` path prefix, but that couples CAPA evidence visibility to investigation RLS. Cleanest is a third bucket `capa-evidence`. Recommend new bucket for clarity; ~10 lines of migration.
3. **Vercel Cron and site-local midnight precision.** Vercel Cron is UTC-only. Two daily firings (23:59 UTC + 13:00 UTC) cover most timezones' midnight buckets within an hour. For sites in timezones like UTC+13 (very rare), we'd miss by up to 12 hours. Acceptable for v1 demo; document the limitation in SPEC §15.
4. **`verify_capa_v1` partial-effectiveness branch atomicity.** Updating the parent + inserting the follow-up + setting `follow_up_capa_id` is 3 statements. Wrapping in a Postgres function gives us a single transaction. Test the rollback path: if the follow-up insert fails (e.g., RLS rejection), the parent status must NOT have flipped to `closed`.
5. **Witness-statement UI parity.** SPEC §6.4 requires statements added at the incident phase to appear at the investigation phase **without re-key**. The schema is already correct (one `witnesses` table keyed on `incident_id`), but the UI must read from this table on both pages and writes from either page must round-trip. Easy to overlook — explicit smoke test below.
6. **OSHA Form 301 18-field map.** The exact 18 fields and their source rows must come from the official Form 301 PDF. We should not guess. Pull from `docs/EHS_Incident_Forms_Latest.pdf` Chapter 3 (Forms package). Mismatch here = unusable report. Same for RIDDOR F2508 fields — pull from the HSE specimen.
7. **ITA CSV format brittleness.** The OSHA ITA spec changes occasionally. Pin to the 2025 spec for v1; document in code comment with a link. We're not submitting via API in v1, so a wrong column doesn't actively fail — but a stakeholder could spot it.
8. **TRIR sandbox exclusion — also exclude from `incidents` count, NOT just KPI denominator.** Sanity check: a sandbox fatality must contribute zero to TRIR, zero to recordable count on the 300, zero to RIDDOR F2508. The exclusion is at the data layer (`is_sandbox=false` in the `WHERE`), not the formula layer. If we forget this on any one query, sandbox practice incidents pollute regulatory paperwork.
9. **`partially_effective` follow-up loop.** If a follow-up CAPA itself gets verified `partially_effective`, it spawns yet another follow-up. Document and accept; chain is intentional. Add a migration constraint `follow_up_capa_id <> id` (a CAPA can't follow up itself) and lean on UI display to surface the chain ("This CAPA was created as a follow-up to CAPA-2026-0042").
10. **Demo "Reset data" destructiveness.** `reset_demo_data_v1` truncates real per-org data. It must be gated so only `site_admin` on demo orgs can call it (we don't want an admin clicking it on prod data). Add a check on `orgs.is_demo` boolean (new column, default false; demo orgs have it true) at the top of the RPC. Document in the modal: "Demo orgs only."
11. **Investigation due_date backfill timing.** The backfill migration is safe to run on existing seed data only if Phase 1's seed inserted `started_at`. If not, the migration's `started_at::date + interval` will fail silently (NULL + interval = NULL). Verify before running; fall back to using `incidents.classified_at` if `started_at` is null.

---

## Smoke test checklist

- [ ] `pnpm db:push` applies the 5 new migrations cleanly
- [ ] `pnpm db:seed` succeeds; idempotent on second run; investigations + CAPAs + annual hours + witness statements visible
- [ ] `pnpm dev` boots; sign in as each of the 4 demo accounts; new sidebar items render per their permissions
- [ ] **Investigation Kanban:** sign in as ehs_manager → drag a card from Pending Assignment → In Progress; reload → state persisted; activity event written
- [ ] **5-Why autosave:** type into Why-1 → wait 1.5s → reload → answer persisted; ROOT CAUSE badge on Why-5
- [ ] **Evidence upload:** drag-drop a JPG → thumbnail renders → row in `investigation_evidence`
- [ ] **Witness statement round-trip:** add a statement on `/incidents/[id]` → navigate to the investigation → statement visible without refresh; add another on the investigation → visible on incident detail
- [ ] **CAPA owner ≠ verifier — 3 layers:** UI hides verify form for owner; manually navigate as owner → server action rejects; SQL editor `UPDATE capas SET verifier_id=owner_id WHERE id=...` → DB CHECK rejects
- [ ] **CAPA verification — all 4 outcomes:**
  - effective → status closed
  - partially_effective → parent closed AND new CAPA in `created` linked via `follow_up_capa_id`
  - not_effective → status reverts to in_progress, rejection_reason set
  - too_early_to_verify → status stays pending_verification, re_verify_at set
- [ ] **OSHA 300:** seed produces N recordable cases for current year; `/reports/osha-300?year=2026` shows N rows; sandbox cases absent; CSV download opens; ITA columns match spec
- [ ] **OSHA 300A:** counts match the 300 table; TRIR/DART/Severity Rate compute; annual hours editor saves to `site_annual_hours`; PDF downloads
- [ ] **OSHA 301:** open for an injury incident → 18 fields pre-filled; edit field 14 (narrative) → save → reload → persisted; PDF generates
- [ ] **RIDDOR F2508:** open for a UK incident → form pre-fills; "Mark phone notification recorded" writes `hse_notification_records` row; PDF generates; route returns 404 for a US incident
- [ ] **Daily overdue cron:** make a CAPA's `due_date` yesterday → invoke the cron handler manually with `Authorization: Bearer $CRON_SECRET` → `capa_overdue` notification inserted; bell shows it; make `due_date = now() - 4 days` → `capa_escalated` also inserted
- [ ] **Sandbox cleanup:** insert an `is_sandbox=true` incident with `created_at = now() - 8 days` → invoke cron → row soft-deleted; investigation/CAPA chain hidden via soft-delete views
- [ ] **Welcome cards:** sign in fresh as supervisor / ehs_manager → role-specific welcome card → dismiss → reload → not shown; verifier card shows on `/capa/[id]` first visit only
- [ ] **Help drawer:** top-bar `?` opens drawer; role-aware copy renders; Esc closes; restored focus to trigger
- [ ] **9 RegTooltips render** at the placements listed in onboarding.md §8 entries 9–17
- [ ] **Demo affordances:** `site_admin` sees "Reset data", "Trigger banner", "Load sample data"; non-admin doesn't; reset confirms before destroying; trigger banner inserts a 1-hour deadline notification; load sample chain produces a verify-ready CAPA
- [ ] **TRIR/DART live on dashboard:** numbers match the OSHA 300A page for the current year/site
- [ ] `pnpm build` succeeds; `pnpm dev` console clean (no PDF SSR warnings, no React hydration mismatches)
- [ ] All routes return < 500ms on cached cold-cache load with seed data; PDF routes < 2s

---

## Out of scope (defer to later phases or post-v1)

- Templates module, Inspections module, Resources (Assets + Documents library UI), Planner — Phases 3–6
- `/admin/users` role-permission editor UI — post-v1
- Real OSHA ITA API submission — v2 (we ship CSV download + guidance modal only)
- Dark-mode toggle UI — post-v1 (tokens already wired in `docs/design.md`)
- WCAG 2.2 AA full pass — post-v1 (Phase 7 in IMS_PLANNING)
- Customizable per-user notification preferences — post-v1
- Multilingual UI chrome — post-v1 (Phase 14 in IMS_PLANNING)
- Magic-link auth — post-v1
- Real SMTP email delivery — out of v1 demo scope; cron logs the intended email but doesn't send
- Concurrent-edit lock on investigation/CAPA detail pages — last-write-wins for v1 per `docs/ui-flow.md` §16
- Independent-verifier as an explicit `user_role` enum value — v2 (per SPEC §15 entry 2026-05-05)
- Per-type incident child tables (`injury_details`, etc.) — v2 (sparse columns retained per SPEC §15 entry 2026-05-05)
