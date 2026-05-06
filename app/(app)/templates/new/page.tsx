import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { NewTemplateForm } from "@/components/templates/new-template-form";
import type { IndustryEnum } from "@/lib/templates/industry-map";

export default async function NewTemplatePage() {
  const { supabase, profile } = await requireUser();

  const canCreate = await orgCan("template:create");
  if (!canCreate) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to create templates.
      </div>
    );
  }

  // Default the industry select to the org's industry (if set)
  const { data: org } = await supabase
    .from("orgs")
    .select("industry")
    .eq("id", profile.org_id)
    .maybeSingle();
  const defaultIndustry = (org?.industry ?? "office") as IndustryEnum;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <Link
          href="/templates"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
        >
          <ArrowLeft className="h-3 w-3" /> Back to templates
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">New template</h1>
        <p className="text-sm text-muted-foreground">
          Start with a blank checklist. You can also{" "}
          <Link href="/templates/browse" className="text-primary hover:underline">
            browse the library
          </Link>{" "}
          and import a starter.
        </p>
      </div>

      <NewTemplateForm defaultIndustry={defaultIndustry} />
    </div>
  );
}
