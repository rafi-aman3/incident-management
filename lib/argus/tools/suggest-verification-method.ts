/**
 * Wand 3 — CAPA verification-method suggestion.
 *
 * The five enums map to specific evidence styles per SPEC §10:
 *   - inspection: physical re-check on a closed defect (e.g. confirm a guard
 *     was reinstalled).
 *   - monitoring: ongoing measurement over time (e.g. air-quality readings
 *     for N weeks).
 *   - audit_trend: dataset / report comparison (e.g. near-miss rate before
 *     vs. after).
 *   - re_interview: follow-up conversation with the affected workers.
 *   - document_review: confirm a procedure / SOP / training record was
 *     updated and signed off.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export const SUGGEST_VERIFICATION_METHOD_TOOL: ToolDefinition = {
  name: "suggest_verification_method",
  description:
    "Pick the most appropriate verification method for a CAPA based on the action description. Five options: inspection (physical re-check), monitoring (ongoing measurement), audit_trend (data comparison), re_interview (follow-up with affected workers), document_review (SOP / training-record check).",
  parameters: {
    type: "object",
    required: ["method", "confidence", "rationale"],
    properties: {
      method: {
        type: "string",
        enum: [
          "inspection",
          "monitoring",
          "audit_trend",
          "re_interview",
          "document_review",
        ],
        description: "The verification-method enum value.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "0–1. <0.6 → caller will suppress the suggestion-card.",
      },
      rationale: {
        type: "string",
        maxLength: 800,
        description:
          "1–2 sentences. Tie the method to the CAPA's nature (engineering control → inspection; behavioral → re_interview; etc.).",
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
      },
    },
  },
};
