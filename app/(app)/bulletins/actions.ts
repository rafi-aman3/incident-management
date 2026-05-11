"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission, can } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

const TITLE_MAX = 200;
const SUMMARY_MAX = 300;
const BODY_MAX = 50_000;

const CreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX),
  summary: z.string().trim().max(SUMMARY_MAX).optional(),
  body: z.string().max(BODY_MAX),
  source_incident_id: z.string().uuid().optional().or(z.literal("")),
  source_investigation_id: z.string().uuid().optional().or(z.literal("")),
});

export async function createBulletin(
  _prev: ActionResult<{ id: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = CreateSchema.safeParse({
    title: fd.get("title"),
    summary: fd.get("summary") ?? undefined,
    body: fd.get("body") ?? "",
    source_incident_id: fd.get("source_incident_id") ?? "",
    source_investigation_id: fd.get("source_investigation_id") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, user, currentSiteId, profile } = await requireUser();
  await requirePermission("bulletin:create", currentSiteId);

  const intent = (fd.get("intent") as string | null) ?? "save_draft";
  const wantPublish = intent === "publish";
  if (wantPublish) {
    await requirePermission("bulletin:publish", currentSiteId);
  }

  const { data, error } = await supabase
    .from("safety_bulletins")
    .insert({
      org_id: profile.org_id,
      title: parsed.data.title,
      summary: parsed.data.summary || null,
      body: parsed.data.body,
      source_incident_id: parsed.data.source_incident_id || null,
      source_investigation_id: parsed.data.source_investigation_id || null,
      created_by: user.id,
      status: wantPublish ? "published" : "draft",
      published_at: wantPublish ? new Date().toISOString() : null,
    })
    .select("id, source_investigation_id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create bulletin" };
  }

  revalidatePath("/bulletins");
  revalidatePath("/dashboard");
  if (data.source_investigation_id) {
    revalidatePath(`/investigations/${data.source_investigation_id}`);
  }
  redirect(`/bulletins/${data.id}`);
}

const UpdateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().min(1, "Title is required").max(TITLE_MAX),
  summary: z.string().trim().max(SUMMARY_MAX).optional(),
  body: z.string().max(BODY_MAX),
});

export async function updateBulletin(
  _prev: ActionResult<{ id: string }> | null,
  fd: FormData,
): Promise<ActionResult<{ id: string }>> {
  const parsed = UpdateSchema.safeParse({
    id: fd.get("id"),
    title: fd.get("title"),
    summary: fd.get("summary") ?? undefined,
    body: fd.get("body") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase, currentSiteId } = await requireUser();
  await requirePermission("bulletin:create", currentSiteId);

  const intent = (fd.get("intent") as string | null) ?? "save_draft";
  const wantPublish = intent === "publish";
  if (wantPublish) {
    await requirePermission("bulletin:publish", currentSiteId);
  }

  const patch = wantPublish
    ? {
        title: parsed.data.title,
        summary: parsed.data.summary || null,
        body: parsed.data.body,
        status: "published" as const,
        published_at: new Date().toISOString(),
      }
    : {
        title: parsed.data.title,
        summary: parsed.data.summary || null,
        body: parsed.data.body,
      };

  const { data, error } = await supabase
    .from("safety_bulletins")
    .update(patch)
    .eq("id", parsed.data.id)
    .select("id, source_investigation_id")
    .single();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to update bulletin" };
  }

  revalidatePath("/bulletins");
  revalidatePath(`/bulletins/${data.id}`);
  revalidatePath("/dashboard");
  if (data.source_investigation_id) {
    revalidatePath(`/investigations/${data.source_investigation_id}`);
  }
  redirect(`/bulletins/${data.id}`);
}

export async function publishBulletin(id: string): Promise<ActionResult> {
  const { supabase, currentSiteId } = await requireUser();
  if (!(await can("bulletin:publish", currentSiteId))) {
    return { ok: false, error: "Forbidden" };
  }
  const { error } = await supabase
    .from("safety_bulletins")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bulletins");
  revalidatePath(`/bulletins/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function unpublishBulletin(id: string): Promise<ActionResult> {
  const { supabase, currentSiteId } = await requireUser();
  if (!(await can("bulletin:publish", currentSiteId))) {
    return { ok: false, error: "Forbidden" };
  }
  const { error } = await supabase
    .from("safety_bulletins")
    .update({ status: "draft", published_at: null })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bulletins");
  revalidatePath(`/bulletins/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archiveBulletin(id: string): Promise<ActionResult> {
  const { supabase, currentSiteId } = await requireUser();
  if (!(await can("bulletin:publish", currentSiteId))) {
    return { ok: false, error: "Forbidden" };
  }
  const { error } = await supabase
    .from("safety_bulletins")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/bulletins");
  revalidatePath(`/bulletins/${id}`);
  revalidatePath("/dashboard");
  return { ok: true };
}
