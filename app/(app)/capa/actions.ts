"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

// ---------------------------------------------------------------------------
// createCapa — used by both:
//   1) "+ New CAPA" on /capa (standalone — no investigation_id)
//   2) "Assign CAPA" close path on /investigations/[id] (atomic via the
//      assign_capa_from_investigation_v1 RPC)
//
// Path #2 wraps CAPA insert + investigation close + incident status bump
// in a single transaction so the investigation can't end up "closed" with
// no CAPA attached if the CAPA insert fails.
// ---------------------------------------------------------------------------
const CreateCapaSchema = z.object({
  investigation_id: z.string().uuid().optional().or(z.literal("")),
  type: z.enum(["corrective", "preventive"]),
  title: z.string().trim().min(1, "Title is required").max(200),
  description: z.string().trim().min(1, "Description is required").max(5000),
  owner_id: z.string().uuid(),
  verifier_id: z.string().uuid(),
  due_date: z.string().min(1, "Due date is required"),
});

export async function createCapa(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = CreateCapaSchema.safeParse({
    investigation_id: fd.get("investigation_id") ?? "",
    type: fd.get("type"),
    title: fd.get("title"),
    description: fd.get("description"),
    owner_id: fd.get("owner_id"),
    verifier_id: fd.get("verifier_id"),
    due_date: fd.get("due_date"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  if (parsed.data.owner_id === parsed.data.verifier_id) {
    return { ok: false, error: "Verifier must differ from the owner" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("capa:create", currentSiteId);

  const investigationId = parsed.data.investigation_id || null;

  if (investigationId) {
    // Atomic close-with-CAPA via RPC
    const { data: newId, error } = await supabase.rpc(
      "assign_capa_from_investigation_v1",
      {
        p_investigation_id: investigationId,
        p_type: parsed.data.type,
        p_title: parsed.data.title,
        p_description: parsed.data.description,
        p_owner_id: parsed.data.owner_id,
        p_verifier_id: parsed.data.verifier_id,
        p_due_date: parsed.data.due_date,
        p_actor_id: user.id,
      }
    );
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/investigations/${investigationId}`);
    revalidatePath("/investigations");
    revalidatePath("/capa");
    redirect(`/capa/${newId}`);
  }

  // Standalone CAPA — no investigation. Site comes from current_site.
  if (!currentSiteId) return { ok: false, error: "No active site" };

  const { data: site } = await supabase
    .from("sites")
    .select("id, org_id")
    .eq("id", currentSiteId)
    .single();
  if (!site) return { ok: false, error: "Site not found" };

  const { data: row, error: insErr } = await supabase
    .from("capas")
    .insert({
      org_id: site.org_id,
      site_id: site.id,
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      owner_id: parsed.data.owner_id,
      verifier_id: parsed.data.verifier_id,
      due_date: parsed.data.due_date,
      status: "created",
    })
    .select("id")
    .single();
  if (insErr || !row) return { ok: false, error: insErr?.message ?? "Insert failed" };

  await supabase.from("activity_events").insert({
    capa_id: row.id,
    actor_id: user.id,
    verb: "capa.created",
    payload: { type: parsed.data.type, standalone: true },
  });

  revalidatePath("/capa");
  redirect(`/capa/${row.id}`);
}
