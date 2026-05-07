"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Annual-hours setters for the admin Site detail tab. Reuses the same
 * `report:edit_hours` permission and `site_annual_hours` table as the
 * OSHA 300A inline form so both surfaces are wire-compatible.
 */

const UpsertHoursSchema = z.object({
  site_id: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  hours_worked: z.coerce.number().int().min(0).max(1_000_000_000),
});

export async function setAnnualHoursAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = UpsertHoursSchema.safeParse({
    site_id: fd.get("site_id"),
    year: fd.get("year"),
    hours_worked: fd.get("hours_worked"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user } = await requireUser();
  await requirePermission("report:edit_hours", parsed.data.site_id);

  const { error } = await supabase.from("site_annual_hours").upsert(
    {
      site_id: parsed.data.site_id,
      year: parsed.data.year,
      hours_worked: parsed.data.hours_worked,
      updated_by: user.id,
    },
    { onConflict: "site_id,year" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  revalidatePath(`/reports/osha-300a`);
  return { ok: true };
}

const DeleteHoursSchema = z.object({
  site_id: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
});

export async function deleteAnnualHoursAction(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = DeleteHoursSchema.safeParse({
    site_id: fd.get("site_id"),
    year: fd.get("year"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("report:edit_hours", parsed.data.site_id);

  const { error } = await supabase
    .from("site_annual_hours")
    .delete()
    .eq("site_id", parsed.data.site_id)
    .eq("year", parsed.data.year);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  revalidatePath(`/reports/osha-300a`);
  return { ok: true };
}
