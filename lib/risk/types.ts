/**
 * Shared risk-matrix types. Used by both the incident severity engine and the
 * Phase 14 Hazard Register.
 *
 * The S-number scale is consistent across both surfaces:
 *   S1 = Critical (worst), S2 = Major, S3 = Moderate, S4 = Minor, S5 = Insignificant (best).
 *
 * In the hazard world, S5 is "lowest residual risk" — the inversion noted in the
 * SPEC §HZ.3 draft was corrected at build time (see SPEC §15, 2026-05-11 row).
 */

export const LIKELIHOOD_VALUES = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost_certain",
] as const;
export type Likelihood = (typeof LIKELIHOOD_VALUES)[number];

export const CONSEQUENCE_VALUES = [
  "insignificant",
  "minor",
  "moderate",
  "major",
  "catastrophic",
] as const;
export type Consequence = (typeof CONSEQUENCE_VALUES)[number];

export const RISK_LEVEL_VALUES = ["S1", "S2", "S3", "S4", "S5"] as const;
export type RiskLevel = (typeof RISK_LEVEL_VALUES)[number];

export const HAZARD_CATEGORY_VALUES = [
  "physical",
  "chemical",
  "biological",
  "psychosocial",
  "mechanical",
  "electrical",
  "ergonomic",
  "environmental",
] as const;
export type HazardCategory = (typeof HAZARD_CATEGORY_VALUES)[number];

export const CONTROL_LEVEL_VALUES = [
  "elimination",
  "substitution",
  "engineering",
  "administrative",
  "ppe",
] as const;
export type ControlLevel = (typeof CONTROL_LEVEL_VALUES)[number];
