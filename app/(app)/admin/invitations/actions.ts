"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/incidents/schemas";

const CreateSchema = z.object({
  site_id: z.string().uuid(),
  email: z.string().trim().email("Enter a valid email"),
  role_id: z.string().uuid(),
  include_children: z.coerce.boolean().optional(),
});

export type CreateInvitationResult = ActionResult & {
  invitationId?: string;
  token?: string;
  acceptUrl?: string;
  emailSent?: boolean;
  emailError?: string;
};

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export async function createInvitation(
  _prev: CreateInvitationResult | null,
  fd: FormData,
): Promise<CreateInvitationResult> {
  const parsed = CreateSchema.safeParse({
    site_id: fd.get("site_id"),
    email: fd.get("email"),
    role_id: fd.get("role_id"),
    include_children: fd.get("include_children") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();
  await requirePermission("member:invite", parsed.data.site_id);

  const { data, error } = await supabase
    .rpc("create_invitation_v1", {
      p_site_id: parsed.data.site_id,
      p_email: parsed.data.email,
      p_role_id: parsed.data.role_id,
      p_include_children: parsed.data.include_children ?? false,
    })
    .single<{ invitation_id: string; token: string }>();

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create invitation" };
  }

  const url = appUrl();
  const acceptUrl = `${url}/invite/${data.token}`;

  // Best-effort Supabase auth admin invite — failure does not block the RPC
  // success. The accept URL is always returned so dev orgs without SMTP can
  // copy-paste the link.
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const admin = createAdminClient();
    const { error: invErr } = await admin.auth.admin.inviteUserByEmail(
      parsed.data.email,
      { redirectTo: acceptUrl },
    );
    if (invErr) {
      emailError = invErr.message;
    } else {
      emailSent = true;
    }
  } catch (err) {
    emailError = err instanceof Error ? err.message : "Unknown email error";
  }

  revalidatePath("/admin/invitations");
  revalidatePath("/admin/members");
  revalidatePath(`/admin/sites/${parsed.data.site_id}`);

  return {
    ok: true,
    invitationId: data.invitation_id,
    token: data.token,
    acceptUrl,
    emailSent,
    emailError,
  };
}

const RevokeSchema = z.object({
  invitation_id: z.string().uuid(),
});

export async function revokeInvitation(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const parsed = RevokeSchema.safeParse({
    invitation_id: fd.get("invitation_id"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { supabase } = await requireUser();

  const { error } = await supabase.rpc("revoke_invitation_v1", {
    p_invitation_id: parsed.data.invitation_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/invitations");
  return { ok: true };
}
