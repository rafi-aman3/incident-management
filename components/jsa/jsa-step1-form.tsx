"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createJsaDraft } from "@/lib/actions/jsa";
import { JSA_FREQUENCY_VALUES } from "@/lib/actions/jsa-schemas";

const FREQ_LABEL: Record<(typeof JSA_FREQUENCY_VALUES)[number], string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  as_needed: "As needed",
  one_off: "One-off",
  continuous: "Continuous",
};

export type JsaSite = { id: string; name: string };

export function JsaStep1Form({
  sites,
  defaultSiteId,
}: {
  sites: JsaSite[];
  defaultSiteId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string>(defaultSiteId ?? sites[0]?.id ?? "");
  const [frequency, setFrequency] = useState<string>("as_needed");
  const [rolesText, setRolesText] = useState("");
  const [ppeText, setPpeText] = useState("");
  const [permitsText, setPermitsText] = useState("");

  function parseList(s: string): string[] {
    return s
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
  }

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const title = String(formData.get("title") ?? "").trim();
      const jobDescription = String(formData.get("job_description") ?? "").trim();
      const area = String(formData.get("area") ?? "").trim();
      const duration = String(formData.get("duration") ?? "").trim();

      if (!siteId) return setError("Pick a site.");
      if (title.length < 3) return setError("Title is required.");

      const result = await createJsaDraft({
        site_id: siteId,
        title,
        job_description: jobDescription || null,
        area: area || null,
        performed_by_roles: parseList(rolesText),
        performed_by_workgroups: [],
        frequency: frequency as (typeof JSA_FREQUENCY_VALUES)[number],
        estimated_duration_minutes: duration ? parseInt(duration, 10) || null : null,
        ppe_required: parseList(ppeText),
        permits_required: parseList(permitsText),
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`JSA ${result.data?.ref_code ?? "drafted"}`);
      router.push(`/jsa/${result.data?.id}/edit?step=steps`);
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="site">Site</Label>
          <Select value={siteId} onValueChange={setSiteId}>
            <SelectTrigger id="site"><SelectValue placeholder="Pick a site" /></SelectTrigger>
            <SelectContent>
              {sites.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="area">Area (optional)</Label>
          <Input id="area" name="area" placeholder="e.g. Production line 3" />
        </div>
      </div>

      <div>
        <Label htmlFor="title">Job title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={200} placeholder="e.g. Changing hydraulic press cylinder" />
      </div>

      <div>
        <Label htmlFor="job_description">Job description (optional)</Label>
        <Textarea
          id="job_description"
          name="job_description"
          rows={3}
          placeholder="What does this job involve at a high level?"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="frequency">Frequency</Label>
          <Select value={frequency} onValueChange={setFrequency}>
            <SelectTrigger id="frequency"><SelectValue /></SelectTrigger>
            <SelectContent>
              {JSA_FREQUENCY_VALUES.map((f) => (
                <SelectItem key={f} value={f}>{FREQ_LABEL[f]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="duration">Estimated duration (minutes)</Label>
          <Input id="duration" name="duration" type="number" min={1} placeholder="e.g. 90" />
        </div>
      </div>

      <div>
        <Label htmlFor="roles">Performed by (roles, comma-separated)</Label>
        <Input
          id="roles"
          value={rolesText}
          onChange={(e) => setRolesText(e.target.value)}
          placeholder="e.g. Maintenance Tech, Supervisor"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="ppe">PPE required (comma-separated)</Label>
          <Input
            id="ppe"
            value={ppeText}
            onChange={(e) => setPpeText(e.target.value)}
            placeholder="e.g. Hard hat, Safety glasses, Gloves"
          />
        </div>
        <div>
          <Label htmlFor="permits">Permits referenced (comma-separated, metadata only)</Label>
          <Input
            id="permits"
            value={permitsText}
            onChange={(e) => setPermitsText(e.target.value)}
            placeholder="e.g. Hot Work, Confined Space"
          />
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.push("/jsa")} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending || !siteId}>
          {pending ? "Creating…" : "Next — add steps"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Permits listed here are descriptive metadata only — not a permit-issuance workflow.
      </p>
    </form>
  );
}
