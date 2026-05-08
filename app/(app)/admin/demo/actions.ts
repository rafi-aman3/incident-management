"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { requirePermission } from "@/lib/auth/can";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Demo affordances — three buttons that let stakeholders reset / seed /
 * surface a banner without touching the database directly. All gated on
 * `demo:reset` (site_admin only by default) AND on the org's is_demo flag
 * (the underlying RPCs raise if the org is not flagged).
 */

// ---------------------------------------------------------------------------
// Mark the current org as a demo org so the destructive RPCs will run.
// Idempotent. Site-admin only — required as a one-time safety opt-in so a
// real prod org can never run reset_demo_data_v1.
// ---------------------------------------------------------------------------
export async function enableDemoMode(): Promise<ActionResult> {
  const { supabase, profile, currentSiteId } = await requireUser();
  await requirePermission("demo:reset", currentSiteId);

  const { error } = await supabase
    .from("orgs")
    .update({ is_demo: true })
    .eq("id", profile.org_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/demo");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Reset all transactional rows for the current org back to the seed state.
// Wraps reset_demo_data_v1 RPC; the RPC refuses unless orgs.is_demo=true.
//
// 6j hardening: requires the caller to type the exact org name as a
// forcing-function guard (mirrors <ArchiveSiteDialog> Stripe-style). Server
// validates against orgs.name independently of the client gate, so a curl
// bypass still requires the typed name.
// ---------------------------------------------------------------------------
export async function resetDemoData(
  _prev: ActionResult | null,
  fd: FormData
): Promise<ActionResult> {
  const { supabase, profile, currentSiteId } = await requireUser();
  await requirePermission("demo:reset", currentSiteId);

  const confirmName = String(fd.get("confirm_name") ?? "");
  const expectedName = String(fd.get("expected_name") ?? "");

  if (!expectedName) {
    return { ok: false, error: "Missing expected org name" };
  }

  // Re-fetch the org name server-side rather than trusting expected_name —
  // the form passes expected_name as a hint, but the source of truth is the DB.
  const { data: org } = await supabase
    .from("orgs")
    .select("name")
    .eq("id", profile.org_id)
    .single();
  if (!org) return { ok: false, error: "Couldn't load your org" };

  if (confirmName !== org.name) {
    return {
      ok: false,
      error: "Type the org name exactly to confirm",
      fieldErrors: { confirm_name: ["Type the org name exactly to confirm"] },
    };
  }

  const { error } = await supabase.rpc("reset_demo_data_v1", {
    p_org_id: profile.org_id,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/demo");
  revalidatePath("/dashboard");
  revalidatePath("/incidents");
  revalidatePath("/investigations");
  revalidatePath("/capa");
  revalidatePath("/reports");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Insert a high-priority test notification with a 1-hour deadline so the
// regulatory banner sticky-mounts immediately. Recipient = current user
// so it appears in the bell without polluting other accounts.
// ---------------------------------------------------------------------------
export async function triggerDemoBanner(
  _prev: ActionResult | null,
  _fd: FormData
): Promise<ActionResult> {
  const { supabase, user, currentSiteId } = await requireUser();
  if (!currentSiteId) return { ok: false, error: "No active site" };
  await requirePermission("demo:reset", currentSiteId);

  const { error } = await supabase.from("notifications").insert({
    kind: "osha_8hr",
    site_id: currentSiteId,
    recipient_id: user.id,
    title: "DEMO — OSHA 8-hour fatality clock",
    body: "Test banner triggered from /admin/demo. This isn't a real incident.",
    deadline_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/dashboard");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Create a Track A injury → closed investigation → CAPA in pending_verification
// chain so the verification flow can be demoed in 30 seconds. Wraps the
// load_sample_chain_v1 RPC; refuses on non-demo orgs.
//
// Verifier needs to differ from the current user; we pick the first site
// member that isn't them.
// ---------------------------------------------------------------------------
export async function loadSampleChain(
  _prev: ActionResult | null,
  _fd: FormData
): Promise<ActionResult> {
  const { supabase, user, currentSiteId } = await requireUser();
  if (!currentSiteId) return { ok: false, error: "No active site" };
  await requirePermission("demo:reset", currentSiteId);

  const { data: members } = await supabase
    .from("site_members")
    .select("profile_id")
    .eq("site_id", currentSiteId)
    .neq("profile_id", user.id)
    .limit(1);
  const verifier = members?.[0]?.profile_id;
  if (!verifier) {
    return {
      ok: false,
      error:
        "Need at least one other site member to act as verifier. Invite a teammate first.",
    };
  }

  const { data: capaId, error } = await supabase.rpc("load_sample_chain_v1", {
    p_site_id: currentSiteId,
    p_actor_id: user.id,
    p_verifier_id: verifier,
  });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/admin/demo");
  revalidatePath("/dashboard");
  revalidatePath("/capa");
  redirect(`/capa/${capaId}`);
}
