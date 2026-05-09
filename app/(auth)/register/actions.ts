"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Phase 12 — Sign up.
 *
 * Calls auth.signUp with email + password + raw_user_meta_data.full_name.
 * Stores the password (base64) in a short-lived httpOnly cookie so the
 * /verify-otp success path (DEMO mode) can sign the user in. In production
 * mode, the cookie is harmless but unused — auth.verifyOtp handles the
 * password during signup verification natively.
 */

const PENDING_OTP_COOKIE = "pending_otp";
const PENDING_OTP_TTL_S = 300; // 5 minutes

const signUpSchema = z
  .object({
    full_name: z
      .string()
      .trim()
      .min(1, "Display name can't be empty")
      .max(120, "Display name is too long"),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    password: z.string().min(8, "At least 8 characters"),
    confirm_password: z.string().min(1, "Required"),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

export async function signUp(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const parsed = signUpSchema.safeParse({
    full_name: fd.get("full_name"),
    email: fd.get("email"),
    password: fd.get("password"),
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
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name },
    },
  });

  if (error) {
    // Supabase returns "User already registered" (or similar) for duplicate emails.
    // Surface as a field error on email rather than a generic toast.
    const msg = error.message ?? "Something went wrong";
    if (/already (registered|been registered|exists)/i.test(msg)) {
      return {
        ok: false,
        error: "Validation failed",
        fieldErrors: { email: ["This email is already registered. Try signing in instead."] },
      };
    }
    return { ok: false, error: msg };
  }

  // Cache the password for the demo OTP path. httpOnly + sameSite=strict
  // means JS can't read it and cross-site requests can't send it; 5min TTL
  // covers the verify step. In production mode this cookie isn't used but
  // also doesn't hurt to set.
  const cookieStore = await cookies();
  cookieStore.set(PENDING_OTP_COOKIE, Buffer.from(parsed.data.password).toString("base64"), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: PENDING_OTP_TTL_S,
    path: "/",
  });
  // Echo the email so /verify-otp can render the address being verified.
  cookieStore.set("pending_otp_email", parsed.data.email, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: PENDING_OTP_TTL_S,
    path: "/",
  });

  redirect(`/verify-otp?email=${encodeURIComponent(parsed.data.email)}`);
}
