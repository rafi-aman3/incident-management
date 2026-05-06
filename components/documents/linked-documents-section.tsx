"use client";

/**
 * <LinkedDocumentsSection> — drop-in panel that lists existing
 * document_links for a given parent record and exposes a DocumentLinkPicker
 * trigger. Used in the wizard, incident detail, investigation detail, and
 * CAPA detail to surface the new library-based document linking
 * alongside (not replacing) the legacy upload widgets.
 *
 * Items render as a flat list with file icon / name / type / unlink CTA.
 * The unlink CTA only renders when the caller passes `canUnlink`.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DocumentLinkPicker } from "@/components/documents/document-link-picker";
import {
  DOCUMENT_TYPE_ICON,
  DOCUMENT_TYPE_LABEL,
  type DocumentLinkParent,
  type DocumentType,
} from "@/lib/documents/types";
import { unlinkDocument } from "@/lib/actions/documents";

type LinkRow = {
  id: string;
  link_role: string | null;
  document: {
    id: string;
    name: string;
    type: DocumentType;
    file_name: string;
  };
};

export function LinkedDocumentsSection({
  parentType,
  parentId,
  orgId,
  defaultLinkRole,
  defaultTypeFilter,
  canLink = true,
  canUnlink = true,
  title = "Linked documents",
  emptyHint = "No library documents linked yet.",
}: {
  parentType: DocumentLinkParent;
  parentId: string;
  orgId: string;
  defaultLinkRole?: string;
  defaultTypeFilter?: DocumentType;
  canLink?: boolean;
  canUnlink?: boolean;
  title?: string;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<LinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlinking, startUnlinking] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch links inline — caller doesn't need to pre-fetch from the
  // server. RLS keeps this safe.
  useEffect(() => {
    let active = true;
    setLoading(true);
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase
        .from("document_links")
        .select(
          `id, link_role,
           document:documents!inner ( id, name, type, file_name, archived_at )`,
        )
        .eq("parent_type", parentType)
        .eq("parent_id", parentId)
        .is("removed_at", null)
        .order("created_at", { ascending: false });
      if (!active) return;
      if (error) {
        toast.error(error.message);
        setRows([]);
      } else {
        type Joined = {
          id: string;
          link_role: string | null;
          document:
            | { id: string; name: string; type: DocumentType; file_name: string; archived_at: string | null }
            | { id: string; name: string; type: DocumentType; file_name: string; archived_at: string | null }[]
            | null;
        };
        const out: LinkRow[] = ((data ?? []) as Joined[])
          .map((r) => {
            const d = Array.isArray(r.document) ? r.document[0] : r.document;
            if (!d) return null;
            return {
              id: r.id,
              link_role: r.link_role,
              document: { id: d.id, name: d.name, type: d.type, file_name: d.file_name },
            } as LinkRow;
          })
          .filter((x): x is LinkRow => x !== null);
        setRows(out);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [parentType, parentId, refreshKey]);

  function handleUnlink(linkId: string) {
    setPendingId(linkId);
    startUnlinking(async () => {
      const res = await unlinkDocument({
        link_id: linkId,
        parent_type: parentType,
        parent_id: parentId,
      });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Unlinked");
      setRows((prev) => prev.filter((r) => r.id !== linkId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">
          {title}
          {!loading && (
            <span className="ml-1.5 text-xs text-muted-foreground">
              ({rows.length})
            </span>
          )}
        </p>
        {canLink && (
          <DocumentLinkPicker
            parentType={parentType}
            parentId={parentId}
            orgId={orgId}
            defaultLinkRole={defaultLinkRole}
            defaultTypeFilter={defaultTypeFilter}
            onLinked={() => setRefreshKey((k) => k + 1)}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Plus className="mr-1 h-3 w-3" /> Add document
              </Button>
            }
          />
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Loading links…
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
          {emptyHint}
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {rows.map((row) => {
            const Icon = DOCUMENT_TYPE_ICON[row.document.type];
            const removing = unlinking && pendingId === row.id;
            return (
              <li
                key={row.id}
                className="flex items-center gap-3 px-3 py-2 text-sm"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <Link
                  href={`/resources/documents/${row.document.id}`}
                  className="min-w-0 flex-1 truncate font-medium hover:underline"
                >
                  {row.document.name}
                </Link>
                <span className="text-[11px] text-muted-foreground">
                  {DOCUMENT_TYPE_LABEL[row.document.type]}
                  {row.link_role ? ` · ${row.link_role}` : ""}
                </span>
                {canUnlink && (
                  <button
                    type="button"
                    onClick={() => handleUnlink(row.id)}
                    disabled={unlinking}
                    aria-label="Unlink"
                    className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    {removing ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* Default fallback for fallback-needed contexts when used in a place
          that always shows the linker even when empty — wrapper above
          handles it implicitly via the "no rows" state. */}
      <FileText className="hidden" />
    </div>
  );
}
