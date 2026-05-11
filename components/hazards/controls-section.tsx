"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, CheckCircle2, Clock } from "lucide-react";
import { addControl, verifyControl } from "@/lib/actions/hazards";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ControlLevelBadge } from "./risk-badges";
import { CONTROL_LEVEL_VALUES, type ControlLevel } from "@/lib/risk/types";

export type ControlRow = {
  id: string;
  control_level: ControlLevel;
  control_description: string;
  effectiveness: "effective" | "partially_effective" | "not_yet_verified" | "ineffective";
  last_verified_at: string | null;
  next_verification_at: string | null;
  next_control_review_at: string | null;
  origin: string;
};

const CONTROL_LEVEL_LABEL: Record<ControlLevel, string> = {
  elimination: "Elimination",
  substitution: "Substitution",
  engineering: "Engineering",
  administrative: "Administrative",
  ppe: "PPE",
};

const EFFECTIVENESS_LABEL: Record<string, string> = {
  effective: "Effective",
  partially_effective: "Partially effective",
  not_yet_verified: "Not yet verified",
  ineffective: "Ineffective",
};

export function ControlsSection({
  hazardId,
  controls,
  canManage,
}: {
  hazardId: string;
  controls: ControlRow[];
  canManage: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Applied controls</h3>
          <p className="text-xs text-muted-foreground">
            Per ISO 45001 hierarchy — prefer elimination/substitution/engineering over PPE.
          </p>
        </div>
        {canManage && <AddControlDialog hazardId={hazardId} />}
      </div>

      {controls.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <p className="text-sm font-medium">No controls applied yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage
              ? "Add an engineering control to start reducing residual risk."
              : "An EHS Manager can add controls to this hazard."}
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {controls.map((c) => (
            <li key={c.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <ControlLevelBadge level={c.control_level} />
                    <span className="text-xs text-muted-foreground">
                      Origin: {c.origin.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="text-sm">{c.control_description}</p>
                </div>
                <div className="text-right text-xs">
                  <p className="font-medium">
                    {EFFECTIVENESS_LABEL[c.effectiveness]}
                  </p>
                  {c.last_verified_at ? (
                    <p className="flex items-center justify-end gap-1 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3" />
                      Verified {new Date(c.last_verified_at).toLocaleDateString()}
                    </p>
                  ) : (
                    <p className="flex items-center justify-end gap-1 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Not verified
                    </p>
                  )}
                  {c.next_control_review_at && (
                    <p className="text-muted-foreground">
                      Review by {new Date(c.next_control_review_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              {canManage && (
                <div className="mt-2 flex justify-end">
                  <VerifyControlDialog controlId={c.id} currentEffectiveness={c.effectiveness} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddControlDialog({ hazardId }: { hazardId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [level, setLevel] = useState<ControlLevel>("engineering");
  const [description, setDescription] = useState("");
  const [nextReview, setNextReview] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    if (description.trim().length < 3) {
      setError("Describe the control in at least a few words.");
      return;
    }
    startTransition(async () => {
      const result = await addControl(hazardId, {
        control_level: level,
        control_description: description.trim(),
        effectiveness: "not_yet_verified",
        next_control_review_at: nextReview || null,
        origin: "from_initial_assessment",
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Control added${result.data?.residual ? ` — residual ${result.data.residual}` : ""}`);
      setOpen(false);
      setDescription("");
      setNextReview("");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="mr-1 h-4 w-4" />Add control</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a control</DialogTitle>
          <DialogDescription>
            Higher tiers (elimination → engineering) reduce residual risk more than PPE.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="ctrl-level">Control level</Label>
            <Select value={level} onValueChange={(v) => setLevel(v as ControlLevel)}>
              <SelectTrigger id="ctrl-level"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTROL_LEVEL_VALUES.map((l) => (
                  <SelectItem key={l} value={l}>{CONTROL_LEVEL_LABEL[l]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ctrl-desc">Description</Label>
            <Textarea
              id="ctrl-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's the specific control? Who installs/enforces it?"
            />
          </div>
          <div>
            <Label htmlFor="ctrl-review">Next review (optional)</Label>
            <Input
              id="ctrl-review"
              type="date"
              value={nextReview}
              onChange={(e) => setNextReview(e.target.value)}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={onSubmit} disabled={pending}>{pending ? "Saving…" : "Add control"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VerifyControlDialog({
  controlId,
  currentEffectiveness,
}: {
  controlId: string;
  currentEffectiveness: ControlRow["effectiveness"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [effectiveness, setEffectiveness] = useState<ControlRow["effectiveness"]>(
    currentEffectiveness === "not_yet_verified" ? "effective" : currentEffectiveness,
  );
  const [notes, setNotes] = useState("");
  const [nextVerification, setNextVerification] = useState("");

  function onSubmit() {
    startTransition(async () => {
      const result = await verifyControl(controlId, {
        effectiveness,
        notes: notes || null,
        next_verification_at: nextVerification || null,
        next_control_review_at: null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Verification logged");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Verify</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify control</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="eff">Effectiveness</Label>
            <Select value={effectiveness} onValueChange={(v) => setEffectiveness(v as ControlRow["effectiveness"])}>
              <SelectTrigger id="eff"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="effective">Effective</SelectItem>
                <SelectItem value="partially_effective">Partially effective</SelectItem>
                <SelectItem value="ineffective">Ineffective</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="next-ver">Next verification (optional)</Label>
            <Input id="next-ver" type="date" value={nextVerification} onChange={(e) => setNextVerification(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>Cancel</Button>
          <Button onClick={onSubmit} disabled={pending}>{pending ? "Saving…" : "Log verification"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
