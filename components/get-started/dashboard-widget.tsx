import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChecklistRowState } from "@/lib/get-started/state";

export function GetStartedWidget({
  rows,
  doneCount,
  totalCount,
}: {
  rows: ChecklistRowState[];
  doneCount: number;
  totalCount: number;
}) {
  const pct = totalCount === 0 ? 100 : Math.round((doneCount / totalCount) * 100);
  return (
    <section
      aria-labelledby="get-started-heading"
      className="rounded-lg border bg-card p-4 shadow-sm"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="get-started-heading" className="text-sm font-semibold">
          Get started · {doneCount} of {totalCount} done
        </h2>
        <Link
          href="/get-started"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          View all <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
          aria-hidden
        />
      </div>

      <ul className="mt-3 flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.item.id}>
            <Link
              href={row.item.ctaHref!}
              className="group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent/40"
            >
              <span aria-hidden className="h-3.5 w-3.5 rounded-full border-2 border-border" />
              <span className="flex-1 truncate font-medium">{row.item.label}</span>
              <span className="text-primary opacity-0 transition-opacity group-hover:opacity-100">
                {row.item.ctaLabel || "Open"} →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
