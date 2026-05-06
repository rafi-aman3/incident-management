"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { can, requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

const ScheduleKindSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "custom",
  "on_demand",
]);

const SiteSelectionSchema = z.object({
  site_id: z.string().uuid(),
  include_children: z.boolean().default(false),
});

const AssignSchema = z.object({
  template_id: z.string().uuid(),
  schedule_kind: ScheduleKindSchema,
  schedule_cron: z.string().trim().max(120).optional().nullable(),
  start_time_local: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM (24-hour)")
    .optional()
    .nullable(),
  selections: z.array(SiteSelectionSchema).min(1, "Pick at least one site"),
});

export async function assignTemplate(input: {
  template_id: string;
  schedule_kind: "daily" | "weekly" | "monthly" | "custom" | "on_demand";
  schedule_cron?: string | null;
  start_time_local?: string | null;
  selections: Array<{ site_id: string; include_children: boolean }>;
}): Promise<ActionResult<{ count: number }>> {
  const parsed = AssignSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  if (
    parsed.data.schedule_kind === "custom" &&
    !parsed.data.schedule_cron?.trim()
  ) {
    return { ok: false, error: "Custom schedule requires a cron expression" };
  }

  const { supabase, user } = await requireUser();

  // Resolve the template's currently published version (the version we
  // pin onto each new assignment row).
  const { data: tmpl, error: tErr } = await supabase
    .from("templates")
    .select("id, status, current_version_id, is_system_preset")
    .eq("id", parsed.data.template_id)
    .maybeSingle();
  if (tErr || !tmpl) {
    return { ok: false, error: tErr?.message ?? "Template not found" };
  }
  if (tmpl.is_system_preset) {
    return { ok: false, error: "Cannot assign a system preset directly — import it first" };
  }
  if (tmpl.status !== "published" || !tmpl.current_version_id) {
    return {
      ok: false,
      error: "Publish the template before assigning it",
    };
  }

  // Per-site permission check + upsert. Loop instead of bulk insert so a
  // single perm failure surfaces a clear error instead of silently
  // dropping rows.
  let count = 0;
  const errors: string[] = [];
  for (const sel of parsed.data.selections) {
    if (!(await can("template:assign", sel.site_id))) {
      errors.push(`Forbidden on site ${sel.site_id.slice(0, 8)}`);
      continue;
    }
    // Check if there's an existing active assignment on (template_id, site_id)
    const { data: existing } = await supabase
      .from("template_assignments")
      .select("id")
      .eq("template_id", parsed.data.template_id)
      .eq("site_id", sel.site_id)
      .is("unassigned_at", null)
      .maybeSingle();

    const payload = {
      template_id: parsed.data.template_id,
      template_version_id: tmpl.current_version_id,
      site_id: sel.site_id,
      include_children: sel.include_children,
      schedule_kind: parsed.data.schedule_kind,
      schedule_cron:
        parsed.data.schedule_kind === "custom"
          ? parsed.data.schedule_cron ?? null
          : null,
      start_time_local:
        parsed.data.schedule_kind === "on_demand"
          ? null
          : parsed.data.start_time_local ?? null,
      assigned_by: user.id,
    };
    if (existing) {
      const { error: upErr } = await supabase
        .from("template_assignments")
        .update(payload)
        .eq("id", existing.id);
      if (upErr) errors.push(upErr.message);
      else count++;
    } else {
      const { error: insErr } = await supabase
        .from("template_assignments")
        .insert(payload);
      if (insErr) errors.push(insErr.message);
      else count++;
    }
  }

  if (errors.length > 0) {
    return {
      ok: false,
      error:
        count > 0
          ? `Saved ${count} assignment${count === 1 ? "" : "s"}; some failed: ${errors.slice(0, 2).join("; ")}`
          : errors[0],
    };
  }

  revalidatePath(`/templates/${parsed.data.template_id}/assign`);
  revalidatePath(`/templates/${parsed.data.template_id}`);
  revalidatePath("/inspections");
  return { ok: true, data: { count } };
}

// ---------------------------------------------------------------------------
// unassignTemplate
// ---------------------------------------------------------------------------
export async function unassignTemplate(
  assignmentId: string
): Promise<ActionResult> {
  if (!assignmentId) return { ok: false, error: "Missing assignment id" };

  const { supabase } = await requireUser();
  const { data: a, error: rErr } = await supabase
    .from("template_assignments")
    .select("id, site_id, template_id, unassigned_at")
    .eq("id", assignmentId)
    .maybeSingle();
  if (rErr || !a) return { ok: false, error: rErr?.message ?? "Assignment not found" };
  if (a.unassigned_at) return { ok: true }; // Already unassigned

  try {
    await requirePermission("template:assign", a.site_id);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { error } = await supabase
    .from("template_assignments")
    .update({ unassigned_at: new Date().toISOString() })
    .eq("id", assignmentId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/templates/${a.template_id}/assign`);
  revalidatePath(`/templates/${a.template_id}`);
  revalidatePath("/inspections");
  return { ok: true };
}
