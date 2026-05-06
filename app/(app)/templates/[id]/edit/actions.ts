"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requireOrgPermission } from "@/lib/auth/orgCan";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";

type Json = Database["public"]["Tables"]["template_versions"]["Update"]["header"];

// ---------------------------------------------------------------------------
// Zod schema for the autosave payload. The editor sends the entire JSONB
// blob — header / items / template_data — on each save. Cheaper than a
// delta for v1 (templates are small; few KB) and avoids drift between
// client and server item state.
// ---------------------------------------------------------------------------
const NodeItemSchema = z
  .object({
    item_id: z.string(),
    parent_id: z.string().optional(),
    type: z.string(),
    label: z.string().nullable(),
    options: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const AnswerSetSchema = z.object({
  id: z.string(),
  type: z.enum(["question", "list"]),
  responses: z
    .array(
      z
        .object({
          id: z.string(),
          label: z.string(),
          score: z.number().optional(),
          colour: z.string().optional(),
          enable_score: z.boolean().optional(),
          failed: z.boolean().optional(),
        })
        .passthrough()
    )
    .max(20),
});

const TemplateDataSchema = z.object({
  answer_sets: z.record(z.string(), AnswerSetSchema).default({}),
  condition_sets: z.array(z.object({ id: z.string(), type: z.string() })).optional(),
});

const SaveDraftSchema = z.object({
  version_id: z.string().uuid(),
  template_id: z.string().uuid(),
  header: z.array(NodeItemSchema).max(50),
  items: z.array(NodeItemSchema).max(500),
  template_data: TemplateDataSchema,
  // Optional: also patch template metadata (name / description) from the
  // top-of-editor name input
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
});

export type SaveDraftInput = z.infer<typeof SaveDraftSchema>;

export async function saveDraftVersion(
  input: SaveDraftInput
): Promise<ActionResult<{ saved_at: string }>> {
  const parsed = SaveDraftSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid payload",
    };
  }
  try {
    await requireOrgPermission("template:edit");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase } = await requireUser();

  // Verify the version is still a draft (defense-in-depth; RLS also blocks
  // mutations on archived/published versions, but a clearer error for the
  // user is worth the extra round-trip)
  const { data: ver, error: verErr } = await supabase
    .from("template_versions")
    .select("id, status, template_id")
    .eq("id", parsed.data.version_id)
    .maybeSingle();
  if (verErr || !ver) {
    return { ok: false, error: verErr?.message ?? "Version not found" };
  }
  if (ver.status !== "draft") {
    return {
      ok: false,
      error: "This version is published and read-only. Re-edit from the active version.",
    };
  }
  if (ver.template_id !== parsed.data.template_id) {
    return { ok: false, error: "Version / template mismatch" };
  }

  const savedAt = new Date().toISOString();

  const { error: updErr } = await supabase
    .from("template_versions")
    .update({
      header: parsed.data.header as Json,
      items: parsed.data.items as Json,
      template_data: parsed.data.template_data as Json,
      updated_at: savedAt,
    })
    .eq("id", parsed.data.version_id);
  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  // Optionally patch the parent template metadata
  if (parsed.data.name !== undefined || parsed.data.description !== undefined) {
    type TemplatePatch = Database["public"]["Tables"]["templates"]["Update"];
    const patch: TemplatePatch = {};
    if (parsed.data.name !== undefined) patch.name = parsed.data.name;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    const { error: tErr } = await supabase
      .from("templates")
      .update(patch)
      .eq("id", parsed.data.template_id);
    if (tErr) {
      return { ok: false, error: tErr.message };
    }
  }

  revalidatePath(`/templates/${parsed.data.template_id}/edit`);
  revalidatePath(`/templates/${parsed.data.template_id}`);
  revalidatePath(`/templates`);
  return { ok: true, data: { saved_at: savedAt } };
}

// ---------------------------------------------------------------------------
// publishTemplateVersion — wraps the publish_template_version_v1 RPC.
// The RPC enforces the 10-char minimum on change_summary, asserts the
// version is a draft, and archives the previous current_version_id.
// ---------------------------------------------------------------------------
const PublishSchema = z.object({
  template_id: z.string().uuid(),
  draft_version_id: z.string().uuid(),
  change_summary: z
    .string()
    .trim()
    .min(10, "Describe what changed in at least 10 characters")
    .max(2000),
});

export async function publishTemplateVersion(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = PublishSchema.safeParse({
    template_id: fd.get("template_id"),
    draft_version_id: fd.get("draft_version_id"),
    change_summary: fd.get("change_summary"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }
  try {
    await requireOrgPermission("template:publish");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase, user } = await requireUser();
  const { error } = await supabase.rpc("publish_template_version_v1", {
    p_template_id: parsed.data.template_id,
    p_draft_version_id: parsed.data.draft_version_id,
    p_change_summary: parsed.data.change_summary,
    p_actor_id: user.id,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath(`/templates/${parsed.data.template_id}/edit`);
  revalidatePath(`/templates/${parsed.data.template_id}`);
  revalidatePath("/templates");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// createNewDraftFromCurrent — auto-called when a user with template:edit
// opens an active template's edit route. Clones the current published
// version's content into a new draft at version_number = current + 1.
// Idempotent: returns the existing draft if one already exists.
// ---------------------------------------------------------------------------
export async function createNewDraftFromCurrent(
  templateId: string
): Promise<ActionResult<{ draft_version_id: string }>> {
  if (!templateId) return { ok: false, error: "Missing template id" };
  try {
    await requireOrgPermission("template:edit");
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase } = await requireUser();

  // Look for an existing draft on this template — return it if found
  const { data: existing } = await supabase
    .from("template_versions")
    .select("id")
    .eq("template_id", templateId)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    return { ok: true, data: { draft_version_id: existing.id } };
  }

  // Otherwise clone the current_version_id into a new draft
  const { data: tmpl, error: tErr } = await supabase
    .from("templates")
    .select("id, current_version_id")
    .eq("id", templateId)
    .single();
  if (tErr || !tmpl) {
    return { ok: false, error: tErr?.message ?? "Template not found" };
  }
  if (!tmpl.current_version_id) {
    return { ok: false, error: "Template has no current version" };
  }

  const { data: cur, error: vErr } = await supabase
    .from("template_versions")
    .select("version_number, header, items, template_data")
    .eq("id", tmpl.current_version_id)
    .single();
  if (vErr || !cur) {
    return { ok: false, error: vErr?.message ?? "Current version missing" };
  }

  const { data: newDraft, error: insErr } = await supabase
    .from("template_versions")
    .insert({
      template_id: templateId,
      version_number: (cur.version_number ?? 1) + 1,
      status: "draft",
      header: cur.header,
      items: cur.items,
      template_data: cur.template_data,
    })
    .select("id")
    .single();
  if (insErr || !newDraft) {
    return { ok: false, error: insErr?.message ?? "Failed to create draft" };
  }

  return { ok: true, data: { draft_version_id: newDraft.id } };
}
