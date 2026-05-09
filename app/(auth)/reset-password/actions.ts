"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";

const schema = z
  .object({
    new_password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Required"),
  })
  .refine((d) => d.new_password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

/**
 * Phase 12 — Apply a fresh password after the user clicks the magic link
 * from a /forgot-password request. The link lands on /reset-password with
 * Supabase's session already established (callback route or implicit flow);
 * the user just needs to type the new password.
 */
export async function setNewPassword(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = schema.safeParse({
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

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      error:
        "Reset link expired or missing. Request a new password reset email.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.new_password,
  });
  if (error) return { ok: false, error: error.message };

  await supabase.auth.signOut();
  redirect("/login?password_reset=1");
}
