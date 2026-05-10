# Phase 9d — Argus Magic Wands

**Status:** scoped 2026-05-10.
**Goal:** Drop a single, reusable `<ArgusMagicWand>` button next to the four (possibly five) load-bearing decisions in the workflow — risk-matrix cell, finding→incident severity, CAPA verification method, and OSHA/RIDDOR reportability — so a worker can ask Argus for a one-shot suggestion, see it as a `<SuggestionCard>` with confidence + rationale, and Accept / Edit / Reject in place. Nothing auto-commits; every wand resolves through the same form fields the human already had.
**Branch:** `feat/phase-9d-argus-magic-wands`
**PR target:** `main`
**Depends on:** Phase 9a (foundation: SDK, route handler patterns, `argus_suggestions`, `activity_events.actor_kind`, `argus:use`), Phase 9b (tools registry, `<SuggestionCard>` design language, redactor in flight), Phase 9c (per-card Push commit pattern; reuse the confirm dialog approach where applicable)
**Master plan:** `plans/09-argus-ai-assistant.md` → 9d row.

---

## Context — what 9d is and what it isn't

**Is:** the *inline classifier* phase. Each wand is a one-shot, structured-output call (`tool_choice: { type: 'tool', name: ... }`) that returns a single small payload — a matrix coord, an enum value, a couple of text fields, or a reportability verdict — plus a confidence score and a one-paragraph rationale. The form field next to the wand stays untouched until the human clicks Accept.

**Isn't:**
- A chat. No multi-turn refinement. Re-asking is a fresh call.
- An agentic loop. Zero tools have a server-side `execute()` — the route handler captures the model's `tool_use.input` and returns it as the data payload (same pattern 9c established for `propose_investigation_draft`).
- An auto-applier. None of the four (or five) surfaces commits without the user's explicit Accept click. Severity classification, finding→incident promotion, verification method, and OSHA/RIDDOR reportability are all named "load-bearing decisions" in the master plan's hard rule #1 and stay human-signed.
- A new permission surface. Every wand gates on `argus:use` for the *suggestion* and on the underlying permission (`incident:create`, `capa:create`, `capa:verify`, `report:read`, etc.) for the *action* the human takes after accepting.

The Reportability pane is intentionally **read-only** — it shows confidence and the relevant 29 CFR Appendix A or RIDDOR Schedule 2 citation, but it does not gate, change, or pre-fill anything on the OSHA-300 / OSHA-300A / OSHA-301 / RIDDOR-F2508 forms. The human files; Argus advises.

---

## Surface placement

Four primary wand sites confirmed by the CLAUDE.md status line (2026-05-10). The master plan's 09 row also lists a fifth (CAPA-draft-from-investigation in the Create-CAPA modal) — flagged as Open Question #1 below.

| # | Surface | File | Wand kind | Model | Output |
|---|---|---|---|---|---|
| 1 | 5×5 risk-matrix on Step 3 of Report Wizard | `components/risk-matrix/risk-matrix.tsx` (slot) + `components/incidents/wizard/step-3-review.tsx` (mount) | `suggest_risk_matrix` | Haiku 4.5 | `{ likelihood: 1–5, consequence: 1–5, confidence: 0–1, rationale: string }` |
| 2 | Finding → incident escalation severity | `components/inspections/finding-actions-card.tsx` | `suggest_finding_severity` | Haiku 4.5 | `{ likelihood: 1–5, consequence: 1–5, confidence: 0–1, rationale: string }` |
| 3 | CAPA verification method dropdown | `components/capa/detail/verification-form.tsx` | `suggest_verification_method` | Haiku 4.5 | `{ method: 'inspection' \| 'monitoring' \| 'audit_trend' \| 're_interview' \| 'document_review', confidence: 0–1, rationale: string }` |
| 4 | OSHA reportability confidence pane (read-only) | `app/(app)/reports/osha-300/page.tsx` (per-row pane) and `app/(app)/reports/riddor-f2508/[incidentId]/page.tsx` (single-incident pane) | `assess_reportability` | Sonnet 4.6 | `{ verdict: 'reportable' \| 'not_reportable' \| 'uncertain', citation: string, confidence: 0–1, rationale: string, threshold_met: string[] }` |
| 5 *(open Q1)* | CAPA Create modal — Type + Title draft | `components/capa/capa-create-modal.tsx` | `draft_capa_metadata` | Sonnet 4.6 | `{ type: enum, title: string, suggested_owner_role?: string, confidence: 0–1, rationale: string }` |

