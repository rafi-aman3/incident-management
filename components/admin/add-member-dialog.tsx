"use client";

import { useActionState, useEffect, useState } from "react";
import { UserPlus2 } from "lucide-react";
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
import { addSiteMember } from "@/app/(app)/admin/sites/[id]/members-actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type ProfileOption = {
  id: string;
  full_name: string | null;
  email: string;
};
export type RoleOption = {
  id: string;
  key: string;
  name: string;
};

/**
 * Adds a profile to a site (or, on the per-member page, adds a site to a
 * profile). The same `add_site_member_v1` RPC backs both directions; this
 * dialog renders different label copy depending on which "axis" you're
 * filling in via the `mode` prop.
 */
export function AddMemberDialog({
  mode,
  siteId,
  profileId,
  candidates,
  roles,
  triggerLabel = "Add member",
  emptyCopy,
}: {
  mode: "add-profile-to-site" | "add-site-to-profile";
  siteId?: string;
  profileId?: string;
  candidates: Array<ProfileOption | { id: string; name: string }>;
  roles: RoleOption[];
  triggerLabel?: string;
  emptyCopy?: string;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    addSiteMember,
    null,
  );
  const [open, setOpen] = useState(false);
  const [pickedId, setPickedId] = useState<string>("");
  const [roleId, setRoleId] = useState<string>(
    roles.find((r) => r.key === "supervisor")?.id ?? roles[0]?.id ?? "",
  );
  const [includeChildren, setIncludeChildren] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success(mode === "add-profile-to-site" ? "Member added" : "Added to site");
      setOpen(false);
      setPickedId("");
      setIncludeChildren(false);
    }
    if (state?.ok === false) toast.error(state.error);
  }, [state, mode]);

  const isProfileMode = mode === "add-profile-to-site";
  const fieldName = isProfileMode ? "profile_id" : "site_id";
  const headerCopy = isProfileMode ? "Add a member to this site" : "Add this member to a site";
  const emptyState =
    emptyCopy ??
    (isProfileMode
      ? "Everyone in your org is already on this site."
      : "This member is already on every site you can manage.");

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90"
        >
          <UserPlus2 className="h-4 w-4" />
          {triggerLabel}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{headerCopy}</AlertDialogTitle>
          <AlertDialogDescription>
            They&apos;ll be able to act on this site immediately. Their role
            decides what they can do.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {candidates.length === 0 ? (
          <div className="space-y-3">
            <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              {emptyState}
            </p>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Close</AlertDialogCancel>
            </AlertDialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-3">
            {isProfileMode && siteId && (
              <input type="hidden" name="site_id" value={siteId} />
            )}
            {!isProfileMode && profileId && (
              <input type="hidden" name="profile_id" value={profileId} />
            )}
            <div className="space-y-1.5">
              <Label htmlFor="picked-id" className="text-xs">
                {isProfileMode ? "Person" : "Site"}
              </Label>
              <Select
                value={pickedId}
                onValueChange={setPickedId}
              >
                <SelectTrigger id="picked-id">
                  <SelectValue
                    placeholder={isProfileMode ? "Pick a person" : "Pick a site"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {"full_name" in c ? c.full_name ?? c.email : c.name}
                      {"email" in c && c.full_name && (
                        <span className="text-muted-foreground"> · {c.email}</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name={fieldName} value={pickedId} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-id" className="text-xs">Role</Label>
              <Select value={roleId} onValueChange={setRoleId}>
                <SelectTrigger id="role-id">
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
                id="include_children"
                name="include_children"
                checked={includeChildren}
                onChange={(e) => setIncludeChildren(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <Label htmlFor="include_children" className="text-xs font-normal">
                <span className="font-medium">Include child sites</span>
                <span className="ml-1 text-muted-foreground">
                  — access propagates down the hierarchy.
                </span>
              </Label>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="submit"
                disabled={isPending || !pickedId || !roleId}
              >
                {isPending ? "Adding…" : "Add"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
