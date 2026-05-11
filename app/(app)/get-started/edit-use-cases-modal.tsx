"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { UseCaseTiles } from "@/components/get-started/use-case-tiles";
import { updateUseCases } from "./actions";
import { toast } from "sonner";
import type { UseCaseKey } from "@/lib/get-started/use-cases";

export function EditUseCasesModal({
  initialSelected,
  openByDefault,
}: {
  initialSelected: UseCaseKey[];
  openByDefault: boolean;
}) {
  const [open, setOpen] = useState(openByDefault);
  const [selected, setSelected] = useState<Set<UseCaseKey>>(new Set(initialSelected));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function toggle(k: UseCaseKey) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function save() {
    startTransition(async () => {
      const res = await updateUseCases(Array.from(selected));
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Updated");
      setOpen(false);
      router.replace("/get-started");
    });
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Change what you use
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>What do you mostly use this for?</DialogTitle>
            <DialogDescription>
              Pick one or more. We&apos;ll add or remove the matching sections on your Get Started checklist.
            </DialogDescription>
          </DialogHeader>
          <UseCaseTiles selected={selected} onToggle={toggle} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={save} disabled={pending}>{pending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
