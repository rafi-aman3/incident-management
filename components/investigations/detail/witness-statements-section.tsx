import Link from "next/link";
import { MessageSquarePlus, MessageSquare } from "lucide-react";

export type WitnessStatement = {
  id: string;
  name: string;
  contact: string | null;
  statement: string | null;
};

export function WitnessStatementsSection({
  statements,
  basePath,
  canEdit,
}: {
  statements: WitnessStatement[];
  basePath: string;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Witness statements
          </p>
          <h2 className="text-base font-semibold">
            {statements.length} statement{statements.length === 1 ? "" : "s"}
          </h2>
          <p className="text-[11px] text-muted-foreground">
            Statements added at the incident phase carry over here automatically.
          </p>
        </div>
        {canEdit && (
          <Link
            href={`${basePath}?action=add-witness`}
            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent"
          >
            <MessageSquarePlus className="h-3 w-3" /> Add statement
          </Link>
        )}
      </div>
      <ul className="divide-y">
        {statements.length === 0 ? (
          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
            No witness statements yet.
          </li>
        ) : (
          statements.map((s) => (
            <li key={s.id} className="space-y-1 px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div>
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.contact && (
                    <span className="ml-2 text-[11px] text-muted-foreground">
                      {s.contact}
                    </span>
                  )}
                </div>
                <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              {s.statement && (
                <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-muted-foreground">
                  {s.statement}
                </p>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
