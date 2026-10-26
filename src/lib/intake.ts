// Reading a brief from a client conversation. The shape here is shared by the
// Claude extractor (src/app/api/intake/route.ts) and the on-device keyword
// reader below, which runs when no Claude credentials are configured.

import { EXTERIOR_TEMPLATES, HOUSE_TYPES, INTERIOR_TEMPLATES } from "./catalog";
import { defaultAssumptions } from "./generator";
import { RULE_ROOMS, rulesFromText, WHERE_IDS, type LayoutRule } from "./layoutRules";
import type { Brief, Currency, DirectionId, Facing, HouseType, Requirement, RoofType } from "./types";

export const HOUSE_TYPE_IDS = ["villa", "duplex", "contemporary", "traditional", "compact"] as const satisfies readonly HouseType[];
export const DIRECTION_IDS = ["open", "core", "courtyard"] as const satisfies readonly DirectionId[];
export const FACING_IDS = ["north", "east", "south", "west"] as const satisfies readonly Facing[];
export const ROOF_IDS = ["flat", "gable", "hip"] as const satisfies readonly RoofType[];
export const CURRENCY_IDS = ["INR", "USD", "EUR", "GBP", "AED"] as const satisfies readonly Currency[];
export const REQUIREMENT_IDS = ["parking", "study", "pooja", "utility", "garden", "terrace", "family", "vastu"] as const satisfies readonly Requirement[];
export const EXTERIOR_IDS = ["elite-white", "lime-teak", "board-concrete", "laterite", "nordic", "white-stone"] as const;
export const INTERIOR_IDS = ["warm-minimal", "japandi", "stone-loft", "classic-teak"] as const;

export interface Suggestion {
  title: string;
  houseType: HouseType;
  direction: DirectionId;
  exterior: (typeof EXTERIOR_IDS)[number];
  interior: (typeof INTERIOR_IDS)[number];
  why: string;
}

/** What was heard. Null means the conversation did not say. */
export interface Extraction {
  name: string | null;
  location: string | null;
  plotWidth: number | null;
  plotDepth: number | null;
  builtUp: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  budget: number | null;
  currency: Currency | null;
  houseType: HouseType | null;
  facing: Facing | null;
  roof: RoofType | null;
  requirements: Requirement[];
  notes: string;
  /** The words each value came from, so the architect can check it. */
  evidence: Array<{ field: string; quote: string }>;
  suggestions: Suggestion[];
  /** What the conversation left open: worth asking at the next meeting. */
  openQuestions: string[];
  /** Where rooms go, from the sketch or from what was said. */
  layoutRules: LayoutRule[];
  /** What the sketch showed, in a sentence or two (null without a sketch). */
  sketchSummary: string | null;
}

export type IntakeSource = "recording" | "upload" | "paste";
export interface IntakeResult {
  readBy: "claude" | "local";
  extraction: Extraction;
  /** Why Claude was not used, when it was not. */
  note?: string;
}

/* --------------------------------------------------------------- merge */

const within = (v: number | null, lo: number, hi: number) => (v !== null && Number.isFinite(v) && v >= lo && v <= hi ? v : null);

/** Clamp what was heard to what the planner accepts; anything out of range is dropped, not guessed. */
export function sanitize(x: Extraction): Extraction {
  const int = (v: number | null, lo: number, hi: number) => {
    const n = within(v, lo, hi);
    return n === null ? null : Math.round(n);
  };
  return {
    ...x,
    plotWidth: within(x.plotWidth, 18, 300),
    plotDepth: within(x.plotDepth, 24, 400),
    builtUp: within(x.builtUp, 400, 20000),
    floors: int(x.floors, 1, 3),
    bedrooms: int(x.bedrooms, 1, 6),
    bathrooms: int(x.bathrooms, 1, 6),
    budget: x.budget !== null && x.budget > 0 ? x.budget : null,
    requirements: [...new Set(x.requirements.filter((r) => (REQUIREMENT_IDS as readonly string[]).includes(r)))],
    layoutRules: (x.layoutRules ?? [])
      .filter((r) => (RULE_ROOMS as readonly string[]).includes(r.room) && (WHERE_IDS as readonly string[]).includes(r.where))
      .map((r) => ({ ...r, floor: r.floor === null || r.floor === undefined ? null : Math.max(0, Math.min(2, Math.round(r.floor))) })),
    sketchSummary: x.sketchSummary ?? null,
    suggestions: x.suggestions.filter((s) => (EXTERIOR_IDS as readonly string[]).includes(s.exterior) && (INTERIOR_IDS as readonly string[]).includes(s.interior)).slice(0, 3),
  };
}

