import Link from "next/link";
import { LibraryBig } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PresetNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <LibraryBig className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Preset not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The system preset you&apos;re looking for doesn&apos;t exist or has been
        retired.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/templates/browse">Back to library</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates">My templates</Link>
        </Button>
      </div>
    </div>
  );
}
