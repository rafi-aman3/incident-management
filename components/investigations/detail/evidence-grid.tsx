import { FileText, Trash2 } from "lucide-react";
import { deleteInvestigationEvidence } from "@/app/(app)/investigations/[id]/actions";

export type EvidenceItem = {
  id: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  /** Pre-signed URL valid for ~1 hour (generated on the server). */
  signed_url: string | null;
};

export function EvidenceGrid({
  investigationId,
  items,
  canDelete,
}: {
  investigationId: string;
  items: EvidenceItem[];
  canDelete: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
        No evidence yet — upload photos, maintenance logs, SDS sheets, or PDF reports.
      </div>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
      {items.map((it) => (
        <li
          key={it.id}
          className="group relative overflow-hidden rounded-md border bg-card"
        >
          {it.signed_url && it.mime_type?.startsWith("image/") ? (
            <a
              href={it.signed_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block aspect-square w-full bg-muted"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.signed_url}
                alt={it.file_name}
                className="h-full w-full object-cover"
              />
            </a>
          ) : (
            <a
              href={it.signed_url ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex aspect-square w-full flex-col items-center justify-center bg-muted/40"
            >
              <FileText className="h-10 w-10 text-muted-foreground" />
              <span className="mt-2 px-2 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                {it.mime_type?.split("/").pop() ?? "file"}
              </span>
            </a>
          )}
          <div className="space-y-0.5 px-2 py-1.5">
            <p className="truncate text-xs font-medium" title={it.file_name}>
              {it.file_name}
            </p>
            <p className="truncate text-[10px] text-muted-foreground">
              {it.uploaded_by_name ?? "Unknown"} ·{" "}
              {new Date(it.uploaded_at).toLocaleDateString()}
            </p>
          </div>
          {canDelete && (
            <form action={deleteInvestigationEvidence}>
              <input type="hidden" name="investigation_id" value={investigationId} />
              <input type="hidden" name="evidence_id" value={it.id} />
              <button
                type="submit"
                aria-label={`Delete ${it.file_name}`}
                className="absolute right-1.5 top-1.5 rounded-md bg-background/90 p-1 text-muted-foreground opacity-0 backdrop-blur transition-opacity hover:text-destructive group-hover:opacity-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}

