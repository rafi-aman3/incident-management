import { EmptyState } from "@/components/empty-state";

export default function InvestigationsKanbanPage() {
  return (
    <EmptyState
      title="Investigations Kanban coming in Phase 2"
      body="Drag-and-drop columns: pending → in_progress → awaiting_capa → closed."
    />
  );
}
