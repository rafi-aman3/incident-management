/**
 * Investigation status enum + column metadata for the Kanban board.
 *
 * The DB enum `investigation_status` (init.sql line 24) defines:
 *   pending_assignment | in_progress | awaiting_capa | closed
 *
 * Order of `INVESTIGATION_STATUSES` is the Kanban left-to-right column order.
 */

export const INVESTIGATION_STATUSES = [
  "pending_assignment",
  "in_progress",
  "awaiting_capa",
  "closed",
] as const;

export type InvestigationStatus = (typeof INVESTIGATION_STATUSES)[number];

export const INVESTIGATION_STATUS_META: Record<
  InvestigationStatus,
  { label: string; description: string }
> = {
  pending_assignment: {
    label: "Pending Assignment",
    description: "Awaiting a lead investigator.",
  },
  in_progress: {
    label: "In Progress",
    description: "Lead actively investigating.",
  },
  awaiting_capa: {
    label: "Awaiting CAPA",
    description: "RCA done, CAPA recommended.",
  },
  closed: {
    label: "Closed",
    description: "Finalized (with or without CAPA).",
  },
};

/**
 * Allowed forward transitions per state machine in ui-flow §10.2.
 *   pending_assignment → in_progress
 *   in_progress        → awaiting_capa | closed (no CAPA)
 *   awaiting_capa      → closed
 *   closed             → (terminal)
 *
 * Drag-back transitions (e.g. closed → in_progress) are not allowed.
 */
export const INVESTIGATION_TRANSITIONS: Record<
  InvestigationStatus,
  ReadonlyArray<InvestigationStatus>
> = {
  pending_assignment: ["in_progress"],
  in_progress: ["awaiting_capa", "closed"],
  awaiting_capa: ["closed"],
  closed: [],
};
