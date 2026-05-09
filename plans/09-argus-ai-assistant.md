# Phase 09 — Argus (AI Assistant)

**Status:** scoped 2026-05-10 — replaces the 2026-05-07 stub.
**Goal:** Make Argus a flagship product pillar — a voice-and-text co-pilot that lives on every form, every list, every decision point. Sells the platform as AI-driven while keeping every load-bearing decision in human hands.
**Branch (this plan):** `feat/phase-09-argus-plan`. Sub-phase branches follow `feat/phase-9a-argus-foundation`, etc.
**PR target:** `main`
**Duration:** ~5 sub-phases / ~5 PRs (mirrors the Phase 6 polish split).
**Depends on:** Phases 0–6 + 8 + 11 + 12 + 13 shipped (current main).

---

## Context — why this phase exists

Today the platform has zero AI surfaces. `PLANNING/IMS_PLANNING.md` §17.8 + §2.4.3 declare AI a "permanent non-goal," `docs/SPEC.md` §15 has no AI entry, and the Phase 6b polish plan reserved one teal "Generate with Argus" button slot but nothing was built. The user is reframing the product strategy: **AI is the headline pillar, not a non-goal.** Three concrete asks:

1. **AI Copilot** floating on every form step (Report Wizard especially): tap-mic → describe what you see → Copilot logs the observation, attaches the photo, and can raise a stop-work. Co-pilot, not pilot.
2. **AI Investigator** on Investigation detail: paste the incident description, drop in witness statements as voice notes or text, and Argus produces a timeline + RCA narrative the user approves before it persists.
3. **Inline magic-wands** on every decision surface — severity classification, finding→incident escalation, investigation→CAPA escalation, CAPA verification-method choice — small AI buttons that *suggest*, never *commit*.

Confirmed in the planning session 2026-05-10:

- **Direction inversion is intentional.** Log a `docs/SPEC.md` §15 entry dated 2026-05-10 inverting the IMS_PLANNING non-goal; update memory `project_ims_planning_relationship.md` to record this as the largest active divergence. Keep "assistive only — never auto-classifies severity, auto-routes, or closes CAPAs" as a NEW hard rule in `CLAUDE.md`.
- **Voice = browser Web Speech API** for v1. Free, zero infra, works in Chrome/Safari/Edge, falls back to text input where unsupported.
- **Stop-work = boolean flag on incidents**, not a new entity. Reuses the wizard + notification pipeline.
- **All four scope items ship in Phase 9.0** (Copilot, Investigator, magic-wands, global side panel + dashboard tiles). Splitting into 9a–9e mirrors the Phase 6 PR pattern.

Existing references kept intact: brand purple `#735CDD` for AI-suggested states; cyan `#00D4FF` (held dormant per `docs/design.md` line 489) is now the **Argus accent** for streaming/active states.

---

## Hard rules added this phase (will land in CLAUDE.md)

1. **Argus is assistive, not authoritative.** Every suggestion lands in a human-controllable form field with an accept/edit/reject affordance. Severity, track, CAPA close, OSHA/RIDDOR submit must always carry a named human signature. No tool-use call may finalize an incident, write a report, or close a CAPA.
2. **Every AI suggestion is logged.** `activity_events.actor_kind` becomes a NOT NULL enum (`'human' | 'argus'`); every suggestion writes a row including model, tokens, prompt-cache hit/miss, and the user's accept/edit/reject outcome. Required for audit + cost accounting.
3. **Argus actions resolve through existing RBAC.** A magic-wand that "creates a CAPA" requires the user to hold `capa:create` for that site — no separate `argus:*` permission set. Per-feature gate is `argus:use` (default-on for all four seeded roles), checked once at the panel open.
4. **No auto-classification of severity, auto-routing, or auto-closure of CAPAs**, ever. Carried forward from IMS_PLANNING §2.4.3 — non-negotiable.
5. **PII / regulatory text never leaves the org un-redacted.** Strip injured-person names, witness names, and free-text descriptions of medical specifics before sending to Anthropic. Use a redactor in `lib/argus/redact.ts`. Worker initials + role only.
6. **Cost guardrails are enforced server-side.** Per-org daily token budget (soft warn at 80%, hard cap at 100%); per-user rate limit (10 inline suggestions/min, 3 deep analyses/min). Prompt caching mandatory on system + page-context blocks per the `claude-api` skill defaults.

