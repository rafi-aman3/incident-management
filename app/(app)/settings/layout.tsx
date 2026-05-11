import type { ReactNode } from "react";
import { SettingsShell } from "@/components/settings/settings-shell";
import { orgCan } from "@/lib/auth/orgCan";

export default async function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Compute permission gates once for the shell so the sidebar filter and
  // page-level checks stay in sync.
  const organization = await orgCan("org:configure");

  return (
    <SettingsShell availability={{ organization }}>{children}</SettingsShell>
  );
}
