"use client";

/**
 * <AssetTypeaheadField> — combobox-style picker for an asset id, used
 * in the Wizard Step 2 form for property_damage / unsafe_condition
 * incidents. Stores the selected uuid in a hidden input.
 *
 * Filters by the incident's site (passed in by the caller). Shows up to
 * 20 matches, debounced 200ms.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Boxes, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { searchAssets, type AssetSearchResult, createAssetInline } from "@/lib/actions/assets";
import {
  ASSET_CONDITIONS,
  ASSET_CONDITION_LABEL,
  ASSET_KINDS,
  ASSET_KIND_LABEL,
  type AssetKind,
} from "@/lib/documents/types";
import { AssetConditionPill } from "@/components/assets/badges";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Picked = { id: string; label: string };

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
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(
    defaultValue ? { id: defaultValue, label: defaultLabel ?? "Selected asset" } : null,
  );
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on outside click — but not when the inline-create dialog is open
  // (radix renders the dialog in a portal, so its clicks land outside wrapRef).
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (createOpen) return;
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [createOpen]);

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
      setActiveIndex(-1);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, q, siteId]);

  function clear() {
    setPicked(null);
    setQ("");
    setActiveIndex(-1);
  }

  function handlePick(row: AssetSearchResult) {
    setPicked({ id: row.id, label: `${row.ref_code} · ${row.name}` });
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (results.length === 0) return;
      setActiveIndex((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && activeIndex < results.length) {
        e.preventDefault();
        handlePick(results[activeIndex]);
      }
    }
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
            aria-label="Clear linked asset"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={inputRef}
            type="search"
            value={q}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            role="combobox"
            aria-expanded={open}
            aria-controls={listboxId}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-activedescendant={
              activeIndex >= 0 ? `${listboxId}-opt-${activeIndex}` : undefined
            }
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
            <div className="space-y-2 px-3 py-3 text-sm text-muted-foreground">
              <p>No matches.</p>
              {siteId && (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" /> Register a new asset
                </button>
              )}
            </div>
          ) : (
            <ul id={listboxId} role="listbox" aria-label="Matching assets" className="divide-y">
              {results.map((row, idx) => {
                const optId = `${listboxId}-opt-${idx}`;
                const isActive = idx === activeIndex;
                return (
                  <li key={row.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      id={optId}
                      aria-selected={isActive}
                      onClick={() => handlePick(row)}
                      onMouseEnter={() => setActiveIndex(idx)}
                      className={
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm " +
                        (isActive ? "bg-accent" : "hover:bg-accent")
                      }
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
                );
              })}
              {siteId && (
                <li role="presentation" className="bg-muted/30">
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-primary hover:bg-accent"
                  >
                    <Plus className="h-3 w-3" /> Register a new asset
                  </button>
                </li>
              )}
            </ul>
          )}
        </div>
      )}

      {siteId && (
        <InlineAssetCreateDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          siteId={siteId}
          onCreated={(asset) => {
            setPicked({ id: asset.id, label: `${asset.ref_code} · ${asset.name}` });
            setOpen(false);
            setCreateOpen(false);
            // Restore focus to the hidden input's parent so the wizard is
            // clearly in focus after the dialog closes.
            setTimeout(() => inputRef.current?.blur(), 0);
          }}
        />
      )}

      <p className="text-[11px] text-muted-foreground">
        Optional. Pick the equipment, machine, or station involved so the
        incident links to its registry record.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline-create dialog — slimmed asset form (name / kind / location /
// condition); site is fixed to the wizard's selected site. On success
// hands the new asset back via onCreated so the typeahead auto-selects it.
// ---------------------------------------------------------------------------
function InlineAssetCreateDialog({
  open,
  onOpenChange,
  siteId,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  siteId: string;
  onCreated: (asset: { id: string; ref_code: string; name: string }) => void;
}) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AssetKind>("other");
  const [location, setLocation] = useState("");
  const [condition, setCondition] = useState("good");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Reset state whenever the dialog opens so a re-open after Cancel
  // shows a clean form rather than the previously-typed values.
  useEffect(() => {
    if (open) {
      setName("");
      setKind("other");
      setLocation("");
      setCondition("good");
      setFieldErrors({});
      setPending(false);
    }
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});
    setPending(true);
    const res = await createAssetInline({
      name: name.trim(),
      kind,
      site_id: siteId,
      location: location.trim() || null,
      condition,
    });
    setPending(false);
    if (!res.ok) {
      if (res.fieldErrors) setFieldErrors(res.fieldErrors as Record<string, string[]>);
      toast.error(res.error);
      return;
    }
    toast.success(`Asset ${res.data!.ref_code} created`);
    onCreated(res.data!);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register a new asset</DialogTitle>
          <DialogDescription>
            Quick-create at this site. You&apos;ll be able to edit SDS,
            inspection dates, and notes later from{" "}
            <span className="font-mono">/resources/assets</span>.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="inline-asset-name" className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <input
              id="inline-asset-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              maxLength={160}
              placeholder="e.g. Hyster H40 — Bay 3"
              aria-invalid={!!fieldErrors.name}
              aria-describedby={fieldErrors.name ? "inline-asset-name-err" : undefined}
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
            {fieldErrors.name && (
              <p id="inline-asset-name-err" className="mt-1 text-xs text-destructive">
                {fieldErrors.name[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="inline-asset-kind" className="text-sm font-medium">
                Kind <span className="text-destructive">*</span>
              </label>
              <select
                id="inline-asset-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as AssetKind)}
                required
                aria-invalid={!!fieldErrors.kind}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {ASSET_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {ASSET_KIND_LABEL[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="inline-asset-condition" className="text-sm font-medium">
                Condition
              </label>
              <select
                id="inline-asset-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
              >
                {ASSET_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {ASSET_CONDITION_LABEL[c]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="inline-asset-location" className="text-sm font-medium">
              Location
            </label>
            <input
              id="inline-asset-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={160}
              placeholder="Bay 3, Aisle A"
              className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? "Creating…" : "Create asset"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
