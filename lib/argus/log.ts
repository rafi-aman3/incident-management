import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

type JsonObject = { [key: string]: Json | undefined };

/**
 * Audit logger for every Argus interaction. Writes to `argus_suggestions`
 * (full payload + token usage) and the matching `activity_events` row with
 * `actor_kind='argus'`. Both writes go through the user's RLS-bound client
 * — RLS policy lets the suggestion's author INSERT their own rows.
 *
 * `model` accepts any concrete model id string returned by the provider
 * adapter (`gemini-2.5-flash`, `gemini-2.5-pro`, …). Old rows from the
 * Anthropic-era keep their `claude-*` strings — fine for audit, no migration.
 */

export type ArgusOutcome =
  | "pending"
  | "accepted"
  | "edited"
  | "rejected"
  | "expired";

export interface ArgusUsage {
  promptTokens: number;
  completionTokens: number;
  cacheReadTokens?: number;
  cacheCreateTokens?: number;
  thinkingTokens?: number;
}

export interface LogSuggestionInput {
  orgId: string;
  siteId: string | null;
  userId: string;
  surface: string; // 'copilot' | 'investigator' | 'risk_matrix' | …
  targetKind?: "incident" | "investigation" | "capa" | "finding" | null;
  targetId?: string | null;
  /** Concrete model id from the provider adapter. */
  model: string;
  usage: ArgusUsage;
  payload: JsonObject;
  outcome?: ArgusOutcome;
  /** Optional verb for the matching activity_events row. */
  activityVerb?: string;
  activityIncidentId?: string | null;
  activityInvestigationId?: string | null;
  activityCapaId?: string | null;
}

export interface LogSuggestionResult {
  suggestionId: string;
}

export async function logArgusSuggestion(
  input: LogSuggestionInput,
): Promise<LogSuggestionResult> {
  const supabase = await createClient();

  const payload: JsonObject = {
    ...input.payload,
    ...(input.usage.thinkingTokens
      ? { _thinking_tokens: input.usage.thinkingTokens }
      : {}),
  };

  const { data, error } = await supabase
    .from("argus_suggestions")
    .insert({
      org_id: input.orgId,
      site_id: input.siteId,
      user_id: input.userId,
      surface: input.surface,
      target_kind: input.targetKind ?? null,
      target_id: input.targetId ?? null,
      model: input.model,
      prompt_tokens: input.usage.promptTokens,
      completion_tokens: input.usage.completionTokens,
      cache_read_tokens: input.usage.cacheReadTokens ?? 0,
      cache_create_tokens: input.usage.cacheCreateTokens ?? 0,
      payload,
      outcome: input.outcome ?? "pending",
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`failed to log argus suggestion: ${error?.message}`);
  }

  if (input.activityVerb) {
    await supabase.from("activity_events").insert({
      verb: input.activityVerb,
      actor_id: input.userId,
      actor_kind: "argus",
      incident_id: input.activityIncidentId ?? null,
      investigation_id: input.activityInvestigationId ?? null,
      capa_id: input.activityCapaId ?? null,
      payload: {
        suggestion_id: data.id,
        surface: input.surface,
        model: input.model,
      },
    });
  }

  return { suggestionId: data.id };
}

export async function setSuggestionOutcome(
  suggestionId: string,
  outcome: ArgusOutcome,
  diff?: JsonObject,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("argus_suggestions")
    .update({
      outcome,
      outcome_at: new Date().toISOString(),
      ...(diff ? { payload: diff } : {}),
    })
    .eq("id", suggestionId);

  if (error) {
    throw new Error(`failed to set outcome: ${error.message}`);
  }
}
