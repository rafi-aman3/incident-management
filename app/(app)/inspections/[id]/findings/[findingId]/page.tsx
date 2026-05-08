import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { FindingStatusBadge } from "@/components/inspections/inspection-status-badge";
import { FindingActionsCard } from "@/components/inspections/finding-actions-card";
import type { FindingStatus } from "@/lib/templates/types";

type Params = Promise<{ id: string; findingId: string }>;

type FindingFull = {
  id: string;
  ref_code: string;
  inspection_id: string;
  site_id: string;
  item_label: string;
  failed_response_label: string | null;
  comment: string | null;
  photo_paths: string[];
  status: FindingStatus;
  created_at: string;
  resolved_at: string | null;
  escalated_incident_id: string | null;
  resolved_by:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
};

export default async function FindingDetailPage({ params }: { params: Params }) {
  const { id: inspectionId, findingId } = await params;
  const { supabase } = await requireUser();

  const { data: f, error } = await supabase
    .from("inspection_findings")
    .select(
      `id, ref_code, inspection_id, site_id, item_label, failed_response_label,
       comment, photo_paths, status, created_at, resolved_at,
       escalated_incident_id,
       resolved_by:resolved_by ( full_name, email )`
    )
    .eq("id", findingId)
    .maybeSingle<FindingFull>();

  if (error || !f) notFound();
  if (f.inspection_id !== inspectionId) notFound();

  const canRead = await can("finding:read", f.site_id);
  if (!canRead) notFound();

  const canResolve = await can("finding:resolve", f.site_id);
  const canEscalate = await can("finding:escalate", f.site_id);

  // Sign URLs for photos
  let signedPhotos: { path: string; url: string | null }[] = [];
  if (f.photo_paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("inspection-uploads")
      .createSignedUrls(f.photo_paths, 60 * 60);
    signedPhotos = (signed ?? []).map((s, i) => ({
      path: f.photo_paths[i],
      url: s.error ? null : s.signedUrl,
    }));
  }

  const resolver = Array.isArray(f.resolved_by) ? f.resolved_by[0] : f.resolved_by;

  return (
    <div className="space-y-6">
      <Link
        href={`/inspections/${inspectionId}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to inspection
      </Link>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Finding · {f.ref_code}
        </p>
        <h1 className="text-2xl font-semibold">{f.item_label}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <FindingStatusBadge status={f.status} />
          {f.failed_response_label && (
            <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {f.failed_response_label}
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {f.comment && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Comment from runner
              </h2>
              <p className="mt-2 whitespace-pre-wrap text-sm">{f.comment}</p>
            </section>
          )}

          {signedPhotos.length > 0 && (
            <section className="rounded-lg border bg-card p-4">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Photos ({signedPhotos.length})
              </h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {signedPhotos.map((p) =>
                  p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={p.path}
                      src={p.url}
                      alt="Finding evidence"
                      className="h-32 w-full rounded-md border object-cover"
                    />
                  ) : (
                    <div
                      key={p.path}
                      className="flex h-32 w-full items-center justify-center rounded-md border bg-muted text-xs text-muted-foreground"
                    >
                      Image unavailable
                    </div>
                  )
                )}
              </div>
            </section>
          )}

          {f.escalated_incident_id && (
            <section className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm">
              <p className="font-medium">Escalated to an incident.</p>
              <Link
                href={`/incidents/${f.escalated_incident_id}`}
                className="text-primary hover:underline"
              >
                View incident →
              </Link>
            </section>
          )}

          {f.status === "resolved" && resolver && (
            <section className="rounded-lg border border-success/30 bg-success/5 p-4 text-sm">
              <p className="font-medium">Resolved.</p>
              <p className="text-xs text-muted-foreground">
                by {resolver.full_name ?? resolver.email}
                {f.resolved_at && ` · ${new Date(f.resolved_at).toLocaleString()}`}
              </p>
            </section>
          )}
        </div>

        <FindingActionsCard
          findingId={f.id}
          inspectionId={inspectionId}
          status={f.status}
          canResolve={canResolve}
          canEscalate={canEscalate}
        />
      </div>
    </div>
  );
}
