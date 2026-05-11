import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { BulletinComposer } from "@/components/bulletins/bulletin-composer";
import { seedBulletinFromInvestigation } from "@/lib/bulletins/seed-from-investigation";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string | null {
  if (typeof raw === "string") return raw || null;
  if (Array.isArray(raw) && raw.length > 0) return raw[0] || null;
  return null;
}

export default async function NewBulletinPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const fromInvestigation = pickFirst(sp.from_investigation);

  const { supabase, currentSiteId } = await requireUser();
  if (!(await can("bulletin:create", currentSiteId))) {
    redirect("/bulletins");
  }
  const canPublish = await can("bulletin:publish", currentSiteId);

  let initialTitle: string | undefined;
  let initialBody: string | undefined;
  let sourceIncidentId: string | undefined;
  let sourceInvestigationId: string | undefined;

  if (fromInvestigation) {
    const { data: inv } = await supabase
      .from("investigations")
      .select(
        "id, ref_code, root_cause_summary, findings, incident:incidents(id, ref_code, title, description, occurred_at, site:sites(name))",
      )
      .eq("id", fromInvestigation)
      .single();
    if (!inv) notFound();

    const incident = inv.incident as {
      id?: string;
      ref_code?: string | null;
      title?: string;
      description?: string | null;
      occurred_at?: string;
      site?: { name?: string | null } | null;
    } | null;
    if (!incident?.id) notFound();

    const seed = seedBulletinFromInvestigation({
      incident: {
        ref_code: incident.ref_code ?? null,
        title: incident.title ?? "",
        description: incident.description ?? null,
        occurred_at: incident.occurred_at ?? new Date().toISOString(),
        site_name: incident.site?.name ?? null,
      },
      investigation: {
        ref_code: (inv.ref_code as string | null) ?? null,
        root_cause_summary: (inv.root_cause_summary as string | null) ?? null,
        findings: (inv.findings as string | null) ?? null,
      },
    });
    initialTitle = seed.title;
    initialBody = seed.body;
    sourceIncidentId = incident.id;
    sourceInvestigationId = inv.id as string;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/bulletins"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All bulletins
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New safety bulletin</h1>
        <p className="text-sm text-muted-foreground">
          {fromInvestigation
            ? "Pre-filled from the investigation. Review every line — especially names — before publishing."
            : "Draft a lessons-learned notice. Markdown supported in the body."}
        </p>
      </div>

      <BulletinComposer
        mode="create"
        canPublish={canPublish}
        initialTitle={initialTitle}
        initialBody={initialBody}
        sourceIncidentId={sourceIncidentId}
        sourceInvestigationId={sourceInvestigationId}
      />
    </div>
  );
}
