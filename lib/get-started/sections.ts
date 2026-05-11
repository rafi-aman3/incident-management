import type { UseCaseKey } from "./use-cases";

export const SECTION_KEYS = [
  "workspace",
  "incidents",
  "inspections",
  "hazards_jsa",
  "assets_documents",
  "planner",
  "power_up",
] as const;

export type SectionKey = (typeof SECTION_KEYS)[number];

export type SectionDef = {
  key: SectionKey;
  label: string;
  /** When set, the section is only included if the org picked this use-case. */
  requiresUseCase?: UseCaseKey;
};

export const SECTIONS: ReadonlyArray<SectionDef> = [
  { key: "workspace", label: "Set up your workspace" },
  { key: "incidents", label: "Start using Incidents", requiresUseCase: "incidents" },
  { key: "inspections", label: "Start using Inspections", requiresUseCase: "inspections" },
  { key: "hazards_jsa", label: "Start using Hazards & JSA", requiresUseCase: "hazards_jsa" },
  { key: "assets_documents", label: "Start using Assets & Documents", requiresUseCase: "assets_documents" },
  { key: "planner", label: "Start using the Planner", requiresUseCase: "planner" },
  { key: "power_up", label: "Power up" },
];
