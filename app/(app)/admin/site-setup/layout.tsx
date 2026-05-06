import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { SiteCreatedToast } from "@/components/app-shell/site-created-toast";

/**
 * Wizard layout. Gates the entire `/admin/site-setup/*` tree on the
 * `site:configure` permission for the user's currently selected site.
 * Step chrome + form panel are rendered by `[step]/page.tsx` so that the
 * progress data is fetched once per page render and stays in sync with
 * the latest setup_progress jsonb (which a successful action just wrote).
 */
export default async function SiteSetupLayout({ children }: { children: ReactNode }) {
  const { currentSiteId } = await requireUser();
  if (!currentSiteId) redirect("/dashboard");
  const allowed = await can("site:configure", currentSiteId);
  if (!allowed) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-5xl">
      <Suspense fallback={null}>
        <SiteCreatedToast />
      </Suspense>
      {children}
    </div>
  );
}
