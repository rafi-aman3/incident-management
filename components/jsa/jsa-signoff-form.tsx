"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { signOffJsa } from "@/lib/actions/jsa";

const SESSION_SUGGESTIONS = ["morning", "afternoon", "evening", "night"];

export function JsaSignoffForm({
  jsaId,
  disabled,
  disabledReason,
}: {
  jsaId: string;
  disabled: boolean;
  disabledReason?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [session, setSession] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit() {
    setError(null);
    startTransition(async () => {
      const result = await signOffJsa(jsaId, {
        signed_for_session: session.trim() || null,
        notes: notes.trim() || null,
      });
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Sign-off recorded");
      setSession("");
      setNotes("");
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold flex items-center gap-1">
          <CheckCircle2 className="h-4 w-4 text-success" /> Confirm sign-off
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Sign here to confirm you've read the JSA and will follow the controls listed. One sign-off per shift session.
        </p>
      </div>

      <div>
        <Label htmlFor="session">Shift session (optional)</Label>
        <Input
          id="session"
          list="session-suggestions"
          value={session}
          onChange={(e) => setSession(e.target.value)}
          placeholder="e.g. morning"
          disabled={disabled || pending}
        />
        <datalist id="session-suggestions">
          {SESSION_SUGGESTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anything different today?"
          disabled={disabled || pending}
        />
      </div>

      {error && (
        <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {disabled && disabledReason && (
        <p className="rounded-md border border-warning/30 bg-warning/5 p-3 text-sm">
          {disabledReason}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={onSubmit} disabled={disabled || pending}>
          {pending ? "Recording…" : "Sign off & start work"}
        </Button>
      </div>
    </div>
  );
}
