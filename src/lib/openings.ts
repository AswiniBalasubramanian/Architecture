// Windows, doors and interior walls derived from the room layout. The 2D plan
// and the 3D model both read from here, so they always agree.

import type { Design, Room } from "./types";

export type Side = "front" | "back" | "left" | "right";
export type OpeningKind = "window" | "door" | "open" | "glazing";

export interface Opening {
  side: Side;
  /** Along the side's axis, in plan feet: x for front/back, y for left/right. */
  a: number;
  b: number;
  sill: number;
  head: number;
  kind: OpeningKind;
  roomId: string;
}

const EPS = 0.01;

function spec(room: Room, length: number, direction: Design["direction"]) {
  switch (room.type) {
    case "living":
    case "family":
      return direction === "open" ? { w: Math.min(length - 2, 12), sill: 0.4, head: 8.2 } : { w: Math.min(length * 0.6, 9), sill: 1.5, head: 7.8 };
    case "dining":
      return { w: Math.min(length * 0.55, 7), sill: 1.5, head: 7.8 };
    case "bedroom":
    case "master":
      return { w: Math.min(length * 0.5, 6.5), sill: 2.5, head: 7.6 };
    case "kitchen":
    case "utility":
      return { w: Math.min(length * 0.5, 5), sill: 3.4, head: 7.4 };
    case "bath":
      return { w: Math.min(length * 0.5, 2.6), sill: 5.2, head: 7.4 };
    case "stair":
      return { w: 2.2, sill: 2, head: 8.6 };
    case "study":
    case "foyer":
    case "pooja":
      return { w: Math.min(length * 0.45, 4.5), sill: 2.4, head: 7.6 };
    default:
      return null;
  }
}

export function openingsOf(design: Design, floor: number): Opening[] {
  const fp = design.footprint;
  const rooms = design.rooms.filter((r) => r.floor === floor);
  const out: Opening[] = [];
  const wallH = design.floorHeight - 0.6;
  const sides: Array<{ side: Side; touches: (r: Room) => boolean; range: (r: Room) => [number, number] }> = [
    { side: "front", touches: (r) => Math.abs(r.y - fp.y) < EPS, range: (r) => [r.x, r.x + r.w] },
    { side: "back", touches: (r) => Math.abs(r.y + r.d - fp.y - fp.d) < EPS, range: (r) => [r.x, r.x + r.w] },
    { side: "left", touches: (r) => Math.abs(r.x - fp.x) < EPS, range: (r) => [r.y, r.y + r.d] },
    { side: "right", touches: (r) => Math.abs(r.x + r.w - fp.x - fp.w) < EPS, range: (r) => [r.y, r.y + r.d] },
  ];
  const front = rooms.filter(sides[0]!.touches);
  const doorHost = floor === 0 ? (front.find((r) => r.type === "foyer" || r.type === "court") ?? front.find((r) => r.type === "living") ?? front.find((r) => r.type !== "parking")) : undefined;

  for (const { side, touches, range } of sides) {
    for (const room of rooms.filter(touches)) {
      const [r0, r1] = range(room);
      const length = r1 - r0;
      const mid = (r0 + r1) / 2;
      if (side === "front" && room.type === "parking") {
        out.push({ side, a: r0 + 0.8, b: r1 - 0.8, sill: 0, head: Math.min(8.2, wallH - 0.4), kind: "open", roomId: room.id });
        continue;
      }
      if (room.type === "parking" || room.type === "court") {
        if (room.type === "court" && side !== "front") out.push({ side, a: r0 + 1, b: r1 - 1, sill: 0, head: wallH, kind: "open", roomId: room.id });
        if (room.type === "court" && side === "front") out.push({ side, a: mid - 1.8, b: mid + 1.8, sill: 0, head: 7.5, kind: "door", roomId: room.id });
        continue;
      }
      if (room.type === "void") {
        out.push({ side, a: r0 + 1, b: r1 - 1, sill: 1, head: wallH - 0.8, kind: "glazing", roomId: room.id });
        continue;
      }
      if (doorHost && room.id === doorHost.id && side === "front") {
        out.push({ side, a: mid - 1.8, b: mid + 1.8, sill: 0, head: 7.5, kind: "door", roomId: room.id });
        if (room.type === "living" && length > 14) out.push({ side, a: r0 + 1.2, b: mid - 3.2, sill: 1.5, head: 7.8, kind: "window", roomId: room.id });
        continue;
      }
      // A garden door from the living room at the back.
      if (floor === 0 && side === "back" && room.type === "living") {
        const w = Math.min(length - 2, 10);
        out.push({ side, a: mid - w / 2, b: mid + w / 2, sill: 0, head: 8, kind: "glazing", roomId: room.id });
        continue;
      }
      // The architect's override wins: a width of 0 removes the window, any other width sets it.
      const override = design.windows?.[`${room.id}:${side}`];
      const s = spec(room, length, design.direction) ?? (override && override.width > 0 ? { w: override.width, sill: 3, head: 7.2 } : null);
      if (!s || length < 4 || (override && override.width <= 0)) continue;
      const w = Math.max(1.5, Math.min(override ? override.width : s.w, length - 1.6));
      out.push({ side, a: mid - w / 2, b: mid + w / 2, sill: s.sill, head: Math.min(s.head, wallH - 0.2), kind: "window", roomId: room.id });
    }
  }
  return out;
}

