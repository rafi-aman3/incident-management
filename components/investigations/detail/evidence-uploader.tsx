"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { attachInvestigationEvidence } from "@/app/(app)/investigations/[id]/actions";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["image/", "application/pdf"];

function isAllowed(file: File): true | string {
  if (file.size > MAX_BYTES) return `${file.name} exceeds 25 MB`;
  if (!ALLOWED.some((a) => file.type.startsWith(a))) {
    return `${file.name}: only images and PDFs are allowed`;
  }
  return true;
}

export function EvidenceUploader({ investigationId }: { investigationId: string }) {
  const [busy, setBusy] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const upload = async (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    if (list.length === 0) return;
    setBusy(true);

    const supabase = createClient();
    const succeeded: string[] = [];
    const failed: { name: string; reason: string }[] = [];

    for (const file of list) {
      const guard = isAllowed(file);
      if (guard !== true) {
        failed.push({ name: file.name, reason: guard });
        continue;
      }
      try {
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
        const safe = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
        const path = `${investigationId}/${safe}`;

        const { error: upErr } = await supabase.storage
          .from("investigation-evidence")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) {
          failed.push({ name: file.name, reason: upErr.message });
          continue;
        }

        const result = await attachInvestigationEvidence({
          investigation_id: investigationId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type || "",
          size_bytes: file.size,
        });
        if (!result.ok) {
          failed.push({ name: file.name, reason: result.error });
          continue;
        }
        succeeded.push(file.name);
      } catch (e) {
        failed.push({
          name: file.name,
          reason: e instanceof Error ? e.message : "Upload failed",
        });
      }
    }

    if (succeeded.length > 0) {
      toast.success(
        `Uploaded ${succeeded.length} file${succeeded.length === 1 ? "" : "s"}`,
      );
    }
    for (const f of failed) {
      toast.error(`${f.name}: ${f.reason}`);
    }
    if (succeeded.length > 0) router.refresh();
    if (inputRef.current) inputRef.current.value = "";
    setBusy(false);
  };

  return (
    <div
      onDragEnter={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(true);
      }}
      onDragLeave={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer?.files) void upload(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-md border border-dashed p-6 text-center transition-colors",
        dragActive && "border-primary bg-primary/5",
      )}
    >
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
        Images / PDFs · max 25 MB each. Failed files don&apos;t block successful ones.
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
