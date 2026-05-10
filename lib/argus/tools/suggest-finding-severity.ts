/**
 * Wand 2 — Finding → incident escalation severity.
 *
 * Same coordinate output as risk-matrix. Different prompt: the input is a
 * closed-inspection finding being promoted to a full incident, so the model
 * reasons about what severity the *would-be* incident would carry.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const SUGGEST_FINDING_SEVERITY_TOOL: ToolDefinition = {
  name: "suggest_finding_severity",
  description:
    "Suggest the 5×5 risk-matrix coordinates for an inspection finding being escalated to a full incident. The finding is the input; predict the severity the resulting incident would carry. Use SPEC §8 rubric. If the finding is too thin (no hazard description, no observed condition), set `insufficient_input`.",
  parameters: {
    type: "object",
    required: ["likelihood", "consequence", "confidence", "rationale"],
    properties: {
      likelihood: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "Likelihood of the underlying hazard causing harm. 1=Rare … 5=AlmostCertain.",
      },
      consequence: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description: "Consequence band per SPEC §8. 1=Negligible … 5=Catastrophic.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0–1 scalar.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description: "1–3 sentences. Reference the finding's hazard class and what the worst-case incident would look like.",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
      },
    },
  },
};
