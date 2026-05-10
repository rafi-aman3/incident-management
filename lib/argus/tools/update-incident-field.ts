import { logArgusSuggestion } from "@/lib/argus/log";
import { MODEL_HAIKU } from "@/lib/argus/models";
import type { ArgusToolDefinition } from "./types";

interface Input {
  field: "type" | "title" | "description" | "area" | "location" | "substance" | "equipment";
  value: string;
  /** When `field='description'`, append to the existing text instead of replacing. */
  append?: boolean;
}

const ALLOWED_FIELDS = new Set<Input["field"]>([
  "type",
  "title",
  "description",
  "area",
  "location",
  "substance",
  "equipment",
]);

const VALID_TYPES = new Set([
  "injury",
  "illness",
  "near_miss",
  "environmental_release",
  "property_damage",
  "dangerous_occurrence",
  "unsafe_condition",
]);

/**
 * Auto-fill a single field on the draft incident. The model may call this
 * multiple times per turn to populate several fields. The wizard form
 * components re-init from server-rendered initial values, so a `router.refresh()`
 * call from the form-assistant strip after the stream ends propagates the
 * updates to the visible inputs.
 *
 * Hard rule preserved: this tool **only fills draft fields the user is
 * actively editing**. It does NOT touch severity, track, status, or any
 * load-bearing classification — those keep a named human signature via
 * the existing wizard flow.
 *
 * Trade-off: if the user is mid-typing in a field while Argus updates it,
 * their unsaved edit gets clobbered. In practice the user is using the
 * strip *because* they don't want to type, so this is acceptable. A future
 * polish could surface a "Argus updated 4 fields — Reload" banner instead
 * of auto-refreshing.
 */
export const updateIncidentFieldTool: ArgusToolDefinition<Input> = {
  name: "update_incident_field",
  description:
    "Auto-fill a single field on the draft incident the worker is reporting. Use this aggressively to populate Title, Description, Area, Location, Substance, or Equipment from what the worker dictated. The user can edit any value before submitting. Do NOT use this for severity, track, or status — those need a human signature.",
  input_schema: {
    type: "object",
    properties: {
      field: {
        type: "string",
        enum: ["type", "title", "description", "area", "location", "substance", "equipment"],
        description:
          "Which draft field to write. 'type' is the incident kind (one of: injury, illness, near_miss, environmental_release, property_damage, dangerous_occurrence, unsafe_condition). 'title' is the short headline (≤200 chars). 'description' is the long-form narrative. 'area' / 'location' are the where. 'substance' / 'equipment' apply only when relevant to the incident type.",
      },
      value: {
        type: "string",
        description: "The new value. Plain text. No PII (names → role + initials).",
      },
      append: {
        type: "boolean",
        description:
          "Only valid when field='description'. If true, append to the existing description on a new line instead of replacing.",
      },
    },
    required: ["field", "value"],
  },
  async execute(input, ctx) {
    if (!ALLOWED_FIELDS.has(input.field)) {
      return `Error: '${input.field}' is not a fillable field.`;
    }
    if (!input.value?.trim()) {
      return `Error: value is required for field '${input.field}'.`;
    }

    let valueToWrite = input.value.trim();

    // type is enum-validated against the incident_type enum.
    if (input.field === "type" && !VALID_TYPES.has(valueToWrite)) {
      return `Error: '${valueToWrite}' is not a valid incident type. Use one of: ${Array.from(VALID_TYPES).join(", ")}.`;
    }

    // append mode for description
    if (input.field === "description" && input.append) {
      const { data: existing } = await ctx.supabase
        .from("incidents")
        .select("description")
        .eq("id", ctx.incidentId)
        .maybeSingle();
      const prev = existing?.description?.trim();
      if (prev) valueToWrite = `${prev}\n${valueToWrite}`;
    }

    // Title has a 200-char hard limit in the schema; truncate gracefully so
    // a 250-char model output doesn't 500 the request.
    if (input.field === "title" && valueToWrite.length > 200) {
      valueToWrite = valueToWrite.slice(0, 197).trim() + "…";
    }

    // Switch over the validated field enum — Supabase's generated Update
    // type uses `RejectExcessProperties` that doesn't narrow through bracket
    // keys, so a typed switch is the simplest path that stays type-safe.
    const writer = ctx.supabase.from("incidents");
    const eq = (q: ReturnType<typeof writer.update>) => q.eq("id", ctx.incidentId);
    let result;
    switch (input.field) {
      case "type":
        result = await eq(
          writer.update({ type: valueToWrite as Parameters<typeof writer.update>[0]["type"] }),
        );
        break;
      case "title":
        result = await eq(writer.update({ title: valueToWrite }));
        break;
      case "description":
        result = await eq(writer.update({ description: valueToWrite }));
        break;
      case "area":
        result = await eq(writer.update({ area: valueToWrite }));
        break;
      case "location":
        result = await eq(writer.update({ location: valueToWrite }));
        break;
      case "substance":
        result = await eq(writer.update({ substance: valueToWrite }));
        break;
      case "equipment":
        result = await eq(writer.update({ equipment: valueToWrite }));
        break;
    }
    const error = result?.error;

    if (error) {
      return `Error: could not update ${input.field} — ${error.message}`;
    }

    await logArgusSuggestion({
      orgId: ctx.orgId,
      siteId: ctx.siteId,
      userId: ctx.userId,
      surface: "copilot",
      targetKind: "incident",
      targetId: ctx.incidentId,
      model: MODEL_HAIKU,
      usage: { promptTokens: 0, completionTokens: 0 },
      payload: {
        kind: "field_filled",
        field: input.field,
        value: valueToWrite,
        append: Boolean(input.append),
      },
      activityVerb: "argus.field_filled",
      activityIncidentId: ctx.incidentId,
    });

    return `Filled ${input.field}.`;
  },
};
