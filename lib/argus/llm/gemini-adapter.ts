/**
 * Gemini adapter for the LLM abstraction. Implements:
 *   - generateStructured: forced function-calling with `mode: ANY` +
 *     `allowedFunctionNames` so the model emits exactly one function call
 *     matching the requested tool. Maps to a typed `output` payload.
 *   - streamText: multi-turn agentic loop with text deltas and function
 *     calls. Translates ChatTurn[] → Gemini `Content[]` and back.
 *
 * Model selection is tier-based (`fast` → 2.5 Flash, `smart` → 2.5 Pro). The
 * concrete model id flows through the result so callers can write it to
 * `argus_suggestions.model` without knowing tier semantics.
 */

import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type Content,
  type FunctionDeclaration,
  type GenerateContentResponse,
} from "@google/genai";
import type {
  ChatTurn,
  GenerateStructuredArgs,
  GenerateStructuredResult,
  LLMProvider,
  StreamTextArgs,
  StreamTextChunk,
  StreamTextFinal,
  StreamTextResult,
  ToolDefinition,
  UsageNormalized,
} from "./types";
import { ArgusInvalidResponseError, ArgusOfflineError } from "./types";
import { jsonSchemaToGemini } from "./schema";

const MODEL_FAST = "gemini-2.5-flash";
const MODEL_SMART = "gemini-2.5-pro";

function modelFor(tier: "fast" | "smart"): string {
  return tier === "smart" ? MODEL_SMART : MODEL_FAST;
}

function toFunctionDeclaration(tool: ToolDefinition): FunctionDeclaration {
  return {
    name: tool.name,
    description: tool.description,
    parameters: jsonSchemaToGemini(tool.parameters),
  };
}

function thinkingConfigFor(
  tier: "fast" | "smart",
  thinking: "auto" | "off" | undefined,
): { thinkingBudget: number } | undefined {
  // Fast tier doesn't think; nothing to configure.
  if (tier === "fast") return undefined;
  // Smart tier with explicit 'off' → disable thinking for lower latency/cost.
  if (thinking === "off") return { thinkingBudget: 0 };
  // Smart tier 'auto' (default) → omit so the model picks its own budget.
  return undefined;
}

function normalizeUsage(
  raw: GenerateContentResponse["usageMetadata"],
): UsageNormalized {
  return {
    inputTokens: raw?.promptTokenCount ?? 0,
    outputTokens: raw?.candidatesTokenCount ?? 0,
    cachedInputTokens: raw?.cachedContentTokenCount ?? 0,
    thinkingTokens: raw?.thoughtsTokenCount ?? 0,
  };
}

function chatTurnsToGeminiContents(turns: ChatTurn[]): Content[] {
  const contents: Content[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      contents.push({ role: "user", parts: [{ text: turn.text }] });
    } else if (turn.role === "assistant") {
      const parts: Content["parts"] = [];
      if (turn.text) parts.push({ text: turn.text });
      for (const call of turn.toolCalls ?? []) {
        parts.push({
          functionCall: {
            id: call.id,
            name: call.name,
            args: (call.arguments ?? {}) as Record<string, unknown>,
          },
        });
      }
      if (parts.length === 0) parts.push({ text: "" });
      contents.push({ role: "model", parts });
    } else {
      // tool_results → one user turn containing every functionResponse part
      // from this round-trip. Gemini matches each to its functionCall by
      // name (and id when set).
      contents.push({
        role: "user",
        parts: turn.results.map((r) => ({
          functionResponse: {
            id: r.toolCallId,
            name: r.toolName,
            response: { result: r.result },
          },
        })),
      });
    }
  }
  return contents;
}

export class GeminiAdapter implements LLMProvider {
  readonly name = "gemini" as const;
  private client: GoogleGenAI | null = null;

  isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY);
  }

  private getClient(): GoogleGenAI {
    if (this.client) return this.client;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new ArgusOfflineError(
        "GEMINI_API_KEY is not set — Argus is offline.",
      );
    }
    this.client = new GoogleGenAI({ apiKey });
    return this.client;
  }

  async generateStructured<T = Record<string, unknown>>(
    args: GenerateStructuredArgs,
  ): Promise<GenerateStructuredResult<T>> {
    const client = this.getClient();
    const model = modelFor(args.tier);
    const fn = toFunctionDeclaration(args.tool);

    const response = await client.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: args.user }] }],
      config: {
        systemInstruction: args.system,
        tools: [{ functionDeclarations: [fn] }],
        toolConfig: {
          functionCallingConfig: {
            mode: FunctionCallingConfigMode.ANY,
            allowedFunctionNames: [args.tool.name],
          },
        },
        maxOutputTokens: args.maxOutputTokens ?? 1024,
        thinkingConfig: thinkingConfigFor(args.tier, args.thinking),
      },
    });

    const calls = response.functionCalls ?? [];
    const call = calls.find((c) => c.name === args.tool.name);
    if (!call) {
      throw new ArgusInvalidResponseError(
        `Gemini did not emit a function call for "${args.tool.name}". ` +
          `Calls received: [${calls.map((c) => c.name ?? "?").join(", ") || "none"}].`,
      );
    }

    return {
      output: (call.args ?? {}) as T,
      modelUsed: model,
      usage: normalizeUsage(response.usageMetadata),
    };
  }

  async streamText(args: StreamTextArgs): Promise<StreamTextResult> {
    const client = this.getClient();
    const model = modelFor(args.tier);

    const stream = await client.models.generateContentStream({
      model,
      contents: chatTurnsToGeminiContents(args.messages),
      config: {
        systemInstruction: args.system,
        tools:
          args.tools && args.tools.length > 0
            ? [{ functionDeclarations: args.tools.map(toFunctionDeclaration) }]
            : undefined,
        maxOutputTokens: args.maxOutputTokens ?? 2048,
        thinkingConfig: thinkingConfigFor(args.tier, args.thinking),
      },
    });

    let textBuffer = "";
    const toolCalls: StreamTextFinal["toolCalls"] = [];
    let lastUsage: UsageNormalized = {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      thinkingTokens: 0,
    };
    let stopReason = "stop";
    let toolCounter = 0;
    let finalResolved = false;

    async function* iterate(): AsyncGenerator<StreamTextChunk> {
      for await (const chunk of stream) {
        // Aggregate usage from the latest chunk that carries it (Gemini emits
        // usage on later chunks, often the final one).
        if (chunk.usageMetadata) {
          lastUsage = normalizeUsage(chunk.usageMetadata);
        }
        const calls = chunk.functionCalls ?? [];
        for (const c of calls) {
          if (!c.name) continue;
          toolCalls.push({
            id: c.id ?? `call_${toolCounter++}`,
            name: c.name,
            arguments: c.args ?? {},
          });
        }
        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) {
          stopReason = String(candidate.finishReason);
        }
        const delta = chunk.text ?? "";
        if (delta) {
          textBuffer += delta;
          yield { text: delta };
        }
      }
      finalResolved = true;
    }

    const iterator = iterate();

    return {
      textChunks: iterator,
      finalMessage: async () => {
        // Drain the iterator if the caller didn't.
        if (!finalResolved) {
          for await (const _ of iterator) {
            // discard; we already aggregated above
          }
        }
        return {
          text: textBuffer,
          toolCalls,
          usage: lastUsage,
          modelUsed: model,
          stopReason,
        };
      },
    };
  }
}
