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

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; signed_out?: string }>;
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
    </div>
  );
}

async function LoginFormFromParams({
  searchParams,
  demoAccounts,
}: {
  searchParams: Promise<{ next?: string; signed_out?: string }>;
  demoAccounts: { label: string; email: string }[];
}) {
  const { next = "/dashboard", signed_out } = await searchParams;
  return (
    <>
      {signed_out === "everywhere" ? (
        <div
          role="status"
          className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground"
        >
          You&apos;ve been signed out from all devices. Sign in again to
          continue.
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
