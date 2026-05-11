import Link from "next/link";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { JsaList, type JsaListRow } from "@/components/jsa/jsa-list";
import { ArgusContextPayload } from "@/components/argus/argus-context";
import type { ArgusPageContext } from "@/lib/argus/page-context";
import type { JsaStatus } from "@/lib/actions/jsa-schemas";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_TABS: Array<{ slug: JsaStatus | "all"; label: string }> = [
  { slug: "all", label: "All" },
  { slug: "draft", label: "Drafts" },
  { slug: "under_review", label: "Under review" },
  { slug: "approved", label: "Approved" },
  { slug: "expired", label: "Expired" },
  { slug: "archived", label: "Archived" },
];

export default async function JsaIndexPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const rawStatus = Array.isArray(sp.status) ? sp.status[0] : sp.status;
  const statusFilter: JsaStatus | "all" =
    STATUS_TABS.some((t) => t.slug === rawStatus) ? (rawStatus as JsaStatus | "all") : "all";

  const { supabase, currentSiteId } = await requireUser();
  const canDraft = await can("jsa:draft", currentSiteId);

  type JsaRow = {
    id: string;
    ref_code: string | null;
    title: string;
    status: JsaStatus;
    area: string | null;
    expires_at: string | null;
    updated_at: string;
    site: { name: string } | null;
    steps: Array<{ id: string; hazards: Array<{ id: string }> }> | null;
    signoffs: Array<{ id: string }> | null;
  };
  const query = supabase
    .from("jsas")
    .select(
      "id, ref_code, title, status, area, expires_at, updated_at, " +
        "site:site_id(name), " +
        "steps:jsa_steps(id, hazards:jsa_step_hazards(id)), " +
        "signoffs:jsa_signoffs(id)",
    )
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (statusFilter !== "all") {
    query.eq("status", statusFilter);
  }
  const { data: jsaData, error } = await query.returns<JsaRow[]>();

  const rows: JsaListRow[] = (jsaData ?? []).map((j) => {
    let hazardsCount = 0;
    for (const s of j.steps ?? []) {
      hazardsCount += (s.hazards ?? []).length;
    }
    return {
      id: j.id,
      ref_code: j.ref_code,
      title: j.title,
      status: j.status,
      area: j.area,
      site_name: j.site?.name ?? null,
      expires_at: j.expires_at,
      steps_count: (j.steps ?? []).length,
      hazards_count: hazardsCount,
      signoff_count: (j.signoffs ?? []).length,
      updated_at: j.updated_at,
    };
  });

  // Aggregates for the Argus page-context provider.
  const today = new Date().toISOString().slice(0, 10);
  const [{ count: draftCount }, { count: underReviewCount }, { count: approvedCount }, { count: expiredUnaddressed }] =
    await Promise.all([
      supabase.from("jsas").select("id", { count: "exact", head: true }).eq("status", "draft").is("deleted_at", null),
      supabase.from("jsas").select("id", { count: "exact", head: true }).eq("status", "under_review").is("deleted_at", null),
      supabase.from("jsas").select("id", { count: "exact", head: true }).eq("status", "approved").is("deleted_at", null),
      supabase
        .from("jsas")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved")
        .lt("expires_at", today)
        .is("deleted_at", null),
    ]);

  const argusContext: ArgusPageContext = {
    route: "jsa_index",
    routeLabel: "JSA",
    siteId: currentSiteId,
    aggregates: {
      draft: draftCount ?? 0,
      under_review: underReviewCount ?? 0,
      approved: approvedCount ?? 0,
      expired_unaddressed: expiredUnaddressed ?? 0,
    },
    hasActiveSignal: (underReviewCount ?? 0) > 0 || (expiredUnaddressed ?? 0) > 0,
  };

  return (
    <div className="space-y-6">
      <ArgusContextPayload context={argusContext} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Job Safety Analysis</h1>
          <p className="text-sm text-muted-foreground">
            OSHA 3071 / HSE INDG163 task-level analysis — identify hazards, apply controls, and sign off before performing the job.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canDraft && (
            <Link
              href="/jsa/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New JSA
            </Link>
          )}
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b text-sm">
        {STATUS_TABS.map((t) => {
          const active = t.slug === statusFilter;
          const href = t.slug === "all" ? "/jsa" : `/jsa?status=${t.slug}`;
          return (
            <Link
              key={t.slug}
              href={href}
              className={
                "border-b-2 px-3 py-2 font-medium transition " +
                (active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <JsaList rows={rows} />
    </div>
  );
}
