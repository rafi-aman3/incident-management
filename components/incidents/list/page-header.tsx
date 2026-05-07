import Link from "next/link";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

export function IncidentsPageHeader({ canReportIncident }: { canReportIncident: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 ring-1 ring-foreground/5">
      <div className="flex items-start gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive"
          aria-hidden
        >
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            <Link href="/dashboard" className="hover:underline">
              Home
            </Link>{" "}
            <span aria-hidden>›</span> Incidents
          </p>
          <h1 className="mt-0.5 text-2xl font-semibold leading-tight">
            Incident Management
          </h1>
        </div>
      </div>
      {canReportIncident && (
        <Link
          href="/incidents/new/1"
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Report incident
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </div>
  );
}
