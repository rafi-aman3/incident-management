import { cn } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";
import {
  INVESTIGATION_STATUS_META,
  type InvestigationStatus,
} from "@/lib/investigations/types";

const STATUS_TONE: Record<InvestigationStatus, string> = {
  pending_assignment: "bg-muted text-muted-foreground",
  in_progress: "bg-accent text-foreground",
  awaiting_capa:
    "bg-warning/15 text-warning-foreground dark:text-warning border border-warning/30",
  closed: "bg-success/15 text-success-foreground dark:text-success",
};

export function InvestigationStatusBadge({
  status,
}: {
  status: InvestigationStatus;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        STATUS_TONE[status]
      )}
    >
      {INVESTIGATION_STATUS_META[status].label}
    </span>
  );
}

/**
 * Due-date chip — yellow when ≤ 3 days remain, red when overdue, plain otherwise.
 * Per ui-flow §8.9: "yellow chip when ≤ 3 days remain, red when overdue".
 */
export function DueDateChip({ dueDate }: { dueDate: string | null }) {
  if (!dueDate) return null;
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return null;
  const daysLeft = differenceInCalendarDays(due, new Date());

  let tone = "bg-muted text-muted-foreground";
  let label: string;
  if (daysLeft < 0) {
    tone = "bg-destructive/15 text-destructive border border-destructive/30";
    label = `${Math.abs(daysLeft)}d overdue`;
  } else if (daysLeft <= 3) {
    tone = "bg-warning/20 text-warning-foreground dark:text-warning border border-warning/40";
    label = daysLeft === 0 ? "due today" : `${daysLeft}d left`;
  } else {
    label = `due ${due.toLocaleDateString()}`;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums",
        tone
      )}
    >
      {label}
    </span>
  );
}
