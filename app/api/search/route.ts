import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { escapeIlike } from "@/lib/search/escape";

/**
 * Phase 7 — Global search. GET /api/search?q=foo → grouped hits across 9
 * module entities. ILIKE fan-out with LIMIT 5 per group; RLS gates visibility.
 *
 * Demo-grade: no tsvector / GIN / pg_trgm, no ranking, no caching. If we
 * need fuzziness later, swap each branch to `.textSearch()` and add tsvector
 * columns in a follow-up migration — no API shape change required.
 */

type ModuleKey =
  | "incidents"
  | "investigations"
  | "capas"
  | "inspections"
  | "templates"
  | "assets"
  | "documents"
  | "sites"
  | "members";

export type SearchHit = {
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

export type SearchGroup = {
  module: ModuleKey;
  label: string;
  items: SearchHit[];
};

const LIMIT_PER_GROUP = 5;
const MIN_QUERY = 2;
const MAX_QUERY = 100;

export async function GET(request: NextRequest) {
  const raw = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (raw.length > MAX_QUERY) {
    return NextResponse.json({ error: "query too long" }, { status: 400 });
  }
  if (raw.length < MIN_QUERY) {
    return NextResponse.json({ groups: [] satisfies SearchGroup[] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const q = escapeIlike(raw);
  const like = `%${q}%`;

  // Fan out all 9 lookups in parallel. RLS auto-filters each by membership.
  const [
    incidents,
    investigations,
    capas,
    inspections,
    templates,
    assets,
    documents,
    sites,
    members,
  ] = await Promise.all([
    supabase
      .from("incidents")
      .select("id, ref_code, title, site:sites(name)")
      .is("deleted_at", null)
      .or(`title.ilike.${like},ref_code.ilike.${like},description.ilike.${like}`)
      .order("occurred_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("investigations")
      .select("id, ref_code, incident:incidents(title, ref_code)")
      .is("deleted_at", null)
      .or(`ref_code.ilike.${like},root_cause_summary.ilike.${like},findings.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("capas")
      .select("id, ref_code, title, site:sites(name)")
      .is("deleted_at", null)
      .or(`title.ilike.${like},ref_code.ilike.${like},description.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("inspections")
      .select("id, ref_code, title, site:sites(name)")
      .is("deleted_at", null)
      .or(`title.ilike.${like},ref_code.ilike.${like}`)
      .order("started_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("templates")
      .select("id, name, industry")
      .is("archived_at", null)
      .or(`name.ilike.${like},description.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("assets")
      .select("id, ref_code, name, site:sites(name)")
      .is("deleted_at", null)
      .or(`name.ilike.${like},ref_code.ilike.${like},location.ilike.${like}`)
      .order("updated_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("documents")
      .select("id, name, type, site:sites(name)")
      .is("archived_at", null)
      .or(`name.ilike.${like},file_name.ilike.${like},notes.ilike.${like}`)
      .order("uploaded_at", { ascending: false })
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("sites")
      .select("id, name, country, parent:parent_site_id(name)")
      .is("archived_at", null)
      .ilike("name", like)
      .limit(LIMIT_PER_GROUP),

    supabase
      .from("profiles")
      .select("id, full_name, email")
      .or(`full_name.ilike.${like},email.ilike.${like}`)
      .limit(LIMIT_PER_GROUP),
  ]);

  const groups: SearchGroup[] = [];

  pushGroup(groups, "incidents", "Incidents", incidents.data, (r) => ({
    id: r.id as string,
    title: (r.title as string) || "Untitled incident",
    subtitle: composeSubtitle(r.ref_code as string | null, siteName(r.site)),
    href: `/incidents/${r.id}`,
  }));

  pushGroup(groups, "investigations", "Investigations", investigations.data, (r) => {
    const inc = r.incident as { title?: string | null; ref_code?: string | null } | null;
    const title = inc?.title || "Investigation";
    return {
      id: r.id as string,
      title,
      subtitle: composeSubtitle(
        r.ref_code as string | null,
        inc?.ref_code ? `Incident ${inc.ref_code}` : null,
      ),
      href: `/investigations/${r.id}`,
    };
  });

  pushGroup(groups, "capas", "CAPAs", capas.data, (r) => ({
    id: r.id as string,
    title: (r.title as string) || "Untitled CAPA",
    subtitle: composeSubtitle(r.ref_code as string | null, siteName(r.site)),
    href: `/capa/${r.id}`,
  }));

  pushGroup(groups, "inspections", "Inspections", inspections.data, (r) => ({
    id: r.id as string,
    title: (r.title as string) || "Untitled inspection",
    subtitle: composeSubtitle(r.ref_code as string | null, siteName(r.site)),
    href: `/inspections/${r.id}`,
  }));

  pushGroup(groups, "templates", "Templates", templates.data, (r) => ({
    id: r.id as string,
    title: r.name as string,
    subtitle: (r.industry as string | null) ?? undefined,
    href: `/templates/${r.id}`,
  }));

  pushGroup(groups, "assets", "Assets", assets.data, (r) => ({
    id: r.id as string,
    title: r.name as string,
    subtitle: composeSubtitle(r.ref_code as string | null, siteName(r.site)),
    href: `/resources/assets/${r.id}`,
  }));

  pushGroup(groups, "documents", "Documents", documents.data, (r) => ({
    id: r.id as string,
    title: r.name as string,
    subtitle: composeSubtitle(
      (r.type as string | null) ?? null,
      siteName(r.site) ?? "Org-wide",
    ),
    href: `/resources/documents/${r.id}`,
  }));

  pushGroup(groups, "sites", "Sites", sites.data, (r) => {
    const parent = r.parent as { name?: string | null } | null;
    return {
      id: r.id as string,
      title: r.name as string,
      subtitle: composeSubtitle(
        (r.country as string | null) ?? null,
        parent?.name ?? "Top-level",
      ),
      href: `/admin/sites/${r.id}`,
    };
  });

  pushGroup(groups, "members", "People", members.data, (r) => ({
    id: r.id as string,
    title: (r.full_name as string | null) || (r.email as string),
    subtitle: r.full_name ? (r.email as string) : undefined,
    href: `/admin/members/${r.id}`,
  }));

  return NextResponse.json({ groups });
}

function pushGroup<T>(
  acc: SearchGroup[],
  module: ModuleKey,
  label: string,
  rows: T[] | null,
  toHit: (row: T) => SearchHit,
) {
  if (!rows || rows.length === 0) return;
  acc.push({ module, label, items: rows.map(toHit) });
}

function composeSubtitle(...parts: Array<string | null | undefined>): string | undefined {
  const cleaned = parts.filter((p): p is string => Boolean(p && p.trim()));
  return cleaned.length > 0 ? cleaned.join(" · ") : undefined;
}

function siteName(site: unknown): string | null {
  if (site && typeof site === "object" && "name" in site) {
    const n = (site as { name?: string | null }).name;
    return n ?? null;
  }
  return null;
}
