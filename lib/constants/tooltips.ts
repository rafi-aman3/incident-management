/**
 * Regulatory-term tooltip registry per docs/onboarding.md §9.1.
 * Phase 1 shipped the top-8 critical-path entries; Phase 2 adds the
 * remaining 9 placed across CAPA verification, the OSHA / RIDDOR report
 * pages, and the wizard.
 */

export type TooltipKey =
  // Phase 1 — wizard + banner critical path
  | "osha_recordable"
  | "osha_8hr"
  | "osha_24hr"
  | "riddor_specified"
  | "riddor_7day"
  | "risk_matrix"
  | "severity_codes"
  | "tracks"
  // Phase 2 — CAPA + reports + remaining wizard
  | "capa_verifier_independence"
  | "capa_partial_effective"
  | "osha_300_vs_301"
  | "osha_300_columns"
  | "osha_300a_posting"
  | "ita_deadline"
  | "riddor_deadlines"
  | "dangerous_occurrence"
  | "body_map_guidance"
  | "trir_dart_formula"
  // Phase 3 — Templates + Inspections
  | "template_import_clones"
  | "template_publish_immutable"
  | "template_versions_audit"
  | "all_sites_assignment"
  | "flagged_response_finding"
  | "finding_escalation"
  // Phase 4 — Resources (Assets + Documents)
  | "asset_unsafe_condition"
  | "document_expiry_retention"
  | "library_link_reuse"
  | "sds_auto_attach_intent"
  // Phase 5 — Planner
  | "planner_aggregation_rule"
  | "planner_url_share";

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

  // ---- Phase 2 ----
  capa_verifier_independence: {
    term: "Why an independent verifier?",
    copy:
      "OSHA §1904 requires that someone other than the action's owner confirm it actually worked — otherwise the same person who 'fixed it' is grading their own homework. Enforced at UI, server, RPC, and DB layers.",
  },
  capa_partial_effective: {
    term: "Partially effective",
    copy:
      "The action helped but residual risk remains. The CAPA closes (verified) AND a follow-up CAPA is auto-created in the 'created' state, linked via follow_up_capa_id. The owner stays the same; reassign as needed.",
  },
  osha_300_vs_301: {
    term: "OSHA 300 vs 301",
    copy:
      "300 is the running log (one row per recordable case, 13 columns A–M). 301 is the per-incident detail form (18 fields). Both apply to the same case; both retained 5 years.",
  },
  osha_300_columns: {
    term: "OSHA 300 columns A–M",
    copy:
      "A: case number · B: employee name + job · C: date · D: where it happened · E: description · F: classification (1 injury / 2–6 illness types) · G: death · H: days away · I: job transfer or restriction · J: other recordable · K/L: day counts · M: illness type code.",
  },
  osha_300a_posting: {
    term: "300A posting window",
    copy:
      "The signed 300A annual summary must be posted in a visible workplace location from Feb 1 to Apr 30 of the following year. Required even when the year had zero recordable cases.",
  },
  ita_deadline: {
    term: "ITA submission deadline",
    copy:
      "OSHA's Injury Tracking Application accepts CSV uploads (or web form) by March 2 each year. Establishments with 250+ employees, or 20+ in high-hazard industries, are required to submit.",
  },
  riddor_deadlines: {
    term: "RIDDOR deadlines",
    copy:
      "Death or specified injury → phone HSE immediately + F2508 within 10 days. Over-7-day incapacitation → F2508 within 15 days. Occupational disease → F2508 on diagnosis. Dangerous occurrence → phone + 10-day F2508.",
  },
  dangerous_occurrence: {
    term: "Dangerous occurrence",
    copy:
      "A specified near-miss event that didn't injure anyone but had high potential to: scaffold collapse, explosion, electrical short causing fire/explosion, plant or equipment failure on a lifting operation, etc. RIDDOR-reportable on its own.",
  },
  body_map_guidance: {
    term: "Body map vs description",
    copy:
      "Click body parts on the map for OSHA 300 column E + RIDDOR. Use the description to capture mechanism + object/substance — that's how the 301 column 17 ('what directly harmed the employee') gets filled in.",
  },
  trir_dart_formula: {
    term: "TRIR / DART formula",
    copy:
      "TRIR = (recordable cases × 200,000) / hours worked. DART = (cases with days away or restricted × 200,000) / hours worked. The 200,000 multiplier represents 100 workers × 40 hr × 50 weeks — OSHA's standard exposure window.",
  },

  // ---- Phase 3 ----
  template_import_clones: {
    term: "Importing a preset",
    copy:
      "Imports copy the items into your org so you can edit and publish your own version. The preset itself stays untouched — re-importing creates a separate copy.",
  },
  template_publish_immutable: {
    term: "Publishing creates a new version",
    copy:
      "Each publish creates an immutable template_versions row. In-flight inspections continue running against the version they were started with — even if you re-edit and publish v3 mid-cycle, an inspector on v2 finishes on v2.",
  },
  template_versions_audit: {
    term: "Why versions are immutable",
    copy:
      "Once published, a version's items can never change. That's how the runner can promise inspectors and auditors that the checklist they're filling out won't get rewritten under them mid-shift.",
  },
  all_sites_assignment: {
    term: "Assigning to all sites",
    copy:
      "Assigns the active version to every site you have template:assign on. For child sites: they only inherit when 'include children' is checked on the parent here. Otherwise child-site members see the template only if they're directly added below.",
  },
  flagged_response_finding: {
    term: "Failed responses become findings",
    copy:
      "Any answer marked as 'failed' in its answer set creates an inspection_findings row on submit. The EHS team can review, mark resolved with notes, or escalate to an incident — which pre-fills the Report Wizard with the finding context.",
  },
  finding_escalation: {
    term: "Escalating a finding",
    copy:
      "Creates a draft incident pre-filled from the finding (item label + comment as description). The new incident shows up under the same site and tracks back to this finding via escalated_incident_id — so reporting can audit the chain.",
  },
  asset_unsafe_condition: {
    term: "Asset marked unsafe",
    copy:
      "An asset in 'unsafe' condition must be tagged out and reported as an unsafe-condition incident. Managers should escalate within 24 hours so a CAPA can land before the next shift.",
  },
  document_expiry_retention: {
    term: "Document expiry vs. retention",
    copy:
      "Expiry triggers a re-review reminder; it does NOT permit deletion. OSHA requires 5 years and RIDDOR 3 years of record retention — past-expiry documents stay archived in storage, never hard-deleted.",
  },
  library_link_reuse: {
    term: "One document, many links",
    copy:
      "A library document can attach to many records at once via document_links. Replace the file once and every link points at the new content — the audit trail stays intact across incidents, investigations, CAPAs, and assets.",
  },
  sds_auto_attach_intent: {
    term: "SDS auto-attach (v2)",
    copy:
      "When a chemical is named on an incident, the platform should pre-attach its Safety Data Sheet from the SDS Manager library. v1 surfaces the link picker so it's a one-click attach; the SDS Manager API integration that auto-suggests the SDS lands in v2.",
  },

  // ---- Phase 5 ----
  planner_aggregation_rule: {
    term: "How the planner aggregates",
    copy:
      "Planner aggregates every dated event across modules — it's read-only. Edit each event from its source record (incident, inspection, CAPA, asset, investigation, or regulatory notification).",
  },
  planner_url_share: {
    term: "Planner URLs are shareable",
    copy:
      "Click any event to jump to its source record. The URL captures the current view, date, site, and event-type filters — copy it to share a specific calendar window with a teammate.",
  },
};
