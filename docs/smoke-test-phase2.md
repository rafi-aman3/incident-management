# Phase 2 — Smoke test guide

A focused walkthrough for verifying Phase 2 end-to-end. Roughly 20 minutes.
The seed already lays down the data each step expects.

## Pre-flight

```bash
pnpm install
pnpm db:push    # applies all 5 Phase 2 migrations
pnpm db:types   # regenerates lib/supabase/types.ts (if needed)
pnpm db:seed    # idempotent — flags is_demo=true on UCB org +
                # backfills injured_persons / witnesses / annual hours /
                # rca_whys / hse_notification_records / partial-effective chain
pnpm dev
```

Open <http://localhost:3000>. Demo accounts (password `Demo!2026` for all):

| Role | Email | Primary site |
|---|---|---|
| Worker | `worker@demo.local` | Houston |
| Supervisor | `supervisor@demo.local` | Houston |
| EHS Manager | `ehs@demo.local` | Houston (also Manchester) |
| Site Admin | `admin@demo.local` | Houston (also Manchester) |

---

## A. Investigation Kanban + 5-tab detail

### A1. `/investigations` Kanban (`ehs@demo.local`)
- [ ] 4 columns render (Pending Assignment / In Progress / Awaiting CAPA / Closed)
- [ ] Cards show ref code, severity badge, lead avatar, due-date chip
- [ ] Drag a card from In Progress → Awaiting CAPA → success toast + state persists
- [ ] Try drag from Closed back to In Progress → toast says transition not allowed
- [ ] View toggle to `?view=list` renders the same data as a sortable table
- [ ] Severity filter chips (S1/S2/S3) narrow both views

### A2. `/investigations/[id]` Summary tab
- [ ] Header shows ref code, status badge, due-date chip, "Assign CAPA" + "Close — no CAPA" buttons
- [ ] Incident summary card has frozen snapshot (open the linked incident to confirm same data)
- [ ] OSHA 301 sticky banner appears for OSHA-recordable incidents (e.g. press 7 hand laceration)
- [ ] Team panel: lead has crown badge + "Lead" pill
- [ ] Witness statements section shows seeded statement
- [ ] Add a new witness statement → reload → it appears
- [ ] Open the source incident — same statement appears there too (round-trip)

### A3. 5-Why tab
- [ ] Pre-filled chain on the in-progress investigation (5 rows)
- [ ] Why-5 has the **ROOT CAUSE** badge with target icon
- [ ] Edit any answer → wait 1.5s → "Saved" indicator → reload → persisted
- [ ] Root cause summary textarea autosaves on the same 1s debounce

### A4. Evidence tab
- [ ] Drag-drop a JPG → "Uploaded 1 file" toast → thumbnail appears
- [ ] Drag-drop a PDF → icon card with file name
- [ ] Hover → trash icon appears on uploaded items → delete works
- [ ] Storage path follows `<investigation_id>/<uuid>.<ext>`

### A5. Findings tab
- [ ] Type into the textarea → "Saving…" → "Saved" → reload → persisted

### A6. Timeline tab
- [ ] Reverse-chrono list of activity events
- [ ] Includes incident.classified, evidence.uploaded, witness.statement_added, etc.

### A7. Close — no CAPA flow
- [ ] Click "Close — no CAPA" → modal confirms → submit
- [ ] Investigation → Closed; redirect to `/investigations`
- [ ] Source incident moves to `closed` if it was `under_investigation`

---

## B. CAPA — list, detail, verification

### B1. `/capa` list (`ehs@demo.local`)
- [ ] KPI strip: Active / Pending Verification / Overdue / Closed counts
- [ ] Tab pills with counts: Mine / Active / Pending Verification / Overdue / Closed / All
- [ ] Overdue tab shows `Update lockout/tagout SOP` (due_date in the past)
- [ ] Pending Verification tab shows `Re-install mill 2 guard` (status = pending_verification)
- [ ] Click "+ New CAPA" → modal opens

### B2. `/capa/[id]` detail
- [ ] Open `Re-install mill 2 guard` (pending_verification)
- [ ] As **owner** (supervisor): verification form is **hidden**, "Awaiting independent verification" callout shown
- [ ] As **verifier** (ehs): verification form renders + verifier welcome card pops up once per session
- [ ] Source investigation link → click → `/investigations/[id]`
- [ ] Owner card has crown icon; verifier card has shield icon + "(independent)" subtitle
- [ ] Reassign verifier modal: owner row excluded from picker

