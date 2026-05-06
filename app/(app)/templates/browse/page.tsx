import Link from "next/link";
import { ArrowLeft, LibraryBig } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { INDUSTRY_VALUES } from "@/lib/templates/industry-map";
import type { IndustryEnum } from "@/lib/templates/industry-map";
import { TemplateLibraryFilters } from "@/components/templates/template-library-filters";
import {
  TemplatePresetCard,
  type PresetCardData,
} from "@/components/templates/template-preset-card";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type PresetRow = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  industry: IndustryEnum;
  is_featured: boolean;
  current_version: { items: unknown } | { items: unknown }[] | null;
};

export default async function TemplateBrowsePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase } = await requireUser();

  const canRead = await orgCan("template:read_org");
  const canImport = await orgCan("template:create");

  if (!canRead) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          You don&apos;t have access to the template library.
        </div>
      </div>
    );
  }

  const industryParam =
    typeof sp.industry === "string" &&
    (INDUSTRY_VALUES as readonly string[]).includes(sp.industry)
      ? (sp.industry as IndustryEnum)
      : null;
  const featured = sp.featured === "1";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  let query = supabase
    .from("templates")
    .select(
      `id, name, description, logo_url, industry, is_featured,
       current_version:current_version_id ( items )`
    )
    .eq("is_system_preset", true)
    .eq("status", "published")
    .order("is_featured", { ascending: false })
    .order("name", { ascending: true })
    .limit(200);

  if (industryParam) query = query.eq("industry", industryParam);
  if (featured) query = query.eq("is_featured", true);
  if (q) query = query.ilike("name", `%${q}%`);

  const { data, error } = await query.returns<PresetRow[]>();

  const presets: PresetCardData[] = (data ?? []).map((r) => {
    const cv = Array.isArray(r.current_version)
      ? r.current_version[0]
      : r.current_version;
    const items = (cv?.items ?? []) as unknown[];
    // Item count: include only "answerable" types (rough heuristic — every
    // node that's not a section/category/information container)
    const itemCount = Array.isArray(items)
      ? items.filter((it) => {
          if (!it || typeof it !== "object") return false;
          const t = (it as { type?: string }).type;
          return t !== "section" && t !== "category" && t !== "information";
        }).length
      : 0;
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      logo_url: r.logo_url,
      industry: r.industry,
      is_featured: r.is_featured,
      item_count: itemCount,
    };
  });

  return (
    <div className="space-y-6">
      <Header />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <TemplateLibraryFilters mode="browse" />
        <Link
          href="/templates"
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" /> Back to my templates
        </Link>
      </div>

      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {presets.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center">
          <LibraryBig className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <h2 className="mt-4 text-lg font-semibold">No templates found</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Try clearing filters, or check back once the system-preset library
            has been seeded.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {presets.map((p) => (
            <TemplatePresetCard key={p.id} preset={p} canImport={canImport} />
          ))}
        </div>
      )}
    </div>
  );
}

function Header() {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Templates · Library
      </p>
      <h1 className="text-2xl font-semibold">Browse template library</h1>
      <p className="text-sm text-muted-foreground">
        Industry-curated starter templates. Import a preset to copy its items
        into your org so you can edit and publish your own version. The preset
        itself stays untouched.
      </p>
    </div>
  );
}
