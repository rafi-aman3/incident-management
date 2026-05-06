/**
 * Idempotent seed for the EHS Operations Platform demo.
 *
 * Run with: pnpm db:seed   (which is `tsx --env-file=.env.local scripts/seed.ts`)
 *
 * Uses the service-role key. Each step is upsert-style or skipped if already
 * present, so re-running this script does NOT duplicate or error.
 */

import { createClient } from "@supabase/supabase-js";
import { PRESETS } from "../lib/templates/presets/preset-data";
import { walkAnswerable } from "../lib/templates/items";
import type {
  TemplateNodeItem,
  TemplateData,
  InspectionAnswer,
} from "../lib/templates/types";

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
// 14. Phase 3 — Templates: system-preset library + UCB clones + assignments +
//     simulated in-progress / completed inspections so /inspections lands
//     on populated state.
// ---------------------------------------------------------------------------

async function ensureSystemPresets(): Promise<Map<string, string>> {
  // Returns slug → template_id for each system preset (re-using existing
  // rows where possible).
  const out = new Map<string, string>();
  for (const preset of PRESETS) {
    const { data: existing } = await sb
      .from("templates")
      .select("id, current_version_id")
      .eq("slug", preset.slug)
      .eq("is_system_preset", true)
      .maybeSingle();

    let templateId: string;
    let versionId: string | null = null;

    if (existing) {
      templateId = existing.id;
      versionId = existing.current_version_id;
    } else {
      const { data: t, error: tErr } = await sb
        .from("templates")
        .insert({
          org_id: null,
          slug: preset.slug,
          name: preset.name,
          description: preset.description,
          industry: preset.industry,
          status: "published",
          is_system_preset: true,
          is_featured: preset.is_featured,
          is_imported: false,
          logo_url: preset.logo_url ?? null,
        })
        .select("id")
        .single();
      if (tErr || !t) throw tErr ?? new Error("preset insert failed");
      templateId = t.id;
    }

    // Always overwrite content if no version exists yet — lets us iterate
    // on preset content without manual cleanup. Once seeded, we leave
    // versions alone so demo edits aren't blown away.
    if (!versionId) {
      const { data: v, error: vErr } = await sb
        .from("template_versions")
        .insert({
          template_id: templateId,
          version_number: 1,
          status: "published",
          change_summary: "Seeded from preset library",
          published_at: new Date().toISOString(),
          header: preset.header as unknown as object,
          items: preset.items as unknown as object,
          template_data: preset.template_data as unknown as object,
        })
        .select("id")
        .single();
      if (vErr || !v) throw vErr ?? new Error("preset version insert failed");
      versionId = v.id;

      const { error: linkErr } = await sb
        .from("templates")
        .update({ current_version_id: versionId })
        .eq("id", templateId);
      if (linkErr) throw linkErr;
    }

    out.set(preset.slug, templateId);
  }
  log(`system-preset library: ${out.size} presets ensured`);
  return out;
}

async function ensureClonedTemplates(
  orgId: string,
  presetIds: Map<string, string>,
  users: Map<string, string>
): Promise<Map<string, { templateId: string; versionId: string; preset: typeof PRESETS[number] }>> {
  // Clone two presets into UCB and publish v1 — one for Houston (mfg-leaning)
  // and one for Manchester (office-leaning), per the seed's existing site
  // characterization in project_site_names.md.
  const TARGETS = [
    { presetSlug: "forklift-pre-use-inspection", localName: "UCB Forklift Pre-Use" },
    { presetSlug: "office-ergonomic-workstation", localName: "UCB Office Ergonomic Check" },
  ];
  const ehs = users.get("ehs@demo.local");
  const out = new Map<
    string,
    { templateId: string; versionId: string; preset: typeof PRESETS[number] }
  >();

  for (const target of TARGETS) {
    const presetId = presetIds.get(target.presetSlug);
    if (!presetId) continue;
    const preset = PRESETS.find((p) => p.slug === target.presetSlug)!;

    // Idempotency: a UCB template with the same source_preset_id is the seeded clone
    const { data: existing } = await sb
      .from("templates")
      .select("id, current_version_id")
      .eq("org_id", orgId)
      .eq("source_preset_id", presetId)
      .maybeSingle();

    let templateId: string;
    let versionId: string | null = null;

    if (existing) {
      templateId = existing.id;
      versionId = existing.current_version_id;
    } else {
      const { data: t, error: tErr } = await sb
        .from("templates")
        .insert({
          org_id: orgId,
          name: target.localName,
          description: preset.description,
          industry: preset.industry,
          status: "published",
          is_system_preset: false,
          is_imported: true,
          source_preset_id: presetId,
          created_by: ehs ?? null,
        })
        .select("id")
        .single();
      if (tErr || !t) throw tErr ?? new Error("clone insert failed");
      templateId = t.id;
    }

    if (!versionId) {
      // Reuse the preset's items as v1 content (regenerating UUIDs is the
      // RPC's job; for the seed we accept identical IDs since the demo
      // never imports the same preset twice into the same org)
      const { data: v, error: vErr } = await sb
        .from("template_versions")
        .insert({
          template_id: templateId,
          version_number: 1,
          status: "published",
          change_summary: "Seeded clone — initial publish",
          published_at: new Date().toISOString(),
          published_by: ehs ?? null,
          header: preset.header as unknown as object,
          items: preset.items as unknown as object,
          template_data: preset.template_data as unknown as object,
        })
        .select("id")
        .single();
      if (vErr || !v) throw vErr ?? new Error("clone version insert failed");
      versionId = v.id;

      await sb.from("templates").update({ current_version_id: versionId }).eq("id", templateId);
    }

    out.set(target.presetSlug, { templateId, versionId: versionId!, preset });
  }
  log(`UCB cloned templates: ${out.size}`);
  return out;
}

