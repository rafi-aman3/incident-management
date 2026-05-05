"use client";

import { useActionState } from "react";
import { saveStep5 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import { StepFooter } from "./wizard-chrome";

export type SiteMember = {
  profile_id: string;
  full_name: string | null;
  email: string;
  role_key: string;
  role_name: string;
  include_children: boolean;
};

export function Step5Users({ members }: { members: SiteMember[] }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    async () => saveStep5(),
    null
  );

  return (
    <form action={formAction} className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm text-muted-foreground">
          People with access to this site. Email-based invite flow ships in the next phase — for the
          v1 demo, manage memberships via the seed script or directly in the database.
        </p>
      </div>

      {members.length === 0 ? (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          No members yet. Add some via <code>scripts/seed.ts</code> or the Supabase dashboard.
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {members.map((m) => (
            <li key={m.profile_id} className="flex items-center justify-between gap-4 px-4 py-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{m.full_name ?? m.email}</div>
                <div className="truncate text-xs text-muted-foreground">{m.email}</div>
              </div>
              <div className="text-right text-sm">
                <div>{m.role_name}</div>
                {m.include_children && (
                  <div className="text-xs text-muted-foreground">+ child sites</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {state?.ok === false && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <StepFooter prevHref="/admin/site-setup/4" isPending={isPending} />
    </form>
  );
}
