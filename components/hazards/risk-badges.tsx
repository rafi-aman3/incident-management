import { cn } from "@/lib/utils";
import type { RiskLevel, HazardCategory, ControlLevel } from "@/lib/risk/types";

const SEVERITY_COLOR: Record<RiskLevel, string> = {
  S1: "bg-sev-1 text-white",
  S2: "bg-sev-2 text-white",
  S3: "bg-sev-3 text-foreground",
  S4: "bg-sev-4 text-white",
  S5: "bg-sev-5 text-foreground",
};

const SEVERITY_LABEL: Record<RiskLevel, string> = {
  S1: "Critical",
  S2: "Major",
  S3: "Moderate",
  S4: "Minor",
  S5: "Insignificant",
};

const STATUS_COLOR: Record<string, string> = {
  identified: "bg-muted text-foreground",
  under_assessment: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  controlled: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  monitoring: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  closed: "bg-zinc-500/15 text-zinc-700 dark:text-zinc-300",
  superseded: "bg-zinc-400/15 text-zinc-700 dark:text-zinc-300",
};

const STATUS_LABEL: Record<string, string> = {
  identified: "Identified",
  under_assessment: "Under Assessment",
  controlled: "Controlled",
  monitoring: "Monitoring",
  closed: "Closed",
  superseded: "Superseded",
};

export function RiskBadge({ score, size = "sm" }: { score: RiskLevel | null; size?: "sm" | "md" }) {
  if (!score) {
    return (
      <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md font-semibold tabular-nums",
        size === "md" ? "px-2 py-0.5 text-sm" : "px-1.5 py-0.5 text-xs",
        SEVERITY_COLOR[score],
      )}
    >
      {score} · {SEVERITY_LABEL[score]}
    </span>
  );
}

export function HazardStatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        STATUS_COLOR[status] ?? "bg-muted text-foreground",
      )}
    >
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const CATEGORY_LABEL: Record<HazardCategory, string> = {
  physical: "Physical",
  chemical: "Chemical",
  biological: "Biological",
  psychosocial: "Psychosocial",
  mechanical: "Mechanical",
  electrical: "Electrical",
  ergonomic: "Ergonomic",
  environmental: "Environmental",
};

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-xs text-foreground">
      {CATEGORY_LABEL[category as HazardCategory] ?? category}
    </span>
  );
}

const CONTROL_LEVEL_LABEL: Record<ControlLevel, string> = {
  elimination: "Elimination",
  substitution: "Substitution",
  engineering: "Engineering",
  administrative: "Administrative",
  ppe: "PPE",
};

const CONTROL_LEVEL_TONE: Record<ControlLevel, string> = {
  elimination: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  substitution: "bg-emerald-400/15 text-emerald-700 dark:text-emerald-300",
  engineering: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  administrative: "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  ppe: "bg-warning/20 text-warning",
};

export function ControlLevelBadge({ level }: { level: ControlLevel }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium",
        CONTROL_LEVEL_TONE[level],
      )}
    >
      {CONTROL_LEVEL_LABEL[level]}
    </span>
  );
}
