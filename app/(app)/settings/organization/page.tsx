import Link from "next/link";
import { Lock } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { OrganizationCard } from "@/components/settings/organization-card";

export default async function SettingsOrganizationPage() {
  if (!(await orgCan("org:configure"))) {
    return (
      <EmptyState
        icon={<Lock className="h-10 w-10" aria-hidden />}
        title="Organisation settings are admin-only"
        body="Ask a workspace admin to update the organisation name, industry, or logo."
        action={
          <Button asChild variant="outline">
            <Link href="/settings/profile">Back to profile</Link>
          </Button>
        }
      />
    );
  }

  const { supabase, profile } = await requireUser();
  const { data: org } = await supabase
    .from("orgs")
    .select("name, slug, industry, logo_url")
    .eq("id", profile.org_id)
    .maybeSingle();

  const logoPublicUrl = org?.logo_url
    ? supabase.storage.from("org-logos").getPublicUrl(org.logo_url).data
        .publicUrl
    : null;

  return (
    <OrganizationCard
      initial={{
        name: org?.name ?? "",
        // industry is nullable in DB; default to 'office' if unset so the
        // Radix Select always has a controlled value.
        industry: (org?.industry ?? "office") as
          | "healthcare"
          | "education"
          | "manufacturing"
          | "warehouse"
          | "office"
          | "construction"
          | "lab",
        slug: org?.slug ?? "",
        logo_url: org?.logo_url ?? null,
        logo_public_url: logoPublicUrl,
      }}
    />
  );
}
