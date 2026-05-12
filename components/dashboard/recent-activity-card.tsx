import Link from "next/link";
import { Sparkles, User2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type {
  ActivitySubjectKind,
  RecentActivityRow,
} from "@/lib/dashboard/org/recent-activity";

function subjectHref(kind: ActivitySubjectKind, id: string | null): string | null {
  if (!id) return null;
  switch (kind) {
    case "incident":
      return `/incidents/${id}`;
    case "investigation":
      return `/investigations/${id}`;
    case "capa":
      return `/capa/${id}`;
    case "inspection":
      return `/inspections/${id}`;
    case "finding":
      // Findings are nested under their inspection — link to inspection page;
      // page can deep-link the finding via anchor if needed later.
      return null;
    case "template":
      return `/templates/${id}`;
    case "asset":
      return `/resources/assets/${id}`;
    case "document":
      return `/resources/documents/${id}`;
    case "jsa":
      return `/jsa/${id}`;
    default:
      return null;
  }
}

const SUBJECT_LABEL: Record<ActivitySubjectKind, string> = {
  incident: "incident",
  investigation: "investigation",
  capa: "CAPA",
  template: "template",
  inspection: "inspection",
  finding: "finding",
  asset: "asset",
  document: "document",
  document_link: "document link",
  jsa: "JSA",
  other: "item",
};

function humanizeVerb(verb: string): string {
  return verb.replaceAll("_", " ").replaceAll(".", " · ");
}

export function RecentActivityCard({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <section className="rounded-md border bg-card">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold">Recent activity</h2>
        <span className="text-xs text-muted-foreground">
          {rows.length === 0 ? "—" : `${rows.length} latest`}
        </span>
      </div>
      {rows.length === 0 ? (
        <div className="p-8 text-center text-sm text-muted-foreground">No activity yet.</div>
      ) : (
        <ul className="divide-y">
          {rows.map((row) => {
            const href = subjectHref(row.subject_kind, row.subject_id);
            const isArgus = row.actor_kind === "argus";
            const subjectLabel = SUBJECT_LABEL[row.subject_kind];
            return (
              <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
                <div className="shrink-0">
                  {isArgus ? (
                    <Sparkles className="h-4 w-4 text-cyan-600" aria-hidden />
                  ) : (
                    <User2 className="h-4 w-4 text-muted-foreground" aria-hidden />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate">
                    <span className="font-medium">
                      {row.actor_name ?? (isArgus ? "Argus" : "Someone")}
                    </span>{" "}
                    <span className="text-muted-foreground">{humanizeVerb(row.verb)}</span>
                    {href ? (
                      <>
                        {" "}
                        <Link href={href} className="font-medium hover:underline">
                          {subjectLabel}
                        </Link>
                      </>
                    ) : (
                      <>
                        {" "}
                        <span className="font-medium">{subjectLabel}</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(row.created_at), { addSuffix: true })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
