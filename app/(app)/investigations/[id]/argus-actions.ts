"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import { setSuggestionOutcome, type ArgusOutcome } from "@/lib/argus/log";
import type { Json } from "@/lib/supabase/types";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Phase 9c — Argus Investigator outcome flips. Called from
 * `<ArgusInvestigator>` when the user Pushes a section to commit
 * (`accepted` or `edited`) or Discards the draft (`rejected`).
 *
 * The actual writes to investigations.{findings, root_cause_summary} and
 * rca_whys go through the existing `saveInvestigationText` / `saveWhy`
 * actions in `./actions.ts` — those keep their normal `investigation:edit`
 * gate. THIS file only:
 *   1. Flips `argus_suggestions.outcome` on the suggestion row
 *   2. Writes an `activity_events` row with `actor_kind='human'` documenting
 *      which section the user pushed and whether they edited the draft
 *
 * Both audit + the underlying write are required for the trail; the write
 * fails open (the outcome flip + activity row are best-effort and don't
 * block the user if they happen to fail — the Push already landed).
 */

const ACCEPT_VALID_SECTIONS = ["timeline", "whys", "root_cause_summary", "findings"] as const;
type Section = (typeof ACCEPT_VALID_SECTIONS)[number];

const AcceptSchema = z.object({
  suggestionId: z.string().uuid(),
  investigationId: z.string().uuid(),
  section: z.enum(ACCEPT_VALID_SECTIONS),
  wasEdited: z.boolean(),
  diff: z.unknown().optional(),
});

export async function acceptArgusSuggestion(input: {
  suggestionId: string;
  investigationId: string;
  section: Section;
  wasEdited: boolean;
  diff?: unknown;
}): Promise<ActionResult> {
  const parsed = AcceptSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  // Fetch the suggestion to confirm it targets THIS investigation and hasn't
  // been finalized already. RLS already restricts visibility to the author
  // within their org, so this is a defence-in-depth check.
  const { data: suggestion, error: readErr } = await supabase
    .from("argus_suggestions")
    .select("id, target_kind, target_id, outcome, payload")
    .eq("id", parsed.data.suggestionId)
    .maybeSingle();
  if (readErr || !suggestion) {
    return { ok: false, error: readErr?.message ?? "Suggestion not found" };
  }
  if (
    suggestion.target_kind !== "investigation" ||
    suggestion.target_id !== parsed.data.investigationId
  ) {
    return { ok: false, error: "Suggestion does not match this investigation." };
  }

  const outcome: ArgusOutcome = parsed.data.wasEdited ? "edited" : "accepted";

  try {
    await setSuggestionOutcome(parsed.data.suggestionId, outcome);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Outcome flip failed" };
  }

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigationId,
    actor_id: user.id,
    actor_kind: "human",
    verb: "argus.investigator_pushed",
    payload: {
      suggestion_id: parsed.data.suggestionId,
      section: parsed.data.section,
      was_edited: parsed.data.wasEdited,
      diff: (parsed.data.diff ?? null) as Json,
    } satisfies Record<string, Json>,
  });

  revalidatePath(`/investigations/${parsed.data.investigationId}`);
  return { ok: true };
}

const RejectSchema = z.object({
  suggestionId: z.string().uuid(),
  investigationId: z.string().uuid(),
});

export async function rejectArgusSuggestion(input: {
  suggestionId: string;
  investigationId: string;
}): Promise<ActionResult> {
  const parsed = RejectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  try {
    await setSuggestionOutcome(parsed.data.suggestionId, "rejected");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Outcome flip failed" };
  }

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.investigationId,
    actor_id: user.id,
    actor_kind: "human",
    verb: "argus.investigator_rejected",
    payload: { suggestion_id: parsed.data.suggestionId },
  });

  revalidatePath(`/investigations/${parsed.data.investigationId}`);
  return { ok: true };
}
