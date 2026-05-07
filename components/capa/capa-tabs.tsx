import Link from "next/link";
import { cn } from "@/lib/utils";
import { CAPA_TABS, type CapaTabKey } from "@/lib/capa/types";

/**
 * Tab strip for /capa. Built as a `<nav role="tablist">` with each item as
 * `role="tab"` + `aria-current="page"` on the active item — matches Phase 6c
 * `detail-tabs.tsx` semantics so screen readers announce the tab group.
 *
 * Other URL params (?site, ?owner) are preserved across tab switches by
 * piping the current filter shape in via `params`.
 */
export function CapaTabs({
  current,
  counts,
  params,
}: {
  current: CapaTabKey;
  counts: Partial<Record<CapaTabKey, number>>;
  /** Other URL params to preserve when switching tabs (site, owner). */
  params?: { site?: string; owner?: string };
}) {
  const buildHref = (key: CapaTabKey) => {
    const qs = new URLSearchParams();
    if (key !== "mine") qs.set("tab", key);
    if (params?.site) qs.set("site", params.site);
    if (params?.owner) qs.set("owner", params.owner);
    const s = qs.toString();
    return s ? `/capa?${s}` : "/capa";
  };

  return (
    <nav
      role="tablist"
      aria-label="CAPA status tabs"
      className="flex flex-wrap items-center gap-1 border-b"
    >
      {CAPA_TABS.map((tab) => {
        const active = current === tab.key;
        const count = counts[tab.key];
        return (
          <Link
            key={tab.key}
            role="tab"
            aria-current={active ? "page" : undefined}
            href={buildHref(tab.key)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
            {typeof count === "number" && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums",
                  active ? "bg-primary text-primary-foreground" : "bg-muted",
                )}
              >
                {count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
