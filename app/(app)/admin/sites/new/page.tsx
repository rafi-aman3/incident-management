import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { CreateSiteForm, type ParentChoice } from "./create-site-form";

/**
 * Create-site page. Mirrors the gating in create_site_v1: allowed for users
 * who are bootstrapping (zero memberships) OR who already hold site_admin
 * somewhere in the same org. The RPC enforces the same rule again — this
 * page-level check just renders a friendly redirect for anyone else.
 */
export default async function NewSitePage() {
  const { supabase, profile, memberships, currentSiteId } = await requireUser();

  const isBootstrap = memberships.length === 0;
  const isAdminAnywhere = memberships.some((m) => m.role?.key === "site_admin");
  if (!isBootstrap && !isAdminAnywhere) redirect("/dashboard");

  // Existing org sites — used as parent options. Hidden when bootstrapping
  // (no sites exist yet to be a parent).
  let parentChoices: ParentChoice[] = [];
  if (!isBootstrap) {
    const { data } = await supabase
      .from("sites")
      .select("id, name, country")
      .eq("org_id", profile.org_id)
      .order("name", { ascending: true });
    parentChoices = (data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      country: s.country as "US" | "GB",
    }));
  }

  const cancelHref = currentSiteId ? "/dashboard" : "/dashboard";

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-8">
      <div className="space-y-1">
        <Link
          href={cancelHref}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to dashboard
        </Link>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          {isBootstrap ? "Welcome — let’s set up your first site" : "Add a new site"}
        </p>
        <h1 className="text-2xl font-semibold">
          {isBootstrap ? "Create your first site" : "Create site"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {isBootstrap
            ? "Sites group your incidents, inspections, and reports. You can add more later. We’ll grant you site admin so you can configure the rest."
            : "Sites group your incidents, inspections, and reports. You’ll be granted site admin on the new site automatically."}
        </p>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <CreateSiteForm parentChoices={parentChoices} cancelHref={cancelHref} />
      </div>

      <p className="text-xs text-muted-foreground">
        After creating, you’ll land in the <span className="font-medium">Site Setup</span>{" "}
        wizard to fill in jurisdiction, departments, and notification recipients. Nothing
        is locked until you click Launch at the end.
      </p>
    </div>
  );
}
