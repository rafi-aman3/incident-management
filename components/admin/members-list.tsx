import Link from "next/link";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export type MemberRow = {
  profile_id: string;
  full_name: string | null;
  email: string;
  department: string | null;
  sites_count: number;
  primary_role_name: string | null;
  last_seen_at: string | null;
};

export function MembersList({ rows }: { rows: MemberRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No members match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Sites</TableHead>
            <TableHead>Primary role</TableHead>
            <TableHead>Last seen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const name = m.full_name ?? m.email;
            return (
              <TableRow key={m.profile_id} className="hover:bg-accent/50">
                <TableCell>
                  <Link
                    href={`/admin/members/${m.profile_id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-[10px]">
                        {initials(name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{name}</span>
                  </Link>
                  {m.department && (
                    <p className="ml-9 text-[11px] text-muted-foreground">
                      {m.department}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.email}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {m.sites_count}
                </TableCell>
                <TableCell>
                  {m.primary_role_name ? (
                    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                      {m.primary_role_name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {m.last_seen_at ? format(new Date(m.last_seen_at), "PP") : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
