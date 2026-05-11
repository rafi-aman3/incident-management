"use client";

import type { CSSProperties } from "react";
import { ReactNode, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./app-sidebar";
import { setSidebarPinned } from "./sidebar-actions";
import type { SwitcherSite } from "./site-switcher";

const HOVER_ENTER_MS = 150;

export function SidebarShell({
  defaultPinned,
  allowedHrefs,
  userLabel,
  roleLabel,
  sites,
  currentSiteId,
  canCreateSite,
  getStartedCounts,
  topbar,
  banner,
  children,
}: {
  defaultPinned: boolean;
  allowedHrefs: ReadonlyArray<string>;
  userLabel: string;
  roleLabel: string;
  sites: SwitcherSite[];
  currentSiteId: string | null;
  canCreateSite: boolean;
  getStartedCounts: { done: number; total: number } | null;
  topbar: ReactNode;
  banner: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [pinned, setPinned] = useState(defaultPinned);
  const [hovered, setHovered] = useState(false);
  const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  const clearEnterTimer = () => {
    if (enterTimer.current) {
      clearTimeout(enterTimer.current);
      enterTimer.current = null;
    }
  };

  const handleMouseEnter = useCallback(() => {
    if (pinned) return;
    clearEnterTimer();
    enterTimer.current = setTimeout(() => setHovered(true), HOVER_ENTER_MS);
  }, [pinned]);

  const handleMouseLeave = useCallback(() => {
    clearEnterTimer();
    setHovered(false);
  }, []);

  const togglePin = useCallback(() => {
    const next = !pinned;
    setPinned(next);
    setHovered(false);
    clearEnterTimer();
    startTransition(() => {
      void setSidebarPinned(next).then(() => router.refresh());
    });
  }, [pinned, router]);

  useEffect(() => {
    if (pinned || !hovered) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHovered(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pinned, hovered]);

  useEffect(() => () => clearEnterTimer(), []);

  // When unpinned, force the sidebar gap to stay at icon-width regardless of
  // open state. The fixed-positioned container can then expand to full width
  // (overlay) without shifting layout. Shadow is only applied to the
  // expanded overlay state to signal "drawer hovering above content".
  // z-50 puts the container above the sticky topbar (z-30) and regulatory
  // banner (z-20) so the overlay drawer fully covers them when expanded.
  const overlayClass = pinned
    ? ""
    : "[&_[data-slot=sidebar-gap]]:w-(--sidebar-width-icon)! [&_[data-slot=sidebar-container]]:z-50! [&_[data-slot=sidebar][data-state=expanded]_[data-slot=sidebar-container]]:shadow-xl";

  return (
    <SidebarProvider
      open={pinned || hovered}
      className={overlayClass}
      style={{ "--sidebar-width-icon": "3.75rem" } as CSSProperties}
    >
      <AppSidebar
        allowedHrefs={allowedHrefs}
        userLabel={userLabel}
        roleLabel={roleLabel}
        pinned={pinned}
        onPinToggle={togglePin}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sites={sites}
        currentSiteId={currentSiteId}
        canCreateSite={canCreateSite}
        getStartedCounts={getStartedCounts}
      />
      <SidebarInset>
        {topbar}
        {banner}
        <main className="flex-1 px-6 py-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
