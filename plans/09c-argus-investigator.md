# Phase 9c — Argus AI Investigator

**Status:** scoped 2026-05-10.
**Goal:** A one-shot deep-analysis workspace on `/investigations/[id]` that turns the incident description + witness statements into a structured investigation draft (timeline, 5-Why chain, root-cause summary, findings narrative) the human reviews, edits, and pushes section-by-section into the existing investigation fields. Sonnet 4.6, streamed, behind a hard review-and-edit gate.
**Branch:** `feat/phase-9c-argus-investigator`
**PR target:** `main`
**Depends on:** Phase 9a (foundation), Phase 9b (copilot patterns + tools registry + voice hook)
**Master plan:** `plans/09-argus-ai-assistant.md` → 9c row.

---

## Context — what 9c is and what it isn't

**Is:** a *generation* workspace. The investigator pastes the incident description, drops in witnesses (text or voice), clicks Generate once, and Sonnet 4.6 returns a single structured draft. Human edits in place, then clicks per-section Push to commit.

**Isn't:**
- A chat. No multi-turn refinement loop in 9c. Re-Generate is a fresh call.
- A side-effecting agentic loop like 9b's Copilot. There's exactly one model call per Generate; no tool-execution roundtrips.
- A CAPA generator. That's 9d (`<ArgusMagicWand>` on CAPA Type/Title).
- An auto-pusher. Nothing reaches `investigations.findings` / `root_cause_summary` / `rca_whys` until the user clicks Push on a section. Locked by the 2026-05-10 hard rule "Argus is assistive, not authoritative."

The output uses the `tool_use` mechanism for **structured output only** — the "tool" is `propose_investigation_draft` with no server-side `execute()`. The route handler captures the model's `tool_use.input` and streams it back as the data payload. This guarantees a typed shape (timeline / whys / root_cause / findings) instead of free-form prose to regex.

---

## Surface placement

A **new tab** `ai` on `/investigations/[id]`, between Findings and Timeline. Sparkles icon, cyan accent (`#00D4FF`, the Phase 9 Argus accent per design.md). Visible only when:

- `orgs.argus_enabled = true`
- caller has `argus:use`
- caller has `investigation:edit` on the site
- investigation is **not closed** (a closed investigation is read-only; AI drafts would imply re-opening, out of scope)

Why a tab and not the inline strip pattern from 9b: the Investigator workspace owns its full viewport — input panel above, four output cards below, all editable. Doesn't share screen real-estate with another form.

No floating FAB (consistent with 9b — the global topbar Sparkles is the org-wide chat surface; per-page Argus surfaces are inline).

---

## UX flow

