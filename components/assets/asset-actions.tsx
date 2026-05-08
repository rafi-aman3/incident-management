"use client";

/**
 * <AssetActions> — small inline cluster on the asset detail header:
 *   * "Update condition" — popover with the 5 condition radios; on save
 *     calls updateAssetCondition. When the new condition is `unsafe`,
 *     surfaces a "Report unsafe condition" CTA that pre-fills the Phase 1
 *     incident wizard with this asset.
 *   * "Mark inspected" — sets last_inspected_at = now() with a single click.
 */

import { useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, ChevronDown, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AssetConditionPill } from "@/components/assets/badges";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABEL,
  type AssetCondition,
} from "@/lib/documents/types";
import {
  markAssetInspected,
  updateAssetCondition,
} from "@/lib/actions/assets";

export function AssetActions({
  assetId,
  condition,
  canEdit,
}: {
  assetId: string;
  condition: AssetCondition;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [unsafePrompt, setUnsafePrompt] = useState(false);

  function handleConditionChange(next: AssetCondition) {
    if (next === condition) return;
    startTransition(async () => {
      const res = await updateAssetCondition(assetId, next);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Condition updated to ${ASSET_CONDITION_LABEL[next]}`);
      if (res.data?.unsafe_transition) {
        setUnsafePrompt(true);
      }
    });
  }

  function handleInspected() {
    startTransition(async () => {
      const res = await markAssetInspected(assetId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Marked inspected");
    });
  }

  if (!canEdit) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            aria-label="Change asset condition"
            className="gap-1"
          >
            <span className="text-xs text-muted-foreground">Condition:</span>
            <AssetConditionPill condition={condition} />
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          {ASSET_CONDITIONS.map((c) => (
            <DropdownMenuItem
              key={c}
              onClick={() => handleConditionChange(c)}
              disabled={c === condition}
              className="flex items-center justify-between"
            >
              <AssetConditionPill condition={c} />
              {c === condition && (
                <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleInspected}
        disabled={pending}
      >
        <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark inspected
      </Button>

      {unsafePrompt && (
        <div className="inline-flex items-center gap-2 rounded-md border border-destructive bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>Asset marked unsafe — file an incident report.</span>
          <Link
            href={`/incidents/new/1?asset=${assetId}&type=unsafe_condition`}
            className="font-medium underline hover:no-underline"
          >
            Report
          </Link>
          <button
            type="button"
            onClick={() => setUnsafePrompt(false)}
            className="ml-1 text-destructive/70 hover:text-destructive"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
