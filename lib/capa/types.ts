/**
 * CAPA status enum + tab metadata for /capa list page.
 *
 * DB enum `capa_status` (init.sql line 27):
 *   created | in_progress | completed | pending_verification | verified | closed
 *
 * The list page tabs collapse those 6 states into 6 user-facing buckets that
 * map cleanly to common questions ("what's mine to do?", "what's overdue?",
 * "what's awaiting my verification?").
 */

export const CAPA_STATUSES = [
  "created",
  "in_progress",
  "completed",
  "pending_verification",
  "verified",
  "closed",
] as const;

export type CapaStatus = (typeof CAPA_STATUSES)[number];

export const CAPA_STATUS_META: Record<
  CapaStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "muted" }
> = {
  created: { label: "Created", tone: "neutral" },
  in_progress: { label: "In progress", tone: "info" },
  completed: { label: "Completed", tone: "info" },
  pending_verification: { label: "Pending verification", tone: "warning" },
  verified: { label: "Verified", tone: "success" },
  closed: { label: "Closed", tone: "muted" },
};

export const CAPA_TABS = [
  { key: "mine", label: "Mine" },
  { key: "active", label: "Active" },
  { key: "pending_verification", label: "Pending verification" },
  { key: "overdue", label: "Overdue" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
] as const;

export type CapaTabKey = (typeof CAPA_TABS)[number]["key"];

/** Statuses considered "open" — not verified or closed. */
export const ACTIVE_STATUSES: ReadonlyArray<CapaStatus> = [
  "created",
  "in_progress",
  "completed",
];

export const CLOSED_STATUSES: ReadonlyArray<CapaStatus> = ["verified", "closed"];

/**
 * Per-tab empty-state copy. Keyed off the tab the user is currently looking
 * at so "Mine" empty doesn't read like "All" empty (the prior shipped string
 * was "No CAPAs match this view." for every tab — same string regardless of
 * intent).
 */
export const CAPA_TAB_EMPTY_COPY: Record<CapaTabKey, string> = {
  mine: "Nothing assigned to you. New CAPAs from investigations or inspections appear here.",
  active: "No active CAPAs. They'll show up here as investigations create them.",
  pending_verification: "Nothing waiting on a verifier.",
  overdue: "No overdue CAPAs — nice work.",
  closed: "No closed CAPAs yet.",
  all: "No CAPAs in this org yet.",
};
