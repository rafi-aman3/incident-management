"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";

const AckSchema = z.object({
  incident_id: z.string().uuid(),
});

/**
 * Acknowledge an active stop-work. Flips `stop_work_acknowledged_at` and
 * `stop_work_acknowledged_by`. RLS already gates the UPDATE on site access;
 * any user the banner shows can press the button.
 *
 * `stop_work` itself stays true (audit trail). Un-acknowledging or re-raising
 * is out of scope for v1; the v2 lift-criteria + photo-proof flow will need a
 * different shape entirely.
 */
export async function acknowledgeStopWork(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = AckSchema.safeParse({
    incident_id: String(formData.get("incident_id") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();

  const { error } = await supabase
    .from("incidents")
    .update({
      stop_work_acknowledged_at: new Date().toISOString(),
      stop_work_acknowledged_by: user.id,
    })
    .eq("id", parsed.data.incident_id);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  return { ok: true };
}
