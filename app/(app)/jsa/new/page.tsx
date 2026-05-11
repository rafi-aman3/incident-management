import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { JsaStep1Form, type JsaSite } from "@/components/jsa/jsa-step1-form";

export default async function NewJsaPage() {
  const { supabase, currentSiteId, memberships } = await requireUser();
  if (!(await can("jsa:draft", currentSiteId))) {
    redirect("/jsa");
  }

  const siteIds = memberships
    .map((m) => m.site_id)
    .filter((id, idx, arr) => arr.indexOf(id) === idx);

  const { data: sitesData } = await supabase
    .from("sites")
    .select("id, name")
    .in("id", siteIds);

  const sites: JsaSite[] = (sitesData ?? []).map((s) => ({
    id: s.id as string,
    name: s.name as string,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Step 1 of 4</p>
        <h1 className="text-2xl font-semibold">New JSA — identity</h1>
        <p className="text-sm text-muted-foreground">
          Name the job and set high-level details. After this you'll break it into steps, add hazards and controls, then submit for approval.
        </p>
      </div>

      <JsaStep1Form sites={sites} defaultSiteId={currentSiteId} />
    </div>
  );
}
