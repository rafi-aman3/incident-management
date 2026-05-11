/**
 * Wand 8 — JSA step-controls suggestion (Phase 15).
 *
 * Given a single step-hazard (category + description + likelihood/consequence
 * + step + job context), returns 2–6 controls following the ISO 45001
 * hierarchy. Mirrors the §HZ `suggest_hazard_controls` wand but with stricter
 * guardrails because JSA controls go directly to workers performing the job.
 *
 * Hard rules baked into the system prompt:
 *   • Always include at least one elimination, substitution, or engineering
 *     control unless those are genuinely infeasible.
 *   • PPE-only sets must trigger `ppe_only_warning=true` so the UI raises an
 *     amber alert.
 *   • Each control description must be implementable — not "use protective
 *     measures" but "install LEV at the bay with capture velocity ≥0.5 m/s".
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const SUGGEST_STEP_CONTROLS_TOOL: ToolDefinition = {
  name: "suggest_step_controls",
  description:
    "Suggest 2–6 controls for a JSA step-hazard following the ISO 45001 hierarchy. PREFER higher tiers (elimination → substitution → engineering) over PPE. Flag PPE-only sets via ppe_only_warning so the UI can surface the auditor warning.",
  parameters: {
    type: "object",
    required: ["controls", "confidence", "rationale"],
    properties: {
      controls: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        description:
          "Controls in hierarchy order, highest tier first. Avoid PPE-only sets unless higher tiers are infeasible.",
        items: {
          type: "object",
          required: ["control_level", "control_description", "rationale"],
          properties: {
            control_level: {
              type: "string",
              enum: [
                "elimination",
                "substitution",
                "engineering",
                "administrative",
                "ppe",
              ],
              description: "ISO 45001 hierarchy level.",
            },
            control_description: {
              type: "string",
              minLength: 10,
              maxLength: 300,
              description:
                "One implementable sentence. Name who/what installs it and the measurable target where applicable.",
            },
            rationale: {
              type: "string",
              minLength: 10,
              maxLength: 200,
              description:
                "Why this level + control fits this specific hazard during this step.",
            },
          },
        },
      },
      ppe_only_warning: {
        type: "boolean",
        description:
          "Set true when the suggestions are entirely PPE — the UI surfaces an amber 'PPE-only' alert so the EHS author can add engineering / administrative controls before saving.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0–1. <0.5 = treat as starting point only.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description: "1–2 sentences tying the control set to the hazard's nature and the step context.",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
        description: "Set when the hazard description is too thin to recommend specifics.",
      },
    },
  },
};
