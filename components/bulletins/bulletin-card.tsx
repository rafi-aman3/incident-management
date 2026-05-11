import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Megaphone } from "lucide-react";

export type BulletinCardRow = {
  id: string;
  title: string;
  summary: string | null;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  updated_at: string;
  source_incident_ref: string | null;
  source_investigation_ref: string | null;
  author_name: string | null;
};

const STATUS_BADGE: Record<BulletinCardRow["status"], { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

export function BulletinCard({ row }: { row: BulletinCardRow }) {
  const badge = STATUS_BADGE[row.status];
  const when = row.status === "published"
    ? row.published_at
    : row.updated_at;
  const whenLabel = when
    ? formatDistanceToNow(new Date(when), { addSuffix: true })
    : "—";

  return (
    <Link
      href={`/bulletins/${row.id}`}
      className="block rounded-lg border bg-card p-4 transition hover:border-foreground/20 hover:bg-accent/30"
    >
      <div className="flex items-start gap-3">
        <Megaphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{row.title}</h3>
            <Badge variant={badge.variant} className="shrink-0">{badge.label}</Badge>
          </div>
          {row.summary && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {row.summary}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {row.source_incident_ref && (
              <span>Source: {row.source_incident_ref}</span>
            )}
            {row.source_investigation_ref && (
              <span>· {row.source_investigation_ref}</span>
            )}
            <span>· {whenLabel}</span>
            {row.author_name && <span>· by {row.author_name}</span>}
          </div>
        </div>
      </div>
    </Link>
  );
}
