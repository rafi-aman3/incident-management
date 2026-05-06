import Link from "next/link";
import { Files, Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_ICON,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import {
  DocumentExpiryPill,
  DocumentTypeChip,
} from "@/components/documents/badges";
import { DocumentListFilters } from "@/components/documents/document-list-filters";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TYPE_VALUES = DOCUMENT_TYPES as readonly string[];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, memberships } = await requireUser();

  const canRead = await orgCan("document:read_org");
  const canUpload = await orgCan("document:upload");

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to documents in this org.
        </div>
      </div>
    );
  }

  // Filters
  const typeParam =
    typeof sp.type === "string" && TYPE_VALUES.includes(sp.type)
      ? (sp.type as DocumentType)
      : null;
  const siteParam = typeof sp.site === "string" ? sp.site : null;
  const expiringOnly = sp.expiring === "1";
  const view = sp.view === "table" ? "table" : "cards";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = supabase
    .from("documents")
    .select(
      `id, name, type, file_name, mime_type, size_bytes, expiry_date,
       site_id, uploaded_at, uploaded_by,
       site:sites(id, name),
       uploader:profiles!uploaded_by(full_name, email)`
    )
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (typeParam) query = query.eq("type", typeParam);
  if (siteParam === "org") query = query.is("site_id", null);
  else if (siteParam) query = query.eq("site_id", siteParam);
  if (expiringOnly) {
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30);
    query = query
      .not("expiry_date", "is", null)
      .lte("expiry_date", horizon.toISOString().slice(0, 10));
  }
  if (q) {
    const safe = q.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${safe}%,file_name.ilike.%${safe}%`);
  }

  const { data, error } = await query;

  type Joined = {
    id: string;
    name: string;
    type: DocumentType;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    expiry_date: string | null;
    site_id: string | null;
    uploaded_at: string;
    site: { id: string; name: string } | { id: string; name: string }[] | null;
    uploader:
      | { full_name: string | null; email: string }
      | { full_name: string | null; email: string }[]
      | null;
  };
  const rows = ((data ?? []) as Joined[]).map((r) => {
    const site = Array.isArray(r.site) ? r.site[0] : r.site;
    const uploader = Array.isArray(r.uploader) ? r.uploader[0] : r.uploader;
    return { ...r, site, uploader };
  });

  // Bulk fetch link counts
  const ids = rows.map((r) => r.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: links } = await supabase
      .from("document_links")
      .select("document_id")
      .in("document_id", ids)
      .is("removed_at", null);
    counts = (links ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.document_id] = (acc[row.document_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  const siteOptions = memberships
    .map((m) => m.site)
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <Header />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <DocumentListFilters sites={siteOptions} />
        {canUpload && (
          <Link
            href="/resources/documents/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> Upload
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          No documents match these filters.
          {canUpload && (
            <p className="mt-2">
              <Link
                href="/resources/documents/new"
                className="text-primary hover:underline"
              >
                Upload your first document
              </Link>
            </p>
          )}
        </div>
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => {
            const Icon = DOCUMENT_TYPE_ICON[row.type];
            const linkCount = counts[row.id] ?? 0;
            return (
              <Link
                key={row.id}
                href={`/resources/documents/${row.id}`}
                className="group flex flex-col rounded-lg border bg-card p-4 transition hover:border-primary/40 hover:shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm group-hover:text-primary">
                      {row.name}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {row.file_name} · {(row.size_bytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <DocumentTypeChip type={row.type} />
                  <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {row.site?.name ?? "Org-wide"}
                  </span>
                  <DocumentExpiryPill expiry={row.expiry_date} />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="truncate">
                    {row.uploader?.full_name ?? row.uploader?.email ?? "Unknown"}
                  </span>
                  <span>
                    Linked from {linkCount} record{linkCount === 1 ? "" : "s"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead>Expiry</TableHead>
                <TableHead className="text-right">Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-accent/40">
                  <TableCell>
                    <Link
                      href={`/resources/documents/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <div className="text-[11px] text-muted-foreground">
                      {row.file_name}
                    </div>
                  </TableCell>
                  <TableCell>
                    <DocumentTypeChip type={row.type} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {row.site?.name ?? "Org-wide"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {new Date(row.uploaded_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DocumentExpiryPill expiry={row.expiry_date} />
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                    {counts[row.id] ?? 0}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Module 4 · Resources
      </p>
      <h1 className="flex items-center gap-2 text-2xl font-semibold">
        <Files className="h-6 w-6" />
        Documents
      </h1>
      <p className="text-sm text-muted-foreground">
        Org-wide library of SDSs, SOPs, policies, training records, and
        evidence files. A single document can attach to incidents,
        investigations, CAPAs, assets, and inspections — replace the file
        once and every link points at the new version.
      </p>
    </div>
  );
}
