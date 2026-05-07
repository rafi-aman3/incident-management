"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PermissionChecklist,
  type PermissionCatalogEntry,
} from "@/components/admin/permission-checklist";
import { updateRole } from "@/app/(app)/admin/roles/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export function RolePermissionsForm({
  roleId,
  roleName,
  description,
  isSystemRole,
  catalog,
  initialSelected,
}: {
  roleId: string;
  roleName: string;
  description: string | null;
  isSystemRole: boolean;
  catalog: PermissionCatalogEntry[];
  initialSelected: string[];
}) {
  const [name, setName] = useState(roleName);
  const [desc, setDesc] = useState(description ?? "");
  const [selected, setSelected] = useState<string[]>(initialSelected);

  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateRole, null);

  useEffect(() => {
    if (state?.ok) toast.success("Role updated");
    else if (state?.ok === false) toast.error(state.error);
  }, [state]);

  const initialSet = useMemo(() => new Set(initialSelected), [initialSelected]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const permsDirty =
    selectedSet.size !== initialSet.size ||
    Array.from(selectedSet).some((k) => !initialSet.has(k));
  const nameDirty = !isSystemRole && name.trim() !== roleName;
  const descDirty = (desc ?? "").trim() !== (description ?? "").trim();
  const dirty = permsDirty || nameDirty || descDirty;

  const dirtyCount =
    (permsDirty ? 1 : 0) + (nameDirty ? 1 : 0) + (descDirty ? 1 : 0);

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="role_id" value={roleId} />

      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="role-name" className="text-xs">
            Name
          </Label>
          <Input
            id="role-name"
            name="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystemRole}
            maxLength={80}
            required
          />
          {isSystemRole && (
            <p className="text-[11px] text-muted-foreground">
              System roles can&apos;t be renamed.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="role-desc" className="text-xs">
            Description
          </Label>
          <Input
            id="role-desc"
            name="description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={280}
            placeholder="Short summary, shown in the roles list."
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-baseline justify-between">
          <Label className="text-xs">Permissions</Label>
          {dirty && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">
              {dirtyCount} unsaved change{dirtyCount === 1 ? "" : "s"}
            </span>
          )}
        </div>
        <PermissionChecklist
          catalog={catalog}
          initialSelected={initialSelected}
          hiddenSetMarker
          onChange={setSelected}
        />
      </div>

      <div className="sticky bottom-0 -mx-4 flex items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur">
        <Button type="submit" disabled={!dirty || isPending}>
          <Save className="h-4 w-4" />
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
