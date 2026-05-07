import Link from "next/link";
import { format } from "date-fns";
import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChangeRoleDialog } from "@/components/admin/change-role-dialog";
import { RemoveMemberDialog } from "@/components/admin/remove-member-dialog";
import type { RoleOption } from "@/components/admin/add-member-dialog";

export type MembershipRow = {
  site_id: string;
  site_name: string;
  site_archived_at: string | null;
  role_id: string;
  role_key: string;
  role_name: string;
  include_children: boolean;
  created_at: string;
  /** Whether this row is the only site_admin row on its site. */
  is_last_site_admin: boolean;
};

export function MemberMembershipsTable({
  profileId,
  memberName,
  rows,
  roles,
  canManageBySite,
}: {
  profileId: string;
  memberName: string;
  rows: MembershipRow[];
  roles: RoleOption[];
  /** Map of site_id → boolean indicating whether the acting admin can
   *  manage members on that site. The Change role + Remove affordances
   *  appear only when this is true. */
  canManageBySite: Map<string, boolean>;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Not a member of any site yet.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Site</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Include children</TableHead>
            <TableHead>Since</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const canManage = canManageBySite.get(row.site_id) ?? false;
            const archived = row.site_archived_at !== null;
            return (
              <TableRow key={row.site_id}>
                <TableCell>
                  <Link
                    href={`/admin/sites/${row.site_id}?tab=members`}
                    className="inline-flex items-center gap-1 font-medium hover:underline"
                  >
                    {row.site_name}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </Link>
                  {archived && (
                    <p className="text-[11px] text-muted-foreground">archived</p>
                  )}
                </TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium">
                    {row.role_name}
                  </span>
                  {row.is_last_site_admin && (
                    <span
                      className="ml-1 text-[10px] text-muted-foreground"
                      aria-label="Last site admin — protected"
                    >
                      · last admin
                    </span>
                  )}
                </TableCell>
                <TableCell>
                  {row.include_children ? (
                    <span className="text-xs">Yes</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">No</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {format(new Date(row.created_at), "PP")}
                </TableCell>
                <TableCell className="text-right">
                  {canManage && !archived ? (
                    <div className="inline-flex items-center gap-1">
                      <ChangeRoleDialog
                        siteId={row.site_id}
                        profileId={profileId}
                        memberName={memberName}
                        currentRoleId={row.role_id}
                        currentIncludeChildren={row.include_children}
                        roles={roles}
                      />
                      <RemoveMemberDialog
                        siteId={row.site_id}
                        profileId={profileId}
                        memberName={memberName}
                        isLastSiteAdmin={row.is_last_site_admin}
                      />
                    </div>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
