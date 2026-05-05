import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: "What happened" },
  { n: 2, label: "Details" },
  { n: 3, label: "Review & submit" },
];

export function WizardProgress({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol className="flex items-center gap-2 text-sm" aria-label="Report wizard progress">
      {STEPS.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        return (
          <li key={s.n} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold",
                done && "bg-success text-white",
                active && "bg-primary text-primary-foreground",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="h-4 w-4" /> : s.n}
            </div>
            <span className={cn(active ? "font-medium" : "text-muted-foreground")}>{s.label}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-muted-foreground">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export function SandboxBanner() {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
      <strong>Practice mode.</strong> This incident will be marked sandbox — it won&apos;t show up in
      KPIs, dashboards, reports, or fire any regulatory clocks.
    </div>
  );
}
