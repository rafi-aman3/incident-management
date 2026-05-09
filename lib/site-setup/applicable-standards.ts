/**
 * OSHA applicable-standards catalog — used in Step 5 (Hazard profile) of the
 * Site Setup wizard and stored as a `text[]` on `sites.applicable_standards`.
 * Codes match the DB CHECK constraint `sites_applicable_standards_valid` in
 * `20260517120000_phase13_site_setup_osha_riddor.sql`.
 *
 * Selecting which 29 CFR Part(s) apply to a site drives downstream
 * program/training requirements. Most sites pick exactly one (a manufacturing
 * plant = General Industry; a construction project = Construction). Mixed
 * sites — e.g. a manufacturing campus with active construction — pick more
 * than one.
 *
 * US-only field. GB sites skip Step 5's standards multi-select entirely.
 */

export const APPLICABLE_STANDARD_CODES = [
  "1910",
  "1926",
  "1915",
  "1917",
  "1918",
  "1928",
] as const;

export type ApplicableStandardCode = (typeof APPLICABLE_STANDARD_CODES)[number];

export const APPLICABLE_STANDARD_LABELS: Record<ApplicableStandardCode, string> = {
  "1910": "General Industry (29 CFR 1910)",
  "1926": "Construction (29 CFR 1926)",
  "1915": "Maritime — Shipyard (29 CFR 1915)",
  "1917": "Maritime — Marine Terminals (29 CFR 1917)",
  "1918": "Maritime — Longshoring (29 CFR 1918)",
  "1928": "Agriculture (29 CFR 1928)",
};

export function isApplicableStandardCode(s: string): s is ApplicableStandardCode {
  return (APPLICABLE_STANDARD_CODES as readonly string[]).includes(s);
}