---

## What ships (Phase 9.0 = 9a → 9e)

| Sub-phase | What ships |
|---|---|
| **9a Foundation** | `@anthropic-ai/sdk` install · env vars · `lib/argus/` library · streaming route handler · schema (`activity_events.actor_kind`, `argus_suggestions`, `incidents.stop_work*`) · RLS · feature flag `argus_enabled` on `orgs` · cost-guardrail middleware · brand tokens (cyan accent live) · empty `<ArgusSidePanel>` shell wired to topbar |
| **9b Copilot** | Floating `<ArgusCopilot>` panel on all three Report Wizard steps · mic via Web Speech API · camera capture (`<input capture="environment">`) · "Log observation," "Attach photo," "Raise stop-work" tool calls · stop-work banner on dashboard until acknowledged · activity-events trail |
| **9c Investigator** | `<ArgusInvestigator>` workspace on `/investigations/[id]` · paste-description + witness voice/text inputs · streamed timeline + RCA narrative draft (Sonnet 4.6) · "Push to investigation" approves and writes 5-Why chain + findings · always behind a Review-and-Edit step |
| **9d Magic wands** | `<ArgusMagicWand>` button used in: Step 3 risk-matrix cell suggestion (Haiku 4.5) · finding→incident escalation severity (Haiku) · investigation→CAPA draft (Sonnet) · CAPA verification-method suggestion (Haiku) · OSHA reportability confidence pane (Sonnet, read-only) |
| **9e Global panel + tiles** | Topbar Argus avatar (right of notification bell) toggles `<ArgusSidePanel>` · page-context aware · 4 dashboard `<ArgusInsightTile>` slots · CAPA Kanban "Overdue cluster" tile · Inspections "Due-soon by hazard" tile · Reports "Reportability uncertain" tile |

