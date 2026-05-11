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
};

// Per-item `useCase` on CHECKLIST_ITEMS does the use-case filtering; sections
// themselves carry no gate. A section with no surviving items is dropped at
// render time by getChecklistState().
export const SECTIONS: ReadonlyArray<SectionDef> = [
  { key: "workspace", label: "Set up your workspace" },
  { key: "incidents", label: "Start using Incidents" },
  { key: "inspections", label: "Start using Inspections" },
  { key: "hazards_jsa", label: "Start using Hazards & JSA" },
  { key: "assets_documents", label: "Start using Assets & Documents" },
  { key: "planner", label: "Start using the Planner" },
  { key: "power_up", label: "Power up" },
];
