import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { SeverityBadge, TrackBadge } from "@/components/incidents/badges";
import { INCIDENT_TYPE_META, type IncidentType } from "@/lib/incidents/types";

export type IncidentSummaryData = {
  id: string;
  ref_code: string | null;
  type: string;
  title: string;
  description: string | null;
  occurred_at: string;
  area: string | null;
  location: string | null;
  severity: "S1" | "S2" | "S3" | "S4" | "S5" | null;
  track: "A" | "B" | "C" | null;
  classified_at: string | null;
  reporter: { full_name: string | null; email: string } | null;
  injured: Array<{ name: string; treatment: string | null }>;
};

export function IncidentSummaryCard({ incident }: { incident: IncidentSummaryData }) {
  const meta = INCIDENT_TYPE_META[incident.type as IncidentType];
  const TypeIcon = meta?.icon;

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Incident summary (frozen snapshot)
          </p>
          <h2 className="text-base font-semibold">{incident.title}</h2>
        </div>
        <Link
          href={`/incidents/${incident.id}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Open incident <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
      <div className="space-y-2 px-4 py-3 text-sm">
        <Row
          label="Type"
          value={
            <span className="inline-flex items-center gap-1.5">
              {TypeIcon && <TypeIcon className="h-4 w-4 text-muted-foreground" />}
              {meta?.label ?? incident.type}
            </span>
          }
        />
        <Row label="Ref" value={<span className="font-mono text-xs">{incident.ref_code ?? "—"}</span>} />
        <Row label="When" value={new Date(incident.occurred_at).toLocaleString()} />
        <Row
          label="Where"
          value={[incident.area, incident.location].filter(Boolean).join(" / ") || "—"}
        />
        <Row
          label="Reporter"
          value={incident.reporter?.full_name ?? incident.reporter?.email ?? "—"}
        />
        <Row
          label="Severity / track"
          value={
            <span className="inline-flex items-center gap-2">
              <SeverityBadge severity={incident.severity} />
              <TrackBadge track={incident.track} />
            </span>
          }
        />
        {incident.injured.length > 0 && (
          <Row
            label={incident.injured.length === 1 ? "Injured" : `Injured (${incident.injured.length})`}
            value={
              <ul className="space-y-0.5">
                {incident.injured.map((p, i) => (
                  <li key={i}>
                    <span className="font-medium">{p.name}</span>
                    {p.treatment && (
                      <span className="text-muted-foreground"> · {p.treatment}</span>
                    )}
                  </li>
                ))}
              </ul>
            }
          />
        )}
        {incident.description && (
          <div className="border-t pt-2 text-muted-foreground">
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed">
              {incident.description}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value}</dd>
    </div>
  );
}
