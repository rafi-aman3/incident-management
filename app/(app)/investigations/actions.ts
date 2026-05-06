"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import {
  INVESTIGATION_STATUSES,
  INVESTIGATION_TRANSITIONS,
  type InvestigationStatus,
} from "@/lib/investigations/types";

const AdvanceSchema = z.object({
  id: z.string().uuid(),
  newStatus: z.enum(INVESTIGATION_STATUSES),
});

/**
 * Move an investigation to a new column on the Kanban board.
 *
 * Allowed transitions are defined in INVESTIGATION_TRANSITIONS (ui-flow §10.2):
 *   pending_assignment → in_progress
 *   in_progress        → awaiting_capa | closed
 *   awaiting_capa      → closed
 *
 * Side effects:
 *   - Sets started_at on first move into in_progress (if null)
 *   - Sets closed_at on move into closed
 *   - Writes activity_events row 'investigation.advanced'
 *
 * Permission: investigation:edit (per ui-flow §1.2). Lead-reassignment is a
 * separate flow with its own permission key.
 */
export async function advanceInvestigation(
  id: string,
  newStatus: InvestigationStatus
): Promise<ActionResult> {
  const parsed = AdvanceSchema.safeParse({ id, newStatus });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("investigation:edit", currentSiteId);

  const { data: inv, error: readErr } = await supabase
    .from("investigations")
    .select("id, status, started_at, site_id")
    .eq("id", parsed.data.id)
    .is("deleted_at", null)
    .single();
  if (readErr || !inv) {
    return { ok: false, error: readErr?.message ?? "Investigation not found" };
  }

  const from = inv.status as InvestigationStatus;
  const to = parsed.data.newStatus;
  if (!INVESTIGATION_TRANSITIONS[from].includes(to)) {
    return { ok: false, error: `Transition ${from} → ${to} not allowed` };
  }

  const patch: {
    status: InvestigationStatus;
    started_at?: string;
    closed_at?: string;
  } = { status: to };
  if (to === "in_progress" && !inv.started_at) patch.started_at = new Date().toISOString();
  if (to === "closed") patch.closed_at = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("investigations")
    .update(patch)
    .eq("id", parsed.data.id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("activity_events").insert({
    investigation_id: parsed.data.id,
    actor_id: user.id,
    verb: "investigation.advanced",
    payload: { from, to },
  });

  revalidatePath("/investigations");
  revalidatePath(`/investigations/${parsed.data.id}`);
  return { ok: true };
}
