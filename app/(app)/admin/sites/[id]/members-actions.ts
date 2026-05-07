"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

const AddSchema = z.object({
  site_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid(),
  include_children: z.coerce.boolean().optional(),
});

export async function addSiteMember(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = AddSchema.safeParse({
    site_id: fd.get("site_id"),
    profile_id: fd.get("profile_id"),
    role_id: fd.get("role_id"),
    include_children: fd.get("include_children") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("member:manage", parsed.data.site_id);

  const { error } = await supabase.rpc("add_site_member_v1", {
    p_site_id: parsed.data.site_id,
    p_profile_id: parsed.data.profile_id,
    p_role_id: parsed.data.role_id,
    p_include_children: parsed.data.include_children ?? false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  revalidatePath(`/admin/members/${parsed.data.profile_id}`);
  revalidatePath("/admin/members");
  return { ok: true };
}

const ChangeRoleSchema = z.object({
  site_id: z.string().uuid(),
  profile_id: z.string().uuid(),
  role_id: z.string().uuid(),
  include_children: z.coerce.boolean().optional(),
});

export async function changeSiteMemberRole(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = ChangeRoleSchema.safeParse({
    site_id: fd.get("site_id"),
    profile_id: fd.get("profile_id"),
    role_id: fd.get("role_id"),
    include_children: fd.get("include_children") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("member:manage", parsed.data.site_id);

  const { error } = await supabase.rpc("change_site_member_role_v1", {
    p_site_id: parsed.data.site_id,
    p_profile_id: parsed.data.profile_id,
    p_role_id: parsed.data.role_id,
    p_include_children: parsed.data.include_children ?? false,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  revalidatePath(`/admin/members/${parsed.data.profile_id}`);
  revalidatePath("/admin/members");
  return { ok: true };
}

const RemoveSchema = z.object({
  site_id: z.string().uuid(),
  profile_id: z.string().uuid(),
});

export async function removeSiteMember(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = RemoveSchema.safeParse({
    site_id: fd.get("site_id"),
    profile_id: fd.get("profile_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("member:manage", parsed.data.site_id);

  const { error } = await supabase.rpc("remove_site_member_v1", {
    p_site_id: parsed.data.site_id,
    p_profile_id: parsed.data.profile_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/admin/sites/${parsed.data.site_id}`);
  revalidatePath(`/admin/members/${parsed.data.profile_id}`);
  revalidatePath("/admin/members");
  return { ok: true };
}
