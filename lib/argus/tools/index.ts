import { logObservationTool } from "./log-observation";
import { attachPhotoTool } from "./attach-photo";
import { raiseStopWorkTool } from "./raise-stop-work";
import { updateIncidentFieldTool } from "./update-incident-field";
import { PROPOSE_INVESTIGATION_DRAFT_TOOL } from "./propose-investigation-draft";
import type { ArgusToolDefinition } from "./types";
import type { ToolDefinition } from "@/lib/argus/llm";

export {
  logObservationTool,
  attachPhotoTool,
  raiseStopWorkTool,
  updateIncidentFieldTool,
};
export { PROPOSE_INVESTIGATION_DRAFT_TOOL } from "./propose-investigation-draft";
export type { InvestigationDraftPayload } from "./propose-investigation-draft";
export type { ArgusToolDefinition, ToolContext } from "./types";

// Tool dispatch types as ArgusToolDefinition<unknown> — the model has already
// validated input against `parameters` by the time the route handler dispatches.
type AnyArgusTool = ArgusToolDefinition<Record<string, unknown>>;

/** Map of all Copilot tools, keyed by name for the agentic loop dispatch. */
export const COPILOT_TOOLS: Record<string, AnyArgusTool> = {
  [logObservationTool.name]: logObservationTool as unknown as AnyArgusTool,
  [attachPhotoTool.name]: attachPhotoTool as unknown as AnyArgusTool,
  [raiseStopWorkTool.name]: raiseStopWorkTool as unknown as AnyArgusTool,
  [updateIncidentFieldTool.name]:
    updateIncidentFieldTool as unknown as AnyArgusTool,
};

/** Provider-agnostic tool list for `streamText({ tools })` — the route hands
 *  this to the LLM abstraction; the adapter translates to its native shape. */
export function copilotTools(): ToolDefinition[] {
  return Object.values(COPILOT_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    parameters: t.parameters,
  }));
}

/**
 * Investigator (9c) uses one structured-output tool. Returned bare so the
 * route can pass it as `tool: PROPOSE_INVESTIGATION_DRAFT_TOOL` to
 * `generateStructured`.
 */
export const INVESTIGATOR_TOOL: ToolDefinition = PROPOSE_INVESTIGATION_DRAFT_TOOL;
