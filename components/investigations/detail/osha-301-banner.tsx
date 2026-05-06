import Link from "next/link";
import { differenceInCalendarDays } from "date-fns";
import { FileText, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sticky banner mounted on /investigations/[id] when the source incident is
 * OSHA-recordable. Shows the 7-day clock; turns destructive (red) when ≤ 1
 * day remains. Per ui-flow §8.10 + SPEC §6.3 / SPEC §7.
 *
 * Click → /reports/osha-301/[incidentId] (form pre-fill, ships in Section D).
 */
export function Osha301Banner({
  incidentId,
  occurredAt,
}: {
  incidentId: string;
  occurredAt: string;
}) {
  const occurred = new Date(occurredAt);
  if (Number.isNaN(occurred.getTime())) return null;
  const due = new Date(occurred.getTime() + 7 * 24 * 60 * 60 * 1000);
  const daysLeft = differenceInCalendarDays(due, new Date());
  const overdue = daysLeft < 0;
  const urgent = daysLeft <= 1;

  return (
    <div
      className={cn(
        "sticky top-2 z-10 flex items-center gap-3 rounded-md border-l-4 px-4 py-2.5 text-sm shadow-sm",
        overdue || urgent
          ? "border-destructive bg-destructive/5"
          : "border-warning bg-warning/5"
      )}
    >
      {overdue || urgent ? (
        <AlertTriangle className="h-4 w-4 text-destructive" />
      ) : (
        <FileText className="h-4 w-4 text-warning" />
      )}
      <div className="flex-1">
        <p className="font-medium">
          OSHA 301 due{" "}
          {overdue
            ? `${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? "" : "s"} ago`
            : daysLeft === 0
              ? "today"
              : `in ${daysLeft} day${daysLeft === 1 ? "" : "s"}`}
        </p>
        <p className="text-[11px] text-muted-foreground">
          Per OSHA §1904.29(b)(3), Form 301 must be completed within 7 calendar days of the incident.
        </p>
      </div>
      <Link
        href={`/reports/osha-301/${incidentId}`}
        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
      >
        Open 301 form
      </Link>
    </div>
  );
}