async function ensureTemplateAssignments(
  cloned: Map<string, { templateId: string; versionId: string; preset: typeof PRESETS[number] }>,
  sites: Map<string, string>,
  users: Map<string, string>
) {
  const houston = sites.get("houston");
  const manchester = sites.get("manchester");
  const ehs = users.get("ehs@demo.local");
  if (!houston || !manchester) return;

  const desired: Array<{
    presetSlug: string;
    siteId: string;
    schedule_kind: "daily" | "weekly" | "monthly" | "custom" | "on_demand";
    start_time_local?: string;
  }> = [
    {
      presetSlug: "forklift-pre-use-inspection",
      siteId: houston,
      schedule_kind: "daily",
      start_time_local: "06:00",
    },
    {
      presetSlug: "office-ergonomic-workstation",
      siteId: manchester,
      schedule_kind: "weekly",
      start_time_local: "09:00",
    },
  ];

  for (const d of desired) {
    const c = cloned.get(d.presetSlug);
    if (!c) continue;

    const { data: existing } = await sb
      .from("template_assignments")
      .select("id")
      .eq("template_id", c.templateId)
      .eq("site_id", d.siteId)
      .is("unassigned_at", null)
      .maybeSingle();
    if (existing) continue;

    const { error } = await sb.from("template_assignments").insert({
      template_id: c.templateId,
      template_version_id: c.versionId,
      site_id: d.siteId,
      include_children: true,
      schedule_kind: d.schedule_kind,
      start_time_local: d.start_time_local ?? null,
      assigned_by: ehs ?? null,
    });
    if (error) throw error;
  }
  log("template assignments seeded for Houston + Manchester");
}

// Build a denormalized question-answer payload (matches the runner's
// buildQuestionAnswer helper) without dragging React imports in.
function buildSeedQuestionAnswer(
  templateData: TemplateData,
  answerSetId: string,
  responseId: string,
  notes?: string
): InspectionAnswer {
  const set = templateData.answer_sets[answerSetId];
  const r = set?.responses.find((x) => x.id === responseId);
  const max = set?.responses.reduce(
    (m, x) => Math.max(m, x.enable_score && typeof x.score === "number" ? x.score : 0),
    0
  );
  return {
    selected_option_id: responseId,
    selected_option_failed: r?.failed ?? false,
    selected_option_score: r?.enable_score && typeof r.score === "number" ? r.score : 0,
    selected_option_max: max ?? 0,
    selected_option_label: r?.label ?? "",
    notes,
    updated_at: new Date().toISOString(),
  };
}

