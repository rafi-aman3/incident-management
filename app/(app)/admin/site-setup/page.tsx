import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { nextIncompleteStep, type SetupProgress } from "@/lib/site-setup/steps";

/**
 * Redirector — sends the admin to the first incomplete step. If the site
 * is already fully set up, sends them back to the dashboard.
 */
export default async function SiteSetupIndex() {
  const { supabase, currentSiteId } = await requireUser();
  if (!currentSiteId) redirect("/dashboard");

  const { data: site } = await supabase
    .from("sites")
    .select("setup_progress, setup_completed_at")
    .eq("id", currentSiteId)
    .single();

  if (site?.setup_completed_at) redirect("/dashboard");
  const progress = (site?.setup_progress ?? {}) as SetupProgress;
  redirect(`/admin/site-setup/${nextIncompleteStep(progress)}`);
}