```
┌─ /investigations/IR-014 → tab=ai ────────────────────────────────────────────┐
│                                                                              │
│  ┌─ Source material ──────────────────────────────────────────────────────┐  │
│  │  Incident description (read-only seed):                                │  │
│  │    "Worker JS slipped on oil patch in Bay 3, fractured wrist…"         │  │
│  │    Type: injury · Area: Bay 3 · Occurred: 2026-05-08 14:22             │  │
│  │                                                                        │  │
│  │  Add detail (voice 🎙 or paste):       [textarea, mic button]          │  │
│  │  Witness statements:                                                   │  │
│  │   • TM (foreman): "Saw the spill 30 min before…"      [edit] [delete]  │  │
│  │   • RK (operator): "I reported the leak yesterday."   [edit] [delete]  │  │
│  │   [+ Add witness statement (voice or text)]                            │  │
│  │                                                                        │  │
│  │   ─────────────────────────────────                                    │  │
│  │   [✨ Generate timeline + RCA]   ← Sonnet 4.6, ~10–20s stream          │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─ Argus draft (review & edit before pushing) ───────────────────────────┐  │
│  │  ⚡ Generated 2026-05-10 11:42 from 4 witness statements + paste       │  │
│  │                                                                        │  │
│  │  ┌─ Timeline ─────────────────────────────────────[Push] [Reject]──┐   │  │
│  │  │ • 2026-05-07 16:00 — RK reported hydraulic leak under press 3.  │   │  │
│  │  │ • 2026-05-08 13:50 — TM noticed oil patch in Bay 3.             │   │  │
│  │  │ • 2026-05-08 14:22 — JS slipped in Bay 3, fractured wrist.      │   │  │
│  │  │   [editable textarea]                                           │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─ 5-Why chain ──────────────────────────────────[Push] [Reject]──┐   │  │
│  │  │ Why #1 Q: Why did JS slip?    A: Oil on Bay 3 floor.            │   │  │
│  │  │ Why #2 Q: Why was oil there?   A: Leak from press 3 hydraulic.  │   │  │
│  │  │ Why #3 …                                                        │   │  │
│  │  │   [each Q+A is its own pair of editable inputs]                 │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─ Root cause summary ───────────────────────────[Push] [Reject]──┐   │  │
│  │  │ [editable textarea, ~3 sentences]                               │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  ┌─ Findings narrative ───────────────────────────[Push] [Reject]──┐   │  │
│  │  │ [editable textarea, multi-paragraph]                            │   │  │
│  │  └─────────────────────────────────────────────────────────────────┘   │  │
│  │                                                                        │  │
│  │  [Discard entire draft]                                                │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Push semantics**

- *Push timeline* → prepended to `findings` under a `## Timeline` heading (no separate `timeline` column). If `findings` already has content, the user is shown a confirm dialog (Replace / Append / Cancel).
- *Push 5-Why chain* → `saveWhy` for each level (1–5) sequentially. Existing answers are overwritten (confirm dialog if any level is non-empty).
- *Push root cause* → `saveInvestigationText('root_cause_summary')`.
- *Push findings* → `saveInvestigationText('findings')` (overwrites; same confirm if non-empty).
- Each Push fires `revalidatePath` already, so the underlying tabs (Why / Findings) reflect the change as soon as the user navigates back.

**Discard** drops the client-side draft and writes `argus_suggestions.outcome='rejected'` for the row.

---

## Architecture

### Route handler — `app/api/argus/investigator/route.ts`

POST `{ investigationId, paste, witnessAdds: [{name, contact?, statement}] }`

Server flow:

1. `runArgusGates("investigator")` — heavy bucket (3 calls/min/user), `argus:use`, org budget, key configured.
2. Read investigation + incident + existing witnesses (`witnesses.incident_id`).
3. Permission check: caller must have `investigation:edit` on `inv.site_id`.
4. Build the **known-names list** for redaction: injured persons + existing witnesses + `witnessAdds[*].name` + investigation lead profile + caller. Map full name → initials.
5. Redact: incident description + each existing witness statement + `paste` + each `witnessAdds[*].statement` via `redactText()`.
6. Construct prompt: system prompt from `lib/argus/system-prompts/investigator.md` (prompt-cached `ephemeral`), then a single user message with structured sections (`# Incident`, `# Witness statements`, `# Additional context`).
7. Call `messages.stream({ model: MODEL_SONNET, max_tokens: 4096, tools: [proposeInvestigationDraftTool], tool_choice: { type: 'tool', name: 'propose_investigation_draft' }, ... })`. Forcing `tool_choice` guarantees the model emits exactly one `tool_use` block matching our schema.
8. Stream `event: progress` SSE frames as input tokens come in (just for UI thinking dots — we do NOT stream the JSON body deltas because the model is building a tool_use block, not free text).
9. On `finalMessage()`: extract the single `tool_use` block's `input` → emit `event: draft data: {...payload}`.
10. Log to `argus_suggestions`: `surface='investigator'`, `target_kind='investigation'`, `target_id=investigationId`, `model=MODEL_SONNET`, `outcome='pending'`, `payload = { kind: 'draft', input: {paste, witnessAdds}, output: {...tool input} }`.
11. Insert `activity_events` row: `verb='argus.investigator_drafted'`, `actor_kind='argus'`, `investigation_id`, `incident_id`, `payload={ tokens, model }`. Keeps the timeline tab honest about every AI touch.
12. `event: done`.

