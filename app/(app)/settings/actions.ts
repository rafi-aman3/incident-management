"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { orgCan } from "@/lib/auth/orgCan";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { Database } from "@/lib/supabase/types";

type NotificationKindEnum = Database["public"]["Enums"]["notification_kind"];

// Phase 17 — notification kinds that are life-safety / regulatory and
// cannot be silenced (UI disables the toggle; server rejects an insert).
// The read-layer filter is defence-in-depth against a hand-rolled DB insert.
const NON_SILENCEABLE_KINDS = [
  "stop_work_raised",
  "osha_8hr",
  "osha_24hr",
  "riddor_immediate",
  "riddor_f2508_10d",
  "riddor_7day",
  "riddor_disease",
] as const;

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

// ---------------------------------------------------------------------------
// Phase 17 — Organization edit (name + industry). Logo handled separately.
// ---------------------------------------------------------------------------

const INDUSTRY_VALUES = [
  "healthcare",
  "education",
  "manufacturing",
  "warehouse",
  "office",
  "construction",
  "lab",
] as const;

const orgSchema = z.object({
  name: z.string().trim().min(1, "Required").max(120, "Too long"),
  industry: z.enum(INDUSTRY_VALUES),
});

export async function updateOrg(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  if (!(await orgCan("org:configure"))) {
    return { ok: false, error: "Permission denied" };
  }

  const parsed = orgSchema.safeParse({
    name: fd.get("name"),
    industry: fd.get("industry"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Validation failed",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  const { supabase, profile, user } = await requireUser();
  const { error } = await supabase
    .from("orgs")
    .update({ name: parsed.data.name, industry: parsed.data.industry })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "org.updated",
    payload: { fields_changed: ["name", "industry"] },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 17 — Org logo upload + remove.
// ---------------------------------------------------------------------------

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_WHITELIST = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function uploadOrgLogo(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  if (!(await orgCan("org:configure"))) {
    return { ok: false, error: "Permission denied" };
  }

  const file = fd.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "No file selected" };
  }
  if (file.size > LOGO_MAX_BYTES) {
    return { ok: false, error: "Max 2 MB" };
  }
  if (!LOGO_MIME_WHITELIST.has(file.type)) {
    return { ok: false, error: "JPEG, PNG, WebP, or GIF only" };
  }

  const { supabase, profile, user } = await requireUser();
  const extFromMime = file.type.split("/")[1];
  const ext = extFromMime === "jpeg" ? "jpg" : extFromMime;
  const path = `${profile.org_id}/logo.${ext}`;
  const buf = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage
    .from("org-logos")
    .upload(path, buf, { contentType: file.type, upsert: true });
  if (upErr) return { ok: false, error: upErr.message };

  const { error: dbErr } = await supabase
    .from("orgs")
    .update({ logo_url: path })
    .eq("id", profile.org_id);
  if (dbErr) return { ok: false, error: dbErr.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "org.logo_uploaded",
    payload: { logo_url: path },
  });

  revalidatePath("/settings/organization");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeOrgLogo(): Promise<ActionResult> {
  if (!(await orgCan("org:configure"))) {
    return { ok: false, error: "Permission denied" };
  }

  const { supabase, profile, user } = await requireUser();

  // Read the current logo_url so we can delete the underlying object.
  const { data: org } = await supabase
    .from("orgs")
    .select("logo_url")
    .eq("id", profile.org_id)
    .maybeSingle();

  if (org?.logo_url) {
    await supabase.storage.from("org-logos").remove([org.logo_url]);
  }

  const { error } = await supabase
    .from("orgs")
    .update({ logo_url: null })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "org.logo_removed",
    payload: {},
  });

  revalidatePath("/settings/organization");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 17 — Sidebar customisation (per-user hidden items).
// ---------------------------------------------------------------------------

const sidebarSchema = z.object({
  hidden_items: z.array(z.string().min(1).max(120)).max(20),
});

export async function setSidebarHiddenItems(
  items: string[],
): Promise<ActionResult> {
  const parsed = sidebarSchema.safeParse({ hidden_items: items });
  if (!parsed.success) {
    return { ok: false, error: "Validation failed" };
  }
  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ sidebar_hidden_items: parsed.data.hidden_items })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 17 — Argus side-panel default (per-user).
// ---------------------------------------------------------------------------

