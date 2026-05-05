"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";

const AttachmentSchema = z.object({
  incident_id: z.string().uuid(),
  storage_path: z.string().min(1).max(500),
  file_name: z.string().min(1).max(255),
  mime_type: z.string().max(120).optional().or(z.literal("")),
  size_bytes: z.number().int().nonnegative().optional(),
});
export type AttachmentInput = z.infer<typeof AttachmentSchema>;

/**
 * Records the metadata row for a file already uploaded to the
 * incident-attachments bucket. The browser client uploads directly
 * (Supabase Storage RLS validates the <incident_id>/... path prefix);
 * this action just persists the pointer so the detail page can list it.
 */
export async function attachToIncident(input: AttachmentInput): Promise<ActionResult<{ id: string }>> {
  const parsed = AttachmentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid attachment" };
  }
  const { supabase, user } = await requireUser();

  const { data, error } = await supabase
    .from("incident_attachments")
    .insert({
      incident_id: parsed.data.incident_id,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type || null,
      size_bytes: parsed.data.size_bytes ?? null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  revalidatePath(`/incidents/${parsed.data.incident_id}`);
  return { ok: true, data: { id: data.id } };
}
