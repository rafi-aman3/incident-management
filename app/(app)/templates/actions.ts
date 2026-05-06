"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requireOrgPermission } from "@/lib/auth/orgCan";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { IndustryEnum } from "@/lib/templates/industry-map";
import { INDUSTRY_VALUES } from "@/lib/templates/industry-map";

// ---------------------------------------------------------------------------
// importPresetToOrg
//   Calls import_preset_to_org_v1 RPC to clone a system-preset template
//   into the caller's org as a fresh draft v1, then redirects to the editor.
//   The RPC asserts template:create — we double-check at the action layer
//   for clearer error messages.
// ---------------------------------------------------------------------------
export async function importPresetToOrg(presetId: string): Promise<ActionResult<{ id: string }>> {
  if (!presetId || typeof presetId !== "string") {
    return { ok: false, error: "Missing preset id" };
  }
  try {
    await requireOrgPermission("template:create");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("import_preset_to_org_v1", {
    p_preset_id: presetId,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/templates");
  // The RPC returns the new template id; redirect to the editor (Phase 3
  // editor lands in Task 5 — for now this resolves to a 404, which is
  // expected and documented in the smoke test).
  redirect(`/templates/${data}/edit`);
}

// ---------------------------------------------------------------------------
// createTemplate (blank — used by /templates/new)
// ---------------------------------------------------------------------------
const CreateTemplateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  industry: z.enum(INDUSTRY_VALUES as ReadonlyArray<IndustryEnum>),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
});

// useActionState-compatible variant — accepts the previous state as first arg.
export async function createTemplateForForm(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  return createTemplate(fd);
}

export async function createTemplate(fd: FormData): Promise<ActionResult> {
  const parsed = CreateTemplateSchema.safeParse({
    name: fd.get("name"),
    industry: fd.get("industry"),
    description: fd.get("description") ?? "",
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  try {
    await requireOrgPermission("template:create");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase, user, profile } = await requireUser();
  const { data: tmpl, error: insertErr } = await supabase
    .from("templates")
    .insert({
      org_id: profile.org_id,
      name: parsed.data.name,
      description: parsed.data.description || null,
      industry: parsed.data.industry,
      status: "draft",
      is_system_preset: false,
      is_imported: false,
      created_by: user.id,
    })
    .select("id")
    .single();
  if (insertErr || !tmpl) {
    return { ok: false, error: insertErr?.message ?? "Failed to create template" };
  }

  const { data: ver, error: verErr } = await supabase
    .from("template_versions")
    .insert({
      template_id: tmpl.id,
      version_number: 1,
      status: "draft",
    })
    .select("id")
    .single();
  if (verErr || !ver) {
    return { ok: false, error: verErr?.message ?? "Failed to create draft version" };
  }

  await supabase
    .from("templates")
    .update({ current_version_id: ver.id })
    .eq("id", tmpl.id);

  revalidatePath("/templates");
  redirect(`/templates/${tmpl.id}/edit`);
}

// ---------------------------------------------------------------------------
// archiveTemplate / restoreTemplate
// ---------------------------------------------------------------------------
export async function archiveTemplate(templateId: string): Promise<ActionResult> {
  if (!templateId) return { ok: false, error: "Missing template id" };
  try {
    await requireOrgPermission("template:archive");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("templates")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", templateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/templates");
  return { ok: true };
}

export async function restoreTemplate(templateId: string): Promise<ActionResult> {
  if (!templateId) return { ok: false, error: "Missing template id" };
  try {
    await requireOrgPermission("template:archive");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase } = await requireUser();
  // Restore to 'draft' — user has to explicitly publish again
  const { error } = await supabase
    .from("templates")
    .update({ status: "draft", archived_at: null })
    .eq("id", templateId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/templates");
  return { ok: true };
}
