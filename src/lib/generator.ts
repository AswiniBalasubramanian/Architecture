// Deterministic concept generator. No AI service is called: the same brief and
// direction always produce the same plan. The output is a massing-and-zoning
// concept for an architect to develop, not a construction drawing.

import { EXTERIOR_TEMPLATES, FURNITURE, HOUSE_TYPES, INTERIOR_TEMPLATES } from "./catalog";
import type { Assumptions, Brief, Design, DirectionId, Furniture, FurnitureKind, MaterialChoice, MaterialSlot, RoofType, Room, RoomType } from "./types";

const half = (value: number) => Math.round(value * 2) / 2;
const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export function defaultAssumptions(plotWidth: number, plotDepth: number): Assumptions {
  return {
    setbackFront: half(clamp(plotDepth * 0.12, 6, 15)),
    setbackRear: half(clamp(plotDepth * 0.08, 4, 10)),
    setbackSide: half(clamp(plotWidth * 0.08, 3, 6)),
    floorHeight: 10,
  };
}

export function defaultBrief(): Brief {
  return {
    name: "Residence at Whitefield",
    location: "Bengaluru, India",
    plotWidth: 40,
    plotDepth: 60,
    builtUp: 2400,
    floors: 2,
    bedrooms: 3,
    bathrooms: 3,
    budget: 9500000,
    currency: "INR",
    houseType: "contemporary",
    requirements: ["parking", "utility", "family"],
    notes: "",
    assumptions: defaultAssumptions(40, 60),
  };
}

export interface Footprint {
  x: number;
  y: number;
  w: number;
  d: number;
  notes: string[];
  buildableArea: number;
}

/** Fit the per-floor area into the buildable zone left by the setbacks. */
export function footprintOf(brief: Brief): Footprint {
  const { setbackFront, setbackRear, setbackSide } = brief.assumptions;
  const notes: string[] = [];
  const bw = Math.max(16, brief.plotWidth - setbackSide * 2);
  const bd = Math.max(20, brief.plotDepth - setbackFront - setbackRear);
  const perFloor = brief.builtUp / Math.max(1, brief.floors);
  let w = bw;
  let d = perFloor / w;
  if (d < 24) {
    d = Math.min(24, bd);
    w = clamp(perFloor / d, 18, bw);
  }
  if (d > bd) {
    d = bd;
    notes.push(`The brief asks for ${Math.round(perFloor)} sq ft per floor; the setbacks leave ${Math.round(bw * bd)} sq ft, so the footprint is capped at the buildable zone.`);
  }
  w = half(w);
  d = half(d);
  const x = half(setbackSide + (bw - w) / 2);
  return { x, y: setbackFront, w, d, notes, buildableArea: Math.round(bw * bd) };
}

interface Spec {
  type: RoomType;
  name?: string;
  weight: number;
  min?: number;
}

const MIN_DEPTH: Partial<Record<RoomType, number>> = { parking: 17, bedroom: 10, master: 12, living: 12, bath: 5.5, kitchen: 8, dining: 8, study: 8, pooja: 4.5, utility: 5 };

/** Split a length between specs: each gets its minimum, the rest goes by weight. */
function split(total: number, specs: Spec[]): number[] {
  const mins = specs.map((spec) => spec.min ?? MIN_DEPTH[spec.type] ?? 6);
  const sumMin = mins.reduce((a, b) => a + b, 0);
  if (sumMin >= total) return mins.map((m) => (m / sumMin) * total);
  const weights = specs.map((spec) => spec.weight);
  const sumW = weights.reduce((a, b) => a + b, 0);
  // Proportional first; then lift anything under its minimum and re-share the rest.
  let sizes = weights.map((weight) => (weight / sumW) * total);
  for (let pass = 0; pass < 4; pass++) {
    const fixed = sizes.map((size, index) => size < mins[index]!);
    if (!fixed.some(Boolean)) break;
    const locked = sizes.reduce((sum, _, index) => sum + (fixed[index] ? mins[index]! : 0), 0);
    const freeW = weights.reduce((sum, weight, index) => sum + (fixed[index] ? 0 : weight), 0);
    sizes = sizes.map((_, index) => (fixed[index] ? mins[index]! : (weights[index]! / freeW) * (total - locked)));
  }
  return sizes;
}

/** Round a list of lengths to half-feet while keeping the exact total. */
function snap(sizes: number[], total: number) {
  const out = sizes.map(half);
  const drift = total - out.reduce((a, b) => a + b, 0);
  out[out.length - 1] = half(out[out.length - 1]! + drift);
  return out;
}

interface FloorPlan {
  core: Spec[];
  a: Spec[];
  b: Spec[];
}

