/**
 * Shape of every row that surfaces on /planner. The aggregator unions
 * 6 sources into this single shape so the view components don't need
 * to know which table the event came from.
 *
 * Per plans/05-planner.md §B2.
 */

export const PLANNER_EVENT_KINDS = [
  "incident",
  "inspection_started",
  "inspection_completed",
  "capa_due",
  "asset_pm_due",
  "investigation_due",
  "regulatory_deadline",
] as const;

export type PlannerEventKind = (typeof PLANNER_EVENT_KINDS)[number];

export type PlannerEvent = {
  id: string; // composite "<kind>:<source_id>" — unique across the merged feed
  kind: PlannerEventKind;
  date: string; // ISO timestamp; events are point-in-time in v1
  title: string;
  href: string; // deep-link to the source record
  site_id: string;
  site_name: string | null;

  // Source-specific metadata for chip tone:
  severity?: "S1" | "S2" | "S3" | "S4" | "S5" | null; // incidents only
  is_overdue?: boolean; // capa_due / asset_pm_due / investigation_due
  is_failed?: boolean; // inspection_completed only
};

export const PLANNER_EVENT_LABEL: Record<PlannerEventKind, string> = {
  incident: "Incident",
  inspection_started: "Inspection started",
  inspection_completed: "Inspection completed",
  capa_due: "CAPA due",
  asset_pm_due: "Asset PM",
  investigation_due: "Investigation due",
  regulatory_deadline: "Regulatory deadline",
};

/**
 * Tone tokens consumed by <EventChip>. Values are existing tokens from
 * the Phase 1 / Phase 2 design system — no new colors introduced
 * (per plans/05-planner.md resolved Q5).
 *
 *   - "severity" → mirror <SeverityBadge>; the chip reads `event.severity`
 *   - "brand"    → brand purple subtle (existing primary tint)
 *   - "amber"    → upcoming-but-not-overdue warning
 *   - "destructive" → overdue / failed
 *   - "success"  → passed
 *   - "brand_bold" → regulatory banner color from Phase 2
 *
 * `<EventChip>` resolves the final class string by combining the tone
 * with `is_overdue` / `is_failed` flags.
 */
export type PlannerEventTone =
  | "severity"
  | "brand"
  | "brand_bold"
  | "amber"
  | "destructive"
  | "success";

export const PLANNER_EVENT_TONE: Record<PlannerEventKind, PlannerEventTone> = {
  incident: "severity",
  inspection_started: "brand",
  inspection_completed: "success", // overridden to destructive when is_failed
  capa_due: "amber", // overridden to destructive when is_overdue
  asset_pm_due: "amber", // overridden to destructive when is_overdue
  investigation_due: "brand", // overridden to destructive when is_overdue
  regulatory_deadline: "brand_bold",
};
