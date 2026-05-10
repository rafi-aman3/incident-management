/**
 * Model selection for Argus surfaces. Locked at the system-prompt level —
 * not user-configurable in v1. Use string aliases (no date suffixes) so
 * Anthropic's automatic model routing handles minor revisions.
 *
 * Picks per surface: see `plans/09-argus-ai-assistant.md` → Architecture.
 */

export const MODEL_HAIKU = "claude-haiku-4-5" as const;
export const MODEL_SONNET = "claude-sonnet-4-6" as const;
export const MODEL_OPUS = "claude-opus-4-7" as const;

export type ArgusModel = typeof MODEL_HAIKU | typeof MODEL_SONNET | typeof MODEL_OPUS;

/** Map a surface to its locked model. Surfaces not listed default to Haiku. */
export const MODEL_BY_SURFACE = {
  copilot: MODEL_HAIKU,
  severity: MODEL_HAIKU,
  capa_method: MODEL_HAIKU,
  finding_escalation: MODEL_HAIKU,
  document_classifier: MODEL_HAIKU,
  investigator: MODEL_SONNET,
  capa_draft: MODEL_SONNET,
  reportability: MODEL_SONNET,
} as const satisfies Record<string, ArgusModel>;

export type ArgusSurface = keyof typeof MODEL_BY_SURFACE;
