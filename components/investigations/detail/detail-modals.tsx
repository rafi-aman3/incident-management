"use client";

import { useActionState, useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  closeInvestigationNoCapa,
  addInvestigationTeamMember,
  removeInvestigationTeamMember,
  reassignInvestigationLead,
  addWitnessStatement,
} from "@/app/(app)/investigations/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type SiteMemberOption = {
  id: string;
  full_name: string | null;
  email: string;
};

export function DetailModals({
  investigationId,
  incidentId,
  members,
  removableMember,
}: {
  investigationId: string;
  incidentId: string;
  members: SiteMemberOption[];
  /**
   * When `?action=remove-team&profile=<id>` is set, this is the matching member
   * (looked up server-side so the modal renders the name without an extra fetch).
   */
  removableMember: SiteMemberOption | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  const close = () => router.replace(pathname);

  return (
    <>
      <CloseNoCapaModal
        open={action === "close-no-capa"}
        onClose={close}
        investigationId={investigationId}
      />
      <AddTeamModal
        open={action === "add-team"}
        onClose={close}
        investigationId={investigationId}
        members={members}
      />
      <RemoveTeamModal
        open={action === "remove-team"}
        onClose={close}
        investigationId={investigationId}
        member={removableMember}
      />
      <ReassignLeadModal
        open={action === "reassign-lead"}
        onClose={close}
        investigationId={investigationId}
        members={members}
      />
      <AddWitnessModal
        open={action === "add-witness"}
        onClose={close}
        investigationId={investigationId}
        incidentId={incidentId}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
function CloseNoCapaModal({
  open,
  onClose,
  investigationId,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    closeInvestigationNoCapa,
    null
  );
  useToastOnError(state);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Close investigation — no CAPA needed</DialogTitle>
          <DialogDescription>
            Use this when the root cause was addressed in-situ or the event was a
            one-off with no preventive action required. Investigation moves to
            Closed; the source incident closes too if it was Under Investigation.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="investigation_id" value={investigationId} />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Closing…" : "Close investigation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function AddTeamModal({
  open,
  onClose,
  investigationId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
  members: SiteMemberOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    addInvestigationTeamMember,
    null
  );
  useToastOnError(state);
  useToastAndCloseOnSuccess(state, "Team member added", onClose);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Members can edit the RCA, evidence, and findings. Pick the role they&apos;ll play.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="investigation_id" value={investigationId} />
          <div className="space-y-2">
            <Label htmlFor="add-team-profile">Person</Label>
            <Select name="profile_id">
              <SelectTrigger id="add-team-profile">
                <SelectValue placeholder="Pick a site member" />
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
            <Label htmlFor="add-team-role">Role</Label>
            <Select name="role" defaultValue="member">
              <SelectTrigger id="add-team-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member</SelectItem>
                <SelectItem value="observer">Observer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function RemoveTeamModal({
  open,
  onClose,
  investigationId,
  member,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
  member: SiteMemberOption | null;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    removeInvestigationTeamMember,
    null
  );
  useToastOnError(state);
  useToastAndCloseOnSuccess(state, "Team member removed", onClose);

  if (!member) return null;
  const name = member.full_name ?? member.email;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove {name}</DialogTitle>
          <DialogDescription>
            They&apos;ll lose access to edit this investigation. You can re-add them later.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction}>
          <input type="hidden" name="investigation_id" value={investigationId} />
          <input type="hidden" name="profile_id" value={member.id} />
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function ReassignLeadModal({
  open,
  onClose,
  investigationId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
  members: SiteMemberOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    reassignInvestigationLead,
    null
  );
  useToastOnError(state);
  useToastAndCloseOnSuccess(state, "Lead reassigned", onClose);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign investigation lead</DialogTitle>
          <DialogDescription>
            The new lead owns the RCA and the close decision. They&apos;re added to the
            team automatically.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="investigation_id" value={investigationId} />
          <div className="space-y-2">
            <Label htmlFor="reassign-lead-id">New lead</Label>
            <Select name="new_lead_id">
              <SelectTrigger id="reassign-lead-id">
                <SelectValue placeholder="Pick a site member" />
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
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Reassigning…" : "Reassign lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function AddWitnessModal({
  open,
  onClose,
  investigationId,
  incidentId,
}: {
  open: boolean;
  onClose: () => void;
  investigationId: string;
  incidentId: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    addWitnessStatement,
    null
  );
  useToastOnError(state);
  useToastAndCloseOnSuccess(state, "Statement added", onClose);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add witness statement</DialogTitle>
          <DialogDescription>
            Saved to the incident — also visible on the incident detail page.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="investigation_id" value={investigationId} />
          <input type="hidden" name="incident_id" value={incidentId} />
          <div className="space-y-2">
            <Label htmlFor="witness-name">Name</Label>
            <Input id="witness-name" name="name" required maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="witness-contact">Contact (optional)</Label>
            <Input id="witness-contact" name="contact" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="witness-statement">Statement</Label>
            <Textarea id="witness-statement" name="statement" required rows={5} maxLength={5000} />
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving…" : "Save statement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
function useToastOnError(state: ActionResult | null) {
  useEffect(() => {
    if (state && state.ok === false) {
      toast.error(state.error);
    }
  }, [state]);
}

function useToastAndCloseOnSuccess(
  state: ActionResult | null,
  message: string,
  onClose: () => void
) {
  useEffect(() => {
    if (state && state.ok === true) {
      toast.success(message);
      onClose();
    }
  }, [state, message, onClose]);
}
