import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SeverityBadge, TrackBadge } from "@/components/incidents/badges";
import {
  InvestigationStatusBadge,
  DueDateChip,
} from "@/components/investigations/badges";
import type { InvestigationCardData } from "@/components/investigations/investigation-card-data";

export function InvestigationsList({ rows }: { rows: InvestigationCardData[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No investigations match these filters.
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
            <TableHead>Severity</TableHead>
            <TableHead>Track</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Lead</TableHead>
            <TableHead>Due</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const lead = row.lead;
            const leadName = lead?.full_name ?? lead?.email ?? "—";
            return (
              <TableRow key={row.id} className="hover:bg-accent">
                <TableCell className="tabular-nums font-mono text-xs">
                  <Link href={`/investigations/${row.id}`} className="hover:underline">
                    {row.ref_code ?? "—"}
                  </Link>
                </TableCell>
                <TableCell className="max-w-md">
                  <Link href={`/investigations/${row.id}`} className="hover:underline">
                    <div className="font-medium">{row.incident.title}</div>
                    {row.incident.ref_code && (
                      <div className="text-[11px] text-muted-foreground tabular-nums">
                        {row.incident.ref_code}
                      </div>
                    )}
                  </Link>
                </TableCell>
                <TableCell>
                  <SeverityBadge severity={row.incident.severity} />
                </TableCell>
                <TableCell>
                  <TrackBadge track={row.incident.track} />
                </TableCell>
                <TableCell>
                  <InvestigationStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{leadName}</TableCell>
                <TableCell>
                  <DueDateChip dueDate={row.due_date} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
