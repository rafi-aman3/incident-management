"use client";

/**
 * <AssetTypeaheadField> — combobox-style picker for an asset id, used
 * in the Wizard Step 2 form for property_damage / unsafe_condition
 * incidents. Stores the selected uuid in a hidden input.
 *
 * Filters by the incident's site (passed in by the caller). Shows up to
 * 20 matches, debounced 200ms.
 */

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Boxes, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { searchAssets, type AssetSearchResult } from "@/lib/actions/assets";
import { ASSET_KIND_LABEL, type AssetKind } from "@/lib/documents/types";
import { AssetConditionPill } from "@/components/assets/badges";

export function AssetTypeaheadField({
  name,
  siteId,
  defaultValue,
  defaultLabel,
  label = "Linked asset",
  placeholder = "Search assets at this site",
}: {
  name: string;
  siteId: string | null;
  defaultValue?: string | null;
  defaultLabel?: string | null;
  label?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(
    defaultValue ? { id: defaultValue, label: defaultLabel ?? "Selected asset" } : null,
  );
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Search
  useEffect(() => {
    if (!open) return;
    let active = true;
    const t = setTimeout(async () => {
      setLoading(true);
      const res = await searchAssets({ site_id: siteId, q: q || undefined, limit: 20 });
      if (!active) return;
      if (res.ok) setResults(res.data ?? []);
      else {
        toast.error(res.error);
        setResults([]);
      }
      setLoading(false);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, q, siteId]);

  function clear() {
    setPicked(null);
    setQ("");
  }

  return (
    <div ref={wrapRef} className="relative space-y-1">
      <label className="text-sm font-medium">{label}</label>
      <input type="hidden" name={name} value={picked?.id ?? ""} />

      {picked ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm">
          <Boxes className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{picked.label}</span>
          <button
            type="button"
            onClick={clear}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            placeholder={placeholder}
            className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      {open && !picked && (
        <div className="absolute left-0 right-0 z-10 mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover shadow-md">
          {loading ? (
            <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Searching…
            </div>
          ) : results.length === 0 ? (
            <div className="space-y-1.5 px-3 py-3 text-sm text-muted-foreground">
              <p>No matches.</p>
              <Link
                href="/resources/assets/new"
                className="text-xs text-primary hover:underline"
                onClick={() => setOpen(false)}
              >
                + Register a new asset
              </Link>
            </div>
          ) : (
            <ul className="divide-y">
              {results.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setPicked({
                        id: row.id,
                        label: `${row.ref_code} · ${row.name}`,
                      });
                      setOpen(false);
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                  >
                    <Boxes className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {row.ref_code} · {ASSET_KIND_LABEL[row.kind as AssetKind]}
                        {row.location ? ` · ${row.location}` : ""}
                      </p>
                    </div>
                    <AssetConditionPill condition={row.condition as never} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <p className="text-[11px] text-muted-foreground">
        Optional. Pick the equipment, machine, or station involved so the
        incident links to its registry record.
      </p>
    </div>
  );
}
