import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: "Incident Report" },
  { n: 2, label: "Witnesses & Details" },
  { n: 3, label: "Review & Submit" },
];

export function WizardProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol
      className="flex flex-wrap items-center gap-2 text-sm"
      aria-label="Report wizard progress"
    >
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <span
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5",
                active &&
                  "border-success/60 bg-success/10 text-success-foreground",
                done && "border-success/40 bg-success/5",
                !done && !active && "border-border bg-card text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold",
                  active && "bg-success text-background",
                  done && "bg-success/80 text-background",
                  !done && !active && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="h-3 w-3" /> : s.n}
              </span>
              <span
                className={cn(
                  "text-sm",
                  active ? "font-medium text-foreground" : done ? "text-foreground" : "",
                )}
              >
                {s.label}
              </span>
            </span>
            {i < STEPS.length - 1 && (
              <ChevronRight
                className="h-4 w-4 text-muted-foreground"
                aria-hidden
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export function SandboxBanner() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <strong>Practice mode.</strong> This incident will be marked sandbox — it
      won&apos;t show up in KPIs, dashboards, reports, or fire any regulatory
      clocks.
    </div>
  );
}
