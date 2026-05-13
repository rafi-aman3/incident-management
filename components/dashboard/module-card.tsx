import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/ui/animated-number";
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
      className="group relative flex flex-col overflow-hidden rounded-md border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md motion-reduce:hover:translate-y-0"
    >
      {/* Top accent rail — invisible at rest, fades in on hover */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-accent-cyan to-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        aria-hidden
      />
      {/* Soft brand glow that lifts the card on hover */}
      <span
        className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/10 opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start gap-3">
        <div className="rounded-md border bg-background p-2 transition-colors duration-300 group-hover:border-primary/30 group-hover:bg-primary/5">
          <Icon className="h-4 w-4 text-muted-foreground transition-colors duration-300 group-hover:text-primary" aria-hidden />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold">{title}</h3>
          <p className="text-xs text-muted-foreground">{tagline}</p>
        </div>
        <ArrowRight
          className="mt-1 h-3 w-3 text-muted-foreground transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary"
          aria-hidden
        />
      </div>
      <div className="mt-4 flex items-baseline gap-4">
        <div>
          <AnimatedNumber
            value={data.primary.value}
            className="block text-2xl font-semibold tabular-nums"
          />
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.primary.label}
          </div>
        </div>
        <div>
          <AnimatedNumber
            value={data.secondary.value}
            delayMs={120}
            className={`block text-sm font-medium tabular-nums ${toneClass(data.secondary.tone)}`}
          />
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {data.secondary.label}
          </div>
        </div>
      </div>
    </Link>
  );
}
