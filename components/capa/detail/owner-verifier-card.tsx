import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserCheck, ShieldCheck, Crown } from "lucide-react";

export function OwnerVerifierCard({
  ownerName,
  ownerEmail,
  verifierName,
  verifierEmail,
  basePath,
  canReassignVerifier,
  status,
}: {
  ownerName: string | null;
  ownerEmail: string;
  verifierName: string | null;
  verifierEmail: string | null;
  basePath: string;
  canReassignVerifier: boolean;
  status: string;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          People
        </p>
      </div>
      <ul className="divide-y text-sm">
        <li className="flex items-center gap-3 px-4 py-3">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="text-[10px]">
              {computeInitials(ownerName ?? ownerEmail)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 truncate text-sm font-medium">
              <Crown className="h-3 w-3 text-amber-500" /> Owner
            </p>
            <p className="truncate text-[12px]">{ownerName ?? ownerEmail}</p>
            {ownerName && (
              <p className="truncate text-[11px] text-muted-foreground">
                {ownerEmail}
              </p>
            )}
          </div>
        </li>
        <li className="px-4 py-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="text-[10px]">
                {verifierName || verifierEmail
                  ? computeInitials(verifierName ?? verifierEmail!)
                  : "—"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 truncate text-sm font-medium">
                <ShieldCheck className="h-3 w-3 text-primary" /> Verifier
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  (independent)
                </span>
              </p>
              {verifierName || verifierEmail ? (
                <>
                  <p className="truncate text-[12px]">
                    {verifierName ?? verifierEmail}
                  </p>
                  {verifierName && verifierEmail && (
                    <p className="truncate text-[11px] text-muted-foreground">
                      {verifierEmail}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-[12px] italic text-muted-foreground">
                  unassigned
                </p>
              )}
            </div>
          </div>
          {canReassignVerifier && status !== "verified" && status !== "closed" && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="mt-2 w-full"
            >
              <Link href={`${basePath}?action=reassign-verifier`}>
                <UserCheck className="h-3 w-3" /> Reassign verifier
              </Link>
            </Button>
          )}
        </li>
      </ul>
    </div>
  );
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
