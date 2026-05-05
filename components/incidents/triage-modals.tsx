"use client";

import { useActionState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  overrideSeverity,
  assignTriageOwner,
  escalateToInvestigation,
  closeIncident,
} from "@/app/(app)/incidents/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type SiteMemberOption = {
  id: string;
  full_name: string | null;
  email: string;
  role_key: string;
};

export function TriageModals({
  incidentId,
  currentSeverity,
  track,
  members,
}: {
  incidentId: string;
  currentSeverity: "S1" | "S2" | "S3" | "S4" | "S5" | null;
  track: "A" | "B" | "C" | null;
  members: SiteMemberOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  const close = () => router.replace(pathname);

  return (
    <>
      <SeverityOverrideModal
        open={action === "override"}
        onClose={close}
        incidentId={incidentId}
        currentSeverity={currentSeverity}
      />
      <AssignTriageModal
        open={action === "assign"}
        onClose={close}
        incidentId={incidentId}
        members={members}
      />
      <EscalateModal
        open={action === "escalate"}
        onClose={close}
        incidentId={incidentId}
        members={members}
      />
      <CloseTrackCModal
        open={action === "close"}
        onClose={close}
        incidentId={incidentId}
        track={track}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
function SeverityOverrideModal({
  open,
  onClose,
  incidentId,
  currentSeverity,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  currentSeverity: "S1" | "S2" | "S3" | "S4" | "S5" | null;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    overrideSeverity,
    null
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Override severity</DialogTitle>
          <DialogDescription>
            Audit row written immediately. Track + notifications recompute on save.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="incident_id" value={incidentId} />
          <div className="space-y-2">
            <Label>New severity</Label>
            <RadioGroup name="new_severity" defaultValue={currentSeverity ?? "S3"}>
              {(["S1", "S2", "S3", "S4", "S5"] as const).map((s) => (
                <Label key={s} htmlFor={`sev-${s}`} className="flex items-center gap-2">
                  <RadioGroupItem id={`sev-${s}`} value={s} /> {s}
                </Label>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (≥ 20 chars, immutable audit)</Label>
            <Textarea id="reason" name="reason" rows={3} required minLength={20} />
          </div>
          {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save override"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function AssignTriageModal({
  open,
  onClose,
  incidentId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  members: SiteMemberOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    assignTriageOwner,
    null
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign triage owner</DialogTitle>
          <DialogDescription>
            Recorded on the timeline so it&apos;s clear who picked this up.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="incident_id" value={incidentId} />
          <div className="space-y-2">
            <Label htmlFor="owner_id">Owner</Label>
            <Select name="owner_id" defaultValue={members[0]?.id ?? ""}>
              <SelectTrigger id="owner_id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea id="notes" name="notes" rows={3} />
          </div>
          {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Assigning…" : "Assign"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function EscalateModal({
  open,
  onClose,
  incidentId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  members: SiteMemberOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    escalateToInvestigation,
    null
  );

  const ehs = members.find((m) => m.role_key === "ehs_manager");
  const defaultLead = ehs?.id ?? members[0]?.id ?? "";
  const defaultDue = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate to investigation</DialogTitle>
          <DialogDescription>
            Creates the investigation row (or updates an existing one) and sends you to it.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="incident_id" value={incidentId} />
          <div className="space-y-2">
            <Label htmlFor="lead_id">Lead investigator</Label>
            <Select name="lead_id" defaultValue={defaultLead}>
              <SelectTrigger id="lead_id">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" name="due_date" type="date" defaultValue={defaultDue} required />
          </div>
          {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Escalating…" : "Escalate"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function CloseTrackCModal({
  open,
  onClose,
  incidentId,
  track,
}: {
  open: boolean;
  onClose: () => void;
  incidentId: string;
  track: "A" | "B" | "C" | null;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    closeIncident,
    null
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close incident</DialogTitle>
          <DialogDescription>
            Track C only — Track A/B incidents close via the investigation lifecycle.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="incident_id" value={incidentId} />
          {track !== "C" && (
            <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
              This incident is Track {track ?? "—"}. It needs to go through investigation before
              closing.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="close_reason">Reason (optional)</Label>
            <Textarea id="close_reason" name="reason" rows={3} />
          </div>
          {state?.ok === false && <p className="text-sm text-destructive">{state.error}</p>}
          <DialogFooter>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-accent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || track !== "C"}
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isPending ? "Closing…" : "Close incident"}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
