"use client";

import { cn } from "@/lib/utils";
import {
  computeSeverity,
  LIKELIHOOD_LABELS,
  CONSEQUENCE_LABELS,
  type MatrixCoord,
} from "@/lib/workflow/severity";

const SEVERITY_COLOR: Record<string, string> = {
  S1: "bg-sev-1 text-white",
  S2: "bg-sev-2 text-white",
  S3: "bg-sev-3 text-foreground",
  S4: "bg-sev-4 text-white",
  S5: "bg-sev-5 text-foreground",
};

const SEVERITY_BAND_LABEL: Record<string, string> = {
  S1: "Critical",
  S2: "High",
  S3: "Medium",
  S4: "Low",
  S5: "Insignificant",
};

type Props = {
  value: { likelihood: MatrixCoord | null; consequence: MatrixCoord | null };
  onChange: (next: { likelihood: MatrixCoord; consequence: MatrixCoord }) => void;
};

export function RiskMatrix({ value, onChange }: Props) {
  const cells: { l: MatrixCoord; c: MatrixCoord }[] = [];
  for (let l = 5; l >= 1; l--) {
    for (let c = 1; c <= 5; c++) {
      cells.push({ l: l as MatrixCoord, c: c as MatrixCoord });
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[120px_repeat(5,1fr)] gap-1 text-xs">
        {/* Header row: consequence labels */}
        <div />
        {CONSEQUENCE_LABELS.map((label) => (
          <div key={label} className="px-1 py-1 text-center font-medium text-muted-foreground">
            {label}
          </div>
        ))}

        {/* Matrix rows: 5 (Almost Certain) → 1 (Rare) */}
        {LIKELIHOOD_LABELS.slice().reverse().map((row, rowIdx) => {
          const likelihood = (5 - rowIdx) as MatrixCoord;
          return (
            <RowFragment
              key={likelihood}
              likelihood={likelihood}
              rowLabel={row}
              value={value}
              onChange={onChange}
            />
          );
        })}
      </div>

      {value.likelihood && value.consequence && (
        <Selection likelihood={value.likelihood} consequence={value.consequence} />
      )}
    </div>
  );
}

function RowFragment({
  likelihood,
  rowLabel,
  value,
  onChange,
}: {
  likelihood: MatrixCoord;
  rowLabel: string;
  value: Props["value"];
  onChange: Props["onChange"];
}) {
  return (
    <>
      <div className="px-1 py-2 text-right font-medium text-muted-foreground">{rowLabel}</div>
      {[1, 2, 3, 4, 5].map((c) => {
        const consequence = c as MatrixCoord;
        const sev = computeSeverity({ likelihood, consequence });
        const isSelected =
          value.likelihood === likelihood && value.consequence === consequence;
        return (
          <button
            key={c}
            type="button"
            onClick={() => onChange({ likelihood, consequence })}
            aria-label={`Likelihood ${rowLabel}, consequence ${CONSEQUENCE_LABELS[c - 1]}`}
            aria-pressed={isSelected}
            className={cn(
              "h-12 rounded-md text-xs font-semibold transition-all",
              SEVERITY_COLOR[sev],
              isSelected && "ring-2 ring-ring ring-offset-2"
            )}
          >
            {sev} <span className="opacity-70">· {SEVERITY_BAND_LABEL[sev]}</span>
          </button>
        );
      })}
    </>
  );
}

function Selection({ likelihood, consequence }: { likelihood: MatrixCoord; consequence: MatrixCoord }) {
  const sev = computeSeverity({ likelihood, consequence });
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-sm">
      Selected: <strong>{LIKELIHOOD_LABELS[likelihood - 1]}</strong> ×{" "}
      <strong>{CONSEQUENCE_LABELS[consequence - 1]}</strong> →{" "}
      <span className="font-semibold">
        {sev} ({SEVERITY_BAND_LABEL[sev]})
      </span>
    </p>
  );
}
