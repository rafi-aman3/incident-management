"use client";

/**
 * Header action cluster for /resources/documents/[id]:
 *   * Replace file — re-upload via uploadDocumentFile + replace_document_file_v1
 *   * Edit metadata — name / type / site scope / expiry / notes (modal)
 *   * Archive — opens warning when active links exist; supports force
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Archive, Pencil, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALLOWED_DOCUMENT_MIMES,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";
import { uploadDocumentFile } from "@/lib/documents/upload";
import {
  archiveDocument,
  replaceDocumentFile,
  updateDocumentMetadata,
} from "@/lib/actions/documents";

type SiteOption = { id: string; name: string };

export function DocumentDetailActions({
  documentId,
  orgId,
  initial,
  sites,
  activeLinkCount,
  canEditMetadata,
  canArchive,
}: {
  documentId: string;
  orgId: string;
  initial: {
    name: string;
    type: DocumentType;
    site_id: string | null;
    expiry_date: string | null;
    notes: string | null;
  };
  sites: SiteOption[];
  activeLinkCount: number;
  canEditMetadata: boolean;
  canArchive: boolean;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState("");

  // Edit form state — re-seeded from `initial` whenever the dialog opens so
  // a re-open after Cancel shows the live snapshot, not the previously-
  // edited (then-cancelled) values.
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState<DocumentType>(initial.type);
  const [siteId, setSiteId] = useState<string>(initial.site_id ?? "");
  const [expiry, setExpiry] = useState(initial.expiry_date ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");

  useEffect(() => {
    if (editOpen) {
      setName(initial.name);
      setType(initial.type);
      setSiteId(initial.site_id ?? "");
      setExpiry(initial.expiry_date ?? "");
      setNotes(initial.notes ?? "");
    }
  }, [editOpen, initial.name, initial.type, initial.site_id, initial.expiry_date, initial.notes]);

  function handleReplaceClick() {
    fileRef.current?.click();
  }

  async function handleReplaceFile(file: File | null) {
    if (!file) return;
    startTransition(async () => {
      try {
        const meta = await uploadDocumentFile(file, orgId);
        const res = await replaceDocumentFile(documentId, meta);
        if (!res.ok) throw new Error(res.error);
        toast.success("File replaced");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Replace failed");
      } finally {
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  function handleSaveMetadata() {
    startTransition(async () => {
      const res = await updateDocumentMetadata(documentId, {
        name: name.trim(),
        type,
        site_id: siteId || null,
        expiry_date: expiry || null,
        notes: notes || "",
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Metadata saved");
      setEditOpen(false);
      router.refresh();
    });
  }

  function handleArchive(force: boolean) {
    startTransition(async () => {
      const res = await archiveDocument(
        documentId,
        archiveReason || undefined,
        force,
      );
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Document archived");
      setArchiveOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEditMetadata && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept={ALLOWED_DOCUMENT_MIMES.join(",")}
            className="hidden"
            onChange={(e) => handleReplaceFile(e.target.files?.[0] ?? null)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReplaceClick}
            disabled={pending}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Replace file
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEditOpen(true)}
            disabled={pending}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit metadata
          </Button>
        </>
      )}
      {canArchive && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setArchiveOpen(true)}
          disabled={pending}
        >
          <Archive className="mr-1.5 h-3.5 w-3.5" /> Archive
        </Button>
      )}

      {/* Edit metadata dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit metadata</DialogTitle>
            <DialogDescription>
              The file itself stays unchanged. To replace the file, close
              this dialog and use &ldquo;Replace file&rdquo;.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-name">Name</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-type">Type</Label>
              <Select
                value={type}
                onValueChange={(v) => setType(v as DocumentType)}
              >
                <SelectTrigger id="edit-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {DOCUMENT_TYPE_LABEL[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-site">Scope</Label>
              <select
                id="edit-site"
                value={siteId}
                onChange={(e) => setSiteId(e.target.value)}
                disabled={pending}
                className="h-9 w-full rounded-md border bg-background px-2 text-sm shadow-sm"
              >
                <option value="">Org-wide</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-expiry">Expiry</Label>
              <Input
                id="edit-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                disabled={pending}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setEditOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSaveMetadata} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Saving…
                </>
              ) : (
                "Save"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Archive dialog */}
      <Dialog open={archiveOpen} onOpenChange={setArchiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive this document?</DialogTitle>
            <DialogDescription>
              Archived documents stop showing in the library and can&apos;t be
              linked to new records. Existing links keep working — the file
              itself stays in storage to satisfy OSHA 5-year and RIDDOR
              3-year retention.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {activeLinkCount > 0 && (
              <div className="rounded-md border border-amber-500 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <strong>Heads up:</strong> this document is linked to{" "}
                <strong>
                  {activeLinkCount} active record
                  {activeLinkCount === 1 ? "" : "s"}
                </strong>
                . Archiving requires an explicit confirmation.
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="archive-reason">Reason (optional)</Label>
              <Textarea
                id="archive-reason"
                rows={2}
                value={archiveReason}
                onChange={(e) => setArchiveReason(e.target.value)}
                placeholder="Superseded by new SOP / one-time form / outdated SDS / …"
                disabled={pending}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setArchiveOpen(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleArchive(activeLinkCount > 0)}
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Archiving…
                </>
              ) : activeLinkCount > 0 ? (
                "Archive anyway"
              ) : (
                "Archive"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
