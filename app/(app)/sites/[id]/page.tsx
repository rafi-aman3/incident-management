import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Construction } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";

type Params = Promise<{ id: string }>;

export default async function SiteDashboardPage({ params }: { params: Params }) {
  const { id: siteId } = await params;
  const { supabase, profile } = await requireUser();

  const { data: site } = await supabase
    .from("sites")
    .select("id, name, org_id, setup_completed_at")
    .eq("id", siteId)
    .maybeSingle();

  if (!site || site.org_id !== profile.org_id) notFound();

  const canRead = await can("incident:read_site", siteId);
  if (!canRead) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to org dashboard
        </Link>
        <p className="mt-2 text-xs uppercase tracking-wide text-muted-foreground">
          Site dashboard
        </p>
        <h1 className="text-2xl font-semibold">{site.name}</h1>
        {!site.setup_completed_at && (
          <p className="text-sm text-amber-700 dark:text-amber-300">
            Site setup not yet finished.{" "}
            <Link href="/admin/site-setup" className="font-medium underline">
              Finish setup →
            </Link>
          </p>
        )}
      </div>

      <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center">
        <Construction className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
        <h2 className="mt-3 text-base font-semibold">Site dashboard coming in Phase 19f</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Soon you&apos;ll see this site&apos;s KPIs, recent incidents, module tiles,
          and Argus signals on this page.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link
            href="/incidents"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            View incidents →
          </Link>
          <Link
            href="/inspections"
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            View inspections →
          </Link>
          <Link
            href={`/admin/sites/${siteId}`}
            className="inline-flex items-center rounded-md border bg-card px-3 py-1.5 text-xs font-medium hover:bg-accent"
          >
            Manage site →
          </Link>
        </div>
      </div>
    </div>
  );
}
