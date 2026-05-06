import Link from "next/link";
import { UserPlus, Crown, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type InvestigationTeamMember = {
  profile_id: string;
  role: "lead" | "member" | "observer";
  full_name: string | null;
  email: string;
};

export function TeamPanel({
  members,
  leadId,
  basePath,
  canEdit,
  canReassignLead,
}: {
  members: InvestigationTeamMember[];
  leadId: string | null;
  basePath: string;
  canEdit: boolean;
  canReassignLead: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Team
          </p>
          <h2 className="text-base font-semibold">
            {members.length} member{members.length === 1 ? "" : "s"}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {canReassignLead && (
            <Link
              href={`${basePath}?action=reassign-lead`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
            >
              <Crown className="h-3 w-3" /> Reassign lead
            </Link>
          )}
          {canEdit && (
            <Link
              href={`${basePath}?action=add-team`}
              className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
            >
              <UserPlus className="h-3 w-3" /> Add member
            </Link>
          )}
        </div>
      </div>
      <ul className="divide-y">
        {members.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No team members yet. {canEdit && "Add the first one above."}
          </li>
        ) : (
          members.map((m) => {
            const name = m.full_name ?? m.email;
            const initials = computeInitials(name);
            const isLead = m.profile_id === leadId;
            return (
              <li key={m.profile_id} className="flex items-center gap-3 px-4 py-2">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{name}</span>
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                        isLead
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {isLead ? "Lead" : m.role}
                    </span>
                  </div>
                  <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                </div>
                {canEdit && !isLead && (
                  <Link
                    href={`${basePath}?action=remove-team&profile=${m.profile_id}`}
                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    aria-label={`Remove ${name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Link>
                )}
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
