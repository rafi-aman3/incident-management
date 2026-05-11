import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "./onboarding-wizard";

export default async function OnboardingPage() {
  const { user } = await requireAuthenticatedUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, full_name, onboarded_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect("/dashboard");

  const meta = user.user_metadata as { full_name?: string; org_name?: string } | undefined;

  // Profile + site exist → user finished step 1, resume on step 2.
  let initialStep: "org" | "use_cases" = "org";
  if (profile) {
    const { data: membership } = await supabase
      .from("site_members")
      .select("site_id")
      .eq("profile_id", user.id)
      .limit(1)
      .maybeSingle();
    if (membership) initialStep = "use_cases";
  }

  return (
    <OnboardingWizard
      email={user.email ?? ""}
      fullName={profile?.full_name ?? meta?.full_name ?? ""}
      initialStep={initialStep}
      defaultOrgName={meta?.org_name ?? null}
    />
  );
}
