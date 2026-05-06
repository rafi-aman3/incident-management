import { cn } from "@/lib/utils";
import {
  ASSET_CONDITION_LABEL,
  ASSET_CONDITION_TONE,
  ASSET_KIND_LABEL,
  type AssetCondition,
  type AssetKind,
  type AssetStatus,
} from "@/lib/documents/types";

export function AssetConditionPill({
  condition,
  className,
}: {
  condition: AssetCondition;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        ASSET_CONDITION_TONE[condition],
        className,
      )}
      data-condition={condition}
    >
      {ASSET_CONDITION_LABEL[condition]}
    </span>
  );
}

export function AssetKindChip({ kind }: { kind: AssetKind }) {
  return (
    <span className="inline-flex items-center rounded-md border bg-background px-2 py-0.5 text-[11px] text-muted-foreground">
      {ASSET_KIND_LABEL[kind]}
    </span>
  );
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  if (status === "active") return null;
  return (
    <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
      Retired
    </span>
  );
}
