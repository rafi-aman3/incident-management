import { logArgusSuggestion } from "@/lib/argus/log";
import type { ArgusToolDefinition } from "./types";

interface Input {
  file_id: string;
  caption?: string;
}

/**
 * Links a photo (already uploaded to the `incident-attachments` bucket via
 * the photo-capture button) to the draft incident. The bucket upload + the
 * `incident_attachments` row creation happen client-side via the existing
 * `attachToIncident` action; this tool just records the model's intent in
 * the audit log so the conversation has a paper trail.
 *
 * The `file_id` here is the `incident_attachments.id` UUID returned by the
 * upload, not the storage_path or filename.
 */
export const attachPhotoTool: ArgusToolDefinition<Input> = {
  name: "attach_photo",
  description:
    "Acknowledge that a photo has been attached to the draft incident and add an optional caption tying it to the observation. Use only when a file_id is present in the conversation context.",
  parameters: {
    type: "object",
    properties: {
      file_id: {
        type: "string",
        description:
          "The incident_attachments.id (UUID) returned when the photo was uploaded. Echo back the value the user provided.",
      },
      caption: {
        type: "string",
        description:
          "Optional one-line caption tying the photo to the observation (max ~120 chars).",
      },
    },
    required: ["file_id"],
  },
  async execute(input, ctx) {
    if (!input.file_id?.trim()) return "Error: file_id is required.";

    // Verify the file_id exists, belongs to this incident, and the caller can
    // access it. RLS on incident_attachments already enforces site access.
    const { data: attachment, error: lookupErr } = await ctx.supabase
      .from("incident_attachments")
      .select("id, file_name")
      .eq("id", input.file_id)
      .eq("incident_id", ctx.incidentId)
      .maybeSingle();

    if (lookupErr || !attachment) {
      return `Error: photo ${input.file_id} not found on this incident.`;
    }

    await logArgusSuggestion({
      orgId: ctx.orgId,
      siteId: ctx.siteId,
      userId: ctx.userId,
      surface: "copilot",
      targetKind: "incident",
      targetId: ctx.incidentId,
      model: ctx.modelUsed,
      usage: { promptTokens: 0, completionTokens: 0 },
      payload: {
        kind: "photo_attached",
        attachment_id: attachment.id,
        file_name: attachment.file_name,
        caption: input.caption?.trim() ?? null,
      },
      activityVerb: "argus.photo_attached",
      activityIncidentId: ctx.incidentId,
    });

    return `Photo ${attachment.file_name} attached.`;
  },
};
