/**
 * Severity engine — pure function. Maps the user's 5×5 risk matrix selection
 * (likelihood × consequence) to one of the five severity codes per SPEC §8.
 *
 * Likelihood (rows): 1=Rare, 2=Unlikely, 3=Possible, 4=Likely, 5=Almost Certain
 * Consequence (cols): 1=Insignificant, 2=Minor, 3=Moderate, 4=Major, 5=Catastrophic
 *
 * The matrix in SPEC §8 has 4 risk bands (Low / Medium / High / Critical).
 * This engine maps them onto the 5-severity enum:
 *   Critical → S1 (Critical)
 *   High     → S2 (Major)
 *   Medium   → S3 (Moderate)
 *   Low      → S4 (Minor)
 *
 * S5 (Insignificant) is not reachable from the matrix alone — it's reserved
 * for type-specific overrides (e.g. an `observation` with no hazard).
 */

export type SeverityCode = "S1" | "S2" | "S3" | "S4" | "S5";
export type MatrixCoord = 1 | 2 | 3 | 4 | 5;

// Indexed [likelihood-1][consequence-1]
const MATRIX: SeverityCode[][] = [
  // cons:        1     2     3     4     5
  /* like 1 */ ["S4", "S4", "S3", "S3", "S2"], // Rare
  /* like 2 */ ["S4", "S4", "S3", "S2", "S2"], // Unlikely
  /* like 3 */ ["S4", "S3", "S2", "S2", "S1"], // Possible
  /* like 4 */ ["S4", "S3", "S2", "S1", "S1"], // Likely
  /* like 5 */ ["S3", "S2", "S1", "S1", "S1"], // Almost Certain
];

export function computeSeverity(input: {
  likelihood: MatrixCoord;
  consequence: MatrixCoord;
}): SeverityCode {
  const { likelihood, consequence } = input;
  if (likelihood < 1 || likelihood > 5 || consequence < 1 || consequence > 5) {
    throw new Error(`Invalid matrix coords: likelihood=${likelihood}, consequence=${consequence}`);
  }
  return MATRIX[likelihood - 1][consequence - 1];
}

export const LIKELIHOOD_LABELS = ["Rare", "Unlikely", "Possible", "Likely", "Almost Certain"] as const;
export const CONSEQUENCE_LABELS = ["Insignificant", "Minor", "Moderate", "Major", "Catastrophic"] as const;
export const SEVERITY_LABELS: Record<SeverityCode, string> = {
  S1: "Critical",
  S2: "Major",
  S3: "Moderate",
  S4: "Minor",
  S5: "Insignificant",
};
