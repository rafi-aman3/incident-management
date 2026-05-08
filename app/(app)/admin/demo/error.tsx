"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function DemoError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" aria-hidden />
      <h2 className="mt-3 text-lg font-semibold">We couldn&apos;t load demo affordances</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Something went wrong. Try again, or head back to /admin if the issue
        persists.
      </p>
      {error.digest ? (
        <p className="mt-2 text-[11px] font-mono text-muted-foreground/70">
          Ref: {error.digest}
        </p>
      ) : null}
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    </div>
  );
}
