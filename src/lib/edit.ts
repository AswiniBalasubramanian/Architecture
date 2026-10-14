// Architect edits to a generated plan: move interior walls (resizing the rooms
// on both sides), and override windows and doors. Pure functions over Design.

import { openingsOf, pairKey, partitionsOf, sharedEdge, type Side } from "./openings";
import type { Design, DoorChoice, Room } from "./types";

const EPS = 0.01;
const half = (v: number) => Math.round(v * 2) / 2;

/** Least width or depth a room may be dragged down to, by type (ft). */
const MIN_SIDE: Partial<Record<Room["type"], number>> = { bath: 4, utility: 4, pooja: 4, stair: 9, parking: 9, foyer: 5, void: 4, court: 6 };
const minSide = (r: Room) => MIN_SIDE[r.type] ?? 7;

export interface WallLine {
  orient: "v" | "h";
  /** The wall's position: x for a vertical wall, y for a horizontal one. */
  at: number;
  /** Extent along the wall. */
  from: number;
  to: number;
  /** Rooms on the low side (left / front) and the high side (right / back). */
  low: string[];
  high: string[];
}

/**
 * The whole straight wall that a partition belongs to: every room whose edge
 * lies on that line, grown until both sides cover exactly the same extent, so
 * moving it keeps every room rectangular and the floor fully tiled.
 */
export function wallLineAt(design: Design, floor: number, orient: "v" | "h", at: number, from: number, to: number): WallLine | null {
  const rooms = design.rooms.filter((r) => r.floor === floor);
  const lowEdge = (r: Room) => (orient === "v" ? r.x + r.w : r.y + r.d);
  const highEdge = (r: Room) => (orient === "v" ? r.x : r.y);
  const span = (r: Room): [number, number] => (orient === "v" ? [r.y, r.y + r.d] : [r.x, r.x + r.w]);
  let lo = from;
  let hi = to;
  let low: Room[] = [];
  let high: Room[] = [];
  for (let pass = 0; pass < 20; pass++) {
    low = rooms.filter((r) => Math.abs(lowEdge(r) - at) < EPS && span(r)[1] > lo + EPS && span(r)[0] < hi - EPS);
    high = rooms.filter((r) => Math.abs(highEdge(r) - at) < EPS && span(r)[1] > lo + EPS && span(r)[0] < hi - EPS);
    const all = [...low, ...high].map(span);
    const nlo = Math.min(lo, ...all.map((s) => s[0]));
    const nhi = Math.max(hi, ...all.map((s) => s[1]));
    if (nlo === lo && nhi === hi) break;
    lo = nlo;
    hi = nhi;
  }
  const cover = (set: Room[]) => set.reduce((sum, r) => sum + (span(r)[1] - span(r)[0]), 0);
  if (!low.length || !high.length || Math.abs(cover(low) - (hi - lo)) > 0.05 || Math.abs(cover(high) - (hi - lo)) > 0.05) return null;
  return { orient, at, from: lo, to: hi, low: low.map((r) => r.id), high: high.map((r) => r.id) };
}

/** How far the wall can move each way before a room drops below its minimum size. */
export function wallLimits(design: Design, line: WallLine): [number, number] {
  const size = (r: Room) => (line.orient === "v" ? r.w : r.d);
  const byId = (id: string) => design.rooms.find((r) => r.id === id)!;
  const down = Math.min(...line.low.map(byId).map((r) => size(r) - minSide(r)));
  const up = Math.min(...line.high.map(byId).map((r) => size(r) - minSide(r)));
  return [-Math.max(0, down), Math.max(0, up)];
}

