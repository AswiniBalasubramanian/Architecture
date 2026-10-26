// Placement rules an architect or client states ("kitchen in the south-east",
// "stair on the left", "master bedroom at the back") or that a concept sketch
// shows. The generator scores its layout variants against them, so the chosen
// plan follows the sketch where the plot allows.

import { zoneOf, type Zone } from "./vastu";
import type { Brief, Design, Room, RoomType } from "./types";

/** Position in the plan as seen from the street: front is the road side. */
export type PlanSpot = "front" | "back" | "left" | "right" | "middle" | "front-left" | "front-right" | "back-left" | "back-right";
export type Where = Zone | PlanSpot;

export const ZONES: Zone[] = ["NE", "N", "NW", "E", "C", "W", "SE", "S", "SW"];
export const PLAN_SPOTS: PlanSpot[] = ["front", "back", "left", "right", "middle", "front-left", "front-right", "back-left", "back-right"];
export const WHERE_IDS = [...ZONES, ...PLAN_SPOTS] as const;
export const RULE_ROOMS = ["living", "dining", "kitchen", "master", "bedroom", "bath", "stair", "foyer", "parking", "study", "family", "utility", "pooja", "court"] as const satisfies readonly RoomType[];

export interface LayoutRule {
  room: (typeof RULE_ROOMS)[number];
  where: Where;
  /** 0 = ground; null = any floor. */
  floor: number | null;
  source: "sketch" | "conversation" | "architect";
  /** The words or sketch note it came from. */
  quote?: string;
}

export const WHERE_LABEL: Record<Where, string> = {
  NE: "north-east",
  N: "north",
  NW: "north-west",
  E: "east",
  C: "centre",
  W: "west",
  SE: "south-east",
  S: "south",
  SW: "south-west",
  front: "front (street side)",
  back: "back",
  left: "left side",
  right: "right side",
  middle: "middle",
  "front-left": "front left",
  "front-right": "front right",
  "back-left": "back left",
  "back-right": "back right",
};

export const ROOM_LABEL: Record<LayoutRule["room"], string> = {
  living: "Living",
  dining: "Dining",
  kitchen: "Kitchen",
  master: "Master bedroom",
  bedroom: "Bedroom",
  bath: "Bathroom",
  stair: "Stair",
  foyer: "Entrance foyer",
  parking: "Parking",
  study: "Study",
  family: "Family lounge",
  utility: "Utility",
  pooja: "Prayer room",
  court: "Courtyard",
};

const isZone = (w: Where): w is Zone => (ZONES as string[]).includes(w);

/** Which third of the plan a point sits in, across (left/middle/right) and deep (front/middle/back). */
function spotOf(design: Design, r: Room) {
  const fp = design.footprint;
  const u = (r.x + r.w / 2 - fp.x) / fp.w;
  const v = (r.y + r.d / 2 - fp.y) / fp.d;
  return { col: u < 1 / 3 ? "left" : u > 2 / 3 ? "right" : "middle", row: v < 1 / 3 ? "front" : v > 2 / 3 ? "back" : "middle" };
}

/** How well one room sits against a rule: 1 meets it, 0.5 is next to it, 0 misses. */
function fit(design: Design, brief: Brief, r: Room, where: Where): number {
  if (isZone(where)) {
    const z = zoneOf(design, brief.facing ?? "east", r);
    if (z === where) return 1;
    // "East" accepts NE and SE; "north-east" half-accepts N and E.
    if (where.length === 1) return where !== "C" && z.includes(where) ? 1 : 0;
    return [...where].some((c) => z === c) ? 0.5 : 0;
  }
  const { col, row } = spotOf(design, r);
  if (where === "middle") return col === "middle" && row === "middle" ? 1 : col === "middle" || row === "middle" ? 0.5 : 0;
  if (where === "front" || where === "back") return row === where ? 1 : row === "middle" ? 0.4 : 0;
  if (where === "left" || where === "right") return col === where ? 1 : col === "middle" ? 0.4 : 0;
  const [rowWant, colWant] = where.split("-") as [string, string];
  return (row === rowWant ? 0.5 : 0) + (col === colWant ? 0.5 : 0);
}

function roomsFor(design: Design, rule: LayoutRule) {
  return design.rooms.filter((r) => (r.type === rule.room || (rule.room === "bedroom" && r.type === "master")) && (rule.floor === null || r.floor === rule.floor));
}

export interface RuleCheck {
  rule: LayoutRule;
  /** 0..1 */
  score: number;
  /** The room it was judged on, if the plan has one. */
  room?: Room;
}

export function checkRules(brief: Brief, design: Design, rules = brief.layoutRules ?? []): RuleCheck[] {
  return rules.map((rule) => {
    const candidates = roomsFor(design, rule);
    let best: RuleCheck = { rule, score: 0 };
    for (const r of candidates) {
      const s = fit(design, brief, r, rule.where);
      if (s > best.score || !best.room) best = { rule, score: s, room: r };
    }
    return best;
  });
}

