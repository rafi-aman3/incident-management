"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setArgusPanelDefault } from "@/app/(app)/settings/actions";

const TOKEN_FORMATTER = new Intl.NumberFormat("en-US", { notation: "compact" });

export function ArgusPrefsCard({
  orgEnabled,
  tokensUsedToday,
  tokensBudget,
  initialPanelDefault,
}: {
  orgEnabled: boolean;
  tokensUsedToday: number;
  tokensBudget: number;
  initialPanelDefault: boolean;
}) {
  const [panelDefault, setPanelDefault] = useState(initialPanelDefault);
  const [isPending, startTransition] = useTransition();

  function onToggle(next: boolean) {
    setPanelDefault(next);
    startTransition(async () => {
      const res = await setArgusPanelDefault(next);
      if (!res.ok) {
        setPanelDefault(!next);
        toast.error(res.error);
      } else {
        toast.success(next ? "Argus panel will open by default" : "Argus panel will start closed");
      }
    });
  }

  const remaining = Math.max(0, tokensBudget - tokensUsedToday);

  return (
    <section
      aria-labelledby="settings-argus-heading"
      className="space-y-5 rounded-lg border bg-card p-5"
    >
      <div className="flex items-start gap-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </div>
        <div className="flex-1">
          <h2 id="settings-argus-heading" className="text-base font-semibold">
            Argus
          </h2>
          <p className="text-xs text-muted-foreground">
            The AI co-pilot. Argus suggests; you decide.
          </p>
        </div>
      </div>

      <div className="space-y-2 rounded-md border bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium">Workspace status</span>
          <span
            className={
              orgEnabled
                ? "rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-success"
                : "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            }
          >
            {orgEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        {orgEnabled ? (
          <p className="text-xs text-muted-foreground">
            Daily usage: {TOKEN_FORMATTER.format(tokensUsedToday)} /{" "}
            {TOKEN_FORMATTER.format(tokensBudget)} tokens ·{" "}
            <span className="text-foreground/80">
              {TOKEN_FORMATTER.format(remaining)} remaining
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Argus is turned off for this workspace. Contact support to enable.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="argus-panel-default" className="text-sm font-medium">
            Open Argus side panel automatically
          </Label>
          <p className="text-xs text-muted-foreground">
            When on, the side panel opens whenever you navigate.
          </p>
        </div>
        <Switch
          id="argus-panel-default"
          checked={panelDefault}
          onCheckedChange={onToggle}
          disabled={isPending || !orgEnabled}
        />
      </div>
    </section>
  );
}
