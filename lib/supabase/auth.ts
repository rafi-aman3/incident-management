import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export const SELECTED_SITE_COOKIE = "selected_site";

export type RoleKey = "worker" | "supervisor" | "ehs_manager" | "site_admin";

export type Membership = {
  site_id: string;
  include_children: boolean;
  role: { id: string; key: RoleKey; name: string } | null;
  site: {
    id: string;
    name: string;
    country: "US" | "GB";
    parent_site_id: string | null;
  } | null;
};

export type ProfileRow = {
  id: string;
  org_id: string;
  email: string;
  full_name: string | null;
  department: string | null;
  seen_welcome: boolean;
};

/**
 * Server-side session gate. Redirects to /login if no session or no profile.
 * Returns the user's profile + memberships + the resolved "current site"
 * (cookie-driven; falls back to first membership).
 */
export async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, org_id, email, full_name, department, seen_welcome")
    .eq("id", user.id)
    .single<ProfileRow>();

  if (!profile) redirect("/login");

  const { data: memberships } = await supabase
    .from("site_members")
    .select(
      "site_id, include_children, role:roles(id, key, name), site:sites(id, name, country, parent_site_id)"
    )
    .eq("profile_id", user.id)
    .returns<Membership[]>();

  const list = memberships ?? [];

  const cookieStore = await cookies();
  const cookieSiteId = cookieStore.get(SELECTED_SITE_COOKIE)?.value;
  const currentMembership =
    list.find((m) => m.site_id === cookieSiteId) ?? list[0] ?? null;

  return {
    supabase,
    user,
    profile,
    memberships: list,
    currentMembership,
    currentSiteId: currentMembership?.site_id ?? null,
    currentRoleKey: (currentMembership?.role?.key ?? "worker") as RoleKey,
  };
}
