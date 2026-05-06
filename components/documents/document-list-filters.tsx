"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  type DocumentType,
} from "@/lib/documents/types";

type SiteOption = { id: string; name: string };

export function DocumentListFilters({ sites }: { sites: SiteOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const currentType = sp.get("type") ?? "";
  const currentSite = sp.get("site") ?? "";
  const currentExpiring = sp.get("expiring") === "1";
  const currentView = sp.get("view") ?? "cards";
  const currentQ = sp.get("q") ?? "";

  const [q, setQ] = useState(currentQ);
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

  const anyActive = currentType || currentSite || currentExpiring || currentQ;

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
          placeholder="Search documents"
          className="h-9 w-64 rounded-md border bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <select
        value={currentType}
        onChange={(e) => setParam("type", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm shadow-sm"
      >
        <option value="">All types</option>
        {DOCUMENT_TYPES.map((t) => (
          <option key={t} value={t}>
            {DOCUMENT_TYPE_LABEL[t as DocumentType]}
          </option>
        ))}
      </select>

      <select
        value={currentSite}
        onChange={(e) => setParam("site", e.target.value || null)}
        className="h-9 rounded-md border bg-background px-2 text-sm shadow-sm"
      >
        <option value="">All scopes</option>
        <option value="org">Org-wide only</option>
        {sites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={() => setParam("expiring", currentExpiring ? null : "1")}
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs ${
          currentExpiring
            ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
            : "bg-background text-muted-foreground hover:text-foreground"
        }`}
      >
        Expiring ≤ 30d
      </button>

      <div className="ml-auto inline-flex items-center gap-1 rounded-md bg-muted p-0.5 text-xs">
        <ViewToggle
          value="cards"
          active={currentView === "cards"}
          onClick={() => setParam("view", null)}
        />
        <ViewToggle
          value="table"
          active={currentView === "table"}
          onClick={() => setParam("view", "table")}
        />
      </div>

      {anyActive && (
        <button
          type="button"
          onClick={clearAll}
          className="inline-flex h-9 items-center gap-1 rounded-md border bg-background px-2 text-xs text-muted-foreground hover:text-foreground"
        >
          <X className="h-3 w-3" /> Clear
        </button>
      )}
    </div>
  );
}

function ViewToggle({
  value,
  active,
  onClick,
}: {
  value: "cards" | "table";
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded px-2 py-1 capitalize ${
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {value}
    </button>
  );
}
