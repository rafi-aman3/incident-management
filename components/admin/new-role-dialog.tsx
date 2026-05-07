"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PermissionChecklist,
  type PermissionCatalogEntry,
} from "@/components/admin/permission-checklist";
import { createRole, type CreateRoleResult } from "@/app/(app)/admin/roles/actions";

export function NewRoleDialog({
  catalog,
  triggerLabel = "New role",
}: {
  catalog: PermissionCatalogEntry[];
  triggerLabel?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const openFromUrl = sp.get("action") === "new";

  const [open, setOpen] = useState(false);
  // Sync with URL ?action=new (so /admin/roles?action=new opens it).
  useEffect(() => {
    setOpen(openFromUrl);
  }, [openFromUrl]);

  const [state, formAction, isPending] = useActionState<
    CreateRoleResult | null,
    FormData
  >(createRole, null);

  useEffect(() => {
    if (state?.ok && state.roleId) {
      toast.success("Role created");
      // Land on the new role's edit page so the admin can refine perms.
      router.replace(`/admin/roles/${state.roleId}?tab=permissions`);
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state, router]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next && openFromUrl) {
      const params = new URLSearchParams(sp);
      params.delete("action");
      const qs = params.toString();
      router.replace(qs ? `/admin/roles?${qs}` : "/admin/roles");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create a custom role</DialogTitle>
          <DialogDescription>
            Pick a name and the permissions this role grants. You can edit them
            any time.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                name="name"
                placeholder="e.g. Auditor (read-only)"
                required
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-description">Description (optional)</Label>
              <Input
                id="role-description"
                name="description"
                placeholder="Short summary, shown in the roles list."
                maxLength={280}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Permissions</Label>
            <div className="max-h-[40vh] overflow-y-auto pr-1">
              <PermissionChecklist
                catalog={catalog}
                initialSelected={[]}
                hiddenSetMarker
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Creating…" : "Create role"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

