"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AdminInvitationsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
      <h2 className="mt-3 text-lg font-semibold">We couldn&apos;t load invitations</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Try again or head back to admin.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button asChild variant="outline">
          <Link href="/admin">Back to admin</Link>
        </Button>
      </div>
    </div>
  );
}
