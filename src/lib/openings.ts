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
      const s = spec(room, length, design.direction);
      if (!s || length < 4) continue;
      const w = Math.min(s.w, length - 1.6);
      out.push({ side, a: mid - w / 2, b: mid + w / 2, sill: s.sill, head: Math.min(s.head, wallH - 0.2), kind: "window", roomId: room.id });
    }
  }
  return out;
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
}

/** Interior walls: every shared edge between two rooms on a floor, with a door where it makes sense. */
export function partitionsOf(design: Design, floor: number): Partition[] {
  const rooms = design.rooms.filter((r) => r.floor === floor);
  const out: Partition[] = [];
  const open = (r: Room) => r.type === "court" || r.type === "void";
  const flows = (a: Room, b: Room) => {
    const pair = [a.type, b.type].sort().join(":");
    // Living, dining and kitchen open into each other on the open plan.
    if (design.direction === "open" && ["dining:living", "dining:kitchen", "foyer:living"].includes(pair)) return "none";
    return "door";
  };
  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i]!;
      const b = rooms[j]!;
      // Vertical shared edge (a | b).
      for (const [l, r] of [
        [a, b],
        [b, a],
      ] as const) {
        if (Math.abs(l.x + l.w - r.x) < EPS) {
          const y0 = Math.max(l.y, r.y);
          const y1 = Math.min(l.y + l.d, r.y + r.d);
          if (y1 - y0 > 0.5) out.push(edge(l.x + l.w, y0, l.x + l.w, y1, l, r));
        }
        if (Math.abs(l.y + l.d - r.y) < EPS) {
          const x0 = Math.max(l.x, r.x);
          const x1 = Math.min(l.x + l.w, r.x + r.w);
          if (x1 - x0 > 0.5) out.push(edge(x0, l.y + l.d, x1, l.y + l.d, l, r));
        }
      }
    }
  }
  return out.filter((p): p is Partition => p !== null);

  function edge(x0: number, y0: number, x1: number, y1: number, l: Room, r: Room): Partition {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const glass = open(l) || open(r);
    const kind = flows(l, r);
    if (kind === "none") return { x0, y0, x1, y1, door: [0, len], glass: false };
    const stairPair = l.type === "stair" || r.type === "stair";
    const needsDoor = !glass && len >= 3.6 && !(l.type === "bath" && r.type === "bath");
    const width = stairPair ? Math.min(len - 0.6, 3.6) : 3;
    const at = len / 2;
    return { x0, y0, x1, y1, door: needsDoor ? [at - width / 2, at + width / 2] : glass ? [len * 0.3, len * 0.7] : null, glass };
  }
}
