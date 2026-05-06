"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";
import type { InspectionAnswer } from "@/lib/templates/types";

type Json = Database["public"]["Tables"]["inspections"]["Update"]["answers"];

// ---------------------------------------------------------------------------
// startInspection
//   Creates an inspections row with template_version_id snapshotted from
//   either the active version or, if an assignment_id is provided, that
//   assignment's pinned version. The site_id is the user's current site
//   (validated against the template having an active assignment there).
// ---------------------------------------------------------------------------
const StartSchema = z.object({
  template_id: z.string().uuid(),
  assignment_id: z.string().uuid().optional(),
  site_id: z.string().uuid(),
  title: z.string().trim().min(1).max(200).optional(),
});

export async function startInspection(input: {
  template_id: string;
  assignment_id?: string;
  site_id: string;
  title?: string;
}): Promise<ActionResult<{ id: string; ref_code: string }>> {
  const parsed = StartSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await requirePermission("inspection:start", parsed.data.site_id);
  } catch {
    return { ok: false, error: "Forbidden" };
  }

  const { supabase, user, profile } = await requireUser();

  // Resolve the version to snapshot
  let templateVersionId: string | null = null;
  if (parsed.data.assignment_id) {
    const { data: a } = await supabase
      .from("template_assignments")
      .select("template_version_id, template_id")
      .eq("id", parsed.data.assignment_id)
      .is("unassigned_at", null)
      .maybeSingle();
    if (a && a.template_id === parsed.data.template_id) {
      templateVersionId = a.template_version_id;
    }
  }
  if (!templateVersionId) {
    const { data: t, error: tErr } = await supabase
      .from("templates")
      .select("current_version_id, name, status")
      .eq("id", parsed.data.template_id)
      .maybeSingle();
    if (tErr || !t) return { ok: false, error: tErr?.message ?? "Template not found" };
    if (t.status !== "published") {
      return { ok: false, error: "Template is not published" };
    }
    if (!t.current_version_id) {
      return { ok: false, error: "Template has no published version" };
    }
    templateVersionId = t.current_version_id;
  }

  // Pull the template name for the default title
  const { data: tmpl } = await supabase
    .from("templates")
    .select("name")
    .eq("id", parsed.data.template_id)
    .single();

  const title =
    parsed.data.title ??
    `${tmpl?.name ?? "Inspection"} — ${new Date().toLocaleDateString()}`;

  const { data: ins, error: insErr } = await supabase
    .from("inspections")
    .insert({
      org_id: profile.org_id,
      template_id: parsed.data.template_id,
      template_version_id: templateVersionId,
      assignment_id: parsed.data.assignment_id ?? null,
      site_id: parsed.data.site_id,
      title,
      inspector_id: user.id,
      status: "in_progress",
      conducted_at: new Date().toISOString(),
    })
    .select("id, ref_code")
    .single();
  if (insErr || !ins) {
    return { ok: false, error: insErr?.message ?? "Failed to start inspection" };
  }

  revalidatePath("/inspections");
  redirect(`/inspections/${ins.id}`);
}

// ---------------------------------------------------------------------------
// saveInspectionAnswer — JSONB merge into inspections.answers / header_responses
// ---------------------------------------------------------------------------
const AnswerScopeSchema = z.enum(["body", "header"]);

const AnswerSchema = z.object({
  inspection_id: z.string().uuid(),
  item_id: z.string().min(1).max(100),
  scope: AnswerScopeSchema,
  answer: z.record(z.string(), z.unknown()),
});

