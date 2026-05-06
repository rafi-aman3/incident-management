/**
 * System-preset library content. Curated subset of the SafetyCulture
 * library payloads, normalized to our industry_type enum and trimmed
 * for v1 demo. Stored verbatim as JSONB on `template_versions` rows
 * via scripts/seed.ts.
 *
 * 14 presets across all 7 industries; 4 marked is_featured (full
 * content, ~8-10 items + multiple categories). The others are
 * abbreviated (~3-6 items) so the demo lands on a populated library
 * without bloating the seed script. Real SafetyCulture-library
 * imports are deferred to v2 (see docs/SPEC.md §15).
 */

import type {
  TemplateNodeItem,
  TemplateData,
  AnswerSet,
} from "@/lib/templates/types";
import type { IndustryEnum } from "@/lib/templates/industry-map";

export type PresetSpec = {
  slug: string;
  name: string;
  description: string;
  industry: IndustryEnum;
  is_featured: boolean;
  logo_url?: string | null;
  header: TemplateNodeItem[];
  items: TemplateNodeItem[];
  template_data: TemplateData;
};

// ----- Shared answer sets -------------------------------------------------
const ANSWER_SET_COMPLIANCE: AnswerSet = {
  id: "as-compliance3",
  type: "question",
  responses: [
    { id: "as-compliance3-c", label: "Compliant", score: 1, colour: "0,159,105", enable_score: true, failed: false },
    { id: "as-compliance3-p", label: "Partly Compliant", score: 0, colour: "254,133,0", enable_score: true, failed: true },
    { id: "as-compliance3-n", label: "Non-Compliant", score: 0, colour: "198,0,34", enable_score: true, failed: true },
  ],
};
const ANSWER_SET_PASSFAIL: AnswerSet = {
  id: "as-passfail",
  type: "question",
  responses: [
    { id: "as-passfail-p", label: "Pass", score: 1, colour: "0,159,105", enable_score: true, failed: false },
    { id: "as-passfail-f", label: "Fail", score: 0, colour: "198,0,34", enable_score: true, failed: true },
    { id: "as-passfail-na", label: "N/A", score: 1, colour: "112,112,112", enable_score: true, failed: false },
  ],
};
const ANSWER_SET_YESNO: AnswerSet = {
  id: "as-yesno",
  type: "question",
  responses: [
    { id: "as-yesno-y", label: "Yes", score: 1, colour: "0,159,105", enable_score: true, failed: false },
    { id: "as-yesno-n", label: "No", score: 0, colour: "198,0,34", enable_score: true, failed: true },
    { id: "as-yesno-na", label: "N/A", score: 1, colour: "112,112,112", enable_score: true, failed: false },
  ],
};
const ANSWER_SET_SAFE: AnswerSet = {
  id: "as-safeatrisk",
  type: "question",
  responses: [
    { id: "as-safeatrisk-s", label: "Safe", score: 1, colour: "0,159,105", enable_score: true, failed: false },
    { id: "as-safeatrisk-r", label: "At Risk", score: 0, colour: "198,0,34", enable_score: true, failed: true },
    { id: "as-safeatrisk-na", label: "N/A", score: 1, colour: "112,112,112", enable_score: true, failed: false },
  ],
};

// Build standard answer_sets registry referenced via `id`
const STANDARD_ANSWER_SETS: Record<string, AnswerSet> = {
  [ANSWER_SET_COMPLIANCE.id]: ANSWER_SET_COMPLIANCE,
  [ANSWER_SET_PASSFAIL.id]: ANSWER_SET_PASSFAIL,
  [ANSWER_SET_YESNO.id]: ANSWER_SET_YESNO,
  [ANSWER_SET_SAFE.id]: ANSWER_SET_SAFE,
};

const STANDARD_TEMPLATE_DATA: TemplateData = {
  answer_sets: STANDARD_ANSWER_SETS,
  condition_sets: [
    { id: "cond-is", type: "is" },
    { id: "cond-isnot", type: "is not" },
    { id: "cond-issel", type: "is selected" },
    { id: "cond-isnotsel", type: "is not selected" },
  ],
};

// ----- Standard header (Title Page) reused across templates ---------------
function standardHeader(): TemplateNodeItem[] {
  const sec = "hdr-section";
  return [
    {
      item_id: sec,
      type: "section",
      label: "Title Page",
      options: { sort_order: 1 },
    },
    {
      item_id: "hdr-conducted-by",
      parent_id: sec,
      type: "text",
      label: "Conducted by",
      options: { sort_order: 2, is_mandatory: false },
    },
    {
      item_id: "hdr-conducted-on",
      parent_id: sec,
      type: "datetime",
      label: "Conducted on",
      options: { sort_order: 3, is_mandatory: false },
    },
    {
      item_id: "hdr-location",
      parent_id: sec,
      type: "text",
      label: "Location / area",
      options: { sort_order: 4, is_mandatory: false },
    },
  ];
}