function bedroomsPerFloor(brief: Brief): number[] {
  const floors = brief.floors;
  if (floors === 1) return [brief.bedrooms];
  const counts = new Array(floors).fill(0);
  let left = brief.bedrooms;
  if (brief.bedrooms >= 3) {
    counts[0] = 1;
    left -= 1;
  }
  for (let floor = 1; left > 0; floor = floor + 1 > floors - 1 ? 1 : floor + 1) {
    counts[floor] += 1;
    left -= 1;
  }
  return counts;
}

function planFloors(brief: Brief, direction: DirectionId): FloorPlan[] {
  const has = (req: Brief["requirements"][number]) => brief.requirements.includes(req);
  const beds = bedroomsPerFloor(brief);
  const floors = brief.floors;
  // One bath per floor sits in the core; the rest are attached to bedrooms.
  const coreBaths: number[] = new Array<number>(floors).fill(0).map((_, floor) => (floor === 0 && has("utility") && floors > 1 ? 0 : 1));
  let extraBaths = Math.max(0, brief.bathrooms - coreBaths.reduce((a, b) => a + b, 0));
  const plans: FloorPlan[] = [];

  for (let floor = 0; floor < floors; floor++) {
    const ground = floor === 0;
    const core: Spec[] = [];
    if (ground) core.push(direction === "courtyard" ? { type: "court", weight: 0 } : { type: "foyer", weight: 0 });
    else core.push(direction === "courtyard" ? { type: "void", weight: 0 } : { type: "family", name: has("family") && floor === 1 ? "Family lounge" : "Upper lounge", weight: 0 });
    if (floors > 1) core.push({ type: "stair", weight: 0 });
    core.push(coreBaths[floor] ? { type: "bath", weight: 0 } : { type: "utility", weight: 0 });

    const a: Spec[] = [];
    const b: Spec[] = [];
    const bedCount = beds[floor] ?? 0;
    if (ground) {
      const living: Spec = { type: "living", weight: 3.2 };
      const dining: Spec = { type: "dining", weight: 2 };
      a.push(...(has("garden") ? [dining, living] : [living, dining]));
      if (has("parking")) b.push({ type: "parking", weight: 2.6 });
      else if (has("study")) b.push({ type: "study", weight: 1.4 });
      b.push({ type: "kitchen", weight: 2 });
      if (has("pooja")) b.push({ type: "pooja", weight: 0.6 });
      for (let n = 0; n < bedCount; n++) {
        (n % 2 === 0 ? b : a).push({ type: floors === 1 && n === 0 ? "master" : "bedroom", weight: 2.4 });
        if (extraBaths > 0 && floors === 1 && n === 0) {
          (n % 2 === 0 ? b : a).push({ type: "bath", name: "En-suite", weight: 0.9 });
          extraBaths -= 1;
        }
      }
      if (has("parking") && has("study") && floors === 1) a.push({ type: "study", weight: 1.3 });
    } else {
      const masterHere = floor === 1;
      const load = (band: Spec[]) => band.reduce((sum, spec) => sum + spec.weight, 0);
      for (let n = 0; n < bedCount; n++) {
        const master = masterHere && n === 0;
        // Fill the lighter band so neither side ends up as one long room.
        const target = load(a) <= load(b) ? a : b;
        target.push({ type: master ? "master" : "bedroom", weight: master ? 3 : 2.4 });
        if (extraBaths > 0 && (master || n >= 1)) {
          target.push({ type: "bath", name: master ? "Master bath" : "En-suite", weight: 1 });
          extraBaths -= 1;
        }
      }
      // With parking taking the ground-floor slot, the study moves upstairs.
      if (has("study") && has("parking") && floor === 1) b.push({ type: "study", weight: 1.4 });
      if (a.length === 0) a.push({ type: "family", name: "Multipurpose room", weight: 2 });
      if (b.length === 0) b.push({ type: "study", name: "Studio", weight: 2 });
      // A band holding one bedroom would run the full depth; give it a study alongside.
      for (const band of [a, b]) if (band.length === 1 && (band[0]!.type === "bedroom" || band[0]!.type === "master")) band.push({ type: "study", name: "Study nook", weight: 1 });
    }
    plans.push({ core, a, b });
  }
  return plans;
}

const ROOM_NAMES: Partial<Record<RoomType, string>> = {
  living: "Living",
  dining: "Dining",
  kitchen: "Kitchen",
  master: "Master bedroom",
  stair: "Stair",
  foyer: "Foyer",
  parking: "Car porch",
  study: "Study",
  utility: "Utility",
  pooja: "Prayer room",
  court: "Courtyard",
  void: "Void over court",
  family: "Family lounge",
};

