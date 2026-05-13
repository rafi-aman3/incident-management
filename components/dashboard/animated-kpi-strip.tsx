"use client";

import { InfoTooltip } from "@/components/info-tooltip";
import { AnimatedNumber } from "@/components/ui/animated-number";
import type { TooltipKey } from "@/lib/constants/tooltips";

export type KpiCard = {
  label: string;
  value: string;
  tip: TooltipKey | null;
  hint: string;
  emphasis?: boolean;
};

export function AnimatedKpiStrip({ cards }: { cards: KpiCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c, i) => (
        <AnimatedKpiCard key={c.label} card={c} index={i} />
      ))}
    </div>
  );
}

function AnimatedKpiCard({ card, index }: { card: KpiCard; index: number }) {
  return (
    <div
      className={
        card.emphasis
          ? "dashboard-enter relative overflow-hidden rounded-md border border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 transition hover:border-primary/50 hover:shadow-sm"
          : "dashboard-enter rounded-md border bg-card p-4 transition hover:border-border-strong hover:shadow-sm"
      }
      style={{ ["--d" as string]: `${120 + index * 60}ms` }}
    >
      {card.emphasis && (
        <span className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full bg-primary/15 blur-2xl" aria-hidden />
      )}
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-muted-foreground">
        {card.emphasis && (
          <span className="relative inline-flex h-2 w-2" aria-hidden>
            <span className="animate-pulse-ring absolute inset-0 rounded-full bg-primary/60" />
            <span className="animate-pulse-soft relative h-2 w-2 rounded-full bg-primary" />
          </span>
        )}
        <span>{card.label}</span>
        {card.tip && <InfoTooltip tip={card.tip} />}
      </div>
      <AnimatedNumber
        value={card.value}
        delayMs={index * 60}
        className={
          card.emphasis
            ? "mt-2 block text-2xl font-semibold tabular-nums text-primary"
            : "mt-2 block text-2xl font-semibold tabular-nums"
        }
      />
      <div className="text-xs text-muted-foreground">{card.hint}</div>
    </div>
  );
}
