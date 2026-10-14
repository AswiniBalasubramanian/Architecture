// The cinematic walkthrough: one continuous camera path, built from the plan.
//
// It circles the house once (a full 360°), comes in from the street, walks up
// the drive and through the front door, moves room to room through the real
// doorways (the same openings the plan and the model use), turns a full circle
// in the main living spaces, climbs the stair through its stairwell, and leaves
// through an upper-floor window to finish on the aerial view.
//
// Position, heading, pitch and lens are keyed against time and joined with
// cubic Hermite curves, so speed and turn rate are continuous: no cuts, no
// jumps between rooms.

import * as THREE from "three";
import { ROOM_TYPES, floorName } from "@/lib/catalog";
import { stairOf, openingsOf, partitionsOf, type Opening } from "@/lib/openings";
import type { Brief, Design, Room } from "@/lib/types";

const PLINTH = 2;
const WALL = 0.75;
const EYE = 5.3;
const WALK = 3.3; // ft/s: an unhurried walking pace
const FOV_IN = 58;
const FOV_OUT = 42;

export interface Pose {
  p: THREE.Vector3;
  yaw: number;
  pitch: number;
  fov: number;
}

export interface TourChapter {
  t: number;
  title: string;
  detail: string;
  kind: "exterior" | "arrival" | "room" | "stair" | "finale";
  roomId?: string;
}

export interface Tour {
  duration: number;
  chapters: TourChapter[];
  /** Sample the path at time t (seconds). */
  at(t: number, out?: Pose): Pose;
}

type YawSpec = { auto: true } | { abs: number } | { rel: number };
interface RawKey {
  t: number;
  p: THREE.Vector3;
  yaw: YawSpec;
  pitch?: number;
  fov: number;
}

const wrapNear = (a: number, ref: number) => a + Math.round((ref - a) / (Math.PI * 2)) * Math.PI * 2;
/** Heading of a direction in three.js space: yaw 0 looks down +Z. */
export const yawOf = (dx: number, dz: number) => Math.atan2(dx, dz);
export const dirOf = (yaw: number, pitch: number, out = new THREE.Vector3()) => out.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));

/** Read heading and pitch back from a camera. */
export function poseOfCamera(cam: THREE.PerspectiveCamera): Pose {
  const d = new THREE.Vector3();
  cam.getWorldDirection(d);
  return { p: cam.position.clone(), yaw: yawOf(d.x, d.z), pitch: Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)), fov: cam.fov };
}

interface DoorLink {
  to: Room;
  /** Point in the doorway, and the unit normal pointing into `to`. */
  x: number;
  y: number;
  nx: number;
  ny: number;
}

function contains(r: Room, x: number, y: number) {
  return x > r.x - 0.01 && x < r.x + r.w + 0.01 && y > r.y - 0.01 && y < r.y + r.d + 0.01;
}

function graphOf(design: Design, floor: number) {
  const rooms = design.rooms.filter((r) => r.floor === floor && r.type !== "void");
  const links = new Map<string, DoorLink[]>();
  rooms.forEach((r) => links.set(r.id, []));
  for (const p of partitionsOf(design, floor)) {
    if (!p.door || p.door[1] - p.door[0] < 2.4) continue;
    const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
    const mid = (p.door[0] + p.door[1]) / 2;
    const x = p.x0 + ((p.x1 - p.x0) / len) * mid;
    const y = p.y0 + ((p.y1 - p.y0) / len) * mid;
    const horiz = Math.abs(p.y1 - p.y0) < 0.01;
    const [nx, ny] = horiz ? [0, 1] : [1, 0];
    const a = rooms.find((r) => contains(r, x - nx * 0.5, y - ny * 0.5));
    const b = rooms.find((r) => contains(r, x + nx * 0.5, y + ny * 0.5));
    if (!a || !b || a === b) continue;
    links.get(a.id)!.push({ to: b, x, y, nx, ny });
    links.get(b.id)!.push({ to: a, x, y, nx: -nx, ny: -ny });
  }
  return { rooms, links };
}

