import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AssetNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Asset not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The asset you&apos;re looking for doesn&apos;t exist, has been removed,
        or isn&apos;t accessible from your current site.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/resources/assets">Back to assets</Link>
        </Button>
      </div>
    </div>
  );
}
