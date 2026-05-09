/**
 * Hazard profile catalog — used in Step 5 (Hazard profile) of the Site Setup
 * wizard and stored as a `text[]` on `sites.hazard_tags`. Tag codes match the
 * DB CHECK constraint `sites_hazard_tags_valid` in
 * `20260517120000_phase13_site_setup_osha_riddor.sql`.
 *
 * Both regimes (OSHA + RIDDOR) care about these — they drive program / training
 * derivation downstream (Phase 14+ Templates tie-in).
 *
 * If we ever need per-tag metadata (color, severity, required-training links),
 * promote to a `site_hazard_tags` lookup table. For V1 a TS constants module is
 * the right shape — codes are stable, fixed catalog drawn from regulatory
 * standards.
 */

export const HAZARD_TAG_CODES = [
  "confined_space",
  "hot_work",
  "hazardous_energy",
  "respirable_silica",
  "lead",
  "asbestos",
  "working_at_height",
  "manual_handling",
  "noise",
  "chemicals",
] as const;

export type HazardTagCode = (typeof HAZARD_TAG_CODES)[number];

export const HAZARD_TAG_LABELS: Record<HazardTagCode, string> = {
  confined_space: "Confined spaces",
  hot_work: "Hot work (welding, cutting, brazing)",
  hazardous_energy: "Hazardous energy (LOTO)",
  respirable_silica: "Respirable silica",
  lead: "Lead",
  asbestos: "Asbestos",
  working_at_height: "Working at height",
  manual_handling: "Manual handling",
  noise: "Noise",
  chemicals: "Chemicals (HAZWOPER)",
};

export const HAZARD_TAG_DESCRIPTIONS: Record<HazardTagCode, string> = {
  confined_space: "Permit-required confined-space entry — 29 CFR 1910.146.",
  hot_work: "Welding, cutting, brazing, soldering — 29 CFR 1910.252.",
  hazardous_energy: "Lockout/tagout for energy isolation — 29 CFR 1910.147.",
  respirable_silica: "Crystalline silica dust — 29 CFR 1910.1053 / 1926.1153.",
  lead: "Lead exposure — 29 CFR 1910.1025 / 1926.62.",
  asbestos: "Asbestos exposure — 29 CFR 1910.1001 / 1926.1101.",
  working_at_height: "Fall protection — 29 CFR 1910 Subpart D / 1926 Subpart M.",
  manual_handling: "Manual handling injuries (MSDs, ergonomics).",
  noise: "Occupational noise — 29 CFR 1910.95.",
  chemicals: "HAZWOPER + hazard communication — 29 CFR 1910.120 / 1910.1200.",
};

export function isHazardTagCode(s: string): s is HazardTagCode {
  return (HAZARD_TAG_CODES as readonly string[]).includes(s);
}
