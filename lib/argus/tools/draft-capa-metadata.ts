/**
 * Wand 5 — CAPA Create modal Type + Title draft (open Q1, decided IN).
 *
 * Used when the Create-CAPA modal is opened from an investigation. The model
 * reads the investigation's findings + root_cause_summary and proposes a
 * CAPA type (corrective | preventive) and a regulator-readable title that
 * references the *root cause*, not the symptom.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const DRAFT_CAPA_METADATA_TOOL: ToolDefinition = {
  name: "draft_capa_metadata",
  description:
    "Draft a CAPA `type` (corrective vs preventive) and a short title from an investigation's root-cause findings. Title ≤ 80 chars. Reference the root cause, not the symptom. Corrective = address an existing problem; preventive = stop a similar problem from recurring elsewhere.",
  parameters: {
    type: "object",
    required: ["type", "title", "confidence", "rationale"],
    properties: {
      type: {
        type: "string",
        enum: ["corrective", "preventive"],
        description:
          "'corrective' when the CAPA fixes the immediate issue; 'preventive' when it generalises a fix to other sites / processes / equipment.",
      },
      title: {
        type: "string",
        maxLength: 80,
        description:
          "Imperative sentence, ≤80 chars. References root cause. Examples: 'Replace press 3 hydraulic seals on quarterly PM cycle'; 'Add spill containment to all hydraulic press bays'.",
      },
      suggested_owner_role: {
        type: "string",
        maxLength: 80,
        description:
          "Optional. Suggest a role (not a person) responsible for execution — e.g. 'Maintenance Supervisor', 'Site EHS Lead'. Omit if unclear.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      rationale: {
        type: "string",
        maxLength: 800,
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
      },
    },
  },
};