function layoutRooms(brief: Brief, direction: DirectionId, fp: Footprint): Room[] {
  const plans = planFloors(brief, direction);
  const coreW = direction === "courtyard" ? 12 : 9;
  const rest = fp.w - coreW;
  const single = rest < 18;
  const aW = single ? rest : half(rest * (direction === "open" ? 0.58 : 0.5));
  const bW = single ? 0 : rest - aW;
  // Band x positions per direction.
  const x0 = fp.x;
  const bands =
    direction === "open"
      ? { a: x0, b: x0 + aW, core: x0 + aW + bW }
      : single
        ? { a: x0, b: x0, core: x0 + aW }
        : { a: x0, core: x0 + aW, b: x0 + aW + coreW };

  // Core cells: identical y on every floor so the stair stacks.
  const D = fp.d;
  const stairD = brief.floors > 1 ? Math.min(13, half(D * 0.42)) : 0;
  let frontD = half(clamp(D * (direction === "courtyard" ? 0.4 : 0.3), 7, direction === "courtyard" ? 18 : 14));
  if (D - frontD - stairD < 5.5) frontD = half(Math.max(5, D - stairD - 5.5));
  const backD = D - frontD - stairD;

  const rooms: Room[] = [];
  const counters: Record<string, number> = {};
  const nameOf = (spec: Spec) => {
    if (spec.name) return spec.name;
    if (spec.type === "bedroom" || spec.type === "bath") {
      counters[spec.type] = (counters[spec.type] ?? (spec.type === "bedroom" ? 1 : 0)) + 1;
      return spec.type === "bedroom" ? `Bedroom ${counters[spec.type]}` : `Bath ${counters[spec.type]}`;
    }
    return ROOM_NAMES[spec.type] ?? spec.type;
  };

  plans.forEach((plan, floor) => {
    const push = (spec: Spec, x: number, y: number, w: number, d: number) => {
      if (w < 0.5 || d < 0.5) return;
      rooms.push({ id: `r${floor}-${rooms.length}`, name: nameOf(spec), type: spec.type, floor, x: half(x), y: half(y), w: half(w), d: half(d) });
    };
    // Core
    const coreCells = plan.core;
    if (coreCells.length === 3) {
      push(coreCells[0]!, bands.core, fp.y, coreW, frontD);
      push(coreCells[1]!, bands.core, fp.y + frontD, coreW, stairD);
      push(coreCells[2]!, bands.core, fp.y + frontD + stairD, coreW, backD);
    } else {
      const sizes = snap(split(D, [{ ...coreCells[0]!, weight: 1.4, min: 6 }, { ...coreCells[1]!, weight: 1, min: 5.5 }]), D);
      push(coreCells[0]!, bands.core, fp.y, coreW, sizes[0]!);
      push(coreCells[1]!, bands.core, fp.y + sizes[0]!, coreW, sizes[1]!);
    }
    // Bands
    const stack = (specs: Spec[], x: number, w: number) => {
      if (!specs.length || w <= 0) return;
      const sizes = snap(split(D, specs), D);
      let y = fp.y;
      specs.forEach((spec, index) => {
        push(spec, x, y, w, sizes[index]!);
        y += sizes[index]!;
      });
    };
    if (single) stack([...plan.a, ...plan.b], bands.a, aW);
    else {
      stack(plan.a, bands.a, aW);
      stack(plan.b, bands.b, bW);
    }
  });
  return rooms;
}

let furnitureSeq = 0;
const fid = () => `f${Date.now().toString(36)}${(furnitureSeq++).toString(36)}`;

/** Place one item against a wall of the room; returns null when it doesn't fit. */
export function place(kind: FurnitureKind, room: Room, anchor: "back" | "front" | "center" | "left" | "right", along = 0.5, inset = 0.4): Furniture | null {
  const spec = FURNITURE[kind];
  const rotated = anchor === "left" || anchor === "right";
  const w = rotated ? spec.d : spec.w;
  const d = rotated ? spec.w : spec.d;
  if (w > room.w - 0.6 || d > room.d - 0.6) return null;
  const freeX = room.w - w;
  const freeY = room.d - d;
  let cx = room.x + w / 2 + freeX * along;
  let cy = room.y + d / 2 + freeY * along;
  let rot = 0;
  if (anchor === "back") cy = room.y + room.d - d / 2 - inset;
  if (anchor === "front") {
    cy = room.y + d / 2 + inset;
    rot = 180;
  }
  if (anchor === "center") cy = room.y + room.d / 2;
  if (anchor === "left") {
    cx = room.x + w / 2 + inset;
    rot = 90;
  }
  if (anchor === "right") {
    cx = room.x + room.w - w / 2 - inset;
    rot = 270;
  }
  return { id: fid(), kind, floor: room.floor, x: half(cx * 2) / 2, y: half(cy * 2) / 2, rot };
}

