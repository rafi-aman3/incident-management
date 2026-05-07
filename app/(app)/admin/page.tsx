import Link from "next/link";
import {
  Building2,
  Users,
  ShieldCheck,
  Archive,
  ArrowRight,
  Database,
  Sparkles,
} from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { EmptyState } from "@/components/empty-state";

export default async function AdminPage() {
  const { supabase, profile, currentSiteId } = await requireUser();

  // Permission gate — show the dashboard to anyone with site:configure
  // (lifted on the migration), member:invite, or role:read on at least
  // the current site. Each tile/card filters per-perm again below.
  const [canConfigure, canInvite, canReadRoles] = currentSiteId
    ? await Promise.all([
        can("site:configure", currentSiteId),
        can("member:invite", currentSiteId),
        can("role:read", currentSiteId),
      ])
    : [false, false, false];

  if (!canConfigure && !canInvite && !canReadRoles) {
    return (
      <EmptyState
        title="Admin is for site admins"
        body="Ask a site admin to add the right permissions to your role to see this page."
      />
    );
  }

  // KPI counts. All scoped to the caller's org via RLS.
  const [
    activeSitesRes,
    archivedSitesRes,
    membersRes,
    rolesRes,
  ] = await Promise.all([
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .is("archived_at", null),
    supabase
      .from("sites")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id)
      .not("archived_at", "is", null),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id),
    supabase
      .from("roles")
      .select("id", { count: "exact", head: true })
      .eq("org_id", profile.org_id),
  ]);

  const activeSites = activeSitesRes.count ?? 0;
  const archivedSites = archivedSitesRes.count ?? 0;
  const members = membersRes.count ?? 0;
  const roles = rolesRes.count ?? 0;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="text-sm text-muted-foreground">
          Org configuration · sites, members, and role permissions.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile
          label="Active sites"
          value={activeSites}
          icon={Building2}
          href="/admin/sites"
        />
        <KpiTile
          label="Archived sites"
          value={archivedSites}
          icon={Archive}
          tone="muted"
          href="/admin/sites?status=archived"
        />
        <KpiTile label="Members" value={members} icon={Users} tone="muted" />
        <KpiTile label="Roles" value={roles} icon={ShieldCheck} tone="muted" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AdminCard
          title="Sites"
          body="Rename, edit address, re-parent, archive. Edit annual hours used by OSHA 300A."
          href="/admin/sites"
          available
        />
        <AdminCard
          title="Members"
          body="Org-wide member list, per-site role + include-children toggle. Email invitations land in 11c."
          href="/admin/members"
          available
        />
        <AdminCard
          title="Roles"
          body="Edit role permission sets. The 4 default roles (worker / supervisor / EHS manager / site admin) keep their identity but can pick up extra perms."
          available={false}
          comingIn="Phase 11c"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/site-setup"
          className="group flex items-center justify-between rounded-lg border bg-card p-4 hover:border-primary/40 hover:bg-accent/40"
        >
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Site setup wizard</p>
              <p className="text-sm text-muted-foreground">
                7-step wizard for first-time site configuration.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link
          href="/admin/demo"
          className="group flex items-center justify-between rounded-lg border bg-card p-4 hover:border-primary/40 hover:bg-accent/40"
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <p className="font-medium">Demo affordances</p>
              <p className="text-sm text-muted-foreground">
                Reset, sample-load, trigger banner — for stakeholder demos.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>
    </div>
  );
}

function KpiTile({
  label,
  value,
  icon: Icon,
  tone = "primary",
  href,
}: {
  label: string;
  value: number;
  icon: typeof Building2;
  tone?: "primary" | "muted";
  href?: string;
}) {
  const inner = (
    <div className="flex items-start justify-between rounded-lg border bg-card p-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
      </div>
      <Icon
        className={
          tone === "primary"
            ? "h-5 w-5 text-primary"
            : "h-5 w-5 text-muted-foreground"
        }
        aria-hidden
      />
    </div>
  );
  if (href)
    return (
      <Link href={href} className="block transition-colors hover:bg-accent/30">
        {inner}
      </Link>
    );
  return inner;
}

function AdminCard({
  title,
  body,
  href,
  available,
  comingIn,
}: {
  title: string;
  body: string;
  href?: string;
  available: boolean;
  comingIn?: string;
}) {
  if (!available) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-5 opacity-90">
        <div className="flex items-center justify-between">
          <h2 className="font-medium">{title}</h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            {comingIn}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      </div>
    );
  }
  return (
    <Link
      href={href!}
      className="group rounded-lg border bg-card p-5 transition-colors hover:border-primary/40 hover:bg-accent/30"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-medium">{title}</h2>
        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
    </Link>
  );
}
