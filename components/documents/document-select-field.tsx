"use client";

/**
 * <DocumentSelectField> — pick a single document from the org library and
 * store its id in a hidden form input. Unlike <DocumentLinkPicker>, this
 * does NOT write a document_links row — it just sets a denormalized FK
 * (e.g. assets.sds_document_id). Used in places where the field is
 * 1:1 with the parent record and the lookup is fast-path.
 */

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, Search, X } from "lucide-react";
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
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  DOCUMENT_TYPE_ICON,
  type DocumentType,
} from "@/lib/documents/types";
import {
  listOrgDocuments,
  type DocumentLibraryRow,
} from "@/lib/actions/documents";

export function DocumentSelectField({
  name,
  defaultValue,
  defaultLabel,
  defaultTypeFilter,
  label = "Linked document",
  placeholder = "No document selected",
}: {
  /** Hidden input name — emitted as a uuid string. */
  name: string;
  defaultValue?: string | null;
  defaultLabel?: string | null;
  defaultTypeFilter?: DocumentType;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string | null>(defaultValue ?? null);
  const [pickedLabel, setPickedLabel] = useState<string | null>(defaultLabel ?? null);

  function clear() {
    setPickedId(null);
    setPickedLabel(null);
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">{label}</label>
      <input type="hidden" name={name} value={pickedId ?? ""} />
      <div className="flex items-center gap-2">
        {pickedId && pickedLabel ? (
          <div className="flex flex-1 items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate">{pickedLabel}</span>
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <p className="flex-1 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
            {placeholder}
          </p>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setOpen(true)}
        >
          {pickedId ? "Change" : "Choose"}
        </Button>
      </div>

      <PickerDialog
        open={open}
        defaultTypeFilter={defaultTypeFilter}
        onClose={() => setOpen(false)}
        onPick={(row) => {
          setPickedId(row.id);
          setPickedLabel(row.name);
          setOpen(false);
        }}
      />
    </div>
  );
}

function PickerDialog({
  open,
  defaultTypeFilter,
  onClose,
  onPick,
}: {
  open: boolean;
  defaultTypeFilter?: DocumentType;
  onClose: () => void;
  onPick: (row: DocumentLibraryRow) => void;
}) {
  const [rows, setRows] = useState<DocumentLibraryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [type, setType] = useState<DocumentType | "all">(defaultTypeFilter ?? "all");

  // Reset filters whenever the dialog re-opens
  useEffect(() => {
    if (open) {
      setQ("");
      setType(defaultTypeFilter ?? "all");
    }
  }, [open, defaultTypeFilter]);

  useEffect(() => {
    if (!open) return;
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
  }, [open, q, type]);

  const filterChips = useMemo(
    () =>
      ["all" as const, ...DOCUMENT_TYPES].slice(0, 7), // keep one row of chips
    [],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? onClose() : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose a document</DialogTitle>
          <DialogDescription>
            Pick a file from the org library to associate with this record.
            To upload a new file, head to{" "}
            <a href="/resources/documents/new" className="underline">
              Documents → Upload
            </a>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or filename"
              className="h-9 pl-8"
            />
          </div>

          <div className="flex flex-wrap gap-1">
            {filterChips.map((t) => {
              const isAll = t === "all";
              const active = (isAll && type === "all") || t === type;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(isAll ? "all" : (t as DocumentType))}
                  className={`rounded-md border px-2 py-0.5 text-[11px] ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {isAll ? "All" : DOCUMENT_TYPE_LABEL[t as DocumentType]}
                </button>
              );
            })}
          </div>

          <div className="max-h-[50vh] overflow-y-auto rounded-md border">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No documents match.
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => {
                  const Icon = DOCUMENT_TYPE_ICON[row.type];
                  return (
                    <li key={row.id}>
                      <button
                        type="button"
                        onClick={() => onPick(row)}
                        className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent"
                      >
                        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{row.name}</p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {DOCUMENT_TYPE_LABEL[row.type]} · {row.file_name}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
