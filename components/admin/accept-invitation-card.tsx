"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { ShieldCheck, Mail, ArrowRight, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptInvitation } from "@/app/(auth)/invite/[token]/actions";
import { signOut } from "@/app/(auth)/login/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

type Branch =
  | { kind: "not_found" }
  | { kind: "expired"; expiresAt: string }
  | { kind: "revoked" }
  | { kind: "accepted"; siteId: string }
  | {
      kind: "unauth";
      token: string;
      email: string;
      siteName: string;
      orgName: string;
      roleName: string;
      inviterName: string | null;
    }
  | {
      kind: "mismatch";
      email: string;
      currentEmail: string;
      siteName: string;
      orgName: string;
    }
  | {
      kind: "ready";
      token: string;
      email: string;
      siteName: string;
      orgName: string;
      roleName: string;
      inviterName: string | null;
    };

export function AcceptInvitationCard({ branch }: { branch: Branch }) {
  if (branch.kind === "not_found") {
    return (
      <Card>
        <Header
          icon={<AlertTriangle className="h-7 w-7 text-amber-500" />}
          title="Invitation not found"
          subtitle="The link may be wrong, or the invitation may have been removed."
        />
        <BackToLogin />
      </Card>
    );
  }

  if (branch.kind === "expired") {
    return (
      <Card>
        <Header
          icon={<AlertTriangle className="h-7 w-7 text-amber-500" />}
          title="This invitation expired"
          subtitle={`It expired on ${new Date(branch.expiresAt).toLocaleDateString()}. Ask your admin to send a new one.`}
        />
        <BackToLogin />
      </Card>
    );
  }

  if (branch.kind === "revoked") {
    return (
      <Card>
        <Header
          icon={<AlertTriangle className="h-7 w-7 text-destructive" />}
          title="This invitation was revoked"
          subtitle="If this was a mistake, ask the admin who invited you to send a new one."
        />
        <BackToLogin />
      </Card>
    );
  }

  if (branch.kind === "accepted") {
    return (
      <Card>
        <Header
          icon={<ShieldCheck className="h-7 w-7 text-emerald-500" aria-hidden />}
          title="Already accepted"
          subtitle="You already used this invitation. Head to your dashboard."
        />
        <Button asChild className="w-full">
          <Link
            href="/dashboard"
            aria-label="Go to dashboard (this invitation has already been accepted)"
          >
            Go to dashboard
          </Link>
        </Button>
      </Card>
    );
  }

  if (branch.kind === "unauth") {
    const redirectTo = `/invite/${branch.token}`;
    return (
      <Card>
        <Header
          icon={<Mail className="h-7 w-7 text-primary" aria-hidden />}
          title={`You're invited to ${branch.siteName}`}
          subtitle={
            branch.inviterName
              ? `${branch.inviterName} invited you to join ${branch.orgName} on ${branch.siteName} as ${branch.roleName}.`
              : `Join ${branch.orgName} on ${branch.siteName} as ${branch.roleName}.`
          }
        />
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Sign up or log in with <span className="font-medium">{branch.email}</span> to accept.
        </p>
        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link
              href={`/login?redirect_to=${encodeURIComponent(redirectTo)}&email=${encodeURIComponent(branch.email)}`}
              aria-label={`Log in or sign up to accept invitation to ${branch.siteName}`}
            >
              Log in or sign up
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </Card>
    );
  }

  if (branch.kind === "mismatch") {
    return (
      <Card>
        <Header
          icon={<AlertTriangle className="h-7 w-7 text-amber-500" aria-hidden />}
          title="Wrong account"
          subtitle={`This invitation is for ${branch.email}. You're signed in as ${branch.currentEmail}.`}
        />
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          Sign out and back in with <span className="font-medium">{branch.email}</span> to accept.
        </p>
        <div className="space-y-2">
          <form action={signOut}>
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              aria-label={`Sign out (this invitation is for ${branch.email}, not ${branch.currentEmail})`}
            >
              Sign out
            </Button>
          </form>
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    );
  }

  // ready
  return <ReadyCard branch={branch} />;
}

function ReadyCard({
  branch,
}: {
  branch: Extract<Branch, { kind: "ready" }>;
}) {
  const [state, formAction, isPending] = useActionState<
    ActionResult | null,
    FormData
  >(acceptInvitation, null);

  useEffect(() => {
    if (state?.ok === false) toast.error(state.error);
    // ok=true triggers a server-side redirect, so we never see it.
  }, [state]);

  return (
    <Card>
      <Header
        icon={<ShieldCheck className="h-7 w-7 text-primary" aria-hidden />}
        title={`Accept invitation to ${branch.siteName}?`}
        subtitle={
          branch.inviterName
            ? `${branch.inviterName} invited you to ${branch.orgName} as ${branch.roleName}.`
            : `Join ${branch.orgName} on ${branch.siteName} as ${branch.roleName}.`
        }
      />
      <p className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        Accepting will add you to <span className="font-medium">{branch.siteName}</span>{" "}
        with the <span className="font-medium">{branch.roleName}</span> role. You can
        always be removed by your site admin.
      </p>
      <form action={formAction} className="space-y-2">
        <input type="hidden" name="token" value={branch.token} />
        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
          aria-label={`Accept invitation to ${branch.siteName} as ${branch.roleName}`}
        >
          {isPending ? "Accepting…" : "Accept and continue"}
          {!isPending && <ArrowRight className="h-4 w-4" aria-hidden />}
        </Button>
      </form>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border bg-card p-6 shadow-sm">
      {children}
    </div>
  );
}

function Header({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        {icon}
      </div>
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">{subtitle}</p>
    </div>
  );
}

function BackToLogin() {
  return (
    <Button asChild variant="outline" className="w-full">
      <Link href="/login">Back to login</Link>
    </Button>
  );
}
