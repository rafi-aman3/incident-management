"use client";

/**
 * <DocumentLinkPicker> — reusable two-tab modal that lets the caller
 * link an existing org-library document to a parent record OR upload a
 * new document and link it in one step.
 *
 * Mounted in 5 contexts per plans/04-resources.md §C:
 *   1. /incidents/new/1 Step-1 attachments
 *   2. /incidents/[id] Attachments tab
 *   3. /investigations/[id] Evidence drawer
 *   4. /capa/[id] Verification evidence
 *   5. /resources/assets/[id] Documents tab
 *
 * Permissions are enforced server-side by `link_document_v1`. The caller
 * is responsible for hiding the trigger when the user lacks
 * `document_link:create`.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Search,
  Upload,
  Library,
  Calendar,
  Link2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_ICON,
  type DocumentLinkParent,
  type DocumentType,
} from "@/lib/documents/types";
import { uploadDocumentFile } from "@/lib/documents/upload";
import {
  createDocument,
  linkDocument,
  listOrgDocuments,
  type DocumentLibraryRow,
} from "@/lib/actions/documents";
import { cn } from "@/lib/utils";

export type DocumentLinkPickerProps = {
  parentType: DocumentLinkParent;
  parentId: string;
  /**
   * The user's current org id — used for the storage path prefix.
   * Server component parents pass it from `requireUser().profile.org_id`.
   */
  orgId: string;
  /** Pre-applied tag stored on the link row (e.g. "sds", "evidence"). */
  defaultLinkRole?: string;
  /** Pre-applied filter on the library tab. */
  defaultTypeFilter?: DocumentType;
  /** Default site_id for newly uploaded documents (org-wide if null). */
  defaultSiteId?: string | null;
  /** Override the trigger button. */
  trigger?: React.ReactNode;
  /** Callback fired after a successful link (library OR upload-and-link). */
  onLinked?: (linkId: string, documentId: string) => void;
};

type Mode = "library" | "upload";

