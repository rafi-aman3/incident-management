"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  User,
  Palette,
  PanelLeft,
  Building2,
  Sparkles,
  Bell,
  Lock,
  Cookie,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tab = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Hidden from the rail when false (computed server-side and passed in). */
  permitted?: boolean;
};

type Group = {
  heading: string;
  tabs: ReadonlyArray<Tab>;
};

export type SettingsTabAvailability = {
  organization: boolean;
};

/**
 * Phase 17 — IA: 4 groups / 9 tabs.
 * Permission-gated tabs (Organization) get filtered out by the server page
 * when the user lacks the perm; we accept the boolean here so the sidebar
 * matches what the routes will allow.
 */
function buildGroups(avail: SettingsTabAvailability): Group[] {
  return [
    {
      heading: "Account",
      tabs: [
        { href: "/settings/profile", label: "Profile", icon: User },
        { href: "/settings/appearance", label: "Appearance", icon: Palette },
        { href: "/settings/sidebar", label: "Sidebar", icon: PanelLeft },
      ],
    },
    {
      heading: "Workspace",
      tabs: [
        {
          href: "/settings/organization",
          label: "Organization",
          icon: Building2,
          permitted: avail.organization,
        },
      ],
    },
    {
      heading: "Preferences",
      tabs: [
        { href: "/settings/argus", label: "Argus", icon: Sparkles },
        { href: "/settings/notifications", label: "Notifications", icon: Bell },
      ],
    },
    {
      heading: "Security",
      tabs: [
        { href: "/settings/security", label: "Security", icon: Lock },
        { href: "/settings/cookies", label: "Cookies", icon: Cookie },
        {
          href: "/settings/delete-account",
          label: "Delete account",
          icon: Trash2,
        },
      ],
    },
  ];
}

export function SettingsSidebar({
  availability,
}: {
  availability: SettingsTabAvailability;
}) {
  const pathname = usePathname();
  const groups = buildGroups(availability);

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden lg:block lg:w-56 lg:shrink-0">
        <nav aria-label="Settings sections" className="space-y-5">
          {groups.map((g) => {
            const visible = g.tabs.filter((t) => t.permitted !== false);
            if (visible.length === 0) return null;
            return (
              <div key={g.heading}>
                <h3 className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {g.heading}
                </h3>
                <ul className="space-y-0.5">
                  {visible.map((t) => {
                    const active =
                      pathname === t.href || pathname?.startsWith(t.href + "/");
                    const Icon = t.icon;
                    return (
                      <li key={t.href}>
                        <Link
                          href={t.href}
                          className={cn(
                            "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors",
                            active
                              ? "bg-accent font-medium text-accent-foreground"
                              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                          )}
                        >
                          <Icon className="h-4 w-4 shrink-0" aria-hidden />
                          <span>{t.label}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Mobile/tablet: top-of-content native select. Per the inline-collapsibles-
          in-Sheet rule, we avoid a second drawer here. */}
      <div className="mb-4 lg:hidden">
        <label htmlFor="settings-section" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-section"
          className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          value={pathname ?? "/settings/profile"}
          onChange={(e) => {
            window.location.href = e.target.value;
          }}
        >
          {groups.map((g) => {
            const visible = g.tabs.filter((t) => t.permitted !== false);
            if (visible.length === 0) return null;
            return (
              <optgroup key={g.heading} label={g.heading}>
                {visible.map((t) => (
                  <option key={t.href} value={t.href}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            );
          })}
        </select>
      </div>
    </>
  );
}
