import { logObservationTool } from "./log-observation";
import { attachPhotoTool } from "./attach-photo";
import { raiseStopWorkTool } from "./raise-stop-work";
import type { ArgusToolDefinition } from "./types";

export { logObservationTool, attachPhotoTool, raiseStopWorkTool };
export type { ArgusToolDefinition, ToolContext } from "./types";

// Tool dispatch types as ArgusToolDefinition<unknown> — input has already been
// validated by Anthropic against the JSON Schema by the time it reaches us.
type AnyArgusTool = ArgusToolDefinition<Record<string, unknown>>;

/** Map of all Copilot tools, keyed by name for the agentic loop dispatch. */
export const COPILOT_TOOLS: Record<string, AnyArgusTool> = {
  [logObservationTool.name]: logObservationTool as unknown as AnyArgusTool,
  [attachPhotoTool.name]: attachPhotoTool as unknown as AnyArgusTool,
  [raiseStopWorkTool.name]: raiseStopWorkTool as unknown as AnyArgusTool,
};

/** Anthropic-shaped Tool array for `messages.stream({ tools })`. */
export function copilotToolsForAnthropic() {
  return Object.values(COPILOT_TOOLS).map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema,
  }));
}
