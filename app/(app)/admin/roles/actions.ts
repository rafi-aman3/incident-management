"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requireOrgPermission } from "@/lib/auth/orgCan";
import type { ActionResult } from "@/lib/incidents/schemas";

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Role name is required").max(80, "Role name is too long"),
  description: z.string().trim().max(280).optional(),
  permission_keys: z.array(z.string()).default([]),
});

export type CreateRoleResult = ActionResult & { roleId?: string };

export async function createRole(
  _prev: CreateRoleResult | null,
  fd: FormData,
): Promise<CreateRoleResult> {
  const parsed = CreateSchema.safeParse({
    name: fd.get("name"),
    description: fd.get("description") ?? undefined,
    permission_keys: fd.getAll("permission_keys").map(String),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requireOrgPermission("role:create");

  const { data, error } = await supabase.rpc("create_role_v1", {
    p_name: parsed.data.name,
    p_description: parsed.data.description ?? "",
    p_permission_keys: parsed.data.permission_keys,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  return { ok: true, roleId: data as string };
}

const UpdateSchema = z.object({
  role_id: z.string().uuid(),
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().max(280).optional(),
  // null sentinel allowed: "" => clear description; absent => leave alone.
  permission_keys: z.array(z.string()).optional(),
});

export async function updateRole(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const rawPermKeys = fd.getAll("permission_keys").map(String);
  // The form always submits permission_keys (possibly empty); we treat the
  // hidden marker `permission_keys_set=1` as "yes, the form intends to set
  // the keys". Without that marker, leave the set unchanged.
  const setPerms = fd.get("permission_keys_set") === "1";

  const parsed = UpdateSchema.safeParse({
    role_id: fd.get("role_id"),
    name: (fd.get("name") as string | null)?.toString() || undefined,
    description: (fd.get("description") as string | null)?.toString() ?? undefined,
    permission_keys: setPerms ? rawPermKeys : undefined,
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requireOrgPermission("role:edit");

  const { error } = await supabase.rpc("update_role_v1", {
    p_role_id: parsed.data.role_id,
    ...(parsed.data.name !== undefined ? { p_name: parsed.data.name } : {}),
    ...(parsed.data.description !== undefined
      ? { p_description: parsed.data.description }
      : {}),
    ...(parsed.data.permission_keys !== undefined
      ? { p_permission_keys: parsed.data.permission_keys }
      : {}),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roles");
  revalidatePath(`/admin/roles/${parsed.data.role_id}`);
  return { ok: true };
}

const DeleteSchema = z.object({
  role_id: z.string().uuid(),
});

export async function deleteRole(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = DeleteSchema.safeParse({ role_id: fd.get("role_id") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requireOrgPermission("role:delete");

  const { error } = await supabase.rpc("delete_role_v1", {
    p_role_id: parsed.data.role_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/roles");
  revalidatePath("/admin");
  redirect("/admin/roles");
}
