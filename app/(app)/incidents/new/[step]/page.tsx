import { EmptyState } from "@/components/empty-state";

export default async function ReportWizardPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = await params;
  return (
    <EmptyState
      title={`Report Incident — Step ${step}`}
      body="The 3-step Report Wizard (draft-row + per-step server actions) ships in Phase 1."
    />
  );
}
