import { AlertTriangle } from "lucide-react";
import { PLANNER_EVENT_LABEL, type PlannerEventKind } from "@/lib/planner/types";

/**
 * Quiet warning pill rendered above the calendar when one or more
 * source queries failed inside `aggregatePlannerEvents`. The aggregator
 * preserves the per-source `[]`-on-error swallow contract — this pill
 * just makes the silent failure visible. No retry button per plan Q4
 * (browser refresh is the only sensible recovery for a server-rendered
 * read-only surface).
 */
export function SourceFailurePill({
  failedKinds,
}: {
  failedKinds: ReadonlyArray<PlannerEventKind>;
}) {
  if (failedKinds.length === 0) return null;
  const label = failedKinds.map((k) => PLANNER_EVENT_LABEL[k]).join(", ");
  return (
    <div
      role="status"
      className="flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-3 py-1.5 text-xs text-foreground"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden />
      <span>
        {failedKinds.length === 1 ? "1 source" : `${failedKinds.length} sources`}{" "}
        failed to load ({label}) — refresh to retry.
      </span>
    </div>
  );
}
