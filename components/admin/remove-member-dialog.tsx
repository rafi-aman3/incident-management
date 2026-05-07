"use client";

import { useActionState, useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
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
import { removeSiteMember } from "@/app/(app)/admin/sites/[id]/members-actions";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Remove a member from a site. Surfaces the per-site last-admin guard error
 * inline in the dialog body if the RPC rejects (so the admin can keep the
 * dialog open, see the message, then go promote another admin).
 */
export function RemoveMemberDialog({
  siteId,
  profileId,
  memberName,
  isLastSiteAdmin,
}: {
  siteId: string;
  profileId: string;
  memberName: string;
  /** Server-side hint: when true, the trigger renders disabled with a
   *  tooltip-like static helper so the user doesn't have to open the dialog
   *  to see why removal is blocked. */
  isLastSiteAdmin?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    removeSiteMember,
    null,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Member removed");
      setOpen(false);
    }
    // Don't toast on error: keep the message visible inside the dialog so the
    // user reads it without dismissing.
  }, [state]);

  if (isLastSiteAdmin) {
    return (
      <button
        type="button"
        disabled
        aria-label="Last site admin — protected"
        title="There must be at least one site admin on every site. Promote another member first."
        className="cursor-not-allowed rounded p-1 text-muted-foreground/40"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    );
  }

  const errorMsg = state?.ok === false ? state.error : null;

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
      }}
    >
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Remove ${memberName}`}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {memberName}?</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll lose access to this site. You can re-add them any time.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {errorMsg && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {errorMsg}
          </div>
        )}
        <form action={formAction}>
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending}>
              {isPending ? "Removing…" : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
