import Link from "next/link";
import { FileSearch } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TemplateNotFound() {
  return (
    <div className="rounded-lg border border-dashed p-8 text-center">
      <FileSearch className="mx-auto h-8 w-8 text-muted-foreground" />
      <h2 className="mt-3 text-lg font-semibold">Template not found</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        The template you&apos;re looking for doesn&apos;t exist or isn&apos;t
        accessible from your current org.
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <Button asChild variant="default">
          <Link href="/templates">Back to templates</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/templates/browse">Browse system presets</Link>
        </Button>
      </div>
    </div>
  );
}
