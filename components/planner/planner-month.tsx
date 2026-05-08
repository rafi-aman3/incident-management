import Link from "next/link";
import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from "date-fns";
import { monthRange } from "@/lib/planner/range";
import type { PlannerEvent } from "@/lib/planner/types";
import { EventChip } from "@/components/planner/event-chip";
import { cn } from "@/lib/utils";

const MAX_CHIPS_PER_CELL = 3;
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function PlannerMonth({
  events,
  date,
  hrefForDay,
}: {
  events: PlannerEvent[];
  date: Date;
  /** Build the URL for "+N more" / day-cell click — preserves filters. */
  hrefForDay: (d: Date) => string;
}) {
  const { start, end } = monthRange(date);
  const totalDays =
    Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const days = Array.from({ length: totalDays }, (_, i) => addDays(start, i));
  const monthAnchor = startOfMonth(date);
  const today = new Date();

  // Bucket events by yyyy-MM-dd for O(1) lookup per cell.
  const buckets = new Map<string, PlannerEvent[]>();
  for (const ev of events) {
    const key = format(new Date(ev.date), "yyyy-MM-dd");
    const arr = buckets.get(key) ?? [];
    arr.push(ev);
    buckets.set(key, arr);
  }

  // Chunk the flat day array into 5- or 6-row matrix for ARIA row semantics.
  const rows: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto rounded-lg border bg-card">
      <div className="min-w-[640px]">
        <div
          className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          role="presentation"
        >
          {WEEKDAY_LABELS.map((d) => (
            <div key={d} className="px-2 py-1.5 text-center">
              {d}
            </div>
          ))}
        </div>

        <div role="grid" aria-label="Planner month grid">
          {rows.map((row, rowIdx) => (
            <div
              key={rowIdx}
              role="row"
              className="grid grid-cols-7 border-b last:border-b-0"
            >
              {row.map((d) => {
                const inMonth = isSameMonth(d, monthAnchor);
                const isToday = isSameDay(d, today);
                const key = format(d, "yyyy-MM-dd");
                const cellEvents = buckets.get(key) ?? [];
                const visible = cellEvents.slice(0, MAX_CHIPS_PER_CELL);
                const hidden = cellEvents.length - visible.length;
                const total = cellEvents.length;
                const ariaLabel = `${format(d, "EEEE, PPP")}, ${total} event${total === 1 ? "" : "s"}`;

                return (
                  <div
                    key={key}
                    role="gridcell"
                    aria-label={ariaLabel}
                    className={cn(
                      "min-h-[88px] border-r p-1 last-of-type:border-r-0",
                      "[&:nth-child(7n)]:border-r-0",
                      !inMonth && "bg-muted/20",
                    )}
                  >
                    <div className="flex items-center justify-between px-1">
                      <span
                        aria-hidden
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded text-[11px] font-medium",
                          !inMonth && "text-muted-foreground/50",
                          isToday && "bg-brand text-white",
                        )}
                      >
                        {format(d, "d")}
                      </span>
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {visible.map((ev) => (
                        <EventChip key={ev.id} event={ev} size="sm" />
                      ))}
                      {hidden > 0 ? (
                        <Link
                          href={hrefForDay(d)}
                          aria-label={`View all ${total} events on ${format(d, "PPP")}`}
                          className="block px-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          +{hidden} more
                        </Link>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
