"use client";

/**
 * Client-side upload helper for the org-wide `documents` bucket.
 *
 * Path layout: `<org_id>/<uuid>-<safe_filename>`.
 * The bucket's RLS reads the first path segment as the owning org, so the
 * caller MUST pass the user's current org_id. Server actions
 * (`createDocument`) re-validate size + MIME and accept the path returned
 * here.
 */

import { createClient } from "@/lib/supabase/client";
import {
  ALLOWED_DOCUMENT_MIMES,
  DOCUMENTS_BUCKET,
  MAX_DOCUMENT_BYTES,
} from "./types";

export type UploadedDocumentFile = {
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

/**
 * Uploads a single file to the `documents` bucket and returns the
 * metadata you'll pass to `createDocument` / `replaceDocumentFile`.
 *
 * Throws Error with a user-displayable message on size / MIME / RLS
 * failure. Callers should wrap in try/catch and `toast.error` the message.
 */
export async function uploadDocumentFile(
  file: File,
  orgId: string,
): Promise<UploadedDocumentFile> {
  if (!orgId) {
    throw new Error("Missing org context — please refresh and try again");
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error(
      `${file.name} exceeds 25 MB (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
    );
  }
  if (!(ALLOWED_DOCUMENT_MIMES as readonly string[]).includes(file.type)) {
    throw new Error(
      `${file.name}: unsupported file type. Allowed: PNG, JPG, PDF, DOC/DOCX, XLS/XLSX.`,
    );
  }

  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const safeName = `${crypto.randomUUID()}${ext ? `.${ext}` : ""}`;
  const path = `${orgId}/${safeName}`;

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });
  if (error) {
    // Surface RLS / size / network errors verbatim — matches existing
    // media-uploader.tsx pattern.
    throw new Error(error.message || "Upload failed");
  }

  return {
    storage_path: path,
    file_name: file.name,
    mime_type: file.type,
    size_bytes: file.size,
  };
}

/**
 * Resolves a short-lived signed URL for previewing or downloading a
 * stored document. RLS on the SELECT path enforces org match; the signed
 * URL is just a convenience wrapper.
 */
export async function getSignedDocumentUrl(
  storagePath: string,
  expiresInSeconds = 60 * 5,
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(storagePath, expiresInSeconds);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not sign URL");
  }
  return data.signedUrl;
}