async function ensureSimulatedInspections(
  orgId: string,
  cloned: Map<string, { templateId: string; versionId: string; preset: typeof PRESETS[number] }>,
  sites: Map<string, string>,
  users: Map<string, string>
) {
  // Only seed if we don't already have any inspections in this org.
  // (Tracks whether the demo has been run — keeps re-runs idempotent.)
  const { count } = await sb
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("org_id", orgId);
  if ((count ?? 0) > 0) {
    log("inspections already present — skipping simulation");
    return;
  }

  const houston = sites.get("houston");
  const worker = users.get("worker@demo.local");
  const ehs = users.get("ehs@demo.local");
  const forklift = cloned.get("forklift-pre-use-inspection");
  if (!houston || !worker || !ehs || !forklift) return;

  const items = forklift.preset.items;
  const td = forklift.preset.template_data;
  const compliantId = "as-passfail-p";
  const failedId = "as-passfail-f";

  // ---- 1. In-progress inspection (started this morning, ~30% answered)
  const answerable = [...walkAnswerable(items)].filter((it) => it.type === "question");
  const inProgressAnswers: Record<string, InspectionAnswer> = {};
  for (let i = 0; i < Math.min(3, answerable.length); i++) {
    const it = answerable[i];
    const setId = (it.options?.answer_set as string) ?? "as-passfail";
    inProgressAnswers[it.item_id] = buildSeedQuestionAnswer(td, setId, compliantId);
  }

  const { error: ipErr } = await sb.from("inspections").insert({
    org_id: orgId,
    template_id: forklift.templateId,
    template_version_id: forklift.versionId,
    site_id: houston,
    title: "Forklift FL-12 — morning check (in progress)",
    inspector_id: worker,
    status: "in_progress",
    started_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    conducted_at: new Date(Date.now() - 30 * 60_000).toISOString(),
    answers: inProgressAnswers as unknown as object,
  });
  if (ipErr) throw ipErr;

  // ---- 2. Completed inspection (yesterday, 1 failed item -> finding)
  const completedAnswers: Record<string, InspectionAnswer> = {};
  let failedItem: TemplateNodeItem | null = null;
  for (let i = 0; i < answerable.length; i++) {
    const it = answerable[i];
    const setId = (it.options?.answer_set as string) ?? "as-passfail";
    if (i === 1 && it.label?.toLowerCase().includes("hose")) {
      // Fail the hydraulic-hoses item if present
      completedAnswers[it.item_id] = buildSeedQuestionAnswer(
        td,
        setId,
        failedId,
        "Slight leak at the rear coupler. Bench tagged out for service."
      );
      failedItem = it;
    } else {
      completedAnswers[it.item_id] = buildSeedQuestionAnswer(td, setId, compliantId);
    }
  }
  // If we didn't find a hose item, flag the second answerable as the demo failure
  if (!failedItem && answerable[1]) {
    failedItem = answerable[1];
    const setId = (failedItem.options?.answer_set as string) ?? "as-passfail";
    completedAnswers[failedItem.item_id] = buildSeedQuestionAnswer(
      td,
      setId,
      failedId,
      "Issue noted during check; tagged out for follow-up."
    );
  }

  const yesterday = new Date(Date.now() - 26 * 3_600_000);
  const { data: completed, error: cErr } = await sb
    .from("inspections")
    .insert({
      org_id: orgId,
      template_id: forklift.templateId,
      template_version_id: forklift.versionId,
      site_id: houston,
      title: "Forklift FL-12 — yesterday",
      inspector_id: worker,
      status: "completed",
      started_at: yesterday.toISOString(),
      conducted_at: yesterday.toISOString(),
      completed_at: new Date(yesterday.getTime() + 18 * 60_000).toISOString(),
      answers: completedAnswers as unknown as object,
      score_total: answerable.length - 1,
      score_max: answerable.length,
      is_failed: !!failedItem,
    })
    .select("id")
    .single();
  if (cErr || !completed) throw cErr ?? new Error("completed inspection failed");

  // Create the corresponding finding row (the RPC normally does this on
  // complete; for the seed we write it directly so the demo lands on a
  // populated findings list)
  if (failedItem) {
    const { error: fErr } = await sb.from("inspection_findings").insert({
      inspection_id: completed.id,
      org_id: orgId,
      site_id: houston,
      item_id: failedItem.item_id,
      item_label: failedItem.label ?? "(unlabeled)",
      failed_response_label: "Fail",
      comment: "Slight leak at the rear coupler. Bench tagged out for service.",
      status: "open",
    });
    if (fErr) throw fErr;
  }

  log("simulated inspections + 1 finding inserted");
}

