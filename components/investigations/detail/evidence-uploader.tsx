"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { attachInvestigationEvidence } from "@/app/(app)/investigations/[id]/actions";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["image/", "application/pdf"];

export function EvidenceUploader({ investigationId }: { investigationId: string }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);

    const supabase = createClient();
    let added = 0;

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
        const path = `${investigationId}/${safe}`;

        const { error: upErr } = await supabase.storage
          .from("investigation-evidence")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;

        const result = await attachInvestigationEvidence({
          investigation_id: investigationId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "",
          size_bytes: file.size,
        });
        if (!result.ok) throw new Error(result.error);
        added += 1;
      }
      toast.success(`Uploaded ${added} file${added === 1 ? "" : "s"}`);
      router.refresh();
      if (inputRef.current) inputRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-dashed p-6 text-center">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => upload(e.target.files)}
      />
      <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
      <p className="mt-2 text-sm">Drag photos or PDFs here, or click to browse.</p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        Images / PDFs · max 25 MB each.
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-3 inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
      >
        {busy ? "Uploading…" : "Add files"}
      </button>
    </div>
  );
}
