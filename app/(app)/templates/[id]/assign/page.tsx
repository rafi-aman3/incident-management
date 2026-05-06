import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/supabase/auth";
import { can } from "@/lib/auth/can";
import { orgCan } from "@/lib/auth/orgCan";
import {
  TemplateAssignForm,
  type ExistingAssignment,
} from "@/components/templates/assign-form";
import type {
  TemplateScheduleKind,
  TemplateStatus,
} from "@/lib/templates/types";

type Params = Promise<{ id: string }>;

type AssignmentJoinRow = {
  id: string;
  site_id: string;
  include_children: boolean;
  schedule_kind: TemplateScheduleKind;
  schedule_cron: string | null;
  start_time_local: string | null;
  site:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  template_version:
    | { version_number: number }
    | { version_number: number }[]
    | null;
};

export default async function TemplateAssignPage({ params }: { params: Params }) {
  const { id } = await params;
  const { supabase, memberships } = await requireUser();

  const canAssign = await orgCan("template:assign");
  if (!canAssign) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        You don&apos;t have permission to assign templates.
      </div>
    );
  }

  const { data: tmpl, error } = await supabase
    .from("templates")
    .select("id, name, status, current_version_id, is_system_preset")
    .eq("id", id)
    .maybeSingle();
  if (error || !tmpl) notFound();
  if (tmpl.is_system_preset) notFound();

  const cantAssignReason =
    tmpl.status !== "published"
      ? "Publish the template before assigning it."
      : null;

  // Sites the user has template:assign on (resolved per-site via the
  // existing can() helper — skips ones without perm)
  const candidateSites = memberships
    .map((m) => m.site)
    .filter((s): s is NonNullable<typeof s> => s !== null);

  const sitesWithPerm: { id: string; name: string; country: "US" | "GB" }[] = [];
  for (const s of candidateSites) {
    if (await can("template:assign", s.id)) {
      sitesWithPerm.push({ id: s.id, name: s.name, country: s.country });
    }
  }

  // Existing active assignments
  const { data: assignments } = await supabase
    .from("template_assignments")
    .select(
      `id, site_id, include_children, schedule_kind, schedule_cron,
       start_time_local, site:sites ( id, name ),
       template_version:template_version_id ( version_number )`
    )
    .eq("template_id", id)
    .is("unassigned_at", null)
    .returns<AssignmentJoinRow[]>();

  const existing: ExistingAssignment[] = (assignments ?? []).map((a) => {
    const s = Array.isArray(a.site) ? a.site[0] : a.site;
    const v = Array.isArray(a.template_version)
      ? a.template_version[0]
      : a.template_version;
    return {
      id: a.id,
      site_id: a.site_id,
      site_name: s?.name ?? "(unknown site)",
      include_children: a.include_children,
      schedule_kind: a.schedule_kind,
      schedule_cron: a.schedule_cron,
      start_time_local: a.start_time_local,
      template_version_number: v?.version_number ?? null,
    };
  });

  return (
    <div className="space-y-6">
      <Link
        href={`/templates/${tmpl.id}`}
        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
      >
        <ArrowLeft className="h-3 w-3" /> Back to {tmpl.name}
      </Link>

      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Templates · Assign
        </p>
        <h1 className="text-2xl font-semibold">Assign “{tmpl.name}” to sites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick sites and a schedule. Workers at the assigned site will see this
          template in the &ldquo;Start inspection&rdquo; picker on the
          Inspections page.
        </p>
        {cantAssignReason && (
          <div className="mt-3 rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
            <strong>{cantAssignReason}</strong> Template status is{" "}
            <code className="font-mono">{tmpl.status as TemplateStatus}</code>.
          </div>
        )}
      </div>

      <TemplateAssignForm
        templateId={tmpl.id}
        templateName={tmpl.name}
        sites={sitesWithPerm}
        existing={existing}
        canSubmit={!cantAssignReason}
      />
    </div>
  );
}
