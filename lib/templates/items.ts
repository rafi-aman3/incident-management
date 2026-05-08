/**
 * Pure helpers for item-array manipulation. All functions return new
 * arrays — never mutate the input. Used by the editor (client) and
 * the runner (validation walks).
 */

import type {
  TemplateNodeItem,
  AnswerSet,
  TemplateData,
} from "@/lib/templates/types";

/**
 * Generate a UUID-shaped string in the browser. Avoids depending on
 * `crypto.randomUUID()` which isn't available in older Safari, and
 * avoids pulling in a uuid lib for one call site.
 */
export function newItemId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback: 8-4-4-4-12 hex pattern
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  return `${hex(8)}-${hex(4)}-${hex(4)}-${hex(4)}-${hex(12)}`;
}

/**
 * Default options shape for a freshly added item of the given type.
 * Higher-than-existing sort_order is set by the caller.
 */
export function defaultOptionsForType(type: string): Record<string, unknown> {
  const base: Record<string, unknown> = { sort_order: 1, is_mandatory: false };
  if (type === "signature") {
    base.enable_signature_timestamp = true;
  }
  return base;
}

export function defaultLabelForType(type: string): string {
  switch (type) {
    case "section":
      return "New section";
    case "category":
      return "New category";
    case "information":
      return "Information text";
    case "question":
      return "New question";
    case "text":
      return "Text response";
    case "datetime":
      return "Date / time";
    case "signature":
      return "Signature";
    case "media":
      return "Photo evidence";
    default:
      return "New item";
  }
}

/**
 * Insert a new item into the array, optionally under a parent_id.
 * sort_order is set to (max existing sort_order + 1) within the same
 * parent group.
 */
export function addItem(
  items: TemplateNodeItem[],
  type: string,
  parentId?: string
): { items: TemplateNodeItem[]; newItemId: string } {
  const id = newItemId();
  const siblingOrders = items
    .filter((it) => (parentId ? it.parent_id === parentId : !it.parent_id))
    .map((it) => (it.options?.sort_order ?? 0) as number);
  const nextOrder = siblingOrders.length ? Math.max(...siblingOrders) + 1 : 1;

  const newItem: TemplateNodeItem = {
    item_id: id,
    type,
    label: defaultLabelForType(type),
    options: { ...defaultOptionsForType(type), sort_order: nextOrder },
    ...(parentId ? { parent_id: parentId } : {}),
  };
  return { items: [...items, newItem], newItemId: id };
}

/**
 * Remove an item AND all its descendants (recursive parent_id walk).
 */
export function removeItem(
  items: TemplateNodeItem[],
  itemId: string
): TemplateNodeItem[] {
  const toRemove = new Set<string>([itemId]);
  // Walk: keep adding children of any item already in toRemove.
  // Bounded by items.length since the graph is acyclic.
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of items) {
      if (it.parent_id && toRemove.has(it.parent_id) && !toRemove.has(it.item_id)) {
        toRemove.add(it.item_id);
        changed = true;
      }
    }
  }
  return items.filter((it) => !toRemove.has(it.item_id));
}

/**
 * Count descendants of an item (children, grandchildren, etc.) without
 * including the item itself. Mirrors the closure walk in `removeItem`
 * so the "delete this section and N items inside?" confirm matches what
 * the deletion will actually remove.
 */
export function countDescendants(
  items: TemplateNodeItem[],
  itemId: string
): number {
  const set = new Set<string>([itemId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const it of items) {
      if (it.parent_id && set.has(it.parent_id) && !set.has(it.item_id)) {
        set.add(it.item_id);
        changed = true;
      }
    }
  }
  return set.size - 1;
}

/**
 * Patch a single item by id. The patch is shallow-merged at the top level;
 * `options` is merged separately to preserve unrelated keys.
 */
export function updateItem(
  items: TemplateNodeItem[],
  itemId: string,
  patch: Partial<TemplateNodeItem>
): TemplateNodeItem[] {
  return items.map((it) => {
    if (it.item_id !== itemId) return it;
    const next: TemplateNodeItem = { ...it, ...patch };
    if (patch.options) {
      next.options = { ...(it.options ?? {}), ...patch.options };
    }
    return next;
  });
}

/**
 * Move an item up or down within its sibling group (by parent_id).
 * Returns a new array with sort_order values rewritten contiguously
 * (1-indexed) so the order is stable across saves.
 */
export function moveItem(
  items: TemplateNodeItem[],
  itemId: string,
  direction: "up" | "down"
): TemplateNodeItem[] {
  const target = items.find((it) => it.item_id === itemId);
  if (!target) return items;
  const parentId = target.parent_id;
  const siblings = items
    .filter((it) =>
      parentId ? it.parent_id === parentId : !it.parent_id
    )
    .sort(
      (a, b) =>
        ((a.options?.sort_order as number) ?? 0) -
        ((b.options?.sort_order as number) ?? 0)
    );

  const idx = siblings.findIndex((it) => it.item_id === itemId);
  if (idx === -1) return items;
  const swap = direction === "up" ? idx - 1 : idx + 1;
  if (swap < 0 || swap >= siblings.length) return items;

  // Swap in the sibling list
  [siblings[idx], siblings[swap]] = [siblings[swap], siblings[idx]];

  // Rewrite sort_order contiguously
  const rewritten = new Map<string, number>();
  siblings.forEach((it, i) => rewritten.set(it.item_id, i + 1));

  return items.map((it) => {
    if (!rewritten.has(it.item_id)) return it;
    return {
      ...it,
      options: { ...(it.options ?? {}), sort_order: rewritten.get(it.item_id) },
    };
  });
}

