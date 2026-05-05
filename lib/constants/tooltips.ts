/**
 * Top-8 regulatory-term tooltip registry per docs/onboarding.md §9.1.
 * Phase 1 ships these 8 (the wizard + banner critical path); the remaining
 * 9 land in Phase 2 ("Phase 3" in the legacy P0–P4 labelling).
 */

export type TooltipKey =
  | "osha_recordable"
  | "osha_8hr"
  | "osha_24hr"
  | "riddor_specified"
  | "riddor_7day"
  | "risk_matrix"
  | "severity_codes"
  | "tracks";

export const REG_TOOLTIPS: Record<TooltipKey, { term: string; copy: string }> = {
  osha_recordable: {
    term: "OSHA recordable",
    copy:
      "An injury is OSHA-recordable if it required more than first aid: medical treatment, days away from work, restricted duty, transfer, or loss of consciousness.",
  },
  osha_8hr: {
    term: "OSHA 8-hour clock",
    copy:
      "OSHA must be notified within 8 hours of a workplace fatality. Phone call required.",
  },
  osha_24hr: {
    term: "OSHA 24-hour clock",
    copy:
      "OSHA must be notified within 24 hours of an amputation, eye loss, or in-patient hospitalization.",
  },
  riddor_specified: {
    term: "RIDDOR specified injury",
    copy:
      "Specified injuries under RIDDOR include fractures (except fingers/thumbs/toes), amputations, sight loss, crush injuries, serious burns >10% body, and scalping. Triggers an immediate phone notification to HSE.",
  },
  riddor_7day: {
    term: "RIDDOR over-7-day",
    copy:
      "An injury causing more than 7 consecutive days of incapacitation must be reported to HSE within 15 days via online F2508.",
  },
  risk_matrix: {
    term: "5×5 risk matrix",
    copy:
      "A grid that scores risk by Likelihood (Rare → Almost Certain) × Consequence (Insignificant → Catastrophic). The cell's color sets severity S1–S5.",
  },
  severity_codes: {
    term: "Severity S1–S5",
    copy:
      "S1 Critical → S5 Insignificant. Drives investigation depth: S1/S2 → full investigation, S3 → light, S4/S5 → log and close.",
  },
  tracks: {
    term: "Track A / B / C",
    copy:
      "Routing tiers: A = full investigation (S1/S2), B = light investigation (S3), C = log and close (S4/S5). Set automatically by severity and type.",
  },
};