export async function setArgusPanelDefault(
  value: boolean,
): Promise<ActionResult> {
  const { supabase, profile } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ argus_panel_default: value })
    .eq("id", profile.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 17 — Notification silencing (per-user, per-kind).
// ---------------------------------------------------------------------------

const notificationKindSchema = z.string().min(1).max(64);

export async function setNotificationSilence(
  kind: string,
  silenced: boolean,
): Promise<ActionResult> {
  const parsed = notificationKindSchema.safeParse(kind);
  if (!parsed.success) return { ok: false, error: "Invalid kind" };

  if (
    silenced &&
    (NON_SILENCEABLE_KINDS as readonly string[]).includes(parsed.data)
  ) {
    return {
      ok: false,
      error: "Life-safety alerts can't be silenced.",
    };
  }

  const { supabase, profile } = await requireUser();

  // Cast to the enum: the action accepts an unbounded string so callers
  // (client components passing constants) don't have to import the enum.
  // The DB column is enum-typed and will reject any value outside the set.
  const kindEnum = parsed.data as NotificationKindEnum;

  if (silenced) {
    const { error } = await supabase
      .from("user_notification_silences")
      .upsert(
        { profile_id: profile.id, notification_kind: kindEnum },
        { onConflict: "profile_id,notification_kind" },
      );
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("user_notification_silences")
      .delete()
      .eq("profile_id", profile.id)
      .eq("notification_kind", kindEnum);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/settings/notifications");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Phase 17 — Self-service account deletion (GDPR Article 17).
// ---------------------------------------------------------------------------

const deleteAccountSchema = z.object({
  confirm_email: z.string().email(),
});

export async function deleteOwnAccount(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  const { supabase, user, profile } = await requireUser();

  const parsed = deleteAccountSchema.safeParse({
    confirm_email: fd.get("confirm_email"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: "Email doesn't match",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }
  if (
    parsed.data.confirm_email.toLowerCase() !==
    (user.email ?? "").toLowerCase()
  ) {
    return { ok: false, error: "Email doesn't match" };
  }

  // Hard-block: last org-admin guard. Counts holders of org:configure;
  // a value of 1 means this user is the only admin.
  const { data: count, error: countErr } = await supabase.rpc(
    "count_org_configure_holders",
    { p_org_id: profile.org_id },
  );
  if (countErr) return { ok: false, error: countErr.message };
  if (typeof count === "number" && count <= 1) {
    return {
      ok: false,
      error:
        "You're the last org admin. Promote another admin under Admin → Members, or delete the entire organisation instead.",
    };
  }

  // Audit row before the cascade wipes the actor.
  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "account.deleted",
    payload: { deleted_user_email: user.email },
  });

  const admin = createAdminClient();
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) return { ok: false, error: delErr.message };

  redirect("/login?account_deleted=1");
}

// ---------------------------------------------------------------------------
// Phase 17 — Delete entire organisation (sole-admin escape hatch).
//
// Two-field gate: must type the exact org name AND the literal word DELETE.
// Cascade order:
//   1. Service-role: list every profile in the org.
//   2. Service-role: delete the org row → cascades through every org_id FK
//      (sites, incidents, investigations, capas, hazards, jsas, etc., plus
//      profiles themselves via profiles.org_id ON DELETE CASCADE).
//   3. For each ex-profile, delete the corresponding auth.users row via
//      admin.auth.admin.deleteUser so no orphan auth identities remain.
//   4. Redirect to /login?org_deleted=1.
// ---------------------------------------------------------------------------

const deleteOrgSchema = z.object({
  confirm_name: z.string().min(1),
  confirm_keyword: z.literal("DELETE"),
});

export async function deleteOwnOrg(
  _prev: ActionResult | null,
  fd: FormData,
): Promise<ActionResult> {
  if (!(await orgCan("org:configure"))) {
    return { ok: false, error: "Permission denied" };
  }

  const { supabase, user, profile } = await requireUser();

  const parsed = deleteOrgSchema.safeParse({
    confirm_name: fd.get("confirm_name"),
    confirm_keyword: fd.get("confirm_keyword"),
  });
  if (!parsed.success) {
    return { ok: false, error: "Type the org name and DELETE to confirm" };
  }

  // Verify the typed name matches the live org row.
  const { data: org, error: orgErr } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("id", profile.org_id)
    .maybeSingle();
  if (orgErr || !org) {
    return { ok: false, error: orgErr?.message ?? "Org not found" };
  }
  if (parsed.data.confirm_name.trim() !== org.name) {
    return { ok: false, error: "Org name doesn't match" };
  }

  await supabase.from("activity_events").insert({
    actor_id: user.id,
    verb: "org.deleted",
    payload: { org_id: org.id, org_name: org.name },
  });

  const admin = createAdminClient();

  // 1. Collect profile ids before the cascade wipes them.
  const { data: profiles, error: profilesErr } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", org.id);
  if (profilesErr) return { ok: false, error: profilesErr.message };
  const userIds = (profiles ?? []).map((p) => p.id);

  // 2. Delete the org row (service-role bypasses RLS). All org_id-cascade
  //    FKs fire, including profiles.org_id which removes every profile.
  const { error: dropErr } = await admin
    .from("orgs")
    .delete()
    .eq("id", org.id);
  if (dropErr) return { ok: false, error: dropErr.message };

  // 3. Clean up the now-orphan auth.users rows. The current user is last so
  //    the loop completes before the session-bearer is invalidated.
  const selfId = user.id;
  for (const id of userIds) {
    if (id === selfId) continue;
    try {
      await admin.auth.admin.deleteUser(id);
    } catch {
      // best-effort; tenancy is already wiped, orphan auth.users won't see
      // any data on next login (no profile row).
    }
  }
  await admin.auth.admin.deleteUser(selfId);

  redirect("/login?org_deleted=1");
}
