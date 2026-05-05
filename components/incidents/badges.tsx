import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES: Record<string, string> = {
  S1: "bg-sev-1 text-white",
  S2: "bg-sev-2 text-white",
  S3: "bg-sev-3 text-foreground",
  S4: "bg-sev-4 text-white",
  S5: "bg-sev-5 text-foreground",
};

const SEVERITY_LABEL: Record<string, string> = {
  S1: "Critical",
  S2: "Major",
  S3: "Moderate",
  S4: "Minor",
  S5: "Insignificant",
};

const TRACK_STYLES: Record<string, string> = {
  A: "border-destructive text-destructive",
  B: "border-warning text-warning",
  C: "border-success text-success",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  classified: "Classified",
  under_investigation: "Under investigation",
  awaiting_capa: "Awaiting CAPA",
  closed: "Closed",
};

export function SeverityBadge({ severity }: { severity: string | null | undefined }) {
  if (!severity) return <Badge variant="outline">unclassified</Badge>;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold",
        SEVERITY_STYLES[severity]
      )}
    >
      {severity} · {SEVERITY_LABEL[severity]}
    </span>
  );
}

export function TrackBadge({ track }: { track: string | null | undefined }) {
  if (!track) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        TRACK_STYLES[track]
      )}
    >
      Track {track}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "closed"
      ? "bg-muted text-muted-foreground"
      : status === "draft"
      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      : "bg-accent text-foreground";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium", tone)}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
