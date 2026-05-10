# Phase 9d — Argus Magic Wands + LLM Provider Pivot to Gemini

**Status:** scoped 2026-05-10. Revised 2026-05-10 to absorb the LLM provider pivot (Anthropic → Gemini, behind a provider-agnostic abstraction).
**Goal (two parts):**

1. **Foundation refactor.** Introduce `lib/argus/llm/` — a provider-agnostic LLM abstraction (interface + Gemini adapter as v1 implementation). Rip the `@anthropic-ai/sdk` dependency out of 9a/9b/9c, re-mount the Copilot route handler and Investigator route handler on the abstraction, and migrate every model name + tool-use call site. **9b and 9c must continue to pass their existing smoke tests after this refactor.**
2. **Magic wands.** Drop a single, reusable `<ArgusMagicWand>` button next to the four (or five) load-bearing decisions in the workflow — risk-matrix cell, finding→incident severity, CAPA verification method, and OSHA/RIDDOR reportability — built on top of the new abstraction. Single `<SuggestionCard>` component (Accept / Edit / Reject). Nothing auto-commits; every wand resolves through the same form fields the human already had.

**Branch:** `feat/phase-9d-argus-magic-wands`
**PR target:** `main`
**Depends on:** Phase 9a (foundation: schema, `argus_suggestions`, `activity_events.actor_kind`, `argus:use`, redactor, gates, budget, ratelimit), Phase 9b (Copilot route + tools registry + voice hook), Phase 9c (Investigator route + per-card Push pattern + confirm dialogs)
**Master plan:** `plans/09-argus-ai-assistant.md` → 9d row, with provider notes carried forward as a SPEC §15 amendment dated 2026-05-10.

---

## Context — what 9d is and what it isn't

