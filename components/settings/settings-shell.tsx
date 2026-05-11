import type { ReactNode } from "react";
import {
  SettingsSidebar,
  type SettingsTabAvailability,
} from "./settings-sidebar";

/**
 * Phase 17 — layout shell for /settings/*.
 *
 * Server component: receives the tab availability map (computed from
 * permissions on the parent layout) and the active child. The sidebar
 * filters its tabs against the same map so non-admins never see the
 * Organization link.
 */
export function SettingsShell({
  availability,
  children,
}: {
  availability: SettingsTabAvailability;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Your account, your workspace, and how this app works for you.
        </p>
      </header>

      <div className="flex flex-col gap-6 lg:flex-row">
        <SettingsSidebar availability={availability} />
        <section className="flex-1 min-w-0">{children}</section>
      </div>
    </div>
  );
}
