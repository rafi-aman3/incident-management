import Link from "next/link";
import { ResetPasswordForm } from "./reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
          TitanEHS
        </Link>
        <h1 className="text-xl font-semibold">Set a new password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a password you haven&apos;t used before, at least 8
          characters.
        </p>
      </div>

      <ResetPasswordForm />
    </div>
  );
}
