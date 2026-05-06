import { format } from "date-fns";
import type { PlannerEvent } from "@/lib/planner/types";
import { EventChip } from "@/components/planner/event-chip";

export function PlannerDay({
  events,
  date,
}: {
  events: PlannerEvent[];
  date: Date;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="border-b bg-muted/30 px-4 py-2.5">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {format(date, "EEEE")}
        </p>
        <p className="text-lg font-semibold">{format(date, "PPP")}</p>
        <p className="text-xs text-muted-foreground">
          {events.length} event{events.length === 1 ? "" : "s"}
        </p>
      </div>
      <div className="space-y-1.5 p-3">
        {events.length === 0 ? (
          <p className="px-1 py-8 text-center text-sm text-muted-foreground">
            No events scheduled.
          </p>
        ) : (
          events.map((ev) => <EventChip key={ev.id} event={ev} size="md" />)
        )}
      </div>
    </div>
  );
}
