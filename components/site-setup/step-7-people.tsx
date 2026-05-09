"use client";

import { useActionState, useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { saveStep7 } from "@/app/(app)/admin/site-setup/actions";
import type { ActionResult } from "@/lib/site-setup/schemas";
import {
  clearPriorStepDraft,
  draftKey,
  pickFromDraft,
  useDraftPersistence,
  describeRestoredAt,
} from "@/lib/site-setup/use-draft-persistence";
import { DraftRestoredBanner, FieldError, StepFooter, StepFormError } from "./wizard-chrome";

type ProfileChoice = { id: string; full_name: string | null; email: string };

type EmergencyContact = {
  name: string;
  role: string;
  phone: string;
  email: string;
};

type Initial = {
  country: "US" | "GB";
  site_ehs_lead_id: string | null;
  riddor_responsible_person_name: string | null;
  riddor_responsible_person_role: string | null;
  emergency_contacts: EmergencyContact[];
  members: ProfileChoice[];
};

function parseDraftContacts(rawJson: string | string[] | undefined): EmergencyContact[] | null {
  if (typeof rawJson !== "string" || !rawJson) return null;
  try {
    const parsed = JSON.parse(rawJson) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.map((c) => {
      const obj = c as Partial<EmergencyContact>;
      return {
        name: typeof obj.name === "string" ? obj.name : "",
        role: typeof obj.role === "string" ? obj.role : "",
        phone: typeof obj.phone === "string" ? obj.phone : "",
        email: typeof obj.email === "string" ? obj.email : "",
      };
    });
  } catch {
    return null;
  }
}

export function Step7People({ initial, siteId }: { initial: Initial; siteId: string }) {
  const [state, formAction, isPending] = useActionState<ActionResult | null, FormData>(
    saveStep7,
    null
  );

  const { formRef, draft, restoredAt, clearAndReload } = useDraftPersistence(
    draftKey(siteId, "people")
  );
  useEffect(() => clearPriorStepDraft(siteId, "people"), [siteId]);

  const [ehsLead, setEhsLead] = useState(
    pickFromDraft(draft, "site_ehs_lead_id", initial.site_ehs_lead_id ?? "")
  );

  const draftContacts = parseDraftContacts(draft?.emergency_contacts_json);
  const [contacts, setContacts] = useState<EmergencyContact[]>(
    draftContacts && draftContacts.length > 0
      ? draftContacts
      : initial.emergency_contacts.length > 0
        ? initial.emergency_contacts
        : [{ name: "", role: "", phone: "", email: "" }]
  );

  const fieldErr = (k: string) =>
    state?.ok === false ? state.fieldErrors?.[k]?.[0] : undefined;

  const updateContact = (i: number, patch: Partial<EmergencyContact>) =>
    setContacts((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addContact = () =>
    setContacts((prev) => [...prev, { name: "", role: "", phone: "", email: "" }]);
  const removeContact = (i: number) =>
    setContacts((prev) => prev.filter((_, idx) => idx !== i));

  const cleanedContacts = contacts
    .map((c) => ({
      name: c.name.trim(),
      role: c.role.trim(),
      phone: c.phone.trim(),
      email: c.email.trim(),
    }))
    .filter((c) => c.name.length > 0 && (c.phone.length > 0 || c.email.length > 0));

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      <input type="hidden" name="country" value={initial.country} />

      {restoredAt && (
        <DraftRestoredBanner
          restoredAtLabel={describeRestoredAt(restoredAt)}
          onDiscard={clearAndReload}
        />
      )}

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Site EHS lead</legend>

        <p className="text-xs text-muted-foreground">
          Default escalation target for incidents and CAPAs at this site. Pick from existing
          members. To add someone first, use{" "}
          <a
            href="/admin/members"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Admin → Members
          </a>
          .
        </p>

        <div className="space-y-2">
          <Label htmlFor="site_ehs_lead_id">EHS lead</Label>
          <Select value={ehsLead} onValueChange={setEhsLead}>
            <SelectTrigger id="site_ehs_lead_id" className="w-full">
              <SelectValue placeholder="— pick the EHS lead —" />
            </SelectTrigger>
            <SelectContent>
              {initial.members.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.full_name ?? p.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <input type="hidden" name="site_ehs_lead_id" value={ehsLead} />
          <FieldError msg={fieldErr("site_ehs_lead_id")} />
        </div>
      </fieldset>

      {initial.country === "GB" && (
        <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
          <legend className="px-1 text-sm font-semibold">RIDDOR responsible person</legend>

          <p className="text-xs text-muted-foreground">
            RIDDOR puts the duty on a specific named "responsible person" — typically the
            employer for employees, or the person in control of premises for non-employees.
            Required on RIDDOR F2508 submissions.
          </p>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="riddor_responsible_person_name">Name</Label>
              <Input
                id="riddor_responsible_person_name"
                name="riddor_responsible_person_name"
                defaultValue={pickFromDraft(
                  draft,
                  "riddor_responsible_person_name",
                  initial.riddor_responsible_person_name ?? ""
                )}
                placeholder="Erin Manager"
              />
              <FieldError msg={fieldErr("riddor_responsible_person_name")} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="riddor_responsible_person_role">Role / title</Label>
              <Input
                id="riddor_responsible_person_role"
                name="riddor_responsible_person_role"
                defaultValue={pickFromDraft(
                  draft,
                  "riddor_responsible_person_role",
                  initial.riddor_responsible_person_role ?? ""
                )}
                placeholder="EHS Manager"
              />
              <FieldError msg={fieldErr("riddor_responsible_person_role")} />
            </div>
          </div>
        </fieldset>
      )}

      <fieldset className="space-y-4 rounded-md border bg-muted/20 p-4">
        <legend className="px-1 text-sm font-semibold">Emergency contacts</legend>

        <p className="text-xs text-muted-foreground">
          Reachable in an actual emergency — a phone or email is required for each.
        </p>

        <ul className="space-y-3">
          {contacts.map((contact, i) => (
            <li key={i} className="rounded-md border bg-background p-3">
              <div className="flex items-start gap-2">
                <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-name-${i}`} className="text-xs">
                      Name
                    </Label>
                    <Input
                      id={`contact-name-${i}`}
                      value={contact.name}
                      onChange={(e) => updateContact(i, { name: e.target.value })}
                      placeholder="Alex Admin"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-role-${i}`} className="text-xs">
                      Role
                    </Label>
                    <Input
                      id={`contact-role-${i}`}
                      value={contact.role}
                      onChange={(e) => updateContact(i, { role: e.target.value })}
                      placeholder="Plant Manager"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-phone-${i}`} className="text-xs">
                      Phone
                    </Label>
                    <Input
                      id={`contact-phone-${i}`}
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => updateContact(i, { phone: e.target.value })}
                      placeholder="+1 713 555 0100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`contact-email-${i}`} className="text-xs">
                      Email
                    </Label>
                    <Input
                      id={`contact-email-${i}`}
                      type="email"
                      value={contact.email}
                      onChange={(e) => updateContact(i, { email: e.target.value })}
                      placeholder="emergency@example.com"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeContact(i)}
                  aria-label={`Remove contact ${contact.name || i + 1}`}
                  className="mt-7 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={addContact}
          className="inline-flex items-center gap-1 rounded-md border border-dashed px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
        >
          <Plus className="h-4 w-4" /> Add contact
        </button>
      </fieldset>

      <input type="hidden" name="emergency_contacts_json" value={JSON.stringify(cleanedContacts)} />

      <StepFormError
        message={state?.ok === false ? state.error : undefined}
        isPending={isPending}
      />

      <StepFooter prevHref="/admin/site-setup/departments" isPending={isPending} />
    </form>
  );
}