Visibility rules apply to all five identically:

- `orgs.argus_enabled = true`
- caller has `argus:use` (default-on for all four seeded roles)
- caller has the relevant write permission for the surface (e.g. `incident:create` on the wizard, `capa:verify` on verification, `capa:create` on the create modal). The Reportability pane requires `report:read` — already enforced by the page itself.
- (Wand 1 only) Step 3 is the active wizard step and the description on the draft incident is non-empty.
- (Wand 2 only) the finding belongs to a closed inspection and has not yet been escalated (existing `escalated_incident_id IS NULL` check).
- (Wand 3 only) the CAPA is in `verifying` state with a verifier assigned and a method not yet locked.

When any condition fails the wand is omitted from the DOM (not greyed out — invisibility is the simplest signal).

The button uses the cyan Argus accent (`#00D4FF`, established in design.md for streaming/active states) with a Sparkles icon at 16 px. Tooltip on hover: "Suggest with Argus" (uniform across surfaces). Loading state spins the Sparkles. Error state collapses to a small inline error text below the wand, never blocks the form.

---

## UX flow (per-wand mockups)

### Wand 1 — Risk matrix on Step 3

```
┌─ Step 3 — Severity & review ──────────────────────────────────────────────┐
│  Description (read-only seed): "Worker JS slipped on oil patch in Bay 3…" │
│                                                                            │
│  Risk matrix:        [✨ Suggest with Argus]  ← cyan, top-right of grid   │
│   ┌──────────────────────────────────────┐                                │
│   │  5×5 grid (Likelihood × Consequence) │                                │
│   └──────────────────────────────────────┘                                │
│                                                                            │
│  ─ once Argus responds (≤ 4s on Haiku) ────────────────────────────────── │
│                                                                            │
│  ┌─ Argus suggests: Likelihood 3 × Consequence 4 = S2 (Major) ──────┐     │
│  │  Confidence 78%                                                   │     │
│  │  "Slip on liquid is moderately likely in a high-traffic bay; a    │     │
│  │  fractured wrist meets the Major (S2) consequence threshold."     │     │
│  │  [Accept]  [Edit]  [Reject]                                       │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Accept** → calls the existing `onChange({ likelihood, consequence })` with the suggested coords; suggestion-card collapses to a chip "Argus suggested S2 (accepted)"; `argus_suggestions.outcome='accepted'`.
- **Edit** → just dismisses the card without applying; the human picks their own cell from the grid; on cell selection, if the picked cell ≠ suggestion, `outcome='edited'` with `{ before: suggestion, after: human }` payload; if equal, `outcome='accepted'`.
- **Reject** → dismisses with `outcome='rejected'`. No further suggestion this session unless the user clicks the wand again.

### Wand 2 — Finding → Incident escalation severity

Lives inside the existing finding-actions card next to the "Escalate to incident" button. Click `[✨ Suggest severity]` → suggestion-card with the same matrix coord output. Accept pre-fills the `incident_draft.likelihood` + `incident_draft.consequence` that the existing escalation flow consumes; the human still confirms before the incident is created.

### Wand 3 — CAPA verification method

Inside the Verification form, next to the Method `<Select>`. Click → suggestion-card returns one of the five `verification_method` enum values + rationale. Accept calls the existing `onChange` of the Select. The human still has to pick the verifier (cannot equal owner — the existing 3-layer constraint is unaffected).

### Wand 4 — Reportability confidence pane (READ-ONLY)

Renders inline on the existing report pages — not a button-triggered popover, but an auto-loading pane at the top of each row (OSHA-300) or each report (RIDDOR-F2508). Auto-loads only on first view (cached in `argus_suggestions` for 24h, keyed on `target_kind='incident' + target_id`); a manual `[↻ Re-assess]` link triggers a fresh call.

```
┌─ OSHA-300 row 14 — Incident IR-014 (slip / fracture, 2026-05-08) ─────────┐
│  ┌─ Argus reportability ─────────────────── confidence 92% — Reportable ─┐│
│  │  Cited: 29 CFR 1904.7(b)(2) — fracture (other than fingers/toes)      ││
│  │  Threshold: ✓ medical treatment beyond first aid                      ││
│  │  Threshold: ✓ days away from work expected                            ││
│  │  "Fractured wrist with prescribed splint and 3+ days lost time meets  ││
│  │   the standard for a recordable injury under §1904.7(b)(2)."          ││
│  │  [↻ Re-assess]                                                        ││
│  └───────────────────────────────────────────────────────────────────────┘│
│  [existing OSHA-300 row data + Generate report button — unchanged]        │
└────────────────────────────────────────────────────────────────────────────┘
```

No Accept/Edit/Reject — there's nothing to commit. Only outcomes recorded are `'pending'` (just delivered) and `'expired'` (24h elapsed before the human filed). The human's `Generate report` click (existing flow, requires `report:write`) is the source of truth.

### Wand 5 — CAPA Create modal Type + Title (open question)

If we ship: a single `[✨ Draft from investigation]` button at the top of the Create-CAPA modal, only enabled when the modal was opened from an investigation (i.e. has `investigation_id` in scope). Click → suggestion-card with `{ type, title, rationale }`. Accept fills both fields. Same outcome semantics as Wands 1–3.

---

## Architecture

### Route handler — `app/api/argus/wand/route.ts`

POST `{ surface: 'risk_matrix' | 'finding_severity' | 'verification_method' | 'reportability' | 'capa_metadata', payload: <surface-specific input> }`

Server flow:

1. `runArgusGates(surface)` — light bucket for the four Haiku surfaces (10/min/user, the existing inline limit), heavy bucket (3/min/user) for `reportability` and `capa_metadata` (Sonnet).
2. `argus:use` + per-surface write permission check on the relevant site.
3. Build the redaction known-names list (caller, injured persons on the target incident, witnesses where applicable, investigation lead). Run `redactText()` on every free-text field in the payload.
4. Pick model + tool + system prompt from a small `WAND_REGISTRY` constant keyed by `surface`.
5. Call `messages.create({ model, max_tokens: 1024, tools: [oneTool], tool_choice: { type: 'tool', name: oneTool.name }, system, messages })`. **Non-streaming** — these are sub-second on Haiku and ~3–5s on Sonnet, and we want a single round-trip JSON envelope, not SSE. Streaming is reserved for the Investigator (9c) and Copilot (9b).
6. Extract `tool_use.input` from the response; validate against a Zod schema mirror of the tool's `input_schema` (defence-in-depth — Anthropic occasionally returns extra keys).
7. Insert `argus_suggestions` row: `surface=<key>`, `target_kind` + `target_id` per surface, `model`, `prompt_tokens`, `completion_tokens`, `cache_read_tokens`, `cache_create_tokens`, `payload = { kind: 'wand', input: <redacted>, output: <validated> }`, `outcome='pending'`.
8. Insert `activity_events` row: `verb='argus.wand_suggested'`, `actor_kind='argus'`, `target_kind/target_id` per surface, `payload={ surface, model, tokens }`.
9. Return `{ ok: true, suggestionId, output, confidence, rationale }`. On model refusal or schema violation: `{ ok: false, error: 'argus_unavailable' }` with a 200 status (the wand UI expects a 200 envelope and surfaces the error inline).

For `reportability`, before step 5 the handler first checks `argus_suggestions` for an `outcome='pending'` row with the same target ≤ 24h old; if found, return that row's `output` directly without a model call (the auto-load cache).

### Tools — `lib/argus/tools/`

Five new tool definitions (or four if we skip Wand 5). Each is structured-output only — no `execute()`. Add to a new `WAND_TOOLS` map exported from `lib/argus/tools/index.ts` (keep separate from `COPILOT_TOOLS` and `INVESTIGATOR_TOOLS` per the 9c precedent).

```ts
// lib/argus/tools/suggest-risk-matrix.ts
export const suggestRiskMatrixTool = {
  name: 'suggest_risk_matrix',
  description: 'Suggest the 5×5 risk-matrix coordinates for the described incident.',
  input_schema: {
    type: 'object',
    required: ['likelihood', 'consequence', 'confidence', 'rationale'],
    properties: {
      likelihood:  { type: 'integer', minimum: 1, maximum: 5 },
      consequence: { type: 'integer', minimum: 1, maximum: 5 },
      confidence:  { type: 'number',  minimum: 0, maximum: 1 },
      rationale:   { type: 'string', maxLength: 800 },
      insufficient_input: { type: 'string' },
    },
  },
};
```

`suggest_finding_severity` shares the same shape (the prompt is what differs). `suggest_verification_method` returns the enum:

```ts
properties: {
  method: { type: 'string', enum: ['inspection', 'monitoring', 'audit_trend', 're_interview', 'document_review'] },
  confidence: { type: 'number', minimum: 0, maximum: 1 },
  rationale:  { type: 'string', maxLength: 800 },
  insufficient_input: { type: 'string' },
}
```

`assess_reportability` returns the verdict + citation envelope; `draft_capa_metadata` returns the type + title envelope. Each carries an `insufficient_input` escape valve — same pattern as 9c. If non-empty, the wand surfaces "Argus needs more context" and the suggestion-card is suppressed.

### System prompts — `lib/argus/system-prompts/`

Five new files (or four). Each ≤ 30 lines, prompt-cached `ephemeral`, includes the relevant rubric:

- `wand-risk-matrix.md` — encodes the SPEC §8 5×5 likelihood × consequence rubric verbatim, plus the "do not invent facts not in the input" rule.
- `wand-finding-severity.md` — same rubric, scoped to the finding context (the finding's hazard description + linked inspection metadata).
- `wand-verification-method.md` — encodes the five verification methods + when each is appropriate, sourced from SPEC §10.
- `wand-reportability.md` — encodes 29 CFR 1904.7 + RIDDOR Schedule 2 thresholds; the model is instructed to cite the specific subsection that triggered the verdict. **This is the most important prompt to get right** — false positives are a regulatory exposure for the org.
- `wand-capa-metadata.md` — encodes CAPA type taxonomy + naming convention; instructed to keep titles ≤ 80 chars and reference the root cause not the symptom.

### Component tree

```
components/argus/
  argus-magic-wand.tsx              ← single reusable button + suggestion-card pair
  use-argus-wand.ts                 ← thin fetch hook (POST → JSON envelope, no SSE)
  suggestion-card.tsx               ← Accept / Edit / Reject card (already in master plan, lives here)
