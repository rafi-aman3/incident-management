"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Body-part picker. v1 ships an SVG-style layout (front view) with each
 * region rendered as a click target so the data shape matches OSHA 300
 * Column E + RIDDOR canonical body parts. A more anatomical SVG silhouette
 * is a Phase 2 polish task.
 */

export type BodyPart =
  | "head" | "neck" | "chest" | "abdomen" | "back"
  | "left_arm" | "right_arm" | "left_hand" | "right_hand"
  | "left_leg" | "right_leg" | "left_foot" | "right_foot"
  | "left_eye" | "right_eye" | "other";

export const BODY_PART_LABELS: Record<BodyPart, string> = {
  head: "Head",
  neck: "Neck",
  chest: "Chest",
  abdomen: "Abdomen",
  back: "Back",
  left_arm: "L arm",
  right_arm: "R arm",
  left_hand: "L hand",
  right_hand: "R hand",
  left_leg: "L leg",
  right_leg: "R leg",
  left_foot: "L foot",
  right_foot: "R foot",
  left_eye: "L eye",
  right_eye: "R eye",
  other: "Other",
};

type Props = {
  value: BodyPart[];
  onChange: (next: BodyPart[]) => void;
};

export function BodyMap({ value, onChange }: Props) {
  const groupId = useId();
  const selected = new Set(value);
  const toggle = (p: BodyPart) => {
    const next = new Set(selected);
    if (next.has(p)) next.delete(p);
    else next.add(p);
    onChange([...next]);
  };

  // Layout: rough body silhouette using a CSS grid. Each cell renders a
  // button that toggles the corresponding body part. The mirrored left/right
  // columns echo a front-facing view.
  return (
    <div className="space-y-3">
      <div
        className="mx-auto grid w-fit grid-cols-3 gap-2"
        role="group"
        aria-label="Body parts"
      >
        {/* Head row */}
        <div />
        <Region groupId={groupId} part="head" selected={selected.has("head")} onToggle={toggle} />
        <div />

        {/* Eyes row */}
        <Region groupId={groupId} part="left_eye" selected={selected.has("left_eye")} onToggle={toggle} />
        <Region groupId={groupId} part="neck" selected={selected.has("neck")} onToggle={toggle} />
        <Region groupId={groupId} part="right_eye" selected={selected.has("right_eye")} onToggle={toggle} />

        {/* Arms / chest */}
        <Region groupId={groupId} part="left_arm" selected={selected.has("left_arm")} onToggle={toggle} />
        <Region groupId={groupId} part="chest" selected={selected.has("chest")} onToggle={toggle} />
        <Region groupId={groupId} part="right_arm" selected={selected.has("right_arm")} onToggle={toggle} />

        {/* Hands / abdomen */}
        <Region groupId={groupId} part="left_hand" selected={selected.has("left_hand")} onToggle={toggle} />
        <Region groupId={groupId} part="abdomen" selected={selected.has("abdomen")} onToggle={toggle} />
        <Region groupId={groupId} part="right_hand" selected={selected.has("right_hand")} onToggle={toggle} />

        {/* Legs */}
        <Region groupId={groupId} part="left_leg" selected={selected.has("left_leg")} onToggle={toggle} />
        <Region groupId={groupId} part="back" selected={selected.has("back")} onToggle={toggle} />
        <Region groupId={groupId} part="right_leg" selected={selected.has("right_leg")} onToggle={toggle} />

        {/* Feet */}
        <Region groupId={groupId} part="left_foot" selected={selected.has("left_foot")} onToggle={toggle} />
        <div />
        <Region groupId={groupId} part="right_foot" selected={selected.has("right_foot")} onToggle={toggle} />
      </div>

      <div className="flex justify-center">
        <Region
          groupId={groupId}
          part="other"
          selected={selected.has("other")}
          onToggle={toggle}
          wide
        />
      </div>

      {value.length > 0 && (
        <p className="text-xs text-muted-foreground" aria-live="polite">
          Selected: {value.map((p) => BODY_PART_LABELS[p]).join(", ")}
        </p>
      )}
    </div>
  );
}

function Region({
  groupId,
  part,
  selected,
  onToggle,
  wide,
}: {
  groupId: string;
  part: BodyPart;
  selected: boolean;
  onToggle: (p: BodyPart) => void;
  wide?: boolean;
}) {
  return (
    <button
      id={`${groupId}-${part}`}
      type="button"
      aria-pressed={selected}
      onClick={() => onToggle(part)}
      className={cn(
        "rounded-md border text-xs font-medium transition-colors",
        wide ? "px-4 py-2" : "h-12 w-20",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent"
      )}
    >
      {BODY_PART_LABELS[part]}
    </button>
  );
}