export function furnish(room: Room): Furniture[] {
  const out: Array<Furniture | null> = [];
  const add = (...items: Array<Furniture | null>) => out.push(...items);
  switch (room.type) {
    case "living":
    case "family": {
      add(place("rug", room, "center"));
      add(place("sofa", room, "back") ?? place("sofa", room, "left"));
      add(place("coffee", room, "center"));
      add(place("tv", room, "front"));
      if (room.w > 13) add(place("armchair", room, "left", 0.5, 1.4));
      add(place("plant", room, "back", 0.02));
      break;
    }
    case "dining":
      add(place("dining", room, "center"));
      add(place("plant", room, "front", 0.98));
      break;
    case "kitchen":
      add(place("counter", room, "back") ?? place("counter", room, "left"));
      if (room.d > 12 && room.w > 10) add(place("island", room, "center"));
      break;
    case "master":
    case "bedroom":
      add(place("bed", room, "back"));
      add(place("wardrobe", room, "front", room.type === "master" ? 0.15 : 0.5));
      if (room.type === "master" && room.w > 13) add(place("armchair", room, "front", 0.9, 1.2));
      break;
    case "bath":
      add(place("vanity", room, "back", 0.25));
      add(place("wc", room, "back", 0.85));
      break;
    case "parking":
      add(place("car", room, "center"));
      break;
    case "study":
      add(place("desk", room, "back"));
      add(place("shelf", room, "front"));
      break;
    case "utility":
      add(place("counter", room, "back") ?? place("counter", room, "left"));
      break;
    case "foyer":
      add(place("plant", room, "back", 0.1));
      break;
    case "court":
      add(place("plant", room, "center", 0.2), place("plant", room, "center", 0.8));
      break;
    default:
      break;
  }
  return out.filter((item): item is Furniture => item !== null);
}

const DIRECTION_TEMPLATES: Record<DirectionId, { exterior: string; interior: string }> = {
  open: { exterior: "elite-white", interior: "warm-minimal" },
  core: { exterior: "elite-white", interior: "japandi" },
  courtyard: { exterior: "lime-teak", interior: "classic-teak" },
};

export function materialsFor(exteriorId: string, interiorId: string): Record<MaterialSlot, MaterialChoice> {
  const ext = EXTERIOR_TEMPLATES.find((t) => t.id === exteriorId) ?? EXTERIOR_TEMPLATES[0]!;
  const int = INTERIOR_TEMPLATES.find((t) => t.id === interiorId) ?? INTERIOR_TEMPLATES[0]!;
  return { ...ext.set, ...int.set } as Record<MaterialSlot, MaterialChoice>;
}

function roofFor(brief: Brief, direction: DirectionId): RoofType {
  if (brief.requirements.includes("terrace")) return "flat";
  const base = HOUSE_TYPES[brief.houseType].roof;
  if (direction === "courtyard" && base === "flat" && brief.houseType !== "contemporary") return "hip";
  if (direction === "core" && base === "flat" && brief.houseType === "compact") return "gable";
  return base;
}

export function generate(brief: Brief, direction: DirectionId): Design {
  const fp = footprintOf(brief);
  const rooms = layoutRooms(brief, direction, fp);
  const furniture = rooms.flatMap(furnish);
  let { exterior, interior } = DIRECTION_TEMPLATES[direction];
  if (brief.houseType === "traditional") exterior = "laterite";
  if (brief.houseType === "villa" && direction !== "open") exterior = "lime-teak";
  return {
    direction,
    roof: roofFor(brief, direction),
    footprint: { x: fp.x, y: fp.y, w: fp.w, d: fp.d },
    floorHeight: brief.assumptions.floorHeight,
    rooms,
    furniture,
    materials: materialsFor(exterior, interior),
    lighting: { hour: 16.5, interior: false },
    exteriorTemplate: exterior,
    interiorTemplate: interior,
  };
}

export interface DesignStats {
  perFloor: number;
  total: number;
  carpet: number;
  rooms: number;
  bedrooms: number;
  baths: number;
  efficiency: number;
}

export function statsOf(design: Design, floors: number): DesignStats {
  const perFloor = design.footprint.w * design.footprint.d;
  const open = design.rooms.filter((room) => room.type === "court" || room.type === "void").reduce((sum, room) => sum + room.w * room.d, 0);
  const total = perFloor * floors - open;
  const carpet = design.rooms.filter((room) => room.type !== "court" && room.type !== "void" && room.type !== "parking").reduce((sum, room) => sum + room.w * room.d, 0) * 0.88;
  return {
    perFloor: Math.round(perFloor),
    total: Math.round(total),
    carpet: Math.round(carpet),
    rooms: design.rooms.length,
    bedrooms: design.rooms.filter((room) => room.type === "bedroom" || room.type === "master").length,
    baths: design.rooms.filter((room) => room.type === "bath").length,
    efficiency: Math.round((carpet / Math.max(1, total)) * 100),
  };
}
