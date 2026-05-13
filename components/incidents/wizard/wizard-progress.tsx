import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS: { n: 1 | 2 | 3; label: string }[] = [
  { n: 1, label: "Incident Report" },
  { n: 2, label: "Witnesses & Details" },
  { n: 3, label: "Review & Submit" },
];

export function WizardProgress({ current }: { current: 1 | 2 | 3 }) {
  const percent = ((current - 1) / (STEPS.length - 1)) * 100;
  return (
    <div className="space-y-3">
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
                  "relative inline-flex items-center gap-2 overflow-hidden rounded-full border px-3 py-1.5 transition-all duration-300",
                  active &&
                    "border-success/60 bg-gradient-to-br from-success/15 to-success/5 shadow-sm",
                  done && "border-success/40 bg-success/5",
                  !done && !active && "border-border bg-card text-muted-foreground",
                )}
              >
                {active && (
                  <span
                    className="pointer-events-none absolute -inset-0.5 -z-10 rounded-full bg-gradient-to-r from-success/40 via-success/20 to-success/40 opacity-60 blur-md"
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    "relative flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold transition-colors",
                    active && "bg-gradient-to-br from-success to-[var(--success-hover)] text-background",
                    done && "bg-success/85 text-background",
                    !done && !active && "bg-muted text-muted-foreground",
                  )}
                >
                  {active && (
                    <span
                      className="animate-pulse-ring absolute inset-0 rounded-full bg-success/60"
                      aria-hidden
                    />
                  )}
                  <span className="relative">
                    {done ? <Check className="h-3 w-3" /> : s.n}
                  </span>
                </span>
                <span
                  className={cn(
                    "text-sm transition-colors",
                    active ? "font-medium text-foreground" : done ? "text-foreground" : "",
                  )}
                >
                  {s.label}
                </span>
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className={cn(
                    "h-px w-6 transition-colors duration-500 sm:w-8",
                    s.n < current
                      ? "bg-gradient-to-r from-success/70 to-success/40"
                      : "bg-border",
                  )}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Slim progress rail underneath — gradient fill scales with current step.
          Decorative reinforcement, hidden from assistive tech. */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-border/60" aria-hidden>
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-success via-success/80 to-[var(--brand)] transition-[width] duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

export function SandboxBanner() {
  return (
    <div className="relative overflow-hidden rounded-md border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-50/60 to-transparent p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:from-amber-950/40 dark:via-amber-950/20 dark:text-amber-200">
      <span
        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-400 to-amber-600"
        aria-hidden
      />
      <strong className="ml-1">Practice mode.</strong> This incident will be marked sandbox — it
      won&apos;t show up in KPIs, dashboards, reports, or fire any regulatory
      clocks.
    </div>
  );
}
