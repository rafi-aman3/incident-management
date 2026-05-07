import { redirect } from "next/navigation";

// The Phase 6l profile-dropdown wired this stub route. Phase 11b moves
// the real members surface into /admin/members and redirects here so the
// existing dropdown link starts working without the dropdown changing.
export default function MembersPage() {
  redirect("/admin/members");
}
