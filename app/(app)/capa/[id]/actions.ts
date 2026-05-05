"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

// ---------------------------------------------------------------------------
// updateCapaProgress — owner-only. Auto-promotes status from 'created' to
// 'in_progress' on the first non-zero update so the lifecycle moves forward
// without an explicit "Start" button.
//
// Slider is debounced ~500ms client-side, so this can fire frequently. We
// keep the write minimal (no activity_events spam — only a transition event
// on the auto-promotion).
// ---------------------------------------------------------------------------
const UpdateProgressSchema = z.object({
  capa_id: z.string().uuid(),
  pct: z.number().int().min(0).max(100),
});

export async function updateCapaProgress(input: {
  capa_id: string;
  pct: number;
}): Promise<ActionResult> {
  const parsed = UpdateProgressSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  // capa:complete is the action gate (owner-only path; permission grants
  // the right to mark progress + complete on CAPAs they own)
  await requirePermission("capa:complete", currentSiteId);

  const { data: capa, error: readErr } = await supabase
    .from("capas")
    .select("id, status, owner_id, progress_pct")
    .eq("id", parsed.data.capa_id)
    .is("deleted_at", null)
    .single();
  if (readErr || !capa) {
    return { ok: false, error: readErr?.message ?? "CAPA not found" };
  }
  if (capa.owner_id !== user.id) {
    return { ok: false, error: "Only the CAPA owner can update progress" };
  }
  if (capa.status === "verified" || capa.status === "closed") {
    return { ok: false, error: "Closed CAPAs are read-only" };
  }
  if (capa.status === "pending_verification") {
    return { ok: false, error: "CAPA is awaiting verification — owner cannot edit" };
  }

  const promote = capa.status === "created" && parsed.data.pct > 0;
  const patch: { progress_pct: number; status?: "in_progress" } = {
    progress_pct: parsed.data.pct,
  };
  if (promote) patch.status = "in_progress";

  const { error: updErr } = await supabase
    .from("capas")
    .update(patch)
    .eq("id", parsed.data.capa_id);
  if (updErr) return { ok: false, error: updErr.message };

  if (promote) {
    await supabase.from("activity_events").insert({
      capa_id: parsed.data.capa_id,
      actor_id: user.id,
      verb: "capa.started",
      payload: {},
    });
  }

  revalidatePath(`/capa/${parsed.data.capa_id}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// completeCapa — owner-only. Status in_progress → pending_verification.
// completed_at set; verifier notified (notification fan-out is a v2 polish —
// the dashboard bell already reads notifications by recipient_id).
// ---------------------------------------------------------------------------
export async function completeCapa(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = fd.get("capa_id");
  if (typeof id !== "string") return { ok: false, error: "Missing capa_id" };

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("capa:complete", currentSiteId);

  const { data: capa, error: readErr } = await supabase
    .from("capas")
    .select("id, status, owner_id, verifier_id, site_id, title")
    .eq("id", id)
    .is("deleted_at", null)
    .single();
  if (readErr || !capa) {
    return { ok: false, error: readErr?.message ?? "CAPA not found" };
  }
  if (capa.owner_id !== user.id) {
    return { ok: false, error: "Only the CAPA owner can mark complete" };
  }
  if (capa.status !== "in_progress" && capa.status !== "created") {
    return { ok: false, error: `Can't complete from status ${capa.status}` };
  }
  if (!capa.verifier_id) {
    return { ok: false, error: "Assign a verifier before completing" };
  }

  const now = new Date().toISOString();
  const { error: updErr } = await supabase
    .from("capas")
    .update({
      status: "pending_verification",
      completed_at: now,
      progress_pct: 100,
    })
    .eq("id", capa.id);
  if (updErr) return { ok: false, error: updErr.message };

  // Notify verifier (best-effort; bell reads on next load)
  await supabase.from("notifications").insert({
    kind: "assigned",
    capa_id: capa.id,
    recipient_id: capa.verifier_id,
    site_id: capa.site_id,
    title: `Verify CAPA: ${capa.title}`,
    body: "An independent verification is required. Open the CAPA to review and submit.",
  });

  await supabase.from("activity_events").insert({
    capa_id: capa.id,
    actor_id: user.id,
    verb: "capa.completed",
    payload: {},
  });

  revalidatePath(`/capa/${capa.id}`);
  revalidatePath("/capa");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// reassignVerifier — gated on capa:reassign_verifier (ehs_manager+).
// DB CHECK constraint enforces owner_id <> verifier_id; we add a friendly
// error before that fires.
// ---------------------------------------------------------------------------
const ReassignVerifierSchema = z.object({
  capa_id: z.string().uuid(),
  new_verifier_id: z.string().uuid(),
});

export async function reassignVerifier(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = ReassignVerifierSchema.safeParse({
    capa_id: fd.get("capa_id"),
    new_verifier_id: fd.get("new_verifier_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("capa:reassign_verifier", currentSiteId);

  const { data: capa, error: readErr } = await supabase
    .from("capas")
    .select("id, owner_id, verifier_id")
    .eq("id", parsed.data.capa_id)
    .single();
  if (readErr || !capa) {
    return { ok: false, error: readErr?.message ?? "CAPA not found" };
  }
  if (capa.owner_id === parsed.data.new_verifier_id) {
    return { ok: false, error: "Verifier must differ from the owner" };
  }

  const { error: updErr } = await supabase
    .from("capas")
    .update({ verifier_id: parsed.data.new_verifier_id })
    .eq("id", parsed.data.capa_id);
  if (updErr) return { ok: false, error: updErr.message };

  await supabase.from("activity_events").insert({
    capa_id: parsed.data.capa_id,
    actor_id: user.id,
    verb: "capa.verifier_reassigned",
    payload: {
      from: capa.verifier_id,
      to: parsed.data.new_verifier_id,
    },
  });

  revalidatePath(`/capa/${parsed.data.capa_id}`);
  return { ok: true };
}
