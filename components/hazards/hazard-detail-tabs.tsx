import Link from "next/link";
import { cn } from "@/lib/utils";

export const HAZARD_TABS = ["overview", "assessments", "controls", "incidents"] as const;
export type HazardTabKey = (typeof HAZARD_TABS)[number];

const TAB_LABEL: Record<HazardTabKey, string> = {
  overview: "Overview",
  assessments: "Assessments",
  controls: "Controls",
  incidents: "Linked Incidents",
};

export function HazardDetailTabs({
  current,
  basePath,
}: {
  current: HazardTabKey;
  basePath: string;
}) {
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1 border-b">
      {HAZARD_TABS.map((tab) => {
        const active = current === tab;
        const href = tab === "overview" ? basePath : `${basePath}?tab=${tab}`;
        return (
          <Link
            key={tab}
            href={href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {TAB_LABEL[tab]}
          </Link>
        );
      })}
    </div>
  );
}
