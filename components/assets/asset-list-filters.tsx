"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABEL,
  ASSET_KINDS,
  ASSET_KIND_LABEL,
  type AssetCondition,
  type AssetKind,
} from "@/lib/documents/types";
import { cn } from "@/lib/utils";

type SiteOption = { id: string; name: string };

export function AssetListFilters({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentSite = sp.get("site") ?? "";
  const currentKind = sp.get("kind") ?? "";
  const currentCondition = sp.get("condition") ?? "";
  const currentQ = sp.get("q") ?? "";

  const [q, setQ] = useState(currentQ);
  // Stay in sync when external nav happens (e.g. clicking a chip elsewhere)
  useEffect(() => {
    if (q !== currentQ) setQ(currentQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentQ]);

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (!value) params.delete(key);
    else params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function submitQ() {
    setParam("q", q.trim() || null);
  }

  function clearAll() {
    router.push(pathname);
    setQ("");
  }

  const anyActive = currentSite || currentKind || currentCondition || currentQ;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submitQ()}
          onBlur={submitQ}
          placeholder="Search assets"
          className="h-9 w-64 rounded-md border bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <select
        value={currentSite}
        onChange={(e) => setParam("site", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm shadow-sm"
      >
        <option value="">All sites</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <select
        value={currentKind}
        onChange={(e) => setParam("kind", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm shadow-sm"
      >
        <option value="">All kinds</option>
        {ASSET_KINDS.map((k) => (
          <option key={k} value={k}>
            {ASSET_KIND_LABEL[k as AssetKind]}
          </option>
        ))}
      </select>

      <select
        value={currentCondition}
        onChange={(e) => setParam("condition", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm shadow-sm"
      >
        <option value="">All conditions</option>
        {ASSET_CONDITIONS.map((c) => (
          <option key={c} value={c}>
            {ASSET_CONDITION_LABEL[c as AssetCondition]}
          </option>
        ))}
      </select>

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className={cn(
            "inline-flex h-9 items-center gap-1 rounded-md border bg-background px-2 text-xs text-muted-foreground hover:text-foreground",
          )}
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}
