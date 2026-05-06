import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History, MapPinned, Pencil } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import {
  TemplateStatusBadge,
  IndustryChip,
  VersionBadge,
} from "@/components/templates/badges";
import { InfoTooltip } from "@/components/info-tooltip";
import { ChecklistPreview } from "@/components/templates/checklist-preview";
import type {
  TemplateNodeItem,
  TemplateData,
  TemplateStatus,
} from "@/lib/templates/types";
import type { IndustryEnum } from "@/lib/templates/industry-map";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type VersionRow = {
  id: string;
  version_number: number;
  status: TemplateStatus;
  change_summary: string | null;
  published_at: string | null;
  published_by: { full_name: string | null; email: string } | null;
};

export default async function TemplateViewerPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const canRead = await orgCan("template:read_org");
  const canEdit = await orgCan("template:edit");
  const canAssign = await orgCan("template:assign");
  if (!canRead) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have access to this template.
      </div>
    );
  }

  const { data: tmpl, error } = await supabase
    .from("templates")
    .select(
      `id, name, description, industry, status, current_version_id,
       is_system_preset`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !tmpl) notFound();

  const { data: versions } = await supabase
    .from("template_versions")
    .select(
      `id, version_number, status, change_summary, published_at,
       published_by:published_by ( full_name, email )`
    )
    .eq("template_id", id)
    .order("version_number", { ascending: false })
    .returns<VersionRow[]>();

  const versionList = versions ?? [];

  // Pick the version to render
  const requestedVersion =
    typeof sp.version === "string" ? Number(sp.version) : null;
  const selectedVersion =
    (requestedVersion
      ? versionList.find((v) => v.version_number === requestedVersion)
      : versionList.find((v) => v.id === tmpl.current_version_id)) ??
    versionList[0] ??
    null;

  let header: TemplateNodeItem[] = [];
  let items: TemplateNodeItem[] = [];
  let templateData: TemplateData = { answer_sets: {}, condition_sets: [] };
  if (selectedVersion) {
    const { data: ver } = await supabase
      .from("template_versions")
      .select("header, items, template_data")
      .eq("id", selectedVersion.id)
      .single();
    if (ver) {
      header = (ver.header ?? []) as unknown as TemplateNodeItem[];
      items = (ver.items ?? []) as unknown as TemplateNodeItem[];
      templateData = (ver.template_data ?? {
        answer_sets: {},
      }) as unknown as TemplateData;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/templates"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to templates
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{tmpl.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TemplateStatusBadge status={tmpl.status as TemplateStatus} />
            <IndustryChip industry={tmpl.industry as IndustryEnum} />
            {selectedVersion && (
              <VersionBadge versionNumber={selectedVersion.version_number} />
            )}
          </div>
          {tmpl.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {tmpl.description}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canAssign && !tmpl.is_system_preset && tmpl.status === "published" && (
            <Link
              href={`/templates/${tmpl.id}/assign`}
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <MapPinned className="h-4 w-4" /> Assign
            </Link>
          )}
          {canEdit && !tmpl.is_system_preset && (
            <Link
              href={`/templates/${tmpl.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Pencil className="h-4 w-4" /> Edit
            </Link>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        {/* Read-only checklist preview */}
        <div className="space-y-4">
          {!selectedVersion ? (
            <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              No published version yet. Edit the draft to add items, then publish.
            </div>
          ) : (
            <ChecklistPreview
              header={header}
              items={items}
              templateData={templateData}
            />
          )}
        </div>

        {/* Versions panel */}
        <aside className="rounded-lg border bg-card">
          <div className="flex items-center gap-2 border-b px-4 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Versions</h2>
            <InfoTooltip tip="template_versions_audit" />
          </div>
          <ul className="divide-y">
            {versionList.length === 0 && (
              <li className="px-4 py-3 text-sm text-muted-foreground">
                No versions yet.
              </li>
            )}
            {versionList.map((v) => (
              <li
                key={v.id}
                className={
                  selectedVersion?.id === v.id ? "bg-primary/5" : undefined
                }
              >
                <Link
                  href={`/templates/${tmpl.id}?version=${v.version_number}`}
                  className="block px-4 py-3 hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <VersionBadge versionNumber={v.version_number} />
                      <TemplateStatusBadge status={v.status} showDot={false} />
                    </div>
                    {v.published_at && (
                      <span className="text-[11px] text-muted-foreground tabular-nums">
                        {new Date(v.published_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {v.change_summary && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {v.change_summary}
                    </p>
                  )}
                  {v.published_by && (
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      by{" "}
                      {v.published_by.full_name ?? v.published_by.email}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