// ----- Helpers to build common items concisely ----------------------------
let counter = 0;
function nextId(prefix: string): string {
  counter++;
  return `${prefix}-${counter.toString(36)}`;
}

function section(label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("sec"),
    type: "section",
    label,
    options: { sort_order: sortOrder },
  };
}
function category(parentId: string, label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("cat"),
    parent_id: parentId,
    type: "category",
    label,
    options: { sort_order: sortOrder },
  };
}
function question(
  parentId: string,
  label: string,
  sortOrder: number,
  answerSet: string = ANSWER_SET_PASSFAIL.id,
  options: { required?: boolean; regulation_ref?: string } = {}
): TemplateNodeItem {
  return {
    item_id: nextId("q"),
    parent_id: parentId,
    type: "question",
    label,
    options: {
      sort_order: sortOrder,
      is_mandatory: options.required ?? true,
      answer_set: answerSet,
      ...(options.regulation_ref ? { regulation_ref: options.regulation_ref } : {}),
    },
  };
}
function text(parentId: string, label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("txt"),
    parent_id: parentId,
    type: "text",
    label,
    options: { sort_order: sortOrder, is_mandatory: false },
  };
}
function info(parentId: string, label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("info"),
    parent_id: parentId,
    type: "information",
    label,
    options: { sort_order: sortOrder },
  };
}
function media(parentId: string, label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("med"),
    parent_id: parentId,
    type: "media",
    label,
    options: { sort_order: sortOrder, is_mandatory: false },
  };
}
function signature(parentId: string, label: string, sortOrder: number): TemplateNodeItem {
  return {
    item_id: nextId("sig"),
    parent_id: parentId,
    type: "signature",
    label,
    options: { sort_order: sortOrder, is_mandatory: false, enable_signature_timestamp: true },
  };
}

