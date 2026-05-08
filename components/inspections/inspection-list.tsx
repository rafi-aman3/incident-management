import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InspectionStatusBadge } from "@/components/inspections/inspection-status-badge";
import type { InspectionStatus } from "@/lib/templates/types";

export type InspectionRow = {
  id: string;
  ref_code: string;
  title: string;
  template_name: string | null;
  status: InspectionStatus;
  is_failed: boolean;
  conducted_at: string | null;
  inspector: { full_name: string | null; email: string } | null;
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function InspectionList({ rows }: { rows: InspectionRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold">No inspections yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Click &ldquo;Start inspection&rdquo; to run one of the published
          templates assigned to your site.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[120px]">Ref</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Template</TableHead>
            <TableHead>Inspector</TableHead>
            <TableHead className="w-[120px]">Conducted</TableHead>
            <TableHead className="w-[140px]">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-accent/40">
              <TableCell className="font-mono text-xs tabular-nums">
                <Link href={`/inspections/${row.id}`} className="hover:underline">
                  {row.ref_code}
                </Link>
              </TableCell>
              <TableCell className="max-w-md">
                <Link
                  href={`/inspections/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.title}
                </Link>
                {(row.status === "in_progress" || row.status === "draft") && (
                  <span className="ml-2 inline-flex items-center rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {row.status === "draft" ? "Continue draft" : "Resume"}
                  </span>
                )}
                {row.is_failed && row.status === "completed" && (
                  <span className="ml-2 inline-flex items-center rounded-md border border-destructive/30 bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                    Has findings
                  </span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.template_name ?? "—"}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {row.inspector?.full_name ?? row.inspector?.email ?? "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground tabular-nums">
                {formatDate(row.conducted_at)}
              </TableCell>
              <TableCell>
                <InspectionStatusBadge status={row.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
