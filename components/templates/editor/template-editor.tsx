"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FilePlus,
  FileText,
  GripVertical,
  ImageIcon,
  Info,
  ListChecks,
  PenLine,
  Plus,
  Trash2,
  Type,
  CalendarClock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { TemplateStatusBadge } from "@/components/templates/badges";
import { ChangeSummaryDialog } from "@/components/templates/editor/change-summary-dialog";
import { saveDraftVersion } from "@/app/(app)/templates/[id]/edit/actions";
import type {
  TemplateNodeItem,
  TemplateData,
  TemplateStatus,
  AnswerSet,
} from "@/lib/templates/types";
import {
  MVP_ITEM_TYPES,
  isMvpType,
  type MvpItemType,
} from "@/lib/templates/types";
import {
  addItem,
  removeItem,
  updateItem,
  moveItem,
  buildTree,
  countAnswerablePerSection,
  ensureDefaultAnswerSet,
  resolveAnswerSet,
  DEFAULT_ANSWER_SET_ID,
  type ItemTreeNode,
} from "@/lib/templates/items";

const TYPE_META: Record<
  MvpItemType,
  { label: string; icon: React.ComponentType<{ className?: string }> }
> = {
  section:     { label: "Section",     icon: ListChecks },
  category:    { label: "Category",    icon: FilePlus },
  information: { label: "Information", icon: Info },
  question:    { label: "Question",    icon: ListChecks },
  text:        { label: "Text",        icon: Type },
  datetime:    { label: "Date / time", icon: CalendarClock },
  signature:   { label: "Signature",   icon: PenLine },
  media:       { label: "Photo",       icon: ImageIcon },
};

type SaveStatus = "idle" | "saving" | "saved" | "error";

type Props = {
  templateId: string;
  templateName: string;
  templateDescription: string | null;
  templateStatus: TemplateStatus;
  draftVersionId: string;
  draftVersionNumber: number;
  initialHeader: TemplateNodeItem[];
  initialItems: TemplateNodeItem[];
  initialTemplateData: TemplateData;
  canPublish: boolean;
};

