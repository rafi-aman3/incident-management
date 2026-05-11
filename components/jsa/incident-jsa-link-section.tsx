"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { HardHat, Link2, X } from "lucide-react";
import { linkJsaToIncident } from "@/lib/actions/jsa-incident-links";
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
import { JsaStatusBadge } from "./jsa-status-badge";
import type { JsaStatus, JsaIncidentLinkType } from "@/lib/actions/jsa-schemas";

export type JsaOption = {
  id: string;
  ref_code: string | null;
  title: string;
  status: JsaStatus;
};

export type ExistingJsaLink = {
  id: string;
  link_type: JsaIncidentLinkType;
  triggered_review: boolean;
  notes: string | null;
  jsa: { id: string; ref_code: string | null; title: string } | null;
};

const LINK_TYPE_LABEL: Record<JsaIncidentLinkType, string> = {
  causal: "Causal",
  contributing: "Contributing",
  exposed_but_not_causal: "Exposed but not causal",
};

const LINK_TYPE_DESCRIPTION: Record<JsaIncidentLinkType, string> = {
  causal:
    "The JSA's controls weren't sufficient to prevent this incident. An approved JSA will be flipped back to under_review.",
  contributing: "The JSA was relevant but wasn't the primary factor.",
  exposed_but_not_causal: "Workers performed this job but the JSA wasn't a factor here.",
};

export function IncidentJsaLinkSection({
  incidentId,
  jsaOptions,
  existingLinks,
  canLink,
}: {
  incidentId: string;
  jsaOptions: JsaOption[];
  existingLinks: ExistingJsaLink[];
  canLink: boolean;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <HardHat className="h-4 w-4" /> JSA links
          </h3>
          <p className="text-xs text-muted-foreground">
            Flag JSAs relevant to this incident. Causal links flip the JSA back to under_review for re-approval.
          </p>
        </div>
        {canLink && (
          <LinkJsaDialog incidentId={incidentId} jsaOptions={jsaOptions} />
        )}
      </div>

      {existingLinks.length === 0 ? (
        <p className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
          No JSAs linked yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {existingLinks.map((l) => (
            <li
              key={l.id}
              className="flex items-center justify-between gap-2 rounded-md border bg-background px-3 py-2 text-sm"
            >
              <div className="min-w-0">
                {l.jsa ? (
                  <Link href={`/jsa/${l.jsa.id}`} className="font-medium hover:underline">
                    {l.jsa.ref_code ?? l.jsa.id.slice(0, 8)} · {l.jsa.title}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">JSA (no access)</span>
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
                  {LINK_TYPE_LABEL[l.link_type]}
                </span>
                {l.triggered_review && (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">
                    Re-review
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

function LinkJsaDialog({
  incidentId,
  jsaOptions,
}: {
  incidentId: string;
  jsaOptions: JsaOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [jsaId, setJsaId] = useState<string>(jsaOptions[0]?.id ?? "");
  const [linkType, setLinkType] = useState<JsaIncidentLinkType>("contributing");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setError(null);
    setNotes("");
    setLinkType("contributing");
    setJsaId(jsaOptions[0]?.id ?? "");
  }

  function onSubmit() {
    setError(null);
    if (!jsaId) {
      setError("Pick a JSA.");
      return;
    }
    startTransition(async () => {
      const result = await linkJsaToIncident(jsaId, {
        incident_id: incidentId,
        link_type: linkType,
        notes: notes || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data?.status_flipped
          ? "Linked + JSA flipped to under_review"
          : "Linked to JSA",
      );
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={jsaOptions.length === 0}>
          <Link2 className="mr-1 h-4 w-4" /> Link to JSA
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Link a JSA to this incident</DialogTitle>
          <DialogDescription>
            Flag a JSA relevant to the work performed when this incident occurred. The JSA's creator and approver will be notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {jsaOptions.length === 0 ? (
            <p className="rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              No JSAs in scope yet.{" "}
              <Link href="/jsa/new" className="text-primary underline">Draft one</Link>.
            </p>
          ) : (
            <>
              <div>
                <Label htmlFor="jsa">JSA</Label>
                <Select value={jsaId} onValueChange={setJsaId}>
                  <SelectTrigger id="jsa"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {jsaOptions.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {(j.ref_code ?? j.id.slice(0, 8)) + " · " + j.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {jsaId && (
                  <div className="mt-1 text-xs">
                    <JsaStatusBadge
                      status={jsaOptions.find((j) => j.id === jsaId)?.status ?? "draft"}
                    />
                  </div>
                )}
              </div>

              <div>
                <Label>Link type</Label>
                <RadioGroup
                  value={linkType}
                  onValueChange={(v) => setLinkType(v as JsaIncidentLinkType)}
                  className="mt-1.5 space-y-2"
                >
                  {(["causal", "contributing", "exposed_but_not_causal"] as const).map((lt) => (
                    <label
                      key={lt}
                      htmlFor={`jlt-${lt}`}
                      className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-3 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
                    >
                      <RadioGroupItem id={`jlt-${lt}`} value={lt} className="mt-0.5" />
                      <div>
                        <p className="text-sm font-medium">{LINK_TYPE_LABEL[lt]}</p>
                        <p className="text-xs text-muted-foreground">{LINK_TYPE_DESCRIPTION[lt]}</p>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              </div>

              <div>
                <Label htmlFor="jsa-link-notes">Notes (optional)</Label>
                <Textarea
                  id="jsa-link-notes"
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What about this JSA relates to this incident?"
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
          <Button onClick={onSubmit} disabled={pending || jsaOptions.length === 0}>
            {pending ? "Linking…" : "Link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
