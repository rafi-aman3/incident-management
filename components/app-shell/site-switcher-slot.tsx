"use client";

import { usePathname } from "next/navigation";
import { SiteSwitcher, type SwitcherSite } from "./site-switcher";

const HIDDEN_PATHS = new Set<string>(["/dashboard"]);

export function SiteSwitcherSlot({
  sites,
  currentSiteId,
  canCreateSite,
}: {
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
}) {
  const pathname = usePathname();
  if (HIDDEN_PATHS.has(pathname ?? "")) return null;
  return (
    <SiteSwitcher sites={sites} currentSiteId={currentSiteId} canCreateSite={canCreateSite} />
  );
}
