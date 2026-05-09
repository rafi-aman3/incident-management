"use client";

import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/app/(auth)/login/actions";

/**
 * Same-device sign out. No AlertDialog confirm — sign-out on this device is
 * reversible by signing back in. Sign-out-everywhere lives in the Security
 * card with its own confirm.
 */
export function SignOutCard() {
  const [isPending, startTransition] = useTransition();

  return (
    <section
      aria-labelledby="settings-signout-heading"
      className="rounded-lg border bg-card p-5"
    >
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="settings-signout-heading" className="text-base font-semibold">
            Sign out
          </h2>
          <p className="text-xs text-muted-foreground">
            Sign out of this device only. Your sessions on other devices stay
            active.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={isPending}
          onClick={() => startTransition(async () => signOut())}
          className="self-start sm:self-auto"
        >
          <LogOut className="mr-1.5 h-4 w-4" aria-hidden />
          {isPending ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </section>
  );
}
