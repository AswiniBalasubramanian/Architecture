// Vastu Shastra and feng shui basics, checked against the plan's real compass
// orientation. Rules are the widely used residential guidelines (zones of the
// nine-square grid); practitioners differ on details, so this is a first pass
// for a consultant to refine, not a substitute for one.

import { openingsOf, partitionsOf } from "./openings";
import type { Brief, Design, Facing, Room } from "./types";

export type Zone = "NE" | "N" | "NW" | "E" | "C" | "W" | "SE" | "S" | "SW";

export interface VastuItem {
  id: string;
  system: "Vastu" | "Feng shui";
  label: string;
  ok: boolean;
  /** Rules that are a strong preference rather than a requirement. */
  soft?: boolean;
  detail: string;
}

const FACING_VEC: Record<Facing, [number, number]> = { north: [0, 1], east: [1, 0], south: [0, -1], west: [-1, 0] };

/**
 * Compass zone of a point. Plan x runs left→right as seen from the street and y
 * runs from the street to the back; the street side faces `facing`.
 */
export function zoneAt(design: Design, facing: Facing, x: number, y: number): Zone {
  const fp = design.footprint;
  const [fx, fy] = FACING_VEC[facing];
  // +x in plan points to the viewer's right when they stand on the street facing the house.
  const right: [number, number] = [-fy, fx];
  const back: [number, number] = [-fx, -fy];
  const u = (x - (fp.x + fp.w / 2)) / (fp.w / 2);
  const v = (y - (fp.y + fp.d / 2)) / (fp.d / 2);
  const e = u * right[0] + v * back[0];
  const n = u * right[1] + v * back[1];
  const ew = e > 1 / 3 ? "E" : e < -1 / 3 ? "W" : "";
  const ns = n > 1 / 3 ? "N" : n < -1 / 3 ? "S" : "";
  return ((ns + ew) || "C") as Zone;
}

export const zoneOf = (design: Design, facing: Facing, r: Room) => zoneAt(design, facing, r.x + r.w / 2, r.y + r.d / 2);

const ZONE_NAME: Record<Zone, string> = { NE: "north-east", N: "north", NW: "north-west", E: "east", C: "centre", W: "west", SE: "south-east", S: "south", SW: "south-west" };

