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
// verifyCapa — non-owner verifier path. Calls the verify_capa_v1 RPC, which
// atomically applies the right state change per outcome:
//   effective            → status='closed', verified_at + closed_at
//   partially_effective  → as above + auto-creates a follow-up CAPA
//                          (parent.follow_up_capa_id points at the new row)
//   not_effective        → status='in_progress', rejection_reason set
//   too_early_to_verify  → status stays pending_verification, re_verify_at
//
// Three layers of "owner ≠ verifier" enforcement:
//   1) UI hides the form when viewer is owner (in the page render)
//   2) This server action checks auth.uid() against owner_id AND verifier_id
//   3) The RPC re-checks both invariants in the same transaction
//   4) The DB CHECK constraint on `capas` rejects any direct row that
//      sets verifier_id = owner_id
// ---------------------------------------------------------------------------
const VerifyCapaSchema = z.object({
  capa_id: z.string().uuid(),
  result: z.enum([
    "effective",
    "partially_effective",
    "not_effective",
    "too_early_to_verify",
  ]),
  method: z.enum([
    "inspection",
    "monitoring",
    "audit_trend",
    "re_interview",
    "document_review",
  ]),
  notes: z.string().trim().max(5000).optional().or(z.literal("")),
  re_verify_at: z
    .string()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
});

export async function verifyCapa(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = VerifyCapaSchema.safeParse({
    capa_id: fd.get("capa_id"),
    result: fd.get("result"),
    method: fd.get("method"),
    notes: fd.get("notes") ?? "",
    re_verify_at: fd.get("re_verify_at") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.result === "not_effective" && !parsed.data.notes) {
    return {
      ok: false,
      error: "A rejection reason is required for 'Not effective'.",
    };
  }
  if (
    parsed.data.result === "too_early_to_verify" &&
    !parsed.data.re_verify_at
  ) {
    return {
      ok: false,
      error: "Pick a re-verification date for 'Too early to verify'.",
    };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("capa:verify", currentSiteId);

  // Pre-check at action layer: viewer must not be the owner.
  // (RPC re-checks this server-side; UI also hides the form when owner.)
  const { data: capa } = await supabase
    .from("capas")
    .select("owner_id, verifier_id, status")
    .eq("id", parsed.data.capa_id)
    .single();
  if (!capa) return { ok: false, error: "CAPA not found" };
  if (capa.owner_id === user.id) {
    return { ok: false, error: "CAPA owner cannot verify their own CAPA" };
  }
  if (capa.verifier_id !== user.id) {
    return { ok: false, error: "Only the assigned verifier can verify this CAPA" };
  }

  // The RPC accepts NULL for p_notes / p_re_verify_at (PL/pgSQL params are
  // nullable by default), but the generated TS type marks them as non-null.
  // Cast at the boundary; the RPC body handles null cases explicitly.
  const { error: rpcErr } = await supabase.rpc("verify_capa_v1", {
    p_capa_id: parsed.data.capa_id,
    p_result: parsed.data.result,
    p_method: parsed.data.method,
    p_notes: (parsed.data.notes || null) as unknown as string,
    p_re_verify_at: parsed.data.re_verify_at as unknown as string,
    p_actor_id: user.id,
  });
  if (rpcErr) return { ok: false, error: rpcErr.message };

  revalidatePath(`/capa/${parsed.data.capa_id}`);
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
