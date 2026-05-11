import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import {
  DeleteAccountCard,
  type OrgDeleteSummary,
} from "@/components/settings/delete-account-card";

export default async function SettingsDeleteAccountPage() {
  const { supabase, profile, user } = await requireUser();

  const isOrgAdmin = await orgCan("org:configure");

  // Count org:configure holders (this user included) to decide whether to
  // show the sole-admin guard + delete-org escape hatch.
  let isSoleAdmin = false;
  if (isOrgAdmin) {
    const { data: count } = await supabase.rpc(
      "count_org_configure_holders",
      { p_org_id: profile.org_id },
    );
    isSoleAdmin = typeof count === "number" && count <= 1;
  }

  // Counts for the org-delete confirm dialog. Always fetched (RPC is
  // SECURITY DEFINER) so the dialog can render immediately.
  const { data: summary } = await supabase.rpc("org_delete_summary", {
    p_org_id: profile.org_id,
  });

  const safeSummary: OrgDeleteSummary = {
    name: (summary as { name?: string } | null)?.name ?? "this workspace",
    members: (summary as { members?: number } | null)?.members ?? 0,
    sites: (summary as { sites?: number } | null)?.sites ?? 0,
    incidents: (summary as { incidents?: number } | null)?.incidents ?? 0,
  };

  return (
    <DeleteAccountCard
      email={user.email ?? profile.email}
      isSoleAdmin={isSoleAdmin}
      isOrgAdmin={isOrgAdmin}
      orgSummary={safeSummary}
    />
  );
}