/** The brief with every heard value applied over it. */
export function applyExtraction(brief: Brief, x: Extraction): Brief {
  const next: Brief = { ...brief };
  if (x.name) next.name = x.name;
  if (x.location) next.location = x.location;
  if (x.houseType) {
    next.houseType = x.houseType;
    next.floors = HOUSE_TYPES[x.houseType].floors;
  }
  if (x.floors) next.floors = x.floors;
  if (x.bedrooms) next.bedrooms = x.bedrooms;
  if (x.bathrooms) next.bathrooms = x.bathrooms;
  else if (x.bedrooms) next.bathrooms = Math.min(6, x.bedrooms);
  if (x.currency) next.currency = x.currency;
  if (x.budget) next.budget = x.budget;
  if (x.facing) next.facing = x.facing;
  if (x.roof) next.roof = x.roof;
  if (x.plotWidth || x.plotDepth) {
    next.plotWidth = x.plotWidth ?? brief.plotWidth;
    next.plotDepth = x.plotDepth ?? brief.plotDepth;
    next.assumptions = { ...defaultAssumptions(next.plotWidth, next.plotDepth), floorHeight: brief.assumptions.floorHeight };
  }
  if (x.builtUp) next.builtUp = x.builtUp;
  else if (x.plotWidth || x.plotDepth || x.floors) {
    // No area was said: fill what the setbacks allow, up to 55% coverage a floor.
    const a = next.assumptions;
    const zone = Math.max(0, next.plotWidth - a.setbackSide * 2) * Math.max(0, next.plotDepth - a.setbackFront - a.setbackRear);
    next.builtUp = Math.max(400, Math.min(20000, Math.round((Math.min(zone, next.plotWidth * next.plotDepth * 0.55) * next.floors) / 50) * 50));
  }
  if (x.requirements.length) next.requirements = x.requirements;
  if (x.layoutRules.length) {
    next.layoutRules = x.layoutRules;
    // A rule about a room the brief doesn't have yet asks for that room.
    const implied: Partial<Record<LayoutRule["room"], Requirement>> = { pooja: "pooja", study: "study", parking: "parking", utility: "utility", family: "family" };
    for (const r of x.layoutRules) {
      const req = implied[r.room];
      if (req && !next.requirements.includes(req)) next.requirements = [...next.requirements, req];
    }
  }
  if (x.notes.trim()) next.notes = [brief.notes.trim(), x.notes.trim()].filter(Boolean).join("\n");
  return next;
}

/* ------------------------------------------------------- on-device reader */

const WORDS: Record<string, number> = { one: 1, single: 1, two: 2, double: 2, three: 3, four: 4, five: 5, six: 6 };
const num = (s: string) => WORDS[s.toLowerCase()] ?? Number(s.replace(/,/g, ""));
const N = "(\\d+|one|two|three|four|five|six|single|double)";

function quoteAround(text: string, index: number, length: number) {
  const start = Math.max(0, text.lastIndexOf(".", index) + 1, index - 70);
  const endDot = text.indexOf(".", index + length);
  const end = Math.min(text.length, endDot === -1 ? index + length + 70 : endDot + 1, index + length + 90);
  return text.slice(start, end).replace(/\s+/g, " ").trim();
}

