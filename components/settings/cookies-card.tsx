"use client";

import { RotateCcw, Cookie } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearLocalData } from "@/lib/settings/clear-local-data";

export function CookiesCard() {
  return (
    <section
      aria-labelledby="settings-cookies-heading"
      className="space-y-5 rounded-lg border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
          <Cookie className="h-4 w-4" aria-hidden />
        </div>
        <div>
          <h2 id="settings-cookies-heading" className="text-base font-semibold">
            Cookies
          </h2>
          <p className="text-xs text-muted-foreground">
            Manage how this app stores preferences in your browser.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden />
          <span className="text-sm font-medium">All cookies accepted</span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            clearLocalData();
            toast.success("Cookie preferences reset");
          }}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Reset cookie preferences
        </Button>
      </div>
    </section>
  );
}
