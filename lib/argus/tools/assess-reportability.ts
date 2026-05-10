/**
 * Wand 4 — OSHA / RIDDOR reportability confidence pane (read-only).
 *
 * Smart-tier (Gemini 2.5 Pro). The model cites the specific 29 CFR 1904.7
 * subsection (US) or RIDDOR 2013 Schedule 2 paragraph (GB) that triggered
 * the verdict. A `confidence < 0.7` band is rendered in the UI as
 * "uncertain" rather than reportable / not_reportable to surface ambiguity.
 *
 * The pane never auto-files. The human's existing `Generate report` click
 * stays the source of truth.
 */

import type { ToolDefinition } from "@/lib/argus/llm";

export interface ReportabilityVerdict {
  verdict: "reportable" | "not_reportable" | "uncertain";
  citation: string;
  confidence: number;
  rationale: string;
  threshold_met: string[];
  insufficient_input?: string;
}

export const ASSESS_REPORTABILITY_TOOL: ToolDefinition = {
  name: "assess_reportability",
  description:
    "Assess whether an incident is reportable under the named jurisdiction. US → 29 CFR 1904.7 (recordable injury/illness criteria). GB → RIDDOR 2013 Schedule 2 (specified injuries, dangerous occurrences, occupational diseases). Cite the specific subsection. If the incident summary is too thin to assess (no outcome, no medical info), set `insufficient_input`.",
  parameters: {
    type: "object",
    required: ["verdict", "citation", "confidence", "rationale", "threshold_met"],
    properties: {
      verdict: {
        type: "string",
        enum: ["reportable", "not_reportable", "uncertain"],
        description:
          "'uncertain' is reserved for confidence < 0.7 OR when key facts (e.g. days-away count, treatment type) are missing from the input.",
      },
      citation: {
        type: "string",
        maxLength: 200,
        description:
          "Specific regulation reference, e.g. '29 CFR 1904.7(b)(2) — fracture (other than fingers/toes)' or 'RIDDOR 2013 Schedule 2 §1(a) — fracture other than to fingers, thumbs or toes'.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
      },
      rationale: {
        type: "string",
        maxLength: 1200,
        description:
          "2–4 sentences. Plain English. State the threshold that was (or wasn't) met and the fact pattern that drove the call.",
      },
      threshold_met: {
        type: "array",
        description:
          "Bullet list of regulatory thresholds the incident clears (e.g. 'medical treatment beyond first aid', 'days away from work', 'specified injury'). Empty array when verdict is 'not_reportable'.",
        items: {
          type: "string",
          maxLength: 200,
        },
      },
      insufficient_input: {
        type: "string",
        maxLength: 300,
      },
    },
  },
};