const KEYWORDS: Array<[Requirement, RegExp]> = [
  ["parking", /\b(car park|parking|garage|carport|two cars?|car)\b/i],
  ["study", /\b(study|home office|work from home|wfh|office room|library)\b/i],
  ["pooja", /\b(pooja|puja|prayer|mandir|shrine|god room)\b/i],
  ["utility", /\b(utility|laundry|washing machine|wash area|store ?room)\b/i],
  ["garden", /\b(garden|lawn|landscap\w*|green space|backyard)\b/i],
  ["terrace", /\b(terrace|rooftop|roof garden|sit-?out on (the )?roof)\b/i],
  ["family", /\b(family (lounge|room|area|hall)|upper living|tv lounge|upstairs lounge)\b/i],
  ["vastu", /\b(vaastu|vastu|feng shui)\b/i],
];

const TYPE_WORDS: Array<[HouseType, RegExp]> = [
  ["villa", /\bvilla\b/i],
  ["duplex", /\bduplex\b/i],
  ["traditional", /\b(traditional|kerala|chettinad|nalukettu|heritage|tiled roof|sloping roof)\b/i],
  ["compact", /\b(compact|small (house|home)|tight (plot|site)|budget home)\b/i],
  ["contemporary", /\b(contemporary|modern|minimal\w*|sleek)\b/i],
];

const NOTE_CUES = /\b(parents?|elderly|grand(mother|father|parents)|kids?|children|baby|pets?|dogs?|wheelchair|knees?|stairs are|light|ventilation|cross[- ]?breeze|privacy|guests?|rental|future floor|lift|elevator|solar|rainwater|courtyard|balcony|open kitchen|closed kitchen|dining)\b/i;

