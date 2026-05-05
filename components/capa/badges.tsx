import { cn } from "@/lib/utils";
import { CAPA_STATUS_META, type CapaStatus } from "@/lib/capa/types";

const TONE_STYLES: Record<
  ReturnType<typeof getTone>,
  string
> = {
  neutral: "bg-muted text-muted-foreground",
  info: "bg-accent text-foreground",
  warning:
    "bg-warning/15 text-warning-foreground dark:text-warning border border-warning/30",
  success: "bg-success/15 text-success-foreground dark:text-success",
  muted: "bg-muted text-muted-foreground",
};

function getTone(status: CapaStatus) {
  return CAPA_STATUS_META[status].tone;
}

export function CapaStatusBadge({
  status,
  overdue,
}: {
  status: CapaStatus;
  overdue?: boolean;
}) {
  if (overdue) {
    return (
      <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive">
        Overdue
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        TONE_STYLES[getTone(status)]
      )}
    >
      {CAPA_STATUS_META[status].label}
    </span>
  );
}

export function CapaTypeBadge({ type }: { type: "corrective" | "preventive" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        type === "corrective"
          ? "border-destructive/30 text-destructive"
          : "border-success/30 text-success"
      )}
    >
      {type}
    </span>
  );
}

export function CapaProgressBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="text-[11px] tabular-nums text-muted-foreground">
        {clamped}%
      </span>
    </div>
  );
}
