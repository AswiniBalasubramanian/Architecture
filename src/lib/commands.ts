// Studio commands: what the architect types in the prompt bar becomes a list
// of operations, applied to the design (and the brief) as one undoable step.
// Claude produces the operations when it is configured (src/app/api/studio);
// otherwise readCommand() below handles the common phrasings by keyword.

import { EXTERIOR_TEMPLATES, FURNITURE, HOUSE_TYPES, INTERIOR_TEMPLATES, ROOM_TYPES } from "./catalog";
import { movableWalls, moveWall, roomWindows, setDoor, setWindow } from "./edit";
import { furnish, generate, place } from "./generator";
import { RULE_ROOMS, rulesFromText, WHERE_IDS, WHERE_LABEL, ROOM_LABEL, type LayoutRule, type Where } from "./layoutRules";
import { newId } from "./persist";
import type { Side } from "./openings";
import type { Brief, DirectionId, DoorChoice, Facing, FurnitureKind, HouseType, MaterialId, MaterialSlot, Requirement, RoofType, Room, RoomType } from "./types";

export const OP_NAMES = [
  "roof",
  "exterior_scheme",
  "interior_scheme",
  "material",
  "lighting",
  "rename_room",
  "room_use",
  "swap_rooms",
  "room_finish",
  "wall_color",
  "add_furniture",
  "remove_furniture",
  "refurnish",
  "window",
  "door",
  "resize_room",
  "set_brief",
  "add_requirement",
  "remove_requirement",
  "direction",
  "add_rule",
  "clear_rules",
  "view",
  "undo",
  "redo",
  "save",
] as const;
export type OpName = (typeof OP_NAMES)[number];

/** One flat shape for every operation; each op reads only the fields it needs. */
export interface Op {
  op: OpName;
  /** A room: its id, its name ("Bedroom 2") or its kind ("kitchen"). */
  room: string | null;
  /** The second room for swap_rooms and door. */
  room2: string | null;
  /** Furniture kind, material id, or roof/scheme/direction/requirement/field id, by op. */
  value: string | null;
  number: number | null;
  /** Wall side for window and resize_room: front, back, left, right. */
  side: string | null;
  color: string | null;
  flag: boolean | null;
}

export interface CommandContext {
  design: import("./types").Design;
  brief: Brief;
  selectedRoomId: string | null;
}

export interface Applied {
  design: import("./types").Design;
  brief: Brief;
  /** What changed, in plain words, one line per operation. */
  done: string[];
  /** What couldn't be done and why. */
  failed: string[];
  regenerated: boolean;
  /** Operations for the studio itself (view, undo, redo, save). */
  ui: Op[];
}

const blank = (op: OpName, fields: Partial<Op> = {}): Op => ({ op, room: null, room2: null, value: null, number: null, side: null, color: null, flag: null, ...fields });

/* ------------------------------------------------------------- lookups */

