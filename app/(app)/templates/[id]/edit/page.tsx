import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { TemplateEditor } from "@/components/templates/editor/template-editor";
import { createNewDraftFromCurrent } from "./actions";
import type {
  TemplateNodeItem,
  TemplateData,
  TemplateStatus,
} from "@/lib/templates/types";

type Params = Promise<{ id: string }>;

export default async function TemplateEditPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const canEdit = await orgCan("template:edit");
  const canPublish = await orgCan("template:publish");

  if (!canEdit) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to edit templates.
      </div>
    );
  }

  // Fetch the template + its current_version + the draft version (if any)
  const { data: tmpl, error } = await supabase
    .from("templates")
    .select(
      `id, name, description, status, current_version_id, is_system_preset`
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !tmpl) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Template not found, or you don&apos;t have access.
      </div>
    );
  }
  if (tmpl.is_system_preset) {
    redirect(`/templates/browse/${id}`);
  }

  // Find or create a draft version
  let draftVersionId: string | null = null;
  let draftVersionNumber: number = 1;

  const { data: existingDraft } = await supabase
    .from("template_versions")
    .select("id, version_number")
    .eq("template_id", id)
    .eq("status", "draft")
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingDraft) {
    draftVersionId = existingDraft.id;
    draftVersionNumber = existingDraft.version_number;
  } else if (tmpl.current_version_id) {
    // Auto-create a new draft cloned from current_version
    const res = await createNewDraftFromCurrent(id);
    if (!res.ok) {
      return (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-destructive">
          Failed to create draft version: {res.error}
        </div>
      );
    }
    draftVersionId = res.data!.draft_version_id;

    // Fetch the new draft's version_number
    const { data: nd } = await supabase
      .from("template_versions")
      .select("version_number")
      .eq("id", draftVersionId)
      .single();
    draftVersionNumber = nd?.version_number ?? 1;
  } else {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-destructive">
        Template has no current version. This shouldn&apos;t happen — try recreating it.
      </div>
    );
  }

  // Fetch the draft's content
  const { data: ver, error: vErr } = await supabase
    .from("template_versions")
    .select("header, items, template_data")
    .eq("id", draftVersionId)
    .single();
  if (vErr || !ver) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-destructive">
        Draft version content unavailable.
      </div>
    );
  }

  // Fetch the currently-published baseline (if any). The draft was cloned
  // from this version; we pass its content to the editor so the publish
  // dialog can compute a one-line diff suggestion. When the template has
  // never been published, baseline is null and the dialog falls back to
  // "Initial version of <name>".
  let publishedHeader: TemplateNodeItem[] | null = null;
  let publishedItems: TemplateNodeItem[] | null = null;
  if (tmpl.current_version_id && tmpl.current_version_id !== draftVersionId) {
    const { data: pub } = await supabase
      .from("template_versions")
      .select("header, items")
      .eq("id", tmpl.current_version_id)
      .maybeSingle();
    if (pub) {
      publishedHeader = (pub.header ?? []) as unknown as TemplateNodeItem[];
      publishedItems = (pub.items ?? []) as unknown as TemplateNodeItem[];
    }
  }

  return (
    <TemplateEditor
      templateId={tmpl.id}
      templateName={tmpl.name}
      templateDescription={tmpl.description}
      templateStatus={tmpl.status as TemplateStatus}
      draftVersionId={draftVersionId}
      draftVersionNumber={draftVersionNumber}
      initialHeader={(ver.header ?? []) as unknown as TemplateNodeItem[]}
      initialItems={(ver.items ?? []) as unknown as TemplateNodeItem[]}
      initialTemplateData={
        (ver.template_data ?? { answer_sets: {} }) as unknown as TemplateData
      }
      publishedHeader={publishedHeader}
      publishedItems={publishedItems}
      canPublish={canPublish}
    />
  );
}
