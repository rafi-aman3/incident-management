import Link from "next/link";
import { ClipboardCheck, MoreHorizontal, Play } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  TemplateStatusBadge,
  IndustryChip,
  VersionBadge,
} from "@/components/templates/badges";
import type { TemplateStatus } from "@/lib/templates/types";
import type { IndustryEnum } from "@/lib/templates/industry-map";

export type TemplateRow = {
  id: string;
  name: string;
  description: string | null;
  industry: IndustryEnum;
  status: TemplateStatus;
  current_version_number: number | null;
  updated_at: string;
  is_imported: boolean;
};

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}

export function TemplateList({
  rows,
  canEdit,
}: {
  rows: TemplateRow[];
  canEdit: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center">
        <ClipboardCheck className="mx-auto h-10 w-10 text-muted-foreground/40" />
        <h2 className="mt-4 text-lg font-semibold">No templates yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse the library to import a starter template, or create one from scratch.
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <Link
            href="/templates/browse"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            Browse library
          </Link>
          {canEdit && (
            <Link
              href="/templates/new"
              className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              + New template
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="w-[140px]">Industry</TableHead>
            <TableHead className="w-[120px]">Status</TableHead>
            <TableHead className="w-[80px]">Version</TableHead>
            <TableHead className="w-[140px]">Last updated</TableHead>
            <TableHead className="w-[180px] text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id} className="hover:bg-accent/40">
              <TableCell className="max-w-md">
                <Link
                  href={`/templates/${row.id}`}
                  className="font-medium hover:underline"
                >
                  {row.name}
                </Link>
                {row.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {row.description}
                  </p>
                )}
              </TableCell>
              <TableCell>
                <IndustryChip industry={row.industry} />
              </TableCell>
              <TableCell>
                <TemplateStatusBadge status={row.status} />
              </TableCell>
              <TableCell>
                <VersionBadge versionNumber={row.current_version_number} />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {formatRelative(row.updated_at)}
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1.5">
                  <Link
                    href={`/inspections?action=start&template=${row.id}`}
                    aria-label="Start inspection"
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ${
                      row.status === "published"
                        ? "bg-primary/10 text-primary hover:bg-primary/20"
                        : "pointer-events-none opacity-40"
                    }`}
                    aria-disabled={row.status !== "published"}
                  >
                    <Play className="h-3 w-3" /> Start
                  </Link>
                  {canEdit && (
                    <Link
                      href={`/templates/${row.id}/edit`}
                      className="inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
                    >
                      Edit
                    </Link>
                  )}
                  <Link
                    href={`/templates/${row.id}`}
                    aria-label="More"
                    className="inline-flex items-center rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
