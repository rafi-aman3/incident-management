"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { setSuggestionOutcome } from "@/lib/argus/log";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import type { Json } from "@/lib/supabase/types";

/**
 * Outcome flips for Argus wand suggestions. Called from the suggestion-card UI
 * after the user clicks Accept / Edit / Reject. Both actions write a
 * matching `activity_events` row with `actor_kind='human'` so the audit trail
 * shows both halves of the interaction (Argus suggested ↔ human acted).
 *
 * Gated on `argus:use` only — the human's underlying *write* action (filling
 * a form field, escalating a finding, picking a method) goes through its own
 * existing server action that already checks `incident:create` / `capa:verify`
 * / etc. This action just mutates the audit row, not the load-bearing data.
 */

export type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

export async function acceptWandSuggestion(input: {
  suggestionId: string;
  edited: boolean;
  /** When `edited`, the value the human committed (different from the suggestion). */
  finalOutput?: Record<string, Json>;
}): Promise<ActionResult> {
  if (!input.suggestionId) {
    return { ok: false, error: "suggestionId is required." };
  }

  const { user } = await requireUser();
  if (!(await orgCan("argus:use"))) {
    return { ok: false, error: "Argus is not enabled for your role." };
  }

  const supabase = await createClient();
  const { data: existing, error: lookupErr } = await supabase
    .from("argus_suggestions")
    .select("id, surface, target_kind, target_id, payload")
    .eq("id", input.suggestionId)
    .maybeSingle();

  if (lookupErr || !existing) {
    return { ok: false, error: "Suggestion not found." };
  }

  const outcome = input.edited ? "edited" : "accepted";
  const before =
    typeof existing.payload === "object" &&
    existing.payload !== null &&
    !Array.isArray(existing.payload)
      ? (existing.payload as Record<string, Json>).output
      : null;

  const diff: Record<string, Json> | undefined = input.edited
    ? { kind: "wand", output: before, accepted_output: input.finalOutput ?? null }
    : undefined;

  try {
    await setSuggestionOutcome(input.suggestionId, outcome, diff);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // Activity event mirroring the user's commit. Diff payload preserved on edited.
  await supabase.from("activity_events").insert({
    verb: input.edited ? "argus.wand_edited" : "argus.wand_accepted",
    actor_id: user.id,
    actor_kind: "human",
    incident_id:
      existing.target_kind === "incident" ? existing.target_id : null,
    investigation_id:
      existing.target_kind === "investigation" ? existing.target_id : null,
    capa_id: existing.target_kind === "capa" ? existing.target_id : null,
    payload: {
      suggestion_id: input.suggestionId,
      surface: existing.surface,
      ...(input.edited
        ? {
            before,
            after: (input.finalOutput ?? null) as Json,
          }
        : {}),
    },
  });

  // Revalidate the most likely target page so the activity feed picks up
  // the new row immediately. Cheap — these are dynamic pages already.
  if (existing.target_kind === "investigation" && existing.target_id) {
    revalidatePath(`/investigations/${existing.target_id}`);
  } else if (existing.target_kind === "capa" && existing.target_id) {
    revalidatePath(`/capa/${existing.target_id}`);
  } else if (existing.target_kind === "incident" && existing.target_id) {
    revalidatePath(`/incidents/${existing.target_id}`);
  }

  return { ok: true };
}

export async function rejectWandSuggestion(input: {
  suggestionId: string;
}): Promise<ActionResult> {
  if (!input.suggestionId) {
    return { ok: false, error: "suggestionId is required." };
  }

  const { user } = await requireUser();
  if (!(await orgCan("argus:use"))) {
    return { ok: false, error: "Argus is not enabled for your role." };
  }

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("argus_suggestions")
    .select("id, surface, target_kind, target_id")
    .eq("id", input.suggestionId)
    .maybeSingle();

  if (!existing) {
    return { ok: false, error: "Suggestion not found." };
  }

  try {
    await setSuggestionOutcome(input.suggestionId, "rejected");
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  await supabase.from("activity_events").insert({
    verb: "argus.wand_rejected",
    actor_id: user.id,
    actor_kind: "human",
    incident_id:
      existing.target_kind === "incident" ? existing.target_id : null,
    investigation_id:
      existing.target_kind === "investigation" ? existing.target_id : null,
    capa_id: existing.target_kind === "capa" ? existing.target_id : null,
    payload: { suggestion_id: input.suggestionId, surface: existing.surface },
  });

  return { ok: true };
}
