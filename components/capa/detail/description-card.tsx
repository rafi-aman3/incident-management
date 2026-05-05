import { CapaTypeBadge } from "@/components/capa/badges";

export function CapaDescriptionCard({
  refCode,
  title,
  description,
  type,
  rejectionReason,
}: {
  refCode: string | null;
  title: string;
  description: string | null;
  type: "corrective" | "preventive";
  rejectionReason: string | null;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            {refCode ?? "—"}
            <CapaTypeBadge type={type} />
          </div>
          <h2 className="mt-1 text-lg font-semibold">{title}</h2>
        </div>
      </div>
      <div className="space-y-4 px-4 py-3 text-sm">
        {description ? (
          <p className="whitespace-pre-wrap leading-relaxed">{description}</p>
        ) : (
          <p className="italic text-muted-foreground">No description.</p>
        )}
        {rejectionReason && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-destructive">
              Verification rejected
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap">{rejectionReason}</p>
          </div>
        )}
      </div>
    </div>
  );
}
