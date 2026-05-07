"use client";

import { useActionState, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
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
import { deleteRole } from "@/app/(app)/admin/roles/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function DeleteRoleDialog({
  roleId,
  roleName,
  memberCount,
  disabled,
}: {
  roleId: string;
  roleName: string;
  memberCount: number;
  disabled?: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    deleteRole,
    null,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // The action redirects on success, so we mostly hit toast.error here when
    // the RPC's last-admin / system-role guards fire.
    if (state?.ok === false) toast.error(state.error);
  }, [state]);

  const blockedByMembers = memberCount > 0;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={disabled || blockedByMembers}
          title={
            blockedByMembers
              ? `${memberCount} member(s) hold this role — change their role first.`
              : undefined
          }
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 px-3 py-1.5 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Delete role
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete &ldquo;{roleName}&rdquo;?</AlertDialogTitle>
          <AlertDialogDescription>
            This is irreversible. Members and audit history that referenced this
            role will keep that history; the role definition itself goes away.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="role_id" value={roleId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Deleting…" : "Delete role"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