export async function saveInspectionAnswer(input: {
  inspection_id: string;
  item_id: string;
  scope: "body" | "header";
  answer: InspectionAnswer;
}): Promise<ActionResult> {
  const parsed = AnswerScopeSchema.safeParse(input.scope);
  if (!parsed.success) return { ok: false, error: "Invalid scope" };
  const v = AnswerSchema.safeParse(input);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message ?? "Invalid" };

  const { supabase } = await requireUser();

  // Read current answers blob, merge, write back. (Postgres jsonb_set
  // would be O(1) but requires an RPC; for v1 the read-modify-write is
  // fine since the row is small and writes are debounced.)
  const { data: ins, error: rdErr } = await supabase
    .from("inspections")
    .select("id, status, site_id, inspector_id, answers, header_responses")
    .eq("id", v.data.inspection_id)
    .maybeSingle();
  if (rdErr || !ins) {
    return { ok: false, error: rdErr?.message ?? "Inspection not found" };
  }
  if (ins.status === "completed" || ins.status === "abandoned") {
    return { ok: false, error: "Inspection is already finalized" };
  }

  const current =
    (v.data.scope === "header" ? ins.header_responses : ins.answers) ??
    ({} as Record<string, InspectionAnswer>);
  const next = {
    ...(current as Record<string, InspectionAnswer>),
    [v.data.item_id]: v.data.answer as InspectionAnswer,
  };

  const updateRes =
    v.data.scope === "header"
      ? await supabase
          .from("inspections")
          .update({ header_responses: next as unknown as Json })
          .eq("id", v.data.inspection_id)
      : await supabase
          .from("inspections")
          .update({ answers: next as unknown as Json })
          .eq("id", v.data.inspection_id);
  if (updateRes.error) return { ok: false, error: updateRes.error.message };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// attachInspectionUpload — record metadata after a client-side
// Storage upload to inspection-uploads/<inspection_id>/...
// ---------------------------------------------------------------------------
const AttachSchema = z.object({
  inspection_id: z.string().uuid(),
  item_id: z.string().min(1).max(100),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(300),
  mime_type: z.string().min(1).max(120),
  size_bytes: z.number().int().nonnegative(),
});

export async function attachInspectionUpload(input: {
  inspection_id: string;
  item_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
}): Promise<ActionResult<{ id: string }>> {
  const parsed = AttachSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("inspection_uploads")
    .insert({
      inspection_id: parsed.data.inspection_id,
      item_id: parsed.data.item_id,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type,
      size_bytes: parsed.data.size_bytes,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to attach" };
  }
  return { ok: true, data: { id: data.id } };
}

export async function removeInspectionUpload(
  uploadId: string
): Promise<ActionResult> {
  if (!uploadId) return { ok: false, error: "Missing upload id" };
  const { supabase } = await requireUser();
  // Soft-delete the metadata row + try to remove the storage object;
  // we ignore storage errors since the metadata write is the source of
  // truth and the bucket has its own RLS gate.
  const { data: existing } = await supabase
    .from("inspection_uploads")
    .select("storage_path")
    .eq("id", uploadId)
    .maybeSingle();
  if (!existing) return { ok: true };
  const { error } = await supabase
    .from("inspection_uploads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", uploadId);
  if (error) return { ok: false, error: error.message };
  await supabase.storage
    .from("inspection-uploads")
    .remove([existing.storage_path]);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// completeInspection — wraps complete_inspection_v1 RPC
// ---------------------------------------------------------------------------
export async function completeInspection(
  inspectionId: string
): Promise<ActionResult> {
  if (!inspectionId) return { ok: false, error: "Missing inspection id" };

  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("complete_inspection_v1", {
    p_inspection_id: inspectionId,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inspections/${inspectionId}`);
  revalidatePath("/inspections");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// abandonInspection
// ---------------------------------------------------------------------------
const AbandonSchema = z.object({
  inspection_id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export async function abandonInspection(input: {
  inspection_id: string;
  reason?: string;
}): Promise<ActionResult> {
  const parsed = AbandonSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid" };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("inspections")
    .update({
      status: "abandoned",
      abandoned_at: new Date().toISOString(),
      abandon_reason: parsed.data.reason ?? null,
    })
    .eq("id", parsed.data.inspection_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/inspections/${parsed.data.inspection_id}`);
  revalidatePath("/inspections");
  return { ok: true };
}