### B3. Progress slider + Mark complete (as owner of `Replace press 7 light curtain`, status=in_progress)
- [ ] Slide progress to 60% → "Saving…" → "Saved"
- [ ] Status auto-promoted from `created` to `in_progress` (status badge confirms)
- [ ] "Mark complete" → modal confirm → submit → status = pending_verification, completed_at set
- [ ] Verifier gets a notification (check the bell on `ehs@demo.local`)

### B4. Verification — all 4 outcomes
For each outcome, sign in as the verifier and submit:

- [ ] **Effective** → CAPA status = closed, verified_at + closed_at set
- [ ] **Partially effective** → CAPA status = closed, follow-up CAPA auto-created, parent's follow_up_capa_id wired. Open the parent → "Verified as partially effective" callout links to the follow-up
- [ ] **Not effective** → CAPA reverts to in_progress, rejection_reason populated, callout shows on description card
- [ ] **Too early to verify** → Status stays pending_verification, re_verify_at set (verify the date input is required)

### B5. Owner ≠ verifier — 4-layer defense
- [ ] UI: form hidden for owner (B2)
- [ ] Server action: even with manual URL navigation, server rejects
- [ ] RPC: verify_capa_v1 raises if auth.uid() === owner_id
- [ ] DB CHECK: `UPDATE capas SET verifier_id = owner_id WHERE id = ?` in SQL editor → CHECK violation

### B6. Assign CAPA from investigation (`ehs@demo.local`)
- [ ] Open an open investigation
- [ ] Click "Assign CAPA" → modal opens with type/title/description/owner/verifier/due_date
- [ ] Verifier picker hides the row matching the selected owner
- [ ] Submit → CAPA created in `created`, investigation closed, incident moved to `awaiting_capa`, redirect to `/capa/[id]`

---

## C. Reports + KPIs

### C1. `/reports` landing
- [ ] 4 cards with YTD counts (300 / 300A / 301 / RIDDOR)
- [ ] RIDDOR card visible (UCB has Manchester GB site)
- [ ] Year picker switches counts

### C2. `/reports/osha-300?year=2026`
- [ ] 13 columns A–M render with seeded recordable cases
- [ ] Sandbox rows excluded (no "(practice)" labels)
- [ ] Month filter narrows the table
- [ ] Establishment ID + NAICS visible at top
- [ ] **Export ITA CSV** → file downloads → open: 16 columns, 2-row header + per-case rows, CRLF line endings

### C3. `/reports/osha-300a?year=2026`
- [ ] 6 count cards (total, days-away, restriction, other, total days away, total restricted)
- [ ] 6 injury-type buckets render
- [ ] Annual hours field shows seeded value (Houston 250000 / Manchester 180000)
- [ ] **TRIR / DART / Severity Rate** all compute (not "—")
- [ ] Edit hours → Save → numbers update
- [ ] Browser-print preview shows poster layout

### C4. `/reports/osha-301/[incidentId]`
- [ ] Open the press 7 hand laceration incident's 301
- [ ] 18 fields grouped employee / physician / case
- [ ] 7-day deadline countdown (recent injury → days remaining; old one → red overdue)
- [ ] Click **Generate PDF** → downloads `osha-301-INC-2026-XXXX.pdf`
- [ ] Open PDF: title block + establishment header + 18 numbered fields

### C5. `/reports/riddor-f2508/[incidentId]` (Manchester fractured wrist)
- [ ] Page renders for GB site
- [ ] 16 fields across 3 groups (incident / person / injury)
- [ ] HSE record card: phone notification recorded (seeded), online F2508 still pending
- [ ] Mark online submission → success toast → card flips to confirmed state
- [ ] **Generate PDF** downloads `riddor-f2508-INC-2026-XXXX.pdf`
- [ ] Try the same URL on a US-incident id → 404

### C6. Dashboard KPIs (`ehs@demo.local`)
- [ ] TRIR + DART show real numbers (matching 300A)
- [ ] Hint text: "{N} recordable / {K}k hr"

---

## D. Crons + demo affordances + bell + welcome cards

