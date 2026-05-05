"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Dismisses the role-specific welcome card. Idempotent — re-runs are no-op
 * because the column flips from false to true.
 */
export async function markWelcomeSeen(): Promise<ActionResult> {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ seen_welcome: true })
    .eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * Marks a notification resolved. Site-wide notifications (recipient_id NULL)
 * resolve for everyone — Phase 1 simplification; per-user acknowledgement
 * lands in Phase 2 alongside the email fan-out.
 */
export async function resolveNotification(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const id = fd.get("notification_id") as string | null;
  if (!id) return { ok: false, error: "Missing notification_id" };
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("notifications")
    .update({ acknowledged_at: new Date().toISOString(), resolved_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard");
  return { ok: true };
}
