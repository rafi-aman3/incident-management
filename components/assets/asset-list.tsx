import Link from "next/link";
import { AlertCircle, Boxes, FileText } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AssetConditionPill,
  AssetKindChip,
  AssetStatusBadge,
} from "@/components/assets/badges";
import type { AssetCondition, AssetKind, AssetStatus } from "@/lib/documents/types";

export type AssetRow = {
  id: string;
  ref_code: string;
  name: string;
  kind: AssetKind;
  site_id: string;
  site_name: string;
  location: string | null;
  condition: AssetCondition;
  status: AssetStatus;
  last_inspected_at: string | null;
  next_pm_at: string | null;
  has_sds: boolean;
};

export function AssetList({
  rows,
  hasFilters = false,
  canCreate = false,
}: {
  rows: AssetRow[];
  hasFilters?: boolean;
  canCreate?: boolean;
}) {
  if (rows.length === 0) {
    if (hasFilters) {
      return (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          No assets match these filters. Adjust the filters to see more.
        </div>
      );
    }
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <Boxes className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold">No assets yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {canCreate
            ? "Register your first asset to get started — equipment, machinery, safety gear."
            : "Once a site admin registers assets here, they'll show up in this list."}
        </p>
        {canCreate && (
          <Link
            href="/resources/assets/new"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Register asset
          </Link>
        )}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-md border">
      <Table aria-label="Assets">
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="w-[120px]">Ref</TableHead>
            <TableHead scope="col">Name</TableHead>
            <TableHead scope="col">Kind</TableHead>
            <TableHead scope="col">Location</TableHead>
            <TableHead scope="col">Condition</TableHead>
            <TableHead scope="col">Last inspected</TableHead>
            <TableHead scope="col">Next PM</TableHead>
            <TableHead scope="col" className="text-right">SDS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const overdue =
              row.next_pm_at != null &&
              new Date(row.next_pm_at).getTime() < Date.now();
            return (
              <TableRow key={row.id} className="hover:bg-accent/40">
                <TableCell className="font-mono text-xs text-muted-foreground">
                  <Link
                    href={`/resources/assets/${row.id}`}
                    className="hover:underline"
                  >
                    {row.ref_code}
                  </Link>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/resources/assets/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.name}
                    </Link>
                    <AssetStatusBadge status={row.status} />
                  </div>
                </TableCell>
                <TableCell>
                  <AssetKindChip kind={row.kind} />
                </TableCell>
                <TableCell className="max-w-[200px] truncate text-xs text-muted-foreground">
                  {row.location ?? "—"}
                </TableCell>
                <TableCell>
                  <AssetConditionPill condition={row.condition} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatRelative(row.last_inspected_at)}
                </TableCell>
                <TableCell className="text-xs">
                  <span
                    className={
                      overdue
                        ? "inline-flex items-center gap-1 font-medium text-destructive"
                        : "text-muted-foreground"
                    }
                  >
                    {overdue && <AlertCircle className="h-3 w-3" />}
                    {formatRelative(row.next_pm_at)}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {row.has_sds ? (
                    <FileText className="ml-auto h-4 w-4 text-muted-foreground" />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = new Date(iso).getTime() - Date.now();
  const future = ms > 0;
  const abs = Math.abs(ms);
  const minutes = Math.floor(abs / 60_000);
  if (minutes < 60) return future ? `in ${minutes}m` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return future ? `in ${hours}h` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return future ? `in ${days}d` : `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return future ? `in ${months}mo` : `${months}mo ago`;
  const years = Math.floor(months / 12);
  return future ? `in ${years}y` : `${years}y ago`;
}
