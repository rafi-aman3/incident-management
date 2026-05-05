import { EmptyState } from "@/components/empty-state";

export default async function CapaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <EmptyState
      title={`CAPA ${id}`}
      body="Verification flow with 4 outcomes (effective / partial / not / too-early) plus method picker lands in Phase 2."
    />
  );
}
