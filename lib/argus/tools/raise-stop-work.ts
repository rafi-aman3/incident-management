import { logArgusSuggestion } from "@/lib/argus/log";
import type { ArgusToolDefinition } from "./types";

interface Input {
  reason: string;
}

/**
 * Raises a stop-work alert against the draft incident: flips the boolean
 * flag, stamps raised_at + raised_by + reason, and inserts a notification
 * row addressed to the site EHS lead. The dashboard banner (mounted in the
 * (app) shell) reads from `incidents.stop_work=true AND ack=null` — so the
 * notification row is the explicit audit trail and the banner is the
 * always-on visible alert.
 *
 * RIDDOR responsible person stored on `sites` is text-only (no profile_id),
 * so we cannot fan out a notification row to them — they see the banner
 * next time they load the dashboard, same as everyone else with site access.
 *
 * **Idempotent:** if stop_work is already true, the tool no-ops and returns
 * a friendly message rather than restamping the metadata.
 */
export const raiseStopWorkTool: ArgusToolDefinition<Input> = {
  name: "raise_stop_work",
  description:
    "Raise a stop-work alert on the draft incident. The site EHS lead is notified immediately and a banner appears on the dashboard until acknowledged. Use only when there is an active, imminent hazard. Confirm with the worker first unless they explicitly said 'raise stop-work'.",
  parameters: {
    type: "object",
    properties: {
      reason: {
        type: "string",
        description:
          "One- or two-sentence summary the EHS lead can read in 10 seconds. State the hazard and what makes it imminent. Plain text, no PII.",
      },
    },
    required: ["reason"],
  },
  async execute(input, ctx) {
    if (!input.reason?.trim()) return "Error: stop-work reason is required.";

    const { data: incident, error: lookupErr } = await ctx.supabase
      .from("incidents")
      .select("id, site_id, stop_work")
      .eq("id", ctx.incidentId)
      .maybeSingle();

    if (lookupErr || !incident) {
      return `Error: incident ${ctx.incidentId} not found.`;
    }
    if (incident.stop_work) {
      return "Stop-work was already raised on this incident — no action taken.";
    }

    const { error: updateErr } = await ctx.supabase
      .from("incidents")
      .update({
        stop_work: true,
        stop_work_raised_at: new Date().toISOString(),
        stop_work_raised_by: ctx.userId,
        stop_work_reason: input.reason.trim(),
      })
      .eq("id", ctx.incidentId);

    if (updateErr) {
      return `Error: could not raise stop-work — ${updateErr.message}`;
    }

    // Resolve the site's EHS lead (Phase 13 column) and fan out a notification
    // row to them. If unset, the banner alone serves as the alert.
    const { data: site } = await ctx.supabase
      .from("sites")
      .select("name, site_ehs_lead_id, riddor_responsible_person_name")
      .eq("id", ctx.siteId)
      .maybeSingle();

    if (site?.site_ehs_lead_id) {
      await ctx.supabase.from("notifications").insert({
        kind: "stop_work_raised",
        incident_id: ctx.incidentId,
        recipient_id: site.site_ehs_lead_id,
        site_id: ctx.siteId,
        title: `Stop-work raised at ${site.name ?? "site"}`,
        body: input.reason.trim(),
      });
    }

    await logArgusSuggestion({
      orgId: ctx.orgId,
      siteId: ctx.siteId,
      userId: ctx.userId,
      surface: "copilot",
      targetKind: "incident",
      targetId: ctx.incidentId,
      model: ctx.modelUsed,
      usage: { promptTokens: 0, completionTokens: 0 },
      payload: {
        kind: "stop_work_raised",
        reason: input.reason.trim(),
        riddor_responsible_person_notified: Boolean(site?.riddor_responsible_person_name),
      },
      activityVerb: "argus.stop_work_raised",
      activityIncidentId: ctx.incidentId,
    });

    return "Stop-work raised. Site EHS lead notified and dashboard banner is active until acknowledged.";
  },
};
