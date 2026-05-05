"use client";

import { useRef, useState } from "react";
import { Paperclip, Upload, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { attachToIncident } from "@/lib/actions/attachments";

type Props = {
  incidentId: string;
  initial?: { id: string; file_name: string; storage_path: string }[];
};

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED = ["image/", "application/pdf"];

export function FileUpload({ incidentId, initial = [] }: Props) {
  const [items, setItems] = useState<{ id: string; file_name: string; storage_path: string }[]>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);

    const supabase = createClient();
    const next: typeof items = [];

    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} exceeds 25 MB`);
        }
        if (!ALLOWED.some((a) => file.type.startsWith(a))) {
          throw new Error(`${file.name}: only images and PDFs are allowed`);
        }
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const safe = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
        const path = `${incidentId}/${safe}`;

        const { error: upErr } = await supabase.storage
          .from("incident-attachments")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        const result = await attachToIncident({
          incident_id: incidentId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "",
          size_bytes: file.size,
        });
        if (!result.ok) throw new Error(result.error);

        next.push({ id: result.data!.id, file_name: file.name, storage_path: path });
      }
      setItems((prev) => [...prev, ...next]);
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Attachments (optional)</span>
        <span className="text-xs text-muted-foreground">Images / PDFs · max 25 MB each</span>
      </div>

      <div className="rounded-md border border-dashed p-4 text-center">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
        >
          <Upload className="h-4 w-4" /> {busy ? "Uploading…" : "Add files"}
        </button>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-1.5 text-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="truncate">{it.file_name}</span>
              </span>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((p) => p.id !== it.id))}
                aria-label="Remove from list (file remains in storage)"
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
