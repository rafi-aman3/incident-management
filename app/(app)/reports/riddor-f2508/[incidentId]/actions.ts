"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

const RecordPhoneSchema = z.object({
  incident_id: z.string().uuid(),
  hse_phone_reference: z.string().trim().min(1, "HSE phone reference is required").max(120),
});

export async function recordHsePhoneCall(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = RecordPhoneSchema.safeParse({
    incident_id: fd.get("incident_id"),
    hse_phone_reference: fd.get("hse_phone_reference"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("notification:hse_record_edit", currentSiteId);

  const { error } = await supabase.from("hse_notification_records").upsert(
    {
      incident_id: parsed.data.incident_id,
      phone_called_at: new Date().toISOString(),
      phoned_by: user.id,
      hse_phone_reference: parsed.data.hse_phone_reference,
    },
    { onConflict: "incident_id" }
  );
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    incident_id: parsed.data.incident_id,
    actor_id: user.id,
    verb: "hse.phone_recorded",
    payload: { reference: parsed.data.hse_phone_reference },
  });

  revalidatePath(`/reports/riddor-f2508/${parsed.data.incident_id}`);
  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  return { ok: true };
}

const RecordOnlineSchema = z.object({
  incident_id: z.string().uuid(),
  riddor_online_reference: z
    .string()
    .trim()
    .min(1, "RIDDOR online reference is required")
    .max(120),
});

export async function recordHseOnlineSubmission(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = RecordOnlineSchema.safeParse({
    incident_id: fd.get("incident_id"),
    riddor_online_reference: fd.get("riddor_online_reference"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId } = await requireUser();
  await requirePermission("notification:hse_record_edit", currentSiteId);

  const { error } = await supabase.from("hse_notification_records").upsert(
    {
      incident_id: parsed.data.incident_id,
      written_submitted_at: new Date().toISOString(),
      riddor_online_reference: parsed.data.riddor_online_reference,
    },
    { onConflict: "incident_id" }
  );
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    incident_id: parsed.data.incident_id,
    actor_id: user.id,
    verb: "hse.online_recorded",
    payload: { reference: parsed.data.riddor_online_reference },
  });

  revalidatePath(`/reports/riddor-f2508/${parsed.data.incident_id}`);
  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  return { ok: true };
}
