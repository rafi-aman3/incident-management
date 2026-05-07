"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { Copy, X } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { revokeInvitation } from "@/app/(app)/admin/invitations/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type InvitationRow = {
  id: string;
  email: string;
  site_id: string;
  site_name: string;
  role_id: string;
  role_name: string;
  invited_by_name: string | null;
  invited_by_email: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  token: string;
  accept_url: string;
};

type Status = "pending" | "expired" | "accepted" | "revoked";

function statusOf(row: InvitationRow): Status {
  if (row.revoked_at) return "revoked";
  if (row.accepted_at) return "accepted";
  if (new Date(row.expires_at) <= new Date()) return "expired";
  return "pending";
}

const STATUS_LABEL: Record<Status, string> = {
  pending: "Pending",
  expired: "Expired",
  accepted: "Accepted",
  revoked: "Revoked",
};

const STATUS_TONE: Record<Status, string> = {
  pending: "bg-primary/10 text-primary",
  expired: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  accepted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-200",
  revoked: "bg-muted text-muted-foreground",
};

export function InvitationsList({ rows }: { rows: InvitationRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No invitations match these filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Email</TableHead>
            <TableHead>Site</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Invited by</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const status = statusOf(row);
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.email}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.site_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.role_name}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {row.invited_by_name ?? row.invited_by_email ?? "—"}
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_TONE[status]}`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {status === "pending"
                    ? `${formatDistanceToNowStrict(new Date(row.expires_at))} left`
                    : format(new Date(row.expires_at), "PP")}
                </TableCell>
                <TableCell className="space-x-2 text-right">
                  {status === "pending" && (
                    <>
                      <CopyLinkButton acceptUrl={row.accept_url} />
                      <RevokeButton invitationId={row.id} />
                    </>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function CopyLinkButton({ acceptUrl }: { acceptUrl: string }) {
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(acceptUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — open the dialog and copy manually");
    }
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent"
      title="Copy accept URL"
    >
      <Copy className="h-3 w-3" /> Copy link
    </button>
  );
}

function RevokeButton({ invitationId }: { invitationId: string }) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    revokeInvitation,
    null,
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success("Invitation revoked");
      router.refresh();
    } else if (state?.ok === false) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="invitation_id" value={invitationId} />
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
        title="Revoke invitation"
      >
        <X className="h-3 w-3" />
        {isPending ? "Revoking…" : "Revoke"}
      </button>
    </form>
  );
}
