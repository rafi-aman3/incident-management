import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { RiskBadge, HazardStatusBadge, CategoryBadge } from "./risk-badges";
import type { RiskLevel } from "@/lib/risk/types";

export type HazardListRow = {
  id: string;
  ref_code: string | null;
  title: string;
  hazard_category: string;
  status: string;
  site_name: string | null;
  area: string | null;
  residual_risk_score: RiskLevel | null;
  identified_at: string;
};

export function HazardList({ rows }: { rows: HazardListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <TriangleAlert className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">No hazards yet</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Hazards build up the ISO 45001 §6.1.2 register. Add the first one or review the candidate queue.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="min-w-full divide-y divide-border text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Ref</th>
            <th className="px-3 py-2 text-left font-medium">Title</th>
            <th className="px-3 py-2 text-left font-medium">Category</th>
            <th className="px-3 py-2 text-left font-medium">Site</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Residual</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((r) => (
            <tr key={r.id} className="hover:bg-muted/40">
              <td className="px-3 py-2 font-mono text-xs">
                <Link href={`/hazards/${r.id}`} className="text-primary underline-offset-2 hover:underline">
                  {r.ref_code ?? r.id.slice(0, 8)}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link href={`/hazards/${r.id}`} className="font-medium hover:underline">
                  {r.title}
                </Link>
              </td>
              <td className="px-3 py-2"><CategoryBadge category={r.hazard_category} /></td>
              <td className="px-3 py-2 text-muted-foreground">
                {r.site_name ?? "—"}
                {r.area ? <span className="text-xs"> · {r.area}</span> : null}
              </td>
              <td className="px-3 py-2"><HazardStatusBadge status={r.status} /></td>
              <td className="px-3 py-2 text-right"><RiskBadge score={r.residual_risk_score} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
