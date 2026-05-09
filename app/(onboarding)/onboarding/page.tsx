import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

type Search = Promise<{ step?: string; site?: string }>;

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const sp = await searchParams;
  const { user } = await requireAuthenticatedUser();
  const supabase = await createClient();

  // Read profile (might not exist yet) + first site membership (if step
  // 1+2 already committed).
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  // Already onboarded → out of here.
  if (profile?.onboarded_at) redirect("/dashboard");

  const meta = user.user_metadata as
    | { full_name?: string; org_name?: string }
    | undefined;

  // Profile exists + at least one site = mid-flow (Step 1+2 committed,
  // Step 3 pending). Force Step 3 so the user finishes.
  if (profile) {
    const { data: membership } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) {
      return (
        <OnboardingWizard
          email={user.email ?? ""}
          fullName={profile.full_name ?? ""}
          initialStep="invite"
          siteId={membership.site_id}
          defaultOrgName={null}
        />
      );
    }
  }

  // Fresh signup, no profile yet → step 1.
  const initialStep = sp.step === "invite" ? "invite" : "org";
  return (
    <OnboardingWizard
      email={user.email ?? ""}
      fullName={(meta?.full_name ?? "") || ""}
      initialStep={initialStep}
      siteId={sp.site ?? null}
      defaultOrgName={meta?.org_name ?? null}
    />
  );
}
