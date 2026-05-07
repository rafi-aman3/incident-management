"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  archiveSite,
  unarchiveSite,
} from "@/app/(app)/admin/sites/[id]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

/**
 * Archive: type-the-name guard (Stripe-style). Archived sites are easy to
 * forget about and surface in reports, so high friction is appropriate.
 *
 * Unarchive: simple Yes / Cancel — reversible.
 */
export function ArchiveSiteDialog({
  siteId,
  siteName,
  archived,
}: {
  siteId: string;
  siteName: string;
  archived: boolean;
}) {
  if (archived) {
    return <UnarchiveAction siteId={siteId} siteName={siteName} />;
  }
  return <ArchiveAction siteId={siteId} siteName={siteName} />;
}

function ArchiveAction({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    archiveSite,
    null,
  );
  const [confirmName, setConfirmName] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Site archived");
      setOpen(false);
      router.push("/admin/sites?status=archived");
    }
    if (state && state.ok === false && !state.fieldErrors) toast.error(state.error);
  }, [state, router]);

  const confirmErr = state?.ok === false ? state.fieldErrors?.confirm_name?.[0] : undefined;

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <Archive className="h-4 w-4" /> Archive site
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive {siteName}?</AlertDialogTitle>
          <AlertDialogDescription>
            Archived sites are hidden from default views and from new incident /
            inspection reporting. Historical records stay intact. You can
            unarchive a site any time as long as its parent is still active.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="site_id" value={siteId} />
          <input type="hidden" name="expected_name" value={siteName} />
          <div className="space-y-1.5">
            <Label htmlFor="confirm_name" className="text-xs">
              Type <span className="font-mono font-semibold">{siteName}</span> to confirm
            </Label>
            <Input
              id="confirm_name"
              name="confirm_name"
              autoComplete="off"
              autoFocus
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />
            {confirmErr && <p className="text-xs text-destructive">{confirmErr}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason" className="text-xs">
              Reason (optional)
            </Label>
            <Textarea
              id="reason"
              name="reason"
              maxLength={500}
              rows={2}
              placeholder="e.g. Decommissioned 2026-Q2 — operations moved to Houston North."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction
              type="submit"
              disabled={isPending || confirmName !== siteName}
            >
              {isPending ? "Archiving…" : "Archive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function UnarchiveAction({
  siteId,
  siteName,
}: {
  siteId: string;
  siteName: string;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    unarchiveSite,
    null,
  );
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (state?.ok) {
      toast.success("Site unarchived");
      setOpen(false);
      router.push("/admin/sites");
    }
    if (state?.ok === false) toast.error(state.error);
  }, [state, router]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-accent"
        >
          <ArchiveRestore className="h-4 w-4" /> Unarchive site
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unarchive {siteName}?</AlertDialogTitle>
          <AlertDialogDescription>
            The site reappears in default views and accepts new incidents,
            inspections, etc. If the parent is itself archived, you&apos;ll
            need to unarchive it first.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form action={formAction}>
          <input type="hidden" name="site_id" value={siteId} />
          <AlertDialogFooter>
            <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
            <AlertDialogAction type="submit" disabled={isPending}>
              {isPending ? "Unarchiving…" : "Unarchive"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
