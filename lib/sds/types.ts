import type { HazardCategory, ControlLevel } from "@/lib/risk/types";

export type GhsPictogramCode =
  | "GHS01" // Explosive
  | "GHS02" // Flammable
  | "GHS03" // Oxidizing
  | "GHS04" // Compressed gas
  | "GHS05" // Corrosive
  | "GHS06" // Toxic
  | "GHS07" // Irritant / harmful
  | "GHS08" // Health hazard
  | "GHS09"; // Environmental hazard

export type DummySdsHazard = {
  category: HazardCategory;
  title: string;
  description: string;
  /** GHS H-statement code (e.g. "H225 — Highly flammable liquid and vapour"). */
  h_statement: string;
};

export type DummySdsControl = {
  level: ControlLevel;
  description: string;
};

export type DummySds = {
  id: string;
  product_name: string;
  manufacturer: string;
  cas_number: string;
  ghs_pictograms: GhsPictogramCode[];
  signal_word: "danger" | "warning";
  hazards: DummySdsHazard[];
  suggested_controls: DummySdsControl[];
};

export const GHS_PICTOGRAM_NAME: Record<GhsPictogramCode, string> = {
  GHS01: "Explosive",
  GHS02: "Flammable",
  GHS03: "Oxidizing",
  GHS04: "Compressed gas",
  GHS05: "Corrosive",
  GHS06: "Toxic / acute toxicity",
  GHS07: "Irritant / harmful",
  GHS08: "Serious health hazard",
  GHS09: "Environmental hazard",
};
