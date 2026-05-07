"use client";

import { useActionState, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { changeSiteMemberRole } from "@/app/(app)/admin/sites/[id]/members-actions";
import type { ActionResult } from "@/lib/incidents/schemas";
import type { RoleOption } from "./add-member-dialog";

export function ChangeRoleDialog({
  siteId,
  profileId,
  memberName,
  currentRoleId,
  currentIncludeChildren,
  roles,
}: {
  siteId: string;
  profileId: string;
  memberName: string;
  currentRoleId: string;
  currentIncludeChildren: boolean;
  roles: RoleOption[];
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    changeSiteMemberRole,
    null,
  );
  const [open, setOpen] = useState(false);
  const [roleId, setRoleId] = useState(currentRoleId);
  const [includeChildren, setIncludeChildren] = useState(currentIncludeChildren);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Role updated");
      setOpen(false);
    }
    if (state?.ok === false) toast.error(state.error);
  }, [state]);

  const noChange =
    roleId === currentRoleId && includeChildren === currentIncludeChildren;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          aria-label={`Change role for ${memberName}`}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Change role for {memberName}</AlertDialogTitle>
          <AlertDialogDescription>
            They keep their access to this site; only their permissions change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="profile_id" value={profileId} />
          <div className="space-y-1.5">
            <Label htmlFor={`change-role-${profileId}`} className="text-xs">Role</Label>
            <Select value={roleId} onValueChange={setRoleId}>
              <SelectTrigger id={`change-role-${profileId}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="role_id" value={roleId} />
          </div>
          <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
            <input
              type="checkbox"
              id={`include-children-${profileId}`}
              name="include_children"
              checked={includeChildren}
              onChange={(e) => setIncludeChildren(e.target.checked)}
              className="mt-0.5 h-3.5 w-3.5"
            />
            <Label
              htmlFor={`include-children-${profileId}`}
              className="text-xs font-normal"
            >
              <span className="font-medium">Include child sites</span>
              <span className="ml-1 text-muted-foreground">
                — access propagates down the hierarchy.
              </span>
            </Label>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending || noChange}>
              {isPending ? "Saving…" : "Save"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
