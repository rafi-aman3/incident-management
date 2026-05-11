/**
 * Shared 5×5 risk matrix. Single source of truth for both incident severity
 * (SPEC §8) and hazard risk assessment (SPEC §HZ.3).
 *
 * Convention: S1 = Critical (worst residual risk), S5 = Insignificant (best).
 *   S4-S5 cells: "Low" band → Track C in incidents
 *   S3 cells:    "Medium" band → Track B
 *   S2 cells:    "High" band → Track A
 *   S1 cells:    "Critical" band → Track A
 *
 * S5 is not reachable from this lookup alone — it's reserved for type-specific
 * overrides on the incident workflow (e.g. an `observation` with no hazard).
 * Hazard residual risk can reach S5 via `computeResidual()` when high-tier
 * controls (elimination / substitution) drop the inherent score.
 */

import type { Likelihood, Consequence, RiskLevel, ControlLevel } from "./types";

export const MATRIX: Record<Likelihood, Record<Consequence, RiskLevel>> = {
  rare: {
    insignificant: "S4",
    minor: "S4",
    moderate: "S3",
    major: "S3",
    catastrophic: "S2",
  },
  unlikely: {
    insignificant: "S4",
    minor: "S4",
    moderate: "S3",
    major: "S2",
    catastrophic: "S2",
  },
  possible: {
    insignificant: "S4",
    minor: "S3",
    moderate: "S2",
    major: "S2",
    catastrophic: "S1",
  },
  likely: {
    insignificant: "S4",
    minor: "S3",
    moderate: "S2",
    major: "S1",
    catastrophic: "S1",
  },
  almost_certain: {
    insignificant: "S3",
    minor: "S2",
    moderate: "S1",
    major: "S1",
    catastrophic: "S1",
  },
};

export function computeRisk(l: Likelihood, c: Consequence): RiskLevel {
  return MATRIX[l][c];
}

/**
 * Reduction factor per control level. Highest applied level wins (controls
 * don't stack in the v1 demo model — flagged in SPEC §HZ decisions log).
 *
 * Reductions add to the S-number (moving toward S5 = safest):
 *   elimination drops 4 levels, substitution 3, engineering 2, administrative
 *   and PPE 1 each. Capped at S5.
 */
const REDUCTION: Record<ControlLevel, number> = {
  elimination: 4,
  substitution: 3,
  engineering: 2,
  administrative: 1,
  ppe: 1,
};

export function computeResidual(
  inherent: RiskLevel,
  controlLevels: readonly ControlLevel[],
): RiskLevel {
  if (controlLevels.length === 0) return inherent;
  const best = Math.max(
    ...controlLevels.map((l) => REDUCTION[l] ?? 0),
  );
  const inherentNum = parseInt(inherent.slice(1), 10);
  const residualNum = Math.min(5, inherentNum + best);
  return `S${residualNum}` as RiskLevel;
}

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  rare: "Rare",
  unlikely: "Unlikely",
  possible: "Possible",
  likely: "Likely",
  almost_certain: "Almost Certain",
};

export const CONSEQUENCE_LABELS: Record<Consequence, string> = {
  insignificant: "Insignificant",
  minor: "Minor",
  moderate: "Moderate",
  major: "Major",
  catastrophic: "Catastrophic",
};

export const RISK_LEVEL_LABELS: Record<RiskLevel, string> = {
  S1: "Critical",
  S2: "Major",
  S3: "Moderate",
  S4: "Minor",
  S5: "Insignificant",
};

export const CONTROL_LEVEL_LABELS: Record<ControlLevel, string> = {
  elimination: "Elimination",
  substitution: "Substitution",
  engineering: "Engineering",
  administrative: "Administrative",
  ppe: "PPE",
};