const TYPE_WORDS: Array<[RoomType, RegExp]> = [
  ["master", /\bmaster|main bed ?room|owner'?s?\b/i],
  ["kitchen", /\bkitchen\b/i],
  ["living", /\bliving|drawing room|\bhall\b|lounge(?! upstairs)/i],
  ["dining", /\bdining\b/i],
  ["family", /\bfamily\b/i],
  ["study", /\bstudy|office\b/i],
  ["pooja", /\bpooja|puja|prayer|mandir\b/i],
  ["utility", /\butility|laundry\b/i],
  ["parking", /\bparking|car porch|garage\b/i],
  ["foyer", /\bfoyer|entrance|entry\b/i],
  ["stair", /\bstair/i],
  ["bath", /\bbath|toilet|washroom\b/i],
  ["court", /\bcourt/i],
  ["bedroom", /\bbed ?room|guest room|kids'? room|parents'? room\b/i],
];

/** Find a room by id, name, or kind (the first of that kind, preferring the selected floor). */
export function findRoom(ctx: CommandContext, ref: string | null): Room | null {
  const rooms = ctx.design.rooms;
  if (!ref) return rooms.find((r) => r.id === ctx.selectedRoomId) ?? null;
  const q = ref.trim().toLowerCase().replace(/^the\s+/, "");
  if (/^(this|selected|current)( room)?$|^it$/.test(q)) return rooms.find((r) => r.id === ctx.selectedRoomId) ?? null;
  const exact = rooms.find((r) => r.id === ref || r.name.toLowerCase() === q);
  if (exact) return exact;
  const named = rooms.find((r) => r.name.toLowerCase().includes(q) || q.includes(r.name.toLowerCase()));
  if (named) return named;
  const type = TYPE_WORDS.find(([, re]) => re.test(q))?.[0];
  if (!type) return null;
  const floor = /\b(first|upper|upstairs)\b/.test(q) ? 1 : /\b(ground|downstairs)\b/.test(q) ? 0 : /\bsecond\b/.test(q) ? 2 : null;
  const pool = rooms.filter((r) => r.type === type && (floor === null || r.floor === floor));
  const selected = rooms.find((r) => r.id === ctx.selectedRoomId);
  return pool.find((r) => selected && r.floor === selected.floor) ?? pool[0] ?? null;
}

const COLORS: Record<string, string> = {
  white: "#f4f1ea",
  "off-white": "#efe9dd",
  cream: "#ede3cf",
  beige: "#e2d6c0",
  sand: "#e6dccb",
  sage: "#d7dccd",
  green: "#a9b79c",
  olive: "#8a9a7b",
  grey: "#b9b7b1",
  gray: "#b9b7b1",
  charcoal: "#3f4240",
  black: "#2c2e2d",
  blue: "#9fb6b8",
  teal: "#4e5d57",
  terracotta: "#b5643f",
  clay: "#e2cdb6",
  pink: "#e8cfc4",
  yellow: "#eadbb0",
  ochre: "#c9a15b",
  brown: "#7a5236",
};
const colorOf = (s: string | null) => (!s ? null : /^#[0-9a-f]{6}$/i.test(s) ? s : COLORS[s.toLowerCase()] ?? null);

const MATERIAL_WORDS: Record<string, MaterialId> = { oak: "wood", wood: "wood", wooden: "wood", timber: "wood", marble: "marble", tile: "tile", tiles: "tile", stone: "stone", granite: "stone", slate: "stone", concrete: "concrete", terrazzo: "tile", brick: "brick", terracotta: "terracotta", plaster: "plaster", metal: "metal" };

const NUM: Record<string, number> = { one: 1, a: 1, an: 1, single: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const n = (s: string) => NUM[s.toLowerCase()] ?? Number(s);

/* ---------------------------------------------------------------- apply */

const SIDES: Side[] = ["front", "back", "left", "right"];

function resize(design: import("./types").Design, room: Room, side: string | null, by: number) {
  const lines = movableWalls(design, room.floor);
  const tries: Array<[Side, number]> = (side && (SIDES as string[]).includes(side) ? [side as Side] : SIDES).map((s) => [s, by]);
  for (const [s, amount] of tries) {
    const v = s === "left" || s === "right";
    const at = s === "right" ? room.x + room.w : s === "left" ? room.x : s === "back" ? room.y + room.d : room.y;
    const line = lines.find((l) => l.orient === (v ? "v" : "h") && Math.abs(l.at - at) < 0.01 && (s === "right" || s === "back" ? l.low : l.high).includes(room.id));
    if (!line) continue;
    const delta = s === "right" || s === "back" ? amount : -amount;
    const next = moveWall(design, line, delta);
    if (next !== design) return { design: next, side: s };
  }
  return null;
}

/** Apply operations: brief changes first (one regeneration that keeps the finishes), then design edits. */
export function applyOps(ctx: CommandContext, ops: Op[]): Applied {
  let brief: Brief = ctx.brief;
  let design = ctx.design;
  let direction: DirectionId = design.direction;
  const done: string[] = [];
  const failed: string[] = [];
  const ui: Op[] = [];
  let briefChanged = false;

  for (const o of ops) {
    switch (o.op) {
      case "set_brief": {
        const field = o.value;
        if (field === "houseType" && o.color && o.color in HOUSE_TYPES) {
          brief = { ...brief, houseType: o.color as HouseType };
          done.push(`House type: ${HOUSE_TYPES[o.color as HouseType].label}`);
        } else if (field === "facing" && o.color && ["north", "east", "south", "west"].includes(o.color)) {
          brief = { ...brief, facing: o.color as Facing };
          done.push(`Road faces ${o.color}`);
        } else if (field && ["bedrooms", "bathrooms", "floors", "plotWidth", "plotDepth", "builtUp"].includes(field) && o.number !== null) {
          const limits: Record<string, [number, number]> = { bedrooms: [1, 6], bathrooms: [1, 6], floors: [1, 3], plotWidth: [18, 300], plotDepth: [24, 400], builtUp: [400, 20000] };
          const [lo, hi] = limits[field]!;
          const v = Math.round(Math.min(hi, Math.max(lo, o.number)));
          brief = { ...brief, [field]: v };
          done.push(`${{ bedrooms: "Bedrooms", bathrooms: "Bathrooms", floors: "Floors", plotWidth: "Plot frontage", plotDepth: "Plot depth", builtUp: "Built-up area" }[field]}: ${v}${field.startsWith("plot") ? " ft" : field === "builtUp" ? " sq ft" : ""}`);
        } else {
          failed.push(`Couldn't change "${field ?? "?"}" in the brief.`);
          continue;
        }
        briefChanged = true;
        break;
      }
      case "add_requirement":
      case "remove_requirement": {
        const r = o.value as Requirement | null;
        if (!r || !["parking", "study", "pooja", "utility", "garden", "terrace", "family", "vastu"].includes(r)) {
          failed.push(`Unknown requirement "${o.value}".`);
          continue;
        }
        const has = brief.requirements.includes(r);
        if (o.op === "add_requirement" && !has) brief = { ...brief, requirements: [...brief.requirements, r] };
        if (o.op === "remove_requirement" && has) brief = { ...brief, requirements: brief.requirements.filter((x) => x !== r) };
        done.push(`${o.op === "add_requirement" ? "Added" : "Removed"} ${r === "pooja" ? "prayer room" : r === "family" ? "family lounge" : r}`);
        briefChanged = true;
        break;
      }
      case "direction": {
        if (!o.value || !["open", "core", "courtyard"].includes(o.value)) {
          failed.push(`Unknown layout direction "${o.value}".`);
          continue;
        }
        direction = o.value as DirectionId;
        done.push(`Layout direction: ${{ open: "Open Linear", core: "Central Core", courtyard: "Courtyard" }[direction]}`);
        briefChanged = true;
        break;
      }
      case "add_rule": {
        const room = o.room as LayoutRule["room"] | null;
        const where = o.value as Where | null;
        if (!room || !(RULE_ROOMS as readonly string[]).includes(room) || !where || !(WHERE_IDS as readonly string[]).includes(where)) {
          failed.push("Couldn't read that placement rule.");
          continue;
        }
        const rule: LayoutRule = { room, where, floor: o.number, source: "architect" };
        brief = { ...brief, layoutRules: [...(brief.layoutRules ?? []).filter((r) => !(r.room === room && r.floor === rule.floor)), rule] };
        done.push(`Rule: ${ROOM_LABEL[room]} in the ${WHERE_LABEL[where]}`);
        briefChanged = true;
        break;
      }
      case "clear_rules":
        brief = { ...brief, layoutRules: [] };
        done.push("Cleared the layout rules");
        briefChanged = true;
        break;
    }
  }

  // One regeneration for all brief changes; finishes and lighting carry over.
  if (briefChanged) {
    const fresh = generate(brief, direction);
    design = { ...fresh, materials: design.materials, exteriorTemplate: design.exteriorTemplate, interiorTemplate: design.interiorTemplate, lighting: design.lighting, roof: brief.roof && brief.roof !== "auto" ? fresh.roof : design.roof };
  }
  const here: CommandContext = { ...ctx, design, brief };

  for (const o of ops) {
    here.design = design;
    const room = () => findRoom(here, o.room);
    switch (o.op) {
      case "roof":
        if (o.value === "flat" || o.value === "gable" || o.value === "hip") {
          design = { ...design, roof: o.value as RoofType };
          brief = { ...brief, roof: o.value as RoofType };
          done.push(`Roof: ${o.value}`);
        } else failed.push(`Unknown roof "${o.value}"; try flat, gable or hip.`);
        break;
      case "exterior_scheme":
      case "interior_scheme": {
        const list = o.op === "exterior_scheme" ? EXTERIOR_TEMPLATES : INTERIOR_TEMPLATES;
        const t = list.find((x) => x.id === o.value || x.label.toLowerCase() === (o.value ?? "").toLowerCase());
        if (!t) {
          failed.push(`Unknown ${o.op === "exterior_scheme" ? "exterior" : "interior"} scheme "${o.value}".`);
          break;
        }
        design = o.op === "exterior_scheme" ? { ...design, exteriorTemplate: t.id, materials: { ...design.materials, ...t.set } } : { ...design, interiorTemplate: t.id, materials: { ...design.materials, ...t.set }, rooms: design.rooms.map(({ finish: _f, wallColor: _w, ...r }) => r) };
        done.push(`${o.op === "exterior_scheme" ? "Exterior" : "Interior"}: ${t.label}`);
        break;
      }
      case "material": {
        const slot = o.side as MaterialSlot | null;
        const color = colorOf(o.color);
        if (!slot || !(slot in design.materials)) {
          failed.push(`Unknown surface "${o.side}".`);
          break;
        }
        const material = (o.value && (MATERIAL_WORDS[o.value.toLowerCase()] ?? o.value)) as MaterialId | null;
        design = { ...design, materials: { ...design.materials, [slot]: { material: material ?? design.materials[slot].material, color: color ?? design.materials[slot].color } } };
        done.push(`${slot[0]!.toUpperCase() + slot.slice(1)}: ${[o.value, o.color].filter(Boolean).join(", ")}`);
        break;
      }
      case "lighting": {
        const patch: Partial<import("./types").Lighting> = {};
        if (o.number !== null) patch.hour = Math.min(20, Math.max(6, o.number));
        if (o.flag !== null) patch.interior = o.flag;
        design = { ...design, lighting: { ...design.lighting, ...patch } };
        done.push(`Light: ${patch.hour !== undefined ? `${Math.floor(patch.hour)}:${String(Math.round((patch.hour % 1) * 60)).padStart(2, "0")}` : ""}${patch.interior !== undefined ? `${patch.hour !== undefined ? ", " : ""}interior lights ${patch.interior ? "on" : "off"}` : ""}`);
        break;
      }
      case "rename_room": {
        const r = room();
        if (!r || !o.value) {
          failed.push(`Couldn't find "${o.room}" to rename.`);
          break;
        }
        design = { ...design, rooms: design.rooms.map((x) => (x.id === r.id ? { ...x, name: o.value! } : x)) };
        done.push(`Renamed ${r.name} to ${o.value}`);
        break;
      }
      case "room_use": {
        const r = room();
        const type = o.value as RoomType | null;
        if (!r || !type || !(type in ROOM_TYPES) || type === "stair" || r.type === "stair") {
          failed.push(`Couldn't change ${o.room ?? "that room"} to "${o.value}".`);
          break;
        }
        const next = { ...r, type, name: ROOM_TYPES[type].label };
        const inside = (f: { floor: number; x: number; y: number }) => f.floor === r.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d;
        design = { ...design, rooms: design.rooms.map((x) => (x.id === r.id ? next : x)), furniture: [...design.furniture.filter((f) => !inside(f)), ...furnish(next)] };
        done.push(`${r.name} is now a ${ROOM_TYPES[type].label.toLowerCase()}`);
        break;
      }
      case "swap_rooms": {
        const a = room();
        const b = findRoom(here, o.room2);
        if (!a || !b || a.id === b.id || a.floor !== b.floor || a.type === "stair" || b.type === "stair") {
          failed.push("Swaps need two different rooms on the same floor (not the stair).");
          break;
        }
        const rooms = design.rooms.map((x) => (x.id === a.id ? { ...x, type: b.type, name: b.name } : x.id === b.id ? { ...x, type: a.type, name: a.name } : x));
        const moved = rooms.filter((x) => x.id === a.id || x.id === b.id);
        const inEither = (f: { floor: number; x: number; y: number }) => moved.some((r) => r.floor === f.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d);
        design = { ...design, rooms, furniture: [...design.furniture.filter((f) => !inEither(f)), ...moved.flatMap(furnish)] };
        done.push(`Swapped ${a.name} and ${b.name}`);
        break;
      }
      case "room_finish":
      case "wall_color": {
        const r = room();
        const color = colorOf(o.color);
        if (!r) {
          failed.push(`Couldn't find "${o.room ?? "the selected room"}".`);
          break;
        }
        if (o.op === "wall_color") {
          if (!color) {
            failed.push(`Unknown colour "${o.color}".`);
            break;
          }
          design = { ...design, rooms: design.rooms.map((x) => (x.id === r.id ? { ...x, wallColor: color } : x)) };
          done.push(`${r.name} walls: ${o.color}`);
        } else {
          const material = (o.value && (MATERIAL_WORDS[o.value.toLowerCase()] ?? o.value)) as MaterialId | null;
          if (!material) {
            failed.push(`Unknown floor material "${o.value}".`);
            break;
          }
          design = { ...design, rooms: design.rooms.map((x) => (x.id === r.id ? { ...x, finish: { material, color: color ?? x.finish?.color ?? design.materials.floor.color } } : x)) };
          done.push(`${r.name} floor: ${o.value}`);
        }
        break;
      }
      case "add_furniture": {
        const r = room();
        const kind = o.value as FurnitureKind | null;
        if (!r || !kind || !(kind in FURNITURE)) {
          failed.push(`Couldn't add "${o.value}"${o.room ? ` to ${o.room}` : ""}.`);
          break;
        }
        const count = Math.max(1, Math.min(4, o.number ?? 1));
        for (let i = 0; i < count; i++) {
          const item = place(kind, r, "center", (i + 1) / (count + 1)) ?? place(kind, r, "left") ?? { id: newId(), kind, floor: r.floor, x: r.x + r.w / 2, y: r.y + r.d / 2, rot: 0 };
          design = { ...design, furniture: [...design.furniture, { ...item, id: newId() }] };
        }
        done.push(`Added ${count > 1 ? `${count} ` : "a "}${FURNITURE[kind].label.toLowerCase()}${count > 1 ? "s" : ""} to ${r.name}`);
        break;
      }
      case "remove_furniture": {
        const r = room();
        const kind = o.value as FurnitureKind | null;
        const inside = (f: { floor: number; x: number; y: number }) => !r || (f.floor === r.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d);
        const match = design.furniture.filter((f) => inside(f) && (!kind || f.kind === kind));
        if (!match.length) {
          failed.push(`No ${kind ? FURNITURE[kind]?.label.toLowerCase() ?? kind : "furniture"} found${r ? ` in ${r.name}` : ""}.`);
          break;
        }
        const gone = new Set((o.flag ? match : match.slice(0, Math.max(1, o.number ?? 1))).map((f) => f.id));
        design = { ...design, furniture: design.furniture.filter((f) => !gone.has(f.id)) };
        done.push(`Removed ${gone.size} ${kind ? FURNITURE[kind]?.label.toLowerCase() : "piece"}${gone.size > 1 ? "s" : ""}${r ? ` from ${r.name}` : ""}`);
        break;
      }
      case "refurnish": {
        const r = room();
        if (!r) {
          failed.push(`Couldn't find "${o.room}".`);
          break;
        }
        const inside = (f: { floor: number; x: number; y: number }) => f.floor === r.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d;
        design = { ...design, furniture: [...design.furniture.filter((f) => !inside(f)), ...furnish(r)] };
        done.push(`Refurnished ${r.name}`);
        break;
      }
      case "window": {
        const r = room();
        if (!r) {
          failed.push(`Couldn't find "${o.room}".`);
          break;
        }
        const wins = roomWindows(design, r).filter((w) => !o.side || w.side === o.side);
        if (!wins.length) {
          failed.push(`${r.name} has no outside wall${o.side ? ` on the ${o.side}` : ""} for a window.`);
          break;
        }
        for (const w of wins) {
          const width = o.number === null ? null : o.flag ? w.width + o.number : o.number;
          design = setWindow(design, r.id, w.side, width === null ? null : Math.min(w.max, Math.max(0, width)));
        }
        done.push(`${r.name} windows: ${o.number === null ? "reset" : o.flag ? `${o.number > 0 ? "+" : ""}${o.number} ft` : o.number === 0 ? "removed" : `${o.number} ft`}${o.side ? ` (${o.side})` : ""}`);
        break;
      }
      case "door": {
        const a = room();
        const b = findRoom(here, o.room2);
        const choice = o.value as DoorChoice | null;
        if (!a || !b || !choice || !["door", "open", "none"].includes(choice)) {
          failed.push("Couldn't read that door change.");
          break;
        }
        design = setDoor(design, a.id, b.id, choice);
        done.push(`${a.name} to ${b.name}: ${choice === "none" ? "wall" : choice === "open" ? "open" : "door"}`);
        break;
      }
      case "resize_room": {
        const r = room();
        if (!r || o.number === null) {
          failed.push(`Couldn't resize "${o.room}".`);
          break;
        }
        const res = resize(design, r, o.side, o.number);
        if (!res) {
          failed.push(`${r.name} can't ${o.number > 0 ? "grow" : "shrink"} that way without breaking a neighbour's minimum size.`);
          break;
        }
        design = res.design;
        done.push(`${r.name} ${o.number > 0 ? "grew" : "shrank"} ${Math.abs(o.number)} ft on the ${res.side}`);
        break;
      }
      case "view":
      case "undo":
      case "redo":
      case "save":
        ui.push(o);
        break;
    }
  }
  return { design, brief, done, failed, regenerated: briefChanged, ui };
}

/* ------------------------------------------------------ keyword reader */

const FURNITURE_WORDS: Array<[FurnitureKind, RegExp]> = [
  ["sofa", /\bsofas?|couch(es)?\b/i],
  ["armchair", /\barm ?chairs?\b/i],
  ["coffee", /\bcoffee tables?\b/i],
  ["dining", /\bdining tables?\b/i],
  ["rug", /\brugs?|carpets?\b/i],
  ["tv", /\btv|television|media unit\b/i],
  ["island", /\bisland\b/i],
  ["counter", /\bcounters?|kitchen run\b/i],
  ["wardrobe", /\bwardrobes?|closets?|almirah\b/i],
  ["desk", /\bdesks?\b/i],
  ["shelf", /\bshel(f|ves)|bookshel(f|ves)|bookcases?\b/i],
  ["plant", /\bplants?|planters?\b/i],
  ["vanity", /\bvanit(y|ies)\b/i],
  ["bed", /\bbeds?\b(?! ?rooms?)/i],
  ["car", /\bcars?\b/i],
];

const REQ_WORDS: Array<[Requirement, RegExp]> = [
  ["study", /\bstudy|home office\b/i],
  ["pooja", /\bpooja|puja|prayer room|mandir\b/i],
  ["parking", /\bparking|car porch|garage\b/i],
  ["utility", /\butility|laundry\b/i],
  ["garden", /\bgarden\b/i],
  ["terrace", /\bterrace\b/i],
  ["family", /\bfamily (lounge|room)\b/i],
  ["vastu", /\bvastu|vaastu\b/i],
];

const roomRef = (s: string) => s.replace(/^(the|a|an|my)\s+/i, "").replace(/[.?!]+$/, "").trim();

/** The common requests, read by keyword. Returns no ops when nothing was recognised. */
export function readCommand(text: string, ctx: CommandContext): { ops: Op[]; reply: string } {
  const t = text.trim();
  const lower = t.toLowerCase();
  const ops: Op[] = [];
  const say = (reply: string) => ({ ops, reply });

  if (/^(undo|undo that|go back)\b/.test(lower)) return { ops: [blank("undo")], reply: "Undone." };
  if (/^redo\b/.test(lower)) return { ops: [blank("redo")], reply: "Redone." };
  if (/^save\b/.test(lower)) return { ops: [blank("save", { value: t.replace(/^save( (it|this|a version))?( as)?\s*/i, "") || null })], reply: "Saved a version." };

  // View
  if (/\b(whole|full|entire) house|show (the )?roof|with (the )?roof\b/.test(lower)) ops.push(blank("view", { flag: false }));
  else if (/\bcut ?away|section view|hide (the )?roof\b/.test(lower)) ops.push(blank("view", { flag: true }));
  const viewMode = /\b(only|just)? ?(plan|3d|split) view\b|\bshow (the )?(plan|3d)\b/.exec(lower);
  if (viewMode) ops.push(blank("view", { value: (viewMode[2] ?? viewMode[4])! }));

  // Roof
  const roof = /\b(flat|gable|gabled|hip|hipped|pitched|sloped|sloping)\b[^.]{0,12}\broof|\broof\b[^.]{0,16}\b(flat|gable|gabled|hip|hipped|pitched|sloped|sloping)\b/.exec(lower);
  if (roof) {
    const w = (roof[1] ?? roof[2])!;
    ops.push(blank("roof", { value: w.startsWith("flat") ? "flat" : w.startsWith("hip") ? "hip" : "gable" }));
  }

  // Light
  if (/\bnight|evening|after dark\b/.test(lower)) ops.push(blank("lighting", { number: 19.6, flag: true }));
  else if (/\bsunset|golden hour|dusk\b/.test(lower)) ops.push(blank("lighting", { number: 17.8 }));
  else if (/\bmorning|sunrise\b/.test(lower)) ops.push(blank("lighting", { number: 8 }));
  else if (/\b(noon|midday|daytime|day light|daylight)\b/.test(lower)) ops.push(blank("lighting", { number: 12.5, flag: false }));
  if (/\blights? (on|off)\b|\b(turn|switch) (on|off) (the )?(interior |inside )?lights?\b/.test(lower) && !ops.some((o) => o.op === "lighting")) ops.push(blank("lighting", { flag: /\bon\b/.test(lower.replace(/\boff\b.*/, "")) && !/\boff\b/.test(lower) }));

  // Schemes
  if (/\b(exterior|facade|façade|outside|elevation)\b/.test(lower)) {
    const t2 = EXTERIOR_TEMPLATES.find((x) => lower.includes(x.label.toLowerCase()) || x.label.toLowerCase().split(/[ &]+/).some((w) => w.length > 3 && new RegExp(`\\b${w}\\b`).test(lower)));
    if (t2) ops.push(blank("exterior_scheme", { value: t2.id }));
  }
  if (/\binterior|inside\b/.test(lower)) {
    const t2 = INTERIOR_TEMPLATES.find((x) => lower.includes(x.label.toLowerCase()) || x.label.toLowerCase().split(/[ &]+/).some((w) => w.length > 3 && new RegExp(`\\b${w}\\b`).test(lower)));
    if (t2) ops.push(blank("interior_scheme", { value: t2.id }));
  }

  // Rename / swap / convert / resize
  const rename = /\brename (.+?) (?:to|as) (.+)$/i.exec(t);
  if (rename) ops.push(blank("rename_room", { room: roomRef(rename[1]!), value: roomRef(rename[2]!).replace(/^"|"$/g, "") }));
  const swap = /\bswap (.+?) (?:and|with) (.+?)$/i.exec(t);
  if (swap) ops.push(blank("swap_rooms", { room: roomRef(swap[1]!), room2: roomRef(swap[2]!) }));
  const convert = /\b(?:make|turn|convert|change|use) (.+?) (?:into|to|as) (?:a |an )?(study|bedroom|guest room|family lounge|living room|dining|kitchen|prayer room|pooja room|utility|office)\b/i.exec(t);
  if (convert && !rename) {
    const target = TYPE_WORDS.find(([, re]) => re.test(convert[2]!))?.[0];
    if (target) ops.push(blank("room_use", { room: roomRef(convert[1]!), value: target }));
  }
  const grow = /\b(?:make|extend|enlarge|widen|grow|expand|shrink|reduce)\s+(?:the\s+)?(.+?)\s*(bigger|larger|wider|deeper|smaller|narrower)?(?:\s+by\s+(\d+(?:\.\d+)?)\s*(?:ft|feet|')?)?(?:\s+(?:on|at|to(?:wards)?)\s+the\s+(front|back|left|right))?$/i.exec(t);
  if (grow && /\b(bigger|larger|wider|deeper|smaller|narrower|extend|enlarge|widen|grow|expand|shrink|reduce)\b/i.test(t) && !convert && !rename) {
    const shrink = /\b(smaller|narrower|shrink|reduce)\b/i.test(t);
    const ref = roomRef(grow[1]!.replace(/\b(bigger|larger|wider|deeper|smaller|narrower)\b.*$/i, ""));
    if (findRoom(ctx, ref)) ops.push(blank("resize_room", { room: ref, number: (shrink ? -1 : 1) * Number(grow[3] ?? 2), side: grow[4] ?? null }));
  }

  // Walls and floors of a room
  const paint = /\b(?:paint|colou?r)\b(?: the)? (.+?)(?: walls?)? (?:in |to )?([a-z-]+|#[0-9a-f]{6})$/i.exec(t) ?? /\b(.+?) walls? (?:in |to )?([a-z-]+|#[0-9a-f]{6})$/i.exec(t);
  if (paint && colorOf(paint[2]!)) ops.push(blank("wall_color", { room: roomRef(paint[1]!.replace(/\bwalls?\b/i, "")), color: paint[2]! }));
  const floorFinish = /\b(oak|wood|wooden|timber|marble|tile|tiles|stone|granite|slate|concrete|terrazzo)\b (?:floor(?:ing)?)(?: (?:in|for) (?:the )?(.+))?/i.exec(t) ?? /\b(.+?) floor(?:ing)? (?:in |to )?(oak|wood|wooden|timber|marble|tile|tiles|stone|granite|slate|concrete|terrazzo)\b/i.exec(t);
  if (floorFinish) {
    const material = MATERIAL_WORDS[floorFinish[1]!.toLowerCase()] ? floorFinish[1]! : floorFinish[2]!;
    const where = MATERIAL_WORDS[floorFinish[1]!.toLowerCase()] ? floorFinish[2] : floorFinish[1];
    if (where && findRoom(ctx, roomRef(where))) ops.push(blank("room_finish", { room: roomRef(where), value: material }));
    else ops.push(blank("material", { side: "floor", value: material }));
  }

  // Furniture
  const furn = FURNITURE_WORDS.find(([, re]) => re.test(t));
  if (furn && !convert && !swap && !rename) {
    const [kind] = furn;
    const qty = /\b(\d|two|three|four)\s+\w+/.exec(lower);
    const where = /\b(?:to|in|into|from|inside|for) (?:the )?(.+?)$/i.exec(t);
    const room = where ? roomRef(where[1]!) : null;
    if (/\b(remove|delete|take out|get rid of|drop)\b/i.test(t)) ops.push(blank("remove_furniture", { room, value: kind, flag: /\ball\b/i.test(t) }));
    else if (/\b(add|put|place|include|want|need)\b/i.test(t)) ops.push(blank("add_furniture", { room, value: kind, number: qty ? n(qty[1]!) : 1 }));
  }

  // Windows
  const win = /\b(bigger|larger|wider|smaller|no|remove|add)\b[^.]{0,20}\bwindows?\b(?: (?:in|for|on) (?:the )?(.+))?/i.exec(t);
  if (win) {
    const room = win[2] ? roomRef(win[2]) : null;
    const w = win[1]!.toLowerCase();
    if (w === "no" || w === "remove") ops.push(blank("window", { room, number: 0 }));
    else ops.push(blank("window", { room, number: w === "smaller" ? -2 : 2, flag: true }));
  }

  // Brief: counts, requirements, direction, facing, house type
  const count = (re: RegExp, field: string, current: number) => {
    const set = new RegExp(`\\b(\\d|one|two|three|four|five|six)[\\s-]*${re.source}`, "i").exec(t);
    const more = new RegExp(`\\b(?:add|one more|another|extra)\\b[^.]{0,12}${re.source}`, "i").test(t);
    const less = new RegExp(`\\b(?:remove|drop|one less|fewer)\\b[^.]{0,12}${re.source}`, "i").test(t);
    if (set && /\b(make|change|set|want|need|should|to|have)\b/i.test(t)) ops.push(blank("set_brief", { value: field, number: n(set[1]!) }));
    else if (more) ops.push(blank("set_brief", { value: field, number: current + 1 }));
    else if (less) ops.push(blank("set_brief", { value: field, number: current - 1 }));
  };
  if (!furn) {
    count(/(?:bed ?rooms?|bhk)\b/, "bedrooms", ctx.brief.bedrooms);
    count(/(?:bath ?rooms?|toilets?)\b/, "bathrooms", ctx.brief.bathrooms);
    count(/(?:floors?|storeys?|stories|levels?)\b/, "floors", ctx.brief.floors);
  }
  const gplus = /\bG\s*\+\s*(\d)\b/i.exec(t);
  if (gplus) ops.push(blank("set_brief", { value: "floors", number: Number(gplus[1]) + 1 }));
  if (!furn && !convert && !swap) {
    for (const [req, re] of REQ_WORDS) {
      if (!re.test(t)) continue;
      if (new RegExp(`\\b(remove|drop|no|without|delete|don'?t (?:want|need))\\b[^.]{0,20}${re.source}`, "i").test(t)) ops.push(blank("remove_requirement", { value: req }));
      else if (new RegExp(`\\b(add|include|want|need|with)\\b[^.]{0,20}${re.source}`, "i").test(t)) ops.push(blank("add_requirement", { value: req }));
    }
  }
  if (/\bcourtyard (layout|plan|direction)|switch to (a )?courtyard|use (a )?courtyard\b/i.test(t)) ops.push(blank("direction", { value: "courtyard" }));
  else if (/\bcentral core|core (layout|plan)\b/i.test(t)) ops.push(blank("direction", { value: "core" }));
  else if (/\bopen linear|linear (layout|plan)\b/i.test(t)) ops.push(blank("direction", { value: "open" }));
  const face = /\b(north|east|south|west)[\s-]*facing\b|\broad (?:faces|is on the|on the) (north|east|south|west)\b/i.exec(t);
  if (face) ops.push(blank("set_brief", { value: "facing", color: (face[1] ?? face[2])!.toLowerCase() }));
  const type = (Object.keys(HOUSE_TYPES) as HouseType[]).find((k) => new RegExp(`\\b(make it|change to|switch to|as) (a |an )?${HOUSE_TYPES[k].label.toLowerCase()}\\b`).test(lower));
  if (type) ops.push(blank("set_brief", { value: "houseType", color: type }));

  // Placement rules ("kitchen in the south-east")
  for (const rule of rulesFromText(t)) ops.push(blank("add_rule", { room: rule.room, value: rule.where, number: rule.floor }));
  if (/\b(clear|remove|delete) (all )?(the )?(layout )?rules\b/i.test(t)) ops.push(blank("clear_rules"));

  if (!ops.length) return say("I couldn't match that to a change. Try “gable roof”, “add a sofa to the living room”, “make it four bedrooms”, “kitchen in the south-east”, “swap kitchen and dining”, or “night view”. With a Claude key set, free-form requests work too.");
  return say("");
}

export const EXAMPLES = ["Show the whole house with a gable roof", "Make it four bedrooms", "Kitchen in the south-east", "Add a sofa to the living room", "Swap kitchen and dining", "Paint the master bedroom walls sage", "Night view with lights on", "Make the living room bigger by 3 ft"];

export { blank as makeOp, ROOM_LABEL, WHERE_LABEL };
