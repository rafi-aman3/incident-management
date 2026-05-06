import { cn } from "@/lib/utils";
import type { InspectionStatus, FindingStatus } from "@/lib/templates/types";

const INSPECTION_META: Record<
  InspectionStatus,
  { label: string; classes: string; dot: string }
> = {
  draft: {
    label: "Draft",
    classes: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground/40",
  },
  in_progress: {
    label: "In progress",
    classes:
      "bg-warning/15 text-warning-foreground dark:text-warning border border-warning/30",
    dot: "bg-warning",
  },
  completed: {
    label: "Completed",
    classes: "bg-success/15 text-success-foreground dark:text-success",
    dot: "bg-success",
  },
  abandoned: {
    label: "Abandoned",
    classes:
      "bg-destructive/10 text-destructive border border-destructive/30",
    dot: "bg-destructive",
  },
};

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  const meta = INSPECTION_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        meta.classes
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
      {meta.label}
    </span>
  );
}

const FINDING_META: Record<
  FindingStatus,
  { label: string; classes: string }
> = {
  open: {
    label: "Open",
    classes:
      "bg-destructive/10 text-destructive border border-destructive/30",
  },
  in_progress: {
    label: "In progress",
    classes:
      "bg-warning/15 text-warning-foreground dark:text-warning border border-warning/30",
  },
  resolved: {
    label: "Resolved",
    classes: "bg-success/15 text-success-foreground dark:text-success",
  },
  escalated_to_incident: {
    label: "Escalated",
    classes: "bg-primary/10 text-primary border border-primary/30",
  },
};

export function FindingStatusBadge({ status }: { status: FindingStatus }) {
  const meta = FINDING_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        meta.classes
      )}
    >
      {meta.label}
    </span>
  );
}