export function readLocally(transcript: string): Extraction {
  const t = transcript.replace(/\r/g, "");
  const evidence: Extraction["evidence"] = [];
  const find = (re: RegExp) => {
    const m = re.exec(t);
    return m;
  };
  const note = (field: string, m: RegExpExecArray | null) => {
    if (m) evidence.push({ field, quote: quoteAround(t, m.index, m[0].length) });
  };

  // Plot: "30 x 40", "40 by 60 feet", "30*50 site"
  let plotWidth: number | null = null;
  let plotDepth: number | null = null;
  const plot = find(/\b(\d{2,3})\s*(?:ft|feet|')?\s*(?:x|by|×|\*)\s*(\d{2,3})\s*(?:ft|feet|')?/i);
  if (plot) {
    plotWidth = Number(plot[1]);
    plotDepth = Number(plot[2]);
    if (plotWidth > plotDepth) [plotWidth, plotDepth] = [plotDepth, plotWidth];
    note("plot", plot);
  }

  // Built-up area: "2,400 sq ft", "2400 sft"; the plot's own area is skipped.
  let builtUp: number | null = null;
  const areaRe = /\b(\d{1,2},?\d{3}|\d{3,5})\s*(?:sq\.?\s*ft|sqft|sft|square feet|sq feet)\b/gi;
  for (let m = areaRe.exec(t); m; m = areaRe.exec(t)) {
    const v = num(m[1]!);
    if (plotWidth && plotDepth && Math.abs(v - plotWidth * plotDepth) < 1) continue;
    builtUp = v;
    note("builtUp", m);
    break;
  }

  // Floors: "G+1", "two floors", "duplex", "single storey"
  let floors: number | null = null;
  const gPlus = find(/\bG\s*\+\s*(\d)\b/i);
  const floorWords = find(new RegExp(`\\b${N}[\\s-]*(?:floors?|storey(?:s|ed)?|stor(?:y|ies)|levels?)\\b`, "i"));
  if (gPlus) {
    floors = Number(gPlus[1]) + 1;
    note("floors", gPlus);
  } else if (floorWords) {
    floors = num(floorWords[1]!);
    note("floors", floorWords);
  }

  const beds = find(new RegExp(`\\b${N}\\s*(?:-|\\s)?(?:bhk|bed(?:room)?s?)\\b`, "i"));
  const bedrooms = beds ? num(beds[1]!) : null;
  note("bedrooms", beds);
  const baths = find(new RegExp(`\\b${N}\\s*(?:-|\\s)?(?:bath(?:room)?s?|toilets?|washrooms?)\\b`, "i"));
  const bathrooms = baths ? num(baths[1]!) : null;
  note("bathrooms", baths);

  // Budget: "1.2 crore", "80 lakhs", "$450k", "AED 2 million"
  let budget: number | null = null;
  let currency: Currency | null = null;
  const inr = find(/\b(\d+(?:\.\d+)?)\s*(crores?|cr|lakhs?|lacs?|lakh)\b/i);
  const usd = find(/(\$|usd|aed|£|gbp|€|eur)\s?(\d[\d,]*(?:\.\d+)?)\s*(k|m|million|thousand)?/i);
  if (inr) {
    const v = Number(inr[1]);
    budget = /^c/i.test(inr[2]!) ? v * 1e7 : v * 1e5;
    currency = "INR";
    note("budget", inr);
  } else if (usd) {
    const sym = usd[1]!.toLowerCase();
    currency = sym === "$" || sym === "usd" ? "USD" : sym === "aed" ? "AED" : sym === "£" || sym === "gbp" ? "GBP" : "EUR";
    const scale = !usd[3] ? 1 : /^k|thousand/i.test(usd[3]) ? 1e3 : 1e6;
    budget = num(usd[2]!) * scale;
    note("budget", usd);
  }

  const face = find(/\b(north|east|south|west)[\s-]*facing\b|\bfacing (?:the )?(north|east|south|west)\b|\broad (?:is )?on the (north|east|south|west)\b/i);
  const facing = face ? ((face[1] ?? face[2] ?? face[3])!.toLowerCase() as Facing) : null;
  note("facing", face);

  let houseType: HouseType | null = null;
  for (const [type, re] of TYPE_WORDS) {
    const m = find(re);
    if (m) {
      houseType = type;
      note("houseType", m);
      break;
    }
  }

  let roof: RoofType | null = null;
  const roofM = find(/\b(flat roof|sloped roof|sloping roof|pitched roof|tiled roof|gable|hip roof)\b/i);
  if (roofM) {
    const w = roofM[1]!.toLowerCase();
    roof = w.startsWith("flat") ? "flat" : w.startsWith("hip") ? "hip" : "gable";
    note("roof", roofM);
  }

  const requirements: Requirement[] = [];
  for (const [req, re] of KEYWORDS) {
    const m = find(re);
    if (m) {
      requirements.push(req);
      note(req, m);
    }
  }
  if (floors === null && houseType === "duplex") floors = 2;

  const sentences = t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 12);
  const notes = sentences.filter((s) => NOTE_CUES.test(s)).slice(0, 5).join(" ");

  const openQuestions: string[] = [];
  if (!plot) openQuestions.push("What are the plot dimensions, and which side does the road run along?");
  if (!face) openQuestions.push("Which compass direction does the plot face?");
  if (!budget) openQuestions.push("What is the construction budget, and does it include interiors?");
  if (!beds) openQuestions.push("How many bedrooms, and who uses each one?");
  if (!floors && !houseType) openQuestions.push("How many floors do they want now, and is a future floor planned?");

  const base: Extraction = {
    name: null,
    location: null,
    plotWidth,
    plotDepth,
    builtUp,
    floors,
    bedrooms,
    bathrooms,
    budget,
    currency,
    houseType,
    facing,
    roof,
    requirements,
    notes,
    evidence,
    suggestions: [],
    openQuestions,
    layoutRules: rulesFromText(t),
    sketchSummary: null,
  };
  return { ...base, suggestions: suggestFor(base, t) };
}

