import Link from "next/link";
import { Inbox } from "lucide-react";
import { CategoryBadge } from "./risk-badges";

export type CandidateRow = {
  id: string;
  source_type: string;
  source_reference_id: string | null;
  proposed_title: string;
  proposed_category: string;
  site_name: string | null;
  created_at: string;
};

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

export function CandidateQueue({ rows }: { rows: CandidateRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">No candidates waiting</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Candidates funnel in from worker reports, inspections, incident reviews, and SDS imports.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Source</th>
            <th className="px-3 py-2 text-left font-medium">Proposed title</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Site</th>
            <th className="px-3 py-2 text-right font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-3 py-2 text-xs">
                <Link href={`/hazards/candidates/${r.id}`} className="text-primary underline-offset-2 hover:underline">
                  {SOURCE_LABEL[r.source_type] ?? r.source_type}
                </Link>
                {r.source_reference_id && (
                  <p className="font-mono text-[10px] text-muted-foreground">{r.source_reference_id}</p>
                )}
              </td>
              <td className="px-3 py-2">
                <Link href={`/hazards/candidates/${r.id}`} className="font-medium hover:underline">
                  {r.proposed_title}
                </Link>
              </td>
              <td className="px-3 py-2"><CategoryBadge category={r.proposed_category} /></td>
              <td className="px-3 py-2 text-muted-foreground">{r.site_name ?? "—"}</td>
              <td className="px-3 py-2 text-right text-xs text-muted-foreground">
                {new Date(r.created_at).toLocaleDateString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
