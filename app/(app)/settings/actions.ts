"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Account-level settings actions. RLS does the per-user gating —
 * profiles_update_self (Phase 0 init.sql) restricts profile mutations
 * to auth.uid() = profiles.id, so no extra perm gate is needed.
 */

// ---------------------------------------------------------------------------
// Profile: full_name + department. Email stays read-only in v1 (changing
// email is a Supabase verification flow — deferred per plan).
// ---------------------------------------------------------------------------

const profileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(1, "Display name can't be empty")
    .max(120, "Display name is too long"),
  department: z
    .string()
    .trim()
    .max(120, "Department is too long")
    .nullable()
    .optional(),
});

export async function updateProfile(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: fd.get("full_name"),
    department: (fd.get("department") as string | null) || null,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      department: parsed.data.department ?? null,
    })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings");
  // Topbar avatar / dropdown reads full_name from profile — refresh layout cache.
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Password: re-auth via signInWithPassword BEFORE the update so a stolen
// session can't change pw without the current one. Then auth.updateUser.
// ---------------------------------------------------------------------------

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Required"),
    new_password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Required"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  })
  .refine((d) => d.new_password !== d.current_password, {
    message: "New password must differ from current",
    path: ["new_password"],
  });

export async function changePassword(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = passwordSchema.safeParse({
    current_password: fd.get("current_password"),
    new_password: fd.get("new_password"),
    confirm_password: fd.get("confirm_password"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, user } = await requireUser();
  if (!user.email) {
    return { ok: false, error: "No email on this account" };
  }

  // Re-auth check. supabase-js' signInWithPassword on the server-side
  // client mints a fresh session if successful — we don't care about the
  // session, only whether it succeeded (i.e., the typed password matches).
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: parsed.data.current_password,
  });
  if (reauthErr) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { current_password: ["Current password is incorrect"] },
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}

// ---------------------------------------------------------------------------
// Sign out from every device. Uses the service-role admin client (already
// shipped Phase 11c for /invite/[token] lookup) to invalidate every refresh
// token for this user, including the current session. Lands on /login with
// a banner via ?signed_out=everywhere.
// ---------------------------------------------------------------------------

export async function signOutEverywhere(): Promise<never> {
  const { user } = await requireUser();
  const admin = createAdminClient();
  await admin.auth.admin.signOut(user.id);
  redirect("/login?signed_out=everywhere");
}
