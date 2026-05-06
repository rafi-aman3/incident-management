"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Camera, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  attachInspectionUpload,
  removeInspectionUpload,
} from "@/app/(app)/inspections/actions";
import type { InspectionAnswerUpload } from "@/lib/templates/types";

const MAX_BYTES = 25 * 1024 * 1024;

export function MediaUploader({
  inspectionId,
  itemId,
  uploads,
  onChange,
  disabled,
}: {
  inspectionId: string;
  itemId: string;
  uploads: InspectionAnswerUpload[];
  onChange: (next: InspectionAnswerUpload[]) => void;
  disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    const supabase = createClient();
    const next: InspectionAnswerUpload[] = [];
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_BYTES) {
          throw new Error(`${file.name} exceeds 25 MB`);
        }
        if (!file.type.startsWith("image/")) {
          throw new Error(`${file.name}: only images are supported`);
        }
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
        const safe = `${crypto.randomUUID()}.${ext}`;
        const path = `${inspectionId}/${safe}`;
        const { error: upErr } = await supabase.storage
          .from("inspection-uploads")
          .upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) throw upErr;
        const res = await attachInspectionUpload({
          inspection_id: inspectionId,
          item_id: itemId,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (!res.ok) throw new Error(res.error);
        const upload: InspectionAnswerUpload = {
          id: res.data!.id,
          name: file.name,
          storage_path: path,
        };
        next.push(upload);
        setPreviews((p) => ({ ...p, [upload.id]: URL.createObjectURL(file) }));
      }
      onChange([...uploads, ...next]);
      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemove(uploadId: string) {
    const res = await removeInspectionUpload(uploadId);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    onChange(uploads.filter((u) => u.id !== uploadId));
    setPreviews((p) => {
      const n = { ...p };
      delete n[uploadId];
      return n;
    });
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/*"
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => uploadFiles(e.target.files)}
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => cameraRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50 sm:hidden"
        >
          <Camera className="h-3 w-3" /> Capture photo
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
        >
          <Upload className="h-3 w-3" /> {busy ? "Uploading…" : "Upload images"}
        </button>
      </div>

      {uploads.length > 0 && (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {uploads.map((u) => {
            const localPreview = previews[u.id];
            return (
              <li
                key={u.id}
                className="group relative overflow-hidden rounded-md border bg-muted"
              >
                {localPreview ? (
                  <Image
                    src={localPreview}
                    alt={u.name}
                    width={120}
                    height={90}
                    unoptimized
                    className="h-24 w-full object-cover"
                  />
                ) : (
                  <div className="flex h-24 items-center justify-center bg-muted/50 text-[11px] text-muted-foreground">
                    {u.name.length > 18 ? u.name.slice(0, 18) + "…" : u.name}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => handleRemove(u.id)}
                  className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-destructive opacity-0 transition group-hover:opacity-100"
                  aria-label="Remove"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