### D1. Daily-overdue cron (`/api/cron/daily-overdue`)
```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/daily-overdue
```
- [ ] Returns JSON `{ ok: true, summary: { sitesChecked, sitesAtMidnight, capaOverdueInserted, ... } }`
- [ ] Without the bearer → 401
- [ ] To test the body: temporarily change a site's timezone so its local hour=0, re-hit, watch capa_overdue fire

### D2. Sandbox cleanup
- [ ] Insert a sandbox incident with `created_at = now() - 8 days` via SQL
- [ ] Hit the cron endpoint → row gets `deleted_at` set
- [ ] Reload `/incidents` → sandbox row gone (even with "Show sandbox" toggle)

### D3. `/admin/demo` (`admin@demo.local`)
- [ ] Page accessible (gated `demo:reset`); other roles redirect to /dashboard
- [ ] "Enable demo mode" already done (seed flags is_demo=true) — banner not shown
- [ ] Click **Trigger banner** → success toast; dashboard regulatory banner sticky-mounts within 5s
- [ ] Click **Load sample CAPA chain** → redirects to `/capa/[id]` ready-to-verify
- [ ] Click **Reset demo data** → confirm modal → wipe → all transactional rows gone (re-run `pnpm db:seed` to restore)

### D4. Welcome cards
- [ ] First login as worker → worker welcome card → dismiss → never returns
- [ ] First login as supervisor → role-specific welcome (Open incidents primary CTA) → dismiss → never returns
- [ ] First login as EHS Manager → role-specific welcome (Open Kanban primary CTA)
- [ ] First login as Site Admin → role-specific welcome (Demo affordances primary CTA)
- [ ] Verifier welcome: visit `/capa/[id]` as the assigned verifier of a pending CAPA → dialog appears once per browser session

### D5. Help drawer
- [ ] Top-bar `?` icon opens slide-in panel
- [ ] Role-aware shortcuts (3 entries) match current role
- [ ] FAQ section has 4 entries
- [ ] Esc closes; backdrop click closes; restored focus to trigger

### D6. Notification bell
- [ ] Bell shows kind label pill (OSHA 8h / RIDDOR / F2508 / Overdue / Escalated / Assigned)
- [ ] Kind icons differ per kind (AlertOctagon for OSHA, Flag for RIDDOR, AlertTriangle for capa_overdue/escalated)
- [ ] capa_overdue / capa_escalated rows deep-link to `/capa/[id]`, not `/incidents/[id]`
- [ ] "Mark resolved" form clears the row; reload confirms

---

## E. Tooltips (17 placements total)

The 8 from Phase 1 already documented; the 9 new ones from Phase 2:

- [ ] `/capa/[id]` verification heading → "Why an independent verifier?"
- [ ] `/capa/[id]` partially-effective option → "Auto-creates a follow-up"
- [ ] `/reports/osha-300` title → "OSHA 300 vs 301"
- [ ] `/reports/osha-300a` title → "300A posting window"
- [ ] `/reports/osha-300a` subtitle → "ITA submission deadline"
- [ ] `/reports/osha-300a` "Computed KPIs" label → "TRIR / DART formula"
- [ ] `/reports/riddor-f2508/[id]` title → "RIDDOR deadlines"
- [ ] Wizard Step 1 type-picker → "Dangerous occurrence"
- [ ] Wizard Step 2 body-parts label → "Body map vs description"

---

## F. Build hygiene

```bash
pnpm tsc --noEmit
pnpm next build
```
- [ ] tsc clean
- [ ] Build clean (no errors, all routes compile to ◐ or ƒ)
- [ ] Browser console clean during dev (no React hydration warnings, no Supabase RLS noise)

---

## G. Known limitations (deferred to v2)

- 300 / 300A PDF generation — table view + ITA CSV cover the demo; @react-pdf only ships 301 + F2508
- Real OSHA ITA API submission — we ship CSV download, user uploads via OSHA portal
- 300A digital sign-off — placeholder block, deferred to v1.5
- Multi-injured-person 301 / F2508 — first record only; one form per person is the v2 surface
- Cron timezone precision — twice-daily UTC firings cover most timezones within ~1 hour; UTC+13 may miss midnight by up to 12 hours
- Email fan-out — bell reads notifications by recipient_id; SMTP wiring is v2

---

If anything in sections A–F fails, capture the failing step + a screenshot and we'll triage from there.
