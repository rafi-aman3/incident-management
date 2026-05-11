"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { TriangleAlert, Link2, X } from "lucide-react";
import { linkIncidentToHazard } from "@/lib/actions/incident-hazards";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export type HazardOption = {
  id: string;
  ref_code: string | null;
  title: string;
  hazard_category: string;
  status: string;
};

export type ExistingLink = {
  id: string;
  link_type: string;
  was_in_register_at_time: boolean;
  triggered_reassessment: boolean;
  notes: string | null;
  hazard: { id: string; ref_code: string | null; title: string } | null;
};

const LINK_TYPE_LABEL: Record<string, string> = {
  causal: "Causal",
  contributing: "Contributing",
  exposed_but_not_causal: "Exposed but not causal",
};

const LINK_TYPE_DESCRIPTION: Record<string, string> = {
  causal:
    "This hazard caused the incident. The hazard's prior assessment is invalidated — its status will be flipped back to under_assessment.",
  contributing: "This hazard made the incident worse but wasn't the primary cause.",
  exposed_but_not_causal: "Workers were exposed to this hazard but it wasn't a factor here.",
};

export function IncidentHazardLinkSection({
  incidentId,
  hazardOptions,
  existingLinks,
  canLink,
}: {
  incidentId: string;
  hazardOptions: HazardOption[];
  existingLinks: ExistingLink[];
  canLink: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TriangleAlert className="h-4 w-4" /> Hazard register links
          </h3>
          <p className="text-xs text-muted-foreground">
            Flag the hazards this incident exposed. Causal links flip the hazard back to under_assessment automatically.
          </p>
        </div>
        {canLink && (
          <LinkHazardDialog incidentId={incidentId} hazardOptions={hazardOptions} />
        )}
      </div>

      {existingLinks.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          No hazards linked yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {existingLinks.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                {l.hazard ? (
                  <Link href={`/hazards/${l.hazard.id}`} className="font-medium hover:underline">
                    {l.hazard.ref_code ?? l.hazard.id.slice(0, 8)} · {l.hazard.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">Hazard (no access)</span>
                )}
                {l.notes && <p className="mt-0.5 text-xs text-muted-foreground">{l.notes}</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    "rounded-full px-2 py-0.5 text-xs font-medium " +
                    (l.link_type === "causal"
                      ? "bg-destructive/15 text-destructive"
                      : l.link_type === "contributing"
                      ? "bg-warning/15 text-warning"
                      : "bg-muted text-muted-foreground")
                  }
                >
                  {LINK_TYPE_LABEL[l.link_type] ?? l.link_type}
                </span>
                {l.triggered_reassessment && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                    Reassessed
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function LinkHazardDialog({
  incidentId,
  hazardOptions,
}: {
  incidentId: string;
  hazardOptions: HazardOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [hazardId, setHazardId] = useState<string>(hazardOptions[0]?.id ?? "");
  const [linkType, setLinkType] = useState<string>("contributing");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setNotes("");
    setLinkType("contributing");
    setHazardId(hazardOptions[0]?.id ?? "");
  }

  function onSubmit() {
    setError(null);
    if (!hazardId) {
      setError("Pick a hazard from the register.");
      return;
    }
    startTransition(async () => {
      const result = await linkIncidentToHazard({
        incident_id: incidentId,
        hazard_id: hazardId,
        link_type: linkType as "causal" | "contributing" | "exposed_but_not_causal",
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data?.status_flipped
          ? "Linked + hazard flipped to under_assessment"
          : "Linked to hazard register",
      );
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={hazardOptions.length === 0}>
          <Link2 className="mr-1 h-4 w-4" /> Link to hazard register
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link to hazard register</DialogTitle>
          <DialogDescription>
            Flag a hazard from the register that played a role in this incident. EHS will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {hazardOptions.length === 0 ? (
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              No open hazards in the register yet.{" "}
              <Link href="/hazards/new" className="text-primary underline">Create one</Link>.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="hazard">Hazard</Label>
                <Select value={hazardId} onValueChange={setHazardId}>
                  <SelectTrigger id="hazard"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {hazardOptions.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {(h.ref_code ?? h.id.slice(0, 8)) + " · " + h.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Link type</Label>
                <RadioGroup value={linkType} onValueChange={setLinkType} className="mt-1.5 space-y-2">
                  {(["causal", "contributing", "exposed_but_not_causal"] as const).map((lt) => (
                    <label
                      key={lt}
                      htmlFor={`lt-${lt}`}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`lt-${lt}`} value={lt} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{LINK_TYPE_LABEL[lt]}</p>
                        <p className="text-xs text-muted-foreground">{LINK_TYPE_DESCRIPTION[lt]}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="link-notes">Notes (optional)</Label>
                <Textarea
                  id="link-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What about this hazard relates to this incident?"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            <X className="mr-1 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={onSubmit} disabled={pending || hazardOptions.length === 0}>
            {pending ? "Linking…" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