// ---------------------------------------------------------------------------
// Phase 4 — Resources (Assets + Documents + cross-links)
//
// Per plans/04-resources.md §H. Inserts:
//   * 8 documents (1 per type) — uploads small placeholder content into
//     the `documents` bucket so /resources/documents/[id] file preview
//     resolves.
//   * 6 assets across UCB sites; conveyor seeded in `unsafe` condition
//     so the unsafe-transition tooltip surface lands populated.
//   * Cross-links: forklift incident → forklift asset (sparse FK + SDS +
//     SOP links); conveyor incident → conveyor asset; SOP → seeded CAPA;
//     SDS → seeded investigation; printable form → seeded inspection.
//
// Idempotent: skips entirely if any documents or assets already exist
// for the org.
// ---------------------------------------------------------------------------
async function ensureResources(
  orgId: string,
  sites: Map<string, string>,
  users: Map<string, string>,
) {
  const { count: docCount } = await sb
    .from("documents")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);
  const { count: assetCount } = await sb
    .from("assets")
    .select("*", { count: "exact", head: true })
    .eq("org_id", orgId);

  if ((docCount ?? 0) > 0 || (assetCount ?? 0) > 0) {
    log("assets/documents already seeded — skipping");
    return;
  }

  const ehs = users.get("ehs@demo.local")!;
  const today = new Date();
  const inDays = (d: number): string => {
    const x = new Date(today);
    x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };
  const minimalJpegBytes = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
    0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
    0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0xff, 0xd9,
  ]);

  // 1. Documents — upload placeholder content + insert metadata rows.
  type DocSeed = {
    key: string;
    name: string;
    type:
      | "sds"
      | "sop"
      | "policy"
      | "training_cert"
      | "form"
      | "evidence"
      | "audit_report"
      | "other";
    file_name: string;
    mime_type: string;
    expiry?: string;
    notes?: string;
    site?: string; // slug
  };
  const DOC_SEEDS: DocSeed[] = [
    {
      key: "sds_ipa",
      name: "IPA Solvent SDS",
      type: "sds",
      file_name: "ipa-sds-2024.pdf",
      mime_type: "application/pdf",
      notes:
        "Isopropyl alcohol — used for parts cleaning. Section 4 covers skin contact response. Referenced by the forklift maintenance hand-off.",
    },
    {
      key: "sop_loto",
      name: "Lockout/Tagout SOP — Forklift",
      type: "sop",
      file_name: "loto-forklift.pdf",
      mime_type: "application/pdf",
      notes:
        "Revised after the 2024 forklift collision. Step 4 added an explicit chock-and-tag confirmation.",
    },
    {
      key: "policy_ppe",
      name: "PPE Policy — Manufacturing Floor",
      type: "policy",
      file_name: "ppe-policy-mfg.pdf",
      mime_type: "application/pdf",
      notes: "Mandatory hi-vis + steel-toe inside the warehouse perimeter.",
    },
    {
      key: "training_forklift",
      name: "Forklift Operator Training Cert — Wally Worker",
      type: "training_cert",
      file_name: "training-forklift-2025.pdf",
      mime_type: "application/pdf",
      expiry: inDays(14), // expiring soon — exercises the ?expiring=1 filter
      notes:
        "Annual refresher. Expires in 2 weeks — re-train before the date or restrict assignments.",
    },
    {
      key: "form_inspection",
      name: "Daily Pre-Use Inspection Form (printable)",
      type: "form",
      file_name: "pre-use-form.pdf",
      mime_type: "application/pdf",
      notes:
        "Paper backup for routes without mobile coverage. Scan back to the inspection record after.",
    },
    {
      key: "evidence_photo",
      name: "Conveyor leak photo — Bay 3",
      type: "evidence",
      file_name: "conveyor-leak.jpg",
      mime_type: "image/jpeg",
      notes:
        "Hydraulic puddle observed under conveyor C-2 the morning of the seizure incident.",
    },
    {
      key: "audit_q1",
      name: "Q1 2026 Internal Audit Report",
      type: "audit_report",
      file_name: "audit-q1-2026.pdf",
      mime_type: "application/pdf",
      site: "houston",
      notes:
        "Houston-only audit; flagged 3 housekeeping nonconformances and one CAPA recommendation.",
    },
    {
      key: "other_emergency",
      name: "Emergency Contact List",
      type: "other",
      file_name: "emergency-contacts.pdf",
      mime_type: "application/pdf",
      notes: "Posted at every muster point and reception.",
    },
  ];

  const docs = new Map<string, string>(); // key → id

  for (const doc of DOC_SEEDS) {
    const safeName = `${crypto.randomUUID()}-${doc.file_name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;
    const path = `${orgId}/${safeName}`;
    const body = doc.mime_type.startsWith("image/")
      ? minimalJpegBytes
      : Buffer.from(
          `Placeholder content for ${doc.name}.\n\n${doc.notes ?? ""}\n`,
          "utf-8",
        );

    const { error: upErr } = await sb.storage
      .from("documents")
      .upload(path, body, { upsert: false, contentType: doc.mime_type });
    if (upErr) throw upErr;

    const { data: row, error: insErr } = await sb
      .from("documents")
      .insert({
        org_id: orgId,
        site_id: doc.site ? sites.get(doc.site) ?? null : null,
        name: doc.name,
        type: doc.type,
        storage_path: path,
        file_name: doc.file_name,
        mime_type: doc.mime_type,
        size_bytes: body.byteLength,
        expiry_date: doc.expiry ?? null,
        notes: doc.notes ?? null,
        uploaded_by: ehs,
      })
      .select("id")
      .single();
    if (insErr) throw insErr;
    docs.set(doc.key, row.id);
  }
  log(`documents inserted: ${docs.size}`);

  // 2. Assets
  type AssetSeed = {
    key: string;
    name: string;
    kind:
      | "forklift"
      | "fume_hood"
      | "fire_extinguisher"
      | "aed"
      | "conveyor"
      | "ergonomic_station";
    site: string; // slug
    location: string;
    condition: "excellent" | "good" | "fair" | "poor" | "unsafe";
    last_inspected_days_ago?: number;
    next_pm_in_days?: number;
    sds_doc?: string; // doc key
    notes?: string;
  };
  const ASSET_SEEDS: AssetSeed[] = [
    {
      key: "forklift_houston",
      name: "Hyster H40 Forklift",
      kind: "forklift",
      site: "houston-bldg-a",
      location: "Bay 3, Aisle A",
      condition: "fair",
      last_inspected_days_ago: 7,
      next_pm_in_days: 21,
      sds_doc: "sds_ipa",
      notes:
        "Recent hydraulic-line check found minor weep at the rear coupler. Bench tagged out for service.",
    },
    {
      key: "fume_hood_manchester",
      name: "Lab Fume Hood — Bench 4",
      kind: "fume_hood",
      site: "manchester",
      location: "Lab 1, Bench 4",
      condition: "good",
      last_inspected_days_ago: 14,
      next_pm_in_days: 60,
    },
    {
      key: "fire_extinguisher_houston",
      name: "Fire Extinguisher 12B (CO2)",
      kind: "fire_extinguisher",
      site: "houston",
      location: "Loading Dock B",
      condition: "excellent",
      last_inspected_days_ago: 30,
      next_pm_in_days: 335,
    },
    {
      key: "aed_manchester",
      name: "AED — North Reception",
      kind: "aed",
      site: "manchester-north",
      location: "North Reception, Wall mount",
      condition: "good",
      last_inspected_days_ago: 60,
      next_pm_in_days: 305,
    },
    {
      key: "ergonomic_manchester",
      name: "Sit-Stand Workstation 14",
      kind: "ergonomic_station",
      site: "manchester",
      location: "Office 2.4",
      condition: "good",
      last_inspected_days_ago: 90,
    },
    {
      key: "conveyor_houston",
      name: "Main Floor Conveyor C-2",
      kind: "conveyor",
      site: "houston-bldg-a",
      location: "Floor 1, Line 2",
      condition: "unsafe",
      last_inspected_days_ago: 1,
      next_pm_in_days: -2, // overdue
      notes:
        "Motor seizure 2024-04; tagged out, awaiting replacement bearing. Flag triggers the unsafe-condition CTA on detail.",
    },
  ];

  const assetRows = ASSET_SEEDS.map((a) => ({
    org_id: orgId,
    site_id: sites.get(a.site)!,
    name: a.name,
    kind: a.kind,
    location: a.location,
    condition: a.condition,
    status: "active" as const,
    last_inspected_at:
      a.last_inspected_days_ago != null
        ? new Date(Date.now() - a.last_inspected_days_ago * 86_400_000).toISOString()
        : null,
    next_pm_at:
      a.next_pm_in_days != null
        ? new Date(Date.now() + a.next_pm_in_days * 86_400_000).toISOString()
        : null,
    sds_document_id: a.sds_doc ? docs.get(a.sds_doc)! : null,
    notes: a.notes ?? null,
    created_by: ehs,
  }));

  const { data: assetRowsData, error: assetErr } = await sb
    .from("assets")
    .insert(assetRows)
    .select("id");
  if (assetErr) throw assetErr;

  const assets = new Map<string, string>(); // key → id
  for (let i = 0; i < ASSET_SEEDS.length; i += 1) {
    assets.set(ASSET_SEEDS[i].key, assetRowsData[i].id);
  }
  log(`assets inserted: ${assets.size}`);

  // 3. Cross-link backfill
  // 3a. Set incidents.equipment_asset_id on the forklift collision +
  //     conveyor seizure rows so /incidents/[id] surfaces an Asset link
  //     and the asset Incidents tab populates.
  const { data: forkliftIncidents } = await sb
    .from("incidents")
    .select("id")
    .eq("org_id", orgId)
    .ilike("title", "Forklift collision%");
  const { data: conveyorIncidents } = await sb
    .from("incidents")
    .select("id")
    .eq("org_id", orgId)
    .ilike("title", "Conveyor motor seizure%");
  for (const inc of forkliftIncidents ?? []) {
    await sb
      .from("incidents")
      .update({ equipment_asset_id: assets.get("forklift_houston") })
      .eq("id", inc.id);
  }
  for (const inc of conveyorIncidents ?? []) {
    await sb
      .from("incidents")
      .update({ equipment_asset_id: assets.get("conveyor_houston") })
      .eq("id", inc.id);
  }

  // 3b. Polymorphic document_links — covers asset / incident / investigation
  //     / capa / inspection so the doc-detail "Linked from" panel shows
  //     entries across multiple parent types.
  type LinkSeed = {
    doc: string;
    parent: "incident" | "investigation" | "capa" | "asset" | "inspection";
    parent_id: string;
    link_role: string;
  };
  const links: LinkSeed[] = [
    { doc: "sds_ipa",       parent: "asset",   parent_id: assets.get("forklift_houston")!, link_role: "sds" },
    { doc: "sop_loto",      parent: "asset",   parent_id: assets.get("forklift_houston")!, link_role: "sop" },
    { doc: "evidence_photo",parent: "asset",   parent_id: assets.get("conveyor_houston")!, link_role: "photo" },
  ];

  if (forkliftIncidents && forkliftIncidents[0]) {
    links.push(
      { doc: "sds_ipa",  parent: "incident", parent_id: forkliftIncidents[0].id, link_role: "sds" },
      { doc: "sop_loto", parent: "incident", parent_id: forkliftIncidents[0].id, link_role: "attachment" },
    );
  }

  const { data: invs } = await sb
    .from("investigations")
    .select("id")
    .eq("org_id", orgId)
    .order("started_at", { ascending: false, nullsFirst: false })
    .limit(1);
  if (invs && invs[0]) {
    links.push({
      doc: "sds_ipa",
      parent: "investigation",
      parent_id: invs[0].id,
      link_role: "evidence",
    });
  }

  const { data: capas } = await sb
    .from("capas")
    .select("id")
    .eq("org_id", orgId)
    .limit(1);
  if (capas && capas[0]) {
    links.push({
      doc: "sop_loto",
      parent: "capa",
      parent_id: capas[0].id,
      link_role: "sop",
    });
  }

  const { data: insps } = await sb
    .from("inspections")
    .select("id, title")
    .eq("org_id", orgId)
    .ilike("title", "%Forklift%")
    .limit(1);
  if (insps && insps[0]) {
    links.push({
      doc: "form_inspection",
      parent: "inspection",
      parent_id: insps[0].id,
      link_role: "attachment",
    });
  }

  const linkRows = links.map((l) => ({
    document_id: docs.get(l.doc)!,
    parent_type: l.parent,
    parent_id: l.parent_id,
    link_role: l.link_role,
    created_by: ehs,
  }));

  if (linkRows.length > 0) {
    const { error: linkErr } = await sb.from("document_links").insert(linkRows);
    if (linkErr) throw linkErr;
  }
  log(`document_links inserted: ${linkRows.length}`);
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
  // ---- Phase 3: Templates + Inspections ----
  const presets = await ensureSystemPresets();
  const cloned = await ensureClonedTemplates(orgId, presets, users);
  await ensureTemplateAssignments(cloned, sites, users);
  await ensureSimulatedInspections(orgId, cloned, sites, users);
  // ---- Phase 4: Resources (Assets + Documents) ----
  await ensureResources(orgId, sites, users);
  log("done.");
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
