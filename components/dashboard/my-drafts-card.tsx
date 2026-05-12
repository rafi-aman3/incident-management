import Link from "next/link";
import { FileEdit, ClipboardList, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DraftRow } from "@/lib/dashboard/org/my-drafts";

function iconFor(kind: DraftRow["kind"]) {
  if (kind === "incident") return FileEdit;
  return ClipboardList;
}

export function MyDraftsCard({ rows }: { rows: DraftRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">My drafts</h2>
        <span className="text-xs text-muted-foreground">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Nothing in progress.
        </div>
      ) : (
        <ul className="divide-y">
          {rows.map((r) => {
            const Icon = iconFor(r.kind);
            return (
              <li
                key={`${r.kind}-${r.id}`}
                className="flex items-center gap-3 p-3 text-sm"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.kind} ·{" "}
                    {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true })}
                  </p>
                </div>
                <Link
                  href={r.href}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  Resume <ArrowRight className="h-3 w-3" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
