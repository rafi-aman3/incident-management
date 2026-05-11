import Link from "next/link";
import { Plus, Megaphone } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { BulletinCard, type BulletinCardRow } from "@/components/bulletins/bulletin-card";

type Filter = "published" | "drafts" | "archived";
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "published", label: "Published" },
  { key: "drafts", label: "My drafts" },
  { key: "archived", label: "Archived" },
];

function pickFilter(raw: string | string[] | undefined): Filter {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "drafts" || v === "archived" ? v : "published";
}

export default async function BulletinsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filter = pickFilter(sp.filter);

  const { supabase, user, currentSiteId } = await requireUser();
  const canCreate = await can("bulletin:create", currentSiteId);

  let query = supabase
    .from("safety_bulletins")
    .select(
      "id, title, summary, status, published_at, updated_at, source_incident:source_incident_id(ref_code), source_investigation:source_investigation_id(ref_code), author:created_by(full_name, email)",
    )
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  if (filter === "published") {
    query = query.eq("status", "published").is("archived_at", null);
  } else if (filter === "drafts") {
    query = query.eq("status", "draft").eq("created_by", user.id);
  } else {
    query = query.eq("status", "archived");
  }

  const { data, error } = await query.limit(100);
  const rows: BulletinCardRow[] = (data ?? []).map((r) => {
    const inc = r.source_incident as { ref_code?: string | null } | null;
    const inv = r.source_investigation as { ref_code?: string | null } | null;
    const author = r.author as { full_name?: string | null; email?: string | null } | null;
    return {
      id: r.id as string,
      title: r.title as string,
      summary: (r.summary as string | null) ?? null,
      status: r.status as BulletinCardRow["status"],
      published_at: (r.published_at as string | null) ?? null,
      updated_at: r.updated_at as string,
      source_incident_ref: inc?.ref_code ?? null,
      source_investigation_ref: inv?.ref_code ?? null,
      author_name: author?.full_name || author?.email || null,
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Safety Bulletins</h1>
          <p className="text-sm text-muted-foreground">
            Lessons-learned notices published org-wide after a serious incident.
          </p>
        </div>
        {canCreate && (
          <Link
            href="/bulletins/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New bulletin
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={`/bulletins?filter=${f.key}`}
              className={
                "inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium transition " +
                (active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground")
              }
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error.message}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-10 text-center">
          <Megaphone className="mx-auto mb-3 size-6 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">
            {filter === "drafts"
              ? "No drafts yet"
              : filter === "archived"
                ? "Nothing archived"
                : "No bulletins published yet"}
          </h2>
          <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
            Bulletins surface lessons learned from closed investigations. Close
            a Track-A investigation to draft one from its findings.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <BulletinCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}
