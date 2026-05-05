import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Daily-overdue cron — fires twice from Vercel Cron (23:59 UTC + 13:00 UTC)
 * to cover most timezones' midnight buckets within ~1 hour. Per site, we
 * only run the body when the SITE'S local hour is 0 (i.e. its midnight).
 *
 * Each run does two things:
 *   1. CAPA overdue / escalated notifications (idempotent per day)
 *   2. Sandbox auto-cleanup — soft-delete is_sandbox=true incidents > 7d old
 *
 * Auth: Authorization: Bearer ${CRON_SECRET}. Vercel Cron sets this header
 * automatically when the cron is triggered from vercel.json.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return new NextResponse("CRON_SECRET not configured", { status: 500 });
  }
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const sb = createAdminClient();
  const summary = {
    sitesChecked: 0,
    sitesAtMidnight: 0,
    capaOverdueInserted: 0,
    capaEscalatedInserted: 0,
    sandboxDeleted: 0,
    errors: [] as string[],
  };

  // ----- 1. Per-site CAPA overdue + escalated -----
  const { data: sites, error: sitesErr } = await sb
    .from("sites")
    .select("id, timezone");
  if (sitesErr) {
    return NextResponse.json(
      { ok: false, error: sitesErr.message, summary },
      { status: 500 }
    );
  }
  summary.sitesChecked = sites?.length ?? 0;

  const now = new Date();

  for (const site of sites ?? []) {
    const tz = site.timezone ?? "UTC";
    const localHour = getSiteLocalHour(now, tz);
    const localToday = getSiteLocalDate(now, tz);

    // Only run the per-site body when this site is in its midnight bucket.
    if (localHour !== 0) continue;
    summary.sitesAtMidnight += 1;

    try {
      const result = await processSiteOverdue(sb, site.id, localToday);
      summary.capaOverdueInserted += result.overdueInserted;
      summary.capaEscalatedInserted += result.escalatedInserted;
    } catch (e) {
      summary.errors.push(`site ${site.id}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ----- 2. Sandbox auto-cleanup (org-wide; not timezone-sensitive) -----
  const sandboxCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: deleted, error: delErr } = await sb
    .from("incidents")
    .update({ deleted_at: now.toISOString() })
    .eq("is_sandbox", true)
    .lt("created_at", sandboxCutoff)
    .is("deleted_at", null)
    .select("id");
  if (delErr) {
    summary.errors.push(`sandbox cleanup: ${delErr.message}`);
  } else {
    summary.sandboxDeleted = deleted?.length ?? 0;
  }

  return NextResponse.json({ ok: summary.errors.length === 0, summary });
}

// ---------------------------------------------------------------------------
async function processSiteOverdue(
  sb: ReturnType<typeof createAdminClient>,
  siteId: string,
  localToday: string
): Promise<{ overdueInserted: number; escalatedInserted: number }> {
  // Open CAPAs (status NOT IN verified, closed) past their due_date
  const { data: capas, error } = await sb
    .from("capas")
    .select("id, owner_id, due_date, title, status")
    .eq("site_id", siteId)
    .is("deleted_at", null)
    .not("status", "in", "(verified,closed)")
    .lt("due_date", localToday);
  if (error) throw error;

  let overdueInserted = 0;
  let escalatedInserted = 0;
  const dayStart = `${localToday}T00:00:00Z`;

  for (const capa of capas ?? []) {
    if (!capa.due_date) continue;

    // Idempotent: skip if a capa_overdue notification already exists today
    const { count: existingOverdue } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("capa_id", capa.id)
      .eq("kind", "capa_overdue")
      .gte("created_at", dayStart);

    if ((existingOverdue ?? 0) === 0) {
      await sb.from("notifications").insert({
        kind: "capa_overdue",
        capa_id: capa.id,
        recipient_id: capa.owner_id,
        site_id: siteId,
        title: `CAPA overdue: ${capa.title}`,
        body: "Mark progress, complete the action, or reassign if blocked.",
        deadline_at: new Date().toISOString(),
      });
      overdueInserted += 1;
    }

    // Escalation: 3+ calendar days late
    const dueDate = new Date(`${capa.due_date}T00:00:00Z`);
    const daysLate = Math.floor(
      (new Date(`${localToday}T00:00:00Z`).getTime() - dueDate.getTime()) /
        (1000 * 60 * 60 * 24)
    );
    if (daysLate < 3) continue;

    const { count: existingEsc } = await sb
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("capa_id", capa.id)
      .eq("kind", "capa_escalated")
      .gte("created_at", dayStart);
    if ((existingEsc ?? 0) > 0) continue;

    // Recipients: configured for capa_escalated; fall back to all
    // ehs_manager site members.
    const { data: configured } = await sb
      .from("notification_recipients")
      .select("recipient_profile_id")
      .eq("site_id", siteId)
      .eq("notification_kind", "capa_escalated")
      .not("recipient_profile_id", "is", null);
    let recipients: string[] = (configured ?? [])
      .map((r) => r.recipient_profile_id as string | null)
      .filter((id): id is string => id !== null);

    if (recipients.length === 0) {
      const { data: managers } = await sb
        .from("site_members")
        .select("profile_id, role:roles(key)")
        .eq("site_id", siteId);
      recipients = (managers ?? [])
        .filter((m) => m.role?.key === "ehs_manager")
        .map((m) => m.profile_id as string);
    }

    if (recipients.length === 0) continue;

    await sb.from("notifications").insert(
      recipients.map((rid) => ({
        kind: "capa_escalated" as const,
        capa_id: capa.id,
        recipient_id: rid,
        site_id: siteId,
        title: `CAPA ${daysLate}d overdue (escalated): ${capa.title}`,
        body: "Owner has not closed the action. Step in to reassign or unblock.",
        deadline_at: new Date().toISOString(),
      }))
    );
    escalatedInserted += recipients.length;
  }

  return { overdueInserted, escalatedInserted };
}

// ---------------------------------------------------------------------------
function getSiteLocalHour(now: Date, tz: string): number {
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour12: false,
      hour: "numeric",
    });
    return Number(fmt.format(now));
  } catch {
    return now.getUTCHours();
  }
}

function getSiteLocalDate(now: Date, tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
    const y = parts.find((p) => p.type === "year")?.value ?? "1970";
    const m = parts.find((p) => p.type === "month")?.value ?? "01";
    const d = parts.find((p) => p.type === "day")?.value ?? "01";
    return `${y}-${m}-${d}`;
  } catch {
    return now.toISOString().slice(0, 10);
  }
}