Out of Phase 9.0 (deferred to 9.1+): document-OCR auto-classification, asset-PM scheduler, conversation persistence across sessions, multilingual STT, mobile-app voice (we're web-only today), Whisper/Deepgram upgrade.

---

## Architecture

### New library: `lib/argus/`

```
lib/argus/
├── client.ts          # Anthropic SDK singleton (with prompt caching defaults)
├── models.ts          # MODEL_HAIKU = 'claude-haiku-4-5-20251001', MODEL_SONNET, MODEL_OPUS
├── redact.ts          # PII redactor (names, free-text medical → initials/codes)
├── system-prompts/    # one .md per surface: copilot, investigator, severity, capa, etc.
├── tools/             # Anthropic tool-use schemas (log_observation, attach_photo, raise_stop_work, suggest_severity, draft_capa, suggest_method)
├── stream.ts          # SSE helper wrapping Anthropic stream → ReadableStream
├── budget.ts          # per-org token budget check (reads orgs.argus_daily_token_budget, sums today's argus_suggestions)
├── ratelimit.ts       # per-user rate limit (in-memory + Postgres fallback)
├── log.ts             # writes argus_suggestions + activity_events rows
└── voice.ts           # client-side Web Speech API hook factory contracts (impl in components/argus/use-voice.ts)
```

Models per surface (locked at the system-prompt level, not user-configurable in v1):

| Surface | Model | Why |
|---|---|---|
| Inline severity / track / method suggestion | **Haiku 4.5** | Cheap, fast, classifier-style |
| Finding→incident escalation severity | Haiku 4.5 | Same |
| Document type / SDS classifier | Haiku 4.5 | Same |
| RCA narrative + timeline (Investigator) | **Sonnet 4.6** | Long context, reasoning |
| CAPA draft from investigation | Sonnet 4.6 | Same |
| OSHA reportability confidence | Sonnet 4.6 | Cites 29 CFR Appendix A |
| Copilot conversational | **Haiku 4.5** with Sonnet fallback for clarification turns >3 | Cost |
| Opus 4.7 | reserved | Not used in 9.0 |

Tool-use schemas in `lib/argus/tools/` — every tool returns a *suggestion*, not a side-effect. The server action that owns the surface (e.g. `finalizeIncident`) decides whether to apply.

### Streaming pattern

Server Actions can't stream chunked responses cleanly under Cache Components. Use a **route handler** at `app/api/argus/stream/route.tsx` that takes `{ surface, payload }`, runs the Anthropic stream, and returns SSE. Client-side hook `useArgusStream()` consumes it. Per AGENTS.md, route handlers default to nodejs and `export const runtime` is rejected — fits our stack.

### Prompt caching

Per `claude-api` skill: cache system prompt + tool definitions + page-context block (org/site/permissions/recent-events). Refresh page-context every 5 minutes. Expected hit rate >70% on Copilot turns within a single Report Wizard session; this drives the cost story.

### Schema deltas (one migration: `20260510120000_argus_phase_9a.sql`)

```sql
-- 1. activity_events gets actor_kind
ALTER TABLE activity_events
  ADD COLUMN actor_kind text NOT NULL DEFAULT 'human'
    CHECK (actor_kind IN ('human','argus'));

-- 2. orgs get the feature flag + budget
ALTER TABLE orgs
  ADD COLUMN argus_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN argus_daily_token_budget bigint NOT NULL DEFAULT 5000000;  -- ~$15/day at Haiku rates

-- 3. argus_suggestions audit log
CREATE TABLE argus_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  site_id uuid REFERENCES sites(id),
  user_id uuid NOT NULL REFERENCES profiles(id),
  surface text NOT NULL,                 -- 'copilot' | 'investigator' | 'severity' | 'capa_draft' | ...
  target_kind text,                      -- 'incident' | 'investigation' | 'capa' | 'finding' | null
  target_id uuid,
  model text NOT NULL,
  prompt_tokens int NOT NULL,
  completion_tokens int NOT NULL,
  cache_read_tokens int NOT NULL DEFAULT 0,
  cache_create_tokens int NOT NULL DEFAULT 0,
  payload jsonb NOT NULL,
  outcome text CHECK (outcome IN ('pending','accepted','edited','rejected','expired')),
  outcome_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_argus_suggestions_org_day
  ON argus_suggestions (org_id, (created_at::date));
CREATE INDEX idx_argus_suggestions_target
  ON argus_suggestions (target_kind, target_id);

-- 4. stop-work flag on incidents
ALTER TABLE incidents
  ADD COLUMN stop_work boolean NOT NULL DEFAULT false,
  ADD COLUMN stop_work_raised_at timestamptz,
  ADD COLUMN stop_work_raised_by uuid REFERENCES profiles(id),
  ADD COLUMN stop_work_acknowledged_at timestamptz,
  ADD COLUMN stop_work_acknowledged_by uuid REFERENCES profiles(id);
CREATE INDEX idx_incidents_stop_work_active
  ON incidents (org_id, site_id) WHERE stop_work AND stop_work_acknowledged_at IS NULL;
```

### RLS

- `argus_suggestions`: SELECT/INSERT for site members (via `user_can_access_site` SECURITY DEFINER helper per `feedback_avoid_self_referencing_rls`); UPDATE allowed only on the `outcome` columns by the suggestion author within 24h; DELETE revoked from PUBLIC.
- `incidents.stop_work*`: writable by anyone with `incident:create` on the site (raise) and `incident:close` (acknowledge).
- `activity_events.actor_kind`: append-only (UPDATE/DELETE already revoked from PUBLIC per existing rule).

### Permissions (RBAC)

Single new permission: `argus:use` — seeded `true` for all four default roles (`worker`, `supervisor`, `ehs_manager`, `site_admin`). Magic-wand *actions* still require the underlying permission (e.g. `capa:create`).

### Env / config

- New: `ANTHROPIC_API_KEY` in `.env.local` (server-only; never exposed to the client).
- New: `ARGUS_DEFAULT_DAILY_TOKEN_BUDGET=5000000` (override per-org via `orgs.argus_daily_token_budget`).
- `package.json`: add `@anthropic-ai/sdk` (latest).

---

## File deltas

**New files**

```
lib/argus/{client,models,redact,stream,budget,ratelimit,log}.ts
lib/argus/system-prompts/{copilot,investigator,severity,capa-draft,verification-method,reportability}.md
lib/argus/tools/{log-observation,attach-photo,raise-stop-work,suggest-severity,draft-capa,suggest-method}.ts
app/api/argus/stream/route.tsx
components/argus/use-voice.ts
components/argus/argus-copilot.tsx          # 9b
components/argus/argus-side-panel.tsx        # 9a shell, 9e finalized
components/argus/argus-magic-wand.tsx        # 9d
components/argus/argus-investigator.tsx      # 9c
components/argus/argus-insight-tile.tsx      # 9e
components/argus/voice-button.tsx
components/argus/photo-capture-button.tsx
components/argus/suggestion-card.tsx         # accept/edit/reject affordance
components/argus/argus-trigger-fab.tsx       # bottom-right floating button
supabase/migrations/20260510120000_argus_phase_9a.sql
```

**Modified files**

- `components/incidents/wizard/step-1-what-happened.tsx`, `step-2-details.tsx`, `step-3-review.tsx` — mount `<ArgusCopilot>` (9b) + magic-wand on Step 3 risk matrix (9d)
- `components/risk-matrix/risk-matrix.tsx` — accept optional `<ArgusMagicWand>` slot
- `components/investigations/detail/five-why-chain.tsx`, `findings-editor.tsx` — accept Argus-drafted starting state
- `app/(app)/investigations/[id]/page.tsx` — mount `<ArgusInvestigator>` (9c)
- `components/inspections/finding-actions-card.tsx` — magic-wand on "Escalate to incident" (9d)
- `components/capa/capa-create-modal.tsx` — magic-wand on Type + Title (9d, requires `capa:create`)
- `components/capa/detail/verification-form.tsx` — magic-wand on Method dropdown (9d)
- `app/(app)/reports/osha-300/page.tsx`, `riddor-f2508/[incidentId]/page.tsx` — Reportability confidence pane (9d, read-only)
- `app/(app)/dashboard/page.tsx`, `capa/page.tsx`, `inspections/page.tsx`, `reports/page.tsx` — `<ArgusInsightTile>` slots (9e)
- `components/app-shell/topbar.tsx` — Argus avatar trigger (9a shell, 9e finalized)
- `components/app-shell/regulatory-banner.tsx` — extend to show stop-work banner (9b)
- `lib/workflow/notifications.ts` — new notification kind `incident.stop_work_raised` (immediate to site EHS lead + RIDDOR responsible person; 9b)
- `CLAUDE.md` — add the six Argus hard rules + roadmap state (9a)
- `docs/SPEC.md` — §15 divergence entry dated 2026-05-10 + new §17 "Argus" section (9a)
- `docs/ui-flow.md` — Argus surfaces per page (9a)
- `docs/design.md` — cyan `#00D4FF` becomes Argus accent; suggestion-card recipe (9a)
- `docs/BUILD_STATUS.md` — Phase 9 entry on each sub-phase merge
- Memory: `project_ims_planning_relationship.md` (record divergence), new `project_argus_v1.md`, new `feedback_argus_assistive_only.md`

---

## Definition of Done — per sub-phase

**9a Foundation**
- `@anthropic-ai/sdk` installed; `ANTHROPIC_API_KEY` documented in `.env.local.example`.
- Migration applied; `pnpm db:types` regenerated; types compile.
- `lib/argus/{client,redact,stream,budget,ratelimit,log}.ts` all exported and unit-callable from a Server Action.
- `app/api/argus/stream/route.tsx` returns SSE for a "ping" payload behind `argus:use`.
- Empty `<ArgusSidePanel>` opens from a topbar avatar; closes; no errors.
- CLAUDE.md, SPEC §15, design.md, ui-flow.md updated.
- Smoke: open the panel on `/dashboard`, see "Argus is ready" placeholder, no console errors, no 500s.

**9b Copilot in Report Wizard**
- Floating `<ArgusCopilot>` visible on all three wizard steps; collapsed by default on mobile, expanded ≥md.
- Mic button starts/stops Web Speech API; live transcript chip; falls back to a textarea where unsupported.
- "Worker on roof, no harness" → tool-call `log_observation` writes a row to `incident_attachments` + `activity_events` (actor_kind='argus').
- Photo capture works on mobile (`capture="environment"`); image stored in Supabase Storage and linked.
- "Raise stop-work" sets `incidents.stop_work=true`, fires `incident.stop_work_raised` notification, banner appears on dashboard.
- Every Copilot turn writes to `argus_suggestions` with token + model fields populated.
- Smoke: walk through `/incidents/new/1`, dictate an observation, attach a photo, raise stop-work, see banner on `/dashboard`.

**9c AI Investigator**
- `<ArgusInvestigator>` mounts on `/investigations/[id]` for users with `investigation:edit`.
- Paste description + add ≥1 witness statement (text or voice) → "Generate timeline + RCA" streams Sonnet 4.6 output.
- Output is editable; "Push to investigation" writes 5-Why rows + findings via the existing autosave path.
- Nothing persists until the user clicks Push (review-and-edit gate).
- Smoke: load an existing investigation, paste a sample description, generate, edit one Why, push, verify rows in DB.

**9d Magic wands**
- `<ArgusMagicWand>` button visible next to: 5×5 risk-matrix cells (Step 3), finding `Escalate to incident`, CAPA `Type` field, CAPA verification `Method` field.
- Each click writes a suggestion → renders a `<SuggestionCard>` with Accept / Edit / Reject.
- Reportability confidence pane on `/reports/osha-300` and `/reports/riddor-f2508/*` shows Sonnet output cited against 29 CFR Appendix A or RIDDOR Schedule 2.
- All four outcome states write to `argus_suggestions.outcome`.
- Smoke: trigger each wand, accept one, edit one, reject one, query `argus_suggestions` to verify outcome flips.

**9e Global panel + Dashboard tiles**
- Topbar Argus avatar visible right of notification bell; tooltip "Ask Argus".
- `<ArgusSidePanel>` is page-context aware — picks up route + visible record IDs and pre-loads a system block.
- Four `<ArgusInsightTile>` cards on `/dashboard`: Overdue investigations · Stop-work active · Reportability uncertain · CAPA cluster overdue.
- Tiles also on `/capa`, `/inspections`, `/reports`.
- Smoke: open side panel from `/incidents/[id]`, ask "summarize this incident's classification path," verify no PII (names → initials) in the request payload (DevTools Network).

---

## Smoke test (full Phase 9.0 — run before merging 9e)

- [ ] `pnpm install` succeeds; `@anthropic-ai/sdk` listed.
- [ ] `pnpm db:push` applies migration; `pnpm db:types` regenerates; `pnpm dev` boots.
- [ ] `ANTHROPIC_API_KEY` missing → side panel shows "AI is offline" empty state, no 500.
- [ ] `argus_enabled=false` on org → topbar avatar hidden; magic wands hidden; Copilot hidden.
- [ ] User without `argus:use` → same hidden behaviour.
- [ ] Hit per-user rate limit (11 inline calls/min) → 429 with friendly toast.
- [ ] Hit per-org daily token budget → soft warn at 80% on the side panel; hard cap blocks new calls and tells the user.
- [ ] Web Speech API unsupported (Firefox) → text-input fallback only; no broken UI.
- [ ] Stop-work raised on a US site → notification fires to site EHS lead within 5s; banner shows on dashboard until acknowledged.
- [ ] Stop-work raised on a UK site → also notifies the RIDDOR responsible person.
- [ ] Acknowledging stop-work clears the banner; `argus_suggestions.outcome` audit row exists.
- [ ] Investigator: generate → edit → push → 5-Why rows visible in DB; activity_events shows two rows (`actor_kind='argus'` for the suggestion, `actor_kind='human'` for the push).
- [ ] Severity magic-wand suggests S2 → user edits to S3 → outcome=`edited` recorded with diff payload.
- [ ] Reportability pane shows confidence + citation; `Generate report` button still requires the human's existing click — AI never auto-files.
- [ ] PII check: open DevTools, log a Copilot turn that includes a worker name → request body shows initials, not full name.
- [ ] Dark mode renders panel + tiles correctly (cyan accent visible against dark surface).
- [ ] Cache Components: no `Suspense` boundary errors; route handlers don't `export const runtime`.
- [ ] All four Phase 12 auth flows still work (regression).
- [ ] Build passes `pnpm build` with zero TS errors.

---

## Risks & open questions

1. **Cost blow-up.** A single chatty user could rack up a $5 day. Per-user rate limit + per-org daily cap mitigate; we'll watch `argus_suggestions` for the first week.
2. **Web Speech API browser drift.** Safari iOS often pauses recognition mid-utterance. The text-input fallback is non-negotiable. If field reports show >20% drop-off on iOS, escalate to 9.1 with Whisper.
3. **PII redaction is best-effort.** We strip names we *know* (profiles + injured persons table), but free-text descriptions can re-leak them. Document this in SPEC §17 and treat the redactor as a defence-in-depth layer, not a guarantee. Anthropic's no-training-on-API-input policy is the actual privacy backstop; cite it in SPEC.
4. **Streaming inside Cache Components.** Confirmed pattern is route handler + SSE, not Server Action streaming. Tested informally but a full proof needs to land in 9a.
5. **Stop-work model is minimal.** A boolean works for v1 but real EHS workflows want stop-work approval chains, lift criteria, photo proof on lift. Out of scope; revisit in v2.
6. **Magic-wand discoverability.** Easy to miss; if onboarding hint cards don't surface them in 9.1 we'll see low engagement. Track suggestion-impression vs accept-rate and iterate.
7. **Investigator hallucination.** Sonnet *will* invent witness names or times if the input is thin. Mitigate: hard prompt rule "if the input doesn't say it, don't say it"; show an "Insufficient input" path; require ≥1 witness statement before allowing generate.
8. **IMS_PLANNING relationship doc.** The "permanent non-goal" line is the largest divergence we've ever logged. Update `project_ims_planning_relationship.md` to call this out so future phases don't accidentally re-collapse the contradiction.

---

## Out of scope (Phase 9.1+)

- Document OCR / SDS auto-classification on upload
- Asset PM scheduler ("AI suggests next inspection date")
- Conversation persistence across sessions (each side-panel session is ephemeral in 9.0)
- Multilingual STT (English-only in 9.0)
- Mobile-app voice (we're web-only today)
- Whisper / Deepgram upgrade (only if Web Speech API drop-off justifies it)
- Authoritative AI of any kind — auto-classify severity, auto-route, auto-close CAPAs, auto-submit OSHA/RIDDOR. Permanently out of scope per Hard Rule 4.

---

## Verification

```bash
pnpm install
pnpm db:push
pnpm db:types
pnpm dev
# then walk the per-sub-phase Definition of Done above
```

Per-sub-phase merge gates:

- 9a → smoke test items 1–7 above
- 9b → smoke test items 8–11
- 9c → smoke test item 12
- 9d → smoke test items 13–14
- 9e → full list

Each sub-phase = its own feature branch + PR per `.claude/rules/github-workflow.md`. PR titles: `feat: phase 9a — argus foundation`, `feat: phase 9b — argus copilot in report wizard`, etc. Squash-merge into `main`. After 9e merges, update `docs/BUILD_STATUS.md` + memory `project_overview.md` + add memory `project_argus_v1.md`.