No agentic loop. One model call. If the model fails to emit the tool_use (extremely rare with `tool_choice` forced), surface `event: error` with a friendly message.

**Why not also stream tokens?** The model output is a structured `tool_use` JSON object, not prose. Streaming half-formed JSON deltas would require a partial-JSON parser on the client and breaks the "single payload" review model. The progress event is enough — it gives the user "thinking…" feedback while waiting 10–20s for Sonnet.

### Tool — `lib/argus/tools/propose-investigation-draft.ts`

Structured-output tool only. No server-side `execute()` — the route handler captures `input` directly. Add it to a new `INVESTIGATOR_TOOLS` map alongside the existing `COPILOT_TOOLS` (do not pollute the Copilot's tool list).

```ts
input_schema = {
  type: "object",
  required: ["timeline", "whys", "root_cause_summary", "findings"],
  properties: {
    timeline: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["event"],
        properties: {
          at: { type: "string", description: "ISO-8601 timestamp if known, else omit" },
          relative_order: { type: "integer", description: "Used when at is absent; ascending order" },
          event: { type: "string", maxLength: 500 }
        }
      }
    },
    whys: {
      type: "array",
      minItems: 5, maxItems: 5,
      items: {
        type: "object",
        required: ["level", "question", "answer"],
        properties: {
          level: { type: "integer", minimum: 1, maximum: 5 },
          question: { type: "string", maxLength: 2000 },
          answer:   { type: "string", maxLength: 5000 }
        }
      }
    },
    root_cause_summary: { type: "string", maxLength: 20000 },
    findings:           { type: "string", maxLength: 20000 },
    insufficient_input: {
      type: "string",
      description: "If input is too thin to draft responsibly, set this to a one-line explanation and leave the four output fields empty arrays/strings."
    }
  }
}
```

If the model returns `insufficient_input` non-empty, the client renders the explanation and skips the output cards entirely.

### System prompt — `lib/argus/system-prompts/investigator.md`

Hard rules to encode (write the file with these as the spine):

1. Only use information given in the user message. **If a fact is not in the input, do not invent it.** No assumed weather, time of day, equipment age, prior incidents, or causes you weren't told.
2. The 5-Why must drill from immediate cause (Why #1) to root cause (Why #5). Each answer becomes the question for the next level (rephrased). If you can't drill 5 levels deep on the input given, set `insufficient_input` and explain what's missing.
3. Timeline is chronological. Use ISO timestamps where the input gave them; otherwise use `relative_order` integers ascending.
4. Findings is a multi-paragraph, regulator-readable narrative — what happened, contributing factors, what was learned. **Plain English. No jargon. No corporate hedging.**
5. Names are referred to by role + initials only (the redactor strips known full names before you see them — do not undo this by guessing).
6. If the combined input is < ~50 words OR has zero witness statements / paste content, set `insufficient_input` to "Need at least the incident description plus one witness statement or additional detail." Do not generate.

### Component tree

```
components/argus/
  argus-investigator.tsx            ← workspace shell, owns state + fetch
  argus-investigator-input.tsx      ← seed display, paste textarea, witness list
  argus-investigator-output.tsx     ← four review cards (timeline, whys, root cause, findings)
  argus-investigator-witness.tsx    ← single witness add/edit row with mic
  use-argus-investigator-stream.ts  ← thin SSE hook around fetch (not the 9a useArgusStream — separate event shape)
```

Reuses from 9b: `<VoiceButton>`, `useVoice()` hook, the cyan-accent style tokens.

`<ArgusInvestigator>` props: `{ investigationId, incidentId, seed: { description, type, area, location, occurredAt }, existingWitnesses, knownNamesForDisplay }`.

### Page integration

```tsx
// app/(app)/investigations/[id]/page.tsx
const tab = ... // existing logic now allows "ai" key
const showArgusTab = (await orgCan("argus:use")) && org.argus_enabled && canEdit && !isClosed;

<DetailTabs current={tab} basePath={basePath} extraTabs={showArgusTab ? ["ai"] : []} />

{tab === "ai" && showArgusTab && (
  <ArgusInvestigator
    investigationId={inv.id}
    incidentId={incident.id}
    seed={{ description: incident.description, type: incident.type, area: incident.area, location: incident.location, occurredAt: incident.occurred_at }}
    existingWitnesses={statements}                 // already fetched on Summary; lift to always-fetch when tab=ai
    initialDraft={null}
  />
)}
```

`detail-tabs.tsx`: add `ai` to `DETAIL_TABS` with Sparkles icon, cyan-accent active state, and tab-tooltip "AI Investigator". Filter out by `extraTabs` when not enabled.

### Server actions reused (no new actions needed)

- `saveInvestigationText({ field: 'findings' | 'root_cause_summary', value })`
- `saveWhy({ investigation_id, level, question, answer })`

Push handlers call these directly; no new write paths. After every successful Push the client also fires a small `acceptArgusSuggestion(suggestionId, { section, edited })` server action that flips `argus_suggestions.outcome` and writes a `verb='argus.investigator_pushed'` activity event with `actor_kind='human'`.

New small action — `app/(app)/investigations/[id]/argus-actions.ts`:

```ts
"use server";
export async function acceptArgusSuggestion({ suggestionId, section, wasEdited }): ActionResult { ... }
export async function rejectArgusSuggestion({ suggestionId }): ActionResult { ... }
```

Both gate on `argus:use` + `investigation:edit`; both `revalidatePath` the investigation. Diff payload (`{ before, after }`) attached to the activity event payload when `wasEdited=true` for audit.

---

## Schema

**No migration.** All required tables/columns exist from 9a:

- `argus_suggestions` — used as-is. New surface value `'investigator'` (the column is `text`, not enum, so no ALTER needed).
- `activity_events.actor_kind` — used as-is.
- `investigations.findings`, `investigations.root_cause_summary`, `rca_whys.*` — already exist from Phase 2.
- `witnesses` — already exists from Phase 1.

Two new activity verbs (no schema change — `verb` is `text`):

- `argus.investigator_drafted` (actor_kind='argus')
- `argus.investigator_pushed` (actor_kind='human')

---

## Permissions

Single new `argus:use` check (already seeded on all four default roles). Push actions inherit `investigation:edit` from the existing `saveInvestigationText` / `saveWhy`. **No new permission keys.**

---

## File deltas

**New**

```
app/api/argus/investigator/route.ts
lib/argus/system-prompts/investigator.md
lib/argus/tools/propose-investigation-draft.ts
components/argus/argus-investigator.tsx
components/argus/argus-investigator-input.tsx
components/argus/argus-investigator-output.tsx
components/argus/argus-investigator-witness.tsx
components/argus/use-argus-investigator-stream.ts
app/(app)/investigations/[id]/argus-actions.ts
```

**Modified**

```
app/(app)/investigations/[id]/page.tsx           (add tab + mount, lift witness fetch when tab=ai, fetch org argus_enabled)
components/investigations/detail/detail-tabs.tsx (add 'ai' tab key + Sparkles + cyan accent, gated by extraTabs prop)
lib/argus/tools/index.ts                         (export INVESTIGATOR_TOOLS map alongside COPILOT_TOOLS)
docs/SPEC.md                                     (§17 Argus subsection — Investigator surface, model, redaction, audit)
docs/ui-flow.md                                  (note new tab on /investigations/[id])
docs/BUILD_STATUS.md                             (Phase 9c entry on merge)
CLAUDE.md                                        (build status one-liner update on merge)
```

**Memory (on merge)**

- New: `project_phase_9c_argus_investigator.md`
- Update: `project_overview.md` (state line), `MEMORY.md` (index)

---

## Hard rules carried forward

All six 9.0 hard rules from the master plan apply unchanged. The two that bind hardest in 9c:

- **Rule 1 — assistive, not authoritative.** Every draft section is editable. Push requires explicit per-section human click. Nothing reaches `findings` / `root_cause_summary` / `rca_whys` until that click. Reject is a first-class option.
- **Rule 5 — PII redaction.** Witness statements are dense with names. Redactor strips known names from injured persons + witnesses + lead + caller before egress. Free-text re-leak is acknowledged as residual risk in SPEC §17.
- **Rule 7 (master plan risk #7) — hallucination defense.** System prompt forbids invention; input gate requires ≥1 witness OR ≥50-word paste; `insufficient_input` escape valve so the model can refuse cleanly.

---

## Definition of Done

- AI tab renders on `/investigations/[id]?tab=ai` for users with `argus:use` + `investigation:edit` on a non-closed investigation; hidden otherwise.
- With `argus_enabled=false` on the org, the tab is hidden.
- Empty input (no paste, no witnesses, no incident description) → Generate disabled; tooltip explains why.
- Generate streams progress, then renders four output cards within ~25s on a normal-sized incident.
- Each card is editable inline; per-card Push commits via existing server actions and writes `activity_events` (`actor_kind='human'`).
- `argus_suggestions` row written on Generate (`outcome='pending'`); flipped to `accepted` / `edited` / `rejected` on Push or Discard. Diff payload attached when edited before push.
- Generate writes one `activity_events` row with `actor_kind='argus'` and `verb='argus.investigator_drafted'`.
- Heavy rate limit (3/min/user) enforced via `runArgusGates("investigator")`.
- Org daily token budget enforced; soft warn surfaced in the tab when ≥80%.
- PII redaction: DevTools network request shows initials, not full names, for known witnesses + injured persons.
- `pnpm build` clean; types regenerate (no migration so `pnpm db:types` not strictly needed).
- Smoke walked: existing investigation, paste sample text + 1 witness, Generate, edit one Why answer, Push 5-Why → DB rows updated; verify via `pnpm db:check` or Supabase SQL editor.
- All 9b copilot flows still work (regression).
- Dark mode renders the workspace correctly with cyan accent visible.

---

## Smoke test (run before opening PR)

- [ ] `pnpm dev` boots clean.
- [ ] Visit `/investigations/<closed_id>?tab=ai` → URL still resolves but tab is hidden, content falls back.
- [ ] Visit `/investigations/<open_id>?tab=ai` as a worker without `argus:use` → tab hidden.
- [ ] Set `orgs.argus_enabled=false` → tab hidden everywhere.
- [ ] Empty inputs → Generate disabled with hint "Add at least one witness statement or paste-in detail."
- [ ] Generate with thin input → model returns `insufficient_input`; output cards do NOT render; explanation banner does.
- [ ] Generate with rich input → all four cards populate; cyan-accent streaming indicator appears during the call.
- [ ] Edit Why #2 answer; Push 5-Why; verify all 5 rows in `rca_whys` match the (edited) draft; verify `argus_suggestions.outcome='edited'` and `activity_events` shows the diff.
- [ ] Push Findings without edits → `outcome='accepted'`; verify `findings` matches draft verbatim.
- [ ] Push Root Cause; verify `root_cause_summary` updated.
- [ ] Push Timeline against an investigation that already has findings → confirm dialog Replace/Append/Cancel; choosing Append prepends `## Timeline` block above existing.
- [ ] Reject a card → `outcome='rejected'`; nothing persisted; activity event written.
- [ ] Network tab: confirm full names (e.g. "John Smith") appear redacted as initials ("JS") in the request body.
- [ ] Trigger 4 Generates within 60s → 4th returns 429 with friendly toast.
- [ ] Investigations Timeline tab now shows `Argus drafted investigation` (cyan badge) and `<user> pushed Argus draft to <section>` rows.
- [ ] Cache Components: no Suspense errors, no `runtime` exports on the route handler.
- [ ] Closed investigation: `?tab=ai` resolves to Summary fallback; no AI tab in nav.

---

## Out of scope (deferred to 9.1+)

- Multi-turn refinement chat with the draft.
- AI-suggested CAPA from the investigation (this is 9d, not 9c).
- Document evidence ingest into the prompt (PDF extraction etc.) — too costly + brittle for v1.
- PDF export of the AI draft as a standalone deliverable.
- Conversation persistence — each Generate session is ephemeral and held client-side until pushed; refreshing the tab loses an unpushed draft.
- Multi-language witness statements.
- Live audio transcription mid-Generate (use Web Speech API at input time only).

---

## Risks

1. **Hallucination on thin input.** Mitigated by input gate + system-prompt rule + `insufficient_input` escape. Watch acceptance rate post-merge — if users routinely Push unchanged from a thin input, tighten the gate.
2. **Sonnet cost.** ~$0.015 per Generate at 2k input + 2k output tokens. The 5M-token org daily cap absorbs ~250 Generates before hitting the limit. Per-user 3/min rate limit prevents abuse. Monitor `argus_suggestions` weekly.
3. **Tool-use forcing edge cases.** Anthropic occasionally refuses `tool_choice: { type: 'tool' }` for "harmful" content. If detected, fall back to `tool_choice: { type: 'any' }` and validate the chosen tool name server-side.
4. **Witness PII leakage in free-text.** A witness statement saying "John from accounting" won't be caught by the known-names list unless John is a profile in the org. Document this explicitly in SPEC §17 — Anthropic no-training is the actual backstop.
5. **Push-to-empty-investigation surprise.** Users may not realize Push overwrites. The confirm dialog on non-empty target fields handles this; for empty target fields we just write — no friction.
6. **Tab discoverability.** A new tab among 5 is easy to miss. Add a one-time "New: AI Investigator" toast on first visit to `/investigations/[id]` for users with `argus:use` (use a `profiles.has_seen_ai_investigator_hint` boolean if needed — defer to 9.1 unless engagement is poor).
7. **Streaming-but-not-streaming UX.** Because we capture a tool_use block (not text), the user sees "thinking" for 10–20s then a sudden full draft. We can soften this with a typewriter reveal on the rendered cards client-side. Easy follow-up if it feels jarring.

---

## Open questions to confirm before implementing

1. **Tab placement** — confirm `ai` between Findings and Timeline (alternative: between Summary and Why, but that interrupts the natural Summary→Why progression).
2. **Replace vs append on Push** — confirm the confirm-dialog approach over hard-replace or hard-append.
3. **Discoverability hint** — ship a one-time toast in 9c, or wait for 9.1?
4. **Re-Generate behavior** — does a fresh Generate write a *new* `argus_suggestions` row (current plan) or update the existing pending one? Current plan = new row, keeps full audit history.
5. **Witness add via this tab** — should witnesses added in the AI input panel also write to the `witnesses` table immediately, or stay client-side? Current plan = client-side until first Push, then witness adds get persisted via `addWitnessStatement` server action as part of the push flow. This avoids polluting `witnesses` with abandoned drafts.

---

## Verification

```bash
pnpm install        # no new deps in 9c
pnpm dev
# walk Definition of Done → smoke test items above
```

PR title: `feat: phase 9c — argus ai investigator`. Squash-merge into `main` per `.claude/rules/github-workflow.md`. After merge: update `docs/BUILD_STATUS.md`, `CLAUDE.md` build-status one-liner, and write memory `project_phase_9c_argus_investigator.md`.
