import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  ClipboardCheck,
  ClipboardList,
  ClipboardSignature,
  FileText,
  ListChecks,
  AlertOctagon,
  Boxes,
  MapPin,
} from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { cn } from "@/lib/utils";
import {
  DOCUMENT_TYPE_ICON,
  DOCUMENT_TYPE_LABEL,
  type DocumentLinkParent,
  type DocumentType,
} from "@/lib/documents/types";
import {
  DocumentArchivedBadge,
  DocumentExpiryPill,
  DocumentTypeChip,
} from "@/components/documents/badges";
import { DocumentDetailActions } from "@/components/documents/document-detail-actions";
import { FilePreview } from "@/components/documents/file-preview";

type Params = Promise<{ id: string }>;

const PARENT_ICON: Record<DocumentLinkParent, React.ComponentType<{ className?: string }>> = {
  incident:      AlertOctagon,
  investigation: ClipboardList,
  capa:          ListChecks,
  asset:         Boxes,
  site:          MapPin,
  inspection:    ClipboardCheck,
  finding:       ClipboardSignature,
};

const PARENT_LABEL: Record<DocumentLinkParent, string> = {
  incident:      "Incidents",
  investigation: "Investigations",
  capa:          "CAPAs",
  asset:         "Assets",
  site:          "Sites",
  inspection:    "Inspections",
  finding:       "Findings",
};

