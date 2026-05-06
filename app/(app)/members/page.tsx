import { EmptyState } from "@/components/empty-state";

// TODO(phase-08): gate with can('member:invite', siteId) and render the
// real members surface (team list, invite flow, role assignments,
// per-site membership management).
export default function MembersPage() {
  return (
    <EmptyState
      title="Members coming in Phase 08"
      body="Team member list, invite flow, role assignments, and per-site membership management ship here."
    />
  );
}
