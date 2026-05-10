import { logObservationTool } from "./log-observation";
import { attachPhotoTool } from "./attach-photo";
import { raiseStopWorkTool } from "./raise-stop-work";
import { updateIncidentFieldTool } from "./update-incident-field";
import { PROPOSE_INVESTIGATION_DRAFT_TOOL } from "./propose-investigation-draft";
import type { ArgusToolDefinition } from "./types";

export { logObservationTool, attachPhotoTool, raiseStopWorkTool, updateIncidentFieldTool };
export { PROPOSE_INVESTIGATION_DRAFT_TOOL } from "./propose-investigation-draft";
export type { InvestigationDraftPayload } from "./propose-investigation-draft";
export type { ArgusToolDefinition, ToolContext } from "./types";

// Tool dispatch types as ArgusToolDefinition<unknown> — input has already been
// validated by Anthropic against the JSON Schema by the time it reaches us.
type AnyArgusTool = ArgusToolDefinition<Record<string, unknown>>;

/** Map of all Copilot tools, keyed by name for the agentic loop dispatch. */
export const COPILOT_TOOLS: Record<string, AnyArgusTool> = {
  [logObservationTool.name]: logObservationTool as unknown as AnyArgusTool,
  [attachPhotoTool.name]: attachPhotoTool as unknown as AnyArgusTool,
  [raiseStopWorkTool.name]: raiseStopWorkTool as unknown as AnyArgusTool,
  [updateIncidentFieldTool.name]: updateIncidentFieldTool as unknown as AnyArgusTool,
};

/** Anthropic-shaped Tool array for `messages.stream({ tools })`. */
export function copilotToolsForAnthropic() {
  return Object.values(COPILOT_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}

/**
 * Investigator (9c) uses structured-output tools — the model emits exactly
 * one `tool_use` block matching this schema, the route handler captures its
 * `input` directly, and there's no server-side `execute()` (no side effects).
 */
export function investigatorToolsForAnthropic() {
  return [
    {
      name: PROPOSE_INVESTIGATION_DRAFT_TOOL.name,
      description: PROPOSE_INVESTIGATION_DRAFT_TOOL.description,
      input_schema: PROPOSE_INVESTIGATION_DRAFT_TOOL.input_schema,
    },
  ];
}
