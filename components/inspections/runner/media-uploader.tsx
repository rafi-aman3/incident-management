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
const UPLOAD_TIMEOUT_MS = 30_000;

type UploadOutcome =
  | {
      ok: true;
      uploadId: string;
      fileName: string;
      storagePath: string;
      previewUrl: string;
    }
  | { ok: false; fileName: string; error: string };

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

  async function uploadOne(file: File): Promise<UploadOutcome> {
    if (file.size > MAX_BYTES) {
      return { ok: false, fileName: file.name, error: "exceeds 25 MB" };
    }
    if (!file.type.startsWith("image/")) {
      return {
        ok: false,
        fileName: file.name,
        error: "only image files are supported",
      };
    }

    const supabase = createClient();
    const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
    const safe = `${crypto.randomUUID()}.${ext}`;
    const path = `${inspectionId}/${safe}`;

    // supabase-js storage upload doesn't honor an AbortSignal directly, so we
    // race the upload against a timeout that rejects after UPLOAD_TIMEOUT_MS.
    // The underlying request may still complete in the background, but we
    // stop waiting and surface a failure for this file.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);
    try {
      const uploadPromise = supabase.storage
        .from("inspection-uploads")
        .upload(path, file, { upsert: false, contentType: file.type });
      const abortPromise = new Promise<never>((_, reject) => {
        controller.signal.addEventListener("abort", () =>
          reject(new Error("upload stalled — timed out after 30s")),
        );
      });
      const { error: upErr } = await Promise.race([uploadPromise, abortPromise]);
      if (upErr) return { ok: false, fileName: file.name, error: upErr.message };

      const res = await attachInspectionUpload({
        inspection_id: inspectionId,
        item_id: itemId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (!res.ok) return { ok: false, fileName: file.name, error: res.error };

      return {
        ok: true,
        uploadId: res.data!.id,
        fileName: file.name,
        storagePath: path,
        previewUrl: URL.createObjectURL(file),
      };
    } catch (e) {
      return {
        ok: false,
        fileName: file.name,
        error: e instanceof Error ? e.message : "Upload failed",
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const list = Array.from(files);
    setBusy(true);
    try {
      const successes: InspectionAnswerUpload[] = [];
      const newPreviews: Record<string, string> = {};
      const failures: { fileName: string; error: string }[] = [];

      for (const file of list) {
        const outcome = await uploadOne(file);
        if (outcome.ok) {
          successes.push({
            id: outcome.uploadId,
            name: outcome.fileName,
            storage_path: outcome.storagePath,
          });
          newPreviews[outcome.uploadId] = outcome.previewUrl;
        } else {
          failures.push({ fileName: outcome.fileName, error: outcome.error });
        }
      }

      if (successes.length > 0) {
        setPreviews((p) => ({ ...p, ...newPreviews }));
        onChange([...uploads, ...successes]);
        toast.success(
          successes.length === list.length
            ? successes.length === 1
              ? "Photo uploaded"
              : `Uploaded ${successes.length} photos`
            : `Uploaded ${successes.length} of ${list.length}`,
        );
      }

      for (const f of failures) {
        toast.error(`${f.fileName}: ${f.error}`);
      }

      if (fileRef.current) fileRef.current.value = "";
      if (cameraRef.current) cameraRef.current.value = "";
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
          aria-label="Capture photo from camera"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 sm:hidden sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          <Camera className="h-4 w-4" /> Capture photo
        </button>
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => fileRef.current?.click()}
          aria-label="Upload images from device"
          className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border bg-background px-3 py-2.5 text-sm font-medium hover:bg-accent disabled:opacity-50 sm:min-h-0 sm:py-1.5 sm:text-xs"
        >
          <Upload className="h-4 w-4 sm:h-3 sm:w-3" />{" "}
          {busy ? "Uploading…" : "Upload images"}
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
                  className="absolute right-1 top-1 rounded-md bg-background/80 p-1 text-destructive opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Remove ${u.name}`}
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
