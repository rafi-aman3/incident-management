"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function TemplateEditorError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-8 text-center">
      <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
      <h2 className="mt-3 text-lg font-semibold">
        We couldn&apos;t open the editor
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your draft is safe — autosave persists every change to the server. Try
        again, or open the read-only viewer.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button onClick={reset} variant="default">
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">Back to templates</Link>
        </Button>
      </div>
    </div>
  );
}
