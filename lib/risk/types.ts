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

export type Likelihood =
  | "rare"
  | "unlikely"
  | "possible"
  | "likely"
  | "almost_certain";

export type Consequence =
  | "insignificant"
  | "minor"
  | "moderate"
  | "major"
  | "catastrophic";

export type RiskLevel = "S1" | "S2" | "S3" | "S4" | "S5";

export type HazardCategory =
  | "physical"
  | "chemical"
  | "biological"
  | "psychosocial"
  | "mechanical"
  | "electrical"
  | "ergonomic"
  | "environmental";

export type ControlLevel =
  | "elimination"
  | "substitution"
  | "engineering"
  | "administrative"
  | "ppe";

export const LIKELIHOOD_VALUES: readonly Likelihood[] = [
  "rare",
  "unlikely",
  "possible",
  "likely",
  "almost_certain",
] as const;

export const CONSEQUENCE_VALUES: readonly Consequence[] = [
  "insignificant",
  "minor",
  "moderate",
  "major",
  "catastrophic",
] as const;

export const RISK_LEVEL_VALUES: readonly RiskLevel[] = [
  "S1",
  "S2",
  "S3",
  "S4",
  "S5",
] as const;

export const CONTROL_LEVEL_VALUES: readonly ControlLevel[] = [
  "elimination",
  "substitution",
  "engineering",
  "administrative",
  "ppe",
] as const;

export const HAZARD_CATEGORY_VALUES: readonly HazardCategory[] = [
  "physical",
  "chemical",
  "biological",
  "psychosocial",
  "mechanical",
  "electrical",
  "ergonomic",
  "environmental",
] as const;
