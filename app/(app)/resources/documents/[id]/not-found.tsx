import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DocumentNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Document not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The document you&apos;re looking for doesn&apos;t exist, has been
        archived, or isn&apos;t accessible from your current site.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/resources/documents">Back to documents</Link>
        </Button>
      </div>
    </div>
  );
}
