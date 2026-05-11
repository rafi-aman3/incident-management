/**
 * Phase 16 SDS Manager stub catalog.
 *
 * Six hardcoded chemicals with realistic GHS pictograms, signal words,
 * H-statements, and suggested controls. Lives here in TypeScript rather
 * than a DB table per SPEC §SDS-INTEGRATION — the stub-to-real-API swap
 * is a single function replacement in lib/actions/sds.ts.
 */

import type { DummySds } from "./types";

export const DUMMY_SDS_CATALOG: readonly DummySds[] = [
  {
    id: "SDS-TOL-001",
    product_name: "Toluene",
    manufacturer: "Acme Chemicals",
    cas_number: "108-88-3",
    ghs_pictograms: ["GHS02", "GHS07", "GHS08"],
    signal_word: "danger",
    hazards: [
      {
        category: "chemical",
        title: "Toluene — flammable liquid",
        description: "Highly flammable liquid and vapour. Risk of fire and explosion when stored or used near ignition sources.",
        h_statement: "H225 — Highly flammable liquid and vapour",
      },
      {
        category: "chemical",
        title: "Toluene — skin irritation",
        description: "Causes skin irritation on repeated or prolonged contact.",
        h_statement: "H315 — Causes skin irritation",
      },
      {
        category: "chemical",
        title: "Toluene — reproductive toxicity",
        description: "Suspected of damaging the unborn child via inhalation or skin absorption.",
        h_statement: "H361d — Suspected of damaging the unborn child",
      },
      {
        category: "chemical",
        title: "Toluene — drowsiness / dizziness",
        description: "Vapour inhalation may cause drowsiness, dizziness, and impaired motor function.",
        h_statement: "H336 — May cause drowsiness or dizziness",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Install local exhaust ventilation at the work bay; maintain capture velocity ≥0.5 m/s and verify quarterly." },
      { level: "engineering", description: "Use grounded transfer containers and bonded dispensing equipment to prevent static ignition." },
      { level: "administrative", description: "Restrict open-handling to a dedicated solvent room; require permit-to-work for tasks >250 mL." },
      { level: "ppe", description: "Chemical-resistant gloves (nitrile, ≥0.4 mm) and ANSI Z87.1 splash goggles when handling >100 mL." },
    ],
  },
  {
    id: "SDS-SUL-001",
    product_name: "Sulfuric Acid 98%",
    manufacturer: "Acme Chemicals",
    cas_number: "7664-93-9",
    ghs_pictograms: ["GHS05"],
    signal_word: "danger",
    hazards: [
      {
        category: "chemical",
        title: "Sulfuric Acid — corrosive to metals",
        description: "Concentrated solution corrodes steel, brass, and many plastics; risk of equipment failure and uncontained release.",
        h_statement: "H290 — May be corrosive to metals",
      },
      {
        category: "chemical",
        title: "Sulfuric Acid — severe skin and eye burns",
        description: "Causes severe skin burns and permanent eye damage on contact. Reacts violently with water.",
        h_statement: "H314 — Causes severe skin burns and eye damage",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Store and dispense from polyethylene-lined or PTFE-lined vessels; provide secondary containment (110% of largest container)." },
      { level: "engineering", description: "Install eyewash and safety shower within 10 seconds of any handling area, tested weekly." },
      { level: "administrative", description: "Permit-to-work + buddy-system rule for any quantity >1 L; never add water to acid." },
      { level: "ppe", description: "Acid-resistant apron, full-face shield, and butyl-rubber gloves whenever the seal on the container is broken." },
    ],
  },
  {
    id: "SDS-HYD-001",
    product_name: "Hydraulic Oil ISO VG 46",
    manufacturer: "Mobil Industrial",
    cas_number: "64742-54-7",
    ghs_pictograms: [],
    signal_word: "warning",
    hazards: [
      {
        category: "chemical",
        title: "Hydraulic Oil — eye irritation",
        description: "Mechanical / mist contact may cause mild eye irritation.",
        h_statement: "H319 — Causes serious eye irritation",
      },
      {
        category: "environmental",
        title: "Hydraulic Oil — long-term aquatic toxicity",
        description: "May cause long-lasting harmful effects to aquatic life if released to drains or watercourses.",
        h_statement: "H413 — May cause long-lasting harmful effects to aquatic life",
      },
      {
        category: "physical",
        title: "Hydraulic Oil — slip hazard",
        description: "Spills create a slip hazard on smooth concrete and tiled flooring.",
        h_statement: "(no GHS code) — slip risk on spilled product",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Install drip trays under every hydraulic press and pump skid; bunded floor in the press bays." },
      { level: "administrative", description: "Spill-response procedure with absorbent pads and granular adsorbent within 5 metres of every press." },
      { level: "ppe", description: "Safety goggles when servicing or changing hoses; oil-resistant boots in the press bays." },
    ],
  },
  {
    id: "SDS-IPA-001",
    product_name: "Isopropanol 99%",
    manufacturer: "Acme Chemicals",
    cas_number: "67-63-0",
    ghs_pictograms: ["GHS02", "GHS07"],
    signal_word: "danger",
    hazards: [
      {
        category: "chemical",
        title: "Isopropanol — flammable liquid",
        description: "Highly flammable liquid and vapour; flash point 12°C, well below typical workplace temperatures.",
        h_statement: "H225 — Highly flammable liquid and vapour",
      },
      {
        category: "chemical",
        title: "Isopropanol — eye irritation",
        description: "Causes serious eye irritation on splash contact.",
        h_statement: "H319 — Causes serious eye irritation",
      },
      {
        category: "chemical",
        title: "Isopropanol — drowsiness / dizziness",
        description: "Inhalation of concentrated vapour may cause drowsiness or dizziness.",
        h_statement: "H336 — May cause drowsiness or dizziness",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Use sealed dispensing bottles with self-closing caps; avoid open-top trays." },
      { level: "engineering", description: "Provide local exhaust at any bench-top dispensing point handling >250 mL." },
      { level: "administrative", description: "Cap bottles immediately after use; store in flammable-liquid cabinet; max 4 L per bench." },
      { level: "ppe", description: "Nitrile gloves and splash goggles for any task transferring >100 mL." },
    ],
  },
  {
    id: "SDS-ACE-001",
    product_name: "Acetone",
    manufacturer: "Acme Chemicals",
    cas_number: "67-64-1",
    ghs_pictograms: ["GHS02", "GHS07"],
    signal_word: "danger",
    hazards: [
      {
        category: "chemical",
        title: "Acetone — flammable liquid",
        description: "Highly flammable liquid and vapour; flash point -20°C.",
        h_statement: "H225 — Highly flammable liquid and vapour",
      },
      {
        category: "chemical",
        title: "Acetone — eye irritation",
        description: "Causes serious eye irritation on splash contact.",
        h_statement: "H319 — Causes serious eye irritation",
      },
      {
        category: "chemical",
        title: "Acetone — drowsiness / dizziness",
        description: "Inhalation of vapour may cause drowsiness and CNS depression.",
        h_statement: "H336 — May cause drowsiness or dizziness",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Bench-top fume hood or local exhaust at all dispensing points; storage in flammable cabinet." },
      { level: "administrative", description: "Limit bench inventory to 1 L; ground all metal containers during transfers." },
      { level: "ppe", description: "Nitrile gloves and splash goggles when handling open containers." },
    ],
  },
  {
    id: "SDS-NAH-001",
    product_name: "Sodium Hydroxide 50% Solution",
    manufacturer: "Acme Chemicals",
    cas_number: "1310-73-2",
    ghs_pictograms: ["GHS05"],
    signal_word: "danger",
    hazards: [
      {
        category: "chemical",
        title: "Sodium Hydroxide — corrosive to metals",
        description: "Strong base corrodes aluminium, zinc, and tin; risk of hydrogen gas evolution on contact with reactive metals.",
        h_statement: "H290 — May be corrosive to metals",
      },
      {
        category: "chemical",
        title: "Sodium Hydroxide — severe skin and eye burns",
        description: "Causes severe skin burns and permanent eye damage on contact, even at dilute concentrations.",
        h_statement: "H314 — Causes severe skin burns and eye damage",
      },
    ],
    suggested_controls: [
      { level: "engineering", description: "Store in polyethylene drums with secondary containment; segregate from acids and aluminium." },
      { level: "engineering", description: "Emergency eyewash and safety shower within 10 seconds; weekly flush test." },
      { level: "administrative", description: "Always add caustic to water (not water to caustic); permit-to-work for transfers >1 L." },
      { level: "ppe", description: "Caustic-resistant apron, full-face shield, butyl gloves whenever the container seal is broken." },
    ],
  },
];

export function findSdsById(id: string): DummySds | undefined {
  return DUMMY_SDS_CATALOG.find((s) => s.id === id);
}
