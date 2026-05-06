import { addDays, format, isSameDay } from "date-fns";
import { weekRange } from "@/lib/planner/range";
import type { PlannerEvent } from "@/lib/planner/types";
import { EventChip } from "@/components/planner/event-chip";
import { cn } from "@/lib/utils";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export function PlannerWeek({
  events,
  date,
}: {
  events: PlannerEvent[];
  date: Date;
}) {
  const { start } = weekRange(date);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = new Date();

  // Bucket by yyyy-MM-dd, then split each bucket into AM (<12:00) / PM (>=12:00).
  type Bucket = { am: PlannerEvent[]; pm: PlannerEvent[] };
  const buckets = new Map<string, Bucket>();
  for (const ev of events) {
    const d = new Date(ev.date);
    const key = format(d, "yyyy-MM-dd");
    const bucket = buckets.get(key) ?? { am: [], pm: [] };
    if (d.getHours() < 12) bucket.am.push(ev);
    else bucket.pm.push(ev);
    buckets.set(key, bucket);
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="grid grid-cols-7 border-b bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {days.map((d, idx) => (
          <div
            key={d.toISOString()}
            className={cn(
              "px-2 py-1.5 text-center",
              isSameDay(d, today) && "text-brand",
            )}
          >
            <div>{WEEKDAY_LABELS[idx]}</div>
            <div className="text-sm font-semibold tracking-normal text-foreground">
              {format(d, "d MMM")}
            </div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const key = format(d, "yyyy-MM-dd");
          const bucket = buckets.get(key) ?? { am: [], pm: [] };
          return (
            <div
              key={key}
              className={cn(
                "min-h-[280px] border-r p-2 last-of-type:border-r-0",
                "[&:nth-child(7n)]:border-r-0",
                isSameDay(d, today) && "bg-brand-soft/30",
              )}
            >
              <div className="space-y-2">
                {bucket.am.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Morning
                    </p>
                    <div className="space-y-1">
                      {bucket.am.map((ev) => (
                        <EventChip key={ev.id} event={ev} size="md" />
                      ))}
                    </div>
                  </div>
                ) : null}
                {bucket.pm.length > 0 ? (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Afternoon / Evening
                    </p>
                    <div className="space-y-1">
                      {bucket.pm.map((ev) => (
                        <EventChip key={ev.id} event={ev} size="md" />
                      ))}
                    </div>
                  </div>
                ) : null}
                {bucket.am.length === 0 && bucket.pm.length === 0 ? (
                  <p className="text-[10px] italic text-muted-foreground/60">
                    No events
                  </p>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
