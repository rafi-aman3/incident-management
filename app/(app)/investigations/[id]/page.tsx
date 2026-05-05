import { EmptyState } from "@/components/empty-state";

export default async function InvestigationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmptyState
      title={`Investigation ${id}`}
      body="5-Why chain, evidence uploads, and OSHA 301 draft banner ship in Phase 2."
    />
  );
}
