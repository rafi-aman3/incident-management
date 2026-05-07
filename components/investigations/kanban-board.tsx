"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { GripVertical, UserPlus2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SeverityBadge, TrackBadge } from "@/components/incidents/badges";
import { DueDateChip } from "@/components/investigations/badges";
import {
  INVESTIGATION_STATUSES,
  INVESTIGATION_STATUS_META,
  INVESTIGATION_TRANSITIONS,
  type InvestigationStatus,
} from "@/lib/investigations/types";
import type { InvestigationCardData } from "@/components/investigations/investigation-card-data";
import {
  advanceInvestigation,
  assignMeAsLead,
} from "@/app/(app)/investigations/actions";

const COLUMN_EMPTY_COPY: Record<InvestigationStatus, string> = {
  pending_assignment: "Nothing waiting for a lead.",
  in_progress: "No active investigations.",
  awaiting_capa: "No investigations awaiting CAPA.",
  closed: "Nothing closed yet.",
};

export function KanbanBoard({
  initialColumns,
  canSelfAssign,
}: {
  initialColumns: Record<InvestigationStatus, InvestigationCardData[]>;
  canSelfAssign: boolean;
}) {
  const [columns, setColumns] = useState(initialColumns);
  const [announcement, setAnnouncement] = useState("");
  const [isPending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const cardId = String(active.id);
    const target = String(over.id) as InvestigationStatus;
    const fromStatus = (Object.keys(columns) as InvestigationStatus[]).find(
      (s) => columns[s].some((c) => c.id === cardId),
    );
    if (!fromStatus || fromStatus === target) return;

    if (!INVESTIGATION_TRANSITIONS[fromStatus].includes(target)) {
      const msg = `Can't move from ${INVESTIGATION_STATUS_META[fromStatus].label} to ${INVESTIGATION_STATUS_META[target].label}`;
      toast.error(msg);
      setAnnouncement(msg);
      return;
    }

    const card = columns[fromStatus].find((c) => c.id === cardId);
    if (!card) return;

    // Optimistic update
    const next = { ...columns };
    next[fromStatus] = columns[fromStatus].filter((c) => c.id !== cardId);
    next[target] = [{ ...card, status: target }, ...columns[target]];
    setColumns(next);
    setAnnouncement(
      `Moved ${card.incident.ref_code ?? card.ref_code ?? "investigation"} to ${INVESTIGATION_STATUS_META[target].label}`,
    );

    startTransition(async () => {
      const result = await advanceInvestigation(cardId, target);
      if (!result.ok) {
        toast.error(result.error);
        setColumns(columns); // rollback
        setAnnouncement(`Move reverted: ${result.error}`);
      } else {
        toast.success(`Moved to ${INVESTIGATION_STATUS_META[target].label}`);
      }
    });
  }

  return (
    <div role="region" aria-label="Investigation kanban">
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div
          className={cn(
            "grid gap-4 sm:grid-cols-2 xl:grid-cols-4",
            isPending && "opacity-90",
          )}
        >
          {INVESTIGATION_STATUSES.map((status) => (
            <Column
              key={status}
              status={status}
              cards={columns[status]}
              canSelfAssign={canSelfAssign}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({
  status,
  cards,
  canSelfAssign,
}: {
  status: InvestigationStatus;
  cards: InvestigationCardData[];
  canSelfAssign: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = INVESTIGATION_STATUS_META[status];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[300px] flex-col rounded-lg border bg-muted/30",
        isOver && "ring-2 ring-primary",
      )}
    >
      <div className="border-b px-3 py-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-sm font-semibold">{meta.label}</h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {cards.length}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">{meta.description}</p>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {cards.length === 0 ? (
          <p className="my-6 px-2 text-center text-xs text-muted-foreground">
            {COLUMN_EMPTY_COPY[status]}
          </p>
        ) : (
          cards.map((c) => (
            <DraggableCard
              key={c.id}
              card={c}
              terminal={status === "closed"}
              canSelfAssign={canSelfAssign}
            />
          ))
        )}
      </div>
    </div>
  );
}

function DraggableCard({
  card,
  terminal,
  canSelfAssign,
}: {
  card: InvestigationCardData;
  terminal: boolean;
  canSelfAssign: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: card.id, disabled: terminal });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const showAssignMe =
    canSelfAssign &&
    card.lead_investigator_id === null &&
    card.status === "pending_assignment";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "rounded-md border bg-card p-3 shadow-sm",
        isDragging && "opacity-60 shadow-lg",
      )}
    >
      <div className="flex items-start gap-2">
        <button
          {...listeners}
          {...attributes}
          aria-label={
            terminal ? "Closed — drag disabled" : `Drag investigation ${card.ref_code ?? ""}`
          }
          disabled={terminal}
          className={cn(
            "mt-0.5 touch-none rounded p-0.5 text-muted-foreground hover:bg-muted",
            terminal ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing",
          )}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/investigations/${card.id}`}
              className="font-mono text-[11px] text-muted-foreground hover:underline"
            >
              {card.ref_code ?? "—"}
            </Link>
            {card.incident.severity && <SeverityBadge severity={card.incident.severity} />}
            {card.incident.track && <TrackBadge track={card.incident.track} />}
          </div>
          <Link
            href={`/investigations/${card.id}`}
            className="mt-1 line-clamp-2 block text-sm font-medium hover:underline"
          >
            {card.incident.title}
          </Link>
          <div className="mt-2 flex items-center justify-between gap-2">
            <LeadAvatar lead={card.lead} />
            <DueDateChip dueDate={card.due_date} />
          </div>
          {showAssignMe && (
            <AssignMeButton investigationId={card.id} />
          )}
        </div>
      </div>
    </div>
  );
}

function AssignMeButton({ investigationId }: { investigationId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await assignMeAsLead(investigationId);
          if (result.ok) {
            toast.success("You're the lead now");
          } else {
            toast.error(result.error);
          }
        })
      }
      className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-primary/40 px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
    >
      <UserPlus2 className="h-3 w-3" />
      {pending ? "Assigning…" : "Assign me as lead"}
    </button>
  );
}

function LeadAvatar({ lead }: { lead: InvestigationCardData["lead"] }) {
  if (!lead) {
    return <span className="text-[11px] italic text-muted-foreground">unassigned</span>;
  }
  const name = lead.full_name ?? lead.email;
  const initials = computeInitials(name);
  return (
    <div className="flex items-center gap-1.5">
      <Avatar className="h-5 w-5">
        <AvatarFallback className="text-[9px]">{initials}</AvatarFallback>
      </Avatar>
      <span className="truncate text-[11px] text-muted-foreground">{name}</span>
    </div>
  );
}

function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
