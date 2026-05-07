import Link from "next/link";
import { cn } from "@/lib/utils";

export const SITE_DETAIL_TABS = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "hours", label: "Annual hours" },
  { key: "setup", label: "Setup" },
] as const;

export type SiteDetailTabKey = (typeof SITE_DETAIL_TABS)[number]["key"];

export function SiteDetailTabs({
  current,
  basePath,
}: {
  current: SiteDetailTabKey;
  basePath: string;
}) {
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1 border-b">
      {SITE_DETAIL_TABS.map((tab) => {
        const active = current === tab.key;
        const href = tab.key === "overview" ? basePath : `${basePath}?tab=${tab.key}`;
        return (
          <Link
            key={tab.key}
            href={href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
