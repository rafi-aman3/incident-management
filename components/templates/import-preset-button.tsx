"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { importPresetToOrg } from "@/app/(app)/templates/actions";

export function ImportPresetButton({ presetId }: { presetId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        startTransition(async () => {
          const res = await importPresetToOrg(presetId);
          if (res && res.ok === false) toast.error(res.error);
        })
      }
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <Download className="h-4 w-4" />
      {pending ? "Importing..." : "Import to my org"}
    </button>
  );
}
