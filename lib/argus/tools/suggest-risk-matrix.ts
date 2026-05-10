/**
 * Wand 1 — Risk-matrix suggestion (Step 3 of Report Wizard).
 *
 * Structured-output tool. The handler captures `parameters` as the suggestion
 * payload and lets the human Accept / Edit / Reject. Never auto-fills.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export interface RiskMatrixSuggestion {
  likelihood: 1 | 2 | 3 | 4 | 5;
  consequence: 1 | 2 | 3 | 4 | 5;
  confidence: number;
  rationale: string;
  insufficient_input?: string;
}

export const SUGGEST_RISK_MATRIX_TOOL: ToolDefinition = {
  name: "suggest_risk_matrix",
  description:
    "Suggest the 5×5 risk-matrix coordinates (likelihood × consequence) for the described incident. Use the SPEC §8 rubric: 1=Rare/Negligible, 5=AlmostCertain/Catastrophic. Never invent facts not in the input. If the description is too thin to score responsibly, set `insufficient_input` and leave likelihood/consequence at sentinel 1/1 with confidence 0.",
  parameters: {
    type: "object",
    required: ["likelihood", "consequence", "confidence", "rationale"],
    properties: {
      likelihood: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description:
          "1=Rare (less than once a decade) · 2=Unlikely (once a few years) · 3=Possible (yearly) · 4=Likely (quarterly) · 5=AlmostCertain (monthly+).",
      },
      consequence: {
        type: "integer",
        minimum: 1,
        maximum: 5,
        description:
          "1=Negligible (no injury, no damage) · 2=Minor (first-aid, <£500 damage) · 3=Moderate (medical attention, <£10k damage) · 4=Major (lost-time injury, <£100k damage) · 5=Catastrophic (fatality / >£100k damage).",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "0–1 scalar. Reflect uncertainty in the input. >0.8 = very confident; 0.5–0.8 = best guess; <0.5 = thin input.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description:
          "1–3 sentences explaining the pick. Cite the rubric tier you matched (e.g. 'Major because lost-time injury was reported').",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
        description:
          "When the description is empty or under ~10 words, set this to a one-line explanation of what's missing (e.g. 'Need a description of what happened and the outcome to score severity.'). Otherwise omit.",
      },
    },
  },
};
