import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { HazardForm, type HazardFormSite } from "@/components/hazards/hazard-form";

export default async function NewHazardPage() {
  const { supabase, currentSiteId, memberships } = await requireUser();
  if (!(await can("hazard:report", currentSiteId))) {
    redirect("/hazards");
  }

  // Sites the user can report on (we filter by hazard:report at submit time;
  // this list is broader for v1 demo — RLS protects the actual write).
  const siteIds = memberships
    .map((m) => m.site_id)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  const { data: sitesData } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", siteIds);

  const sites: HazardFormSite[] = (sitesData ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Report a hazard</h1>
        <p className="text-sm text-muted-foreground">
          Add a workplace hazard to the register. After creation you can attach an initial risk assessment and controls.
        </p>
      </div>

      <HazardForm sites={sites} defaultSiteId={currentSiteId} />
    </div>
  );
}
