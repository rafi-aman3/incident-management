import { cn } from "@/lib/utils";
import { DOCUMENT_TYPE_LABEL, type DocumentType } from "@/lib/documents/types";

export function DocumentTypeChip({
  type,
  className,
}: {
  type: DocumentType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground",
        className,
      )}
    >
      {DOCUMENT_TYPE_LABEL[type]}
    </span>
  );
}

/**
 * Expiry pill — red ≤ 30 days from today, gray otherwise.
 * Pass null/undefined to render nothing.
 */
export function DocumentExpiryPill({
  expiry,
  className,
}: {
  expiry: string | null | undefined;
  className?: string;
}) {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  const isPast = ms < 0;
  const isSoon = !isPast && days <= 30;
  const tone = isPast
    ? "bg-destructive/10 text-destructive"
    : isSoon
      ? "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        tone,
        className,
      )}
    >
      {isPast
        ? `Expired ${Math.abs(days)}d ago`
        : isSoon
          ? `Expires in ${days}d`
          : `Exp ${expiry}`}
    </span>
  );
}

export function DocumentArchivedBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      Archived
    </span>
  );
}
