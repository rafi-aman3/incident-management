/**
 * Phase 9e — page-context contract for the global Argus side panel.
 *
 * Server components that want the panel to ground its system block on the
 * current page render a `<ArgusContextPayload context={ctx} />` somewhere in
 * the page tree. The client provider in `components/argus/argus-context.tsx`
 * picks the context up and exposes it to `<ArgusSidePanel>` via a React
 * context hook.
 *
 * Anything passed in here MUST be safe to send to the LLM provider. Free-text
 * record titles must be run through `redactText()` before construction; raw
 * descriptions never belong on this struct. Names live as initials only.
 */

export type ArgusRouteKey =
  | "dashboard"
  | "incident_detail"
  | "investigation_detail"
  | "capa_detail"
  | "inspection_detail"
  | "capa_index"
  | "inspections_index"
  | "reports_index"
  | "hazards_index"
  | "hazard_detail"
  | "hazard_candidates_index"
  | "hazard_candidate_detail"
  | "jsa_index"
  | "jsa_detail"
  | "jsa_edit"
  | "jsa_perform"
  | "unknown";

export type ArgusRecordKind =
  | "incident"
  | "investigation"
  | "capa"
  | "inspection"
  | "report"
  | "hazard"
  | "hazard_candidate";

export interface ArgusContextRecord {
  kind: ArgusRecordKind;
  id: string;
  refCode: string | null;
  /** Already-redacted display title; never raw user input. */
  title: string | null;
}

export interface ArgusPageContext {
  route: ArgusRouteKey;
  /** Human label for the panel header chip, e.g. "Incident IR-014". */
  routeLabel: string;
  siteId: string | null;
  /** Optional site display name for the chip's second segment. */
  siteLabel?: string | null;
  records?: ArgusContextRecord[];
  /** Small numeric aggregates the model can reference. No PII. */
  aggregates?: Record<string, number>;
  /**
   * True when this page renders Insight Tiles whose aggregator returned a
   * non-zero count worth flagging. The Sparkles trigger paints a cyan dot
   * when this is set so users notice attention is needed without opening
   * the side panel.
   */
  hasActiveSignal?: boolean;
}

/**
 * Default context — used by the provider before any page has registered, and
 * by routes that don't mount `<ArgusContextPayload>` at all.
 */
export const DEFAULT_ARGUS_CONTEXT: ArgusPageContext = {
  route: "unknown",
  routeLabel: "Argus",
  siteId: null,
  records: [],
  aggregates: {},
};

/**
 * Per-route static prompt suggestions for the panel header chips. Empty for
 * the default — the panel will fall back to a generic set in the UI layer.
 */
export const ARGUS_PANEL_SUGGESTIONS: Record<ArgusRouteKey, string[]> = {
  dashboard: [
    "What needs my attention this week?",
    "Are any OSHA 8hr clocks at risk?",
    "Summarise this site's safety trends.",
  ],
  incident_detail: [
    "Walk me through this incident's classification path.",
    "What CAPAs typically follow this hazard category?",
    "Is this likely OSHA-recordable?",
  ],
  investigation_detail: [
    "Summarise the timeline so far.",
    "What's missing from the 5-Why?",
    "Suggest CAPA themes from the findings.",
  ],
  capa_detail: [
    "Is this CAPA on track?",
    "What verification method fits this CAPA?",
    "Have similar CAPAs proven effective?",
  ],
  inspection_detail: [
    "Which findings should I escalate?",
    "Rank these findings by hazard.",
    "What's the closing checklist for this inspection?",
  ],
  capa_index: [
    "Which CAPAs are clustered around the same root cause?",
    "Highlight any CAPAs at risk of missing their due date.",
    "Suggest a category-level control from these CAPAs.",
  ],
  inspections_index: [
    "What inspections are due in the next 7 days?",
    "Which templates are overdue this site?",
    "Where are repeat findings showing up?",
  ],
  reports_index: [
    "Which incidents still need a regulatory report?",
    "Is anything close to a recordability boundary?",
    "Summarise this year's recordable trend.",
  ],
  hazards_index: [
    "Which hazards have only PPE controls?",
    "Highlight hazards overdue for review.",
    "What S1/S2 hazards should I prioritise?",
  ],
  hazard_detail: [
    "Suggest engineering controls for this hazard.",
    "Has this hazard been linked to any incidents?",
    "When is the next review due?",
  ],
  hazard_candidates_index: [
    "Which candidates look like duplicates of existing hazards?",
    "Prioritise the SDS-imported candidates by risk.",
    "What's the most urgent candidate to convert?",
  ],
  hazard_candidate_detail: [
    "Help me write controls for this candidate.",
    "Is this a duplicate of an existing hazard?",
    "What category should I use?",
  ],
  jsa_index: [
    "Which JSAs are due for re-review?",
    "Highlight high-risk JSAs (S1/S2 step hazards).",
    "What JSAs were flagged by recent incidents?",
  ],
  jsa_detail: [
    "Are the controls listed appropriate for the hazards?",
    "What's missing from this analysis?",
    "Suggest review cadence for this kind of work.",
  ],
  jsa_edit: [
    "Suggest hazards I might be missing.",
    "What controls fit each level for this step?",
    "Are these hazards scored consistently?",
  ],
  jsa_perform: [
    "Highlight the most safety-critical step.",
    "What PPE is non-negotiable for this job?",
    "Are there hazards I should double-check?",
  ],
  unknown: [],
};
