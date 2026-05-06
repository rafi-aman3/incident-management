"use server";

/**
 * Server actions for the Phase 4 documents library + polymorphic links.
 *
 * Wraps the four RPCs (`link_document_v1`, `unlink_document_v1`,
 * `archive_document_v1`, `replace_document_file_v1`) and direct table
 * writes for create / metadata-edit / library-list. Mirrors the
 * ActionResult pattern from `lib/actions/attachments.ts`.
 *
 * Storage upload happens client-side (`lib/documents/upload.ts`); these
 * actions only persist metadata + auth-check.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";
import {
  DocumentMetadataSchema,
  DocumentTypeSchema,
  DocumentUploadSchema,
  LinkDocumentSchema,
  type DocumentLinkParent,
  type DocumentType,
} from "@/lib/documents/types";

// ---------------------------------------------------------------------------
// Library row shape returned by listOrgDocuments — kept narrow so the
// picker doesn't pull more than it needs.
// ---------------------------------------------------------------------------
export type DocumentLibraryRow = {
  id: string;
  name: string;
  type: DocumentType;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  expiry_date: string | null;
  uploaded_at: string;
  uploaded_by_name: string | null;
  site_id: string | null;
  link_count: number;
};

// ---------------------------------------------------------------------------
// listOrgDocuments — used by <DocumentLinkPicker> "From library" tab.
// Filters: type, search query, site scope. Excludes archived rows.
// ---------------------------------------------------------------------------
const ListSchema = z.object({
  type:    DocumentTypeSchema.optional(),
  q:       z.string().trim().max(200).optional(),
  site_id: z.string().uuid().nullable().optional(),
  limit:   z.number().int().positive().max(200).default(60),
});
export type ListOrgDocumentsInput = z.infer<typeof ListSchema>;

export async function listOrgDocuments(
  input: ListOrgDocumentsInput = { limit: 60 },
): Promise<ActionResult<DocumentLibraryRow[]>> {
  const parsed = ListSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid filter" };
  }
  const { supabase, profile } = await requireUser();

  let query = supabase
    .from("documents")
    .select(
      "id, name, type, file_name, mime_type, size_bytes, expiry_date, uploaded_at, site_id, uploaded_by, profiles:uploaded_by(full_name, email)",
    )
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(parsed.data.limit);

  if (parsed.data.type) query = query.eq("type", parsed.data.type);
  if (parsed.data.site_id) query = query.eq("site_id", parsed.data.site_id);
  if (parsed.data.q) {
    const q = parsed.data.q.replace(/[%_]/g, "");
    query = query.or(`name.ilike.%${q}%,file_name.ilike.%${q}%`);
  }

  const { data, error } = await query;
  if (error) return { ok: false, error: error.message };

  // Bulk-fetch link counts for the page of documents to render
  // "Linked from N records" in the picker. One extra query, scoped to the
  // returned ids.
  const ids = (data ?? []).map((d) => d.id);
  let counts: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: linkRows } = await supabase
      .from("document_links")
      .select("document_id")
      .in("document_id", ids)
      .is("removed_at", null);
    counts = (linkRows ?? []).reduce<Record<string, number>>((acc, row) => {
      acc[row.document_id] = (acc[row.document_id] ?? 0) + 1;
      return acc;
    }, {});
  }

  type Joined = {
    id: string;
    name: string;
    type: DocumentType;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    expiry_date: string | null;
    uploaded_at: string;
    site_id: string | null;
    uploaded_by: string | null;
    profiles: { full_name: string | null; email: string } | null;
  };

  const rows: DocumentLibraryRow[] = ((data ?? []) as Joined[]).map((d) => ({
    id: d.id,
    name: d.name,
    type: d.type,
    file_name: d.file_name,
    mime_type: d.mime_type,
    size_bytes: d.size_bytes,
    expiry_date: d.expiry_date,
    uploaded_at: d.uploaded_at,
    uploaded_by_name: d.profiles?.full_name ?? d.profiles?.email ?? null,
    site_id: d.site_id,
    link_count: counts[d.id] ?? 0,
  }));

  return { ok: true, data: rows };
}

// ---------------------------------------------------------------------------
// createDocument — persists the row after a client-side upload.
// ---------------------------------------------------------------------------
export async function createDocument(
  input: z.input<typeof DocumentUploadSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = DocumentUploadSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid document",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile, user } = await requireUser();

  const { data, error } = await supabase
    .from("documents")
    .insert({
      org_id: profile.org_id,
      site_id: parsed.data.site_id ?? null,
      name: parsed.data.name,
      type: parsed.data.type,
      storage_path: parsed.data.storage_path,
      file_name: parsed.data.file_name,
      mime_type: parsed.data.mime_type,
      size_bytes: parsed.data.size_bytes,
      expiry_date: parsed.data.expiry_date ?? null,
      notes: parsed.data.notes || null,
      uploaded_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message ?? "Insert failed" };

  // Activity event — RPCs handle their own audit, but the bare insert
  // path doesn't, so write one here to keep the timeline complete.
  await supabase.from("activity_events").insert({
    document_id: data.id,
    actor_id: user.id,
    verb: "document.uploaded",
    payload: {
      type: parsed.data.type,
      name: parsed.data.name,
      size_bytes: parsed.data.size_bytes,
      file_name: parsed.data.file_name,
    },
  });

  revalidatePath("/resources/documents");
  return { ok: true, data: { id: data.id } };
}

// ---------------------------------------------------------------------------
// updateDocumentMetadata — name / type / site / expiry / notes only
// (file replacement uses replaceDocumentFile, which goes through an RPC).
// ---------------------------------------------------------------------------
export async function updateDocumentMetadata(
  documentId: string,
  input: z.input<typeof DocumentMetadataSchema>,
): Promise<ActionResult<void>> {
  const parsed = DocumentMetadataSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid metadata",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { supabase, profile } = await requireUser();

  const { error } = await supabase
    .from("documents")
    .update({
      name: parsed.data.name,
      type: parsed.data.type,
      site_id: parsed.data.site_id ?? null,
      expiry_date: parsed.data.expiry_date ?? null,
      notes: parsed.data.notes || null,
    })
    .eq("id", documentId)
    .eq("org_id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/resources/documents");
  revalidatePath(`/resources/documents/${documentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// replaceDocumentFile — wraps replace_document_file_v1 RPC.
// Caller has already uploaded the new file via uploadDocumentFile().
// ---------------------------------------------------------------------------
const ReplaceSchema = z.object({
  storage_path: z.string().min(1).max(500),
  file_name:    z.string().min(1).max(255),
  mime_type:    z.string().min(1).max(120),
  size_bytes:   z.number().int().nonnegative(),
});
export async function replaceDocumentFile(
  documentId: string,
  input: z.input<typeof ReplaceSchema>,
): Promise<ActionResult<void>> {
  const parsed = ReplaceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid file" };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("replace_document_file_v1", {
    p_document_id:  documentId,
    p_storage_path: parsed.data.storage_path,
    p_file_name:    parsed.data.file_name,
    p_mime_type:    parsed.data.mime_type,
    p_size_bytes:   parsed.data.size_bytes,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/resources/documents/${documentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// archiveDocument — wraps archive_document_v1 RPC.
// `force=true` archives even when active links exist.
// ---------------------------------------------------------------------------
export async function archiveDocument(
  documentId: string,
  reason?: string,
  force = false,
): Promise<ActionResult<void>> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("archive_document_v1", {
    p_document_id: documentId,
    p_reason:      reason ?? undefined,
    p_force:       force,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/resources/documents");
  revalidatePath(`/resources/documents/${documentId}`);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// linkDocument — wraps link_document_v1 RPC. Returns the link id (which
// is the same as the existing one when idempotent).
// ---------------------------------------------------------------------------
export async function linkDocument(
  input: z.input<typeof LinkDocumentSchema>,
): Promise<ActionResult<{ link_id: string }>> {
  const parsed = LinkDocumentSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid link" };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("link_document_v1", {
    p_document_id: parsed.data.document_id,
    p_parent_type: parsed.data.parent_type,
    p_parent_id:   parsed.data.parent_id,
    p_link_role:   parsed.data.link_role || undefined,
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Link failed" };

  invalidateParentPath(parsed.data.parent_type, parsed.data.parent_id);
  revalidatePath(`/resources/documents/${parsed.data.document_id}`);

  return { ok: true, data: { link_id: data as string } };
}

// ---------------------------------------------------------------------------
// unlinkDocument — wraps unlink_document_v1 RPC.
// ---------------------------------------------------------------------------
const UnlinkSchema = z.object({
  link_id:     z.string().uuid(),
  parent_type: z.enum([
    "incident","investigation","capa","asset","site","inspection","finding",
  ]),
  parent_id:   z.string().uuid(),
  document_id: z.string().uuid().optional(),
});
export async function unlinkDocument(
  input: z.input<typeof UnlinkSchema>,
): Promise<ActionResult<void>> {
  const parsed = UnlinkSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid unlink" };
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("unlink_document_v1", {
    p_link_id: parsed.data.link_id,
  });
  if (error) return { ok: false, error: error.message };

  invalidateParentPath(parsed.data.parent_type, parsed.data.parent_id);
  if (parsed.data.document_id) {
    revalidatePath(`/resources/documents/${parsed.data.document_id}`);
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function invalidateParentPath(parentType: DocumentLinkParent, parentId: string) {
  switch (parentType) {
    case "incident":      revalidatePath(`/incidents/${parentId}`); break;
    case "investigation": revalidatePath(`/investigations/${parentId}`); break;
    case "capa":          revalidatePath(`/capa/${parentId}`); break;
    case "asset":         revalidatePath(`/resources/assets/${parentId}`); break;
    case "site":          revalidatePath(`/admin/sites/${parentId}`); break;
    case "inspection":    revalidatePath(`/inspections/${parentId}`); break;
    case "finding":       /* finding pages are nested under inspection — caller can pass inspection_id when needed */ break;
  }
}
