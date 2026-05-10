import Link from "next/link";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DetailTab {
  key: "summary" | "why" | "evidence" | "findings" | "ai" | "timeline";
  label: string;
  /** Argus-tagged tabs are hidden when org `argus_enabled` is false or the
   *  caller lacks `argus:use` / `investigation:edit` / status='closed'. */
  argus?: boolean;
}

const BASE_TABS: readonly DetailTab[] = [
  { key: "summary", label: "Summary" },
  { key: "why", label: "5-Why" },
  { key: "evidence", label: "Evidence" },
  { key: "findings", label: "Findings" },
  { key: "ai", label: "AI Investigator", argus: true },
  { key: "timeline", label: "Timeline" },
];

// External callers refer to DETAIL_TABS for the union of valid tab keys
// (used by `/investigations/[id]/page.tsx` to validate ?tab=). Keeping the
// const exported preserves existing imports.
export const DETAIL_TABS = BASE_TABS;

export type DetailTabKey = DetailTab["key"];

const ACCENT = "var(--argus-accent, #00D4FF)";

export function DetailTabs({
  current,
  basePath,
  argusEnabled,
}: {
  current: DetailTabKey;
  basePath: string;
  /**
   * When false, the AI Investigator tab is hidden from the nav. Caller
   * resolves this from `orgs.argus_enabled` AND `argus:use` permission AND
   * `investigation:edit` AND status !== 'closed'.
   */
  argusEnabled: boolean;
}) {
  const visibleTabs = BASE_TABS.filter((t) => !t.argus || argusEnabled);
  return (
    <div role="tablist" className="flex flex-wrap items-center gap-1 border-b">
      {visibleTabs.map((tab) => {
        const active = current === tab.key;
        const href = tab.key === "summary" ? basePath : `${basePath}?tab=${tab.key}`;
        const isArgus = Boolean(tab.argus);
        return (
          <Link
            key={tab.key}
            href={href}
            role="tab"
            aria-selected={active}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              active
                ? isArgus
                  ? "text-foreground"
                  : "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            style={
              isArgus && active
                ? { borderBottomColor: ACCENT }
                : undefined
            }
          >
            {isArgus && (
              <Sparkles
                className="h-3.5 w-3.5"
                style={{ color: ACCENT }}
                aria-hidden
              />
            )}
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
