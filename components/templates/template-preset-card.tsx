"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { IndustryChip, FeaturedChip } from "@/components/templates/badges";
import { importPresetToOrg } from "@/app/(app)/templates/actions";
import type { IndustryEnum } from "@/lib/templates/industry-map";

export type PresetCardData = {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  industry: IndustryEnum;
  is_featured: boolean;
  item_count: number;
};

export function TemplatePresetCard({
  preset,
  canImport,
}: {
  preset: PresetCardData;
  canImport: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [imageBroken, setImageBroken] = useState(false);

  const initial = preset.name.charAt(0).toUpperCase();

  function handleImport() {
    if (!canImport) return;
    startTransition(async () => {
      const res = await importPresetToOrg(preset.id);
      // RPC redirects on success; we'll only see this branch on failure
      if (res && res.ok === false) {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="group relative flex flex-col rounded-lg border bg-card p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted">
          {preset.logo_url && !imageBroken ? (
            // Using next/image with unoptimized for demo logos pulled from
            // 3rd-party hosts; not worth wiring up an allowlist for v1.
            <Image
              src={preset.logo_url}
              alt={preset.name}
              width={40}
              height={40}
              unoptimized
              onError={() => setImageBroken(true)}
              className="h-10 w-10 object-cover"
            />
          ) : (
            <span className="text-base font-semibold text-muted-foreground">
              {initial}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="line-clamp-2 text-sm font-semibold leading-snug">
            {preset.name}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <IndustryChip industry={preset.industry} />
            {preset.is_featured && <FeaturedChip />}
          </div>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 min-h-[3.6rem] text-xs text-muted-foreground">
        {preset.description ?? "No description provided."}
      </p>

      <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
        <FileText className="h-3 w-3" />
        <span>{preset.item_count} items</span>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2">
        <a
          href={`/templates/browse/${preset.id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          Preview
        </a>
        <button
          type="button"
          onClick={handleImport}
          disabled={!canImport || pending}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-3 w-3" />
          {pending ? "Importing..." : "Import"}
        </button>
      </div>
    </div>
  );
}
