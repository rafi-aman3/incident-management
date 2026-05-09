"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";

const DEMO_OTP = process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS;

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
});

/**
 * Phase 12 — Request password reset.
 *
 * Always returns ok:true regardless of whether the email exists (no
 * enumeration leak). In demo mode also prints the magic link to the
 * server console so the developer can copy-paste it.
 */
export async function requestPasswordReset(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = schema.safeParse({ email: fd.get("email") });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const supabase = await createClient();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_VERCEL_URL ??
    "http://localhost:3000";
  const redirectTo = `${appUrl.replace(/\/$/, "")}/reset-password`;

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo,
  });

  // We deliberately swallow "User not found" so an attacker can't
  // enumerate which emails are registered. Real errors (network etc.)
  // still surface.
  if (error && !/not.*found|invalid/i.test(error.message)) {
    return { ok: false, error: error.message };
  }

  if (DEMO_OTP) {
    // Production wires real SMTP; demo prints the would-be link for grep-ability.
    console.log(
      `[DEMO] Password reset requested for ${parsed.data.email} — ` +
        `Supabase will email a magic link landing at ${redirectTo}`,
    );
  }

  return { ok: true };
}
