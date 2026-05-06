import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { AssetForm } from "@/components/assets/asset-form";

export default async function NewAssetPage() {
  const { memberships } = await requireUser();

  // Only sites where the user can create assets
  const allowed: { id: string; name: string }[] = [];
  for (const m of memberships) {
    if (m.site && (await can("asset:create", m.site_id))) {
      allowed.push({ id: m.site.id, name: m.site.name });
    }
  }
  allowed.sort((a, b) => a.name.localeCompare(b.name));

  if (allowed.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <BackLink />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to create assets at any of your sites.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold">New asset</h1>
        <p className="text-sm text-muted-foreground">
          Register equipment, machinery, or safety gear so it can be inspected,
          referenced from incidents, and linked to its SDS.
        </p>
      </div>

      <AssetForm sites={allowed} cancelHref="/resources/assets" />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/resources/assets"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-3 w-3" /> Back to assets
    </Link>
  );
}