export default async function DocumentDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, profile, memberships } = await requireUser();

  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      `id, name, type, storage_path, file_name, mime_type, size_bytes,
       expiry_date, notes, site_id, uploaded_by, uploaded_at, updated_at,
       archived_at, archived_reason,
       site:sites(id, name),
       uploader:profiles!uploaded_by(full_name, email)`
    )
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .maybeSingle();
  if (error) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-destructive">
        {error.message}
      </div>
    );
  }
  if (!doc) notFound();

  const site = Array.isArray(doc.site) ? doc.site[0] : doc.site;
  const uploader = Array.isArray(doc.uploader) ? doc.uploader[0] : doc.uploader;
  const isArchived = !!doc.archived_at;

  // Bulk link list — pull all active links plus enough info to render
  // a parent-record row per type. We resolve labels in a second pass per
  // parent_type below to keep the join shape simple.
  const { data: linkRows } = await supabase
    .from("document_links")
    .select("id, parent_type, parent_id, link_role, created_at")
    .eq("document_id", id)
    .is("removed_at", null)
    .order("created_at", { ascending: false });

  type LinkBucket = {
    parentType: DocumentLinkParent;
    rows: { id: string; parent_id: string; link_role: string | null; label: string; href: string }[];
  };
  const buckets = Object.fromEntries(
    (Object.keys(PARENT_LABEL) as DocumentLinkParent[]).map((k) => [
      k,
      { parentType: k, rows: [] as LinkBucket["rows"] },
    ]),
  ) as Record<DocumentLinkParent, LinkBucket>;

  const grouped = (linkRows ?? []).reduce<Record<DocumentLinkParent, typeof linkRows>>(
    (acc, r) => {
      const k = r.parent_type as DocumentLinkParent;
      if (!acc[k]) acc[k] = [] as unknown as typeof linkRows;
      (acc[k] as unknown[] as typeof linkRows)!.push(r);
      return acc;
    },
    {} as Record<DocumentLinkParent, typeof linkRows>,
  );

  // Per-parent label fetches — small, RLS-scoped queries run in parallel
  // so cold-load on a heavily-linked document doesn't pay 7× round-trip
  // latency for what's effectively independent reads.
  type LabelMap = Record<string, { label: string; href: string }>;
  type LabelResult = { parentType: DocumentLinkParent; labels: LabelMap };

  // Supabase's PostgrestBuilder returns `PromiseLike`, not `Promise`, so we
  // type the queue accordingly. `Promise.all` accepts both.
  const labelFetchers: PromiseLike<LabelResult>[] = [];
  for (const [parentType, rows] of Object.entries(grouped) as [
    DocumentLinkParent,
    typeof linkRows,
  ][]) {
    if (!rows || rows.length === 0) continue;
    const ids = rows.map((r) => r.parent_id);

    if (parentType === "incident") {
      labelFetchers.push(
        supabase
          .from("incidents")
          .select("id, ref_code, title")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                {
                  label: `${row.ref_code} · ${row.title}`,
                  href: `/incidents/${row.id}`,
                },
              ]),
            ),
          })),
      );
    } else if (parentType === "investigation") {
      labelFetchers.push(
        supabase
          .from("investigations")
          .select("id, ref_code, incident:incidents(title)")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => {
                const inc = Array.isArray(row.incident)
                  ? row.incident[0]
                  : row.incident;
                return [
                  row.id,
                  {
                    label: `${row.ref_code}${inc?.title ? ` · ${inc.title}` : ""}`,
                    href: `/investigations/${row.id}`,
                  },
                ];
              }),
            ),
          })),
      );
    } else if (parentType === "capa") {
      labelFetchers.push(
        supabase
          .from("capas")
          .select("id, ref_code, title")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                {
                  label: `${row.ref_code} · ${row.title}`,
                  href: `/capa/${row.id}`,
                },
              ]),
            ),
          })),
      );
    } else if (parentType === "asset") {
      labelFetchers.push(
        supabase
          .from("assets")
          .select("id, ref_code, name")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                {
                  label: `${row.ref_code} · ${row.name}`,
                  href: `/resources/assets/${row.id}`,
                },
              ]),
            ),
          })),
      );
    } else if (parentType === "site") {
      labelFetchers.push(
        supabase
          .from("sites")
          .select("id, name")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                { label: row.name, href: `/admin/sites/${row.id}` },
              ]),
            ),
          })),
      );
    } else if (parentType === "inspection") {
      labelFetchers.push(
        supabase
          .from("inspections")
          .select("id, ref_code, title")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                {
                  label: `${row.ref_code} · ${row.title}`,
                  href: `/inspections/${row.id}`,
                },
              ]),
            ),
          })),
      );
    } else if (parentType === "finding") {
      labelFetchers.push(
        supabase
          .from("inspection_findings")
          .select("id, ref_code, item_label, inspection_id")
          .in("id", ids)
          .then(({ data }) => ({
            parentType,
            labels: Object.fromEntries(
              (data ?? []).map((row) => [
                row.id,
                {
                  label: `${row.ref_code} · ${row.item_label}`,
                  href: `/inspections/${row.inspection_id}/findings/${row.id}`,
                },
              ]),
            ),
          })),
      );
    }
  }

  const labelResults = await Promise.all(labelFetchers);
  const labelsByType = Object.fromEntries(
    labelResults.map((r) => [r.parentType, r.labels]),
  ) as Record<DocumentLinkParent, LabelMap>;

  for (const [parentType, rows] of Object.entries(grouped) as [
    DocumentLinkParent,
    typeof linkRows,
  ][]) {
    if (!rows || rows.length === 0) continue;
    const labels = labelsByType[parentType] ?? {};
    buckets[parentType].rows = rows.map((r) => ({
      id: r.id,
      parent_id: r.parent_id,
      link_role: r.link_role,
      label: labels[r.parent_id]?.label ?? "(removed or no access)",
      href: labels[r.parent_id]?.href ?? "#",
    }));
  }

  const totalLinks = Object.values(buckets).reduce(
    (sum, b) => sum + b.rows.length,
    0,
  );

  // Permissions
  const [canEditMetadata, canArchive] = await Promise.all([
    orgCan("document:edit_metadata"),
    orgCan("document:archive"),
  ]);

  const sites = memberships
    .map((m) => m.site)
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const Icon = DOCUMENT_TYPE_ICON[doc.type as DocumentType];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/resources/documents"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to documents
        </Link>
        {!isArchived && (
          <DocumentDetailActions
            documentId={doc.id}
            orgId={profile.org_id}
            initial={{
              name: doc.name,
              type: doc.type as DocumentType,
              site_id: doc.site_id,
              expiry_date: doc.expiry_date,
              notes: doc.notes,
            }}
            sites={sites}
            activeLinkCount={totalLinks}
            canEditMetadata={canEditMetadata}
            canArchive={canArchive}
          />
        )}
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{doc.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <DocumentTypeChip type={doc.type as DocumentType} />
              <span>{site?.name ?? "Org-wide"}</span>
              <span>·</span>
              <span>{doc.file_name}</span>
              <span>·</span>
              <span>{(doc.size_bytes / 1024).toFixed(0)} KB</span>
              <DocumentExpiryPill expiry={doc.expiry_date} />
              {isArchived && <DocumentArchivedBadge />}
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Uploaded by{" "}
              <span className="text-foreground">
                {uploader?.full_name ?? uploader?.email ?? "Unknown"}
              </span>{" "}
              on {new Date(doc.uploaded_at).toLocaleDateString()}
              {doc.updated_at && doc.updated_at !== doc.uploaded_at && (
                <> · updated {new Date(doc.updated_at).toLocaleDateString()}</>
              )}
            </p>
          </div>
        </div>
      </header>

      {isArchived && (
        <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <p className="font-medium">
            <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5" />
            This document is archived.
          </p>
          {doc.archived_reason && (
            <p className="mt-1 text-xs">{doc.archived_reason}</p>
          )}
          <p className="mt-1 text-xs">
            Archived on {new Date(doc.archived_at!).toLocaleDateString()}.
            Existing links keep working — the file stays in storage to satisfy
            OSHA 5y / RIDDOR 3y retention.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <FilePreview
            storagePath={doc.storage_path}
            mimeType={doc.mime_type}
            fileName={doc.file_name}
          />
          {doc.notes && (
            <div className="mt-4 rounded-md border bg-card p-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
                Notes
              </p>
              <p className="whitespace-pre-wrap text-sm">{doc.notes}</p>
            </div>
          )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-md border bg-card p-4">
            <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
              Linked from {totalLinks} record{totalLinks === 1 ? "" : "s"}
            </p>
            {totalLinks === 0 ? (
              <div className="flex items-start gap-2 rounded-md border border-dashed px-3 py-4 text-xs text-muted-foreground">
                <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  This document hasn&apos;t been linked to any records yet. Use
                  the picker on an incident, asset, CAPA, or inspection to link
                  it.
                </span>
              </div>
            ) : (
              <ul className="space-y-3">
                {(Object.keys(PARENT_LABEL) as DocumentLinkParent[]).map(
                  (parentType) => {
                    const bucket = buckets[parentType];
                    if (bucket.rows.length === 0) return null;
                    const ParentIcon = PARENT_ICON[parentType];
                    return (
                      <li key={parentType} className="space-y-1.5">
                        <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          <ParentIcon className="h-3 w-3" />
                          {PARENT_LABEL[parentType]}
                          <span className="text-muted-foreground/70">
                            · {bucket.rows.length}
                          </span>
                        </p>
                        <ul className="space-y-1 pl-4 text-xs">
                          {bucket.rows.map((row) => (
                            <li key={row.id} className="flex items-baseline gap-2">
                              <Link
                                href={row.href}
                                className={cn(
                                  "min-w-0 truncate hover:underline",
                                  row.href === "#" &&
                                    "pointer-events-none text-muted-foreground italic",
                                )}
                              >
                                {row.label}
                              </Link>
                              {row.link_role && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                  {row.link_role}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  },
                )}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
