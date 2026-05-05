import { EmptyState } from "@/components/empty-state";

export default async function IncidentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmptyState
      title={`Incident ${id}`}
      body="Detail view with timeline, triage modals (Assign / Escalate / Close) and severity override lands in Phase 1."
    />
  );
}
