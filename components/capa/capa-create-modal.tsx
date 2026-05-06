"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createCapa } from "@/app/(app)/capa/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type CapaCreateMember = {
  id: string;
  full_name: string | null;
  email: string;
};

export type CapaCreateContext =
  | { kind: "standalone" }
  | {
      kind: "investigation";
      investigationId: string;
      defaultOwnerId: string | null;
    };

/**
 * URL-driven CAPA-create modal. Triggered when ?action=create on /capa
 * (standalone) or ?action=create-capa on /investigations/[id] (bound to
 * the investigation; closes it atomically via assign_capa_from_investigation_v1).
 *
 * Verifier picker hides the row matching the currently-selected owner so
 * the UI prevents the owner-≠-verifier rule before the DB CHECK fires.
 */
export function CapaCreateModal({
  members,
  context,
}: {
  members: CapaCreateMember[];
  context: CapaCreateContext;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const action = searchParams.get("action");

  const triggerKey =
    context.kind === "standalone" ? "create" : "create-capa";
  const open = action === triggerKey;
  const close = () => router.replace(pathname);

  const defaultOwner =
    context.kind === "investigation" ? context.defaultOwnerId : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {context.kind === "investigation"
              ? "Assign CAPA & close investigation"
              : "New CAPA"}
          </DialogTitle>
          <DialogDescription>
            {context.kind === "investigation"
              ? "Creating this CAPA closes the investigation in the same transaction. Owner ≠ verifier — the verifier picker hides the owner row."
              : "Stand-alone CAPA, not tied to an investigation. Owner ≠ verifier."}
          </DialogDescription>
        </DialogHeader>
        {open && (
          <CapaCreateForm
            members={members}
            investigationId={
              context.kind === "investigation" ? context.investigationId : null
            }
            defaultOwnerId={defaultOwner}
            onSuccess={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CapaCreateForm({
  members,
  investigationId,
  defaultOwnerId,
  onSuccess,
}: {
  members: CapaCreateMember[];
  investigationId: string | null;
  defaultOwnerId: string | null;
  onSuccess: () => void;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    createCapa,
    null
  );

  const initialOwner = defaultOwnerId ?? members[0]?.id ?? "";
  const [ownerId, setOwnerId] = useState(initialOwner);
  const [verifierId, setVerifierId] = useState<string>("");

  const verifierOptions = useMemo(
    () => members.filter((m) => m.id !== ownerId),
    [members, ownerId]
  );

  useEffect(() => {
    if (state?.ok) {
      // Server action redirects on success — toast is informational.
      toast.success("CAPA created");
      onSuccess();
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state, onSuccess]);

  // If the chosen verifier becomes the owner, blank it out
  useEffect(() => {
    if (verifierId && verifierId === ownerId) setVerifierId("");
  }, [ownerId, verifierId]);

  const defaultDue = new Date();
  defaultDue.setDate(defaultDue.getDate() + 30);
  const defaultDueStr = defaultDue.toISOString().slice(0, 10);

  return (
    <form action={formAction} className="space-y-4">
      {investigationId && (
        <input type="hidden" name="investigation_id" value={investigationId} />
      )}

      <div className="space-y-2">
        <Label>Type</Label>
        <RadioGroup name="type" defaultValue="corrective" className="flex gap-4">
          <Label htmlFor="capa-type-corrective" className="flex items-center gap-2">
            <RadioGroupItem id="capa-type-corrective" value="corrective" />
            <span className="text-sm">Corrective <span className="text-[11px] text-muted-foreground">(fix the immediate problem)</span></span>
          </Label>
          <Label htmlFor="capa-type-preventive" className="flex items-center gap-2">
            <RadioGroupItem id="capa-type-preventive" value="preventive" />
            <span className="text-sm">Preventive <span className="text-[11px] text-muted-foreground">(stop it recurring)</span></span>
          </Label>
        </RadioGroup>
      </div>

      <div className="space-y-2">
        <Label htmlFor="capa-title">Title</Label>
        <Input id="capa-title" name="title" required maxLength={200} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="capa-desc">Description</Label>
        <Textarea
          id="capa-desc"
          name="description"
          required
          rows={4}
          maxLength={5000}
          placeholder="What needs to change. Specific enough that someone else could verify it later."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="capa-owner">Owner</Label>
          <Select name="owner_id" value={ownerId} onValueChange={setOwnerId}>
            <SelectTrigger id="capa-owner">
              <SelectValue placeholder="Pick owner" />
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
          <Label htmlFor="capa-verifier">Verifier</Label>
          <Select name="verifier_id" value={verifierId} onValueChange={setVerifierId}>
            <SelectTrigger id="capa-verifier">
              <SelectValue placeholder="Pick verifier" />
            </SelectTrigger>
            <SelectContent>
              {verifierOptions.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No other site members available.
                </div>
              ) : (
                verifierOptions.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="capa-due">Due date</Label>
        <Input
          id="capa-due"
          name="due_date"
          type="date"
          required
          defaultValue={defaultDueStr}
        />
      </div>

      <DialogFooter className="gap-2 sm:justify-end">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={isPending || !verifierId || !ownerId}>
          {isPending
            ? "Creating…"
            : investigationId
              ? "Create CAPA & close investigation"
              : "Create CAPA"}
        </Button>
      </DialogFooter>
    </form>
  );
}
