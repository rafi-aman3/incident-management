import { EmptyState } from "@/components/empty-state";

// TODO(phase-08): gate with can('settings:read', orgId) and render the
// real settings surface (org profile, regulatory profile, notification
// recipients, role editor).
export default function SettingsPage() {
  return (
    <EmptyState
      title="Settings coming in Phase 08"
      body="Workspace settings, regulatory profile, notification recipients, and role editor ship here."
    />
  );
}
