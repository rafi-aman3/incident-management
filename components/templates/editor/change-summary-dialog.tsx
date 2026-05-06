"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { publishTemplateVersion } from "@/app/(app)/templates/[id]/edit/actions";

export function ChangeSummaryDialog({
  open,
  onOpenChange,
  templateId,
  draftVersionId,
  nextVersionNumber,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string;
  draftVersionId: string;
  nextVersionNumber: number;
  onSuccess: () => void;
}) {
  const [summary, setSummary] = useState("");
  const [pending, startTransition] = useTransition();

  // Reset on close
  useEffect(() => {
    if (!open) setSummary("");
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (summary.trim().length < 10) {
      toast.error("Describe what changed in at least 10 characters.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("template_id", templateId);
      fd.set("draft_version_id", draftVersionId);
      fd.set("change_summary", summary);
      const res = await publishTemplateVersion(null, fd);
      if (res.ok) {
        toast.success(`Published v${nextVersionNumber}`);
        onSuccess();
      } else {
        toast.error(res.error);
      }
    });
  }

  const remaining = Math.max(0, 10 - summary.trim().length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Publish v{nextVersionNumber}</DialogTitle>
            <DialogDescription>
              Publishing creates a new immutable version. In-flight inspections
              continue against the version they were started with.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label
              htmlFor="change_summary"
              className="text-sm font-medium"
            >
              What changed?
            </label>
            <Textarea
              id="change_summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              placeholder="e.g. Added a new question for forklift fluid levels; renamed Section 2 from PPE to Personal Protective Equipment."
              maxLength={2000}
              autoFocus
              required
            />
            <p className="mt-1 text-xs text-muted-foreground tabular-nums">
              {remaining > 0
                ? `${remaining} more character${remaining === 1 ? "" : "s"} required`
                : `${summary.trim().length} / 2000`}
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || summary.trim().length < 10}
            >
              {pending ? "Publishing..." : `Publish v${nextVersionNumber}`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
