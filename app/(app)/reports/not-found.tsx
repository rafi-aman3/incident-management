import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ReportsNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Report not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The report or incident you&apos;re looking for either doesn&apos;t exist
        or isn&apos;t applicable to your current site.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/reports">Back to reports</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/incidents">Browse incidents</Link>
        </Button>
      </div>
    </div>
  );
}
