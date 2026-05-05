import {
  Bandage,
  Activity,
  AlertTriangle,
  Hammer,
  Droplets,
  ShieldAlert,
  Eye,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const INCIDENT_TYPES = [
  "injury",
  "illness",
  "near_miss",
  "property_damage",
  "environmental_release",
  "unsafe_condition",
  "observation",
  "dangerous_occurrence",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];

export type IncidentTypeMeta = {
  key: IncidentType;
  label: string;
  description: string;
  icon: LucideIcon;
};

export const INCIDENT_TYPE_META: Record<IncidentType, IncidentTypeMeta> = {
  injury:                { key: "injury",                label: "Injury",                description: "A worker was hurt at work.",                                          icon: Bandage },
  illness:               { key: "illness",               label: "Illness",               description: "A worker became sick from a workplace exposure.",                     icon: Activity },
  near_miss:             { key: "near_miss",             label: "Near-miss",             description: "Something almost caused harm but did not.",                            icon: AlertTriangle },
  property_damage:       { key: "property_damage",       label: "Property damage",       description: "Equipment, machine, or building was damaged.",                         icon: Hammer },
  environmental_release: { key: "environmental_release", label: "Environmental release", description: "A spill, leak, or release to air, water, or soil.",                   icon: Droplets },
  unsafe_condition:      { key: "unsafe_condition",      label: "Unsafe condition",      description: "A dangerous situation found before anyone was hurt.",                 icon: ShieldAlert },
  observation:           { key: "observation",           label: "Observation",           description: "A general safety note — positive or negative.",                       icon: Eye },
  dangerous_occurrence:  { key: "dangerous_occurrence",  label: "Dangerous occurrence",  description: "A serious event that UK rules (RIDDOR Schedule 2) require us to report.", icon: Zap },
};

export const PPE_OPTIONS = [
  "Safety glasses",
  "Hard hat",
  "Hearing protection",
  "Gloves",
  "Steel-toe boots",
  "High-vis vest",
  "Respirator",
  "Face shield",
  "Harness / fall protection",
  "Cut-resistant sleeves",
] as const;
