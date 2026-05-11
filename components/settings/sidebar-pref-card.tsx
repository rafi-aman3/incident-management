"use client";

import { useState, useTransition } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { HIDEABLE_NAV_ITEMS } from "@/components/app-shell/nav-config";
import { setSidebarHiddenItems } from "@/app/(app)/settings/actions";

export function SidebarPrefCard({
  initialHidden,
}: {
  initialHidden: ReadonlyArray<string>;
}) {
  // HIDEABLE_NAV_ITEMS is imported directly into the client so the LucideIcon
  // function components never cross the RSC boundary (icons are non-
  // serializable React functions). The server page only ships the hidden-
  // href array.
  const hideable = HIDEABLE_NAV_ITEMS;
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  const [isPending, startTransition] = useTransition();

  function persist(next: Set<string>) {
    const items = Array.from(next);
    startTransition(async () => {
      const res = await setSidebarHiddenItems(items);
      if (!res.ok) toast.error(res.error);
    });
  }

  function toggle(href: string, visible: boolean) {
    const next = new Set(hidden);
    if (visible) next.delete(href);
    else next.add(href);
    setHidden(next);
    persist(next);
  }

  function restoreAll() {
    setHidden(new Set());
    persist(new Set());
    toast.success("Showing all sections");
  }

  return (
    <section
      aria-labelledby="settings-sidebar-heading"
      className="space-y-4 rounded-lg border bg-card p-5"
    >
      <div>
        <h2 id="settings-sidebar-heading" className="text-base font-semibold">
          Sidebar
        </h2>
        <p className="text-xs text-muted-foreground">
          Hide sections you don&apos;t use. They stay reachable via direct URL
          and ⌘K search — only the rail link is hidden.
        </p>
      </div>

      <ul className="space-y-1.5">
        {hideable.map((it) => {
          const visible = !hidden.has(it.href);
          const Icon = it.icon;
          const id = `sidebar-toggle-${it.href.replace(/[^a-z0-9]+/gi, "-")}`;
          return (
            <li key={it.href} className="flex items-center justify-between">
              <label htmlFor={id} className="flex flex-1 cursor-pointer items-center gap-2.5 py-1.5 text-sm">
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span>{it.label}</span>
              </label>
              <Checkbox
                id={id}
                checked={visible}
                onCheckedChange={(checked) => toggle(it.href, checked === true)}
                disabled={isPending}
                aria-label={`${visible ? "Hide" : "Show"} ${it.label}`}
              />
            </li>
          );
        })}
      </ul>

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span>
          Dashboard, Report Incident, and Admin are always visible.
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={restoreAll}
          disabled={hidden.size === 0 || isPending}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Restore all
        </Button>
      </div>
    </section>
  );
}