/** Move a wall by delta feet (clamped and snapped to half feet); furniture is kept inside its room. */
export function moveWall(design: Design, line: WallLine, delta: number): Design {
  const [min, max] = wallLimits(design, line);
  const d = half(Math.min(max, Math.max(min, delta)));
  if (d === 0) return design;
  const low = new Set(line.low);
  const high = new Set(line.high);
  const rooms = design.rooms.map((r) => {
    if (low.has(r.id)) return line.orient === "v" ? { ...r, w: half(r.w + d) } : { ...r, d: half(r.d + d) };
    if (high.has(r.id)) return line.orient === "v" ? { ...r, x: half(r.x + d), w: half(r.w - d) } : { ...r, y: half(r.y + d), d: half(r.d - d) };
    return r;
  });
  const moved = new Map(rooms.filter((r) => low.has(r.id) || high.has(r.id)).map((r) => [r.id, r]));
  const furniture = design.furniture.map((item) => {
    const before = design.rooms.find((r) => r.floor === item.floor && item.x > r.x && item.x < r.x + r.w && item.y > r.y && item.y < r.y + r.d);
    const after = before && moved.get(before.id);
    if (!after) return item;
    // Keep the piece the same distance from the wall it was not dragged with.
    let { x, y } = item;
    if (line.orient === "v" && high.has(after.id)) x += d;
    if (line.orient === "h" && high.has(after.id)) y += d;
    x = Math.min(after.x + after.w - 1, Math.max(after.x + 1, x));
    y = Math.min(after.y + after.d - 1, Math.max(after.y + 1, y));
    return { ...item, x, y };
  });
  return { ...design, rooms, furniture };
}

/** Every movable interior wall on a floor (one entry per straight wall line). */
export function movableWalls(design: Design, floor: number): WallLine[] {
  const seen = new Set<string>();
  const out: WallLine[] = [];
  for (const p of partitionsOf(design, floor)) {
    const orient = Math.abs(p.y1 - p.y0) < EPS ? "h" : "v";
    const at = orient === "v" ? p.x0 : p.y0;
    const [from, to] = orient === "v" ? [Math.min(p.y0, p.y1), Math.max(p.y0, p.y1)] : [Math.min(p.x0, p.x1), Math.max(p.x0, p.x1)];
    const line = wallLineAt(design, floor, orient, at, from, to);
    if (!line) continue;
    const key = `${line.orient}:${line.at}:${line.from}:${line.to}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

/* ------------------------------------------------------------ windows and doors */

export interface RoomWindow {
  side: Side;
  /** Current clear width (0 when there is none). */
  width: number;
  /** Longest window the wall allows. */
  max: number;
  overridden: boolean;
}

/** The exterior walls of a room and the window on each. */
export function roomWindows(design: Design, room: Room): RoomWindow[] {
  const fp = design.footprint;
  const sides: Array<[Side, boolean, number]> = [
    ["front", Math.abs(room.y - fp.y) < EPS, room.w],
    ["back", Math.abs(room.y + room.d - fp.y - fp.d) < EPS, room.w],
    ["left", Math.abs(room.x - fp.x) < EPS, room.d],
    ["right", Math.abs(room.x + room.w - fp.x - fp.w) < EPS, room.d],
  ];
  const ops = openingsOf(design, room.floor).filter((o) => o.roomId === room.id && (o.kind === "window" || o.kind === "glazing"));
  return sides
    .filter(([, touches, len]) => touches && len >= 4)
    .map(([side, , len]) => {
      const o = ops.find((x) => x.side === side);
      return { side, width: o ? Math.round((o.b - o.a) * 2) / 2 : 0, max: Math.max(1.5, len - 1.6), overridden: Boolean(design.windows?.[`${room.id}:${side}`]) };
    });
}

export function setWindow(design: Design, roomId: string, side: Side, width: number | null): Design {
  const windows = { ...(design.windows ?? {}) };
  const key = `${roomId}:${side}`;
  if (width === null) delete windows[key];
  else windows[key] = { width: Math.max(0, half(width)) };
  return { ...design, windows };
}

export interface RoomDoor {
  other: Room;
  kind: "door" | "open" | "wall" | "glass";
  overridden: boolean;
}

/** The walls a room shares with its neighbours, and whether each has a door. */
export function roomDoors(design: Design, room: Room): RoomDoor[] {
  const parts = partitionsOf(design, room.floor).filter((p) => p.a === room.id || p.b === room.id);
  return parts
    .map((p) => {
      const other = design.rooms.find((r) => r.id === (p.a === room.id ? p.b : p.a))!;
      return { other, kind: p.kind, overridden: Boolean(design.doors?.[pairKey(room.id, other.id)]) };
    })
    .filter((d) => d.other && sharedEdge(room, d.other));
}

export function setDoor(design: Design, a: string, b: string, choice: DoorChoice | null): Design {
  const doors = { ...(design.doors ?? {}) };
  const key = pairKey(a, b);
  if (choice === null) delete doors[key];
  else doors[key] = choice;
  return { ...design, doors };
}
