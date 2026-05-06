import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { DOCUMENT_TYPES, type DocumentType } from "@/lib/documents/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewDocumentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { profile, memberships } = await requireUser();

  const canUpload = await orgCan("document:upload");
  if (!canUpload) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <BackLink />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have permission to upload documents.
        </div>
      </div>
    );
  }

  const defaultType =
    typeof sp.type === "string" &&
    (DOCUMENT_TYPES as readonly string[]).includes(sp.type)
      ? (sp.type as DocumentType)
      : undefined;

  const sites = memberships
    .map((m) => m.site)
    .filter((s): s is NonNullable<typeof s> => s != null)
    .map((s) => ({ id: s.id, name: s.name }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink />
      <div>
        <h1 className="text-2xl font-semibold">Upload document</h1>
        <p className="text-sm text-muted-foreground">
          Files live in the org library and can be linked from incidents,
          investigations, CAPAs, assets, and inspections.
        </p>
      </div>

      <DocumentUploadForm
        orgId={profile.org_id}
        sites={sites}
        defaultType={defaultType}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/resources/documents"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-3 w-3" /> Back to documents
    </Link>
  );
}
