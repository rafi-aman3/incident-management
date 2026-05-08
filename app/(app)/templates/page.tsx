import Link from "next/link";
import { LibraryBig, Plus } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { industryLabel, INDUSTRY_VALUES } from "@/lib/templates/industry-map";
import type { IndustryEnum } from "@/lib/templates/industry-map";
import type { TemplateStatus } from "@/lib/templates/types";
import { TemplateLibraryFilters } from "@/components/templates/template-library-filters";
import { TemplateList, type TemplateRow } from "@/components/templates/template-list";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const STATUS_VALUES: ReadonlyArray<TemplateStatus> = ["draft", "published", "archived"];

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();

  const canRead = await orgCan("template:read_org");
  const canCreate = await orgCan("template:create");

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to templates in this org.
        </div>
      </div>
    );
  }

  // Filters
  const industryParam =
    typeof sp.industry === "string" &&
    (INDUSTRY_VALUES as readonly string[]).includes(sp.industry)
      ? (sp.industry as IndustryEnum)
      : null;
  const statusParam =
    typeof sp.status === "string" &&
    (STATUS_VALUES as readonly string[]).includes(sp.status)
      ? (sp.status as TemplateStatus)
      : null;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = supabase
    .from("templates")
    .select(
      `id, name, description, industry, status, updated_at, is_imported,
       current_version:current_version_id ( version_number )`
    )
    .eq("org_id", profile.org_id)
    .eq("is_system_preset", false)
    .order("updated_at", { ascending: false })
    .limit(200);

  if (industryParam) query = query.eq("industry", industryParam);
  if (statusParam) query = query.eq("status", statusParam);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query;

  const rows: TemplateRow[] = (data ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    industry: r.industry as IndustryEnum,
    status: r.status as TemplateStatus,
    updated_at: r.updated_at,
    is_imported: r.is_imported,
    current_version_number:
      // Supabase typing returns an array shape for nested singletons
      Array.isArray(r.current_version)
        ? r.current_version[0]?.version_number ?? null
        : (r.current_version as { version_number: number } | null)?.version_number ?? null,
  }));

  // Group rows by industry for the section headers
  const groups: Record<string, TemplateRow[]> = {};
  for (const r of rows) {
    if (!groups[r.industry]) groups[r.industry] = [];
    groups[r.industry].push(r);
  }
  const groupedIndustries = Object.keys(groups) as IndustryEnum[];

  return (
    <div className="space-y-6">
      <Header />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TemplateLibraryFilters mode="imported" />

        <div className="flex items-center gap-2">
          <Link
            href="/templates/browse"
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
          >
            <LibraryBig className="h-4 w-4" /> Browse library
          </Link>
          {canCreate && (
            <Link
              href="/templates/new"
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" /> New template
            </Link>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {/* If no industry filter is active, render a section per industry. With a
          filter active, render a single flat table (the filter pills already
          tell the user which industry they're looking at). */}
      {!industryParam && rows.length > 0 ? (
        <div className="space-y-8">
          {groupedIndustries.map((ind) => (
            <section key={ind}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {industryLabel(ind)}
              </h2>
              <TemplateList rows={groups[ind]} canEdit={canCreate} />
            </section>
          ))}
        </div>
      ) : (
        <TemplateList rows={rows} canEdit={canCreate} />
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Templates</h1>
      <p className="text-sm text-muted-foreground">
        Org-scoped checklist templates. Import from the library or build your
        own. Editing publishes a new version; in-flight inspections continue
        against the version they were started with.
      </p>
    </div>
  );
}
