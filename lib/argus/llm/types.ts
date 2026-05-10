/**
 * Provider-agnostic LLM interface for Argus. v1 ships a Gemini adapter; the
 * abstraction is shaped so OpenAI, Anthropic, or local-model adapters slot in
 * as new files with no caller changes.
 *
 * Two operations cover every Argus surface:
 *   - generateStructured — one-shot forced function call returning a typed
 *     payload. Used by every wand (9d) and the Investigator (9c).
 *   - streamText — multi-turn agentic loop with optional tool calls and
 *     text deltas streamed via async iterator. Used by the Copilot (9b).
 *
 * Both routes through the abstraction return token usage in a normalized
 * shape so `argus_suggestions.prompt_tokens` / `.completion_tokens` /
 * `.cache_read_tokens` write the same columns regardless of provider.
 */

/** Capability tier. Adapters map to a concrete model:
 *  - 'fast'  → cheap classifier (Gemini 2.5 Flash today)
 *  - 'smart' → reasoning + long-context (Gemini 2.5 Pro today)             */
export type ModelTier = "fast" | "smart";

/** OpenAPI-3.0-subset schema. Strictly: type / properties / required /
 *  enum / items / minimum / maximum / minItems / maxItems / description /
 *  format / nullable. No oneOf / anyOf / allOf / $ref. The Gemini adapter
 *  rejects loudly if it encounters anything else. */
export interface JSONSchemaSubset {
  type: "object" | "array" | "string" | "integer" | "number" | "boolean";
  description?: string;
  properties?: Record<string, JSONSchemaSubset>;
  required?: string[];
  items?: JSONSchemaSubset;
  enum?: (string | number)[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
  minLength?: number;
  format?: string;
  nullable?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: JSONSchemaSubset;
}

/** Normalized chat turns used by streamText. The adapter translates these
 *  to and from its native content shape (Anthropic blocks, Gemini parts,
 *  OpenAI messages, etc.). All tool results from a single round-trip live in
 *  one `tool_results` turn so Gemini sees them as one user turn with multiple
 *  `functionResponse` parts. */
export type ChatTurn =
  | { role: "user"; text: string }
  | {
      role: "assistant";
      text?: string;
      toolCalls?: { id: string; name: string; arguments: unknown }[];
    }
  | {
      role: "tool_results";
      results: { toolCallId: string; toolName: string; result: string }[];
    };

export interface UsageNormalized {
  inputTokens: number;
  outputTokens: number;
  /** 0 when caching disabled or unsupported. */
  cachedInputTokens: number;
  /** 0 when the model isn't a thinking model or thinking is disabled. */
  thinkingTokens: number;
}

export interface GenerateStructuredArgs {
  /** Surface label for telemetry / model selection. */
  surface: string;
  tier: ModelTier;
  system: string;
  user: string;
  tool: ToolDefinition;
  maxOutputTokens?: number;
  /** 'auto' = let the model think; 'off' = disable thinking on smart tier
   *  for latency-sensitive surfaces. Ignored on fast tier. */
  thinking?: "auto" | "off";
}

export interface GenerateStructuredResult<T = Record<string, unknown>> {
  /** Parsed function-call arguments. Caller validates against a Zod schema. */
  output: T;
  /** Concrete model id (e.g. 'gemini-2.5-flash') for `argus_suggestions.model`. */
  modelUsed: string;
  usage: UsageNormalized;
}

export interface StreamTextArgs {
  surface: string;
  tier: ModelTier;
  system: string;
  messages: ChatTurn[];
  tools?: ToolDefinition[];
  maxOutputTokens?: number;
  /** Default 'auto'; pass 'off' to skip thinking on the smart tier. */
  thinking?: "auto" | "off";
}

export interface StreamTextChunk {
  /** Text delta to surface to the client (may be empty on chunks that only
   *  carry function-call structure). */
  text: string;
}

export interface StreamTextFinal {
  /** Concatenation of all text deltas. */
  text: string;
  /** Function calls the model emitted in this turn. Empty array means the
   *  agentic loop should terminate. */
  toolCalls: { id: string; name: string; arguments: unknown }[];
  usage: UsageNormalized;
  modelUsed: string;
  /** Provider-specific stop reason ('stop', 'tool_use', 'max_tokens', …).
   *  Adapter normalizes to a stable string. */
  stopReason: string;
}

export interface StreamTextResult {
  /** Async iterable of text deltas. Consume to drive SSE token events. */
  textChunks: AsyncIterable<StreamTextChunk>;
  /** Resolves after the iterator is fully drained, with aggregate state. */
  finalMessage: () => Promise<StreamTextFinal>;
}

export interface LLMProvider {
  readonly name: "gemini" | "openai" | "anthropic";
  isConfigured(): boolean;
  generateStructured<T = Record<string, unknown>>(
    args: GenerateStructuredArgs,
  ): Promise<GenerateStructuredResult<T>>;
  streamText(args: StreamTextArgs): Promise<StreamTextResult>;
}

export class ArgusOfflineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgusOfflineError";
  }
}

export class ArgusInvalidResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ArgusInvalidResponseError";
  }
}
