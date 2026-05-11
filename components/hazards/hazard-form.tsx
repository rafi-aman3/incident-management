"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createHazard } from "@/lib/actions/hazards";
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
import { HAZARD_CATEGORY_VALUES } from "@/lib/risk/types";

const HAZARD_SOURCE_VALUES = [
  "routine_activity",
  "non_routine_activity",
  "worker_report",
  "inspection",
  "past_incident",
  "change",
  "external_input",
] as const;

const SOURCE_LABEL: Record<string, string> = {
  routine_activity: "Routine activity",
  non_routine_activity: "Non-routine activity",
  worker_report: "Worker report",
  inspection: "Inspection",
  past_incident: "Past incident",
  change: "Management of change",
  external_input: "External input / advisory",
};

const CATEGORY_LABEL: Record<string, string> = {
  physical: "Physical",
  chemical: "Chemical",
  biological: "Biological",
  psychosocial: "Psychosocial",
  mechanical: "Mechanical",
  electrical: "Electrical",
  ergonomic: "Ergonomic",
  environmental: "Environmental",
};

export type HazardFormSite = {
  id: string;
  name: string;
};

export function HazardForm({
  sites,
  defaultSiteId,
}: {
  sites: HazardFormSite[];
  defaultSiteId: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [siteId, setSiteId] = useState<string>(defaultSiteId ?? sites[0]?.id ?? "");
  const [category, setCategory] = useState<string>("physical");
  const [source, setSource] = useState<string>("worker_report");

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const title = String(formData.get("title") ?? "").trim();
      const description = String(formData.get("description") ?? "").trim();
      const area = String(formData.get("area") ?? "").trim();
      if (!siteId) {
        setError("Pick a site.");
        return;
      }
      if (title.length < 3) {
        setError("Title is required.");
        return;
      }
      const result = await createHazard({
        site_id: siteId,
        title,
        description: description || null,
        area: area || null,
        hazard_category: category as (typeof HAZARD_CATEGORY_VALUES)[number],
        hazard_source: source as (typeof HAZARD_SOURCE_VALUES)[number],
        affects_workers: [],
        affects_others: [],
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success(`Hazard ${result.data?.ref_code ?? "created"}`);
      router.push(`/hazards/${result.data?.id}`);
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
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required minLength={3} maxLength={160} placeholder="Short, specific name for this hazard" />
      </div>

      <div>
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea id="description" name="description" rows={3} placeholder="What's the hazard, when and how can workers be exposed?" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="category">Hazard category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger id="category"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HAZARD_CATEGORY_VALUES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="source">How identified</Label>
          <Select value={source} onValueChange={setSource}>
            <SelectTrigger id="source"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HAZARD_SOURCE_VALUES.map((s) => (
                <SelectItem key={s} value={s}>{SOURCE_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{error}</p>
      )}

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending}>Cancel</Button>
        <Button type="submit" disabled={pending || !siteId}>{pending ? "Creating…" : "Create hazard"}</Button>
      </div>

      <p className="text-xs text-muted-foreground">
        After creation you can add a risk assessment and controls from the hazard detail page.
      </p>
    </form>
  );
}
