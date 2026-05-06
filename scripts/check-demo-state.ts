/**
 * One-off diagnostic — prints the current state of the 4 demo accounts:
 * auth user existence, profile row, and site_members rows.
 *
 * Run with:  pnpm tsx --env-file=.env.local scripts/check-demo-state.ts
 */

import { createClient } from "@supabase/supabase-js";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const EMAILS = [
  "worker@demo.local",
  "supervisor@demo.local",
  "ehs@demo.local",
  "admin@demo.local",
];

async function main() {
  const { data: usersResp } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  const users = usersResp.users.filter((u) => u.email && EMAILS.includes(u.email));

  console.log("\n=== auth.users ===");
  for (const u of users) {
    console.log(` - ${u.email} → ${u.id}`);
  }

  for (const email of EMAILS) {
    const user = users.find((u) => u.email === email);
    if (!user) {
      console.log(`\n[${email}] ❌ no auth user`);
      continue;
    }

    const { data: profile } = await sb
      .from("profiles")
      .select("id, org_id, full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const { data: members } = await sb
      .from("site_members")
      .select("site_id, role:roles(key, name), site:sites(name, country, org_id)")
      .eq("profile_id", user.id)
      .returns<
        Array<{
          site_id: string;
          role: { key: string; name: string } | null;
          site: { name: string; country: string; org_id: string } | null;
        }>
      >();

    console.log(`\n[${email}]`);
    console.log("  profile:", profile ?? "❌ MISSING");
    console.log(`  memberships: ${members?.length ?? 0}`);
    for (const m of members ?? []) {
      console.log(
        `    - ${m.site?.name} (${m.site?.country}) · role=${m.role?.key} · org_id=${m.site?.org_id}`,
      );
    }
  }

  console.log("\n=== sites in UCB org ===");
  const { data: org } = await sb.from("orgs").select("id").eq("slug", "ucb").maybeSingle();
  if (org) {
    const { data: sites } = await sb
      .from("sites")
      .select("id, name, country, parent_site_id, setup_completed_at")
      .eq("org_id", org.id)
      .order("name");
    for (const s of sites ?? []) {
      console.log(
        ` - ${s.name} (${s.country}) · setup_completed_at=${s.setup_completed_at ?? "null"}`,
      );
    }
  }

  console.log("\n=== roles in UCB org ===");
  if (org) {
    const { data: roles } = await sb.from("roles").select("key, name").eq("org_id", org.id);
    for (const r of roles ?? []) console.log(` - ${r.key}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
