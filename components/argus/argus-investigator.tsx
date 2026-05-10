"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
import {
  ArgusInvestigatorInput,
  type InvestigatorSeed,
  type InvestigatorExistingWitness,
} from "./argus-investigator-input";
import {
  ArgusInvestigatorOutput,
  type InvestigatorExisting,
} from "./argus-investigator-output";
import {
  useArgusInvestigatorStream,
  type InvestigatorWitnessAdd,
} from "./use-argus-investigator-stream";

/**
 * Phase 9c — AI Investigator workspace mounted on `/investigations/[id]?tab=ai`.
 *
 * Flow:
 *   1. User reviews the read-only seed (incident description, type, area, occurredAt)
 *      and existing witness statements (initials only).
 *   2. User pastes additional context and/or adds new witness statements
 *      (text or voice). Witnesses stay client-side until first Push.
 *   3. User clicks Generate → POST /api/argus/investigator → Sonnet 4.6 with
 *      forced tool_choice → SSE returns a structured draft.
 *   4. User reviews + edits the four output cards (Timeline / 5-Why / Root
 *      cause / Findings). Per-card Push commits via the existing
 *      saveInvestigationText / saveWhy actions and flips the suggestion
 *      outcome (accepted vs edited based on diff). Reject closes the card
 *      without writing. Discard rejects the whole draft.
 *
 * No DB writes happen on Generate — only on Push. That's the
 * review-and-edit gate per `feedback_argus_assistive_only`.
 */
export function ArgusInvestigator({
  investigationId,
  seed,
  existingWitnesses,
  existing,
}: {
  investigationId: string;
  seed: InvestigatorSeed;
  existingWitnesses: InvestigatorExistingWitness[];
  existing: InvestigatorExisting;
}) {
  const [paste, setPaste] = useState("");
  const [witnessAdds, setWitnessAdds] = useState<InvestigatorWitnessAdd[]>([]);
  const stream = useArgusInvestigatorStream();

  function handleGenerate() {
    const witnesses = witnessAdds.filter(
      (w) => w.name.trim().length > 0 && w.statement.trim().length > 0,
    );
    void stream.generate({
      investigationId,
      paste,
      witnessAdds: witnesses,
    });
  }

  return (
    <div className="space-y-4">
      <ArgusInvestigatorInput
        seed={seed}
        existingWitnesses={existingWitnesses}
        paste={paste}
        onPasteChange={setPaste}
        witnessAdds={witnessAdds}
        onWitnessAddsChange={setWitnessAdds}
        phase={stream.state.phase}
        onGenerate={handleGenerate}
      />

      {stream.state.phase === "error" && stream.state.error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <p className="flex items-center gap-2 font-medium text-destructive">
            <AlertCircle className="h-4 w-4" /> {stream.state.error}
          </p>
        </div>
      )}

      {stream.state.phase === "done" && stream.state.draft && stream.state.suggestionId && (
        <ArgusInvestigatorOutput
          investigationId={investigationId}
          draft={stream.state.draft}
          suggestionId={stream.state.suggestionId}
          insufficientReason={stream.state.insufficientReason}
          existing={existing}
          onDiscard={() => stream.reset()}
        />
      )}
    </div>
  );
}
