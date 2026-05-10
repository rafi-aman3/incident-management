/**
 * Structured-output tool for the AI Investigator (Phase 9c).
 *
 * Unlike the Copilot tools, this one has no `execute()`. The route handler at
 * `app/api/argus/investigator/route.ts` forces `tool_choice: { type: 'tool',
 * name: 'propose_investigation_draft' }` so the model emits exactly one
 * `tool_use` block. The handler captures the input directly, validates the
 * shape client-side via TS narrowing, and streams it back as the SSE `draft`
 * payload.
 *
 * No DB writes happen until the user clicks Push on a section in the UI.
 * That's the review-and-edit gate per the 2026-05-10 hard rule "Argus is
 * assistive, not authoritative."
 */
export interface InvestigationDraftPayload {
  timeline: Array<{
    at?: string;
    relative_order?: number;
    event: string;
  }>;
  whys: Array<{
    level: 1 | 2 | 3 | 4 | 5;
    question: string;
    answer: string;
  }>;
  root_cause_summary: string;
  findings: string;
  /** Set to a non-empty string when the model refuses to draft because the
   *  input is too thin. The other four fields are then empty. */
  insufficient_input: string;
}

interface ProposeTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export const PROPOSE_INVESTIGATION_DRAFT_TOOL: ProposeTool = {
  name: "propose_investigation_draft",
  description:
    "Emit a structured draft investigation containing a chronological timeline, a 5-Why chain, a root-cause summary, and a regulator-readable findings narrative. Call exactly once. Use only information present in the input — no invention. If the input is too thin, set `insufficient_input` and leave the four output fields empty.",
  input_schema: {
    type: "object",
    required: ["timeline", "whys", "root_cause_summary", "findings", "insufficient_input"],
    properties: {
      timeline: {
        type: "array",
        description:
          "Chronological events. Use ISO-8601 in `at` when the input gave a timestamp; otherwise use ascending integers in `relative_order` and omit `at`. One discrete event per item.",
        items: {
          type: "object",
          required: ["event"],
          properties: {
            at: {
              type: "string",
              description:
                "ISO-8601 timestamp if and only if the input stated one. Do not invent.",
            },
            relative_order: {
              type: "integer",
              minimum: 1,
              description:
                "Ascending order index when `at` is unknown.",
            },
            event: {
              type: "string",
              maxLength: 500,
              description:
                "What happened in this step. Plain English, role + initials for people.",
            },
          },
        },
      },
      whys: {
        type: "array",
        minItems: 5,
        maxItems: 5,
        description:
          "Exactly 5 Why entries levels 1..5 (1 = immediate cause, 5 = root cause). Each answer becomes the question for the next level (rephrased). Empty array only when refusing via `insufficient_input`.",
        items: {
          type: "object",
          required: ["level", "question", "answer"],
          properties: {
            level: {
              type: "integer",
              minimum: 1,
              maximum: 5,
            },
            question: {
              type: "string",
              maxLength: 2000,
            },
            answer: {
              type: "string",
              maxLength: 5000,
            },
          },
        },
      },
      root_cause_summary: {
        type: "string",
        maxLength: 20000,
        description:
          "Plain-English statement of the underlying cause. ~2-3 sentences. What regulators and stakeholders read first.",
      },
      findings: {
        type: "string",
        maxLength: 20000,
        description:
          "Multi-paragraph narrative covering: what happened, contributing factors mentioned in the input, what was learned. Plain English. No bullet lists, no corporate hedging.",
      },
      insufficient_input: {
        type: "string",
        maxLength: 500,
        description:
          "Set to a one-line explanation of what's missing when the input is too thin to draft responsibly (e.g. fewer than ~50 meaningful words, or no witness statements and no additional context). The other four fields must then be empty arrays / strings. Empty when generating normally.",
      },
    },
  },
};
