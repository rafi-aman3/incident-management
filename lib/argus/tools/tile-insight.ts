import type { ToolDefinition } from "@/lib/argus/llm";

/**
 * Phase 9e — single shared structured-output tool used by every Argus
 * Insight Tile. The system prompt differs per tile (see
 * `lib/argus/system-prompts/tile-*.md`) but the output envelope is identical
 * so `<ArgusInsightTile>` doesn't need to branch on the tile key.
 *
 * Constraints:
 *   - `summary` is the visible card body — capped at 280 chars.
 *   - `rationale` carries the model's reasoning — surfaced in a tooltip / row
 *     under the summary; capped at 600 chars.
 *   - `confidence` keeps the cyan-card eyebrow honest. Below 0.5 we ignore the
 *     suggestion and render the empty state.
 *   - `nothing_to_flag` is the escape valve. When true the card collapses to a
 *     muted one-liner; we still write the audit row so we can tell "Argus
 *     looked and there was nothing" from "Argus never ran."
 *   - `recommended_action_label` overrides the default link label per
 *     `TILE_CONFIG[tile].defaultHrefLabel`. The href itself stays server-controlled.
 */
export const tileInsightTool: ToolDefinition = {
  name: "tile_insight",
  description:
    "Summarise the current page-aggregate signal for an Argus Insight Tile and recommend the single best next step.",
  parameters: {
    type: "object",
    required: ["summary", "rationale", "confidence"],
    properties: {
      summary: {
        type: "string",
        maxLength: 280,
        description:
          "One- or two-sentence summary visible in the tile card body. Cite ref_codes from the input where applicable. Plain text — no markdown.",
      },
      rationale: {
        type: "string",
        maxLength: 600,
        description:
          "Why you flagged this; what the user should know that the summary couldn't fit.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "How confident you are in the summary, 0..1.",
      },
      nothing_to_flag: {
        type: "boolean",
        description:
          "Set true when the input genuinely doesn't warrant flagging anything. The summary should then read 'Nothing to flag right now — Argus is watching.'",
      },
      recommended_action_label: {
        type: "string",
        maxLength: 40,
        description:
          "Optional override for the recommended-action link label. The destination URL is server-controlled; you may only suggest a label.",
      },
    },
  },
};
