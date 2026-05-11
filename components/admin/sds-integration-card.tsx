import Link from "next/link";
import { ExternalLink, Beaker, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

const FALLBACK_URL = "https://sds.placeholder.example";

export function SdsIntegrationCard() {
  const url = process.env.NEXT_PUBLIC_SDS_MANAGER_URL || FALLBACK_URL;
  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
            <Beaker className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">SDS Manager</h3>
            <p className="text-xs text-muted-foreground">External · Chemical Safety Data Sheets</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Active
        </span>
      </div>
      <p className="mt-3 text-sm text-muted-foreground">
        SDS Manager is the company chemical-inventory and Safety Data Sheet platform.
        Import chemicals from your SDS Manager catalog to seed hazards in the register —
        each H-statement becomes a candidate with pre-mapped controls ready for review.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open SDS Manager
          </a>
        </Button>
        <Button asChild size="sm">
          <Link href="/hazards/candidates?action=import-sds">
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Import chemicals
          </Link>
        </Button>
      </div>
    </div>
  );
}
