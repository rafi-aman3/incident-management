import Link from "next/link";
import { cn } from "@/lib/utils";
import { CAPA_TABS, type CapaTabKey } from "@/lib/capa/types";

export function CapaTabs({
  current,
  counts,
}: {
  current: CapaTabKey;
  counts: Partial<Record<CapaTabKey, number>>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b">
      {CAPA_TABS.map((tab) => {
        const active = current === tab.key;
        const href = tab.key === "mine" ? "/capa" : `/capa?tab=${tab.key}`;
        const count = counts[tab.key];
        return (
          <Link
            key={tab.key}
            href={href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {tab.label}
            {typeof count === "number" && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-primary text-primary-foreground" : "bg-muted"
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