```

`<ArgusMagicWand>` props:

```ts
type ArgusMagicWandProps =
  | { surface: 'risk_matrix';        payload: { description: string; type: string; area?: string }; onAccept: (out: { likelihood: number; consequence: number }) => void; targetKind: 'incident'; targetId: string; }
  | { surface: 'finding_severity';   payload: { description: string; hazardCategory?: string };       onAccept: (out: { likelihood: number; consequence: number }) => void; targetKind: 'finding';  targetId: string; }
  | { surface: 'verification_method'; payload: { capaSummary: string };                                onAccept: (out: { method: string }) => void;                            targetKind: 'capa';     targetId: string; }
  | { surface: 'reportability';      payload: { incidentSummary: string; jurisdiction: 'US' | 'GB' }; onAccept?: never;                                                       targetKind: 'incident'; targetId: string; readOnly: true; }
  | { surface: 'capa_metadata';      payload: { investigationSummary: string };                       onAccept: (out: { type: string; title: string }) => void;               targetKind: 'capa';     targetId?: string; };
```

The `readOnly` discriminant on Reportability hides Accept/Edit/Reject and shows a verdict pane instead.

`<SuggestionCard>` props: `{ confidence, rationale, output, onAccept, onEdit, onReject, readOnly? }`. Cyan accent strip on the left edge to mark "Argus speaking."

### Page integration

```tsx
// step-3-review.tsx
{canArgus && (
  <ArgusMagicWand
    surface="risk_matrix"
    payload={{ description: incident.description, type: incident.type, area: incident.area }}
    onAccept={(out) => setMatrix({ likelihood: out.likelihood, consequence: out.consequence })}
    targetKind="incident"
    targetId={incident.id}
  />
)}
<RiskMatrix value={matrix} onChange={setMatrix} />
```

```tsx
// finding-actions-card.tsx
{canEscalate && canArgus && (
  <ArgusMagicWand
    surface="finding_severity"
    payload={{ description: finding.description, hazardCategory: finding.hazard_category }}
    onAccept={(out) => setEscalationDraft((d) => ({ ...d, ...out }))}
    targetKind="finding"
    targetId={finding.id}
  />
)}
```

```tsx
// verification-form.tsx
{canVerify && canArgus && (
  <ArgusMagicWand
    surface="verification_method"
    payload={{ capaSummary: capa.description }}
    onAccept={(out) => form.setValue('method', out.method)}
    targetKind="capa"
    targetId={capa.id}
  />
)}
```

```tsx
// osha-300/page.tsx — per row
{canArgus && incident.id && (
  <ArgusMagicWand
    surface="reportability"
    payload={{ incidentSummary: incident.summaryForArgus, jurisdiction: 'US' }}
    targetKind="incident"
    targetId={incident.id}
    readOnly
  />
)}
```

The wand is rendered as a server-side mount where possible (e.g. on the OSHA-300 page) so the auto-load cache hit doesn't require a client round-trip. When cache misses, the `<ArgusMagicWand>` switches to client-rendered loading state on the next interaction.

### Server actions reused (no new write actions needed)

- Wand 1: existing `setMatrix` state in the wizard + the existing `finalizeIncident` action when the human submits.
- Wand 2: existing escalation flow on the inspection finding (whichever action `finding-actions-card.tsx` already calls).
- Wand 3: existing CAPA verification action.
- Wand 5 (if shipped): existing CAPA create action.

Outcome flips are written by a small new action `app/(app)/argus-wand-actions.ts` (or co-located per surface — TBD when we wire each):

```ts
"use server";
export async function acceptWandSuggestion({ suggestionId, edited, finalOutput }): ActionResult { ... }
export async function rejectWandSuggestion({ suggestionId }): ActionResult { ... }
```

Both gate on `argus:use` and the surface's underlying write permission. Both `revalidatePath` the relevant page only when the outcome change implies a UI update (rare — Accept doesn't move the user away from the form, so usually a no-op).

---

## Schema

**Zero migration.** All required tables/columns ship from 9a:

- `argus_suggestions` — five new `surface` values: `'risk_matrix'`, `'finding_severity'`, `'verification_method'`, `'reportability'`, `'capa_metadata'` (column is `text`, no ALTER).
- `activity_events.actor_kind` — used as-is.
- `incidents`, `inspection_findings`, `capas` — no changes; we read existing fields.

One new activity verb (no schema change — `verb` is `text`):

- `argus.wand_suggested` (actor_kind='argus')
- `argus.wand_accepted` / `argus.wand_edited` / `argus.wand_rejected` (actor_kind='human') — diff payload attached to `edited` for audit.

---

## Permissions

**No new permission keys.** Each wand reuses:

- Visibility: `argus:use` + the underlying *write* permission for the surface.
- Action (Accept): the same write permission — the human is doing the write, not Argus.
- Action (Reportability pane): `report:read` only — pane is read-only.

The `argus:use` flag is the single feature-availability gate, consistent with the 9a/9b/9c precedent.

---

## File deltas

**New**

```
app/api/argus/wand/route.ts
app/(app)/argus-wand-actions.ts
lib/argus/tools/suggest-risk-matrix.ts
lib/argus/tools/suggest-finding-severity.ts
lib/argus/tools/suggest-verification-method.ts
lib/argus/tools/assess-reportability.ts
lib/argus/tools/draft-capa-metadata.ts          (open Q1)
lib/argus/system-prompts/wand-risk-matrix.md
lib/argus/system-prompts/wand-finding-severity.md
lib/argus/system-prompts/wand-verification-method.md
lib/argus/system-prompts/wand-reportability.md
lib/argus/system-prompts/wand-capa-metadata.md  (open Q1)
components/argus/argus-magic-wand.tsx
components/argus/suggestion-card.tsx
components/argus/use-argus-wand.ts
```

**Modified**

```
lib/argus/tools/index.ts                                (export WAND_TOOLS map)
components/risk-matrix/risk-matrix.tsx                  (accept optional Argus slot above the grid)
components/incidents/wizard/step-3-review.tsx           (mount risk-matrix wand)
components/inspections/finding-actions-card.tsx         (mount finding-severity wand)
components/capa/detail/verification-form.tsx            (mount verification-method wand)
components/capa/capa-create-modal.tsx                   (mount capa-metadata wand — open Q1)
app/(app)/reports/osha-300/page.tsx                     (mount reportability pane per row)
app/(app)/reports/riddor-f2508/[incidentId]/page.tsx    (mount reportability pane)
docs/SPEC.md                                            (§17 Argus subsection — wand surfaces, models, audit, reportability disclaimer)
docs/ui-flow.md                                         (note wand placement on each affected page)
docs/BUILD_STATUS.md                                    (Phase 9d entry on merge)
CLAUDE.md                                               (build status one-liner update on merge — flip 9d to shipped)
```

**Memory (on merge)**

- New: `project_phase_9d_argus_magic_wands.md`
- Update: `project_overview.md` (state line: 9d shipped, 9e pending), `MEMORY.md` (index)

---

## Hard rules carried forward

All six 9.0 hard rules from the master plan apply unchanged. The four that bind hardest in 9d:

- **Rule 1 — assistive, not authoritative.** No wand commits anything. Severity, finding-promotion, verification method, and reportability all stay human-signed. Reportability is read-only by construction.
- **Rule 4 — no auto-classify, no auto-route, no auto-close.** The risk-matrix wand suggests but never sets; the engine in `lib/workflow/severity.ts` still runs only when the human submits the wizard.
- **Rule 5 — PII redaction.** Incident summaries used by Wands 1, 2, 4, 5 contain witness/injured-person names. Run `redactText()` on the payload before egress.
- **Rule 6 — cost guardrails.** Light bucket (10/min/user) for the four Haiku wands; heavy bucket (3/min/user) for Reportability and CAPA-metadata Sonnet calls. Reportability auto-load uses a 24h cache hit on `argus_suggestions` to avoid double-billing per-row on OSHA-300 page loads.

---

## Definition of Done

- All four (or five) wands render only when their visibility conditions are met; hidden cleanly otherwise.
- With `orgs.argus_enabled=false` or `argus:use=false`, no wand renders anywhere.
- Each wand returns within 5s on Haiku, 12s on Sonnet, on a typical incident.
- Suggestion-card shows confidence + rationale; Accept fills the existing form field via the existing `onChange`; Edit dismisses; Reject dismisses with outcome write.
- `argus_suggestions` row written on each suggestion (`outcome='pending'`); flipped to `accepted` / `edited` / `rejected` on user action.
- For Wand 4 (Reportability), auto-load on first view; subsequent OSHA-300 views within 24h hit the cache (no model call); `[Re-assess]` link forces a fresh call.
- Each suggestion writes one `activity_events` row (`actor_kind='argus'`, `verb='argus.wand_suggested'`); each Accept/Edit/Reject writes one (`actor_kind='human'`, with diff payload on `edited`).
- Light + heavy rate limits enforced; 11th call/min returns 429 with friendly toast.
- Org daily token budget enforced; soft warn surfaces in the suggestion-card when ≥80%.
- PII redaction: DevTools network shows initials, not full names, in the request body for all five surfaces.
- `pnpm build` clean; no migration so no `pnpm db:types` regeneration needed.
- Smoke walked through each surface (Definition of Smoke below).
- All 9a/9b/9c flows still work (regression).
- Dark mode renders cyan accent + suggestion-card correctly on every surface.

---

## Smoke test (run before opening PR)

- [ ] `pnpm dev` boots clean.
- [ ] **Wand 1 — Risk matrix.** Open `/incidents/new/3` on an in-flight draft → Step 3 shows the wand. Click → suggestion-card returns matrix coords. Accept → grid cell highlights; outcome flips on next state mutation. Edit → pick a different cell; outcome=`edited` with diff. Reject → outcome=`rejected`.
- [ ] **Wand 2 — Finding severity.** Open a closed inspection with an unescalated finding → wand visible. Click → suggestion fills the escalation-draft severity. Cancel out of the escalation modal → outcome=`expired` after 24h (or `rejected` if user clicked Reject).
- [ ] **Wand 3 — Verification method.** Open a CAPA in `verifying` state → wand visible. Click → method enum returned. Accept fills the dropdown. Confirm `verifier ≠ owner` 3-layer constraint still rejects an invalid combo.
- [ ] **Wand 4 — Reportability.** Open `/reports/osha-300` → each row auto-loads a verdict pane (cyan accent). Reload page within 24h → no model call (verify in network tab; should see <100ms response from cache lookup). Click `[Re-assess]` → fresh model call; new `argus_suggestions` row.
- [ ] **Wand 4 — RIDDOR.** Open `/reports/riddor-f2508/<incident>` → pane shows RIDDOR Schedule 2 citation, not 29 CFR.
- [ ] **Wand 5 (open Q1).** If shipped: open Create-CAPA from an investigation → wand visible; click → Type + Title fill; Accept; submit.
- [ ] Empty / thin payload (e.g. wizard with 5-word description) → suggestion-card shows "Argus needs more context" instead of a verdict.
- [ ] Trigger 11 wand calls in 60s on the same user → 11th returns 429 with toast.
- [ ] Trigger 4 Sonnet wands (Reportability re-assess + CAPA-metadata) in 60s → 4th returns 429.
- [ ] Org budget at 100% → wand shows "AI is offline today" empty state; no model call.
- [ ] PII: incident summary with full name "John Smith" → network request body shows "JS".
- [ ] Cache Components: no Suspense errors; no `runtime` exports on the new route handler.
- [ ] Dark mode: open each surface, verify cyan accent + suggestion-card colors.
- [ ] Activity feed on the relevant target shows `Argus suggested <surface>` + `<user> accepted/edited/rejected Argus suggestion` rows.

---

## Out of scope (deferred to 9.1+)

- Multi-turn refinement on any wand (each wand is a one-shot).
- Argus-driven *creation* of incidents, findings, or CAPAs (current wands fill fields; they don't navigate or create rows).
- Reportability auto-filing of OSHA / RIDDOR forms (permanent non-goal per Hard Rule 4).
- Cross-incident pattern detection (a 9e dashboard tile, not a wand).
- Inspection-template generation (out of Phase 9 entirely).
- Document evidence ingest into wand prompts (PDF extraction etc.).
- A wand on the investigation Why fields (covered by 9c's Investigator workspace).
- A wand on RIDDOR-F2508's individual sub-fields (the pane is the whole story).

---

## Risks

1. **Reportability false positives.** A Sonnet citation that says "reportable" when the incident isn't, or vice versa, is a real regulatory exposure even if the human files. Mitigation: tight system prompt that requires citing a specific 29 CFR / RIDDOR subsection, and a `confidence < 0.7` band that surfaces the verdict as "uncertain" instead of either reportable/not. Watch acceptance rate post-merge — any disagreement between Argus verdict and human filing should be auto-flagged for SPEC §17 lessons-learned.
2. **Risk-matrix anchoring bias.** A 78%-confidence Argus suggestion may anchor a junior worker who would have picked differently. Mitigation: rationale is always shown; Edit is a first-class affordance equal in visual weight to Accept. We also do *not* pre-fill the grid on Accept until the human clicks — the suggestion-card sits next to the empty grid, the user has to click Accept to fill. Track edit-rate; <5% = anchoring problem.
3. **Cost on OSHA-300.** A US site with 50 recordable incidents, all hitting the auto-load on first view, is 50 Sonnet calls. The 24h cache absorbs repeat views; we still pay once per incident per day at first view. ~$0.05/page-load worst-case. Mitigation: cache-key on `incidents.updated_at` so unchanged incidents hit cache forever, not just 24h. Open question #2.
4. **Tool-use forcing failures.** Anthropic occasionally refuses `tool_choice: { type: 'tool' }` for edge content (a worker incident with sensitive descriptions). Mitigation: fall back to `tool_choice: { type: 'any' }` and validate the chosen tool name server-side. Same pattern as 9c risk #3.
5. **Verification-method suggestion may be too generic.** The five enums are coarse-grained; a smart suggestion needs the CAPA description + the original finding context + the verifier's role. Mitigation: include all three in the payload; if confidence < 0.6, suppress the suggestion and ask for human pick.
6. **Wand discoverability.** Four wands across four pages is easy to miss. Onboarding tooltips on first wand visit could help, but per the existing rule "no tour overlay libraries," a tooltip-on-hover is the limit. Track impression-vs-click; <10% click-through means we should add an inline empty-state tile pointing at the wand.
7. **Reportability pane breaks the OSHA-300 print layout.** The existing `<PrintButton>` flow assumes a fixed row height. Mitigation: the pane is `print:hidden` in CSS — only renders on screen, not in print preview.

---

## Open questions to confirm before implementing

1. **Wand 5 (CAPA metadata) in or out?** Master plan lists it as 9d; CLAUDE.md status line drops it. If in, we add one Sonnet surface; if out, we defer to 9.1 and ship the four core wands. Recommend: **in**, because it's the most natural follow-on from 9c (investigation → CAPA) and the modal is the obvious anchor.
2. **Reportability cache key.** Cache by `incident.updated_at` (forever-cache while incident unchanged) or by `created_at + 24h` (rolling 24h cache regardless of mutation)? Recommend: **`updated_at`-keyed**, because reassessment is always available via `[Re-assess]`.
3. **Reportability auto-load on first OSHA-300 view.** Auto-load all rows in parallel on page load (heavy first-paint), or lazy-load each row on hover/click (slower discovery)? Recommend: **auto-load with parallelism cap of 5**, balanced against the daily budget.
4. **Wand 1 placement — above or below the grid?** Above keeps the suggestion visible as the human picks; below feels less anchoring. Recommend: **above**, with the rationale-text below the grid so the user can re-read after picking.
5. **Wand outcome on Edit.** Today's plan: outcome=`edited` with `{ before: suggestion, after: human }` diff. Alternative: track `edited` only if the human picks something *non-equivalent* (e.g. different severity *band* not just different cell). Recommend: **strict cell-level diff**, simpler and more honest in the audit log.
6. **Reportability for non-recordable incidents.** Should the wand even render on a clearly-non-recordable incident (e.g. minor first-aid only), or only when there's any ambiguity? Recommend: **always render**, because the model's "not_reportable, confidence 99%" is a useful audit artifact.

---

## Verification

```bash
pnpm install        # no new deps in 9d
pnpm dev
# walk Definition of Done → smoke test items above
```

PR title: `feat: phase 9d — argus magic wands`. Squash-merge into `main` per `.claude/rules/github-workflow.md`. After merge: update `docs/BUILD_STATUS.md`, `CLAUDE.md` build-status one-liner, and write memory `project_phase_9d_argus_magic_wands.md`.