/** Breadth-first route from one room to every other: the doorways to pass. */
function routes(links: Map<string, DoorLink[]>, from: Room) {
  const prev = new Map<string, { via: DoorLink; from: string } | null>([[from.id, null]]);
  const queue = [from.id];
  while (queue.length) {
    const id = queue.shift()!;
    for (const l of links.get(id) ?? []) {
      if (prev.has(l.to.id)) continue;
      prev.set(l.to.id, { via: l, from: id });
      queue.push(l.to.id);
    }
  }
  return (to: Room): DoorLink[] | null => {
    if (!prev.has(to.id)) return null;
    const path: DoorLink[] = [];
    let id = to.id;
    while (prev.get(id)) {
      const step = prev.get(id)!;
      path.unshift(step.via);
      id = step.from;
    }
    return path;
  };
}

export function buildTour(brief: Brief, design: Design, start: Pose, aspect = 1.6): Tour {
  const fp = design.footprint;
  const FH = design.floorHeight;
  const floors = brief.floors;
  const cx = fp.x + fp.w / 2;
  const cy = fp.y + fp.d / 2;
  const level = (f: number) => PLINTH + f * FH;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x - cx, z, cy - y);
  const height = PLINTH + floors * FH + 6;

  const keys: RawKey[] = [];
  const chapters: TourChapter[] = [];
  let t = 0;
  const key = (p: THREE.Vector3, dt: number, fov: number, yaw: YawSpec = { auto: true }, pitch?: number) => {
    t += dt;
    keys.push({ t, p, yaw, pitch, fov });
  };
  const last = () => keys[keys.length - 1]!;
  const walk = (p: THREE.Vector3, speed = WALK, fov = FOV_IN, yaw: YawSpec = { auto: true }, pitch?: number) => key(p, Math.max(0.45, last().p.distanceTo(p) / speed), fov, yaw, pitch);
  const hold = (dt: number, yaw: YawSpec, pitch?: number) => key(last().p.clone(), dt, last().fov, yaw, pitch);
  const chapter = (c: Omit<TourChapter, "t">) => chapters.push({ t, ...c });

  // 0. From wherever the viewer left the camera.
  keys.push({ t: 0, p: start.p.clone(), yaw: { abs: start.yaw }, pitch: start.pitch, fov: start.fov });

  // 1. One full turn around the house, with a gentle crane up and down.
  const rr = Math.max(brief.plotWidth, brief.plotDepth) * 0.62 + 26;
  const c = new THREE.Vector3(0, height * 0.36, 0);
  const th0 = Math.atan2(start.p.x, start.p.z);
  const N = 18;
  const ORBIT = 28;
  chapter({ title: "The house in the round", detail: "A full 360° turn around the site", kind: "exterior" });
  for (let i = 0; i <= N; i++) {
    const th = th0 + (i / N) * Math.PI * 2;
    const p = new THREE.Vector3(rr * Math.sin(th), height * 0.85 + 12 + 6 * Math.sin((i / N) * Math.PI * 2), rr * Math.cos(th));
    const horiz = Math.hypot(p.x - c.x, p.z - c.z);
    key(p, i === 0 ? 2.6 : ORBIT / N, FOV_OUT, { abs: yawOf(c.x - p.x, c.z - p.z) }, Math.atan2(c.y - p.y, horiz));
  }

  // 2. Down to the street, up the drive, through the front door.
  const ground = openingsOf(design, 0);
  const front = ground.find((o) => o.kind === "door" && o.side === "front");
  const all = design.rooms;
  const tourable = (r: Room) => ROOM_TYPES[r.type].habitable || r.type === "foyer" || r.type === "court";
  const visited = new Set<string>();
  let floor = 0;
  let cur: Room | undefined;
  let px = 0;
  let py = 0;

  const dwell = (room: Room, nx: number, ny: number) => {
    visited.add(room.id);
    chapter({ title: room.name, detail: floorName(room.floor), kind: "room", roomId: room.id });
    const z = level(room.floor) + EYE;
    const big = (room.type === "living" || room.type === "family" || room.type === "court" || room.type === "dining") && room.w * room.d >= 140 && room.w >= 10 && room.d >= 10;
    if (big) {
      // Stand in the middle of the room and turn a full circle.
      const mx = room.x + room.w / 2;
      const my = room.y + room.d / 2;
      walk(V(mx, my, z), 3.4);
      px = mx;
      py = my;
      for (let k = 0; k < 4; k++) hold(2.3, { rel: Math.PI / 2 }, -0.05);
      return;
    }
    // Step a few feet in from the door and look across the room, left then right.
    const along = Math.abs(nx) > 0 ? room.w : room.d;
    const step = Math.min(3.2, along * 0.32);
    const vx = THREE.MathUtils.clamp(px + nx * step, room.x + 1.4, room.x + room.w - 1.4);
    const vy = THREE.MathUtils.clamp(py + ny * step, room.y + 1.4, room.y + room.d - 1.4);
    walk(V(vx, vy, z), 3.2);
    px = vx;
    py = vy;
    hold(1.9, { rel: 0.62 }, -0.07);
    hold(3.1, { rel: -1.24 }, -0.07);
    hold(1.3, { rel: 0.5 }, -0.05);
  };

  /** Walk a door route, stopping in each room on the tour that has not been seen yet. */
  const follow = (path: DoorLink[]) => {
    for (const l of path) {
      const z = level(floor) + EYE;
      walk(V(l.x - l.nx * 1.3, l.y - l.ny * 1.3, z));
      walk(V(l.x + l.nx * 1.3, l.y + l.ny * 1.3, z), 3.4);
      px = l.x + l.nx * 1.3;
      py = l.y + l.ny * 1.3;
      cur = l.to;
      if (tourable(l.to) && !visited.has(l.to.id)) dwell(l.to, l.nx, l.ny);
    }
  };

  if (front) {
    const doorX = (front.a + front.b) / 2;
    key(V(doorX, -15, 5.8), 5, 48, { abs: Math.PI }, 0.14);
    chapter({ title: "Arrival", detail: "From the street to the front door", kind: "arrival" });
    hold(1.8, { abs: Math.PI }, 0.2);
    walk(V(doorX, 0.4, 5.8), 3.6, 50, { abs: Math.PI }, 0.1);
    walk(V(doorX, fp.y - 4.4, 5.8), 3.4, 52, { abs: Math.PI }, 0.04);
    walk(V(doorX, fp.y - 1.4, PLINTH + EYE), 2.8, 55, { abs: Math.PI }, 0);
    walk(V(doorX, fp.y + WALL / 2, PLINTH + EYE), 2.4, FOV_IN, { abs: Math.PI }, -0.02);
    walk(V(doorX, fp.y + 2.6, PLINTH + EYE), 3, FOV_IN);
    px = doorX;
    py = fp.y + 2.6;
    cur = all.find((r) => r.id === front.roomId);

    for (floor = 0; floor < floors && cur; floor++) {
      const { links } = graphOf(design, floor);
      if (cur && tourable(cur) && !visited.has(cur.id)) dwell(cur, 0, 1);
      // Nearest unseen room by doorways, until the floor is done.
      for (;;) {
        const route = routes(links, cur!);
        const left = all
          .filter((r) => r.floor === floor && tourable(r) && !visited.has(r.id))
          .map((r) => ({ r, path: route(r) }))
          .filter((x): x is { r: Room; path: DoorLink[] } => x.path !== null)
          .sort((a, b) => a.path.length - b.path.length || Math.hypot(a.r.x + a.r.w / 2 - px, a.r.y + a.r.d / 2 - py) - Math.hypot(b.r.x + b.r.w / 2 - px, b.r.y + b.r.d / 2 - py));
        if (!left.length) break;
        follow(left[0]!.path);
        if (!visited.has(left[0]!.r.id)) visited.add(left[0]!.r.id);
      }
      if (floor >= floors - 1) break;
      // Up the stair, through the stairwell, onto the next floor.
      const stair = all.find((r) => r.floor === floor && r.type === "stair");
      const above = stair && all.find((r) => r.floor === floor + 1 && r.type === "stair");
      const path = stair && routes(links, cur!)(stair);
      if (!stair || !above || !path) break;
      follow(path);
      // A dog-leg: up flight 1 to the half-landing, turn, up flight 2 to the landing above.
      const st = stairOf(stair, FH);
      const ux = (st.up.x0 + st.up.x1) / 2;
      const dx = (st.down.x0 + st.down.x1) / 2;
      const z0 = level(floor);
      const halfZ = z0 + st.perFlight * st.riser;
      const landY = (st.yTop + st.well.y1) / 2;
      chapter({ title: `Up to the ${floorName(floor + 1).toLowerCase()}`, detail: "Stair", kind: "stair" });
      walk(V(ux, stair.y + 1.2, z0 + EYE), 2.6, FOV_IN, { abs: Math.PI });
      walk(V(ux, st.y0 + 0.3, z0 + EYE + 0.1), 2.2, FOV_IN, { abs: Math.PI }, 0.22);
      walk(V(ux, st.yTop - 0.2, halfZ + EYE), 2.2, FOV_IN, { abs: Math.PI }, 0.28);
      walk(V((ux + dx) / 2, landY, halfZ + EYE), 1.6, FOV_IN, { abs: Math.PI / 2 }, 0);
      walk(V(dx, st.yTop - 0.2, halfZ + EYE + 0.1), 1.6, FOV_IN, { abs: 0 }, 0.2);
      walk(V(dx, st.y0 + 0.2, level(floor + 1) + EYE), 2.2, FOV_IN, { abs: 0 }, 0.12);
      walk(V(dx, stair.y + 1.4, level(floor + 1) + EYE), 2, FOV_IN, { abs: 0 }, -0.04);
      px = dx;
      py = stair.y + 1.4;
      cur = above;
    }
  }

  // 3. Out through an upper-floor window, then rise to the aerial view.
  const top = Math.min(floor, floors - 1);
  if (front && cur) {
    const { links } = graphOf(design, top);
    const route = routes(links, cur);
    const ops = openingsOf(design, top).filter((o) => (o.kind === "window" || o.kind === "glazing") && o.head - o.sill > 3 && o.b - o.a > 2.4);
    const pick = ops
      .map((o) => ({ o, path: route(all.find((r) => r.id === o.roomId)!) }))
      .filter((x): x is { o: Opening; path: DoorLink[] } => x.path !== null)
      .sort((a, b) => a.path.length - b.path.length || (a.o.side === "front" ? -1 : 0) - (b.o.side === "front" ? -1 : 0))[0];
    if (pick) {
      follow(pick.path);
      const o = pick.o;
      const w = o.b - o.a;
      const panes = Math.max(1, Math.round(w / 3));
      const s = o.a + (w / panes) * (Math.floor(panes / 2) + (panes % 2 ? 0.5 : -0.5));
      const zc = level(top) + (o.sill + Math.min(o.head, FH - 0.8)) / 2;
      const out = o.side === "front" ? [0, -1] : o.side === "back" ? [0, 1] : o.side === "left" ? [-1, 0] : [1, 0];
      const face = o.side === "front" ? fp.y : o.side === "back" ? fp.y + fp.d : o.side === "left" ? fp.x : fp.x + fp.w;
      const at = (d: number): [number, number] => (o.side === "front" || o.side === "back" ? [s, face + out[1]! * d] : [face + out[0]! * d, s]);
      chapter({ title: "Finale", detail: "Out through the window to the aerial view", kind: "finale" });
      walk(V(...at(-WALL - 2.6), zc), 2.6, 60);
      walk(V(...at(2.5), zc), 2.2, 54);
      walk(V(...at(12), zc + 1.5), 4.5, 46);
    }
  }

  // Settle on the same aerial view the explorer opens with.
  const dist = (Math.max(fp.w, fp.d, height) * 2.5 + 20) * Math.max(1, Math.sqrt(1.3 / Math.max(0.3, aspect)));
  const target = new THREE.Vector3(0, height * 0.42, 0);
  const aerial = target.clone().add(new THREE.Vector3(0.95, 1.05, 1.35).normalize().multiplyScalar(dist));
  const mid = last().p.clone().lerp(aerial, 0.5);
  mid.y = Math.max(mid.y, aerial.y * 0.7);
  if (!front) chapter({ title: "Finale", detail: "Back to the aerial view", kind: "finale" });
  const face = (p: THREE.Vector3) => ({ yaw: { abs: yawOf(target.x - p.x, target.z - p.z) } as YawSpec, pitch: Math.atan2(target.y - p.y, Math.hypot(target.x - p.x, target.z - p.z)) });
  const fm = face(mid);
  key(mid, 4.2, 38, fm.yaw, fm.pitch);
  const fa = face(aerial);
  key(aerial, 3.6, 34, fa.yaw, fa.pitch);

  return compile(keys, chapters);
}

