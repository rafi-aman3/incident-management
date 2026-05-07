import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInvitationCard } from "@/components/admin/accept-invitation-card";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // The invite page is reachable unauthenticated (middleware whitelist), so we
  // load the invitation via the service-role client to bypass RLS, then derive
  // the right branch based on the calling user's auth state.
  const admin = createAdminClient();
  const { data: inv } = await admin
    .from("invitations")
    .select(
      "id, org_id, site_id, role_id, email, expires_at, accepted_at, revoked_at, invited_by",
    )
    .eq("token", token)
    .maybeSingle();

  if (!inv) {
    return <AcceptInvitationCard branch={{ kind: "not_found" }} />;
  }
  if (inv.revoked_at) {
    return <AcceptInvitationCard branch={{ kind: "revoked" }} />;
  }
  if (inv.accepted_at) {
    return (
      <AcceptInvitationCard
        branch={{ kind: "accepted", siteId: inv.site_id }}
      />
    );
  }
  if (new Date(inv.expires_at) <= new Date()) {
    return (
      <AcceptInvitationCard
        branch={{ kind: "expired", expiresAt: inv.expires_at }}
      />
    );
  }

  // Fetch the joined entities via the admin client (RLS-bypass) so unauth
  // users can still see "you're invited to <Site> by <Inviter>".
  const [siteRes, roleRes, orgRes, inviterRes] = await Promise.all([
    admin.from("sites").select("id, name").eq("id", inv.site_id).maybeSingle(),
    admin.from("roles").select("id, name").eq("id", inv.role_id).maybeSingle(),
    admin.from("orgs").select("id, name").eq("id", inv.org_id).maybeSingle(),
    inv.invited_by
      ? admin
          .from("profiles")
          .select("id, full_name")
          .eq("id", inv.invited_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const meta = {
    token,
    email: inv.email,
    siteName: siteRes.data?.name ?? "this site",
    orgName: orgRes.data?.name ?? "this organization",
    roleName: roleRes.data?.name ?? "member",
    inviterName: inviterRes.data?.full_name ?? null,
  };

  if (!user) {
    return <AcceptInvitationCard branch={{ kind: "unauth", ...meta }} />;
  }

  const currentEmail = (user.email ?? "").toLowerCase();
  if (currentEmail !== inv.email.toLowerCase()) {
    return (
      <AcceptInvitationCard
        branch={{
          kind: "mismatch",
          email: inv.email,
          currentEmail: user.email ?? "",
          siteName: meta.siteName,
          orgName: meta.orgName,
        }}
      />
    );
  }

  return <AcceptInvitationCard branch={{ kind: "ready", ...meta }} />;
}
