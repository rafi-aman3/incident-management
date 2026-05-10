/**
 * Shared types for Argus tools. Each tool exports an Anthropic
 * `Tool` definition (input_schema only — the SDK's `Tool` type) and an
 * `execute()` server handler that takes the parsed input + a context object
 * and returns a string the model sees in the next turn as the tool result.
 *
 * Tools are *suggestion-shaped*. They never finalize a load-bearing decision.
 * The DB writes they trigger are audit rows + minor flag flips (stop_work,
 * incident_attachments). Severity / track / closure stay human-driven.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface ToolContext {
  supabase: SupabaseClient<Database>;
  userId: string;
  orgId: string;
  /** The draft incident the Copilot is augmenting. The wizard always has one
   *  from Step 1 onward, so this is non-null on every Copilot tool call. */
  incidentId: string;
  siteId: string;
}

export interface ArgusToolDefinition<TInput = Record<string, unknown>> {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Server-side execution. Return a string that becomes the model's tool result. */
  execute(input: TInput, ctx: ToolContext): Promise<string>;
}
