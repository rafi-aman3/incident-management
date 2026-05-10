/**
 * Public entry point for the Argus LLM abstraction. Callers import `getLLM()`
 * and call `generateStructured` or `streamText`. Provider selection is
 * encapsulated here — swap to OpenAI by adding an adapter file and branching
 * on `process.env.ARGUS_PROVIDER`. v1 ships Gemini only.
 *
 * The provider is constructed lazily and cached per-process.
 */

import { GeminiAdapter } from "./gemini-adapter";
import type { LLMProvider } from "./types";

let cached: LLMProvider | null = null;

export function getLLM(): LLMProvider {
  if (cached) return cached;
  cached = new GeminiAdapter();
  return cached;
}

export function isArgusConfigured(): boolean {
  return getLLM().isConfigured();
}

export type {
  ChatTurn,
  GenerateStructuredArgs,
  GenerateStructuredResult,
  JSONSchemaSubset,
  LLMProvider,
  ModelTier,
  StreamTextArgs,
  StreamTextChunk,
  StreamTextFinal,
  StreamTextResult,
  ToolDefinition,
  UsageNormalized,
} from "./types";

export { ArgusOfflineError, ArgusInvalidResponseError } from "./types";