/**
 * Reorder a sibling group (items sharing the same `parent_id`) given the
 * new ID ordering from a drag-end event. Rewrites `sort_order` contiguously
 * (1-indexed) so the order is stable across saves. Items not in the
 * sibling group are returned unchanged. Unknown IDs are ignored.
 */
export function reorderSiblings(
  items: TemplateNodeItem[],
  parentId: string | undefined,
  orderedIds: string[]
): TemplateNodeItem[] {
  const siblingSet = new Set(
    items
      .filter((it) =>
        parentId ? it.parent_id === parentId : !it.parent_id
      )
      .map((it) => it.item_id)
  );
  const rewritten = new Map<string, number>();
  let cursor = 1;
  for (const id of orderedIds) {
    if (siblingSet.has(id)) {
      rewritten.set(id, cursor++);
    }
  }
  return items.map((it) => {
    if (!rewritten.has(it.item_id)) return it;
    return {
      ...it,
      options: { ...(it.options ?? {}), sort_order: rewritten.get(it.item_id) },
    };
  });
}

/**
 * Build a tree of root sections → categories → answerable items, sorted by
 * sort_order at each level. Used by the editor sidebar and the runner.
 */
export type ItemTreeNode = {
  item: TemplateNodeItem;
  children: ItemTreeNode[];
};

export function buildTree(items: TemplateNodeItem[]): ItemTreeNode[] {
  const byParent = new Map<string | undefined, TemplateNodeItem[]>();
  for (const it of items) {
    const k = it.parent_id;
    const list = byParent.get(k) ?? [];
    list.push(it);
    byParent.set(k, list);
  }

  function nodesFor(parentId: string | undefined): ItemTreeNode[] {
    const list = byParent.get(parentId) ?? [];
    return list
      .slice()
      .sort(
        (a, b) =>
          ((a.options?.sort_order as number) ?? 0) -
          ((b.options?.sort_order as number) ?? 0)
      )
      .map((item) => ({ item, children: nodesFor(item.item_id) }));
  }
  return nodesFor(undefined);
}

/**
 * Walk the items tree and yield every "answerable" item (everything that
 * isn't a section / category / information container). Used by validation
 * (required-but-unanswered checks) and the runner's progress count.
 */
export function* walkAnswerable(
  items: TemplateNodeItem[]
): Generator<TemplateNodeItem> {
  for (const it of items) {
    if (it.type === "section" || it.type === "category" || it.type === "information") {
      continue;
    }
    yield it;
  }
}

/**
 * Count answerable items per section_id (root section). Useful for the
 * editor's section-header chips ("3 items").
 */
export function countAnswerablePerSection(
  items: TemplateNodeItem[]
): Record<string, number> {
  const counts: Record<string, number> = {};

  // Build parent-of-parent walk so a question under a category under a
  // section gets attributed to the section.
  const byId = new Map(items.map((it) => [it.item_id, it]));
  function rootSectionId(id: string): string | undefined {
    const it = byId.get(id);
    if (!it) return undefined;
    if (it.type === "section") return it.item_id;
    if (it.parent_id) return rootSectionId(it.parent_id);
    return undefined;
  }

  for (const it of items) {
    if (it.type === "section" || it.type === "category" || it.type === "information") {
      continue;
    }
    const sec = rootSectionId(it.item_id);
    if (sec) {
      counts[sec] = (counts[sec] ?? 0) + 1;
    }
  }
  return counts;
}

/**
 * Resolve an answer_set referenced by a question item.
 */
export function resolveAnswerSet(
  templateData: TemplateData | null | undefined,
  answerSetId: string | undefined
): AnswerSet | null {
  if (!answerSetId || !templateData?.answer_sets) return null;
  return templateData.answer_sets[answerSetId] ?? null;
}

export const DEFAULT_ANSWER_SET_ID = "default-yes-no";

/**
 * Provide a sensible default answer_set for a freshly added question if
 * the template's template_data is empty. Yes / No / N/A.
 */
export function ensureDefaultAnswerSet(td: TemplateData): TemplateData {
  if (td.answer_sets && Object.keys(td.answer_sets).length > 0) return td;
  const defaultSet: AnswerSet = {
    id: DEFAULT_ANSWER_SET_ID,
    type: "question",
    responses: [
      { id: "yes", label: "Yes", score: 1, colour: "0,159,105", enable_score: true, failed: false },
      { id: "no", label: "No", score: 0, colour: "198,0,34", enable_score: true, failed: true },
      { id: "na", label: "N/A", score: 1, colour: "112,112,112", enable_score: true, failed: false },
    ],
  };
  return {
    ...td,
    answer_sets: { ...(td.answer_sets ?? {}), [DEFAULT_ANSWER_SET_ID]: defaultSet },
  };
}
