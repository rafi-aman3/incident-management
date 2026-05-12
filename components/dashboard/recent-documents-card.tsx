import Link from "next/link";
import { FileText, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { RecentDocumentRow } from "@/lib/dashboard/org/recent-documents";

export function RecentDocumentsCard({ rows }: { rows: RecentDocumentRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent documents</h2>
        <Link
          href="/resources/documents"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">No documents yet.</div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center gap-3 p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[r.type, r.site_name].filter(Boolean).join(" · ")}
                  {" · "}
                  {formatDistanceToNow(new Date(r.uploaded_at), { addSuffix: true })}
                </p>
              </div>
              <Link
                href={`/resources/documents/${r.id}`}
                className="inline-flex shrink-0 items-center gap-1 text-xs text-primary hover:underline"
              >
                Open <ArrowRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
