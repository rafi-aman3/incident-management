"use client";

import { useActionState, useEffect, useState } from "react";
import { Mail, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createInvitation,
  type CreateInvitationResult,
} from "@/app/(app)/admin/invitations/actions";

export type InviteSiteOption = {
  id: string;
  name: string;
};
export type InviteRoleOption = {
  id: string;
  key: string;
  name: string;
};

export function InviteMemberDialog({
  sites,
  roles,
  defaultSiteId,
  triggerLabel = "Invite member",
  triggerVariant = "default",
}: {
  sites: InviteSiteOption[];
  roles: InviteRoleOption[];
  defaultSiteId?: string;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
}) {
  const [open, setOpen] = useState(false);
  const [siteId, setSiteId] = useState<string>(
    defaultSiteId ?? sites[0]?.id ?? "",
  );
  const [roleId, setRoleId] = useState<string>(
    roles.find((r) => r.key === "worker")?.id ?? roles[0]?.id ?? "",
  );
  const [includeChildren, setIncludeChildren] = useState(false);

  const [state, formAction, isPending] = useActionState<
    CreateInvitationResult | null,
    FormData
  >(createInvitation, null);

  useEffect(() => {
    if (!state) return;
    if (state.ok === false) toast.error(state.error);
    else if (state.ok && state.acceptUrl) {
      if (state.emailSent) toast.success("Invitation sent");
      else if (state.emailError)
        toast.warning(`Invitation created but email failed: ${state.emailError}`);
      else toast.success("Invitation created — copy the link below");
    }
  }, [state]);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
  };

  const reset = () => {
    setOpen(false);
    setIncludeChildren(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={triggerVariant}>
          <Mail className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a colleague</DialogTitle>
          <DialogDescription>
            We&apos;ll email a magic link. They&apos;ll land on the site you pick
            after they sign up or log in.
          </DialogDescription>
        </DialogHeader>

        {state?.ok && state.acceptUrl ? (
          <SuccessPanel
            acceptUrl={state.acceptUrl}
            emailSent={state.emailSent ?? false}
            emailError={state.emailError}
            onClose={reset}
          />
        ) : (
          <form action={formAction} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="invite-email" className="text-xs">
                Email
              </Label>
              <Input
                id="invite-email"
                name="email"
                type="email"
                placeholder="colleague@company.com"
                required
                autoComplete="email"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="invite-site" className="text-xs">
                  Site
                </Label>
                <Select value={siteId} onValueChange={setSiteId}>
                  <SelectTrigger id="invite-site">
                    <SelectValue placeholder="Pick a site" />
                  </SelectTrigger>
                  <SelectContent>
                    {sites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="site_id" value={siteId} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-role" className="text-xs">
                  Role
                </Label>
                <Select value={roleId} onValueChange={setRoleId}>
                  <SelectTrigger id="invite-role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="role_id" value={roleId} />
              </div>
            </div>

            <div className="flex items-start gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <input
                id="include_children"
                name="include_children"
                type="checkbox"
                checked={includeChildren}
                onChange={(e) => setIncludeChildren(e.target.checked)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <Label htmlFor="include_children" className="text-xs font-normal">
                <span className="font-medium">Include child sites</span>
                <span className="ml-1 text-muted-foreground">
                  — access propagates down the hierarchy.
                </span>
              </Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending || !siteId || !roleId}>
                {isPending ? "Inviting…" : "Send invitation"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SuccessPanel({
  acceptUrl,
  emailSent,
  emailError,
  onClose,
}: {
  acceptUrl: string;
  emailSent: boolean;
  emailError?: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Copy failed — select the link manually");
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 text-sm">
        <p className="font-medium">
          {emailSent
            ? "Invitation email sent."
            : emailError
              ? "Invitation created — email delivery failed."
              : "Invitation created."}
        </p>
        <p className="text-xs text-muted-foreground">
          {emailSent
            ? "We sent the magic link to the recipient."
            : "Copy the link below and send it to the recipient."}
        </p>
        {emailError && (
          <p className="mt-1 text-[11px] text-destructive">
            Email error: {emailError}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Accept URL</Label>
        <div className="flex gap-2">
          <Input value={acceptUrl} readOnly className="font-mono text-xs" />
          <Button type="button" variant="outline" onClick={copy}>
            {copied ? (
              <>
                <Check className="h-4 w-4" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" /> Copy
              </>
            )}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          The recipient must sign in (or sign up) with the invited email for
          this link to work.
        </p>
      </div>

      <DialogFooter>
        <Button onClick={onClose}>Done</Button>
      </DialogFooter>
    </div>
  );
}
