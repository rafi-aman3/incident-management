"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

// ---------------------------------------------------------------------------
// resolveFinding
// ---------------------------------------------------------------------------
const ResolveSchema = z.object({
  finding_id: z.string().uuid(),
  inspection_id: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});

export async function resolveFinding(input: {
  finding_id: string;
  inspection_id: string;
  notes?: string;
}): Promise<ActionResult> {
  const parsed = ResolveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { supabase, user } = await requireUser();

  // Look up site for the perm check
  const { data: f } = await supabase
    .from("inspection_findings")
    .select("site_id, inspection_id, status, comment")
    .eq("id", parsed.data.finding_id)
    .maybeSingle();
  if (!f) return { ok: false, error: "Finding not found" };
  if (f.inspection_id !== parsed.data.inspection_id) {
    return { ok: false, error: "Finding does not belong to this inspection" };
  }
  if (f.status === "resolved" || f.status === "escalated_to_incident") {
    return { ok: false, error: "Finding is already finalized" };
  }
  try {
    await requirePermission("finding:resolve", f.site_id);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  // Append notes to comment if provided
  const newComment = parsed.data.notes
    ? `${f.comment ?? ""}${f.comment ? "\n\n" : ""}Resolution: ${parsed.data.notes}`
    : f.comment;

  const { error } = await supabase
    .from("inspection_findings")
    .update({
      status: "resolved",
      resolved_at: new Date().toISOString(),
      resolved_by: user.id,
      comment: newComment,
    })
    .eq("id", parsed.data.finding_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(
    `/inspections/${parsed.data.inspection_id}/findings/${parsed.data.finding_id}`,
  );
  revalidatePath(`/inspections/${parsed.data.inspection_id}`);
  redirect(`/inspections/${parsed.data.inspection_id}`);
}

// ---------------------------------------------------------------------------
// escalateFindingToIncident — wraps escalate_finding_to_incident_v1 RPC
// ---------------------------------------------------------------------------
export async function escalateFindingToIncident(
  findingId: string
): Promise<ActionResult> {
  if (!findingId) return { ok: false, error: "Missing finding id" };
  const { supabase } = await requireUser();

  const { data: f } = await supabase
    .from("inspection_findings")
    .select("site_id")
    .eq("id", findingId)
    .maybeSingle();
  if (!f) return { ok: false, error: "Finding not found" };
  try {
    await requirePermission("finding:escalate", f.site_id);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { data, error } = await supabase.rpc(
    "escalate_finding_to_incident_v1",
    { p_finding_id: findingId }
  );
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Escalation failed" };
  }

  revalidatePath("/incidents");
  redirect(`/incidents/${data}`);
}
