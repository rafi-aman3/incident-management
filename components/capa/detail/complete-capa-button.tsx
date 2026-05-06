"use client";

import { useActionState, useEffect, useState } from "react";
import { CheckCircle2 } from "lucide-react";
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
import { completeCapa } from "@/app/(app)/capa/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function CompleteCapaButton({
  capaId,
  hasVerifier,
  disabled,
}: {
  capaId: string;
  hasVerifier: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    completeCapa,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Marked complete — awaiting verification");
      setOpen(false);
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || !hasVerifier}
        title={
          !hasVerifier
            ? "Assign a verifier before completing this CAPA"
            : undefined
        }
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <CheckCircle2 className="h-4 w-4" /> Mark complete
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Mark CAPA complete?</DialogTitle>
            <DialogDescription>
              The CAPA moves to <strong>Pending verification</strong>. Once submitted,
              you can&apos;t edit progress until the verifier accepts or rejects.
              Your assigned verifier will be notified.
            </DialogDescription>
          </DialogHeader>
          <form action={formAction}>
            <input type="hidden" name="capa_id" value={capaId} />
            <DialogFooter className="gap-2 sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Submitting…" : "Submit for verification"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
