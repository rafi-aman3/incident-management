"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Building2,
  ClipboardCheck,
  ClipboardList,
  FileText,
  History,
  LayoutDashboard,
  Microscope,
  Package,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
  CommandSeparator,
  CommandItem,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SearchGroup } from "@/app/api/search/route";

// Phase 7 — Global search palette. Hydrates the 6l shell with a working
// ⌘K command palette. Server filters via /api/search; cmdk's built-in
// fuzzy filter is disabled (shouldFilter={false}) so the order from the
// server is preserved.

const RECENT_KEY = "argus.search.recent";
const RECENT_MAX = 5;
const DEBOUNCE_MS = 200;

const MODULE_ICON: Record<string, typeof Search> = {
  incidents: AlertTriangle,
  investigations: Microscope,
  capas: Wrench,
  inspections: ClipboardCheck,
  templates: ClipboardList,
  assets: Package,
  documents: FileText,
  sites: Building2,
  members: Users,
};

const MODULE_SHORTCUTS: Array<{
  label: string;
  href: string;
  icon: typeof Search;
}> = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Incidents", href: "/incidents", icon: AlertTriangle },
  { label: "Investigations", href: "/investigations", icon: Microscope },
  { label: "CAPAs", href: "/capa", icon: Wrench },
  { label: "Inspections", href: "/inspections", icon: ClipboardCheck },
  { label: "Templates", href: "/templates", icon: ClipboardList },
  { label: "Resources", href: "/resources/assets", icon: Package },
  { label: "Sites", href: "/admin/sites", icon: Building2 },
];

export function SearchTrigger({ variant }: { variant: "input" | "icon" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<string[]>([]);
  const router = useRouter();
  const abortRef = useRef<AbortController | null>(null);

  // Load recent searches from localStorage on first mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(RECENT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRecent(parsed.filter((s): s is string => typeof s === "string"));
        }
      }
    } catch {
      // localStorage unavailable / corrupt — ignore.
    }
  }, []);

  // Global ⌘K / Ctrl+K toggle. Skip when typing in form fields so the
  // palette doesn't hijack the shortcut from textareas / contentEditable.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "k" || (!e.metaKey && !e.ctrlKey)) return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        target?.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      ) {
        // Allow ⌘K to open the palette even from inside our own input — that
        // matches the convention in Linear/GitHub/Vercel. So only bail if
        // the user is typing in a *different* form field outside the palette.
        if (!target?.closest('[data-slot="command"]')) return;
      }
      e.preventDefault();
      setOpen((o) => !o);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Reset state on close.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setGroups([]);
      setLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  // Debounced server-side search.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          setGroups([]);
          setLoading(false);
          return;
        }
        const data = (await res.json()) as { groups?: SearchGroup[] };
        setGroups(data.groups ?? []);
        setLoading(false);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setGroups([]);
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const pushRecent = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setRecent((prev) => {
      const next = [trimmed, ...prev.filter((p) => p !== trimmed)].slice(
        0,
        RECENT_MAX,
      );
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        // ignore quota / private mode failures
      }
      return next;
    });
  }, []);

  const navigate = useCallback(
    (href: string, opts?: { rememberQuery?: boolean }) => {
      if (opts?.rememberQuery) pushRecent(query);
      setOpen(false);
      router.push(href);
    },
    [pushRecent, query, router],
  );

  const showSearchResults = query.trim().length >= 2;
  const hasResults = groups.length > 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "input" ? (
          <button
            type="button"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
            className={cn(
              "group flex h-9 w-full max-w-[420px] items-center gap-2 rounded-lg border bg-muted/40 px-3 text-sm text-muted-foreground ring-1 ring-transparent transition hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-ring xl:max-w-[520px]"
            )}
          >
            <Search className="h-4 w-4 shrink-0" aria-hidden />
            <span className="flex-1 text-left">Search…</span>
            <kbd className="pointer-events-none hidden select-none items-center gap-1 rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Search"
            aria-keyshortcuts="Meta+K Control+K"
          >
            <Search className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>

      <DialogContent
        className="overflow-hidden p-0 sm:max-w-xl"
        aria-label="Global search"
      >
        <DialogTitle className="sr-only">Global search</DialogTitle>
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search incidents, CAPAs, sites, people…"
          />
          <CommandList>
            {!showSearchResults && (
              <>
                <CommandGroup heading="Jump to">
                  {MODULE_SHORTCUTS.map((m) => {
                    const Icon = m.icon;
                    return (
                      <CommandItem
                        key={m.href}
                        value={`module-${m.label}`}
                        onSelect={() => navigate(m.href)}
                      >
                        <Icon className="size-4" aria-hidden />
                        <span>{m.label}</span>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
                {recent.length > 0 && (
                  <>
                    <CommandSeparator />
                    <CommandGroup heading="Recent searches">
                      {recent.map((r) => (
                        <CommandItem
                          key={`recent-${r}`}
                          value={`recent-${r}`}
                          onSelect={() => setQuery(r)}
                        >
                          <History className="size-4" aria-hidden />
                          <span>{r}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}

            {showSearchResults && loading && !hasResults && (
              <div className="space-y-1 p-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-9 animate-pulse rounded-sm bg-muted/40"
                  />
                ))}
              </div>
            )}

            {showSearchResults && !loading && !hasResults && (
              <CommandEmpty>No matches for &ldquo;{query.trim()}&rdquo;.</CommandEmpty>
            )}

            {showSearchResults && hasResults && (
              <>
                {groups.map((g, idx) => {
                  const Icon = MODULE_ICON[g.module] ?? Search;
                  return (
                    <div key={g.module}>
                      {idx > 0 && <CommandSeparator />}
                      <CommandGroup heading={g.label}>
                        {g.items.map((item) => (
                          <CommandItem
                            key={`${g.module}-${item.id}`}
                            value={`${g.module}-${item.id}-${item.title}`}
                            onSelect={() =>
                              navigate(item.href, { rememberQuery: true })
                            }
                          >
                            <Icon className="size-4" aria-hidden />
                            <div className="flex min-w-0 flex-1 flex-col">
                              <span className="truncate">{item.title}</span>
                              {item.subtitle && (
                                <span className="truncate text-xs text-muted-foreground">
                                  {item.subtitle}
                                </span>
                              )}
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </div>
                  );
                })}
              </>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
