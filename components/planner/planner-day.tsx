import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import type { PlannerEvent } from "@/lib/planner/types";
import { EventChip } from "@/components/planner/event-chip";

export function PlannerDay({
  events,
  date,
  siteName,
  backToMonthHref,
}: {
  events: PlannerEvent[];
  date: Date;
  /** Resolved single-site name when ?site= is one accessible site. Null for "all" or "current" without a name. */
  siteName: string | null;
  /** /planner?view=month&date=…&<filters> — preserves user's filter set. */
  backToMonthHref: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b bg-muted/30 px-4 py-2.5">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {format(date, "EEEE")}
          </p>
          <p className="text-lg font-semibold">{format(date, "PPP")}</p>
          <p className="text-xs text-muted-foreground">
            {events.length} event{events.length === 1 ? "" : "s"}
            {siteName ? ` · ${siteName}` : ""}
          </p>
        </div>
        <Link
          href={backToMonthHref}
          className="inline-flex items-center gap-1 rounded-md border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
          aria-label="Back to month view"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Back to month
        </Link>
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