export function checkVastu(brief: Brief, design: Design): { items: VastuItem[]; score: number } {
  const facing = brief.facing ?? "east";
  const items: VastuItem[] = [];
  const z = (r: Room) => zoneOf(design, facing, r);
  const where = (r: Room) => ZONE_NAME[z(r)];
  const rule = (id: string, label: string, room: Room | undefined, good: Zone[], why: string, soft = false) => {
    if (!room) return;
    const ok = good.includes(z(room));
    items.push({ id, system: "Vastu", label, ok, soft, detail: `${room.name} is in the ${where(room)}; ${why}` });
  };
  const ground = design.rooms.filter((r) => r.floor === 0);
  const first = (t: Room["type"], pool = design.rooms) => pool.find((r) => r.type === t);

  // Entrance: the main door's zone.
  const door = openingsOf(design, 0).find((o) => o.kind === "door" && o.side === "front");
  if (door) {
    const fp = design.footprint;
    const zone = zoneAt(design, facing, (door.a + door.b) / 2, fp.y);
    const ok = ["N", "NE", "E"].includes(zone) || (zone === "NW" && facing === "north") || (zone === "SE" && facing === "east");
    items.push({ id: "entrance", system: "Vastu", label: "Main entrance", ok, detail: `The entrance is in the ${ZONE_NAME[zone]}; north, east and north-east entrances are preferred.` });
  }
  rule("kitchen", "Kitchen", first("kitchen"), ["SE", "NW", "E"], "the south-east (Agni) is ideal, the north-west acceptable.");
  rule("master", "Master bedroom", first("master") ?? first("bedroom"), ["SW", "S", "W"], "the south-west gives the head of the house stability.");
  rule("pooja", "Prayer room", first("pooja"), ["NE", "N", "E"], "the north-east (Ishanya) is the place for worship.");
  rule("living", "Living room", first("living"), ["N", "NE", "E", "NW"], "north, east or north-east living rooms are preferred.", true);
  rule("stair", "Staircase", first("stair", ground), ["S", "SW", "W", "SE", "NW"], "stairs belong in the south or west, never the north-east or centre.");
  for (const b of design.rooms.filter((r) => r.type === "bath")) {
    const ok = !["NE", "C", "SW"].includes(z(b));
    items.push({ id: `bath:${b.id}`, system: "Vastu", label: b.name, ok, detail: `In the ${where(b)}; toilets should avoid the north-east, the centre (Brahmasthan) and the south-west.` });
  }
  const centre = ground.filter((r) => z(r) === "C" && !["court", "foyer", "living", "family", "dining", "stair", "void"].includes(r.type));
  items.push({ id: "brahmasthan", system: "Vastu", label: "Brahmasthan (centre)", ok: centre.length === 0, soft: true, detail: centre.length ? `${centre.map((r) => r.name).join(", ")} sit at the centre; keep it open or lightly used.` : "The centre is kept open or for living." });

  // Feng shui basics.
  if (door) {
    const fp = design.footprint;
    const back = openingsOf(design, 0).filter((o) => o.side === "back" && (o.kind === "door" || o.kind === "glazing") && o.sill < 0.2);
    const aligned = back.some((o) => Math.min(o.b, door.b) - Math.max(o.a, door.a) > 1);
    items.push({ id: "fs-chi", system: "Feng shui", label: "Front and back doors", ok: !aligned, soft: true, detail: aligned ? "The back door lines up with the front door, so energy rushes straight through; offset one or screen it." : "The front door does not line up with a back opening." });
    const stairFacing = ground.find((r) => r.type === "stair" && r.x <= (door.a + door.b) / 2 && r.x + r.w >= (door.a + door.b) / 2 && r.y - fp.y < 14);
    items.push({ id: "fs-stair", system: "Feng shui", label: "Stair and entrance", ok: !stairFacing, soft: true, detail: stairFacing ? "The stair starts directly opposite the front door; turn it or screen it with a foyer wall." : "The stair does not face the front door." });
  }
  // Beds in line with the bedroom door ("coffin position").
  for (let f = 0; f < Math.max(1, brief.floors); f++) {
    const parts = partitionsOf(design, f);
    for (const bed of design.furniture.filter((i) => i.kind === "bed" && i.floor === f)) {
      const room = design.rooms.find((r) => r.floor === f && bed.x > r.x && bed.x < r.x + r.w && bed.y > r.y && bed.y < r.y + r.d);
      if (!room) continue;
      const doorWall = parts.find((p) => (p.a === room.id || p.b === room.id) && p.kind === "door");
      if (!doorWall || !doorWall.door) continue;
      const horiz = Math.abs(doorWall.y1 - doorWall.y0) < 0.01;
      const len0 = horiz ? Math.min(doorWall.x0, doorWall.x1) : Math.min(doorWall.y0, doorWall.y1);
      const mid = len0 + (doorWall.door[0] + doorWall.door[1]) / 2;
      // The bed's foot faces the door when the door is on the wall the foot points at, and in line with the bed.
      const t = (bed.rot * Math.PI) / 180;
      const footDir = [Math.sin(t), -Math.cos(t)];
      const towards = horiz ? Math.sign(doorWall.y0 - bed.y) === Math.sign(-footDir[1]) && Math.abs(mid - bed.x) < 2.5 : Math.sign(doorWall.x0 - bed.x) === Math.sign(footDir[0]) && Math.abs(mid - bed.y) < 2.5;
      items.push({ id: `fs-bed:${room.id}`, system: "Feng shui", label: `${room.name}: bed`, ok: !towards, soft: true, detail: towards ? "The bed's foot is in line with the door; shift the bed or the door." : "The bed is out of line with the door." });
    }
  }
  const hard = items.filter((i) => !i.soft);
  const soft = items.filter((i) => i.soft);
  const score = items.length ? Math.round(((hard.filter((i) => i.ok).length * 2 + soft.filter((i) => i.ok).length) / (hard.length * 2 + soft.length)) * 100) : 100;
  return { items, score };
}
