/**
 * Idempotent seed for the EHS Operations Platform demo.
 *
 * Run with: pnpm db:seed   (which is `tsx --env-file=.env.local scripts/seed.ts`)
 *
 * Uses the service-role key. Each step is upsert-style or skipped if already
 * present, so re-running this script does NOT duplicate or error.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env. Did pnpm db:seed pass --env-file=.env.local?"
  );
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const log = (...args: unknown[]) => console.log("[seed]", ...args);

// ---------------------------------------------------------------------------
// 1. Org + default roles
// ---------------------------------------------------------------------------
async function ensureOrg() {
  const { data: existing } = await sb
    .from("orgs")
    .select("id, slug, is_demo")
    .eq("slug", "ucb")
    .maybeSingle();

  if (existing) {
    log("org ucb exists:", existing.id);
    // Re-running the seed flips is_demo on so demo affordances (reset /
    // sample-load / trigger-banner) work out of the box. The destructive
    // RPCs guard on this flag.
    if (!existing.is_demo) {
      const { error } = await sb.from("orgs").update({ is_demo: true }).eq("id", existing.id);
      if (error) throw error;
      log("org ucb flagged is_demo=true");
    }
    return existing.id as string;
  }

  const { data, error } = await sb
    .from("orgs")
    .insert({ name: "UCB", slug: "ucb", industry: "manufacturing", is_demo: true })
    .select("id")
    .single();
  if (error) throw error;
  log("org ucb created:", data.id);

  const { error: rolesErr } = await sb.rpc("seed_default_roles", { p_org_id: data.id });
  if (rolesErr) throw rolesErr;
  log("default roles seeded");

  return data.id as string;
}

async function loadRoleMap(orgId: string) {
  const { data, error } = await sb
    .from("roles")
    .select("id, key")
    .eq("org_id", orgId);
  if (error) throw error;
  return new Map(data.map((r) => [r.key, r.id]));
}

// Ensure default roles + permissions exist (re-run if seed_default_roles
// was added after the org was first created).
async function ensureDefaultRoles(orgId: string) {
  const map = await loadRoleMap(orgId);
  const expected = ["worker", "supervisor", "ehs_manager", "site_admin"];
  if (expected.every((k) => map.has(k))) return map;
  const { error } = await sb.rpc("seed_default_roles", { p_org_id: orgId });
  if (error) throw error;
  return loadRoleMap(orgId);
}

// ---------------------------------------------------------------------------
// 2. Sites — 2 top-level + 2 children for hierarchy + include_children demo
// ---------------------------------------------------------------------------
type SiteSeed = {
  slug: string; // not stored — used as natural key for idempotence via name
  name: string;
  country: "US" | "GB";
  region?: string;
  timezone: string;
  parent?: string; // slug of parent
  naics?: string;
  osha?: string;
};

const SITE_SEEDS: SiteSeed[] = [
  { slug: "houston",         name: "Houston",         country: "US", region: "TX", timezone: "America/Chicago", naics: "332710", osha: "OSHA-HOU-001" },
  { slug: "houston-bldg-a",  name: "Houston / Building A", country: "US", region: "TX", timezone: "America/Chicago", parent: "houston" },
  { slug: "manchester",      name: "Manchester",      country: "GB", region: "ENG", timezone: "Europe/London" },
  { slug: "manchester-north",name: "Manchester / North", country: "GB", region: "ENG", timezone: "Europe/London", parent: "manchester" },
];

async function ensureSites(orgId: string) {
  const map = new Map<string, string>(); // slug → id

  // Two passes: parents first.
  for (const seed of SITE_SEEDS.filter((s) => !s.parent)) {
    const id = await upsertSite(orgId, seed, undefined);
    map.set(seed.slug, id);
  }
  for (const seed of SITE_SEEDS.filter((s) => s.parent)) {
    const id = await upsertSite(orgId, seed, map.get(seed.parent!));
    map.set(seed.slug, id);
  }

  return map;
}

async function upsertSite(orgId: string, seed: SiteSeed, parentId: string | undefined) {
  const { data: existing } = await sb
    .from("sites")
    .select("id")
    .eq("org_id", orgId)
    .eq("name", seed.name)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data, error } = await sb
    .from("sites")
    .insert({
      org_id: orgId,
      parent_site_id: parentId ?? null,
      name: seed.name,
      country: seed.country,
      region: seed.region,
      timezone: seed.timezone,
      naics_code: seed.naics,
      osha_establishment_id: seed.osha,
    })
    .select("id")
    .single();
  if (error) throw error;
  log("site created:", seed.name);
  return data.id as string;
}

// ---------------------------------------------------------------------------
// 3. Demo users (Supabase auth.admin) + profile + site_members
// ---------------------------------------------------------------------------
type UserSeed = {
  email: string;
  password: string;
  fullName: string;
  roleKey: "worker" | "supervisor" | "ehs_manager" | "site_admin";
  primarySite: string;          // site slug
  additionalSites?: string[];   // site slugs (for ehs_manager / site_admin)
};

const USER_SEEDS: UserSeed[] = [
  { email: "worker@demo.local",     password: "Demo!2026", fullName: "Wally Worker",     roleKey: "worker",      primarySite: "houston" },
  { email: "supervisor@demo.local", password: "Demo!2026", fullName: "Sam Supervisor",   roleKey: "supervisor",  primarySite: "houston", additionalSites: ["houston-bldg-a"] },
  { email: "ehs@demo.local",        password: "Demo!2026", fullName: "Erin Manager",     roleKey: "ehs_manager", primarySite: "houston", additionalSites: ["manchester"] },
  { email: "admin@demo.local",      password: "Demo!2026", fullName: "Alex Admin",       roleKey: "site_admin",  primarySite: "houston", additionalSites: ["manchester"] },
];

async function findUserByEmail(email: string) {
  // listUsers is paginated; the demo dataset is tiny so first page is enough.
  const { data, error } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === email);
}

async function ensureUsers(orgId: string, sites: Map<string, string>, roles: Map<string, string>) {
  const userIds = new Map<string, string>(); // email → user id

  for (const seed of USER_SEEDS) {
    let user = await findUserByEmail(seed.email);
    if (!user) {
      const { data, error } = await sb.auth.admin.createUser({
        email: seed.email,
        password: seed.password,
        email_confirm: true,
        user_metadata: { full_name: seed.fullName, demo: true },
      });
      if (error) throw error;
      user = data.user!;
      log("user created:", seed.email);
    } else {
      log("user exists:", seed.email);
    }
    userIds.set(seed.email, user.id);

    // profile (id = auth.users.id)
    const { error: profErr } = await sb
      .from("profiles")
      .upsert({
        id: user.id,
        org_id: orgId,
        full_name: seed.fullName,
        email: seed.email,
      }, { onConflict: "id" });
    if (profErr) throw profErr;

    // site_members — upsert by (profile_id, site_id)
    const allSites = [seed.primarySite, ...(seed.additionalSites ?? [])];
    for (const slug of allSites) {
      const siteId = sites.get(slug);
      if (!siteId) throw new Error(`unknown site slug: ${slug}`);
      const roleId = roles.get(seed.roleKey);
      if (!roleId) throw new Error(`unknown role key: ${seed.roleKey}`);
      const { error } = await sb
        .from("site_members")
        .upsert(
          {
            profile_id: user.id,
            site_id: siteId,
            role_id: roleId,
            include_children: seed.roleKey !== "worker",
          },
          { onConflict: "profile_id,site_id" }
        );
      if (error) throw error;
    }
  }

  return userIds;
}

// ---------------------------------------------------------------------------
// 4. Demo data: incidents + investigations + CAPAs + notifications
// ---------------------------------------------------------------------------
type IncidentSeed = {
  type:
    | "injury" | "illness" | "near_miss" | "property_damage"
    | "environmental_release" | "unsafe_condition" | "observation" | "dangerous_occurrence";
  title: string;
  description: string;
  daysAgo: number;        // occurred_at = now - daysAgo days
  site: string;           // slug
  severity?: "S1" | "S2" | "S3" | "S4" | "S5";
  track?: "A" | "B" | "C";
  status: "draft" | "submitted" | "classified" | "under_investigation" | "awaiting_capa" | "closed";
  oshaRecordable?: boolean;
  riddorReportable?: boolean;
  reporter: string;        // email
};

const INCIDENT_SEEDS: IncidentSeed[] = [
  // Houston (US) — recent & varied
  { type: "injury",                title: "Hand laceration on press 7",         description: "Operator caught left hand between guard and tooling; 3-cm laceration to the palm.",        daysAgo: 4,   site: "houston",        severity: "S2", track: "A", status: "under_investigation", oshaRecordable: true,  reporter: "worker@demo.local" },
  { type: "injury",                title: "Slip in lubricant pool",             description: "Worker slipped near CNC #4; bruised knee, first aid only.",                              daysAgo: 12,  site: "houston-bldg-a", severity: "S3", track: "B", status: "awaiting_capa",        oshaRecordable: true,  reporter: "worker@demo.local" },
  { type: "near_miss",             title: "Falling pallet from rack 12",        description: "Stretch-wrap failed; pallet fell, no one in aisle.",                                     daysAgo: 18,  site: "houston",        severity: "S2", track: "A", status: "under_investigation",                                  reporter: "supervisor@demo.local" },
  { type: "property_damage",       title: "Forklift collision with rack",       description: "Operator backed into upright; rack member visibly bowed.",                               daysAgo: 30,  site: "houston-bldg-a", severity: "S3", track: "B", status: "awaiting_capa",                                       reporter: "supervisor@demo.local" },
  { type: "environmental_release", title: "Coolant overflow, ~10L",             description: "Sump alarm missed; 10L coolant onto floor, contained with absorbent.",                  daysAgo: 45,  site: "houston",        severity: "S3", track: "B", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "unsafe_condition",      title: "Missing machine guard, mill 2",      description: "Guard removed for maintenance and not reinstalled.",                                     daysAgo: 60,  site: "houston-bldg-a", severity: "S2", track: "A", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "observation",           title: "PPE compliance dip on Line B",       description: "Three workers without safety glasses at start of shift.",                                daysAgo: 75,  site: "houston",        severity: "S5", track: "C", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "dangerous_occurrence",  title: "Compressor over-pressure release",   description: "PRV lifted; no injury, plant evacuated for 20 min.",                                     daysAgo: 90,  site: "houston",        severity: "S2", track: "A", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "injury",                title: "Eye irritation from cleaning agent", description: "Splash during transfer; flushed at eyewash, no medical treatment.",                      daysAgo: 110, site: "houston",        severity: "S4", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
  { type: "near_miss",             title: "Overhead crane drift",               description: "Crane drifted 2m beyond stop; no load.",                                                 daysAgo: 130, site: "houston-bldg-a", severity: "S3", track: "B", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "illness",               title: "Heat-stress symptoms, summer shift", description: "Two workers reported dizziness; rehydration & cool-down protocol.",                      daysAgo: 160, site: "houston",        severity: "S3", track: "B", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "property_damage",       title: "Conveyor motor seizure",             description: "Motor seized; 4-hour line stoppage. No injury.",                                          daysAgo: 200, site: "houston-bldg-a", severity: "S4", track: "C", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "observation",           title: "Good catch — labeled chemical bin",  description: "Worker proactively re-labeled corroded bin; positive observation.",                       daysAgo: 220, site: "houston",        severity: "S5", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
  { type: "near_miss",             title: "Unsecured ladder on mezzanine",      description: "Ladder fell; no one nearby.",                                                            daysAgo: 250, site: "houston",        severity: "S4", track: "C", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "injury",                title: "Sprained ankle on warehouse step",   description: "Step missing tread tape; first-aid only, returned to work.",                              daysAgo: 290, site: "houston-bldg-a", severity: "S4", track: "C", status: "closed",                                              oshaRecordable: false, reporter: "worker@demo.local" },

  // Manchester (UK / RIDDOR jurisdiction)
  { type: "injury",                title: "Fractured wrist — packing line",     description: "Operator caught wrist between conveyor and frame; X-ray confirmed fracture.",            daysAgo: 6,   site: "manchester",       severity: "S1", track: "A", status: "under_investigation", riddorReportable: true,  reporter: "ehs@demo.local" },
  { type: "dangerous_occurrence",  title: "Forklift overturn, no injury",       description: "Forklift tipped during turn; driver uninjured. RIDDOR-reportable.",                       daysAgo: 22,  site: "manchester-north", severity: "S2", track: "A", status: "awaiting_capa",       riddorReportable: true,  reporter: "supervisor@demo.local" },
  { type: "near_miss",             title: "Chemical drum tipping",              description: "100L IBC tipped; bunded, no spill outside.",                                              daysAgo: 35,  site: "manchester",       severity: "S2", track: "A", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "environmental_release", title: "Solvent spill, ~5L",                 description: "5L solvent spill, contained within bund. No off-site impact.",                            daysAgo: 50,  site: "manchester-north", severity: "S3", track: "B", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "illness",               title: "Dermatitis cluster, Line 3",         description: "Three workers reported dermatitis symptoms; investigation linked to glove change.",       daysAgo: 80,  site: "manchester",       severity: "S2", track: "A", status: "closed",                                              riddorReportable: true,  reporter: "ehs@demo.local" },
  { type: "unsafe_condition",      title: "Damaged hand-rail, mezzanine",       description: "Hand-rail bent inward; tagged out and replaced.",                                         daysAgo: 100, site: "manchester-north", severity: "S3", track: "B", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "observation",           title: "Cluttered fire exit",                description: "Pallets blocking secondary fire exit; cleared during walk.",                              daysAgo: 120, site: "manchester",       severity: "S5", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
  { type: "injury",                title: "Cut from cardboard banding",         description: "Minor cut while breaking down banding; first-aid only.",                                  daysAgo: 140, site: "manchester-north", severity: "S4", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
  { type: "property_damage",       title: "Pallet truck damaged shelving",      description: "Pallet truck struck shelving leg; replaced.",                                              daysAgo: 170, site: "manchester",       severity: "S4", track: "C", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "near_miss",             title: "Dropped object from height",         description: "Spanner dropped from mezzanine; no one below.",                                            daysAgo: 195, site: "manchester-north", severity: "S3", track: "B", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "injury",                title: "Strain — manual handling",           description: "Lower-back strain lifting box; medical treatment, 3 days restricted duty.",               daysAgo: 230, site: "manchester",       severity: "S3", track: "B", status: "closed",                                              riddorReportable: false, reporter: "worker@demo.local" },
  { type: "observation",           title: "Good housekeeping — Line 5",         description: "Positive observation; line consistently clear of obstructions.",                          daysAgo: 260, site: "manchester-north", severity: "S5", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
  { type: "environmental_release", title: "Detergent spill, ~3L",               description: "Detergent spilled in wash bay; rinsed to bunded drain.",                                  daysAgo: 285, site: "manchester",       severity: "S4", track: "C", status: "closed",                                              reporter: "ehs@demo.local" },
  { type: "near_miss",             title: "Trip on cable run",                  description: "Loose extension cord; covered with duct cover.",                                          daysAgo: 320, site: "manchester-north", severity: "S5", track: "C", status: "closed",                                              reporter: "supervisor@demo.local" },
  { type: "unsafe_condition",      title: "Loose ceiling panel",                description: "Suspended ceiling panel hanging; reported to facilities.",                                daysAgo: 350, site: "manchester",       severity: "S4", track: "C", status: "closed",                                              reporter: "worker@demo.local" },
];

async function ensureIncidents(orgId: string, sites: Map<string, string>, users: Map<string, string>) {
  const { count } = await sb
    .from("incidents")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) > 0) {
    log("incidents already seeded — skipping");
    return null;
  }

  const rows = INCIDENT_SEEDS.map((s) => {
    const occurredAt = new Date(Date.now() - s.daysAgo * 86_400_000).toISOString();
    const classifiedAt = s.status !== "draft" && s.status !== "submitted" ? occurredAt : null;
    const closedAt = s.status === "closed" ? occurredAt : null;
    return {
      org_id: orgId,
      site_id: sites.get(s.site)!,
      type: s.type,
      title: s.title,
      description: s.description,
      occurred_at: occurredAt,
      severity: s.severity ?? null,
      track: s.track ?? null,
      status: s.status,
      reporter_id: users.get(s.reporter)!,
      osha_recordable: s.oshaRecordable ?? false,
      riddor_reportable: s.riddorReportable ?? false,
      classified_at: classifiedAt,
      closed_at: closedAt,
    };
  });

  const { data, error } = await sb
    .from("incidents")
    .insert(rows)
    .select(
      "id, ref_code, type, title, severity, site_id, status, osha_recordable, riddor_reportable, occurred_at"
    );
  if (error) throw error;
  log(`incidents inserted: ${data.length}`);
  return data;
}

// ---------------------------------------------------------------------------
// 4b. Injured persons — drive OSHA 300 / 300A / 301 + RIDDOR F2508 paperwork.
// One injured_person per injury/illness incident; specials (fracture, heat-
// stress, dermatitis cluster, hand laceration) get realistic days_away /
// days_restricted / riddor_specified_injury so reports actually populate.
// ---------------------------------------------------------------------------
type IncidentRow = NonNullable<Awaited<ReturnType<typeof ensureIncidents>>>[number];

async function ensureInjuredPersons(orgId: string) {
  const { data: incidents } = await sb
    .from("incidents")
    .select("id, type, title, severity, site_id, status, osha_recordable, riddor_reportable, occurred_at, ref_code")
    .eq("org_id", orgId)
    .in("type", ["injury", "illness"]);
  if (!incidents || incidents.length === 0) return;

  const { count } = await sb
    .from("injured_persons")
    .select("id", { count: "exact", head: true })
    .in(
      "incident_id",
      incidents.map((i) => i.id)
    );
  if ((count ?? 0) > 0) {
    log("injured_persons already seeded — skipping");
    return;
  }

  type Person = Record<string, unknown>;
  const rows: Person[] = [];

  for (const inc of incidents) {
    if (inc.type !== "injury" && inc.type !== "illness") continue;

    const t = inc.title.toLowerCase();
    const base = {
      incident_id: inc.id,
      name: "Sample Worker",
      job_title: "Operator",
      department: "Production",
      employment_status: "employee",
    };

    if (t.includes("hand laceration")) {
      rows.push({
        ...base,
        body_parts: ["left_hand"],
        injury_nature: "laceration",
        object_substance: "tooling",
        treatment: "medical",
        days_away: 2,
        days_restricted: 5,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("fractured wrist")) {
      rows.push({
        ...base,
        name: "Sample UK Worker",
        body_parts: ["right_hand"],
        injury_nature: "fracture",
        object_substance: "conveyor",
        treatment: "hospitalization",
        days_away: 14,
        days_restricted: 0,
        fatality: false,
        hospitalized: true,
        riddor_specified_injury: "fracture",
      });
    } else if (t.includes("slip in lubricant")) {
      rows.push({
        ...base,
        body_parts: ["left_leg"],
        injury_nature: "contusion",
        object_substance: "floor",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 0,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("eye irritation")) {
      rows.push({
        ...base,
        body_parts: ["left_eye", "right_eye"],
        injury_nature: "irritation",
        object_substance: "cleaning agent",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 0,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("sprained ankle")) {
      rows.push({
        ...base,
        body_parts: ["left_foot"],
        injury_nature: "sprain",
        object_substance: "step",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 0,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("heat-stress")) {
      rows.push({
        ...base,
        body_parts: ["head"],
        injury_nature: "occupational_illness",
        object_substance: "heat",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 1,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("dermatitis")) {
      rows.push({
        ...base,
        body_parts: ["left_hand", "right_hand"],
        injury_nature: "skin_disorder",
        object_substance: "cleaning agent",
        treatment: "medical",
        days_away: 0,
        days_restricted: 7,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("strain")) {
      rows.push({
        ...base,
        body_parts: ["back"],
        injury_nature: "strain",
        object_substance: "manual lift",
        treatment: "medical",
        days_away: 0,
        days_restricted: 3,
        fatality: false,
        hospitalized: false,
      });
    } else if (t.includes("cut from cardboard")) {
      rows.push({
        ...base,
        body_parts: ["right_hand"],
        injury_nature: "laceration",
        object_substance: "cardboard banding",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 0,
        fatality: false,
        hospitalized: false,
      });
    } else {
      // Generic fallback for any other injury / illness
      rows.push({
        ...base,
        body_parts: ["other"],
        injury_nature: inc.type === "illness" ? "occupational_illness" : "contusion",
        treatment: "first_aid",
        days_away: 0,
        days_restricted: 0,
        fatality: false,
        hospitalized: false,
      });
    }
  }

  if (rows.length === 0) return;

  const { error } = await sb.from("injured_persons").insert(rows);
  if (error) throw error;
  log(`injured_persons inserted: ${rows.length}`);
}

// ---------------------------------------------------------------------------
// 4c. Witnesses — a few rows so the witness-statement carry-over (incident →
// investigation) has something to display.
// ---------------------------------------------------------------------------
async function ensureWitnesses(orgId: string) {
  const { data: incidents } = await sb
    .from("incidents")
    .select("id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(6);
  if (!incidents || incidents.length === 0) return;

  const { count } = await sb
    .from("witnesses")
    .select("id", { count: "exact", head: true })
    .in(
      "incident_id",
      incidents.map((i) => i.id)
    );
  if ((count ?? 0) > 0) {
    log("witnesses already seeded — skipping");
    return;
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const inc of incidents) {
    rows.push({
      incident_id: inc.id,
      name: "Pat Coworker",
      contact: "pat@demo.local",
      statement:
        "Heard a loud noise and turned to see the event. Cordoned the area and notified the supervisor immediately.",
    });
  }

  const { error } = await sb.from("witnesses").insert(rows);
  if (error) throw error;
  log(`witnesses inserted: ${rows.length}`);
}

// ---------------------------------------------------------------------------
// 4d. Site annual hours — without this TRIR/DART can't compute. Houston gets
// 250k hours (≈125 FTEs), Manchester 180k (≈90 FTEs). Year = current.
// ---------------------------------------------------------------------------
async function ensureSiteAnnualHours(sites: Map<string, string>, users: Map<string, string>) {
  const year = new Date().getFullYear();
  const admin = users.get("admin@demo.local")!;

  const { count } = await sb
    .from("site_annual_hours")
    .select("site_id", { count: "exact", head: true })
    .eq("year", year);
  if ((count ?? 0) > 0) {
    log("site_annual_hours already seeded — skipping");
    return;
  }

  const rows = [
    { site_id: sites.get("houston")!, year, hours_worked: 250_000, updated_by: admin },
    { site_id: sites.get("manchester")!, year, hours_worked: 180_000, updated_by: admin },
  ];

  const { error } = await sb.from("site_annual_hours").insert(rows);
  if (error) throw error;
  log(`site_annual_hours inserted: ${rows.length} (year ${year})`);
}

// ---------------------------------------------------------------------------
// 5. Investigations (5 across Kanban statuses) + sample CAPAs
// ---------------------------------------------------------------------------

async function seedInvestigationsAndCAPAs(
  orgId: string,
  sites: Map<string, string>,
  users: Map<string, string>,
  incidents: IncidentRow[] | null
) {
  if (!incidents) return; // already-seeded path

  const { count: invCount } = await sb
    .from("investigations")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((invCount ?? 0) > 0) {
    log("investigations already seeded — skipping");
    return;
  }

  const ehs = users.get("ehs@demo.local")!;
  const supervisor = users.get("supervisor@demo.local")!;
  const admin = users.get("admin@demo.local")!;

  const targets = incidents.filter(
    (i) => i.status === "under_investigation" || i.status === "awaiting_capa"
  );

  const investigationRows = targets.slice(0, 5).map((inc, idx) => ({
    incident_id: inc.id,
    site_id: inc.site_id,
    org_id: orgId,
    lead_investigator_id: idx % 2 === 0 ? ehs : supervisor,
    status:
      idx === 0 ? "pending_assignment" :
      idx === 1 ? "in_progress" :
      idx === 2 ? "awaiting_capa" :
      idx === 3 ? "closed" :
      "in_progress",
    started_at: idx === 0 ? null : new Date(Date.now() - idx * 86_400_000).toISOString(),
    due_date: new Date(Date.now() + (14 - idx * 3) * 86_400_000).toISOString().slice(0, 10),
    findings: idx >= 1 ? "Initial walk-through complete; awaiting evidence." : null,
  } satisfies Record<string, unknown>));

  const { data: invs, error: invErr } = await sb
    .from("investigations")
    .insert(investigationRows)
    .select("id, ref_code, incident_id, site_id, status");
  if (invErr) throw invErr;
  log(`investigations inserted: ${invs.length}`);

  // CAPAs — 8 across lifecycle stages
  const capaRows = [
    { type: "corrective", title: "Replace press 7 light curtain", owner: supervisor, verifier: ehs,    status: "in_progress",        progress: 35,  due: 10 },
    { type: "preventive", title: "Update lockout/tagout SOP",     owner: ehs,        verifier: admin,  status: "completed",          progress: 100, due: -2 }, // overdue
    { type: "corrective", title: "Re-install mill 2 guard",       owner: supervisor, verifier: ehs,    status: "pending_verification", progress: 100, due: 5  },
    { type: "preventive", title: "Forklift refresher training",   owner: ehs,        verifier: admin,  status: "verified",            progress: 100, due: 30 },
    { type: "corrective", title: "Heat-stress hydration stations",owner: supervisor, verifier: ehs,    status: "closed",              progress: 100, due: -120 },
    { type: "corrective", title: "Replace shelving leg",          owner: supervisor, verifier: ehs,    status: "in_progress",        progress: 60,  due: 7  },
    { type: "preventive", title: "Glove change-out audit",        owner: ehs,        verifier: admin,  status: "in_progress",        progress: 20,  due: 14 },
    { type: "corrective", title: "Hand-rail inspection schedule", owner: supervisor, verifier: ehs,    status: "created",             progress: 0,   due: 30 },
  ];

  const linked = invs.slice(0, capaRows.length);
  const capaInsertRows = capaRows.map((c, i) => {
    const inv = linked[i] ?? linked[0];
    const dueDate = new Date(Date.now() + c.due * 86_400_000).toISOString().slice(0, 10);
    return {
      org_id: orgId,
      site_id: inv.site_id,
      investigation_id: inv.id,
      incident_id: inv.incident_id,
      type: c.type,
      title: c.title,
      description: `Demo CAPA — ${c.title}.`,
      owner_id: c.owner,
      verifier_id: c.verifier,
      due_date: dueDate,
      status: c.status,
      progress_pct: c.progress,
      verification_result:
        c.status === "verified" || c.status === "closed" ? "effective" : null,
      verification_method:
        c.status === "verified" || c.status === "closed" ? "audit_trend" : null,
      completed_at:
        c.status === "completed" || c.status === "pending_verification" || c.status === "verified" || c.status === "closed"
          ? new Date(Date.now() - 86_400_000).toISOString()
          : null,
      verified_at:
        c.status === "verified" || c.status === "closed"
          ? new Date(Date.now() - 86_400_000).toISOString()
          : null,
      closed_at: c.status === "closed" ? new Date(Date.now() - 43_200_000).toISOString() : null,
    } satisfies Record<string, unknown>;
  });

  const { data: capas, error: capaErr } = await sb
    .from("capas")
    .insert(capaInsertRows)
    .select("id, ref_code, status");
  if (capaErr) throw capaErr;
  log(`capas inserted: ${capas.length}`);
}

// ---------------------------------------------------------------------------
// 5d. Partial-effective CAPA chain — runs independently of the existing
// seedInvestigationsAndCAPAs path so it backfills already-seeded orgs too.
// Idempotency: gates on capas.follow_up_capa_id IS NOT NULL for the org.
// ---------------------------------------------------------------------------
async function ensurePartialEffectiveChain(orgId: string, users: Map<string, string>) {
  const { data: existing } = await sb
    .from("capas")
    .select("id")
    .eq("org_id", orgId)
    .not("follow_up_capa_id", "is", null)
    .limit(1);
  if (existing && existing.length > 0) {
    log("partial-effective CAPA chain already seeded — skipping");
    return;
  }

  const { data: invs } = await sb
    .from("investigations")
    .select("id, site_id, incident_id")
    .eq("org_id", orgId)
    .limit(1);
  if (!invs || invs.length === 0) return;
  const parentInv = invs[0];

  const supervisor = users.get("supervisor@demo.local")!;
  const ehs = users.get("ehs@demo.local")!;

  const { data: parentCapa, error: parentErr } = await sb
    .from("capas")
    .insert({
      org_id: orgId,
      site_id: parentInv.site_id,
      investigation_id: parentInv.id,
      incident_id: parentInv.incident_id,
      type: "corrective",
      title: "Press 7 controls retrofit (parent)",
      description:
        "Initial fix to the operator-side controls. Verified as partially effective — residual ergonomic risk remained.",
      owner_id: supervisor,
      verifier_id: ehs,
      due_date: new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10),
      status: "closed",
      progress_pct: 100,
      verification_result: "partially_effective",
      verification_method: "inspection",
      completed_at: new Date(Date.now() - 7 * 86_400_000).toISOString(),
      verified_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
      closed_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    })
    .select("id")
    .single();
  if (parentErr) throw parentErr;

  const { data: followUp, error: followErr } = await sb
    .from("capas")
    .insert({
      org_id: orgId,
      site_id: parentInv.site_id,
      investigation_id: parentInv.id,
      incident_id: parentInv.incident_id,
      type: "corrective",
      title: "Follow-up: Press 7 controls retrofit",
      description:
        "Auto-created follow-up — parent CAPA was verified as partially effective. Residual ergonomic risk: add a height-adjustable platform.",
      owner_id: supervisor,
      due_date: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10),
      status: "created",
      progress_pct: 0,
    })
    .select("id")
    .single();
  if (followErr) throw followErr;

  await sb
    .from("capas")
    .update({ follow_up_capa_id: followUp.id })
    .eq("id", parentCapa.id);

  log("partial-effective parent + follow-up CAPA chain seeded");
}

// ---------------------------------------------------------------------------
// 5b. RCA whys — populate one in-progress investigation's 5-Why chain so the
// 5-Why tab demo isn't empty. Queries investigations directly so it backfills
// already-seeded orgs too.
// ---------------------------------------------------------------------------
async function ensureRcaWhys(orgId: string) {
  const { data: invs } = await sb
    .from("investigations")
    .select("id, status")
    .eq("org_id", orgId)
    .in("status", ["in_progress", "awaiting_capa"]);
  if (!invs || invs.length === 0) return;
  const target = invs[0];

  const { count } = await sb
    .from("rca_whys")
    .select("level", { count: "exact", head: true })
    .eq("investigation_id", target.id);
  if ((count ?? 0) > 0) {
    log("rca_whys already seeded — skipping");
    return;
  }

  const rows = [
    { level: 1, question: "Why was the operator injured?", answer: "Hand caught between guard and tooling on press 7." },
    { level: 2, question: "Why did the guard not stop the press?", answer: "Light curtain was bypassed by a defeated interlock." },
    { level: 3, question: "Why was the interlock defeated?", answer: "Operators routinely defeat it for short setup runs because the cycle stops aren't reliable." },
    { level: 4, question: "Why are the cycle stops unreliable?", answer: "Sensor alignment drifts after each die change; PM checklist doesn't include a sensor-alignment step." },
    { level: 5, question: "Why does the PM checklist miss it?", answer: "Last template review was 2019; new sensor model installed in 2023 not reflected in PM scope." },
  ];

  const { error } = await sb.from("rca_whys").insert(
    rows.map((r) => ({ investigation_id: target.id, ...r }))
  );
  if (error) throw error;
  log(`rca_whys inserted: ${rows.length} (investigation ${target.id})`);
}

// ---------------------------------------------------------------------------
// 5c. HSE notification record — for the Manchester fractured-wrist incident.
// Phone-call timestamp + reference is recorded; written submission still pending,
// so the F2508 page demo shows both states (recorded + outstanding).
// ---------------------------------------------------------------------------
async function ensureHseRecord(orgId: string, users: Map<string, string>) {
  const { data: incidents } = await sb
    .from("incidents")
    .select("id, ref_code, title, riddor_reportable")
    .eq("org_id", orgId)
    .eq("riddor_reportable", true);
  if (!incidents || incidents.length === 0) return;

  const target = incidents.find((i) => /fractur/i.test(i.title));
  if (!target) return;

  const { data: existing } = await sb
    .from("hse_notification_records")
    .select("incident_id")
    .eq("incident_id", target.id)
    .maybeSingle();
  if (existing) {
    log("hse_notification_records already seeded — skipping");
    return;
  }

  const ehs = users.get("ehs@demo.local")!;
  const { error } = await sb.from("hse_notification_records").insert({
    incident_id: target.id,
    phone_called_at: new Date(Date.now() - 5 * 86_400_000).toISOString(),
    phoned_by: ehs,
    hse_phone_reference: "HSE-2026-7421",
  });
  if (error) throw error;
  log(`hse_notification_records inserted (incident ${target.ref_code})`);
}

// ---------------------------------------------------------------------------
// 6. A couple of active notifications for the dashboard banner
// ---------------------------------------------------------------------------
async function seedNotifications(
  orgId: string,
  sites: Map<string, string>,
  users: Map<string, string>
) {
  const { count } = await sb
    .from("notifications")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) > 0) {
    log("notifications already seeded — skipping");
    return;
  }

  const ehs = users.get("ehs@demo.local")!;
  const houston = sites.get("houston")!;
  const manchester = sites.get("manchester")!;

  const rows = [
    {
      kind: "osha_24hr",
      site_id: houston,
      recipient_id: ehs,
      title: "OSHA 24-hour report due",
      body: "Hospitalization reported on press 7 — OSHA Area Office must be notified within 24h.",
      deadline_at: new Date(Date.now() + 18 * 3_600_000).toISOString(),
    },
    {
      kind: "riddor_immediate",
      site_id: manchester,
      recipient_id: ehs,
      title: "RIDDOR immediate phone notification",
      body: "Fractured wrist on packing line — phone HSE before submitting F2508.",
      deadline_at: new Date(Date.now() + 6 * 3_600_000).toISOString(),
    },
    {
      kind: "capa_overdue",
      site_id: houston,
      recipient_id: ehs,
      title: "CAPA overdue: LOTO SOP update",
      body: "CAPA passed its due date. Reassign or update progress.",
      deadline_at: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      resolved_at: new Date().toISOString(), // resolved one
    },
  ];

  const { error } = await sb.from("notifications").insert(rows);
  if (error) throw error;
  log(`notifications inserted: ${rows.length}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  const orgId = await ensureOrg();
  const roles = await ensureDefaultRoles(orgId);
  const sites = await ensureSites(orgId);
  const users = await ensureUsers(orgId, sites, roles);
  const incidents = await ensureIncidents(orgId, sites, users);
  await ensureInjuredPersons(orgId);
  await ensureWitnesses(orgId);
  await ensureSiteAnnualHours(sites, users);
  await seedInvestigationsAndCAPAs(orgId, sites, users, incidents);
  await ensurePartialEffectiveChain(orgId, users);
  await ensureRcaWhys(orgId);
  await ensureHseRecord(orgId, users);
  await seedNotifications(orgId, sites, users);
  log("done.");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
