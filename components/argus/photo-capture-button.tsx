"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { attachToIncident } from "@/lib/actions/attachments";

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Photo capture for the Copilot panel. Opens the device camera on mobile via
 * `<input capture="environment">`. Falls back to the file picker on desktop.
 *
 * Reuses the existing `incident-attachments` bucket + path-prefix RLS pattern
 * from `components/incidents/wizard/file-upload.tsx`. On success, calls
 * `onUploaded(file_id, file_name)` so the parent can mention the upload to
 * the model on the next turn (the model then calls `attach_photo` with the
 * file_id to record the link explicitly).
 */
export function PhotoCaptureButton({
  incidentId,
  onUploaded,
  className,
}: {
  incidentId: string;
  onUploaded: (fileId: string, fileName: string) => void;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      if (file.size > MAX_BYTES) throw new Error(`${file.name} exceeds 25 MB`);
      if (!file.type.startsWith("image/")) throw new Error("Only image files allowed");

      const supabase = createClient();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const safe = `${crypto.randomUUID()}.${ext}`;
      const path = `${incidentId}/${safe}`;

      const { error: upErr } = await supabase.storage
        .from("incident-attachments")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (upErr) throw upErr;

      const result = await attachToIncident({
        incident_id: incidentId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (!result.ok) throw new Error(result.error);

      onUploaded(result.data!.id, file.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        title={busy ? "Uploading…" : "Take a photo"}
        className={className}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  );
}
