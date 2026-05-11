import {
  Flame,
  Bomb,
  Beaker,
  Skull,
  AlertTriangle,
  Heart,
  Leaf,
  Wind,
  CircleDot,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { GHS_PICTOGRAM_NAME, type GhsPictogramCode } from "@/lib/sds/types";

const ICON_BY_CODE: Record<GhsPictogramCode, typeof Flame> = {
  GHS01: Bomb,
  GHS02: Flame,
  GHS03: CircleDot,
  GHS04: Wind,
  GHS05: Beaker,
  GHS06: Skull,
  GHS07: AlertTriangle,
  GHS08: Heart,
  GHS09: Leaf,
};

/**
 * Phase 16 demo GHS pictogram. Standard GHS is a red-bordered diamond
 * (rotated square) with a black symbol on white. We approximate that with
 * a lucide icon in a red-bordered, rotated square. Demo-grade — the real
 * pictograms ship as part of the v2.5 / real-API phase that swaps the
 * dummy catalog for an API call.
 */
export function GhsPictogram({
  code,
  size = 24,
  className,
}: {
  code: GhsPictogramCode;
  size?: number;
  className?: string;
}) {
  const Icon = ICON_BY_CODE[code];
  const name = GHS_PICTOGRAM_NAME[code];
  const px = size;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          aria-label={`${code} ${name}`}
          className={cn(
            "relative inline-grid place-items-center",
            className,
          )}
          style={{ width: px, height: px }}
        >
          <span
            aria-hidden
            className="absolute inset-0 rotate-45 rounded-sm border-2 border-red-600 bg-white"
          />
          <Icon
            aria-hidden
            className="relative text-foreground"
            style={{ width: px * 0.45, height: px * 0.45 }}
          />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top">{code} — {name}</TooltipContent>
    </Tooltip>
  );
}
