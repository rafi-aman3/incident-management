import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Pencil,
} from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { cn } from "@/lib/utils";
import {
  ASSET_KIND_LABEL,
  DOCUMENT_TYPE_LABEL,
  type AssetCondition,
  type AssetKind,
  type AssetStatus,
  type DocumentType,
} from "@/lib/documents/types";
import {
  AssetConditionPill,
  AssetKindChip,
  AssetStatusBadge,
} from "@/components/assets/badges";
import { AssetActions } from "@/components/assets/asset-actions";
import { DocumentLinkPicker } from "@/components/documents/document-link-picker";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const TABS = ["overview", "incidents", "inspections", "documents"] as const;
type TabKey = (typeof TABS)[number];

export default async function AssetDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const tab: TabKey =
    typeof sp.tab === "string" && (TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as TabKey)
      : "overview";

  const { supabase, profile } = await requireUser();

  const { data: asset, error } = await supabase
    .from("assets")
    .select(
      `id, ref_code, name, kind, site_id, location, condition, status,
       last_inspected_at, next_pm_at, sds_document_id, notes, created_at,
       site:sites!inner(id, name),
       sds:sds_document_id(id, name, type, file_name)`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-destructive">
        {error.message}
      </div>
    );
  }
  if (!asset) notFound();

  const site = Array.isArray(asset.site) ? asset.site[0] : asset.site;
  const sdsRaw = Array.isArray(asset.sds) ? asset.sds[0] : asset.sds;

  const [canEdit, canLink] = await Promise.all([
    can("asset:edit", asset.site_id),
    can("document_link:create", asset.site_id), // gate on the org-wide perm via team / site role
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link
          href="/resources/assets"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to assets
        </Link>
        {canEdit && (
          <Link
            href={`/resources/assets/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            <Pencil className="h-3 w-3" /> Edit
          </Link>
        )}
      </div>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-xs uppercase tracking-wide text-muted-foreground">
            {asset.ref_code}
          </p>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Boxes className="h-6 w-6 text-muted-foreground" />
            {asset.name}
            <AssetStatusBadge status={asset.status as AssetStatus} />
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <AssetKindChip kind={asset.kind as AssetKind} />
            <span>·</span>
            <span>{site?.name ?? "(unknown site)"}</span>
            {asset.location && (
              <>
                <span>·</span>
                <span>{asset.location}</span>
              </>
            )}
          </div>
        </div>

        <AssetActions
          assetId={asset.id}
          condition={asset.condition as AssetCondition}
          canEdit={canEdit}
        />
      </header>

      <Tabs current={tab} assetId={asset.id} />

      {tab === "overview" && (
        <div
          role="tabpanel"
          id="asset-panel-overview"
          aria-labelledby="asset-tab-overview"
        >
          <OverviewTab
            condition={asset.condition as AssetCondition}
            location={asset.location}
            lastInspected={asset.last_inspected_at}
            nextPm={asset.next_pm_at}
            notes={asset.notes}
            sds={
              sdsRaw
                ? {
                    id: sdsRaw.id,
                    name: sdsRaw.name,
                    type: sdsRaw.type as DocumentType,
                    file_name: sdsRaw.file_name,
                  }
                : null
            }
          />
        </div>
      )}

      {tab === "incidents" && (
        <div
          role="tabpanel"
          id="asset-panel-incidents"
          aria-labelledby="asset-tab-incidents"
        >
          <IncidentsTab assetId={asset.id} orgId={profile.org_id} />
        </div>
      )}
      {tab === "inspections" && (
        <div
          role="tabpanel"
          id="asset-panel-inspections"
          aria-labelledby="asset-tab-inspections"
        >
          <InspectionsTab siteId={asset.site_id} kind={asset.kind as AssetKind} />
        </div>
      )}
      {tab === "documents" && (
        <div
          role="tabpanel"
          id="asset-panel-documents"
          aria-labelledby="asset-tab-documents"
        >
          <DocumentsTab
            assetId={asset.id}
            orgId={profile.org_id}
            sds={sdsRaw}
            canLink={canLink}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
function TabError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}

function Tabs({ current, assetId }: { current: TabKey; assetId: string }) {
  return (
    <nav
      role="tablist"
      aria-label="Asset detail sections"
      className="flex flex-wrap gap-1 border-b text-sm"
    >
      {TABS.map((key) => {
        const active = current === key;
        const href =
          key === "overview"
            ? `/resources/assets/${assetId}`
            : `/resources/assets/${assetId}?tab=${key}`;
        return (
          <Link
            key={key}
            href={href}
            role="tab"
            id={`asset-tab-${key}`}
            aria-selected={active}
            aria-controls={`asset-panel-${key}`}
            tabIndex={active ? 0 : -1}
            className={cn(
              "border-b-2 px-3 py-2 font-medium capitalize transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {key}
          </Link>
        );
      })}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Overview tab
// ---------------------------------------------------------------------------
function OverviewTab({
  condition,
  location,
  lastInspected,
  nextPm,
  notes,
  sds,
}: {
  condition: AssetCondition;
  location: string | null;
  lastInspected: string | null;
  nextPm: string | null;
  notes: string | null;
  sds: { id: string; name: string; type: DocumentType; file_name: string } | null;
}) {
  const overdue = nextPm != null && new Date(nextPm).getTime() < Date.now();
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card title="Condition">
        <AssetConditionPill condition={condition} />
      </Card>
      <Card title="Location">
        <p className="text-sm">{location ?? "—"}</p>
      </Card>
      <Card title="Last inspected">
        <p className="text-sm">
          {lastInspected ? new Date(lastInspected).toLocaleDateString() : "Never"}
        </p>
      </Card>
      <Card title="Next preventive maintenance">
        <p
          className={cn(
            "text-sm",
            overdue && "font-medium text-destructive",
          )}
        >
          {nextPm ? (
            <>
              {new Date(nextPm).toLocaleDateString()}
              {overdue && (
                <span className="ml-1 inline-flex items-center gap-0.5">
                  <AlertCircle className="h-3 w-3" /> overdue
                </span>
              )}
            </>
          ) : (
            "Not scheduled"
          )}
        </p>
      </Card>
      <Card title="Linked SDS" className="md:col-span-2">
        {sds ? (
          <Link
            href={`/resources/documents/${sds.id}`}
            className="inline-flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm hover:bg-accent"
          >
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{sds.name}</span>
            <span className="text-xs text-muted-foreground">
              · {DOCUMENT_TYPE_LABEL[sds.type]}
            </span>
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            No SDS linked. Edit the asset to attach one.
          </p>
        )}
      </Card>
      {notes && (
        <Card title="Notes" className="md:col-span-2">
          <p className="whitespace-pre-wrap text-sm">{notes}</p>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Incidents tab
// ---------------------------------------------------------------------------
async function IncidentsTab({ assetId, orgId }: { assetId: string; orgId: string }) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("incidents")
    .select(
      "id, ref_code, title, type, severity, occurred_at, status, deleted_at"
    )
    .eq("equipment_asset_id", assetId)
    .eq("org_id", orgId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error) {
    return <TabError message={error.message} />;
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No incidents linked to this asset yet.
      </div>
    );
  }
  return (
    <ul className="divide-y rounded-md border">
      {data.map((inc) => (
        <li key={inc.id}>
          <Link
            href={`/incidents/${inc.id}`}
            className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {inc.ref_code}
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {inc.title}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {inc.type.replace("_", " ")}
            </span>
            <span className="text-xs text-muted-foreground">
              {new Date(inc.occurred_at).toLocaleDateString()}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Inspections tab — best-effort: lists completed inspections at this site
// whose template's industry could plausibly cover this asset kind. v1
// keeps the join loose; explicit asset↔inspection associations land in
// v2 (inspection-time asset picker).
// ---------------------------------------------------------------------------
async function InspectionsTab({
  siteId,
  kind,
}: {
  siteId: string;
  kind: AssetKind;
}) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase
    .from("inspections")
    .select(
      `id, ref_code, title, status, conducted_at, is_failed,
       template:templates ( name, industry )`
    )
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .order("conducted_at", { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) {
    return <TabError message={error.message} />;
  }
  if (!data || data.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No inspections recorded at this site yet.
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Recent inspections at this site. Asset-specific inspections become
        explicit in v2 — for now, the list is filtered by site.
      </p>
      <ul className="divide-y rounded-md border">
        {data.map((insp) => {
          const tmpl = Array.isArray(insp.template) ? insp.template[0] : insp.template;
          return (
            <li key={insp.id}>
              <Link
                href={`/inspections/${insp.id}`}
                className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent"
              >
                <ClipboardCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-mono text-xs text-muted-foreground">
                  {insp.ref_code}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {insp.title}
                </span>
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  {tmpl?.name ?? "—"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {insp.conducted_at
                    ? new Date(insp.conducted_at).toLocaleDateString()
                    : "—"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Filtered to site (kind hint: {ASSET_KIND_LABEL[kind]}).
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documents tab — surfaces the SDS denormalized FK plus document_links
// rows where parent_type='asset' AND parent_id=this.
// ---------------------------------------------------------------------------
async function DocumentsTab({
  assetId,
  orgId,
  sds,
  canLink,
}: {
  assetId: string;
  orgId: string;
  sds: { id: string; name: string; type: string; file_name: string } | null;
  canLink: boolean;
}) {
  const { supabase } = await requireUser();
  const { data: links, error } = await supabase
    .from("document_links")
    .select(
      `id, link_role, created_at,
       document:documents ( id, name, type, file_name, archived_at )`
    )
    .eq("parent_type", "asset")
    .eq("parent_id", assetId)
    .is("removed_at", null)
    .order("created_at", { ascending: false });
  if (error) {
    return <TabError message={error.message} />;
  }

  type LinkRow = {
    id: string;
    link_role: string | null;
    created_at: string;
    document:
      | { id: string; name: string; type: DocumentType; file_name: string; archived_at: string | null }
      | { id: string; name: string; type: DocumentType; file_name: string; archived_at: string | null }[]
      | null;
  };
  const linkRows: LinkRow[] = (links ?? []) as LinkRow[];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {sds || linkRows.length > 0
            ? `${linkRows.length + (sds ? 1 : 0)} linked document${linkRows.length + (sds ? 1 : 0) === 1 ? "" : "s"}`
            : "No documents linked yet."}
        </p>
        {canLink && (
          <DocumentLinkPicker
            parentType="asset"
            parentId={assetId}
            orgId={orgId}
            defaultLinkRole="attachment"
          />
        )}
      </div>

      <ul className="divide-y rounded-md border">
        {sds && (
          <li className="flex items-center gap-3 px-3 py-2.5">
            <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <Link
              href={`/resources/documents/${sds.id}`}
              className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
            >
              {sds.name}
            </Link>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              SDS · pinned
            </span>
          </li>
        )}
        {linkRows.map((row) => {
          const doc = Array.isArray(row.document) ? row.document[0] : row.document;
          if (!doc) return null;
          return (
            <li key={row.id} className="flex items-center gap-3 px-3 py-2.5">
              <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <Link
                href={`/resources/documents/${doc.id}`}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline"
              >
                {doc.name}
              </Link>
              <span className="text-xs text-muted-foreground">
                {DOCUMENT_TYPE_LABEL[doc.type]}
                {row.link_role ? ` · ${row.link_role}` : ""}
              </span>
            </li>
          );
        })}
        {!sds && linkRows.length === 0 && (
          <li className="px-3 py-12 text-center text-sm text-muted-foreground">
            <ClipboardList className="mx-auto mb-2 h-5 w-5 opacity-60" />
            Use &ldquo;Add document&rdquo; to attach an SDS, maintenance log, or
            inspection record.
          </li>
        )}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card primitive (local — keeps the page self-contained)
// ---------------------------------------------------------------------------
function Card({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-md border bg-card p-4", className)}>
      <p className="mb-1.5 flex items-center gap-1 text-[11px] uppercase tracking-wide text-muted-foreground">
        <Calendar className="h-3 w-3" /> {title}
      </p>
      {children}
    </div>
  );
}
