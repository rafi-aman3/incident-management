/**
 * Wand 7 — JSA step-hazards suggestion (Phase 15).
 *
 * Given a step description plus job-level context (title / area / job_description),
 * returns 2–6 step-hazard suggestions with category + likelihood + consequence
 * + a short rationale. The handler captures the parameters as the suggestion
 * payload and the UI inserts them as editable rows — never auto-commits.
 *
 * Guardrails are stricter than typical wands because incorrect hazard
 * suggestions can cascade into incorrect control recommendations:
 *   • The model is told to prefer SMALLER lists of well-justified hazards over
 *     a long list of speculative ones.
 *   • Each suggestion includes a rationale tying it to the step text.
 *   • `confidence` reflects how well the step text constrains the hazard set.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const SUGGEST_STEP_HAZARDS_TOOL: ToolDefinition = {
  name: "suggest_step_hazards",
  description:
    "Suggest 2–6 hazards a worker could encounter performing the given JSA step. Each hazard names its category, a one-sentence description, and a 5×5 likelihood / consequence score. Prefer a SHORT list of well-grounded hazards over a long speculative one — workers ignore over-padded JSAs.",
  parameters: {
    type: "object",
    required: ["hazards", "confidence", "rationale"],
    properties: {
      hazards: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        items: {
          type: "object",
          required: [
            "hazard_description",
            "hazard_category",
            "likelihood",
            "consequence",
            "rationale",
          ],
          properties: {
            hazard_description: {
              type: "string",
              minLength: 8,
              maxLength: 240,
              description:
                "One sentence. State the hazard concretely — what specifically can go wrong, and the typical mechanism of harm.",
            },
            hazard_category: {
              type: "string",
              enum: [
                "physical",
                "chemical",
                "biological",
                "psychosocial",
                "mechanical",
                "electrical",
                "ergonomic",
                "environmental",
              ],
              description: "ISO 45001-aligned category.",
            },
            likelihood: {
              type: "string",
              enum: ["rare", "unlikely", "possible", "likely", "almost_certain"],
              description:
                "Frequency of exposure during this step. 'rare' = once a decade; 'almost_certain' = monthly+.",
            },
            consequence: {
              type: "string",
              enum: ["insignificant", "minor", "moderate", "major", "catastrophic"],
              description:
                "Worst credible outcome. 'insignificant' = no injury; 'catastrophic' = fatality or permanent disability.",
            },
            rationale: {
              type: "string",
              minLength: 10,
              maxLength: 240,
              description:
                "Tie the hazard to a specific element of the step text. If the step doesn't justify this hazard clearly, lower confidence and consider omitting.",
            },
          },
        },
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description:
          "0–1. Below 0.5 means the step text is too thin to score responsibly; the EHS author should treat suggestions as a starting point only.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description:
          "1–2 sentences. How the step text drove the hazard set you returned.",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
        description:
          "Set when the step text is empty or under ~6 words. Otherwise omit.",
      },
    },
  },
};
