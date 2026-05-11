"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { createBulletin, updateBulletin } from "@/app/(app)/bulletins/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

type Mode =
  | {
      mode: "create";
      sourceIncidentId?: string;
      sourceInvestigationId?: string;
      initialTitle?: string;
      initialSummary?: string;
      initialBody?: string;
    }
  | {
      mode: "edit";
      id: string;
      initialTitle: string;
      initialSummary: string | null;
      initialBody: string;
    };

export function BulletinComposer({
  canPublish,
  ...mode
}: Mode & { canPublish: boolean }) {
  const action = mode.mode === "create" ? createBulletin : updateBulletin;
  const [state, formAction, isPending] = useActionState<
    ActionResult<{ id: string }> | null,
    FormData
  >(action, null);

  useEffect(() => {
    if (state && !state.ok) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      {mode.mode === "edit" && <input type="hidden" name="id" value={mode.id} />}
      {mode.mode === "create" && mode.sourceIncidentId && (
        <input
          type="hidden"
          name="source_incident_id"
          value={mode.sourceIncidentId}
        />
      )}
      {mode.mode === "create" && mode.sourceInvestigationId && (
        <input
          type="hidden"
          name="source_investigation_id"
          value={mode.sourceInvestigationId}
        />
      )}

      <div className="space-y-1.5">
        <Label htmlFor="bulletin-title">Title</Label>
        <Input
          id="bulletin-title"
          name="title"
          required
          maxLength={200}
          defaultValue={mode.initialTitle ?? ""}
          placeholder="Lessons Learned — …"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulletin-summary">
          Summary{" "}
          <span className="text-muted-foreground">(one line — optional)</span>
        </Label>
        <Input
          id="bulletin-summary"
          name="summary"
          maxLength={300}
          defaultValue={
            mode.mode === "edit" ? mode.initialSummary ?? "" : mode.initialSummary ?? ""
          }
          placeholder="A short tagline shown on the list page and dashboard widget."
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="bulletin-body">Body</Label>
        <Textarea
          id="bulletin-body"
          name="body"
          required
          rows={18}
          defaultValue={mode.initialBody ?? ""}
          placeholder="Markdown supported."
          className="font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Review for personal names before publishing. Markdown headings,
          lists, and links render on the detail page.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          name="intent"
          value="save_draft"
          variant="outline"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save draft"}
        </Button>
        <Button
          type="submit"
          name="intent"
          value="publish"
          disabled={isPending || !canPublish}
          title={canPublish ? undefined : "Requires bulletin:publish permission"}
        >
          {isPending ? "Publishing…" : "Save & publish"}
        </Button>
      </div>
    </form>
  );
}
