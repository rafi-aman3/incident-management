import { logArgusSuggestion } from "@/lib/argus/log";
import { MODEL_HAIKU } from "@/lib/argus/models";
import type { ArgusToolDefinition } from "./types";

interface Input {
  text: string;
  area?: string;
}

/**
 * Logs a free-text observation against the draft incident. Persisted as an
 * `argus_suggestions` row with surface='copilot', payload.kind='observation'.
 * Pre-Step-3 (when the wizard finalizes) the user can promote the observation
 * into the description field; that path lives on the wizard, not in this tool.
 */
export const logObservationTool: ArgusToolDefinition<Input> = {
  name: "log_observation",
  description:
    "Record a single hazard or unsafe-condition observation against the draft incident. Use the worker's own words, lightly cleaned up. One observation per call. Include the area/location if mentioned.",
  input_schema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description:
          "The observation in the worker's voice. Maximum ~280 chars. No PII (names → role + initials).",
      },
      area: {
        type: "string",
        description:
          "Optional — area, line, or location if the worker named one (e.g. 'Roof, north slope', 'Line 7').",
      },
    },
    required: ["text"],
  },
  async execute(input, ctx) {
    if (!input.text?.trim()) return "Error: observation text is required.";

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
        kind: "observation",
        text: input.text.trim(),
        area: input.area?.trim() ?? null,
      },
      activityVerb: "argus.observation_logged",
      activityIncidentId: ctx.incidentId,
    });

    return `Logged: ${input.text.trim()}`;
  },
};
