import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { format } from "date-fns";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import {
  SiteDetailTabs,
  SITE_DETAIL_TABS,
  type SiteDetailTabKey,
} from "@/components/admin/site-detail-tabs";
import {
  EditSiteForm,
  type ParentChoice,
  type SiteEditable,
} from "@/components/admin/edit-site-form";
import { ArchiveSiteDialog } from "@/components/admin/archive-site-dialog";
import {
  AnnualHoursEditor,
  type AnnualHoursRow,
} from "@/components/admin/annual-hours-editor";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const VALID_TABS: ReadonlyArray<SiteDetailTabKey> = SITE_DETAIL_TABS.map((t) => t.key);

export default async function AdminSiteDetailPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const { supabase, profile, currentSiteId } = await requireUser();

  if (!currentSiteId) redirect("/dashboard");

  const tab: SiteDetailTabKey =
    typeof sp.tab === "string" && (VALID_TABS as readonly string[]).includes(sp.tab)
      ? (sp.tab as SiteDetailTabKey)
      : "overview";

  // Permission check at the target site (not the cookie site).
  const [canConfigure, canArchive] = await Promise.all([
    can("site:configure", id),
    can("site:archive", id),
  ]);
  if (!canConfigure) redirect("/admin/sites");

  // Site read.
  const { data: site, error: siteErr } = await supabase
    .from("sites")
    .select(
      `id, name, country, address, region, timezone, osha_establishment_id,
       naics_code, parent_site_id, archived_at, archived_by, archive_reason,
       setup_completed_at, setup_progress`,
    )
    .eq("id", id)
    .eq("org_id", profile.org_id)
    .single();

  if (siteErr || !site) notFound();

  // Parent choices for the parent_site_id combobox — every other site in
  // the org that's not archived.
  const { data: orgSites } = await supabase
    .from("sites")
    .select("id, name, country")
    .eq("org_id", profile.org_id)
    .is("archived_at", null)
    .order("name", { ascending: true });
  const parentChoices: ParentChoice[] = (orgSites ?? [])
    .filter((s) => s.id !== id)
    .map((s) => ({ id: s.id, name: s.name, country: s.country }));

  const archived = site.archived_at !== null;
  const editable: SiteEditable = {
    id: site.id,
    name: site.name,
    country: site.country,
    address: site.address,
    region: site.region,
    timezone: site.timezone,
    osha_establishment_id: site.osha_establishment_id,
    naics_code: site.naics_code,
    parent_site_id: site.parent_site_id,
  };

  // ---- Tab-specific data ----
  type Member = {
    profile_id: string;
    role_key: string | null;
    role_name: string | null;
    include_children: boolean;
    full_name: string | null;
    email: string;
  };
  let members: Member[] = [];
  let hours: AnnualHoursRow[] = [];

  if (tab === "members") {
    const { data: rawMembers } = await supabase
      .from("site_members")
      .select(
        "profile_id, include_children, role:roles(key, name), profile:profiles(full_name, email)",
      )
      .eq("site_id", site.id);
    members = (rawMembers ?? [])
      .filter((m) => m.profile)
      .map((m) => ({
        profile_id: m.profile_id,
        role_key: m.role?.key ?? null,
        role_name: m.role?.name ?? null,
        include_children: m.include_children,
        full_name: m.profile!.full_name,
        email: m.profile!.email,
      }));
  }

  if (tab === "hours") {
    const { data: rawHours } = await supabase
      .from("site_annual_hours")
      .select("year, hours_worked")
      .eq("site_id", site.id)
      .order("year", { ascending: false });
    hours = (rawHours ?? []).map((h) => ({
      year: h.year,
      hours_worked: Number(h.hours_worked),
    }));
  }

  const basePath = `/admin/sites/${site.id}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href="/admin/sites"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Sites
          </Link>
          <h1 className="mt-1 text-2xl font-semibold">{site.name}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground">{site.country}</span>
            {archived ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/20 bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                <Archive className="h-3 w-3" /> Archived
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success-foreground dark:text-success">
                Active
              </span>
            )}
            {archived && site.archived_at && (
              <span className="text-[11px] text-muted-foreground">
                · since {format(new Date(site.archived_at), "PP")}
              </span>
            )}
          </div>
          {archived && site.archive_reason && (
            <p className="mt-2 max-w-prose rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Reason: </span>
              {site.archive_reason}
            </p>
          )}
        </div>
        {canArchive && (
          <ArchiveSiteDialog
            siteId={site.id}
            siteName={site.name}
            archived={archived}
          />
        )}
      </div>

      <SiteDetailTabs current={tab} basePath={basePath} />

      {tab === "overview" && (
        <div className="rounded-lg border bg-card p-5">
          <EditSiteForm
            site={editable}
            parentChoices={parentChoices}
            readOnly={archived}
          />
          {archived && (
            <p className="mt-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              Editing is disabled while the site is archived. Unarchive first.
            </p>
          )}
        </div>
      )}

      {tab === "members" && (
        <div className="space-y-3">
          <div className="rounded-md border bg-warning/10 px-4 py-3 text-sm">
            <p className="font-medium">Member editing ships in Phase 11b.</p>
            <p className="text-xs text-muted-foreground">
              Read-only for now. To add a member today, run{" "}
              <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
                add_site_member_v1
              </code>{" "}
              from the SQL editor.
            </p>
          </div>
          {members.length === 0 ? (
            <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
              No members on this site yet.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Include children</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => {
                    const name = m.full_name ?? m.email;
                    return (
                      <TableRow key={m.profile_id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[10px]">
                                {initials(name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{name}</p>
                              <p className="text-[11px] text-muted-foreground">{m.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                            {m.role_name ?? m.role_key ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell>
                          {m.include_children ? (
                            <span className="text-xs">Yes</span>
                          ) : (
                            <span className="text-xs text-muted-foreground">No</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {tab === "hours" && (
        <AnnualHoursEditor
          siteId={site.id}
          initial={hours}
          readOnly={archived}
        />
      )}

      {tab === "setup" && (
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Setup state
              </p>
              <h2 className="text-base font-semibold">
                {site.setup_completed_at ? "Complete" : "In progress"}
              </h2>
              {site.setup_completed_at && (
                <p className="text-xs text-muted-foreground">
                  Finished {format(new Date(site.setup_completed_at), "PP")}
                </p>
              )}
            </div>
            {!site.setup_completed_at && (
              <Link
                href="/admin/site-setup"
                className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              >
                Resume wizard →
              </Link>
            )}
          </div>
          {site.setup_progress && Object.keys(site.setup_progress).length > 0 && (
            <details className="mt-3 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Progress payload
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-muted/30 p-3 text-[11px]">
                {JSON.stringify(site.setup_progress, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
