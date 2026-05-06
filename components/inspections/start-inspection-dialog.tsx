"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Play } from "lucide-react";
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
import { startInspection } from "@/app/(app)/inspections/actions";
import { IndustryChip } from "@/components/templates/badges";
import type { IndustryEnum } from "@/lib/templates/industry-map";

export type StartTemplateOption = {
  id: string;
  name: string;
  industry: IndustryEnum;
  description: string | null;
  assignment_id: string | null;
};

export function StartInspectionDialog({
  options,
  siteId,
}: {
  options: StartTemplateOption[];
  siteId: string | null;
}) {
  const router = useRouter();
  const sp = useSearchParams();
  const open = sp.get("action") === "start";
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<string | null>(
    options[0]?.id ?? null
  );

  useEffect(() => {
    if (open && !selected && options[0]) setSelected(options[0].id);
  }, [open, options, selected]);

  function handleClose() {
    const params = new URLSearchParams(sp.toString());
    params.delete("action");
    params.delete("template");
    router.push(`/inspections?${params.toString()}`);
  }

  function handleStart() {
    if (!selected || !siteId) return;
    const opt = options.find((o) => o.id === selected);
    if (!opt) return;
    startTransition(async () => {
      const res = await startInspection({
        template_id: opt.id,
        assignment_id: opt.assignment_id ?? undefined,
        site_id: siteId,
      });
      if (res && res.ok === false) {
        toast.error(res.error);
      }
      // On success the action redirects to /inspections/[id]
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (!o ? handleClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Start inspection</DialogTitle>
          <DialogDescription>
            Pick a published template assigned to your current site. The
            inspection will snapshot the current version — even if the template
            is edited later, this run keeps the items it started with.
          </DialogDescription>
        </DialogHeader>

        {!siteId ? (
          <p className="py-4 text-sm text-muted-foreground">
            Select a site from the topbar to start an inspection.
          </p>
        ) : options.length === 0 ? (
          <div className="py-4 text-sm text-muted-foreground">
            No published templates are assigned to this site yet. Ask an EHS
            Manager to assign one from the Templates module, or browse the
            library to import a starter.
          </div>
        ) : (
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto py-2">
            {options.map((opt) => (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => setSelected(opt.id)}
                  className={`w-full rounded-md border p-3 text-left transition ${
                    selected === opt.id
                      ? "border-primary bg-primary/5"
                      : "hover:bg-accent"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{opt.name}</p>
                      {opt.description && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {opt.description}
                        </p>
                      )}
                    </div>
                    <IndustryChip industry={opt.industry} />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={handleClose} disabled={pending}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleStart}
            disabled={pending || !selected || !siteId || options.length === 0}
          >
            <Play className="mr-1 h-3 w-3" />
            {pending ? "Starting..." : "Start inspection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
