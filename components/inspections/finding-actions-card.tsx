"use client";

import { useState, useTransition } from "react";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  resolveFinding,
  escalateFindingToIncident,
} from "@/app/(app)/inspections/findings-actions";
import { InfoTooltip } from "@/components/info-tooltip";
import { ArgusMagicWand } from "@/components/argus/argus-magic-wand";
import type { FindingStatus } from "@/lib/templates/types";

export function FindingActionsCard({
  findingId,
  inspectionId,
  siteId,
  status,
  canResolve,
  canEscalate,
  argusEnabled,
  findingDescription,
}: {
  findingId: string;
  inspectionId: string;
  siteId: string;
  status: FindingStatus;
  canResolve: boolean;
  canEscalate: boolean;
  argusEnabled: boolean;
  findingDescription: string;
}) {
  const [pending, startTransition] = useTransition();
  const [notes, setNotes] = useState("");
  const [resolveOpen, setResolveOpen] = useState(false);
  const [escalateOpen, setEscalateOpen] = useState(false);

  const finalized = status === "resolved" || status === "escalated_to_incident";

  function handleResolve() {
    startTransition(async () => {
      const res = await resolveFinding({
        finding_id: findingId,
        inspection_id: inspectionId,
        notes,
      });
      // On success the action redirects to the parent inspection — only the
      // failure path lands here.
      if (res && res.ok === false) toast.error(res.error);
    });
  }
  function handleEscalate() {
    startTransition(async () => {
      const res = await escalateFindingToIncident(findingId);
      // On success the action redirects to /incidents/<id>.
      if (res && res.ok === false) toast.error(res.error);
    });
  }

  if (finalized) {
    return (
      <div className="rounded-md border border-success/30 bg-success/5 p-4 text-sm">
        This finding is finalized — no further action is available.
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">Take action</h3>
      <p className="text-xs text-muted-foreground">
        Mark resolved if the issue was fixed on the spot. Escalate if it warrants
        a tracked incident with CAPA.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <AlertDialog open={resolveOpen} onOpenChange={setResolveOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              disabled={pending || !canResolve}
              variant="default"
              aria-label="Mark this finding resolved with optional notes"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Mark resolved
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Mark this finding resolved?</AlertDialogTitle>
              <AlertDialogDescription>
                The finding stays on the inspection record but is marked closed.
                You can&apos;t reopen it after this.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <label
                htmlFor="resolution-notes"
                className="text-xs font-medium uppercase tracking-wide text-muted-foreground"
              >
                Resolution notes (optional)
              </label>
              <Textarea
                id="resolution-notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="What was the immediate action? Who confirmed?"
                maxLength={2000}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={handleResolve}
                disabled={pending}
              >
                {pending ? "Resolving…" : "Mark resolved"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={escalateOpen} onOpenChange={setEscalateOpen}>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              disabled={pending || !canEscalate}
              variant="outline"
              aria-label="Escalate this finding to a new incident"
            >
              <AlertOctagon className="mr-1 h-3 w-3" />
              Escalate to incident
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Create a new incident from this finding?</AlertDialogTitle>
              <AlertDialogDescription>
                A draft incident will be created and linked back to this
                finding. You&apos;ll land on the new incident&apos;s detail page
                to classify and route it. The finding itself is closed as
                &ldquo;escalated&rdquo; and can&apos;t be reopened.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={pending}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={handleEscalate}
                disabled={pending}
              >
                {pending ? "Escalating…" : "Create incident"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <InfoTooltip tip="finding_escalation" />
      </div>
      {!canResolve && !canEscalate && (
        <p className="text-xs text-muted-foreground">
          You don&apos;t have permission to resolve or escalate findings on this
          site.
        </p>
      )}
      {argusEnabled && canEscalate && findingDescription.trim().length > 0 && (
        <div className="border-t pt-3">
          <ArgusMagicWand
            surface="finding_severity"
            payload={{
              findingId,
              siteId,
              description: findingDescription,
            }}
            buttonLabel="Predict severity if escalated"
            // Informational on this surface — escalation creates a fresh
            // draft incident the user classifies. Accept just dismisses
            // and writes outcome='accepted' to the audit log.
            onAccept={() => {
              /* informational only — no field to fill on this surface */
            }}
          />
        </div>
      )}
    </div>
  );
}
