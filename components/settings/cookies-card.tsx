"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { clearLocalData } from "@/lib/settings/clear-local-data";

type Row = {
  name: string;
  purpose: string;
  type: "Essential" | "Non-essential";
};

const ROWS: ReadonlyArray<Row> = [
  {
    name: "sb-<project>-auth-token",
    purpose: "Keeps you signed in across page loads.",
    type: "Essential",
  },
  {
    name: "theme (localStorage)",
    purpose: "Remembers your Light / Dark / System choice.",
    type: "Essential",
  },
  {
    name: "argus.search.recent (localStorage)",
    purpose: "Your recent ⌘K searches (up to 5).",
    type: "Non-essential",
  },
  {
    name: "sidebar_pinned (cookie)",
    purpose: "Remembers whether you pinned the sidebar.",
    type: "Non-essential",
  },
];

export function CookiesCard() {
  return (
    <section
      aria-labelledby="settings-cookies-heading"
      className="space-y-5 rounded-lg border bg-card p-5"
    >
      <div>
        <h2 id="settings-cookies-heading" className="text-base font-semibold">
          Cookies & local data
        </h2>
        <p className="text-xs text-muted-foreground">
          This app uses essential cookies for authentication and your theme
          preference. We don&apos;t use analytics, marketing, or third-party
          trackers.
        </p>
      </div>

      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 text-left text-xs">
            <tr>
              <th className="px-3 py-2 font-medium">Cookie / storage</th>
              <th className="px-3 py-2 font-medium">Purpose</th>
              <th className="px-3 py-2 font-medium">Type</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {ROWS.map((r) => (
              <tr key={r.name}>
                <td className="px-3 py-2 font-mono text-xs">{r.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.purpose}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={
                      r.type === "Essential"
                        ? "rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
                        : "rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning"
                    }
                  >
                    {r.type}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <div>
          <p className="text-sm font-medium">Clear non-essential local data</p>
          <p className="text-xs text-muted-foreground">
            Wipes recent searches and your sidebar-pinned preference. You stay
            signed in.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            clearLocalData();
            toast.success("Non-essential local data cleared");
          }}
        >
          <Trash2 className="mr-1.5 h-4 w-4" aria-hidden />
          Clear
        </Button>
      </div>
    </section>
  );
}
