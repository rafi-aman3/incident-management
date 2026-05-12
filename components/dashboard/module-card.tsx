import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ModuleCardData } from "@/lib/dashboard/org/modules/incidents";

export type { ModuleCardData } from "@/lib/dashboard/org/modules/incidents";

function toneClass(tone: ModuleCardData["secondary"]["tone"]): string {
  switch (tone) {
    case "alert":
      return "text-red-600 dark:text-red-400";
    case "warn":
      return "text-amber-700 dark:text-amber-300";
    default:
      return "text-muted-foreground";
  }
}

export function ModuleCard({
  title,
  tagline,
  Icon,
  data,
  href,
}: {
  title: string;
  tagline: string;
  Icon: LucideIcon;
  data: ModuleCardData;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col rounded-md border bg-card p-4 transition hover:bg-accent"
    >
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-background p-2">
          <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{tagline}</p>
        </div>
        <ArrowRight
          className="mt-1 h-3 w-3 text-muted-foreground transition group-hover:translate-x-0.5"
          aria-hidden
        />
      </div>
      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{data.primary.value}</div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.primary.label}
          </div>
        </div>
        <div>
          <div className={`text-sm font-medium tabular-nums ${toneClass(data.secondary.tone)}`}>
            {data.secondary.value}
          </div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.secondary.label}
          </div>
        </div>
      </div>
    </Link>
  );
}
