"use client";

import { useActionState, useEffect } from "react";
import { Phone, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  recordHsePhoneCall,
  recordHseOnlineSubmission,
} from "@/app/(app)/reports/riddor-f2508/[incidentId]/actions";
import type { ActionResult } from "@/lib/incidents/schemas";

export type HseRecord = {
  phone_called_at: string | null;
  phoned_by_name: string | null;
  hse_phone_reference: string | null;
  written_submitted_at: string | null;
  riddor_online_reference: string | null;
} | null;

export function HseRecordCard({
  incidentId,
  record,
  canEdit,
}: {
  incidentId: string;
  record: HseRecord;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="border-b px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          HSE notification record
        </p>
        <h2 className="text-base font-semibold">Phone + written-submission timestamps</h2>
        <p className="text-[11px] text-muted-foreground">
          Filled in after each interaction with the HSE so we have an audit trail.
        </p>
      </div>
      <div className="divide-y text-sm">
        <PhoneRow
          incidentId={incidentId}
          record={record}
          canEdit={canEdit}
        />
        <OnlineRow
          incidentId={incidentId}
          record={record}
          canEdit={canEdit}
        />
      </div>
    </div>
  );
}

function PhoneRow({
  incidentId,
  record,
  canEdit,
}: {
  incidentId: string;
  record: HseRecord;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    recordHsePhoneCall,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success("Phone notification recorded");
    if (state?.ok === false) toast.error(state.error);
  }, [state]);

  if (record?.phone_called_at) {
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <Phone className="mt-0.5 h-4 w-4 text-success" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium">
            Phoned the HSE <CheckCircle2 className="h-3 w-3 text-success" />
          </p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(record.phone_called_at).toLocaleString()}
            {record.phoned_by_name && ` by ${record.phoned_by_name}`}
          </p>
          {record.hse_phone_reference && (
            <p className="mt-0.5 font-mono text-[11px]">
              Ref: {record.hse_phone_reference}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Mark phone notification recorded</p>
      </div>
      <input type="hidden" name="incident_id" value={incidentId} />
      <div className="space-y-1.5">
        <Label htmlFor="phone-ref">HSE phone reference</Label>
        <Input
          id="phone-ref"
          name="hse_phone_reference"
          required
          maxLength={120}
          placeholder="e.g. HSE-2026-1234"
          disabled={!canEdit}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || !canEdit}>
          {isPending ? "Saving…" : "Mark recorded"}
        </Button>
      </div>
    </form>
  );
}

function OnlineRow({
  incidentId,
  record,
  canEdit,
}: {
  incidentId: string;
  record: HseRecord;
  canEdit: boolean;
}) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    recordHseOnlineSubmission,
    null
  );

  useEffect(() => {
    if (state?.ok) toast.success("Online submission recorded");
    if (state?.ok === false) toast.error(state.error);
  }, [state]);

  if (record?.written_submitted_at) {
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <FileText className="mt-0.5 h-4 w-4 text-success" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-sm font-medium">
            F2508 submitted online <CheckCircle2 className="h-3 w-3 text-success" />
          </p>
          <p className="text-[11px] text-muted-foreground">
            {new Date(record.written_submitted_at).toLocaleString()}
          </p>
          {record.riddor_online_reference && (
            <p className="mt-0.5 font-mono text-[11px]">
              Ref: {record.riddor_online_reference}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-2 px-4 py-3">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-medium">Mark online submission recorded</p>
      </div>
      <input type="hidden" name="incident_id" value={incidentId} />
      <div className="space-y-1.5">
        <Label htmlFor="online-ref">RIDDOR online reference</Label>
        <Input
          id="online-ref"
          name="riddor_online_reference"
          required
          maxLength={120}
          placeholder="e.g. RIDDOR-9876543"
          disabled={!canEdit}
        />
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={isPending || !canEdit}>
          {isPending ? "Saving…" : "Mark recorded"}
        </Button>
      </div>
    </form>
  );
}
