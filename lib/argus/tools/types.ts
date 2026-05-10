/**
 * Shared types for Argus tools. Each tool exports a `ToolDefinition`-shaped
 * declaration (name + description + parameters JSONSchema) and an
 * `execute()` server handler that takes the parsed input + a context object
 * and returns a string the model sees in the next turn as the tool result.
 *
 * Tools are *suggestion-shaped*. They never finalize a load-bearing decision.
 * The DB writes they trigger are audit rows + minor flag flips (stop_work,
 * incident_attachments). Severity / track / closure stay human-driven.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { JSONSchemaSubset, ToolDefinition } from "@/lib/argus/llm";

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  /** The draft incident the Copilot is augmenting. The wizard always has one
   *  from Step 1 onward, so this is non-null on every Copilot tool call. */
  incidentId: string;
  siteId: string;
  /** Concrete model id of the LLM that decided to call this tool, e.g.
   *  `gemini-2.5-flash`. Recorded into `argus_suggestions.model` on every
   *  side-effect row so the audit trail tracks what the live model was. */
  modelUsed: string;
}

export interface ArgusToolDefinition<TInput = Record<string, unknown>>
  extends ToolDefinition {
  parameters: JSONSchemaSubset & { type: "object" };
  /** Server-side execution. Return a string that becomes the model's tool result. */
  execute(input: TInput, ctx: ToolContext): Promise<string>;
}
