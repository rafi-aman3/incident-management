import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  buildTree,
  resolveAnswerSet,
  type ItemTreeNode,
} from "@/lib/templates/items";
import {
  isMvpType,
  isNonAnswerable,
  type TemplateNodeItem,
  type TemplateData,
} from "@/lib/templates/types";

/**
 * Server-rendered read-only checklist. Used by:
 *   - /templates/[id]?version=N (viewer)
 *   - /templates/browse/[id] (library preview, Task 5b)
 *   - inspection report view (Task 6 - completed inspections)
 */
export function ChecklistPreview({
  header,
  items,
  templateData,
}: {
  header: TemplateNodeItem[];
  items: TemplateNodeItem[];
  templateData: TemplateData;
}) {
  const headerTree = buildTree(header);
  const itemsTree = buildTree(items);

  return (
    <div className="space-y-6">
      {headerTree.length > 0 && (
        <section className="rounded-lg border bg-card p-5 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Title page
          </p>
          <div className="mt-3 space-y-3">
            {headerTree.map((node) => (
              <RenderNode
                key={node.item.item_id}
                node={node}
                templateData={templateData}
                depth={0}
              />
            ))}
          </div>
        </section>
      )}

      {itemsTree.length === 0 ? (
        <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
          No checklist items yet.
        </div>
      ) : (
        itemsTree.map((node) => (
          <RenderNode
            key={node.item.item_id}
            node={node}
            templateData={templateData}
            depth={0}
          />
        ))
      )}
    </div>
  );
}

function RenderNode({
  node,
  templateData,
  depth,
}: {
  node: ItemTreeNode;
  templateData: TemplateData;
  depth: number;
}) {
  const item = node.item;

  // Containers
  if (item.type === "section") {
    return (
      <section className="rounded-lg border bg-card p-5 shadow-sm">
        <h2 className="text-lg font-semibold">{item.label}</h2>
        {node.children.length > 0 && (
          <div className="mt-3 space-y-3">
            {node.children.map((c) => (
              <RenderNode
                key={c.item.item_id}
                node={c}
                templateData={templateData}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  if (item.type === "category") {
    return (
      <div className="rounded-md border-l-2 border-primary/30 pl-3">
        <h3 className="text-sm font-semibold text-foreground">{item.label}</h3>
        {node.children.length > 0 && (
          <div className="mt-2 space-y-2">
            {node.children.map((c) => (
              <RenderNode
                key={c.item.item_id}
                node={c}
                templateData={templateData}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  if (item.type === "information") {
    return (
      <div className="rounded-md border-l-4 border-primary/40 bg-primary/5 p-3 text-sm">
        {item.label}
      </div>
    );
  }

  // Answerable items — render in read-only form
  return <ItemPreview item={item} templateData={templateData} />;
}

function ItemPreview({
  item,
  templateData,
}: {
  item: TemplateNodeItem;
  templateData: TemplateData;
}) {
  const required = (item.options?.is_mandatory as boolean) ?? false;
  const labelEl = (
    <label className="text-sm font-medium">
      {item.label}
      {required && <span className="ml-1 text-destructive">*</span>}
    </label>
  );

  if (!isMvpType(item.type)) {
    return (
      <div className="rounded-md border border-dashed border-warning/50 bg-warning/5 p-3 text-sm">
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">{item.label}</p>
            <p className="text-xs text-muted-foreground">
              Item type <code className="font-mono">{item.type}</code> is not
              supported in v1 — runner shows it read-only.
            </p>
          </div>
        </div>
      </div>
    );
  }

  switch (item.type) {
    case "question": {
      const setId = item.options?.answer_set as string | undefined;
      const set = resolveAnswerSet(templateData, setId);
      return (
        <div>
          {labelEl}
          <div className="mt-2 flex flex-wrap gap-2">
            {set ? (
              set.responses.map((r) => (
                <span
                  key={r.id}
                  className={cn(
                    "inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium",
                    r.failed && "border-destructive/30 bg-destructive/10 text-destructive"
                  )}
                  style={
                    r.colour && !r.failed
                      ? {
                          borderColor: `rgb(${r.colour})`,
                          color: `rgb(${r.colour})`,
                        }
                      : undefined
                  }
                >
                  {r.label}
                </span>
              ))
            ) : (
              <span className="text-xs italic text-muted-foreground">
                No answer set linked
              </span>
            )}
          </div>
        </div>
      );
    }
    case "text":
      return (
        <div>
          {labelEl}
          <div className="mt-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">
            Text response
          </div>
        </div>
      );
    case "datetime":
      return (
        <div>
          {labelEl}
          <div className="mt-2 rounded-md border bg-muted/50 px-3 py-2 text-xs text-muted-foreground italic">
            Date / time picker
          </div>
        </div>
      );
    case "signature":
      return (
        <div>
          {labelEl}
          <div className="mt-2 flex h-16 items-center justify-center rounded-md border-2 border-dashed bg-muted/30 text-xs text-muted-foreground">
            Signature
          </div>
        </div>
      );
    case "media":
      return (
        <div>
          {labelEl}
          <div className="mt-2 flex h-16 items-center justify-center rounded-md border-2 border-dashed bg-muted/30 text-xs text-muted-foreground">
            Photo evidence
          </div>
        </div>
      );
    default:
      // Containers handled above; isNonAnswerable narrows further.
      if (isNonAnswerable(item.type)) return null;
      return labelEl;
  }
}
