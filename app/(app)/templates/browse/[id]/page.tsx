import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { ChecklistPreview } from "@/components/templates/checklist-preview";
import {
  TemplateStatusBadge,
  IndustryChip,
  FeaturedChip,
} from "@/components/templates/badges";
import { ImportPresetButton } from "@/components/templates/import-preset-button";
import type { TemplateNodeItem, TemplateData } from "@/lib/templates/types";
import type { IndustryEnum } from "@/lib/templates/industry-map";

type Params = Promise<{ id: string }>;

export default async function PresetPreviewPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase } = await requireUser();

  const canRead = await orgCan("template:read_org");
  const canImport = await orgCan("template:create");
  if (!canRead) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have access to the template library.
      </div>
    );
  }

  const { data: preset, error } = await supabase
    .from("templates")
    .select(
      `id, name, description, industry, is_featured,
       current_version:current_version_id ( header, items, template_data )`
    )
    .eq("id", id)
    .eq("is_system_preset", true)
    .maybeSingle();

  if (error || !preset) notFound();

  const cv = Array.isArray(preset.current_version)
    ? preset.current_version[0]
    : preset.current_version;

  const header = ((cv?.header as unknown) ?? []) as TemplateNodeItem[];
  const items = ((cv?.items as unknown) ?? []) as TemplateNodeItem[];
  const templateData = ((cv?.template_data as unknown) ?? {
    answer_sets: {},
  }) as TemplateData;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/templates/browse"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to library
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{preset.name}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <TemplateStatusBadge status="published" />
            <IndustryChip industry={preset.industry as IndustryEnum} />
            {preset.is_featured && <FeaturedChip />}
          </div>
          {preset.description && (
            <p className="max-w-2xl text-sm text-muted-foreground">
              {preset.description}
            </p>
          )}
        </div>
        {canImport && <ImportPresetButton presetId={preset.id} />}
      </div>

      <ChecklistPreview header={header} items={items} templateData={templateData} />
    </div>
  );
}
