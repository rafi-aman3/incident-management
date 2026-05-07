"use server";

// Re-exports for the org-wide /admin/members and /admin/members/[profileId]
// surfaces. They share the same RPC wrappers as the per-site Members tab on
// /admin/sites/[id]?tab=members.
export {
  addSiteMember,
  changeSiteMemberRole,
  removeSiteMember,
} from "@/app/(app)/admin/sites/[id]/members-actions";