/* ----------------------------------------------------------- sampling */

function compile(raw: RawKey[], chapters: TourChapter[]): Tour {
  const n = raw.length;
  const ts = raw.map((k) => k.t);
  const ps = raw.map((k) => k.p);
  // Resolve headings: look along the walk, or as keyed; always unwrapped.
  const yaws: number[] = [];
  const pitches: number[] = [];
  for (let i = 0; i < n; i++) {
    const k = raw[i]!;
    const prev = i ? yaws[i - 1]! : 0;
    let yaw = prev;
    if ("abs" in k.yaw) yaw = i ? wrapNear(k.yaw.abs, prev) : k.yaw.abs;
    else if ("rel" in k.yaw) yaw = prev + k.yaw.rel;
    else {
      const a = ps[Math.max(0, i - 1)]!;
      const b = ps[Math.min(n - 1, i + 1)]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      if (Math.hypot(dx, dz) > 0.05) yaw = wrapNear(yawOf(dx, dz), prev);
    }
    yaws.push(yaw);
    if (k.pitch !== undefined) pitches.push(k.pitch);
    else {
      const a = ps[Math.max(0, i - 1)]!;
      const b = ps[Math.min(n - 1, i + 1)]!;
      const h = Math.hypot(b.x - a.x, b.z - a.z);
      pitches.push(h > 0.05 ? -0.05 + Math.atan2(b.y - a.y, h) * 0.55 : (pitches[i - 1] ?? -0.05));
    }
  }
  const fovs = raw.map((k) => k.fov);

  // Tangents. Scalars use a monotone rule so pans never overshoot; positions
  // stop dead at holds and are eased a little to keep corners tight.
  const scalarTan = (v: number[]) =>
    v.map((_, i) => {
      if (i === 0 || i === n - 1) return 0;
      const a = v[i]! - v[i - 1]!;
      const b = v[i + 1]! - v[i]!;
      if (a * b <= 0) return 0;
      return (v[i + 1]! - v[i - 1]!) / (ts[i + 1]! - ts[i - 1]!);
    });
  const yawT = scalarTan(yaws);
  const pitchT = scalarTan(pitches);
  const fovT = scalarTan(fovs);
  const posT = ps.map((p, i) => {
    if (i === 0 || i === n - 1) return new THREE.Vector3();
    const a = p.distanceTo(ps[i - 1]!);
    const b = p.distanceTo(ps[i + 1]!);
    if (a < 0.02 || b < 0.02) return new THREE.Vector3();
    return ps[i + 1]!.clone().sub(ps[i - 1]!).multiplyScalar(0.85 / (ts[i + 1]! - ts[i - 1]!));
  });

  const duration = ts[n - 1]!;
  const herm = (s: number) => {
    const s2 = s * s;
    const s3 = s2 * s;
    return [2 * s3 - 3 * s2 + 1, s3 - 2 * s2 + s, -2 * s3 + 3 * s2, s3 - s2] as const;
  };
  let seg = 0;
  return {
    duration,
    chapters,
    at(time, out = { p: new THREE.Vector3(), yaw: 0, pitch: 0, fov: 50 }) {
      const tt = THREE.MathUtils.clamp(time, 0, duration);
      if (ts[seg]! > tt) seg = 0;
      while (seg < n - 2 && ts[seg + 1]! < tt) seg++;
      const i = seg;
      const j = Math.min(n - 1, i + 1);
      const h = Math.max(1e-6, ts[j]! - ts[i]!);
      const [h00, h10, h01, h11] = herm(THREE.MathUtils.clamp((tt - ts[i]!) / h, 0, 1));
      const sc = (v: number[], m: number[]) => h00 * v[i]! + h10 * h * m[i]! + h01 * v[j]! + h11 * h * m[j]!;
      out.p.set(0, 0, 0).addScaledVector(ps[i]!, h00).addScaledVector(posT[i]!, h10 * h).addScaledVector(ps[j]!, h01).addScaledVector(posT[j]!, h11 * h);
      out.yaw = sc(yaws, yawT);
      out.pitch = sc(pitches, pitchT);
      out.fov = sc(fovs, fovT);
      return out;
    },
  };
}

/** Which chapter is playing at time t. */
export function chapterAt(tour: Tour, t: number) {
  let k = 0;
  for (let i = 0; i < tour.chapters.length; i++) if (tour.chapters[i]!.t <= t + 0.01) k = i;
  return k;
}
