import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { AssetForm, type AssetFormDefaults } from "@/components/assets/asset-form";
import type {
  AssetCondition,
  AssetKind,
  AssetStatus,
} from "@/lib/documents/types";

type Params = Promise<{ id: string }>;

export default async function EditAssetPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, memberships } = await requireUser();

  const { data: asset, error } = await supabase
    .from("assets")
    .select(
      `id, name, kind, site_id, location, condition, status,
       last_inspected_at, next_pm_at, sds_document_id, notes,
       sds:sds_document_id(name)`
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

  if (!(await can("asset:edit", asset.site_id))) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to edit this asset.
      </div>
    );
  }

  // Sites the user can move the asset to (must hold asset:edit on the
  // target site too — the server action re-checks).
  const allowed: { id: string; name: string }[] = [];
  for (const m of memberships) {
    if (m.site && (await can("asset:edit", m.site_id))) {
      allowed.push({ id: m.site.id, name: m.site.name });
    }
  }
  allowed.sort((a, b) => a.name.localeCompare(b.name));

  const sds = Array.isArray(asset.sds) ? asset.sds[0] : asset.sds;
  const defaults: AssetFormDefaults = {
    id: asset.id,
    name: asset.name,
    kind: asset.kind as AssetKind,
    site_id: asset.site_id,
    location: asset.location,
    condition: asset.condition as AssetCondition,
    status: asset.status as AssetStatus,
    last_inspected_at: asset.last_inspected_at,
    next_pm_at: asset.next_pm_at,
    sds_document_id: asset.sds_document_id,
    sds_document_label: sds?.name ?? null,
    notes: asset.notes,
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href={`/resources/assets/${id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to {asset.name}
      </Link>
      <div>
        <h1 className="text-2xl font-semibold">Edit asset</h1>
        <p className="text-sm text-muted-foreground">
          Updates take effect immediately. Past inspections that referenced
          this asset stay linked.
        </p>
      </div>

      <AssetForm
        defaults={defaults}
        sites={allowed}
        cancelHref={`/resources/assets/${id}`}
      />
    </div>
  );
}