export function TemplateEditor(props: Props) {
  const router = useRouter();

  const [name, setName] = useState(props.templateName);
  const [description, setDescription] = useState(props.templateDescription ?? "");
  const [tab, setTab] = useState<"body" | "header">("body");
  const [header, setHeader] = useState<TemplateNodeItem[]>(props.initialHeader);
  const [items, setItems] = useState<TemplateNodeItem[]>(props.initialItems);
  const [templateData, setTemplateData] = useState<TemplateData>(
    ensureDefaultAnswerSet(props.initialTemplateData ?? { answer_sets: {} })
  );
  const [selectedId, setSelectedId] = useState<string | null>(
    props.initialItems[0]?.item_id ?? null
  );
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState<SaveStatus>("idle");
  const [publishOpen, setPublishOpen] = useState(false);

  const lastSaved = useRef<string>("");
  const initialKey = useRef<string>("");

  const activeArray = tab === "header" ? header : items;
  const setActiveArray = tab === "header" ? setHeader : setItems;

  const tree = useMemo(() => buildTree(activeArray), [activeArray]);
  const sectionCounts = useMemo(
    () => countAnswerablePerSection(items),
    [items]
  );

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return (
      header.find((it) => it.item_id === selectedId) ??
      items.find((it) => it.item_id === selectedId) ??
      null
    );
  }, [selectedId, header, items]);

  // Build the full save payload key for change detection
  const payloadKey = useMemo(
    () =>
      JSON.stringify({
        name,
        description,
        header,
        items,
        templateData,
      }),
    [name, description, header, items, templateData]
  );

  // Capture the initial payload so we don't fire a save just from mounting
  useEffect(() => {
    if (!initialKey.current) {
      initialKey.current = payloadKey;
      lastSaved.current = payloadKey;
    }
  }, [payloadKey]);

  // Autosave
  useEffect(() => {
    if (!initialKey.current) return;
    if (payloadKey === lastSaved.current) return;

    setStatus("saving");
    const t = window.setTimeout(async () => {
      const res = await saveDraftVersion({
        version_id: props.draftVersionId,
        template_id: props.templateId,
        header,
        items,
        template_data: templateData,
        name,
        description: description || null,
      });
      if (res.ok) {
        lastSaved.current = payloadKey;
        setStatus("saved");
        window.setTimeout(() => setStatus("idle"), 1500);
      } else {
        setStatus("error");
        toast.error(`Save failed: ${res.error}`);
      }
    }, 1000);
    return () => window.clearTimeout(t);
  }, [
    payloadKey,
    props.draftVersionId,
    props.templateId,
    header,
    items,
    templateData,
    name,
    description,
  ]);

  function handleAdd(type: MvpItemType, parentId?: string) {
    const { items: next, newItemId: id } = addItem(activeArray, type, parentId);
    setActiveArray(next);
    setSelectedId(id);
    if (type === "section") {
      // Newly added sections auto-expand
      setCollapsed((c) => {
        const n = new Set(c);
        n.delete(id);
        return n;
      });
    }
  }

  function handleRemove(id: string) {
    setActiveArray(removeItem(activeArray, id));
    if (selectedId === id) setSelectedId(null);
  }

  function handleUpdate(id: string, patch: Partial<TemplateNodeItem>) {
    setActiveArray(updateItem(activeArray, id, patch));
  }

  function handleMove(id: string, dir: "up" | "down") {
    setActiveArray(moveItem(activeArray, id, dir));
  }

  function toggleCollapsed(id: string) {
    setCollapsed((c) => {
      const n = new Set(c);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100vh-3.5rem)] flex-col bg-background">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/templates"
            className="inline-flex items-center gap-1 rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Back to templates"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full max-w-xl truncate border-none bg-transparent text-base font-semibold outline-none focus-visible:bg-accent/40 focus-visible:ring-1 focus-visible:ring-ring rounded px-1"
              maxLength={200}
            />
            <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
              <TemplateStatusBadge status={props.templateStatus} />
              <span>Draft v{props.draftVersionNumber}</span>
              <SaveIndicator status={status} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/templates/${props.templateId}`}
            className="inline-flex items-center gap-1.5 rounded-md border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
          >
            Preview
          </Link>
          <button
            type="button"
            onClick={() => setPublishOpen(true)}
            disabled={!props.canPublish || items.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-sm hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Publish v{props.draftVersionNumber}
          </button>
        </div>
      </div>

      {/* Main 3-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left sidebar */}
        <aside className="flex w-72 shrink-0 flex-col border-r bg-card">
          <div className="border-b p-2">
            <div className="flex rounded-md border bg-background p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => setTab("body")}
                className={cn(
                  "flex-1 rounded px-2 py-1",
                  tab === "body" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                Body ({items.length})
              </button>
              <button
                type="button"
                onClick={() => setTab("header")}
                className={cn(
                  "flex-1 rounded px-2 py-1",
                  tab === "header" ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                Title page ({header.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            {tree.length === 0 ? (
              <div className="rounded-md border border-dashed p-6 text-center text-xs text-muted-foreground">
                {tab === "body"
                  ? "No items yet. Add a section to get started."
                  : "No title-page items yet."}
              </div>
            ) : (
              <ul className="space-y-1">
                {tree.map((node) => (
                  <TreeNode
                    key={node.item.item_id}
                    node={node}
                    depth={0}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                    onMove={handleMove}
                    onRemove={handleRemove}
                    onAddChild={(type, parentId) => handleAdd(type, parentId)}
                    collapsed={collapsed}
                    onToggleCollapsed={toggleCollapsed}
                    sectionCounts={sectionCounts}
                  />
                ))}
              </ul>
            )}
          </div>

          <div className="border-t p-2">
            <AddRootButton
              tab={tab}
              onAdd={(type) => handleAdd(type)}
            />
          </div>
        </aside>

        {/* Center canvas + right options panel */}
        <div className="flex flex-1 min-w-0">
          <div className="flex-1 overflow-y-auto bg-muted/30 p-6">
            {selectedItem ? (
              <CanvasPreview item={selectedItem} templateData={templateData} />
            ) : (
              <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
                <FileText className="mx-auto h-10 w-10 text-muted-foreground/40" />
                <h2 className="mt-3 text-lg font-semibold">
                  {tab === "body" ? "Select an item to edit" : "Title page"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {tab === "body"
                    ? "Pick something from the left, or add a new section to get started."
                    : "The title page captures inspector name, conducted-on date, and any other context fields you want before the checklist starts."}
                </p>
              </div>
            )}
          </div>

          <aside className="w-80 shrink-0 overflow-y-auto border-l bg-card p-4">
            {selectedItem ? (
              <OptionsPanel
                item={selectedItem}
                templateData={templateData}
                onChange={(patch) => handleUpdate(selectedItem.item_id, patch)}
                onTemplateDataChange={setTemplateData}
                onRemove={() => handleRemove(selectedItem.item_id)}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Select an item from the sidebar to see its options here.
              </p>
            )}
          </aside>
        </div>
      </div>

      <ChangeSummaryDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        templateId={props.templateId}
        draftVersionId={props.draftVersionId}
        nextVersionNumber={props.draftVersionNumber}
        onSuccess={() => {
          setPublishOpen(false);
          // After publish the template is no longer in draft — go to read-only
          router.push(`/templates/${props.templateId}`);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Save indicator
// ---------------------------------------------------------------------------
function SaveIndicator({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;
  return (
    <span
      className={cn(
        "tabular-nums",
        status === "error" ? "text-destructive" : "text-muted-foreground"
      )}
    >
      {status === "saving" && "Saving…"}
      {status === "saved" && "Saved"}
      {status === "error" && "Save failed"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sidebar tree node — recursive
// ---------------------------------------------------------------------------
function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
  onMove,
  onRemove,
  onAddChild,
  collapsed,
  onToggleCollapsed,
  sectionCounts,
}: {
  node: ItemTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, dir: "up" | "down") => void;
  onRemove: (id: string) => void;
  onAddChild: (type: MvpItemType, parentId: string) => void;
  collapsed: Set<string>;
  onToggleCollapsed: (id: string) => void;
  sectionCounts: Record<string, number>;
}) {
  const isContainer = node.item.type === "section" || node.item.type === "category";
  const isCollapsed = collapsed.has(node.item.item_id);
  const isSelected = selectedId === node.item.item_id;
  const Icon = isMvpType(node.item.type) ? TYPE_META[node.item.type].icon : FileText;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-1 py-1 hover:bg-accent",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${0.25 + depth * 0.75}rem` }}
      >
        {isContainer ? (
          <button
            type="button"
            onClick={() => onToggleCollapsed(node.item.item_id)}
            className="text-muted-foreground"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </button>
        ) : (
          <span className="w-3" />
        )}
        <GripVertical className="h-3 w-3 text-muted-foreground/40" />
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <button
          type="button"
          onClick={() => onSelect(node.item.item_id)}
          className="flex-1 truncate text-left text-xs"
        >
          {node.item.label || "(unlabeled)"}
        </button>
        {node.item.type === "section" && sectionCounts[node.item.item_id] !== undefined && (
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {sectionCounts[node.item.item_id]}
          </span>
        )}
        <div className="hidden items-center gap-0.5 group-hover:flex">
          <button
            type="button"
            onClick={() => onMove(node.item.item_id, "up")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Move up"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => onMove(node.item.item_id, "down")}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Move down"
          >
            ↓
          </button>
          <button
            type="button"
            onClick={() => onRemove(node.item.item_id)}
            className="text-muted-foreground hover:text-destructive"
            aria-label="Delete"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>
      {isContainer && !isCollapsed && (
        <ul className="space-y-1">
          {node.children.map((c) => (
            <TreeNode
              key={c.item.item_id}
              node={c}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onMove={onMove}
              onRemove={onRemove}
              onAddChild={onAddChild}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
              sectionCounts={sectionCounts}
            />
          ))}
          <li
            style={{ paddingLeft: `${0.25 + (depth + 1) * 0.75}rem` }}
            className="flex items-center gap-1 px-1 pb-1"
          >
            <AddChildButton
              parentType={node.item.type}
              onAdd={(type) => onAddChild(type, node.item.item_id)}
            />
          </li>
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// "+" add buttons for root and child contexts
// ---------------------------------------------------------------------------
function AddRootButton({
  tab,
  onAdd,
}: {
  tab: "body" | "header";
  onAdd: (type: MvpItemType) => void;
}) {
  // Body root: only sections allowed
  // Header root: information / text / datetime / signature
  const types: MvpItemType[] =
    tab === "body"
      ? ["section"]
      : ["information", "text", "datetime", "signature"];
  return (
    <div className="flex flex-wrap gap-1">
      {types.map((t) => {
        const Icon = TYPE_META[t].icon;
        return (
          <button
            key={t}
            type="button"
            onClick={() => onAdd(t)}
            className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-accent"
          >
            <Plus className="h-3 w-3" /> {TYPE_META[t].label}
          </button>
        );
      })}
    </div>
  );
}

function AddChildButton({
  parentType,
  onAdd,
}: {
  parentType: string;
  onAdd: (type: MvpItemType) => void;
}) {
  // Section: can hold category, question, information, text, datetime, signature, media
  // Category: same as section but no nested sections
  const allowedFor: Record<string, MvpItemType[]> = {
    section: [
      "category",
      "question",
      "information",
      "text",
      "datetime",
      "signature",
      "media",
    ],
    category: ["question", "information", "text", "datetime", "signature", "media"],
  };
  const types = allowedFor[parentType] ?? [];
  if (types.length === 0) return null;
  return (
    <details className="relative">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground list-none">
        + Add item
      </summary>
      <div className="absolute z-10 mt-1 rounded-md border bg-popover p-1 shadow-lg">
        {types.map((t) => {
          const Icon = TYPE_META[t].icon;
          return (
            <button
              key={t}
              type="button"
              onClick={(e) => {
                onAdd(t);
                (e.currentTarget.closest("details") as HTMLDetailsElement)?.removeAttribute(
                  "open"
                );
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1 text-left text-xs hover:bg-accent"
            >
              <Icon className="h-3 w-3" /> {TYPE_META[t].label}
            </button>
          );
        })}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Center canvas — preview of the selected item as it'll appear in the runner
// ---------------------------------------------------------------------------
function CanvasPreview({
  item,
  templateData,
}: {
  item: TemplateNodeItem;
  templateData: TemplateData;
}) {
  const isMvp = isMvpType(item.type);
  if (!isMvp) {
    return (
      <div className="mx-auto max-w-2xl rounded-lg border border-dashed bg-card p-8 text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-warning" />
        <h2 className="mt-3 text-lg font-semibold">Unsupported item type ({item.type})</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          This item type was imported from the SafetyCulture library but isn&apos;t
          editable in v1. The runner will display it read-only with this same
          message. Replace it with one of the eight MVP types to use it.
        </p>
      </div>
    );
  }
  const required = (item.options?.is_mandatory as boolean) ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        Preview · how this looks in the inspection
      </p>
      <div className="rounded-lg border bg-card p-5 shadow-sm">
        {item.type === "section" && (
          <div>
            <h2 className="text-xl font-semibold">{item.label}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Section — children render below this header.
            </p>
          </div>
        )}
        {item.type === "category" && (
          <div>
            <h3 className="text-base font-semibold">{item.label}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Category — sub-grouping inside a section.
            </p>
          </div>
        )}
        {item.type === "information" && (
          <div className="rounded-md border-l-4 border-primary/40 bg-primary/5 p-3">
            <p className="text-sm">{item.label}</p>
          </div>
        )}
        {item.type === "question" && (
          <QuestionPreview item={item} templateData={templateData} required={required} />
        )}
        {item.type === "text" && (
          <div>
            <label className="text-sm font-medium">
              {item.label}
              {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <textarea
              rows={3}
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Inspector types their response here..."
              disabled
            />
          </div>
        )}
        {item.type === "datetime" && (
          <div>
            <label className="text-sm font-medium">
              {item.label}
              {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <input
              type="datetime-local"
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm"
              disabled
            />
          </div>
        )}
        {item.type === "signature" && (
          <div>
            <label className="text-sm font-medium">
              {item.label}
              {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <div className="mt-2 flex h-24 items-center justify-center rounded-md border-2 border-dashed bg-background text-xs text-muted-foreground">
              Tap to sign
            </div>
          </div>
        )}
        {item.type === "media" && (
          <div>
            <label className="text-sm font-medium">
              {item.label}
              {required && <span className="ml-1 text-destructive">*</span>}
            </label>
            <div className="mt-2 flex h-24 items-center justify-center rounded-md border-2 border-dashed bg-background text-xs text-muted-foreground">
              Drag photos here, or tap to capture
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionPreview({
  item,
  templateData,
  required,
}: {
  item: TemplateNodeItem;
  templateData: TemplateData;
  required: boolean;
}) {
  const setId = item.options?.answer_set as string | undefined;
  const set = resolveAnswerSet(templateData, setId);
  return (
    <div>
      <label className="text-sm font-medium">
        {item.label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      <div className="mt-2 flex flex-wrap gap-2">
        {set ? (
          set.responses.map((r) => (
            <button
              key={r.id}
              type="button"
              disabled
              className={cn(
                "inline-flex items-center rounded-md border px-3 py-1.5 text-sm font-medium",
                r.failed
                  ? "border-destructive/30 bg-destructive/10 text-destructive"
                  : "bg-background text-foreground"
              )}
              style={
                r.colour
                  ? { borderColor: `rgb(${r.colour})`, color: `rgb(${r.colour})` }
                  : undefined
              }
            >
              {r.label}
            </button>
          ))
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No answer set selected — pick one in the right-hand panel.
          </p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Right-hand options panel
// ---------------------------------------------------------------------------
function OptionsPanel({
  item,
  templateData,
  onChange,
  onTemplateDataChange,
  onRemove,
}: {
  item: TemplateNodeItem;
  templateData: TemplateData;
  onChange: (patch: Partial<TemplateNodeItem>) => void;
  onTemplateDataChange: (td: TemplateData) => void;
  onRemove: () => void;
}) {
  const isAnswerable = !["section", "category", "information"].includes(item.type);
  const isMvp = isMvpType(item.type);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Item type
        </p>
        <p className="mt-1 text-sm font-semibold">
          {isMvp ? TYPE_META[item.type as MvpItemType].label : item.type}
          {!isMvp && (
            <span className="ml-2 rounded-md bg-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-warning">
              Unsupported
            </span>
          )}
        </p>
      </div>

      <div>
        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Label
        </label>
        {item.type === "information" ? (
          <textarea
            rows={3}
            value={item.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            maxLength={500}
          />
        ) : (
          <input
            type="text"
            value={item.label ?? ""}
            onChange={(e) => onChange({ label: e.target.value })}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            maxLength={300}
          />
        )}
      </div>

      {isAnswerable && (
        <div className="flex items-center justify-between">
          <label className="text-sm">Required</label>
          <input
            type="checkbox"
            checked={(item.options?.is_mandatory as boolean) ?? false}
            onChange={(e) =>
              onChange({ options: { is_mandatory: e.target.checked } })
            }
            className="h-4 w-4 rounded border"
          />
        </div>
      )}

      {item.type === "question" && (
        <AnswerSetPicker
          item={item}
          templateData={templateData}
          onChange={onChange}
          onTemplateDataChange={onTemplateDataChange}
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        className="inline-flex items-center gap-1 rounded-md border border-destructive/30 bg-destructive/5 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="h-3 w-3" /> Delete item
      </button>
    </div>
  );
}

function AnswerSetPicker({
  item,
  templateData,
  onChange,
}: {
  item: TemplateNodeItem;
  templateData: TemplateData;
  onChange: (patch: Partial<TemplateNodeItem>) => void;
  onTemplateDataChange: (td: TemplateData) => void;
}) {
  const sets = Object.values(templateData.answer_sets ?? {});
  const currentId =
    (item.options?.answer_set as string | undefined) ?? DEFAULT_ANSWER_SET_ID;
  const current = sets.find((s) => s.id === currentId);
  return (
    <div>
      <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Answer set
      </label>
      <select
        value={currentId}
        onChange={(e) =>
          onChange({ options: { answer_set: e.target.value } })
        }
        className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
      >
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {summarizeAnswerSet(s)}
          </option>
        ))}
      </select>
      {current && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          {current.responses.filter((r) => r.failed).length} fail-marked,{" "}
          {current.responses.length} total
        </p>
      )}
    </div>
  );
}

function summarizeAnswerSet(s: AnswerSet): string {
  return s.responses
    .map((r) => r.label)
    .slice(0, 3)
    .join(" / ") + (s.responses.length > 3 ? " …" : "");
}
