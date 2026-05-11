import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "./login-form";
import { Skeleton } from "@/components/ui/skeleton";

const DEMO_ACCOUNTS = [
  { label: "Worker",     email: "worker@demo.local"     },
  { label: "Supervisor", email: "supervisor@demo.local" },
  { label: "EHS Mgr.",   email: "ehs@demo.local"        },
  { label: "Site Admin", email: "admin@demo.local"      },
];

type LoginSearch = {
  next?: string;
  signed_out?: string;
  password_reset?: string;
  after_verify?: string;
  account_deleted?: string;
  org_deleted?: string;
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<LoginSearch>;
}) {
  const showDemoChips = process.env.NODE_ENV !== "production";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
          EHS
        </Link>
        <h1 className="text-xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">
          Use one of the demo accounts to explore the platform.
        </p>
      </div>

      <Suspense fallback={<LoginFormSkeleton />}>
        <LoginFormFromParams
          searchParams={searchParams}
          demoAccounts={showDemoChips ? DEMO_ACCOUNTS : []}
        />
      </Suspense>

      <div className="flex flex-col gap-2 text-center text-xs text-muted-foreground">
        <Link
          href="/forgot-password"
          className="font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Forgot password?
        </Link>
        <p>
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="font-medium text-brand underline underline-offset-2 hover:no-underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

async function LoginFormFromParams({
  searchParams,
  demoAccounts,
}: {
  searchParams: Promise<LoginSearch>;
  demoAccounts: { label: string; email: string }[];
}) {
  const {
    next = "/dashboard",
    signed_out,
    password_reset,
    after_verify,
    account_deleted,
    org_deleted,
  } = await searchParams;
  return (
    <>
      {account_deleted === "1" ? (
        <div
          role="status"
          className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground"
        >
          Your account has been deleted. Thank you for using the platform.
        </div>
      ) : null}
      {org_deleted === "1" ? (
        <div
          role="status"
          className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground"
        >
          The organisation has been deleted. All accounts and data within it
          were permanently removed.
        </div>
      ) : null}
      {signed_out === "everywhere" ? (
        <div
          role="status"
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"
        >
          You&apos;ve been signed out from all devices. Sign in again to
          continue.
        </div>
      ) : null}
      {password_reset === "1" ? (
        <div
          role="status"
          className="rounded-md border border-success/30 bg-success/10 px-3 py-2 text-xs text-foreground"
        >
          Password updated. Sign in with your new password.
        </div>
      ) : null}
      {after_verify === "1" ? (
        <div
          role="status"
          className="rounded-md border bg-card px-3 py-2 text-xs text-foreground"
        >
          Email verified. Sign in to continue.
        </div>
      ) : null}
      <LoginForm next={next} demoAccounts={demoAccounts} />
    </>
  );
}

function LoginFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
