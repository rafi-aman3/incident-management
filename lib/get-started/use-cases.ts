import {
  AlertOctagon,
  ClipboardSignature,
  TriangleAlert,
  Boxes,
  CalendarDays,
  type LucideIcon,
} from "lucide-react";

/**
 * Use-case keys persisted in orgs.onboarding_use_cases. Editing this list
 * is a schema-touching change — keep keys stable. Server actions validate
 * against this enum.
 */
export const USE_CASE_KEYS = [
  "incidents",
  "inspections",
  "hazards_jsa",
  "assets_documents",
  "planner",
] as const;

export type UseCaseKey = (typeof USE_CASE_KEYS)[number];

export type UseCaseDef = {
  key: UseCaseKey;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const USE_CASES: ReadonlyArray<UseCaseDef> = [
  {
    key: "incidents",
    label: "Report & investigate incidents",
    description: "Capture events, run 5-Whys, manage CAPA, file OSHA / RIDDOR.",
    icon: AlertOctagon,
  },
  {
    key: "inspections",
    label: "Run inspections",
    description: "Build templates, schedule recurring rounds, log findings.",
    icon: ClipboardSignature,
  },
  {
    key: "hazards_jsa",
    label: "Manage hazards & JSA",
    description: "Hazard register, controls, job safety analyses, SDS imports.",
    icon: TriangleAlert,
  },
  {
    key: "assets_documents",
    label: "Track assets & documents",
    description: "Equipment registry, attached docs, lifecycle tracking.",
    icon: Boxes,
  },
  {
    key: "planner",
    label: "Schedule recurring work",
    description: "Planner calendar for inspections, JSA reviews, control checks.",
    icon: CalendarDays,
  },
];

export function isUseCaseKey(value: unknown): value is UseCaseKey {
  return (
    typeof value === "string" &&
    (USE_CASE_KEYS as readonly string[]).includes(value)
  );
}
