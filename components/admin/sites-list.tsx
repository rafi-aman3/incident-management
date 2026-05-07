import Link from "next/link";
import { format } from "date-fns";
import { Archive, ArchiveRestore, Pencil, Users, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type SiteRow = {
  id: string;
  name: string;
  country: "US" | "GB" | string;
  region: string | null;
  parent_site_id: string | null;
  parent_name: string | null;
  archived_at: string | null;
  setup_completed_at: string | null;
  member_count: number;
  last_incident_at: string | null;
};

export function SitesList({
  rows,
  canArchive,
}: {
  rows: SiteRow[];
  canArchive: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No sites match these filters.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Region</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead>Last incident</TableHead>
            <TableHead>Setup</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((s) => {
            const archived = s.archived_at !== null;
            return (
              <TableRow key={s.id} className={cn(archived && "opacity-70")}>
                <TableCell>
                  <Link
                    href={`/admin/sites/${s.id}`}
                    className="font-medium hover:underline"
                  >
                    {s.name}
                  </Link>
                  {s.parent_name && (
                    <p className="text-[11px] text-muted-foreground">
                      under {s.parent_name}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{s.country}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {s.region ?? "—"}
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {s.member_count}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {s.last_incident_at
                      ? format(new Date(s.last_incident_at), "PP")
                      : "—"}
                  </span>
                </TableCell>
                <TableCell>
                  {s.setup_completed_at ? (
                    <span className="inline-flex items-center rounded-md bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success-foreground dark:text-success">
                      Complete
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-md bg-warning/15 px-2 py-0.5 text-[10px] font-medium text-warning-foreground dark:text-warning">
                      In progress
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {archived ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <Archive className="h-3 w-3" /> Archived
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success-foreground dark:text-success">
                      Active
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="inline-flex items-center gap-1">
                    <Link
                      href={`/admin/sites/${s.id}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Edit ${s.name}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/admin/sites/${s.id}?tab=members`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Members of ${s.name}`}
                    >
                      <Users className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/admin/sites/${s.id}`}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      aria-label={`Open ${s.name}`}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                    {canArchive && archived && (
                      <Link
                        href={`/admin/sites/${s.id}#unarchive`}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Unarchive ${s.name}`}
                      >
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
