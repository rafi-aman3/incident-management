import { type JsaStatus } from "@/lib/actions/jsa-schemas";

const LABELS: Record<JsaStatus, string> = {
  draft: "Draft",
  under_review: "Under review",
  approved: "Approved",
  expired: "Expired",
  archived: "Archived",
};

const STYLES: Record<JsaStatus, string> = {
  draft: "border-border bg-muted text-foreground",
  under_review: "border-warning/30 bg-warning/10 text-warning-foreground",
  approved: "border-success/40 bg-success/10 text-success-foreground",
  expired: "border-destructive/40 bg-destructive/10 text-destructive",
  archived: "border-border bg-muted/60 text-muted-foreground",
};

export function JsaStatusBadge({ status }: { status: JsaStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      {LABELS[status]}
    </span>
  );
}
