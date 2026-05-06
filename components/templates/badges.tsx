import { cn } from "@/lib/utils";
import type { TemplateStatus } from "@/lib/templates/types";
import { industryLabel, type IndustryEnum } from "@/lib/templates/industry-map";

const STATUS_META: Record<
  TemplateStatus,
  { label: string; classes: string; dotClasses: string }
> = {
  draft: {
    label: "Draft",
    classes:
      "bg-warning/15 text-warning-foreground dark:text-warning border border-warning/30",
    dotClasses: "bg-warning",
  },
  published: {
    label: "Published",
    classes: "bg-success/15 text-success-foreground dark:text-success",
    dotClasses: "bg-success",
  },
  archived: {
    label: "Archived",
    classes: "bg-muted text-muted-foreground",
    dotClasses: "bg-muted-foreground/40",
  },
};

export function TemplateStatusBadge({
  status,
  showDot = true,
}: {
  status: TemplateStatus;
  showDot?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium",
        meta.classes
      )}
    >
      {showDot && (
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClasses)} />
      )}
      {meta.label}
    </span>
  );
}

export function IndustryChip({ industry }: { industry: IndustryEnum }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {industryLabel(industry)}
    </span>
  );
}

export function FeaturedChip() {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      Featured
    </span>
  );
}

export function VersionBadge({ versionNumber }: { versionNumber: number | null }) {
  if (versionNumber === null) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <span className="font-mono text-xs tabular-nums text-muted-foreground">
      v{versionNumber}
    </span>
  );
}
