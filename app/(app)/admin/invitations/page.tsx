import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Mail, Info } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { can } from "@/lib/auth/can";
import { cn } from "@/lib/utils";
import { InvitationsList, type InvitationRow } from "@/components/admin/invitations-list";
import { InviteMemberDialog } from "@/components/admin/invite-member-dialog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

function appUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.VERCEL_URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

export default async function AdminInvitationsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile, currentSiteId } = await requireUser();

  const [canRead, canInviteHere] = await Promise.all([
    orgCan("invitation:read"),
    currentSiteId ? can("member:invite", currentSiteId) : Promise.resolve(false),
  ]);
  if (!canRead) redirect("/admin");

  const statusFilter = pickFirst(sp.status) === "all" ? "all" : "pending";

  const [invRes, sitesRes, rolesRes] = await Promise.all([
    (() => {
      let qb = supabase
        .from("invitations")
        .select(
          "id, email, site_id, role_id, invited_by, expires_at, accepted_at, revoked_at, token",
        )
        .eq("org_id", profile.org_id);
      if (statusFilter === "pending") {
        qb = qb.is("accepted_at", null).is("revoked_at", null);
      }
      return qb.order("created_at", { ascending: false });
    })(),
    supabase
      .from("sites")
      .select("id, name, archived_at")
      .eq("org_id", profile.org_id)
      .order("name", { ascending: true }),
    supabase
      .from("roles")
      .select("id, key, name")
      .eq("org_id", profile.org_id)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true }),
  ]);

  const invitations = invRes.data ?? [];
  const inviterIds = Array.from(
    new Set(
      invitations.map((r) => r.invited_by).filter((id): id is string => !!id),
    ),
  );
  const inviterMap = new Map<string, { full_name: string | null; email: string }>();
  if (inviterIds.length > 0) {
    const { data: inviters } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", inviterIds);
    for (const p of inviters ?? []) {
      inviterMap.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  const sitesByIdMap = new Map((sitesRes.data ?? []).map((s) => [s.id, s.name]));
  const rolesByIdMap = new Map(
    (rolesRes.data ?? []).map((r) => [r.id, r.name]),
  );

  const url = appUrl();
  const rows: InvitationRow[] = invitations.map((r) => ({
    id: r.id,
    email: r.email,
    site_id: r.site_id,
    site_name: sitesByIdMap.get(r.site_id) ?? "—",
    role_id: r.role_id,
    role_name: rolesByIdMap.get(r.role_id) ?? "—",
    invited_by_name: r.invited_by ? inviterMap.get(r.invited_by)?.full_name ?? null : null,
    invited_by_email: r.invited_by ? inviterMap.get(r.invited_by)?.email ?? null : null,
    expires_at: r.expires_at,
    accepted_at: r.accepted_at,
    revoked_at: r.revoked_at,
    token: r.token,
    accept_url: `${url}/invite/${r.token}`,
  }));

  // Sites the inviting admin can actually invite into. We could resolve
  // member:invite per site here; the dialog itself rejects a site without
  // perms via the RPC. For the picker, list every active site in the org
  // (archived sites can still appear in the row table via sitesByIdMap).
  const sites = (sitesRes.data ?? [])
    .filter((s) => !s.archived_at)
    .map((s) => ({ id: s.id, name: s.name }));
  const roles = (rolesRes.data ?? []).map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
  }));

  const pendingCount = rows.filter(
    (r) => !r.accepted_at && !r.revoked_at && new Date(r.expires_at) > new Date(),
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
          >
            <ArrowLeft className="h-3 w-3" /> Admin
          </Link>
          <h1 className="mt-1 inline-flex items-center gap-2 text-2xl font-semibold">
            <Mail className="h-6 w-6 text-primary" /> Invitations
          </h1>
          <p className="text-sm text-muted-foreground">
            {pendingCount} pending · best-effort email + always-show-the-link.
          </p>
        </div>
        {canInviteHere && (
          <InviteMemberDialog
            sites={sites}
            roles={roles}
            defaultSiteId={currentSiteId ?? undefined}
          />
        )}
      </div>

      <FilterChips current={statusFilter} />

      {!canInviteHere && (
        <div className="rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Info className="mr-1 inline h-3 w-3" />
          You can read pending invitations but need <span className="font-mono">member:invite</span>{" "}
          on a site to send new ones.
        </div>
      )}

      <InvitationsList
        rows={statusFilter === "pending" ? rows.filter(isPending) : rows}
      />
    </div>
  );
}

function isPending(r: InvitationRow): boolean {
  return !r.accepted_at && !r.revoked_at && new Date(r.expires_at) > new Date();
}

function FilterChips({ current }: { current: "pending" | "all" }) {
  const chip = (label: string, value: "pending" | "all") => (
    <Link
      href={value === "pending" ? "/admin/invitations" : "/admin/invitations?status=all"}
      aria-pressed={current === value}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        current === value
          ? "border-primary bg-primary text-primary-foreground"
          : "hover:bg-accent",
      )}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chip("Pending", "pending")}
      {chip("All", "all")}
    </div>
  );
}
