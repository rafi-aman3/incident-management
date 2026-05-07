import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { orgCan } from "@/lib/auth/orgCan";
import { RoleFilters } from "@/components/admin/role-filters";
import { RoleList, type RoleRow } from "@/components/admin/role-list";
import { NewRoleDialog } from "@/components/admin/new-role-dialog";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function pickFirst(raw: string | string[] | undefined): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && raw.length > 0) return raw[0];
  return "";
}

export default async function AdminRolesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const { supabase, profile } = await requireUser();

  const [canRead, canCreate] = await Promise.all([
    orgCan("role:read"),
    orgCan("role:create"),
  ]);
  if (!canRead) redirect("/admin");

  const typeRaw = pickFirst(sp.type);
  const type: "system" | "custom" | "" =
    typeRaw === "system" || typeRaw === "custom" ? typeRaw : "";
  const q = pickFirst(sp.q).trim();

  const [rolesRes, rpRes, smRes, permsRes] = await Promise.all([
    (() => {
      let qb = supabase
        .from("roles")
        .select("id, key, name, description, is_default, created_at")
        .eq("org_id", profile.org_id);
      if (q) qb = qb.ilike("name", `%${q}%`);
      return qb.order("is_default", { ascending: false }).order("name", { ascending: true });
    })(),
    supabase
      .from("role_permissions")
      .select("role_id"),
    supabase.from("site_members").select("role_id"),
    supabase.from("permissions").select("key, description"),
  ]);

  const roles = rolesRes.data ?? [];
  const permCountByRole = new Map<string, number>();
  for (const rp of rpRes.data ?? []) {
    permCountByRole.set(rp.role_id, (permCountByRole.get(rp.role_id) ?? 0) + 1);
  }
  const memberCountByRole = new Map<string, number>();
  for (const sm of smRes.data ?? []) {
    memberCountByRole.set(
      sm.role_id,
      (memberCountByRole.get(sm.role_id) ?? 0) + 1,
    );
  }
  const catalog = (permsRes.data ?? []).map((p) => ({
    key: p.key,
    description: p.description,
  }));

  let rows: RoleRow[] = roles.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    description: r.description,
    is_default: r.is_default,
    permission_count: permCountByRole.get(r.id) ?? 0,
    member_count: memberCountByRole.get(r.id) ?? 0,
    created_at: r.created_at,
  }));

  if (type === "system") rows = rows.filter((r) => r.is_default);
  else if (type === "custom") rows = rows.filter((r) => !r.is_default);

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
            <ShieldCheck className="h-6 w-6 text-primary" /> Roles
          </h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} role{rows.length === 1 ? "" : "s"} in this org · system
            roles can be re-permissioned but not renamed or deleted.
          </p>
        </div>
        {canCreate && <NewRoleDialog catalog={catalog} />}
      </div>

      <RoleFilters current={{ type, q }} />
      <RoleList rows={rows} />
    </div>
  );
}
