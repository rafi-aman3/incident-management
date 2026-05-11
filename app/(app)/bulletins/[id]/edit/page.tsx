import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { BulletinComposer } from "@/components/bulletins/bulletin-composer";

type Params = Promise<{ id: string }>;

export default async function EditBulletinPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, user, currentSiteId } = await requireUser();
  if (!(await can("bulletin:create", currentSiteId))) {
    redirect(`/bulletins/${id}`);
  }
  const canPublish = await can("bulletin:publish", currentSiteId);

  const { data: row } = await supabase
    .from("safety_bulletins")
    .select("id, title, summary, body, status, created_by")
    .eq("id", id)
    .single();
  if (!row) notFound();

  // Only the author can edit their own draft. Published / archived rows are
  // read-only via this page (publish/unpublish/archive are toggles on the
  // detail page; edits to a published bulletin require unpublishing first).
  if (row.status !== "draft" || row.created_by !== user.id) {
    redirect(`/bulletins/${id}`);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/bulletins/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to bulletin
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Edit draft</h1>
      </div>

      <BulletinComposer
        mode="edit"
        id={row.id as string}
        canPublish={canPublish}
        initialTitle={row.title as string}
        initialSummary={(row.summary as string | null) ?? null}
        initialBody={(row.body as string) ?? ""}
      />
    </div>
  );
}