/** Depth of the floor-level landing at the front of every stair room, where doors open. */
export const STAIR_LANDING = 3;

/**
 * A dog-leg stair inside a stair room: from the front landing, flight 1 rises
 * toward the back (+y) to a half-landing, then flight 2 returns alongside it and
 * arrives back at the front landing one floor up. Risers stay at or under 7″
 * (NBC ≤ 190 mm) and treads aim for 10½″ (NBC ≥ 250 mm), as the room allows.
 * Shared by the 2D plan, the 3D model, the plan check and the walkthrough.
 */
export function stairOf(room: Room, rise: number) {
  const raw = Math.max(4, Math.ceil((rise * 12) / 7));
  const risers = raw % 2 ? raw + 1 : raw;
  const perFlight = risers / 2;
  const treads = perFlight - 1;
  const margin = 0.4;
  const gap = 0.3;
  const width = Math.max(1.5, Math.min(3.6, (room.w - margin * 2 - gap) / 2));
  const landing = Math.max(3, width);
  const y0 = room.y + STAIR_LANDING;
  const run = Math.max(0.5, Math.min(10.5 / 12, (room.y + room.d - margin - landing - y0) / treads));
  const yTop = y0 + treads * run;
  const xa = room.x + margin;
  const xb = xa + width + gap;
  return {
    risers,
    perFlight,
    treads,
    run,
    riser: rise / risers,
    width,
    landing,
    y0,
    yTop,
    /** Flight 1, rising toward the back. */
    up: { x0: xa, x1: xa + width },
    /** Flight 2, rising back toward the front. */
    down: { x0: xb, x1: xb + width },
    /** Opening left in the slab above: both flights and the half-landing. */
    well: { x0: xa, x1: xb + width, y0, y1: Math.min(room.y + room.d - margin, yTop + landing) },
    /** A floor-level passage beside the flights, from the front landing to the back of the room. */
    passage: room.x + room.w - 0.2 - (xb + width + 0.2) >= 2.6 ? { x0: xb + width + 0.2, x1: room.x + room.w - 0.2 } : null,
  };
}

export interface Partition {
  /** Plan endpoints, axis-aligned. */
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Door gap along the partition, or null. */
  door: [number, number] | null;
  glass: boolean;
  /** The two rooms either side. */
  a: string;
  b: string;
  /** What the planning rules (or the architect) decided for this wall. */
  kind: "door" | "open" | "wall" | "glass";
}

/**
 * Where along a shared wall a door into a stair room can go: onto the front
 * landing, or onto the passage beside the flights. Null when the wall only
 * meets the flights.
 */
function doorSpanOnStair(edge: { x0: number; y0: number; x1: number; y1: number }, stair: Room, rise: number): [number, number] | null {
  const st = stairOf(stair, rise);
  const horiz = Math.abs(edge.y1 - edge.y0) < 0.01;
  const clip = (a0: number, a1: number, b0: number, b1: number): [number, number] | null => {
    const lo = Math.max(a0, b0);
    const hi = Math.min(a1, b1);
    return hi - lo >= 2.4 ? [lo, hi] : null;
  };
  if (horiz) {
    const [x0, x1] = [Math.min(edge.x0, edge.x1), Math.max(edge.x0, edge.x1)];
    if (Math.abs(edge.y0 - stair.y) < 0.01) return clip(x0, x1, stair.x + 0.3, stair.x + stair.w - 0.3);
    return st.passage ? clip(x0, x1, st.passage.x0, st.passage.x1) : null;
  }
  const [y0, y1] = [Math.min(edge.y0, edge.y1), Math.max(edge.y0, edge.y1)];
  const onPassageSide = st.passage && Math.abs(edge.x0 - (stair.x + stair.w)) < 0.01;
  return clip(y0, y1, stair.y + 0.3, onPassageSide ? stair.y + stair.d - 0.3 : stair.y + STAIR_LANDING - 0.1);
}

/** Spaces you move through: every other room should open off one of these. */
export const CIRCULATION = new Set<Room["type"]>(["foyer", "living", "dining", "family", "stair", "court"]);

export const pairKey = (a: string, b: string) => [a, b].sort().join("|");

