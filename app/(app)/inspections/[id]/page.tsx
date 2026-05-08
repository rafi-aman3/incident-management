import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ClipboardCheck, FileBarChart } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { InspectionRunner } from "@/components/inspections/runner/inspection-runner";
import { ChecklistPreview } from "@/components/templates/checklist-preview";
import {
  InspectionStatusBadge,
  FindingStatusBadge,
} from "@/components/inspections/inspection-status-badge";
import type {
  InspectionStatus,
  TemplateNodeItem,
  TemplateData,
  InspectionAnswer,
  FindingStatus,
} from "@/lib/templates/types";

type Params = Promise<{ id: string }>;

type InspectionFull = {
  id: string;
  ref_code: string;
  title: string;
  status: InspectionStatus;
  is_failed: boolean;
  conducted_at: string | null;
  completed_at: string | null;
  abandoned_at: string | null;
  abandon_reason: string | null;
  score_total: number | null;
  score_max: number | null;
  site_id: string;
  template_version_id: string;
  inspector_id: string | null;
  header_responses: Record<string, InspectionAnswer> | null;
  answers: Record<string, InspectionAnswer> | null;
  template:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  inspector:
    | { full_name: string | null; email: string }
    | { full_name: string | null; email: string }[]
    | null;
};

type FindingRow = {
  id: string;
  ref_code: string;
  item_label: string;
  failed_response_label: string | null;
  comment: string | null;
  status: FindingStatus;
  created_at: string;
  escalated_incident_id: string | null;
};

export default async function InspectionDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();

  const { data: ins, error } = await supabase
    .from("inspections")
    .select(
      `id, ref_code, title, status, is_failed, conducted_at, completed_at,
       abandoned_at, abandon_reason, score_total, score_max, site_id,
       template_version_id, inspector_id, header_responses, answers,
       template:templates ( id, name ),
       inspector:inspector_id ( full_name, email )`
    )
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle<InspectionFull>();

  if (error || !ins) notFound();

  const canRead = await can("inspection:read_site", ins.site_id);
  if (!canRead) notFound();

  // Fetch the snapshotted template_version_id
  const { data: ver } = await supabase
    .from("template_versions")
    .select("header, items, template_data")
    .eq("id", ins.template_version_id)
    .single();

  const header = ((ver?.header ?? []) as unknown) as TemplateNodeItem[];
  const items = ((ver?.items ?? []) as unknown) as TemplateNodeItem[];
  const templateData = ((ver?.template_data ?? {
    answer_sets: {},
  }) as unknown) as TemplateData;

  const tmpl = Array.isArray(ins.template) ? ins.template[0] : ins.template;
  const inspectorRow = Array.isArray(ins.inspector)
    ? ins.inspector[0]
    : ins.inspector;
  const inspectorName =
    inspectorRow?.full_name ?? inspectorRow?.email ?? profile.email;

  // RUNNER MODE — in_progress and the viewer is the inspector (or has edit_any)
  if (ins.status === "in_progress" || ins.status === "draft") {
    const canEditOwn =
      ins.inspector_id === profile.id &&
      (await can("inspection:edit_own", ins.site_id));
    const canEditAny = await can("inspection:edit_any", ins.site_id);
    if (canEditOwn || canEditAny) {
      return (
        <InspectionRunner
          inspectionId={ins.id}
          refCode={ins.ref_code}
          title={ins.title}
          inspectorName={inspectorName}
          templateName={tmpl?.name ?? "Inspection"}
          header={header}
          items={items}
          templateData={templateData}
          initialHeaderResponses={ins.header_responses ?? {}}
          initialAnswers={ins.answers ?? {}}
        />
      );
    }
    // Read-only view for users without edit perms
  }

  // REPORT / READ-ONLY MODE — completed / abandoned / read-only viewer
  const { data: findings } = await supabase
    .from("inspection_findings")
    .select(
      `id, ref_code, item_label, failed_response_label, comment, status,
       created_at, escalated_incident_id`
    )
    .eq("inspection_id", id)
    .order("created_at", { ascending: false })
    .returns<FindingRow[]>();

  const findingList = findings ?? [];

  return (
    <div className="space-y-6">
      <Link
        href="/inspections"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to inspections
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            {ins.ref_code}
          </p>
          <h1 className="text-2xl font-semibold">{ins.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <InspectionStatusBadge status={ins.status} />
            {ins.is_failed && ins.status === "completed" && (
              <span className="inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {findingList.length} finding{findingList.length === 1 ? "" : "s"}
              </span>
            )}
            {ins.score_max !== null &&
              ins.score_max > 0 &&
              ins.score_total !== null && (
                <span className="text-xs text-muted-foreground tabular-nums">
                  Score: {ins.score_total}/{ins.score_max} (
                  {Math.round((ins.score_total / ins.score_max) * 100)}%)
                </span>
              )}
          </div>
          <p className="text-xs text-muted-foreground">
            Conducted by {inspectorName}
            {ins.completed_at && ` · Completed ${new Date(ins.completed_at).toLocaleString()}`}
            {ins.abandoned_at && ` · Abandoned ${new Date(ins.abandoned_at).toLocaleString()}`}
          </p>
        </div>
      </div>

      {ins.status === "completed" && findingList.length > 0 && (
        <section
          aria-label="Findings from this inspection"
          className="rounded-lg border bg-card"
        >
          <header className="flex items-center gap-2 border-b px-4 py-3">
            <FileBarChart className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Findings</h2>
          </header>
          <ul className="divide-y">
            {findingList.map((f) => (
              <li key={f.id} className="px-4 py-3">
                <Link
                  href={`/inspections/${ins.id}/findings/${f.id}`}
                  className="block hover:bg-accent/30 -mx-4 -my-3 px-4 py-3 rounded-md"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-sm">{f.item_label}</p>
                    <FindingStatusBadge status={f.status} />
                  </div>
                  {f.failed_response_label && (
                    <p className="mt-0.5 text-xs italic text-destructive">
                      {f.failed_response_label}
                    </p>
                  )}
                  {f.comment && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {f.comment}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-lg border bg-card">
        <header className="flex items-center gap-2 border-b px-4 py-3">
          <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">
            {ins.status === "completed" || ins.status === "abandoned"
              ? "Submitted answers"
              : "Inspection items (view-only)"}
          </h2>
        </header>
        <div className="p-4">
          <ChecklistPreview
            header={header}
            items={items}
            templateData={templateData}
          />
        </div>
      </section>
    </div>
  );
}