/** 0..100, or null when the brief has no rules. */
export function rulesScore(brief: Brief, design: Design): number | null {
  const checks = checkRules(brief, design);
  if (!checks.length) return null;
  return Math.round((checks.reduce((s, c) => s + c.score, 0) / checks.length) * 100);
}

export const describeRule = (r: LayoutRule) => `${ROOM_LABEL[r.room]} · ${WHERE_LABEL[r.where]}${r.floor === null ? "" : r.floor === 0 ? " · ground floor" : r.floor === 1 ? " · first floor" : ` · floor ${r.floor}`}`;

/* ------------------------------------------------- reading rules from text */

const ROOM_WORDS: Array<[LayoutRule["room"], string]> = [
  ["master", "master(?: bed ?room)?|main bed ?room|owner'?s? bed ?room"],
  ["kitchen", "kitchen"],
  ["living", "living(?: room| area| hall)?|drawing room|hall"],
  ["dining", "dining(?: room| area)?"],
  ["pooja", "pooja(?: room)?|puja(?: room)?|prayer(?: room)?|mandir|god room"],
  ["stair", "stair(?:case|s)?"],
  ["parking", "parking|car porch|garage|carport"],
  ["study", "study|home office|office room"],
  ["utility", "utility|laundry|wash area"],
  ["family", "family (?:lounge|room|area)"],
  ["court", "courtyard|court|open[- ]to[- ]sky"],
  ["foyer", "entrance|foyer|main door"],
  ["bath", "bath ?room|toilet"],
  ["bedroom", "bed ?rooms?|guest room|parents'? room|kids'? room"],
];

const WHERE_WORDS: Array<[Where, string]> = [
  ["NE", "north[- ]?east|NE"],
  ["NW", "north[- ]?west|NW"],
  ["SE", "south[- ]?east|SE"],
  ["SW", "south[- ]?west|SW"],
  ["N", "north"],
  ["S", "south"],
  ["E", "east"],
  ["W", "west"],
  ["front-left", "front[- ]left"],
  ["front-right", "front[- ]right"],
  ["back-left", "(?:back|rear)[- ]left"],
  ["back-right", "(?:back|rear)[- ]right"],
  ["front", "front|street side|road side"],
  ["back", "back|rear"],
  ["left", "left"],
  ["right", "right"],
  ["middle", "cent(?:re|er)|middle"],
];

const FLOOR_WORDS = /\b(ground floor|downstairs|first floor|upstairs|second floor)\b/i;
const floorOf = (s: string) => {
  const m = FLOOR_WORDS.exec(s);
  if (!m) return null;
  const w = m[1]!.toLowerCase();
  return w === "ground floor" || w === "downstairs" ? 0 : w === "second floor" ? 2 : 1;
};

/** Rules said in words: "kitchen in the south-east", "stair on the left side", "north-east pooja room". */
export function rulesFromText(text: string): LayoutRule[] {
  const out: LayoutRule[] = [];
  const sentences = text.split(/(?<=[.!?;])\s+|\n+/);
  const room = ROOM_WORDS.map(([, w]) => `(?:${w})`).join("|");
  const where = WHERE_WORDS.map(([, w]) => `(?:${w})`).join("|");
  const after = new RegExp(`\\b(${room})\\b[^.;,]{0,40}?\\b(?:in|on|at|towards|to|facing|placed|should be|be)\\s+(?:the\\s+)?(${where})\\b(?:[- ](?:side|corner|zone|part|direction))?`, "gi");
  const before = new RegExp(`\\b(${where})(?:[- ](?:side|corner|facing|zone))?\\s+(${room})\\b`, "gi");
  const roomOf = (s: string) => ROOM_WORDS.find(([, w]) => new RegExp(`^(?:${w})$`, "i").test(s.trim()))?.[0];
  const whereOf = (s: string) => WHERE_WORDS.find(([, w]) => new RegExp(`^(?:${w})$`, "i").test(s.trim()))?.[0];
  for (const s of sentences) {
    const found: Array<[string, string]> = [];
    for (const m of s.matchAll(after)) found.push([m[1]!, m[2]!]);
    for (const m of s.matchAll(before)) found.push([m[2]!, m[1]!]);
    for (const [r, w] of found) {
      const ro = roomOf(r);
      const wh = whereOf(w);
      // "Facing east" describes the plot, not a room position.
      if (!ro || !wh || /\b(plot|site|road|house)\b[^.]{0,12}facing/i.test(s)) continue;
      if (out.some((x) => x.room === ro && x.where === wh)) continue;
      out.push({ room: ro, where: wh, floor: floorOf(s), source: "conversation", quote: s.trim().slice(0, 160) });
    }
  }
  return out;
}
