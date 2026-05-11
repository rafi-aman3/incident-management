"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const THEME_OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const;

export function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  // next-themes recommends gating the active-theme readback behind a
  // mounted flag so SSR markup matches the first client render. The
  // setState-in-effect rule below is a known false-positive for this
  // exact pattern — see https://github.com/pacocoursey/next-themes#avoid-hydration-mismatch.
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  return (
    <section
      aria-labelledby="settings-appearance-heading"
      className="rounded-lg border bg-card p-5"
    >
      <div className="mb-4">
        <h2 id="settings-appearance-heading" className="text-base font-semibold">
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground">
          Theme is per-device — your choice here doesn&apos;t affect other
          browsers you&apos;ve signed in on.
        </p>
      </div>

      <div
        role="radiogroup"
        aria-label="Theme preference"
        className="inline-flex flex-wrap gap-1 rounded-md border bg-muted/30 p-1"
      >
        {THEME_OPTIONS.map(({ value, label, Icon }) => {
          const active = mounted && theme === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