/* ---------------------------------------------------------- suggestions */

const STYLE_CUES: Array<[(typeof EXTERIOR_IDS)[number], RegExp]> = [
  ["laterite", /\b(laterite|brick|kerala|terracotta|earthy|chettinad)\b/i],
  ["board-concrete", /\b(concrete|brutalist|industrial|raw)\b/i],
  ["nordic", /\b(timber|wooden|wood clad|scandi|nordic|dark)\b/i],
  ["white-stone", /\b(stone|granite|mediterranean)\b/i],
  ["lime-teak", /\b(warm|teak|lime|rustic|cosy|cozy)\b/i],
  ["elite-white", /\b(white|clean|modern|minimal|glass)\b/i],
];
const INTERIOR_CUES: Array<[(typeof INTERIOR_IDS)[number], RegExp]> = [
  ["japandi", /\b(japandi|japanese|zen|calm|minimal)\b/i],
  ["stone-loft", /\b(loft|industrial|concrete|stone floor)\b/i],
  ["classic-teak", /\b(traditional|teak|classic|heritage|carved)\b/i],
];

const label = (list: Array<{ id: string; label: string }>, id: string) => list.find((t) => t.id === id)?.label ?? id;

/** Three distinct starting points that follow what the client said about style and plan. */
export function suggestFor(x: Extraction, transcript = ""): Suggestion[] {
  const type = x.houseType ?? "contemporary";
  const heardExterior = STYLE_CUES.find(([, re]) => re.test(transcript))?.[0];
  const heardInterior = INTERIOR_CUES.find(([, re]) => re.test(transcript))?.[0] ?? (type === "traditional" ? "classic-teak" : "warm-minimal");
  const exterior = heardExterior ?? (type === "traditional" ? "laterite" : type === "villa" ? "lime-teak" : "elite-white");
  const narrow = x.plotWidth !== null && x.plotWidth < 32;
  const rules = x.layoutRules ?? [];
  const wantsCourt = /\bcourtyard|open to sky|nadumuttam|central court\b/i.test(transcript) || rules.some((r) => r.room === "court");
  const stairCentre = rules.some((r) => r.room === "stair" && (r.where === "middle" || r.where === "C"));
  const order: DirectionId[] = wantsCourt && !narrow ? ["courtyard", "open", "core"] : stairCentre ? ["core", "open", "courtyard"] : ["open", "core", "courtyard"];
  const second: (typeof EXTERIOR_IDS)[number] = exterior === "elite-white" ? "white-stone" : "elite-white";
  const third: (typeof EXTERIOR_IDS)[number] = type === "traditional" || exterior === "laterite" ? "lime-teak" : exterior === "board-concrete" ? "nordic" : "lime-teak";
  const why = (dir: DirectionId) =>
    dir === "open" ? "Stair to one side and one long living volume; reads clearly in a first meeting." : dir === "core" ? "Stair and services at the centre keep walking distances short." : narrow ? "A courtyard on a narrow plot is tight; shown so the client can see the trade-off." : "An open-to-sky court brings light and air into the middle of the house.";
  return [
    { title: `${HOUSE_TYPES[type].label} in ${label(EXTERIOR_TEMPLATES, exterior)}`, houseType: type, direction: order[0]!, exterior, interior: heardInterior, why: why(order[0]!) },
    { title: `${label(EXTERIOR_TEMPLATES, second)} alternative`, houseType: type, direction: order[1]!, exterior: second, interior: heardInterior === "japandi" ? "warm-minimal" : "japandi", why: why(order[1]!) },
    { title: `${label(EXTERIOR_TEMPLATES, third)} with ${label(INTERIOR_TEMPLATES, "classic-teak").toLowerCase()}`, houseType: type, direction: order[2]!, exterior: third, interior: "classic-teak", why: why(order[2]!) },
  ];
}
