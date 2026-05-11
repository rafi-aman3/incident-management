import Link from "next/link";
import { HardHat } from "lucide-react";
import { JsaStatusBadge } from "./jsa-status-badge";
import type { JsaStatus } from "@/lib/actions/jsa-schemas";

export type JsaListRow = {
  id: string;
  ref_code: string | null;
  title: string;
  status: JsaStatus;
  area: string | null;
  site_name: string | null;
  expires_at: string | null;
  steps_count: number;
  hazards_count: number;
  signoff_count: number;
  updated_at: string;
};

function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function JsaList({ rows }: { rows: JsaListRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
        <HardHat className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold">No JSAs yet</h2>
        <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
          Job Safety Analyses identify hazards and controls for specific tasks before work begins. Draft your first JSA to get started.
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
            <th className="px-3 py-2 text-left font-medium">Site</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Steps</th>
            <th className="px-3 py-2 text-right font-medium">Sign-offs</th>
            <th className="px-3 py-2 text-right font-medium">Expiry</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {rows.map((r) => {
            const dueIn = daysUntil(r.expires_at);
            const expiryLabel =
              r.status === "approved" && dueIn !== null
                ? dueIn < 0
                  ? `${Math.abs(dueIn)}d overdue`
                  : dueIn === 0
                    ? "Today"
                    : `${dueIn}d`
                : "—";
            const expiryClass =
              r.status === "approved" && dueIn !== null && dueIn < 30
                ? dueIn < 0
                  ? "text-destructive font-medium"
                  : "text-warning"
                : "text-muted-foreground";
            return (
              <tr key={r.id} className="hover:bg-muted/40">
                <td className="px-3 py-2 font-mono text-xs">
                  <Link href={`/jsa/${r.id}`} className="text-primary underline-offset-2 hover:underline">
                    {r.ref_code ?? r.id.slice(0, 8)}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Link href={`/jsa/${r.id}`} className="font-medium hover:underline">
                    {r.title}
                  </Link>
                  {r.area ? (
                    <span className="block text-xs text-muted-foreground">{r.area}</span>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{r.site_name ?? "—"}</td>
                <td className="px-3 py-2">
                  <JsaStatusBadge status={r.status} />
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{r.steps_count}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.signoff_count}</td>
                <td className={`px-3 py-2 text-right tabular-nums ${expiryClass}`}>{expiryLabel}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
