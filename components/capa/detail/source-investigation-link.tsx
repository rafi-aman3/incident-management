import Link from "next/link";
import { ExternalLink, ClipboardList } from "lucide-react";

export function SourceInvestigationLink({
  investigationId,
  investigationRef,
  incidentTitle,
}: {
  investigationId: string | null;
  investigationRef: string | null;
  incidentTitle: string | null;
}) {
  if (!investigationId) {
    return (
      <div className="rounded-lg border bg-card px-4 py-3 text-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Source
        </p>
        <p className="mt-1 italic text-muted-foreground">Stand-alone CAPA</p>
      </div>
    );
  }
  return (
    <Link
      href={`/investigations/${investigationId}`}
      className="block rounded-lg border bg-card px-4 py-3 text-sm hover:border-primary"
    >
      <p className="flex items-center gap-1 text-xs uppercase tracking-wide text-muted-foreground">
        <ClipboardList className="h-3 w-3" /> Source investigation
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">
            {incidentTitle ?? "Investigation"}
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            {investigationRef ?? "—"}
          </p>
        </div>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
    </Link>
  );
}
