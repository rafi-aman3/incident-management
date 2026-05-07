"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type PermissionCatalogEntry = {
  key: string;
  description: string;
};

type Group = {
  prefix: string;
  label: string;
  entries: PermissionCatalogEntry[];
};

const GROUP_LABELS: Record<string, string> = {
  site: "Sites",
  member: "Members",
  role: "Roles",
  invitation: "Invitations",
  team: "Teams",
  incident: "Incidents",
  investigation: "Investigations",
  capa: "CAPAs",
  report: "Reports",
  template: "Templates",
  inspection: "Inspections",
  finding: "Findings",
  asset: "Assets",
  document: "Documents",
  document_link: "Document links",
  planner: "Planner",
  notification: "Notifications",
  demo: "Demo affordances",
};

function groupOf(key: string): string {
  return key.split(":")[0];
}

function groupBy(catalog: PermissionCatalogEntry[]): Group[] {
  const map = new Map<string, PermissionCatalogEntry[]>();
  for (const e of catalog) {
    const g = groupOf(e.key);
    const list = map.get(g) ?? [];
    list.push(e);
    map.set(g, list);
  }
  const groups: Group[] = [];
  for (const [prefix, entries] of map) {
    groups.push({
      prefix,
      label: GROUP_LABELS[prefix] ?? prefix,
      entries: entries.slice().sort((a, b) => a.key.localeCompare(b.key)),
    });
  }
  return groups.sort((a, b) => a.label.localeCompare(b.label));
}

export function PermissionChecklist({
  catalog,
  initialSelected,
  readOnly = false,
  formId,
  hiddenSetMarker = true,
  onChange,
}: {
  catalog: PermissionCatalogEntry[];
  initialSelected: string[];
  readOnly?: boolean;
  // Optional form id so consumers can wire the hidden inputs into a separate
  // <form> living elsewhere. Defaults to inline children.
  formId?: string;
  // Emits a hidden `permission_keys_set=1` marker so the server can tell
  // "user submitted permission keys" apart from "user didn't touch".
  hiddenSetMarker?: boolean;
  onChange?: (keys: string[]) => void;
}) {
  const groups = useMemo(() => groupBy(catalog), [catalog]);
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialSelected),
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    if (readOnly) return;
    const next = new Set(selected);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelected(next);
    onChange?.(Array.from(next));
  };

  const toggleGroup = (g: Group) => {
    if (readOnly) return;
    const allOn = g.entries.every((e) => selected.has(e.key));
    const next = new Set(selected);
    for (const e of g.entries) {
      if (allOn) next.delete(e.key);
      else next.add(e.key);
    }
    setSelected(next);
    onChange?.(Array.from(next));
  };

  const toggleCollapsed = (prefix: string) => {
    const next = new Set(collapsed);
    if (next.has(prefix)) next.delete(prefix);
    else next.add(prefix);
    setCollapsed(next);
  };

  return (
    <div className="space-y-3">
      {/* Hidden inputs so the parent <form> picks the selection up. */}
      {Array.from(selected).map((k) => (
        <input
          key={k}
          type="hidden"
          name="permission_keys"
          value={k}
          form={formId}
        />
      ))}
      {hiddenSetMarker && (
        <input type="hidden" name="permission_keys_set" value="1" form={formId} />
      )}

      <div className="space-y-2">
        {groups.map((g) => {
          const onCount = g.entries.filter((e) => selected.has(e.key)).length;
          const total = g.entries.length;
          const isCollapsed = collapsed.has(g.prefix);
          return (
            <div key={g.prefix} className="rounded-md border bg-card">
              <button
                type="button"
                onClick={() => toggleCollapsed(g.prefix)}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-accent/40"
                aria-expanded={!isCollapsed}
              >
                <span className="flex items-center gap-2">
                  {isCollapsed ? (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                  )}
                  <span className="font-medium">{g.label}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums",
                      onCount === total &&
                        total > 0 &&
                        "bg-primary/10 text-primary",
                    )}
                  >
                    {onCount} / {total}
                  </span>
                  {!readOnly && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleGroup(g);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleGroup(g);
                        }
                      }}
                      className="rounded-md border px-2 py-0.5 text-[11px] font-medium hover:bg-accent"
                    >
                      {onCount === total ? "Clear" : "Select all"}
                    </span>
                  )}
                </span>
              </button>
              {!isCollapsed && (
                <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-2">
                  {g.entries.map((e) => {
                    const checked = selected.has(e.key);
                    return (
                      <label
                        key={e.key}
                        className={cn(
                          "flex cursor-pointer items-start gap-2 bg-background px-3 py-2 text-sm",
                          readOnly && "cursor-not-allowed opacity-90",
                        )}
                      >
                        <input
                          type="checkbox"
                          className="mt-1 h-3.5 w-3.5 accent-primary"
                          checked={checked}
                          disabled={readOnly}
                          onChange={() => toggle(e.key)}
                        />
                        <span className="space-y-0.5">
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {e.key}
                          </span>
                          <span className="block text-xs leading-snug">
                            {e.description}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
