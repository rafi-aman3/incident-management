"use client";

import { useActionState, useEffect } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { reassignVerifier } from "@/app/(app)/capa/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type CapaSiteMember = {
  id: string;
  full_name: string | null;
  email: string;
};

export function CapaModals({
  capaId,
  ownerId,
  members,
}: {
  capaId: string;
  ownerId: string | null;
  members: CapaSiteMember[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  const close = () => router.replace(pathname);

  return (
    <>
      <ReassignVerifierModal
        open={action === "reassign-verifier"}
        onClose={close}
        capaId={capaId}
        ownerId={ownerId}
        members={members}
      />
    </>
  );
}

function ReassignVerifierModal({
  open,
  onClose,
  capaId,
  ownerId,
  members,
}: {
  open: boolean;
  onClose: () => void;
  capaId: string;
  ownerId: string | null;
  members: CapaSiteMember[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    reassignVerifier,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Verifier reassigned");
      onClose();
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state, onClose]);

  // Owner cannot also be the verifier (CHECK constraint at DB level)
  const candidates = members.filter((m) => m.id !== ownerId);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reassign verifier</DialogTitle>
          <DialogDescription>
            The verifier confirms the CAPA worked. Must be a different person
            from the owner — the owner row is hidden from the picker.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="capa_id" value={capaId} />
          <div className="space-y-2">
            <Label htmlFor="reassign-verifier-id">New verifier</Label>
            <Select name="new_verifier_id" required>
              <SelectTrigger id="reassign-verifier-id" aria-required="true">
                <SelectValue placeholder="Pick a verifier" />
              </SelectTrigger>
              <SelectContent>
                {candidates.length === 0 ? (
                  <div className="p-2 text-xs text-muted-foreground">
                    No other site members available.
                  </div>
                ) : (
                  candidates.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.full_name ?? m.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || candidates.length === 0}>
              {isPending ? "Reassigning…" : "Reassign verifier"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
