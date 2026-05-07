import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type RoleRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_default: boolean;
  permission_count: number;
  member_count: number;
  created_at: string;
};

export function RoleList({ rows }: { rows: RoleRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No roles match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Description</TableHead>
            <TableHead className="text-right">Permissions</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="hover:bg-accent/50">
              <TableCell>
                <Link
                  href={`/admin/roles/${r.id}`}
                  className="flex items-center gap-2 font-medium hover:underline"
                >
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
                  {r.name}
                  {r.is_default && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                      System
                    </span>
                  )}
                </Link>
                <p className="ml-6 text-[11px] font-mono text-muted-foreground">
                  {r.key}
                </p>
              </TableCell>
              <TableCell className="max-w-[28ch] text-sm text-muted-foreground">
                {r.description ?? <span className="italic">No description</span>}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.permission_count}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {r.member_count}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {format(new Date(r.created_at), "PP")}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
