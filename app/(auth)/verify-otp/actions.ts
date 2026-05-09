"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Phase 12 — OTP verification.
 *
 * Demo mode (NEXT_PUBLIC_DEMO_OTP_BYPASS env var set, value "8484" by
 * default): typing the magic code → admin client confirms the email +
 * signs the user in via the cached password from the pending_otp cookie.
 *
 * Production mode (env var unset): uses Supabase's email-OTP flow via
 * auth.verifyOtp({ email, token, type: "signup" }).
 *
 * Either path lands the user on /onboarding with a real auth.session.
 */

const DEMO_OTP = process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS;
const RESEND_COOLDOWN_MS = 60_000;

const verifySchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,6}$/, "Enter the 4–6 digit code"),
});

export async function verifyOtp(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = verifySchema.safeParse({
    email: fd.get("email"),
    code: fd.get("code"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { email, code } = parsed.data;
  const cookieStore = await cookies();

  // ---- Demo path ----
  if (DEMO_OTP && code === DEMO_OTP) {
    const admin = createAdminClient();

    // Look up the user via paginated listUsers (admin SDK doesn't expose
    // getUserByEmail in older versions; we fall back to listUsers + filter).
    const { data: { users }, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) return { ok: false, error: listErr.message };
    const user = users.find((u) => u.email?.toLowerCase() === email);
    if (!user) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { email: ["No pending signup found for this email."] },
      };
    }

    // Mark email confirmed (idempotent — repeats are no-ops).
    if (!user.email_confirmed_at) {
      const { error: confirmErr } = await admin.auth.admin.updateUserById(user.id, {
        email_confirm: true,
      });
      if (confirmErr) return { ok: false, error: confirmErr.message };
    }

    // Read the pending password cookie to sign the user in.
    const pendingPwB64 = cookieStore.get("pending_otp")?.value;
    if (!pendingPwB64) {
      // Cookie expired (>5min) — bounce to /login with a hint.
      cookieStore.delete("pending_otp_email");
      redirect("/login?after_verify=1");
    }

    const password = Buffer.from(pendingPwB64, "base64").toString("utf-8");
    cookieStore.delete("pending_otp");
    cookieStore.delete("pending_otp_email");

    const supabase = await createClient();
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr) return { ok: false, error: signInErr.message };

    redirect("/onboarding");
  }

  // ---- Production path ----
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: code,
    type: "signup",
  });
  if (error) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: { code: ["That code didn't match. Try again or resend."] },
    };
  }

  cookieStore.delete("pending_otp");
  cookieStore.delete("pending_otp_email");
  redirect("/onboarding");
}

const resendSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export async function resendOtp(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = resendSchema.safeParse({ email: fd.get("email") });
  if (!parsed.success) return { ok: false, error: "Invalid email" };
  const { email } = parsed.data;

  const cookieStore = await cookies();
  const lastSentRaw = cookieStore.get("otp_resent_at")?.value;
  const lastSent = lastSentRaw ? Number(lastSentRaw) : 0;
  const elapsed = Date.now() - lastSent;
  if (lastSent && elapsed < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
    return {
      ok: false,
      error: `Please wait ${wait}s before resending.`,
    };
  }

  // Demo mode: no-op success (the magic code is always 8484; nothing to send).
  // Production mode: Supabase resends the signup OTP via resend().
  if (!DEMO_OTP) {
    const supabase = await createClient();
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) return { ok: false, error: error.message };
  }

  cookieStore.set("otp_resent_at", String(Date.now()), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 120,
    path: "/",
  });
  return { ok: true };
}
