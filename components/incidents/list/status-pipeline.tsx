import { cn } from "@/lib/utils";
import type { StatusPipeline } from "@/lib/queries/incidents-list";

type Stage = {
  key: keyof Omit<StatusPipeline, "total">;
  label: string;
  fillClass: string;
  bgClass: string;
  textClass: string;
};

const STAGES: Stage[] = [
  {
    key: "reported",
    label: "Reported",
    fillClass: "bg-foreground-muted/60",
    bgClass: "bg-muted",
    textClass: "text-foreground",
  },
  {
    key: "investigating",
    label: "Investigating",
    fillClass: "bg-warning",
    bgClass: "bg-warning/10",
    textClass: "text-foreground",
  },
  {
    key: "actionRequired",
    label: "Action Required",
    fillClass: "bg-primary",
    bgClass: "bg-primary/10",
    textClass: "text-foreground",
  },
  {
    key: "closed",
    label: "Closed",
    fillClass: "bg-success",
    bgClass: "bg-success/10",
    textClass: "text-foreground",
  },
];

export function StatusPipelineRow({ pipeline }: { pipeline: StatusPipeline }) {
  return (
    <div className="rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Status Pipeline
      </h3>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAGES.map((stage) => {
          const count = pipeline[stage.key];
          const pct = pipeline.total > 0 ? Math.round((count / pipeline.total) * 100) : 0;
          return (
            <div
              key={stage.key}
              className={cn("rounded-lg p-3", stage.bgClass)}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-[10px] font-semibold uppercase tracking-wide",
                    stage.textClass,
                  )}
                >
                  {stage.label}
                </span>
                <span className="tabular-nums text-[11px] text-muted-foreground">
                  {pct}%
                </span>
              </div>
              <div
                className={cn(
                  "mt-1 text-2xl font-semibold tabular-nums leading-none",
                  stage.textClass,
                )}
              >
                {count}
              </div>
              <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-foreground/5">
                <div
                  className={cn("h-full rounded-full", stage.fillClass)}
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