// ===========================================================================
// PRESET DEFINITIONS
// ===========================================================================
function buildHealthcareMedicalAudit(): PresetSpec {
  counter = 0;
  const s1 = section("Patient Record System", 1);
  const s2 = section("Medical Record Review", 2);
  const s3 = section("Completion", 3);
  const items: TemplateNodeItem[] = [
    s1,
    question(s1.item_id, "All clinical information is recorded electronically, password protected and reliably backed up.", 1, ANSWER_SET_COMPLIANCE.id),
    question(s1.item_id, "Patient records are electronic, secure and traceable.", 2, ANSWER_SET_COMPLIANCE.id),
    question(s1.item_id, "Clinical notes are dated and reliably identify the author.", 3, ANSWER_SET_COMPLIANCE.id),
    s2,
    info(s2.item_id, "The record is appropriate, contemporaneous and sources are identified.", 1),
    question(s2.item_id, "Notes are completed as soon as possible after contact, and any delay is identifiable.", 2, ANSWER_SET_COMPLIANCE.id),
    question(s2.item_id, "Information is recorded objectively and does not contain inappropriate, judgmental comment.", 3, ANSWER_SET_COMPLIANCE.id),
    question(s2.item_id, "Allergies or the absence of known allergies is recorded for each patient.", 4, ANSWER_SET_COMPLIANCE.id),
    question(s2.item_id, "Past medical history is available.", 5, ANSWER_SET_COMPLIANCE.id),
    s3,
    text(s3.item_id, "Additional recommendations", 1),
    signature(s3.item_id, "Reviewer name & signature", 2),
  ];
  return {
    slug: "medical-audit-checklist",
    name: "Medical Audit Checklist",
    description:
      "Compliance audit for medical practices — patient record system + clinical note review + reviewer sign-off.",
    industry: "healthcare",
    is_featured: true,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildHealthcareInfectionRounds(): PresetSpec {
  counter = 0;
  const s1 = section("Infection Prevention Walk", 1);
  const items: TemplateNodeItem[] = [
    s1,
    question(s1.item_id, "Hand hygiene supplies (sanitizer, soap) stocked at every dispenser.", 1, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Sharps containers below 75% full and labeled.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Isolation signage posted on rooms requiring contact / droplet / airborne precautions.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "PPE stations stocked (gloves S/M/L, gowns, masks).", 4, ANSWER_SET_PASSFAIL.id),
    text(s1.item_id, "Notes / follow-ups", 5),
  ];
  return {
    slug: "infection-prevention-rounds",
    name: "Infection Prevention and Control Rounds",
    description: "Daily walk-through of common patient-care areas for IPC compliance.",
    industry: "healthcare",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildManufacturingForklift(): PresetSpec {
  counter = 0;
  const s1 = section("Pre-Operational Checks", 1);
  const c1a = category(s1.item_id, "Visual Inspection", 1);
  const c1b = category(s1.item_id, "Operational Checks", 2);
  const s2 = section("Sign-off", 2);
  const items: TemplateNodeItem[] = [
    s1,
    c1a,
    question(c1a.item_id, "Tires inflated to spec, no damage or excessive wear.", 1, ANSWER_SET_PASSFAIL.id, { regulation_ref: "OSHA 1910.178(q)(7)" }),
    question(c1a.item_id, "Hydraulic hoses and fittings free of leaks.", 2, ANSWER_SET_PASSFAIL.id),
    question(c1a.item_id, "Forks straight, no cracks at heel.", 3, ANSWER_SET_PASSFAIL.id),
    question(c1a.item_id, "Mast chains lubricated and equally tensioned.", 4, ANSWER_SET_PASSFAIL.id),
    question(c1a.item_id, "Battery secured, terminals clean, electrolyte at correct level.", 5, ANSWER_SET_PASSFAIL.id),
    c1b,
    question(c1b.item_id, "Horn and reverse alarm functioning.", 1, ANSWER_SET_PASSFAIL.id),
    question(c1b.item_id, "Hydraulic lift / tilt smooth through full range.", 2, ANSWER_SET_PASSFAIL.id),
    question(c1b.item_id, "Service brake holds at full load.", 3, ANSWER_SET_PASSFAIL.id),
    question(c1b.item_id, "Parking brake holds on grade.", 4, ANSWER_SET_PASSFAIL.id),
    question(c1b.item_id, "Headlights / strobe / mirrors clean and aligned.", 5, ANSWER_SET_PASSFAIL.id),
    media(c1b.item_id, "Photo of fluid-level reservoirs (if any concern)", 6),
    s2,
    text(s2.item_id, "Defects observed (if any)", 1),
    signature(s2.item_id, "Operator signature", 2),
  ];
  return {
    slug: "forklift-pre-use-inspection",
    name: "Forklift Pre-Use Inspection",
    description:
      "OSHA-required (1910.178(q)(7)) daily forklift check before each shift. Failed items remove the truck from service.",
    industry: "manufacturing",
    is_featured: true,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildManufacturingMachineGuarding(): PresetSpec {
  counter = 0;
  const s1 = section("Machine Guarding Walk", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "Walk every machine on the line. Stop immediately if a guard is missing or bypassed.", 1),
    question(s1.item_id, "Point-of-operation guards in place and not bypassed.", 2, ANSWER_SET_PASSFAIL.id, { regulation_ref: "OSHA 1910.212" }),
    question(s1.item_id, "E-stops accessible and free of obstruction.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "LOTO points labeled and isolation devices available.", 4, ANSWER_SET_PASSFAIL.id),
    text(s1.item_id, "Equipment requiring attention", 5),
  ];
  return {
    slug: "machine-guarding-pre-shift",
    name: "Machine Guarding Pre-Shift Walk-Around",
    description:
      "Pre-shift sweep of guarding, e-stops, and LOTO availability across the production line.",
    industry: "manufacturing",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildWarehouseHousekeeping(): PresetSpec {
  counter = 0;
  const s1 = section("Aisle and Floor", 1);
  const s2 = section("Storage Areas", 2);
  const items: TemplateNodeItem[] = [
    s1,
    question(s1.item_id, "Aisles clear of pallets, debris, and trip hazards.", 1, ANSWER_SET_SAFE.id),
    question(s1.item_id, "No standing water, oil, or spilled product.", 2, ANSWER_SET_SAFE.id),
    question(s1.item_id, "Floor markings (yellow lines) visible.", 3, ANSWER_SET_SAFE.id),
    question(s1.item_id, "Emergency exits unobstructed.", 4, ANSWER_SET_SAFE.id),
    media(s1.item_id, "Photo of any concerning area", 5),
    s2,
    question(s2.item_id, "Pallets stacked stable, no overhang past beams.", 1, ANSWER_SET_SAFE.id),
    question(s2.item_id, "Heavy items stored on lower racks.", 2, ANSWER_SET_SAFE.id),
    text(s2.item_id, "Notes", 3),
  ];
  return {
    slug: "warehouse-aisle-housekeeping",
    name: "Warehouse Aisle Housekeeping",
    description:
      "Daily housekeeping walk to catch slips, trips, and falling-object hazards before they cause incidents.",
    industry: "warehouse",
    is_featured: true,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildWarehousePalletRack(): PresetSpec {
  counter = 0;
  const s1 = section("Pallet Rack Inspection", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "Quarterly per ANSI MH16.1. Reject any beam/upright with visible damage.", 1),
    question(s1.item_id, "Uprights free of vertical bowing or impact damage.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Beams seated and locked at both ends.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Foot plates anchored to concrete; bolts not loose.", 4, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Capacity load signs posted at every aisle.", 5, ANSWER_SET_PASSFAIL.id),
    text(s1.item_id, "Damaged components (location + photo)", 6),
  ];
  return {
    slug: "pallet-rack-quarterly",
    name: "Pallet-Rack Quarterly Inspection",
    description: "ANSI MH16.1 quarterly rack inspection covering uprights, beams, anchors, and load signage.",
    industry: "warehouse",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildOfficeErgonomic(): PresetSpec {
  counter = 0;
  const s1 = section("Workstation Setup", 1);
  const c1a = category(s1.item_id, "Chair", 1);
  const c1b = category(s1.item_id, "Monitor & Keyboard", 2);
  const s2 = section("Wellness Self-Check", 2);
  const items: TemplateNodeItem[] = [
    s1,
    c1a,
    question(c1a.item_id, "Chair height: feet flat on floor or footrest.", 1, ANSWER_SET_YESNO.id),
    question(c1a.item_id, "Lumbar support contacts the small of the back.", 2, ANSWER_SET_YESNO.id),
    question(c1a.item_id, "Armrests support elbows at ~90°.", 3, ANSWER_SET_YESNO.id),
    c1b,
    question(c1b.item_id, "Top of monitor at or just below eye level.", 1, ANSWER_SET_YESNO.id),
    question(c1b.item_id, "Monitor an arm's length away.", 2, ANSWER_SET_YESNO.id),
    question(c1b.item_id, "Keyboard / mouse on same surface, wrists straight.", 3, ANSWER_SET_YESNO.id),
    s2,
    question(s2.item_id, "Any neck, shoulder, wrist, or back discomfort during work?", 1, ANSWER_SET_YESNO.id),
    text(s2.item_id, "Describe symptoms (if any)", 2),
  ];
  return {
    slug: "office-ergonomic-workstation",
    name: "Office Ergonomic Workstation Self-Assessment",
    description:
      "Self-administered ergonomic check covering chair, monitor, keyboard, and wellness symptoms.",
    industry: "office",
    is_featured: true,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildOfficeFireExtinguisher(): PresetSpec {
  counter = 0;
  const s1 = section("Monthly Fire Extinguisher Check", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "NFPA 10: monthly visual check, annual maintenance by certified technician.", 1),
    question(s1.item_id, "Extinguisher in its designated location.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Pressure gauge in the green range.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Tamper seal intact, pin in place.", 4, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Mounting bracket secure, signage visible.", 5, ANSWER_SET_PASSFAIL.id),
    signature(s1.item_id, "Inspector signature", 6),
  ];
  return {
    slug: "fire-extinguisher-monthly",
    name: "Fire Extinguisher Monthly Visual",
    description: "NFPA 10 monthly visual inspection per extinguisher.",
    industry: "office",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildConstructionTailgate(): PresetSpec {
  counter = 0;
  const s1 = section("Daily Tailgate Talk", 1);
  const items: TemplateNodeItem[] = [
    s1,
    text(s1.item_id, "Topic of today's tailgate talk", 1),
    question(s1.item_id, "Hazards specific to today's tasks reviewed with the crew.", 2, ANSWER_SET_YESNO.id),
    question(s1.item_id, "Required PPE confirmed for each task (hard hat, eye, hi-vis, fall, hearing).", 3, ANSWER_SET_YESNO.id),
    question(s1.item_id, "Emergency assembly point and first-aid location pointed out.", 4, ANSWER_SET_YESNO.id),
    text(s1.item_id, "Crew attendees", 5),
    signature(s1.item_id, "Foreman signature", 6),
  ];
  return {
    slug: "daily-site-tailgate",
    name: "Daily Site Tailgate Check",
    description: "Pre-shift toolbox talk capturing hazard discussion + PPE confirmation.",
    industry: "construction",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildConstructionScaffold(): PresetSpec {
  counter = 0;
  const s1 = section("Scaffold Inspection", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "Scaffold competent person required. Tag green/yellow/red after this inspection.", 1),
    question(s1.item_id, "Base plates / mud sills sit on solid level ground.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Guardrails and toe boards on every working level above 6 ft.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Planking fully decked, no gaps; planks sound and not split.", 4, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Tied off at every 4 vertical / 30 horizontal feet (or per design).", 5, ANSWER_SET_PASSFAIL.id),
  ];
  return {
    slug: "scaffold-inspection",
    name: "Scaffold Pre-Use Inspection",
    description: "Competent-person scaffold inspection before each shift or weather event.",
    industry: "construction",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildEducationClassroom(): PresetSpec {
  counter = 0;
  const s1 = section("Classroom Hazard Walk", 1);
  const items: TemplateNodeItem[] = [
    s1,
    question(s1.item_id, "Furniture stable, no broken legs / sharp edges.", 1, ANSWER_SET_SAFE.id),
    question(s1.item_id, "Cords routed safely (not crossing walkways).", 2, ANSWER_SET_SAFE.id),
    question(s1.item_id, "First-aid kit accessible and stocked.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Emergency exit visible and clear of obstructions.", 4, ANSWER_SET_PASSFAIL.id),
    text(s1.item_id, "Items needing facilities follow-up", 5),
  ];
  return {
    slug: "classroom-hazard-walk",
    name: "Classroom Hazard Walk",
    description: "Routine classroom safety walk covering furniture, cords, first-aid, and exits.",
    industry: "education",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildEducationPlayground(): PresetSpec {
  counter = 0;
  const s1 = section("Playground Equipment", 1);
  const items: TemplateNodeItem[] = [
    s1,
    question(s1.item_id, "All equipment anchored; no missing or loose hardware.", 1, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Surfacing (mulch / mats) at adequate depth, no exposed concrete.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "No protruding bolts, splinters, or sharp edges.", 3, ANSWER_SET_PASSFAIL.id),
    media(s1.item_id, "Photos of any defects", 4),
  ];
  return {
    slug: "playground-equipment-monthly",
    name: "Playground Equipment Monthly",
    description: "Monthly inspection of playground hardware, surfacing, and structural integrity.",
    industry: "education",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildLabFumeHood(): PresetSpec {
  counter = 0;
  const s1 = section("Fume Hood Verification", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "Monthly per ANSI Z9.5. Annual face-velocity test by certified technician.", 1),
    question(s1.item_id, "Sash operates smoothly, stops at marked operating height.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Airflow indicator (Magnehelic / VAV) reads in safe range.", 3, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Hood interior clean; no chemical storage blocking baffles.", 4, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Last face-velocity certification within the last 12 months.", 5, ANSWER_SET_PASSFAIL.id),
  ];
  return {
    slug: "fume-hood-monthly",
    name: "Fume Hood Monthly Verification",
    description: "ANSI Z9.5 monthly visual + airflow check; flag for annual face-velocity test if overdue.",
    industry: "lab",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

function buildLabEyewash(): PresetSpec {
  counter = 0;
  const s1 = section("Eyewash Station", 1);
  const items: TemplateNodeItem[] = [
    s1,
    info(s1.item_id, "ANSI Z358.1 weekly activation requirement.", 1),
    question(s1.item_id, "Activate for 60 seconds — water runs clear and tepid.", 2, ANSWER_SET_PASSFAIL.id),
    question(s1.item_id, "Path to station clear within 10 seconds; signage visible.", 3, ANSWER_SET_PASSFAIL.id),
    text(s1.item_id, "Notes", 4),
  ];
  return {
    slug: "eyewash-station-weekly",
    name: "Eyewash Station Weekly",
    description: "ANSI Z358.1 weekly eyewash activation check.",
    industry: "lab",
    is_featured: false,
    header: standardHeader(),
    items,
    template_data: STANDARD_TEMPLATE_DATA,
  };
}

// ===========================================================================
// Public registry
// ===========================================================================
export const PRESETS: PresetSpec[] = [
  buildHealthcareMedicalAudit(),
  buildHealthcareInfectionRounds(),
  buildManufacturingForklift(),
  buildManufacturingMachineGuarding(),
  buildWarehouseHousekeeping(),
  buildWarehousePalletRack(),
  buildOfficeErgonomic(),
  buildOfficeFireExtinguisher(),
  buildConstructionTailgate(),
  buildConstructionScaffold(),
  buildEducationClassroom(),
  buildEducationPlayground(),
  buildLabFumeHood(),
  buildLabEyewash(),
];
