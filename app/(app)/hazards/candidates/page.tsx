import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { CandidateQueue, type CandidateRow } from "@/components/hazards/candidate-queue";
import { SdsImportModal, type SdsModalSite } from "@/components/sds/sds-import-modal";
import { Button } from "@/components/ui/button";

const SOURCE_LABEL: Record<string, string> = {
  worker_report: "Worker report",
  inspection: "Inspection",
  incident_review: "Incident review",
  management_of_change: "Management of change",
  audit_finding: "Audit finding",
  external_advisory: "External advisory",
  sds_import: "SDS import",
  jsa: "JSA",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const source = typeof sp.source === "string" ? sp.source : undefined;
  const autoOpenSds = sp.action === "import-sds";

  const { supabase, currentSiteId, memberships } = await requireUser();
  if (!(await can("hazard_candidate:review", currentSiteId))) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
        You need <code>hazard_candidate:review</code> to access this page.
      </div>
    );
  }

  // Sites the user can import into (hazard:report-eligible).
  const memberSiteIds = memberships.map((m) => m.site_id).filter((id, i, a) => a.indexOf(id) === i);
  const { data: siteRows } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", memberSiteIds);
  const sdsSites: SdsModalSite[] = (siteRows ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));
  const canImportSds = currentSiteId ? await can("hazard:report", currentSiteId) : false;

  type CandidateQueryRow = {
    id: string;
    source_type: string;
    source_reference_id: string | null;
    proposed_title: string;
    proposed_category: string;
    created_at: string;
    site: { name: string } | null;
  };
  let query = supabase
    .from("hazard_candidates")
    .select(
      "id, source_type, source_reference_id, proposed_title, proposed_category, created_at, " +
        "site:site_id(name)",
    )
    .eq("status", "pending_review")
    .order("created_at", { ascending: false })
    .limit(200);
  if (source) query = query.eq("source_type", source);

  const { data, error } = await query.returns<CandidateQueryRow[]>();
  const rows: CandidateRow[] = (data ?? []).map((r) => ({
    id: r.id,
    source_type: r.source_type,
    source_reference_id: r.source_reference_id,
    proposed_title: r.proposed_title,
    proposed_category: r.proposed_category,
    site_name: r.site?.name ?? null,
    created_at: r.created_at,
  }));

  return (
    <div className="space-y-6">
      <Link href="/hazards" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to hazards
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Hazard candidate queue</h1>
          <p className="text-sm text-muted-foreground">
            Review proposed hazards from across the platform. Convert into a register entry, dismiss with reason, or merge into an existing hazard.
          </p>
        </div>
        {canImportSds && sdsSites.length > 0 && (
          <SdsImportModal sites={sdsSites} defaultSiteId={currentSiteId} defaultOpen={autoOpenSds} />
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        <SourceChip current={source} value={undefined} label="All sources" />
        {Object.entries(SOURCE_LABEL).map(([k, label]) => (
          <SourceChip key={k} current={source} value={k} label={label} />
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      <CandidateQueue rows={rows} />
    </div>
  );
}

function SourceChip({
  current,
  value,
  label,
}: {
  current: string | undefined;
  value: string | undefined;
  label: string;
}) {
  const active = current === value;
  const href = value ? `/hazards/candidates?source=${value}` : "/hazards/candidates";
  return (
    <Link
      href={href}
      className={
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition " +
        (active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground")
      }
    >
      {label}
    </Link>
  );
}