/** The en-suite bath's bedroom: explicit, or (older designs) by name and adjacency. */
export function attachedOf(bath: Room, rooms: Room[]) {
  if (bath.type !== "bath") return undefined;
  if (bath.attachedTo) return bath.attachedTo;
  if (!/en-suite|master bath/i.test(bath.name)) return undefined;
  return rooms.find((r) => (r.type === "bedroom" || r.type === "master") && r.floor === bath.floor && sharedEdge(r, bath) !== null)?.id;
}

export function sharedEdge(l: Room, r: Room): { x0: number; y0: number; x1: number; y1: number } | null {
  for (const [p, q] of [
    [l, r],
    [r, l],
  ] as const) {
    if (Math.abs(p.x + p.w - q.x) < EPS) {
      const y0 = Math.max(p.y, q.y);
      const y1 = Math.min(p.y + p.d, q.y + q.d);
      if (y1 - y0 > 0.5) return { x0: p.x + p.w, y0, x1: p.x + p.w, y1 };
    }
    if (Math.abs(p.y + p.d - q.y) < EPS) {
      const x0 = Math.max(p.x, q.x);
      const x1 = Math.min(p.x + p.w, q.x + q.w);
      if (x1 - x0 > 0.5) return { x0, y0: p.y + p.d, x1, y1: p.y + p.d };
    }
  }
  return null;
}

/** How much `from` wants its one door to open into `to` (higher is better, below 0 is never). */
function rank(from: Room, to: Room, rooms: Room[]): number {
  const t = to.type;
  const circ = CIRCULATION.has(to.type);
  if (from.type === "bath") {
    const bed = attachedOf(from, rooms);
    if (bed) return to.id === bed ? 10 : -1;
    return t === "family" || t === "foyer" ? 6 : t === "stair" ? 5 : t === "dining" ? 3 : circ ? 2 : t === "utility" ? 1 : -1;
  }
  if (t === "bath") return -1;
  switch (from.type) {
    case "kitchen":
      return t === "dining" ? 9 : t === "family" || t === "foyer" ? 6 : t === "living" ? 5 : t === "utility" ? 4 : t === "stair" ? 2 : -1;
    case "utility":
      return t === "kitchen" ? 8 : circ ? 3 : t === "parking" ? 2 : -1;
    case "parking":
      return t === "foyer" ? 5 : t === "utility" ? 4 : -1;
    case "pooja":
      return t === "living" || t === "dining" || t === "foyer" || t === "family" ? 6 : -1;
    case "study":
      return circ ? 6 : t === "bedroom" || t === "master" ? 3 : -1;
    case "bedroom":
    case "master":
      // Bedrooms open off a lounge, foyer or landing; opening into living spaces costs privacy.
      return t === "family" || t === "foyer" ? 8 : t === "stair" ? 7 : t === "dining" ? 3 : t === "living" ? 2 : t === "study" ? 1 : -1;
    default:
      return circ ? 5 : -1;
  }
}

/**
 * Interior walls, with doors placed by planning rules rather than on every
 * shared wall: rooms open off circulation (foyer, living, dining, lounges,
 * stair); an en-suite opens only from its bedroom; a kitchen from the dining,
 * plus a service door to the utility; bedrooms never open into each other, a
 * bath or a kitchen. Each room gets one door, and any room left unreachable is
 * connected through its best neighbour. Architect overrides in design.doors win.
 */
