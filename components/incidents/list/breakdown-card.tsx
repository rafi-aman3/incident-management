import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type BreakdownRow = {
  key: string;
  label: string;
  count: number;
  href?: string;
  /** Tailwind class for the bar fill. Falls back to bg-muted-foreground/40. */
  barClass?: string;
};

export function BreakdownCard({
  title,
  topAnnotation,
  icon,
  rows,
  emptyMessage = "No incidents yet.",
}: {
  title: string;
  topAnnotation?: string;
  icon?: ReactNode;
  rows: BreakdownRow[];
  emptyMessage?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  const visibleRows = rows.filter((r) => r.count > 0);

  return (
    <div className="flex flex-col rounded-xl border bg-card p-4 ring-1 ring-foreground/5">
      <div className="flex items-baseline gap-2">
        {icon}
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h3>
        {topAnnotation && (
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {topAnnotation}
          </span>
        )}
      </div>
      {visibleRows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {visibleRows.map((row) => {
            const pct = (row.count / max) * 100;
            return (
              <li key={row.key} className="space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="truncate font-medium">{row.label}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {row.count}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn(
                      "h-full rounded-full transition-[width]",
                      row.barClass ?? "bg-muted-foreground/40",
                    )}
                    style={{ width: `${pct}%` }}
                    aria-hidden
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
