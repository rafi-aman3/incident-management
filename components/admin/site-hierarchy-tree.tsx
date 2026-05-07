import Link from "next/link";
import { Archive, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SiteRow } from "./sites-list";

type Node = SiteRow & { children: Node[] };

function buildTree(rows: SiteRow[]): Node[] {
  const byId = new Map<string, Node>();
  for (const r of rows) byId.set(r.id, { ...r, children: [] });
  const roots: Node[] = [];
  for (const node of byId.values()) {
    if (node.parent_site_id && byId.has(node.parent_site_id)) {
      byId.get(node.parent_site_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  // Stable ordering by name within each level.
  const sortRec = (list: Node[]) => {
    list.sort((a, b) => a.name.localeCompare(b.name));
    list.forEach((n) => sortRec(n.children));
  };
  sortRec(roots);
  return roots;
}

export function SiteHierarchyTree({ rows }: { rows: SiteRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No sites match these filters.
      </div>
    );
  }
  const tree = buildTree(rows);
  return (
    <ul className="space-y-1 rounded-md border bg-card p-2">
      {tree.map((n) => (
        <TreeNode key={n.id} node={n} depth={0} />
      ))}
    </ul>
  );
}

function TreeNode({ node, depth }: { node: Node; depth: number }) {
  const archived = node.archived_at !== null;
  return (
    <li>
      <Link
        href={`/admin/sites/${node.id}`}
        className={cn(
          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent",
          archived && "opacity-60",
        )}
        style={{ paddingInlineStart: `${depth * 1.25 + 0.5}rem` }}
      >
        {depth > 0 && (
          <ChevronRight className="h-3 w-3 text-muted-foreground" aria-hidden />
        )}
        <span className="font-medium">{node.name}</span>
        <span className="text-[11px] text-muted-foreground">{node.country}</span>
        {archived && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            <Archive className="h-2.5 w-2.5" /> archived
          </span>
        )}
      </Link>
      {node.children.length > 0 && (
        <ul className="space-y-1">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
