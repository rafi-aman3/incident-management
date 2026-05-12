import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { OtpForm } from "./otp-form";

const DEMO_OTP = process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS;

type Search = Promise<{ email?: string }>;

export default function VerifyOtpPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
          TitanEHS
        </Link>
        <h1 className="text-xl font-semibold">Verify your email</h1>
      </div>

      <Suspense fallback={<OtpFormSkeleton />}>
        <OtpFormFromParams searchParams={searchParams} />
      </Suspense>

      <p className="text-center text-xs text-muted-foreground">
        Wrong email?{" "}
        <Link
          href="/register"
          className="font-medium text-brand underline underline-offset-2 hover:no-underline"
        >
          Go back
        </Link>
      </p>
    </div>
  );
}

async function OtpFormFromParams({ searchParams }: { searchParams: Search }) {
  const { email } = await searchParams;
  if (!email) redirect("/register");

  // Show the demo hint chip only in dev/preview when the bypass is configured.
  const demoHint =
    DEMO_OTP && process.env.NODE_ENV !== "production" ? DEMO_OTP : null;

  return (
    <>
      <p className="text-center text-sm text-muted-foreground">
        We sent a code to <span className="font-medium">{email}</span>. Enter it
        below to continue.
      </p>
      <OtpForm email={email} demoHint={demoHint} />
    </>
  );
}

function OtpFormSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-4 w-3/4 self-center" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-9 w-full" />
    </div>
  );
}
