import Link from "next/link";
import { redirect } from "next/navigation";
import { OtpForm } from "./otp-form";

const DEMO_OTP = process.env.NEXT_PUBLIC_DEMO_OTP_BYPASS;

export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  if (!email) redirect("/register");

  // Show the demo hint chip only in dev/preview when the bypass is configured.
  const demoHint =
    DEMO_OTP && process.env.NODE_ENV !== "production" ? DEMO_OTP : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
          EHS
        </Link>
        <h1 className="text-xl font-semibold">Verify your email</h1>
        <p className="text-sm text-muted-foreground">
          We sent a code to <span className="font-medium">{email}</span>. Enter
          it below to continue.
        </p>
      </div>

      <OtpForm email={email} demoHint={demoHint} />

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
