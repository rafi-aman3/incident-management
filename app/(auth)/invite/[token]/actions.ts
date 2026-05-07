"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { SELECTED_SITE_COOKIE } from "@/lib/supabase/auth";
import type { ActionResult } from "@/lib/incidents/schemas";

const Schema = z.object({
  token: z.string().min(1),
});

export async function acceptInvitation(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = Schema.safeParse({ token: fd.get("token") });
  if (!parsed.success) {
    return { ok: false, error: "Invalid invitation token" };
  }

  const supabase = await createClient();

  // Confirm the user is authenticated. The middleware allows /invite through
  // unauth, so we re-check here.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sign in to accept this invitation." };
  }

  const { data, error } = await supabase
    .rpc("accept_invitation_v1", { p_token: parsed.data.token })
    .single<{ org_id: string; site_id: string; site_name: string; role_id: string }>();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to accept invitation" };
  }

  // Land on the new site immediately by setting the cookie.
  (await cookies()).set(SELECTED_SITE_COOKIE, data.site_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  redirect(`/dashboard?invited=${encodeURIComponent(data.site_name)}`);
}