export function DocumentLinkPicker({
  parentType,
  parentId,
  orgId,
  defaultLinkRole,
  defaultTypeFilter,
  defaultSiteId = null,
  trigger,
  onLinked,
}: DocumentLinkPickerProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("library");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="outline" size="sm">
            <Link2 className="mr-1.5 h-3.5 w-3.5" /> Add document
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Attach a document</DialogTitle>
          <DialogDescription>
            Re-use an existing library file or upload a new one. Files in the
            library can be linked to many records at once — the
            organisation keeps a single source of truth.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-1 rounded-md bg-muted p-1 text-sm">
          <ModeButton
            active={mode === "library"}
            onClick={() => setMode("library")}
          >
            <Library className="mr-1.5 h-3.5 w-3.5" /> From library
          </ModeButton>
          <ModeButton
            active={mode === "upload"}
            onClick={() => setMode("upload")}
          >
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload new
          </ModeButton>
        </div>

        {mode === "library" ? (
          <LibraryTab
            parentType={parentType}
            parentId={parentId}
            defaultLinkRole={defaultLinkRole}
            defaultTypeFilter={defaultTypeFilter}
            onDone={(linkId, docId) => {
              setOpen(false);
              onLinked?.(linkId, docId);
              router.refresh();
            }}
          />
        ) : (
          <UploadTab
            parentType={parentType}
            parentId={parentId}
            orgId={orgId}
            defaultLinkRole={defaultLinkRole}
            defaultTypeFilter={defaultTypeFilter}
            defaultSiteId={defaultSiteId}
            onDone={(linkId, docId) => {
              setOpen(false);
              onLinked?.(linkId, docId);
              router.refresh();
            }}
          />
        )}

        <DialogFooter className="sm:justify-end">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Mode toggle
// ---------------------------------------------------------------------------
function ModeButton({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex flex-1 items-center justify-center rounded px-3 py-1.5 text-xs font-medium transition",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Library tab
// ---------------------------------------------------------------------------
function LibraryTab({
  parentType,
  parentId,
  defaultLinkRole,
  defaultTypeFilter,
  onDone,
}: {
  parentType: DocumentLinkParent;
  parentId: string;
  defaultLinkRole?: string;
  defaultTypeFilter?: DocumentType;
  onDone: (linkId: string, documentId: string) => void;
}) {
  const [rows, setRows] = useState<DocumentLibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<DocumentType | "all">(defaultTypeFilter ?? "all");
  const [linking, startLinking] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Fetch on open + when filters change (debounced search)
  useEffect(() => {
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await listOrgDocuments({
        type: type === "all" ? undefined : type,
        q: q || undefined,
        limit: 60,
      });
      if (!active) return;
      if (res.ok) {
        setRows(res.data ?? []);
      } else {
        toast.error(res.error);
        setRows([]);
      }
      setLoading(false);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q, type]);

  function handleLink(row: DocumentLibraryRow) {
    setPendingId(row.id);
    startLinking(async () => {
      const res = await linkDocument({
        document_id: row.id,
        parent_type: parentType,
        parent_id: parentId,
        link_role: defaultLinkRole,
      });
      setPendingId(null);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Linked "${row.name}"`);
      onDone(res.data!.link_id, row.id);
    });
  }

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or filename"
            className="pl-8 h-9"
          />
        </div>
        <Select
          value={type}
          onValueChange={(v) => setType(v as DocumentType | "all")}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {DOCUMENT_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {DOCUMENT_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="max-h-[50vh] overflow-y-auto rounded-md border">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading library…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No documents match.
            {q || type !== "all" ? " Try clearing the filter." : ""}
          </div>
        ) : (
          <ul className="divide-y">
            {rows.map((row) => {
              const Icon = DOCUMENT_TYPE_ICON[row.type];
              const linkPending = pendingId === row.id && linking;
              return (
                <li
                  key={row.id}
                  className="flex items-center gap-3 px-3 py-2.5"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{row.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {DOCUMENT_TYPE_LABEL[row.type]}
                      {" · "}
                      {row.file_name}
                      {" · "}
                      {(row.size_bytes / 1024).toFixed(0)} KB
                      {row.expiry_date ? ` · expires ${row.expiry_date}` : ""}
                      {row.link_count > 0
                        ? ` · linked from ${row.link_count} record${row.link_count === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleLink(row)}
                    disabled={linking}
                  >
                    {linkPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      "Link"
                    )}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload tab
// ---------------------------------------------------------------------------
function UploadTab({
  parentType,
  parentId,
  orgId,
  defaultLinkRole,
  defaultTypeFilter,
  defaultSiteId,
  onDone,
}: {
  parentType: DocumentLinkParent;
  parentId: string;
  orgId: string;
  defaultLinkRole?: string;
  defaultTypeFilter?: DocumentType;
  defaultSiteId?: string | null;
  onDone: (linkId: string, documentId: string) => void;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<DocumentType>(defaultTypeFilter ?? "evidence");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = useMemo(() => !!file && name.trim().length > 0 && !busy, [file, name, busy]);

  function handleFile(f: File | null) {
    setFile(f);
    if (f && !name) {
      // Auto-fill name from filename, dropping the extension
      const base = f.name.replace(/\.[^.]+$/, "");
      setName(base);
    }
  }

  function resetForm() {
    setFile(null);
    setName("");
    setType(defaultTypeFilter ?? "evidence");
    setExpiry("");
    setNotes("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit() {
    if (!file) return;
    setBusy(true);
    let createdDocId: string | null = null;
    try {
      // 1. Client-side upload
      const meta = await uploadDocumentFile(file, orgId);
      // 2. Persist row
      const created = await createDocument({
        ...meta,
        name: name.trim(),
        type,
        site_id: defaultSiteId ?? null,
        expiry_date: expiry || null,
        notes: notes || "",
      });
      if (!created.ok) throw new Error(created.error);
      createdDocId = created.data!.id;
      // 3. Link to the parent
      const linked = await linkDocument({
        document_id: createdDocId,
        parent_type: parentType,
        parent_id: parentId,
        link_role: defaultLinkRole,
      });
      if (!linked.ok) {
        // Orphan path: doc exists in the library but the link failed. We
        // surface a warning toast with a CTA so the user can decide whether
        // to keep it (it may still be useful elsewhere) or archive it.
        toast.warning(
          `Uploaded "${name.trim()}" to the library, but linking it here failed: ${linked.error}`,
          {
            action: {
              label: "View document",
              onClick: () => router.push(`/resources/documents/${createdDocId}`),
            },
            duration: 10_000,
          },
        );
        return;
      }
      toast.success(`Uploaded and linked "${name.trim()}"`);
      resetForm();
      onDone(linked.data!.link_id, createdDocId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      if (createdDocId) {
        // Same orphan recovery path, but for unexpected throws after the
        // doc is created (e.g. linkDocument threw rather than returning ok=false).
        toast.warning(
          `Uploaded "${name.trim()}" to the library, but linking it here failed: ${msg}`,
          {
            action: {
              label: "View document",
              onClick: () => router.push(`/resources/documents/${createdDocId}`),
            },
            duration: 10_000,
          },
        );
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 py-2">
      <div className="rounded-md border border-dashed p-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <div className="flex items-center gap-3">
          <Upload className="h-5 w-5 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              {file
                ? file.name
                : "Drop a file here, or click below to browse."}
            </p>
            <p className="text-[11px] text-muted-foreground">
              PNG · JPG · PDF · DOC/DOCX · XLS/XLSX · max 25 MB.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            {file ? "Replace" : "Choose file"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="doc-name">Name</Label>
          <Input
            id="doc-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Forklift SDS — IPA solvent"
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="doc-type">Type</Label>
          <Select
            value={type}
            onValueChange={(v) => setType(v as DocumentType)}
          >
            <SelectTrigger id="doc-type">
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
          <Label htmlFor="doc-expiry" className="flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Expiry (optional)
          </Label>
          <Input
            id="doc-expiry"
            type="date"
            value={expiry}
            onChange={(e) => setExpiry(e.target.value)}
            disabled={busy}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="doc-notes">Notes (optional)</Label>
          <Textarea
            id="doc-notes"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any context the next person opening this should know."
            disabled={busy}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={!ready}
        >
          {busy ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
            </>
          ) : (
            "Upload and link"
          )}
        </Button>
      </div>
    </div>
  );
}
