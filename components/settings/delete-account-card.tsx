"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useState,
} from "react";
import { AlertTriangle, ShieldAlert, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  deleteOwnAccount,
  deleteOwnOrg,
} from "@/app/(app)/settings/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type OrgDeleteSummary = {
  name: string;
  members: number;
  sites: number;
  incidents: number;
};

export function DeleteAccountCard({
  email,
  isSoleAdmin,
  isOrgAdmin,
  orgSummary,
}: {
  email: string;
  isSoleAdmin: boolean;
  isOrgAdmin: boolean;
  orgSummary: OrgDeleteSummary;
}) {
  const [accountState, accountAction, isAccountPending] = useActionState<
    ActionResult | null,
    FormData
  >(deleteOwnAccount, null);

  const [orgState, orgAction, isOrgPending] = useActionState<
    ActionResult | null,
    FormData
  >(deleteOwnOrg, null);

  const [typedEmail, setTypedEmail] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [confirmKeyword, setConfirmKeyword] = useState("");
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [orgDialogOpen, setOrgDialogOpen] = useState(false);

  useEffect(() => {
    if (accountState && accountState.ok === false) toast.error(accountState.error);
  }, [accountState]);
  useEffect(() => {
    if (orgState && orgState.ok === false) toast.error(orgState.error);
  }, [orgState]);

  const emailMatches = typedEmail.toLowerCase() === email.toLowerCase();
  const orgGateSatisfied =
    confirmName.trim() === orgSummary.name && confirmKeyword === "DELETE";

  return (
    <section
      aria-labelledby="settings-delete-heading"
      className="space-y-5 rounded-lg border border-destructive/40 bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2
            id="settings-delete-heading"
            className="text-base font-semibold"
          >
            Delete account
          </h2>
          <p className="text-xs text-muted-foreground">
            Permanently delete your account. This cannot be undone.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-md bg-muted/30 p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground">What happens:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>You will be signed out everywhere.</li>
          <li>
            Reports, investigations, CAPAs, hazards, and JSAs you authored stay
            in the workspace. Their author becomes <em>&ldquo;Removed user&rdquo;</em>.
          </li>
          <li>Your authored regulatory records remain intact for audit retention.</li>
        </ul>
      </div>

      {/* ─── Sole-admin guard banner ───────────────────────────────────── */}
      {isSoleAdmin && (
        <div className="space-y-3 rounded-md border border-warning/50 bg-warning/10 p-3 text-xs">
          <div className="flex items-start gap-2">
            <ShieldAlert
              className="mt-0.5 h-4 w-4 shrink-0 text-warning"
              aria-hidden
            />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                You&apos;re the last workspace admin.
              </p>
              <p className="text-muted-foreground">
                Before you can delete your account, either{" "}
                <Link
                  href="/admin/members"
                  className="font-medium underline underline-offset-2"
                >
                  promote another admin
                </Link>{" "}
                under <strong>Admin → Members</strong>, or delete the entire
                organisation along with your account.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete account button (typed-email gate) ──────────────────── */}
      <AlertDialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="destructive"
            disabled={isSoleAdmin}
            aria-disabled={isSoleAdmin}
          >
            <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
            Delete my account
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete your account?</AlertDialogTitle>
            <AlertDialogDescription>
              Type your email <strong className="font-mono">{email}</strong> to
              confirm. This action is permanent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <form action={accountAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="confirm_email" className="text-xs">
                Your email
              </Label>
              <Input
                id="confirm_email"
                name="confirm_email"
                type="email"
                value={typedEmail}
                onChange={(e) => setTypedEmail(e.target.value)}
                autoComplete="off"
                placeholder={email}
              />
            </div>
            <AlertDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setAccountDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={!emailMatches || isAccountPending}
              >
                {isAccountPending ? "Deleting…" : "Delete account"}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Delete entire org (sole-admin escape hatch) ───────────────── */}
      {isOrgAdmin && isSoleAdmin && (
        <div className="border-t pt-4">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">
                Delete the entire organisation
              </p>
              <p className="text-xs text-muted-foreground">
                Wipes the workspace and every account in it, including yours.
              </p>
            </div>
            <AlertDialog open={orgDialogOpen} onOpenChange={setOrgDialogOpen}>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" className="shrink-0">
                  <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
                  Delete organisation…
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    Delete the entire organisation?
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    This permanently deletes everything in{" "}
                    <strong>{orgSummary.name}</strong>:
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <ul className="list-disc space-y-1 rounded-md bg-muted/40 p-3 pl-7 text-xs text-muted-foreground">
                  <li>
                    <strong className="text-foreground">
                      {orgSummary.members.toLocaleString()}
                    </strong>{" "}
                    member account{orgSummary.members === 1 ? "" : "s"}
                  </li>
                  <li>
                    <strong className="text-foreground">
                      {orgSummary.sites.toLocaleString()}
                    </strong>{" "}
                    site{orgSummary.sites === 1 ? "" : "s"}
                  </li>
                  <li>
                    <strong className="text-foreground">
                      {orgSummary.incidents.toLocaleString()}
                    </strong>{" "}
                    incident{orgSummary.incidents === 1 ? "" : "s"}, plus every
                    investigation, CAPA, hazard, JSA, template, and document
                  </li>
                </ul>
                <form action={orgAction} className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_name" className="text-xs">
                      Type{" "}
                      <strong className="font-mono">{orgSummary.name}</strong>{" "}
                      to confirm
                    </Label>
                    <Input
                      id="confirm_name"
                      name="confirm_name"
                      value={confirmName}
                      onChange={(e) => setConfirmName(e.target.value)}
                      autoComplete="off"
                      placeholder={orgSummary.name}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_keyword" className="text-xs">
                      Type <strong className="font-mono">DELETE</strong> to
                      finalise
                    </Label>
                    <Input
                      id="confirm_keyword"
                      name="confirm_keyword"
                      value={confirmKeyword}
                      onChange={(e) => setConfirmKeyword(e.target.value)}
                      autoComplete="off"
                      placeholder="DELETE"
                    />
                  </div>
                  <AlertDialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOrgDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={!orgGateSatisfied || isOrgPending}
                    >
                      {isOrgPending
                        ? "Deleting…"
                        : "Delete organisation and account"}
                    </Button>
                  </AlertDialogFooter>
                </form>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      )}
    </section>
  );
}
