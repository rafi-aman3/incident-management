import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CapaStatusBadge,
  CapaTypeBadge,
  CapaProgressBar,
} from "@/components/capa/badges";
import { DueDateChip } from "@/components/investigations/badges";
import type { CapaStatus } from "@/lib/capa/types";

export type CapaRow = {
  id: string;
  ref_code: string | null;
  type: "corrective" | "preventive";
  title: string;
  status: CapaStatus;
  progress_pct: number;
  due_date: string | null;
  owner: { full_name: string | null; email: string } | null;
  verifier: { full_name: string | null; email: string } | null;
  is_overdue: boolean;
};

export function CapaList({ rows }: { rows: CapaRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No CAPAs match this view.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Verifier</TableHead>
            <TableHead className="w-[160px]">Progress</TableHead>
            <TableHead>Due</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-accent">
              <TableCell className="tabular-nums font-mono text-xs">
                <Link href={`/capa/${row.id}`} className="hover:underline">
                  {row.ref_code ?? "—"}
                </Link>
              </TableCell>
              <TableCell className="max-w-md">
                <Link href={`/capa/${row.id}`} className="hover:underline">
                  <span className="font-medium">{row.title}</span>
                </Link>
              </TableCell>
              <TableCell>
                <CapaTypeBadge type={row.type} />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.owner?.full_name ?? row.owner?.email ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.verifier?.full_name ?? row.verifier?.email ?? (
                  <span className="italic">unassigned</span>
                )}
              </TableCell>
              <TableCell>
                <CapaProgressBar pct={row.progress_pct} />
              </TableCell>
              <TableCell>
                <DueDateChip dueDate={row.due_date} />
              </TableCell>
              <TableCell>
                <CapaStatusBadge status={row.status} overdue={row.is_overdue} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
