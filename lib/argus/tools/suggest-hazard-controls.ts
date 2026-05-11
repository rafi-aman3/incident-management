/**
 * Wand 6 — Hazard controls suggestion (Phase 14).
 *
 * Suggests a set of ISO 45001-hierarchy controls (elimination → PPE) for a
 * hazard description. Used on the candidate-review form (Convert mode) to
 * pre-fill the initial controls section, and on the controls section of an
 * existing hazard detail page.
 *
 * Hard constraint: the model is asked to PREFER higher-tier controls
 * (elimination / substitution / engineering) over PPE, and to flag when the
 * only achievable control is PPE so the EHS Manager is forewarned about the
 * auditor warning before submitting.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const SUGGEST_HAZARD_CONTROLS_TOOL: ToolDefinition = {
  name: "suggest_hazard_controls",
  description:
    "Suggest 2–6 hazard controls following the ISO 45001 hierarchy for a given hazard. Each control names a level (elimination / substitution / engineering / administrative / ppe), a one-sentence description, and a short rationale. PREFER higher-tier controls — elimination first, PPE only as last resort. If only PPE controls are feasible, flag it via ppe_only_warning so the EHS Manager knows this will trigger the auditor warning tile.",
  parameters: {
    type: "object",
    required: ["controls", "confidence", "rationale"],
    properties: {
      controls: {
        type: "array",
        minItems: 2,
        maxItems: 6,
        description: "Suggested controls in hierarchy order (highest tier first).",
        items: {
          type: "object",
          required: ["level", "description", "rationale"],
          properties: {
            level: {
              type: "string",
              enum: ["elimination", "substitution", "engineering", "administrative", "ppe"],
              description: "ISO 45001 control hierarchy level.",
            },
            description: {
              type: "string",
              minLength: 10,
              maxLength: 300,
              description:
                "One-sentence implementable control. Be specific about who installs / enforces it.",
            },
            rationale: {
              type: "string",
              minLength: 10,
              maxLength: 200,
              description:
                "Why this level for this hazard category. Cite the hazard's nature briefly.",
            },
          },
        },
      },
      ppe_only_warning: {
        type: "boolean",
        description:
          "Set true when the suggestions are PPE-only and higher-tier controls were ruled out — the UI will surface a warning so the EHS Manager can add an engineering control before saving.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0–1. <0.5 means treat suggestions as a starting point only.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description:
          "1–2 sentences. Tie the overall control mix to the hazard's category + setting.",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
      },
    },
  },
};