**Is:**
- A *provider migration* phase. The shipped 9a/9b/9c code is hard-wired to `@anthropic-ai/sdk` (`client.ts`, `stream.ts`, `gates.ts`, `app/api/argus/copilot/route.ts`, `app/api/argus/investigator/route.ts`). 9d introduces a thin abstraction (`generateStructured`, `streamText`) and migrates every call site. Gemini is the v1 adapter. Adding OpenAI later is a new file with no caller changes.
- The *inline classifier* phase. Each wand is a one-shot, structured-output call (forced function-calling on Gemini's side) that returns a single small payload — a matrix coord, an enum value, a couple of text fields, or a reportability verdict — plus a confidence score and a one-paragraph rationale. The form field next to the wand stays untouched until the human clicks Accept.

**Isn't:**
- A chat. No multi-turn refinement. Re-asking is a fresh call.
- An agentic loop. Zero tools have a server-side `execute()` — the route handler captures the function-call arguments and returns them as the data payload (same pattern 9c established for `propose_investigation_draft`).
- An auto-applier. None of the four (or five) surfaces commits without the user's explicit Accept click. Severity classification, finding→incident promotion, verification method, and OSHA/RIDDOR reportability all stay human-signed (Hard Rule 1).
- A new permission surface. Every wand gates on `argus:use` for the *suggestion* and on the underlying permission (`incident:create`, `capa:create`, `capa:verify`, `report:read`, etc.) for the *action* the human takes after accepting.
- A multi-provider runtime. The abstraction *can* hold multiple adapters; v1 ships Gemini only. Adding OpenAI is a follow-up PR if/when the user wants it.

The Reportability pane is intentionally **read-only** — it shows confidence and the relevant 29 CFR Appendix A or RIDDOR Schedule 2 citation, but it does not gate, change, or pre-fill anything on the OSHA-300 / OSHA-300A / OSHA-301 / RIDDOR-F2508 forms.

---

## Provider pivot — rationale & the SPEC §15 amendment

**Why Gemini:**
- Cost. Gemini 2.5 Flash is ~5× cheaper per output token than Claude Haiku 4.5 ($2.50/M vs $5/M, exact rates verified at install time). The 9a-sized 5M-token daily budget buys roughly 5× more usage at Flash rates.
- Single-key dev experience. The user's existing infra has Gemini available; Anthropic key was the blocker for 9a/9b/9c going live.
- Long-context Pro. Gemini 2.5 Pro's 1M-token context absorbs the entire investigation + every linked document if we ever want it (out of scope in 9.0, but a free upside).

**What we lose:**
- *Anthropic prompt caching is free + automatic on 5-min ephemeral blocks.* Gemini's `cachedContents` is explicit, paid, and has a ~32K-token minimum — uneconomical for our ~1–2K system prompts. **9d skips caching entirely.** When per-org token usage gets high enough that the system prompt dwarfs the per-call payload, revisit in a follow-up.
- The `tool_choice: { type: 'tool', name: ... }` ergonomics. Gemini's equivalent is `toolConfig.functionCallingConfig = { mode: 'ANY', allowedFunctionNames: [name] }` — same effect, more verbose. Hidden behind the abstraction.
- Some JSONSchema features (`oneOf`, `anyOf`, `$ref`, draft-2020 conditionals). Our schemas are all basic enough to land cleanly in Gemini's OpenAPI-3.0 subset.

**SPEC §15 amendment to add (in this PR):**
> 2026-05-10 — LLM provider switched from Anthropic to Gemini, behind a `lib/argus/llm/` abstraction. Reasons: cost, key availability. The "Argus is assistive, not authoritative" hard rule (2026-05-10 first entry) is unaffected. Prompt caching dropped in v1 — Gemini's explicit cache has a 32K-token floor that doesn't fit our prompt sizes; revisit when load justifies it.

`CLAUDE.md` hard rules need one mechanical update: any reference to Sonnet/Haiku/Anthropic in the Argus rules block becomes provider-agnostic ("the configured Argus model" or "Gemini Pro / Flash" by tier).

---

## Foundation refactor — LLM provider abstraction

### Interface — `lib/argus/llm/types.ts`

```ts
export type ModelTier = 'fast' | 'smart';
// 'fast' → cheap classifier (Gemini 2.5 Flash today)
// 'smart' → reasoning + long-context (Gemini 2.5 Pro today)

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchemaSubset;  // OpenAPI 3.0 subset; documented in adapter
}

export interface GenerateStructuredArgs<T> {
  surface: ArgusSurface;
  tier: ModelTier;
  system: string;
  user: string;
  tool: ToolDefinition;
  maxOutputTokens?: number;
  thinking?: 'auto' | 'off';   // Gemini 2.5 Pro thinks by default; off = lower latency, lower cost
}

export interface GenerateStructuredResult<T> {
  output: T;
  modelUsed: string;            // e.g. 'gemini-2.5-flash'
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;  // 0 for now (no caching)
    thinkingTokens: number;     // 0 when thinking off
  };
  raw?: unknown;                // adapter-specific raw response, for debug
}

export interface StreamTextArgs {
  surface: ArgusSurface;
  tier: ModelTier;
  system: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  tools?: ToolDefinition[];
  maxOutputTokens?: number;
}

export interface StreamTextResult {
  textChunks: AsyncIterable<string>;
  finalMessage: () => Promise<{
    text: string;
    toolCalls: { name: string; arguments: unknown }[];
    usage: GenerateStructuredResult<unknown>['usage'];
    modelUsed: string;
  }>;
}

export interface LLMProvider {
  name: 'gemini' | 'openai' | 'anthropic';
  generateStructured<T>(args: GenerateStructuredArgs<T>): Promise<GenerateStructuredResult<T>>;
  streamText(args: StreamTextArgs): Promise<StreamTextResult>;
  isConfigured(): boolean;
}
```

`generateStructured` covers every wand (one-shot, forced function call, typed payload). `streamText` covers the Copilot agentic loop (9b) and stays one method for both providers. The Investigator (9c) currently uses Anthropic's stream-with-forced-tool — we'll route that through `generateStructured` instead, since it never streams JSON deltas to the client (per 9c's own design note).

### Adapter — `lib/argus/llm/gemini-adapter.ts`

```ts
import { GoogleGenAI, Type } from '@google/genai';

const MODEL_FAST  = 'gemini-2.5-flash';
const MODEL_SMART = 'gemini-2.5-pro';

export class GeminiAdapter implements LLMProvider {
  name = 'gemini' as const;
  private client: GoogleGenAI | null = null;

  isConfigured() { return Boolean(process.env.GEMINI_API_KEY); }

  private getClient() {
    if (!this.client) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new ArgusOfflineError('GEMINI_API_KEY is not set');
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  async generateStructured<T>(args: GenerateStructuredArgs<T>) {
    const model = args.tier === 'smart' ? MODEL_SMART : MODEL_FAST;
    const response = await this.getClient().models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: args.user }] }],
      config: {
        systemInstruction: args.system,
        tools: [{ functionDeclarations: [toGeminiFn(args.tool)] }],
        toolConfig: {
          functionCallingConfig: {
            mode: 'ANY',
            allowedFunctionNames: [args.tool.name],
          },
        },
        maxOutputTokens: args.maxOutputTokens ?? 1024,
        thinkingConfig: args.thinking === 'off' ? { thinkingBudget: 0 } : undefined,
      },
    });

    const call = response.functionCalls?.[0];
    if (!call || call.name !== args.tool.name) {
      throw new ArgusInvalidResponseError(`Gemini did not call ${args.tool.name}`);
    }

    return {
      output: call.args as T,
      modelUsed: model,
      usage: {
        inputTokens:        response.usageMetadata?.promptTokenCount  ?? 0,
        outputTokens:       response.usageMetadata?.candidatesTokenCount ?? 0,
        cachedInputTokens:  response.usageMetadata?.cachedContentTokenCount ?? 0,
        thinkingTokens:     response.usageMetadata?.thoughtsTokenCount ?? 0,
      },
      raw: response,
    };
  }

  async streamText(args: StreamTextArgs) {
    const model = args.tier === 'smart' ? MODEL_SMART : MODEL_FAST;
    const stream = await this.getClient().models.generateContentStream({
      model,
      contents: args.messages.map(toGeminiContent),
      config: {
        systemInstruction: args.system,
        tools: args.tools?.length ? [{ functionDeclarations: args.tools.map(toGeminiFn) }] : undefined,
        maxOutputTokens: args.maxOutputTokens ?? 2048,
      },
    });
    return adaptGeminiStream(stream, model);
  }
}

function toGeminiFn(t: ToolDefinition) {
  return { name: t.name, description: t.description, parameters: t.parameters };
}
```

JSONSchema → Gemini schema mapping is a lossy translation: drop `oneOf`/`anyOf`/`$ref`, normalise types, propagate `enum`/`minimum`/`maximum`/`minItems`/`maxItems`. A small `lib/argus/llm/schema.ts` helper handles this once.

### Singleton — `lib/argus/llm/index.ts`

```ts
import { GeminiAdapter } from './gemini-adapter';

let _provider: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (!_provider) _provider = new GeminiAdapter();
  return _provider;
}
```

When OpenAI is added, this file branches on `process.env.ARGUS_PROVIDER` (default `gemini`).

### Migration — `lib/argus/client.ts` and `models.ts`

- **`lib/argus/client.ts`** — replace `getArgusClient()` (Anthropic singleton) with a re-export of `getLLM()` for backward compatibility, plus deprecate the old name. Keep `ArgusOfflineError` as the shared offline marker.
- **`lib/argus/models.ts`** — replace `MODEL_HAIKU = 'claude-haiku-4-5'` etc. with `TIER_FAST = 'fast'`, `TIER_SMART = 'smart'`. `MODEL_BY_SURFACE` becomes `TIER_BY_SURFACE`:
  ```ts
  export const TIER_BY_SURFACE = {
    copilot: 'fast',
    severity: 'fast',
    capa_method: 'fast',
    finding_escalation: 'fast',
    document_classifier: 'fast',
    investigator: 'smart',
    capa_draft: 'smart',
    reportability: 'smart',
    risk_matrix: 'fast',
    finding_severity: 'fast',
    verification_method: 'fast',
    capa_metadata: 'smart',
  } as const;
  ```

### Migration — `lib/argus/stream.ts`

Currently wraps `MessageStream` from `@anthropic-ai/sdk`. Rewrite to wrap the `StreamTextResult` shape from the new abstraction. Public API of the file (`streamArgusToSSE(...)`, etc.) stays the same so route handlers don't break — just the internal type imports flip.

### Migration — `lib/argus/gates.ts`

Currently imports `Anthropic` for type-only references. Replace with the abstraction's types. No runtime change.

### Migration — `app/api/argus/copilot/route.ts` (9b)

The Copilot agentic loop today calls `client.messages.create(...)` in a loop, executing tools server-side and feeding tool_results back. Rewrite to:

```ts
const llm = getLLM();
let messages = [...];
for (let turn = 0; turn < MAX_TURNS; turn++) {
  const result = await llm.streamText({ surface: 'copilot', tier: 'fast', system, messages, tools });
  // pipe textChunks to SSE
  const final = await result.finalMessage();
  if (final.toolCalls.length === 0) break;
  for (const call of final.toolCalls) {
    const toolResult = await executeCopilotTool(call.name, call.args, ctx);
    messages.push({ role: 'assistant', content: /* function call */ });
    messages.push({ role: 'user',      content: /* function result */ });
  }
}
```

Gemini's function-calling protocol uses `functionCall` + `functionResponse` parts inside the `contents` array (vs Anthropic's `tool_use` + `tool_result` content blocks). The adapter normalises both onto the abstraction's `messages` shape; the route handler doesn't see Gemini-specific syntax.

### Migration — `app/api/argus/investigator/route.ts` (9c)

Current 9c is a single forced-tool call with non-streaming JSON output. This maps cleanly onto `generateStructured`:

```ts
const llm = getLLM();
const result = await llm.generateStructured<InvestigatorDraft>({
  surface: 'investigator',
  tier: 'smart',
  system: investigatorSystemPrompt,
  user: buildInvestigatorUser(redacted),
  tool: proposeInvestigationDraftTool,
  maxOutputTokens: 4096,
  thinking: 'auto', // let Pro think on this one — output quality matters
});
// emit SSE: progress, draft, usage, done
```

The SSE wire format from 9c (`progress → draft → usage → done`) stays. The `progress` event used to fire on input-token deltas; with Gemini we'll fire it once at start ("Argus is thinking…") and then emit `draft` when the call returns. This is a small UX regression — 9c users used to see incremental progress dots; now they see one steady spinner. Acceptable.

### Tools rewrite — `lib/argus/tools/`

The existing five tool definitions (`update-incident-field`, `log-observation`, `attach-photo`, `raise-stop-work`, `propose-investigation-draft`) carry `input_schema` in Anthropic's JSONSchema-with-extras shape. Since the abstraction's `ToolDefinition.parameters` field is OpenAPI-3.0-subset, these schemas need a one-line audit each to confirm they don't use `oneOf` / `$ref` / etc. None of ours do today. The translation helper in `schema.ts` makes the conversion automatic.

### Env — `.env.local`

```
GEMINI_API_KEY=...               # NEW; required for Argus
ANTHROPIC_API_KEY=                # KEEP defined-but-empty during transition; remove once 9d ships
ARGUS_DEFAULT_DAILY_TOKEN_BUDGET=10000000   # bumped from 5M to 10M; Flash is ~5x cheaper
```

`ARGUS_PROVIDER` is reserved for future multi-provider; not read in v1.

### Package — `package.json`

- Add `@google/genai` (latest GA — verify version at install time).
- Remove `@anthropic-ai/sdk`. **Verify nothing else in the repo imports it** (`grep -rn '@anthropic-ai/sdk' .` after the migration; should return zero hits outside `node_modules`).

### Backward compatibility on `argus_suggestions.model`

The `model` column is `text`. After the migration, new rows store `gemini-2.5-flash` / `gemini-2.5-pro`. Old rows keep their `claude-*` strings — fine for audit. No migration. Add a tiny note to the audit-log reader UI (if any) that model names changed on this date.

---

## Wand surface placement

Four primary wand sites confirmed by the CLAUDE.md status line (2026-05-10). The master plan's 09 row also lists a fifth (CAPA-draft-from-investigation in the Create-CAPA modal) — flagged as Open Question #1 below.

| # | Surface | File | Wand kind | Tier | Output |
|---|---|---|---|---|---|
| 1 | 5×5 risk-matrix on Step 3 of Report Wizard | `components/risk-matrix/risk-matrix.tsx` (slot) + `components/incidents/wizard/step-3-review.tsx` (mount) | `suggest_risk_matrix` | fast | `{ likelihood: 1–5, consequence: 1–5, confidence: 0–1, rationale: string }` |
| 2 | Finding → incident escalation severity | `components/inspections/finding-actions-card.tsx` | `suggest_finding_severity` | fast | `{ likelihood: 1–5, consequence: 1–5, confidence: 0–1, rationale: string }` |
| 3 | CAPA verification method dropdown | `components/capa/detail/verification-form.tsx` | `suggest_verification_method` | fast | `{ method: 'inspection' \| 'monitoring' \| 'audit_trend' \| 're_interview' \| 'document_review', confidence: 0–1, rationale: string }` |
| 4 | OSHA reportability confidence pane (read-only) | `app/(app)/reports/osha-300/page.tsx` (per-row pane) and `app/(app)/reports/riddor-f2508/[incidentId]/page.tsx` (single-incident pane) | `assess_reportability` | smart | `{ verdict: 'reportable' \| 'not_reportable' \| 'uncertain', citation: string, confidence: 0–1, rationale: string, threshold_met: string[] }` |
| 5 *(open Q1)* | CAPA Create modal — Type + Title draft | `components/capa/capa-create-modal.tsx` | `draft_capa_metadata` | smart | `{ type: enum, title: string, suggested_owner_role?: string, confidence: 0–1, rationale: string }` |

Visibility rules apply identically to all five:

- `orgs.argus_enabled = true`
- caller has `argus:use`
- caller has the relevant write permission for the surface (e.g. `incident:create` on the wizard, `capa:verify` on verification, `capa:create` on the create modal). The Reportability pane requires `report:read`.
- (Wand 1) Step 3 is the active wizard step and the description on the draft incident is non-empty.
- (Wand 2) the finding belongs to a closed inspection and has not yet been escalated.
- (Wand 3) the CAPA is in `verifying` state with a verifier assigned and a method not yet locked.

The button uses the cyan Argus accent (`#00D4FF`) with a Sparkles icon at 16 px. Tooltip: "Suggest with Argus." Loading state spins the Sparkles. Error state collapses to inline error text below the wand, never blocks the form.

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
│  ─ once Argus responds (≤ 4s on Flash) ───────────────────────────────── │
│                                                                            │
│  ┌─ Argus suggests: Likelihood 3 × Consequence 4 = S2 (Major) ──────┐     │
│  │  Confidence 78%                                                   │     │
│  │  "Slip on liquid is moderately likely in a high-traffic bay; a    │     │
│  │  fractured wrist meets the Major (S2) consequence threshold."     │     │
│  │  [Accept]  [Edit]  [Reject]                                       │     │
│  └───────────────────────────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Accept** → calls the existing `onChange({ likelihood, consequence })`; suggestion-card collapses to a chip "Argus suggested S2 (accepted)"; `argus_suggestions.outcome='accepted'`.
- **Edit** → dismisses without applying; user picks their own cell; if picked cell ≠ suggestion, `outcome='edited'` with `{ before, after }` diff; if equal, `outcome='accepted'`.
- **Reject** → dismisses with `outcome='rejected'`.

### Wand 2 — Finding → Incident escalation severity

Inside the existing finding-actions card next to the "Escalate to incident" button. Click → suggestion-card returns matrix coords. Accept pre-fills the escalation-draft severity; the human still confirms before the incident is created.

### Wand 3 — CAPA verification method

Inside the Verification form, next to the Method `<Select>`. Click → suggestion returns one of the five `verification_method` enum values. Accept calls the existing form `onChange`. The `verifier ≠ owner` 3-layer constraint is unaffected.

### Wand 4 — Reportability confidence pane (READ-ONLY)

Inline auto-loading pane at the top of each row (OSHA-300) or at the top of each report (RIDDOR-F2508). Auto-loads on first view (cached in `argus_suggestions` keyed on `target_kind='incident' + target_id` + `incident.updated_at`); manual `[↻ Re-assess]` link forces a fresh call.

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

No Accept/Edit/Reject — there's nothing to commit. Outcomes recorded: `'pending'` (just delivered) and `'expired'` (24h elapsed before filing). The human's `Generate report` click stays the source of truth.

### Wand 5 — CAPA Create modal Type + Title (open question)

If shipped: a `[✨ Draft from investigation]` button at the top of the Create-CAPA modal, only enabled when opened from an investigation. Click → suggestion-card with `{ type, title, rationale }`. Accept fills both fields.

---

## Architecture

### Wand route handler — `app/api/argus/wand/route.ts`

POST `{ surface, payload }`. Server flow:

1. `runArgusGates(surface)` — light bucket (10/min/user) for fast-tier surfaces; heavy bucket (3/min/user) for smart-tier (Reportability + CAPA-metadata).
2. `argus:use` + per-surface write permission check on the relevant site.
3. Build redaction known-names list (caller, injured persons, witnesses, investigation lead). Run `redactText()` on every free-text field.
4. (Reportability only) check `argus_suggestions` for a row with same `target_kind/target_id` and matching `incident.updated_at`; if found, return its `output` directly without a model call.
5. Pick tool + system prompt + tier from `WAND_REGISTRY` keyed by `surface`.
6. `getLLM().generateStructured({ surface, tier, system, user, tool, thinking: tier === 'smart' ? 'auto' : 'off' })`.
7. Validate `output` with a Zod mirror of the tool schema (defence-in-depth).
8. Insert `argus_suggestions`: `surface=<key>`, `target_kind/target_id`, `model=usage.modelUsed`, `prompt_tokens=usage.inputTokens`, `completion_tokens=usage.outputTokens`, `cache_read_tokens=usage.cachedInputTokens`, `cache_create_tokens=0`, `payload={ kind: 'wand', input: <redacted>, output: <validated>, thinking_tokens: usage.thinkingTokens }`, `outcome='pending'`.
9. Insert `activity_events`: `verb='argus.wand_suggested'`, `actor_kind='argus'`.
10. Return `{ ok: true, suggestionId, output, confidence, rationale }`. Errors return 200 with `{ ok: false, error }` so the wand UI can surface inline.

**Non-streaming.** Sub-second on Flash, 2–8s on Pro with thinking. SSE is reserved for Copilot (multi-turn) and Investigator (progress event).

### Tools — `lib/argus/tools/`

Five new structured-output tool definitions (or four if Wand 5 is deferred). Each declared with the abstraction's `ToolDefinition` shape. Add to a new `WAND_TOOLS` map exported from `lib/argus/tools/index.ts` (separate from `COPILOT_TOOLS` and `INVESTIGATOR_TOOLS` per 9c precedent).

```ts
// lib/argus/tools/suggest-risk-matrix.ts
export const suggestRiskMatrixTool: ToolDefinition = {
  name: 'suggest_risk_matrix',
  description: 'Suggest the 5×5 risk-matrix coordinates for the described incident.',
  parameters: {
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

`suggest_finding_severity` shares the shape (different prompt). `suggest_verification_method` carries the enum. `assess_reportability` returns the verdict + citation envelope. `draft_capa_metadata` returns type + title.

Each carries an `insufficient_input` escape valve. If non-empty, the wand surfaces "Argus needs more context" and the suggestion-card is suppressed.

### System prompts — `lib/argus/system-prompts/`

Five new files (or four), each ≤ 30 lines:

- `wand-risk-matrix.md` — encodes SPEC §8 likelihood × consequence rubric verbatim, plus "do not invent facts not in the input."
- `wand-finding-severity.md` — same rubric, scoped to finding context.
- `wand-verification-method.md` — encodes the five methods + when each applies, sourced from SPEC §10.
- `wand-reportability.md` — encodes 29 CFR 1904.7 + RIDDOR Schedule 2 thresholds; model must cite the specific subsection. **Hardest prompt to get right** — false positives are a regulatory exposure.
- `wand-capa-metadata.md` — encodes CAPA type taxonomy + naming convention; titles ≤ 80 chars, reference root cause not symptom.

### Component tree

```
components/argus/
  argus-magic-wand.tsx              ← single reusable button + suggestion-card pair
  use-argus-wand.ts                 ← thin fetch hook (POST → JSON envelope, no SSE)
  suggestion-card.tsx               ← Accept / Edit / Reject card
```

`<ArgusMagicWand>` props (discriminated union per surface):

```ts
type ArgusMagicWandProps =
  | { surface: 'risk_matrix';        payload: { description: string; type: string; area?: string };  onAccept: (out: { likelihood: number; consequence: number }) => void; targetKind: 'incident'; targetId: string; }
  | { surface: 'finding_severity';   payload: { description: string; hazardCategory?: string };       onAccept: (out: { likelihood: number; consequence: number }) => void; targetKind: 'finding';  targetId: string; }
  | { surface: 'verification_method'; payload: { capaSummary: string };                                onAccept: (out: { method: string }) => void;                            targetKind: 'capa';     targetId: string; }
  | { surface: 'reportability';      payload: { incidentSummary: string; jurisdiction: 'US' | 'GB' }; onAccept?: never;                                                       targetKind: 'incident'; targetId: string; readOnly: true; }
  | { surface: 'capa_metadata';      payload: { investigationSummary: string };                       onAccept: (out: { type: string; title: string }) => void;               targetKind: 'capa';     targetId?: string; };
```

### Page integration

```tsx
// step-3-review.tsx
{canArgus && (
  <ArgusMagicWand
    surface="risk_matrix"
    payload={{ description: incident.description, type: incident.type, area: incident.area }}
    onAccept={(out) => setMatrix(out)}
    targetKind="incident" targetId={incident.id}
  />
)}
<RiskMatrix value={matrix} onChange={setMatrix} />
```

(Other surface mounts identical to the pre-pivot plan — see §"Wand surface placement" for paths.)

### Server actions reused (no new write actions)

- Wand 1: existing `setMatrix` + `finalizeIncident`.
- Wand 2: existing escalation flow on inspection finding.
- Wand 3: existing CAPA verification action.
- Wand 5 (if shipped): existing CAPA create action.

Outcome flips written by a small new action `app/(app)/argus-wand-actions.ts`:

```ts
"use server";
export async function acceptWandSuggestion({ suggestionId, edited, finalOutput }): ActionResult { ... }
export async function rejectWandSuggestion({ suggestionId }): ActionResult { ... }
```

Both gate on `argus:use` + the surface's underlying write permission.

---

## Schema

**Zero migration.** All required tables/columns ship from 9a:

- `argus_suggestions` — five new `surface` values; column is `text`. `payload` JSON now optionally includes `thinking_tokens` for Pro calls.
- `activity_events.actor_kind` — used as-is.
- `incidents`, `inspection_findings`, `capas` — no changes.

New activity verbs (no schema change — `verb` is `text`):

- `argus.wand_suggested` (actor_kind='argus')
- `argus.wand_accepted` / `argus.wand_edited` / `argus.wand_rejected` (actor_kind='human') — diff payload attached on `edited`.

---

## Permissions

**No new permission keys.** Each wand reuses:

- Visibility: `argus:use` + the surface's underlying *write* permission.
- Action (Accept): the same write permission — the human writes, not Argus.
- Action (Reportability pane): `report:read` only — read-only.

---

## File deltas

**New — abstraction**

```
lib/argus/llm/types.ts
lib/argus/llm/index.ts
lib/argus/llm/gemini-adapter.ts
lib/argus/llm/schema.ts          (JSONSchema → Gemini OpenAPI subset translator)
```

**New — wand surfaces**

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

**Modified — abstraction migration (9a/9b/9c rewrite)**

```
package.json                                    (add @google/genai, remove @anthropic-ai/sdk)
.env.local.example                              (add GEMINI_API_KEY, drop ANTHROPIC_API_KEY)
lib/argus/client.ts                             (re-export getLLM(); deprecate getArgusClient())
lib/argus/models.ts                             (TIER_FAST/SMART; TIER_BY_SURFACE)
lib/argus/stream.ts                             (replace MessageStream import with abstraction types)
lib/argus/gates.ts                              (drop Anthropic type imports)
lib/argus/tools/index.ts                        (export WAND_TOOLS map; tools now use ToolDefinition shape)
lib/argus/tools/update-incident-field.ts        (audit schema for Gemini subset)
lib/argus/tools/log-observation.ts              (audit schema)
lib/argus/tools/attach-photo.ts                 (audit schema)
lib/argus/tools/raise-stop-work.ts              (audit schema)
lib/argus/tools/propose-investigation-draft.ts  (audit schema)
app/api/argus/copilot/route.ts                  (rewrite onto streamText abstraction; agentic loop preserved)
app/api/argus/investigator/route.ts             (rewrite onto generateStructured; SSE wire format preserved)
```

**Modified — wand mounts**

```
components/risk-matrix/risk-matrix.tsx                  (accept optional Argus slot above grid)
components/incidents/wizard/step-3-review.tsx           (mount risk-matrix wand)
components/inspections/finding-actions-card.tsx         (mount finding-severity wand)
components/capa/detail/verification-form.tsx            (mount verification-method wand)
components/capa/capa-create-modal.tsx                   (mount capa-metadata wand — open Q1)
app/(app)/reports/osha-300/page.tsx                     (mount reportability pane per row)
app/(app)/reports/riddor-f2508/[incidentId]/page.tsx    (mount reportability pane)
```

**Modified — docs**

```
docs/SPEC.md                                            (§15 amendment: provider pivot 2026-05-10; §17 Argus subsection updated for Gemini)
docs/ui-flow.md                                         (note wand placement on each affected page)
docs/BUILD_STATUS.md                                    (Phase 9d entry on merge)
CLAUDE.md                                               (build status one-liner; replace Sonnet/Haiku/Anthropic refs in hard rules with provider-agnostic wording)
```

**Memory (on merge)**

- New: `project_phase_9d_argus_magic_wands.md` — must record both the wand surfaces AND the provider pivot.
- Update: `project_overview.md` (state line: 9d shipped, 9e pending; provider is Gemini), `project_tech_decisions.md` (LLM provider entry), `MEMORY.md` (index).

---

## Branch commit strategy

The PR squashes to one commit on `main` but the branch can hold two intermediate commits for reviewability:

1. **`refactor: introduce lib/argus/llm abstraction + Gemini adapter; migrate 9a/9b/9c off Anthropic SDK`** — no new user-visible features. After this commit, 9b smoke (Copilot in wizard) and 9c smoke (Investigator on `/investigations/[id]?tab=ai`) must still pass end-to-end against a real `GEMINI_API_KEY`.
2. **`feat: phase 9d — argus magic wands on Gemini`** — adds the four (or five) wands.

If the abstraction-only commit's regression risk feels high, optionally split into a separate PR landed first; user decision (Open Question #2 below).

---

## Hard rules carried forward

All six 9.0 hard rules from the master plan apply unchanged. The four that bind hardest in 9d:

- **Rule 1 — assistive, not authoritative.** No wand commits anything. Severity, finding-promotion, verification method, and reportability stay human-signed. Reportability is read-only by construction.
- **Rule 4 — no auto-classify, no auto-route, no auto-close.** Risk-matrix wand suggests but never sets; the engine in `lib/workflow/severity.ts` runs only on human submit.
- **Rule 5 — PII redaction.** Incident summaries used by Wands 1, 2, 4, 5 contain witness/injured-person names. Run `redactText()` on the payload before egress. Same redactor; just routes to a different egress endpoint now.
- **Rule 6 — cost guardrails.** Light bucket (10/min/user) for fast-tier; heavy bucket (3/min/user) for smart-tier. Reportability auto-load uses a 24h cache hit on `argus_suggestions` keyed by `incident.updated_at`. Org daily token budget bumped to 10M tokens to reflect Gemini Flash pricing.

---

## Definition of Done

**Foundation refactor**
- `@google/genai` installed; `@anthropic-ai/sdk` removed; `grep -rn '@anthropic-ai/sdk' .` returns zero hits outside `node_modules`.
- `GEMINI_API_KEY` added to `.env.local.example` with a comment; old `ANTHROPIC_API_KEY` line removed.
- `lib/argus/llm/types.ts` + `gemini-adapter.ts` + `index.ts` + `schema.ts` exist; all unit-callable from a Server Action.
- `lib/argus/client.ts`, `models.ts`, `stream.ts`, `gates.ts` migrated; no Anthropic-specific imports remain.
- `app/api/argus/copilot/route.ts` rewritten on `streamText`; Copilot agentic loop end-to-end works in Report Wizard with `GEMINI_API_KEY`.
- `app/api/argus/investigator/route.ts` rewritten on `generateStructured`; Investigator tab on `/investigations/[id]?tab=ai` returns a draft within 12s end-to-end.
- All five existing tool definitions audited for OpenAPI-3.0-subset compliance.
- `pnpm build` clean; types regenerate; no TS errors.

**Magic wands**
- All four (or five) wands render only when visibility conditions are met; hidden cleanly otherwise.
- With `orgs.argus_enabled=false` or `argus:use=false`, no wand renders.
- Each fast-tier wand returns within 4s; each smart-tier wand within 12s, on a typical incident.
- Suggestion-card shows confidence + rationale; Accept fills the existing form field via the existing `onChange`; Edit dismisses; Reject dismisses with outcome write.
- `argus_suggestions` row written on each suggestion (`outcome='pending'`); flipped to `accepted` / `edited` / `rejected` on user action.
- For Wand 4 (Reportability), auto-load on first view; subsequent OSHA-300 views with unchanged `incident.updated_at` hit the cache (no model call); `[Re-assess]` link forces a fresh call.
- Each suggestion writes one `activity_events` row (`actor_kind='argus'`, `verb='argus.wand_suggested'`); each Accept/Edit/Reject writes one (`actor_kind='human'`, with diff on `edited`).
- Light + heavy rate limits enforced; 11th call/min returns 429 with friendly toast.
- Org daily token budget enforced; soft warn surfaces in the suggestion-card when ≥80%.
- PII redaction: DevTools network shows initials, not full names, in request body for all five surfaces.
- `pnpm build` clean.

---

## Smoke test (run before opening PR)

**Foundation regression**
- [ ] `pnpm install` succeeds; `@google/genai` listed; `@anthropic-ai/sdk` not.
- [ ] `pnpm dev` boots clean.
- [ ] `GEMINI_API_KEY` unset → side panel shows "AI is offline" empty state, no 500.
- [ ] **9b regression.** Open `/incidents/new/1`, dictate "worker on roof, no harness," verify `log_observation` tool fires, attaches a photo, raises stop-work. Banner appears on `/dashboard`.
- [ ] **9c regression.** Open an existing investigation `?tab=ai`, paste sample text + 1 witness, Generate, edit Why #2, Push 5-Why, verify all 5 rows in `rca_whys`, verify `argus_suggestions.outcome='edited'` with diff.
- [ ] `argus_suggestions` rows from this session show `model='gemini-2.5-flash'` or `'gemini-2.5-pro'` (not `claude-*`).

**Wands**
- [ ] **Wand 1.** Open `/incidents/new/3` on an in-flight draft → wand visible. Click → suggestion-card returns matrix coords. Accept → grid cell highlights. Edit → pick different cell; outcome=`edited`. Reject → outcome=`rejected`.
- [ ] **Wand 2.** Open closed inspection with unescalated finding → wand visible. Click → suggestion fills escalation-draft severity.
- [ ] **Wand 3.** Open CAPA in `verifying` state → wand visible. Click → method enum returned. Accept fills dropdown. `verifier ≠ owner` constraint still rejects invalid combos.
- [ ] **Wand 4 — OSHA.** Open `/reports/osha-300` → each row auto-loads a verdict pane. Reload within 24h with unchanged incident → no model call (verify in network tab; <100ms cache lookup). `[Re-assess]` → fresh model call; new `argus_suggestions` row.
- [ ] **Wand 4 — RIDDOR.** Open `/reports/riddor-f2508/<incident>` → pane shows RIDDOR Schedule 2 citation, not 29 CFR.
- [ ] **Wand 5 (open Q1).** If shipped: open Create-CAPA from investigation → wand visible; click → Type + Title fill; Accept; submit.
- [ ] Empty / thin payload → suggestion-card shows "Argus needs more context."
- [ ] Trigger 11 fast-tier wand calls in 60s → 11th returns 429.
- [ ] Trigger 4 smart-tier calls in 60s → 4th returns 429.
- [ ] Org budget at 100% → wand shows "AI is offline today"; no model call.
- [ ] PII: full name "John Smith" in payload → network request body shows "JS".
- [ ] Cache Components: no Suspense errors; no `runtime` exports on the new route handler.
- [ ] Dark mode: cyan accent + suggestion-card render correctly.
- [ ] Activity feed shows `Argus suggested <surface>` + `<user> accepted/edited/rejected` rows.

---

## Out of scope (deferred to 9.1+)

- Multi-turn refinement on any wand.
- Argus-driven creation of incidents, findings, or CAPAs.
- Reportability auto-filing (permanent non-goal per Hard Rule 4).
- Cross-incident pattern detection (a 9e dashboard tile, not a wand).
- Inspection-template generation.
- Document evidence ingest into wand prompts.
- Wand on investigation Why fields (covered by 9c).
- Wand on RIDDOR-F2508 sub-fields (the pane is the whole story).
- **OpenAI adapter.** Interface is ready; v1 ships Gemini only. Adding OpenAI is a single new file plus an `ARGUS_PROVIDER` env switch; defer until needed.
- **Gemini context caching.** 32K-token minimum doesn't fit our prompts. Revisit when per-call payloads grow (e.g. when Investigator starts ingesting full PDFs in 9.1).
- **Streaming JSON deltas on Investigator.** Old plan referenced Anthropic input-token progress events; Gemini's progress event story is different and we're keeping the SSE wire identical (start spinner → final draft). Not a regression worth fixing in 9d.

---

## Risks

1. **Reportability false positives (Gemini Pro).** A "reportable" verdict on a non-reportable incident is real regulatory exposure even if the human files. Mitigation: tight prompt requiring a specific 29 CFR / RIDDOR subsection citation; `confidence < 0.7` band surfaces "uncertain" instead of either verdict. Watch acceptance rate post-merge.
2. **Anchoring bias on the risk matrix.** A 78%-confidence Argus suggestion may anchor a junior worker. Mitigation: rationale always shown; Edit equal in visual weight to Accept; suggestion does NOT pre-fill the grid until Accept clicked. Track edit-rate.
3. **Cost on OSHA-300 first view.** 50 recordable incidents × Pro reportability ≈ $0.05/page-load worst-case. Mitigation: cache key on `incidents.updated_at` so unchanged incidents hit cache forever, not just 24h.
4. **Tool-use forcing failures.** Gemini occasionally refuses `mode: 'ANY'` with `allowedFunctionNames` for edge content. Mitigation: fall back to `mode: 'AUTO'` and validate the chosen function name server-side.
5. **Verification-method suggestion too generic.** Five enums are coarse-grained. Mitigation: include CAPA description + finding context + verifier role in the payload; if confidence < 0.6, suppress and ask for human pick.
6. **Wand discoverability.** Four wands across four pages is easy to miss. No tour overlays per existing rule. Track impression-vs-click; <10% click-through means add an inline empty-state tile.
7. **Reportability pane breaks OSHA-300 print layout.** The existing `<PrintButton>` flow assumes fixed row height. Mitigation: pane is `print:hidden` — only renders on screen.
8. **Foundation refactor regresses 9b/9c.** The Copilot agentic loop (9b) is the riskiest surface — function-calling protocols differ between Anthropic (`tool_use` content blocks) and Gemini (`functionCall` / `functionResponse` parts). Mitigation: the abstraction normalises onto a shared message shape; smoke walks 9b end-to-end before merging the foundation commit.
9. **Gemini schema subset rejections.** If any existing tool schema has `oneOf` / `$ref`, Gemini will reject the tool definition. Mitigation: audit pass on all five existing tools; the translator helper in `schema.ts` errors loudly if it encounters an unsupported construct.
10. **Loss of Anthropic prompt caching.** Per-call costs go up because the system prompt is re-sent every time. Offset by Gemini Flash's lower base price; net cost lower per call. Watch `argus_suggestions.prompt_tokens` aggregates the first week.
11. **Token-counting drift.** Anthropic and Gemini count tokens slightly differently. Old `argus_suggestions` rows aren't comparable to new ones for budget purposes. Bump the org daily budget from 5M to 10M as a transition buffer; revisit after a month.
12. **`@google/genai` API churn.** The SDK is younger than the Anthropic one and has had breaking changes through 2024–2025. Pin a specific version in `package.json`; subscribe to upgrade notes.

---

## Open questions to confirm before implementing

1. **Wand 5 (CAPA metadata) in or out?** Master plan lists it as 9d; CLAUDE.md status line drops it. Recommend: **in**, natural follow-on from 9c.
2. **Foundation refactor in same PR or split?** Single PR keeps the abstraction + wands as one logical change but balloons the diff (~30 files). Split lands the refactor first, smokes 9b/9c, then a clean wands PR. Recommend: **same PR with two intermediate commits**, since the refactor is foundational to 9d's first line of code and a split would mean the abstraction sits in `main` unused for a beat.
3. **Reportability cache key.** `incident.updated_at`-keyed (forever-cache while incident unchanged) vs `created_at + 24h` (rolling 24h regardless). Recommend: **`updated_at`-keyed**.
4. **Reportability auto-load on OSHA-300.** Auto-load all rows in parallel (heavy first-paint) vs lazy-load on hover/click (slower discovery). Recommend: **parallel with cap of 5**, balanced against budget.
5. **Wand 1 placement.** Above or below the grid? Recommend: **above**, with rationale below the grid.
6. **Wand outcome on Edit.** Strict cell-level diff vs band-level. Recommend: **strict cell-level**.
7. **Reportability for clearly non-recordable incidents.** Always render or only when ambiguous? Recommend: **always**, since "not_reportable, confidence 99%" is a useful audit artifact.
8. **Gemini `thinking` for smart-tier wands.** Pro thinks by default — adds 2–5s of latency and ~2× output tokens. Reportability quality justifies it; CAPA-metadata may not. Recommend: **thinking on for Reportability + Investigator; thinking off for CAPA-metadata**.
9. **Drop Anthropic SDK entirely or keep behind a dead env switch?** Recommend: **drop entirely**. Dead code rots; if we ever go back, the abstraction makes a re-add a single file. Per `CLAUDE.md`'s "no dead code / no backwards-compatibility shims" rule.
10. **Prompt-cache regression in CLAUDE.md hard rule #6.** "Prompt caching mandatory on system + page-context blocks per the `claude-api` skill defaults" no longer applies. Recommend: **strike that clause from the master plan** and update SPEC §17 to read "Caching is provider-dependent; v1 ships uncached, revisit when prompt sizes justify Gemini context caching."

---

## Verification

```bash
pnpm install                              # installs @google/genai, removes @anthropic-ai/sdk
pnpm dev                                  # GEMINI_API_KEY required in .env.local
# walk Definition of Done → Foundation regression → Wand smokes
```

PR title: `feat: phase 9d — argus magic wands + gemini provider pivot`. Squash-merge into `main` per `.claude/rules/github-workflow.md`. After merge: update `docs/BUILD_STATUS.md`, `CLAUDE.md` build-status one-liner, `docs/SPEC.md` §15 + §17, write memory `project_phase_9d_argus_magic_wands.md`, update `project_tech_decisions.md` to record Gemini as the v1 LLM provider.
