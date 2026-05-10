/**
 * Capability-tier mapping per Argus surface. The provider-specific model id
 * (e.g. `gemini-2.5-flash`) is owned by the adapter; callers pick a tier and
 * the adapter resolves it. This decouples surface logic from provider churn —
 * swapping Flash for a future model is a one-liner in `gemini-adapter.ts`.
 *
 * Tier rationale (locked at the system-prompt level, not user-configurable):
 *   - 'fast'  → cheap classifier-style work: severity, method, finding-severity,
 *                copilot conversational, document classification.
 *   - 'smart' → reasoning + long-context: investigator RCA, CAPA drafting,
 *                reportability with regulatory citation.
 *
 * `argus_suggestions.model` stores the concrete model id returned by the
 * adapter (e.g. `gemini-2.5-flash`), not the tier label — so audit rows stay
 * stable across tier-to-model remappings.
 */

import type { ModelTier } from "./llm";

export const TIER_FAST: ModelTier = "fast";
export const TIER_SMART: ModelTier = "smart";

export type ArgusSurface =
  | "copilot"
  | "investigator"
  | "severity"
  | "capa_method"
  | "finding_escalation"
  | "document_classifier"
  | "capa_draft"
  | "reportability"
  | "risk_matrix"
  | "finding_severity"
  | "verification_method"
  | "capa_metadata";

export const TIER_BY_SURFACE: Record<ArgusSurface, ModelTier> = {
  copilot: TIER_FAST,
  severity: TIER_FAST,
  capa_method: TIER_FAST,
  finding_escalation: TIER_FAST,
  document_classifier: TIER_FAST,
  investigator: TIER_SMART,
  capa_draft: TIER_SMART,
  reportability: TIER_SMART,
  risk_matrix: TIER_FAST,
  finding_severity: TIER_FAST,
  verification_method: TIER_FAST,
  capa_metadata: TIER_SMART,
};
