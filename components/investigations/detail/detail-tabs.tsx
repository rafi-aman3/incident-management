import Link from "next/link";
import { cn } from "@/lib/utils";

export const DETAIL_TABS = [
  { key: "summary", label: "Summary" },
  { key: "why", label: "5-Why" },
  { key: "evidence", label: "Evidence" },
  { key: "findings", label: "Findings" },
  { key: "timeline", label: "Timeline" },
] as const;

export type DetailTabKey = (typeof DETAIL_TABS)[number]["key"];

export function DetailTabs({
  current,
  basePath,
}: {
  current: DetailTabKey;
  basePath: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1 border-b">
      {DETAIL_TABS.map((tab) => {
        const active = current === tab.key;
        const href = tab.key === "summary" ? basePath : `${basePath}?tab=${tab.key}`;
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
          </Link>
        );
      })}
    </div>
  );
}
