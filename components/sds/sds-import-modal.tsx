"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Beaker } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GhsPictogram } from "./ghs-pictogram";
import { DUMMY_SDS_CATALOG } from "@/lib/sds/dummy-catalog";
import { importSdsHazards } from "@/lib/actions/sds";

export type SdsModalSite = { id: string; name: string };

export function SdsImportModal({
  sites,
  defaultSiteId,
  defaultOpen,
}: {
  sites: SdsModalSite[];
  defaultSiteId: string | null;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  // defaultOpen is read once on mount via initial state — re-mount the
  // component (via key change in the parent) to re-honor a later truthy
  // value. Avoids the setState-in-effect lint complaint.
  const [open, setOpen] = useState(Boolean(defaultOpen));
  const [pending, startTransition] = useTransition();
  const [siteId, setSiteId] = useState<string>(defaultSiteId ?? sites[0]?.id ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalCandidates = Array.from(selected)
    .map((id) => DUMMY_SDS_CATALOG.find((s) => s.id === id))
    .filter((s): s is (typeof DUMMY_SDS_CATALOG)[number] => Boolean(s))
    .reduce((sum, s) => sum + s.hazards.length, 0);

  function onSubmit() {
    setError(null);
    if (!siteId) {
      setError("Pick a site to import into.");
      return;
    }
    if (selected.size === 0) {
      setError("Pick at least one chemical.");
      return;
    }
    startTransition(async () => {
      const result = await importSdsHazards({
        site_id: siteId,
        sds_ids: Array.from(selected),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Created ${result.data?.count ?? 0} candidates`);
      setOpen(false);
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-4 w-4" />
          Import from SDS Manager
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Beaker className="h-5 w-5 text-primary" />
            Import from SDS Manager
          </DialogTitle>
          <DialogDescription>
            Each chemical creates one candidate per H-statement. GHS pictograms and
            suggested controls carry through to the candidate review form.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto pr-1">
          <div>
            <Label htmlFor="sds-site">Target site</Label>
            <Select value={siteId} onValueChange={setSiteId}>
              <SelectTrigger id="sds-site"><SelectValue placeholder="Pick a site" /></SelectTrigger>
              <SelectContent>
                {sites.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <ul className="space-y-2">
            {DUMMY_SDS_CATALOG.map((sds) => {
              const checked = selected.has(sds.id);
              return (
                <li
                  key={sds.id}
                  className={
                    "rounded-md border p-3 transition " +
                    (checked ? "border-primary bg-primary/5" : "border-border bg-card")
                  }
                >
                  <label
                    htmlFor={`sds-${sds.id}`}
                    className="flex cursor-pointer items-start gap-3"
                  >
                    <Checkbox
                      id={`sds-${sds.id}`}
                      checked={checked}
                      onCheckedChange={() => toggle(sds.id)}
                      className="mt-1"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{sds.product_name}</span>
                        <span className="font-mono text-xs text-muted-foreground">CAS {sds.cas_number}</span>
                        <span
                          className={
                            "rounded-full px-2 py-0.5 text-xs font-medium uppercase tracking-wide " +
                            (sds.signal_word === "danger"
                              ? "bg-destructive/15 text-destructive"
                              : "bg-warning/15 text-warning")
                          }
                        >
                          {sds.signal_word}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {sds.manufacturer} · {sds.hazards.length} hazard{sds.hazards.length === 1 ? "" : "s"} ·{" "}
                        Ref {sds.id}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {sds.ghs_pictograms.length === 0 ? (
                          <span className="text-xs text-muted-foreground">No GHS pictograms</span>
                        ) : (
                          sds.ghs_pictograms.map((p) => (
                            <GhsPictogram key={p} code={p} size={28} />
                          ))
                        )}
                      </div>
                    </div>
                  </label>
                </li>
              );
            })}
          </ul>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex items-center justify-between gap-3 border-t pt-3">
          <p className="text-xs text-muted-foreground">
            {selected.size} chemical{selected.size === 1 ? "" : "s"} · {totalCandidates} candidate{totalCandidates === 1 ? "" : "s"} will be created
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
            <Button onClick={onSubmit} disabled={pending || selected.size === 0 || !siteId}>
              <Download className="mr-1.5 h-3.5 w-3.5" />
              {pending ? "Importing…" : `Import ${totalCandidates} candidate${totalCandidates === 1 ? "" : "s"}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
