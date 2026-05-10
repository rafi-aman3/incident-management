import { logObservationTool } from "./log-observation";
import { attachPhotoTool } from "./attach-photo";
import { raiseStopWorkTool } from "./raise-stop-work";
import { updateIncidentFieldTool } from "./update-incident-field";
import { PROPOSE_INVESTIGATION_DRAFT_TOOL } from "./propose-investigation-draft";
import { SUGGEST_RISK_MATRIX_TOOL } from "./suggest-risk-matrix";
import { SUGGEST_FINDING_SEVERITY_TOOL } from "./suggest-finding-severity";
import { SUGGEST_VERIFICATION_METHOD_TOOL } from "./suggest-verification-method";
import { ASSESS_REPORTABILITY_TOOL } from "./assess-reportability";
import { DRAFT_CAPA_METADATA_TOOL } from "./draft-capa-metadata";
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

/**
 * Wand surfaces (9d). Each is a structured-output tool with no `execute()` —
 * the wand route handler captures the function-call arguments and returns
 * them as the suggestion payload. The human Accepts / Edits / Rejects in the
 * suggestion-card UI.
 */
export type WandSurface =
  | "risk_matrix"
  | "finding_severity"
  | "verification_method"
  | "reportability"
  | "capa_metadata";

export const WAND_TOOLS: Record<WandSurface, ToolDefinition> = {
  risk_matrix: SUGGEST_RISK_MATRIX_TOOL,
  finding_severity: SUGGEST_FINDING_SEVERITY_TOOL,
  verification_method: SUGGEST_VERIFICATION_METHOD_TOOL,
  reportability: ASSESS_REPORTABILITY_TOOL,
  capa_metadata: DRAFT_CAPA_METADATA_TOOL,
};

export {
  SUGGEST_RISK_MATRIX_TOOL,
  SUGGEST_FINDING_SEVERITY_TOOL,
  SUGGEST_VERIFICATION_METHOD_TOOL,
  ASSESS_REPORTABILITY_TOOL,
  DRAFT_CAPA_METADATA_TOOL,
};
export type { RiskMatrixSuggestion } from "./suggest-risk-matrix";
export type { ReportabilityVerdict } from "./assess-reportability";
