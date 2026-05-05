/**
 * RIDDOR 2013 specified-injury enumeration. Mirrors the
 * `riddor_specified_injury` Postgres enum on `injured_persons`. Per SPEC §9.
 *
 * Any injury matching one of these triggers the immediate phone notification
 * to HSE *plus* a written F2508 within 10 days.
 */

export const RIDDOR_SPECIFIED_INJURIES = [
  "fracture",
  "amputation",
  "sight_loss",
  "crush_internal",
  "serious_burn",
  "scalping",
  "loss_of_consciousness",
  "enclosed_space_injury",
] as const;

export type RiddorSpecifiedInjury = (typeof RIDDOR_SPECIFIED_INJURIES)[number];

export const RIDDOR_SPECIFIED_INJURY_LABELS: Record<RiddorSpecifiedInjury, string> = {
  fracture: "Fracture (other than to fingers, thumbs, toes)",
  amputation: "Amputation (arm, hand, finger, thumb, leg, foot, or toe)",
  sight_loss: "Permanent loss of sight or reduction of sight",
  crush_internal: "Crush injury leading to internal organ damage",
  serious_burn: "Serious burn covering > 10% of the body, or to eyes / respiratory / vital organs",
  scalping: "Scalping requiring hospital treatment",
  loss_of_consciousness: "Loss of consciousness from head injury or asphyxia",
  enclosed_space_injury: "Enclosed-space injury (hypothermia, heat illness, resuscitation, ≥24h hospitalisation)",
};