export function partitionsOf(design: Design, floor: number): Partition[] {
  const rooms = design.rooms.filter((r) => r.floor === floor && r.type !== "void");
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const edges: Array<{ e: { x0: number; y0: number; x1: number; y1: number }; a: Room; b: Room; len: number }> = [];
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const e = sharedEdge(rooms[i]!, rooms[j]!);
      if (e) edges.push({ e, a: rooms[i]!, b: rooms[j]!, len: Math.hypot(e.x1 - e.x0, e.y1 - e.y0) });
    }
  // A stair can only be entered from its front landing: from the front wall, or a side wall alongside the landing.
  const reachesLanding = (edge: { x0: number; y0: number; x1: number; y1: number }, stair: Room) => doorSpanOnStair(edge, stair, design.floorHeight) !== null;
  for (let i = edges.length - 1; i >= 0; i--) {
    const { e, a, b } = edges[i]!;
    const stair = a.type === "stair" ? a : b.type === "stair" ? b : undefined;
    if (stair && !reachesLanding(e, stair)) edges[i] = { ...edges[i]!, len: Math.min(edges[i]!.len, 0.1) };
  }
  const isCirc = (r: Room) => CIRCULATION.has(r.type);
  const openPlan = (a: Room, b: Room) => design.direction === "open" && ["dining:living", "dining:kitchen", "foyer:living"].includes([a.type, b.type].sort().join(":"));
  const choice = new Map<string, Partition["kind"]>();
  const passable = (k: string) => choice.get(k) === "door" || choice.get(k) === "open" || choice.get(k) === "glass";

  // 1. Fixed relationships between spaces.
  for (const { a, b, len } of edges) {
    const k = pairKey(a.id, b.id);
    if (a.type === "court" || b.type === "court") choice.set(k, a.type === "parking" || b.type === "parking" ? "wall" : "glass");
    else if (openPlan(a, b)) choice.set(k, "open");
    else if (isCirc(a) && isCirc(b)) choice.set(k, len >= 3.6 ? "door" : "wall");
    else choice.set(k, "wall");
  }
  // 2. One door per room, to the best neighbour the rules allow.
  for (const room of rooms) {
    if (isCirc(room) || room.type === "court") continue;
    const options = edges
      .filter(({ a, b, len }) => (a.id === room.id || b.id === room.id) && len >= 3.2)
      .map((edge) => (edge.a.id === room.id ? edge.b : edge.a))
      .map((other) => ({ other, score: rank(room, other, rooms) }))
      .filter((o) => o.score > 0)
      .sort((p, q) => q.score - p.score);
    const best = options[0];
    if (best) choice.set(pairKey(room.id, best.other.id), "door");
    if (room.type === "kitchen") {
      const u = options.find((o) => o.other.type === "utility");
      if (u) choice.set(pairKey(room.id, u.other.id), "door");
    }
  }
  // 3. Reachability from the entrance (ground) or the stair (upper floors).
  const start = floor === 0 ? (rooms.find((r) => r.type === "foyer" || r.type === "court") ?? rooms.find((r) => r.type === "living")) : rooms.find((r) => r.type === "stair");
  const reach = () => {
    const seen = new Set<string>(start ? [start.id] : []);
    const queue = start ? [start.id] : [];
    while (queue.length) {
      const id = queue.shift()!;
      for (const { a, b } of edges) {
        if (!passable(pairKey(a.id, b.id))) continue;
        const other = a.id === id ? b.id : b.id === id ? a.id : null;
        if (other && !seen.has(other) && byId.get(other)?.type !== "parking") {
          seen.add(other);
          queue.push(other);
        }
      }
    }
    return seen;
  };
  for (let pass = 0; start && pass < rooms.length * 2; pass++) {
    const seen = reach();
    // Connect the first stranded room that touches the reachable part of the floor.
    const stranded = rooms.find((r) => !seen.has(r.id) && r.type !== "parking" && edges.some(({ a, b, len }) => len >= 3.2 && ((a.id === r.id && seen.has(b.id)) || (b.id === r.id && seen.has(a.id)))));
    if (!stranded) break;
    const order = (r: Room) => (isCirc(r) ? 3 : r.type === "bath" ? 0 : r.type === "bedroom" || r.type === "master" ? 1 : 2);
    const link = edges
      .filter(({ a, b, len }) => len >= 3.2 && ((a.id === stranded.id && seen.has(b.id)) || (b.id === stranded.id && seen.has(a.id))))
      .map((edge) => (edge.a.id === stranded.id ? edge.b : edge.a))
      .sort((p, q) => order(q) - order(p))[0];
    if (!link) break;
    choice.set(pairKey(stranded.id, link.id), "door");
  }
  // 4. The architect's word is final.
  for (const { a, b } of edges) {
    const o = design.doors?.[pairKey(a.id, b.id)];
    if (o) choice.set(pairKey(a.id, b.id), o === "none" ? "wall" : o);
  }

  return edges.map(({ e, a, b, len }) => {
    const kind = choice.get(pairKey(a.id, b.id)) ?? "wall";
    const stair = a.type === "stair" ? a : b.type === "stair" ? b : undefined;
    let width = stair ? Math.min(len - 0.6, 3.6) : 3;
    // Doors sit near a corner rather than mid-wall, so rooms keep a usable run of wall.
    let at = len > 9 && !stair ? Math.min(len - width / 2 - 0.8, 2.6) : len / 2;
    if (stair && kind === "door") {
      const span = doorSpanOnStair(e, stair, design.floorHeight);
      const start = Math.abs(e.y1 - e.y0) < 0.01 ? Math.min(e.x0, e.x1) : Math.min(e.y0, e.y1);
      if (span) {
        width = Math.min(3, span[1] - span[0]);
        at = (span[0] + span[1]) / 2 - start;
      } else width = 0;
    }
    const door: [number, number] | null = kind === "open" ? [0, len] : kind === "door" && width >= 2.4 ? [at - width / 2, at + width / 2] : kind === "glass" ? [len * 0.3, len * 0.7] : null;
    return { ...e, door, glass: kind === "glass", a: a.id, b: b.id, kind };
  });
}
