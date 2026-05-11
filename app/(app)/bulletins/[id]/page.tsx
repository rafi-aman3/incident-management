import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { Badge } from "@/components/ui/badge";
import { BulletinBody } from "@/components/bulletins/bulletin-body";
import {
  PublishButton,
  UnpublishButton,
  ArchiveButton,
} from "@/components/bulletins/bulletin-action-buttons";

type Params = Promise<{ id: string }>;

const STATUS_BADGE: Record<"draft" | "published" | "archived", { label: string; variant: "default" | "secondary" | "outline" }> = {
  draft: { label: "Draft", variant: "secondary" },
  published: { label: "Published", variant: "default" },
  archived: { label: "Archived", variant: "outline" },
};

export default async function BulletinDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user, currentSiteId } = await requireUser();
  const canPublish = await can("bulletin:publish", currentSiteId);

  const { data: row } = await supabase
    .from("safety_bulletins")
    .select(
      "id, title, summary, body, status, published_at, archived_at, updated_at, created_by, created_at, source_incident:source_incident_id(id, ref_code, title), source_investigation:source_investigation_id(id, ref_code), author:created_by(full_name, email)",
    )
    .eq("id", id)
    .single();

  if (!row) notFound();

  const status = row.status as "draft" | "published" | "archived";
  const badge = STATUS_BADGE[status];
  const isAuthor = row.created_by === user.id;
  const canEdit = isAuthor && status === "draft";

  const inc = row.source_incident as { id?: string; ref_code?: string | null; title?: string } | null;
  const inv = row.source_investigation as { id?: string; ref_code?: string | null } | null;
  const author = row.author as { full_name?: string | null; email?: string | null } | null;

  const when = status === "published"
    ? (row.published_at as string | null)
    : (row.updated_at as string);
  const whenLabel = when
    ? formatDistanceToNow(new Date(when), { addSuffix: true })
    : "—";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/bulletins"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All bulletins
        </Link>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <h1 className="flex-1 text-2xl font-semibold">{row.title}</h1>
          <Badge variant={badge.variant} className="mt-1">{badge.label}</Badge>
        </div>
        {row.summary && (
          <p className="text-base text-muted-foreground">{row.summary}</p>
        )}
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {inc?.ref_code && (
            <Link href={`/incidents/${inc.id}`} className="hover:text-foreground">
              Incident {inc.ref_code}
            </Link>
          )}
          {inv?.ref_code && (
            <>
              <span>·</span>
              <Link href={`/investigations/${inv.id}`} className="hover:text-foreground">
                Investigation {inv.ref_code}
              </Link>
            </>
          )}
          <span>· {whenLabel}</span>
          {author && <span>· by {author.full_name || author.email}</span>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {canEdit && (
          <Link
            href={`/bulletins/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            <Pencil className="h-3.5 w-3.5" /> Edit
          </Link>
        )}
        {canPublish && status === "draft" && <PublishButton id={id} />}
        {canPublish && status === "published" && (
          <>
            <UnpublishButton id={id} />
            <ArchiveButton id={id} />
          </>
        )}
      </div>

      <div className="rounded-lg border bg-card p-6">
        <BulletinBody markdown={(row.body as string) || "_(No content yet.)_"} />
      </div>
    </div>
  );
}
