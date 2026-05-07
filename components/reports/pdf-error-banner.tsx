import { AlertTriangle } from "lucide-react";

const COPY: Record<string, string> = {
  forbidden:
    "You don't have permission to export this report. Ask a site admin to grant the report:export permission.",
  not_recordable:
    "PDF is unavailable — this incident isn't OSHA-recordable.",
  not_riddor_jurisdiction:
    "PDF is unavailable — RIDDOR applies only to UK sites.",
  not_found:
    "We couldn't find this incident. It may have been removed.",
  render_failed:
    "PDF generation failed unexpectedly. Try again, or contact support if the problem persists.",
};

export function PdfErrorBanner({ code }: { code: string | null }) {
  if (!code) return null;
  const message = COPY[code] ?? "PDF generation didn't complete. Try again.";
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-md border-l-4 border-destructive bg-destructive/5 p-3 text-sm print:hidden"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">PDF unavailable</p>
        <p className="text-[11px] text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
