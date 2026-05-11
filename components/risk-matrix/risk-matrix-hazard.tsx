"use client";

/**
 * Hazard-side 5×5 picker. Same matrix as the incident wizard but keyed by
 * string-named Likelihood/Consequence so it can be wired into Phase 14
 * forms without converting to integer coords first.
 *
 * Shares the canonical lookup with the incident severity engine via
 * lib/risk/matrix.ts (see SPEC §HZ.3 build note).
 */

import { cn } from "@/lib/utils";
import {
  computeRisk,
  LIKELIHOOD_LABELS,
  CONSEQUENCE_LABELS,
} from "@/lib/risk/matrix";
import {
  LIKELIHOOD_VALUES,
  CONSEQUENCE_VALUES,
  type Likelihood,
  type Consequence,
} from "@/lib/risk/types";

const SEVERITY_COLOR: Record<string, string> = {
  S1: "bg-sev-1 text-white",
  S2: "bg-sev-2 text-white",
  S3: "bg-sev-3 text-foreground",
  S4: "bg-sev-4 text-white",
  S5: "bg-sev-5 text-foreground",
};

type Props = {
  value: { likelihood: Likelihood | null; consequence: Consequence | null };
  onChange: (next: { likelihood: Likelihood; consequence: Consequence }) => void;
};

export function RiskMatrixHazard({ value, onChange }: Props) {
  // Render likelihood top→down: Almost Certain → Rare
  const rows = [...LIKELIHOOD_VALUES].reverse();

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-1 text-xs">
        <div />
        {CONSEQUENCE_VALUES.map((c) => (
          <div
            key={c}
            className="px-1 py-1 text-center font-medium text-muted-foreground"
          >
            {CONSEQUENCE_LABELS[c]}
          </div>
        ))}

        {rows.map((likelihood) => (
          <RowFragment
            key={likelihood}
            likelihood={likelihood}
            value={value}
            onChange={onChange}
          />
        ))}
      </div>
    </div>
  );
}

function RowFragment({
  likelihood,
  value,
  onChange,
}: {
  likelihood: Likelihood;
  value: Props["value"];
  onChange: Props["onChange"];
}) {
  return (
    <>
      <div className="flex items-center px-1 py-1 text-right font-medium text-muted-foreground">
        {LIKELIHOOD_LABELS[likelihood]}
      </div>
      {CONSEQUENCE_VALUES.map((consequence) => {
        const severity = computeRisk(likelihood, consequence);
        const active =
          value.likelihood === likelihood && value.consequence === consequence;
        return (
          <button
            key={consequence}
            type="button"
            onClick={() => onChange({ likelihood, consequence })}
            className={cn(
              "grid h-12 place-items-center rounded font-bold transition",
              SEVERITY_COLOR[severity] ?? "bg-muted",
              active
                ? "ring-2 ring-offset-1 ring-foreground"
                : "opacity-80 hover:opacity-100",
            )}
            aria-label={`${LIKELIHOOD_LABELS[likelihood]} × ${CONSEQUENCE_LABELS[consequence]} = ${severity}`}
            aria-pressed={active}
          >
            {severity}
          </button>
        );
      })}
    </>
  );
}
