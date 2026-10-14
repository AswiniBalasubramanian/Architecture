// Plan check: measures a concept against common residential planning standards.
// Thresholds follow India's National Building Code 2016 (Part 3) minimums for
// habitable rooms, kitchens, baths, stairs and ventilation, plus circulation
// and structural-alignment checks. It is a design aid that flags problems early;
// it does not replace local bye-laws or an engineer's review.

import { stairOf, openingsOf, partitionsOf, attachedOf, CIRCULATION } from "./openings";
import type { Design, Room } from "./types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface CheckItem {
  id: string;
  group: "Room sizes" | "Light & air" | "Circulation" | "Structure" | "Stair";
  label: string;
  status: CheckStatus;
  detail: string;
  roomId?: string;
}

export interface PlanCheck {
  items: CheckItem[];
  /** 0–100: passes count fully, warnings half. */
  score: number;
  counts: Record<CheckStatus, number>;
}

const SQM = 10.7639; // ft² per m²
const M = 3.28084; // ft per m

/** Minimum area (ft²) and least dimension (ft) per room type. */
const MINIMA: Partial<Record<Room["type"], { area: number; width: number; basis: string }>> = {
  master: { area: 9.5 * SQM, width: 2.4 * M, basis: "NBC: main habitable room ≥ 9.5 m², width ≥ 2.4 m" },
  living: { area: 9.5 * SQM, width: 2.4 * M, basis: "NBC: main habitable room ≥ 9.5 m², width ≥ 2.4 m" },
  bedroom: { area: 7.5 * SQM, width: 2.1 * M, basis: "NBC: other habitable rooms ≥ 7.5 m², width ≥ 2.1 m" },
  family: { area: 7.5 * SQM, width: 2.1 * M, basis: "NBC: habitable room ≥ 7.5 m², width ≥ 2.1 m" },
  study: { area: 7.5 * SQM, width: 2.1 * M, basis: "NBC: habitable room ≥ 7.5 m², width ≥ 2.1 m" },
  dining: { area: 7.5 * SQM, width: 2.1 * M, basis: "NBC: habitable room ≥ 7.5 m², width ≥ 2.1 m" },
  kitchen: { area: 5 * SQM, width: 1.8 * M, basis: "NBC: kitchen ≥ 5.0 m², width ≥ 1.8 m" },
  bath: { area: 2.8 * SQM, width: 1.2 * M, basis: "NBC: combined bath + WC ≥ 2.8 m², width ≥ 1.2 m" },
};

const HABITABLE = new Set<Room["type"]>(["living", "dining", "bedroom", "master", "family", "study", "kitchen"]);
const ft = (v: number) => `${Math.round(v * 10) / 10} ft`;
const sqft = (v: number) => `${Math.round(v)} ft²`;

export function checkPlan(design: Design, floors: number): PlanCheck {
  const items: CheckItem[] = [];
  const rooms = design.rooms.filter((r) => r.type !== "void" && r.type !== "court" && r.type !== "parking");
  const push = (item: CheckItem) => items.push(item);

  // Room sizes.
  for (const r of rooms) {
    const m = MINIMA[r.type];
    if (!m) continue;
    const area = r.w * r.d;
    const least = Math.min(r.w, r.d);
    const bad = area < m.area * 0.999 || least < m.width * 0.999;
    const near = !bad && (area < m.area * 1.1 || least < m.width + 0.5);
    push({
      id: `size:${r.id}`,
      group: "Room sizes",
      label: r.name,
      status: bad ? "fail" : near ? "warn" : "pass",
      detail: `${sqft(area)}, least side ${ft(least)}. ${m.basis}.`,
      roomId: r.id,
    });
    // Anthropometrics: a double bed needs about 2 ft of walking space on both sides and the foot.
    if ((r.type === "bedroom" || r.type === "master") && least < 10) {
      push({ id: `bed:${r.id}`, group: "Room sizes", label: `${r.name}: bed clearance`, status: least < 9 ? "fail" : "warn", detail: `Least side ${ft(least)}; a 6 ft bed with 2 ft clear on each side needs about 10 ft.`, roomId: r.id });
    }
  }

  // Light and air: every habitable room needs an outside window of at least a tenth of its floor area.
  const glazing = new Map<string, number>();
  for (let f = 0; f < floors; f++)
    for (const o of openingsOf(design, f))
      if (o.kind === "window" || o.kind === "glazing") glazing.set(o.roomId, (glazing.get(o.roomId) ?? 0) + (o.b - o.a) * (o.head - o.sill));
  for (const r of rooms) {
    const area = r.w * r.d;
    const g = glazing.get(r.id) ?? 0;
    if (HABITABLE.has(r.type)) {
      const ratio = g / area;
      push({
        id: `vent:${r.id}`,
        group: "Light & air",
        label: r.name,
        status: g === 0 ? "fail" : ratio < 0.1 ? "warn" : "pass",
        detail: g === 0 ? "No outside window: needs a window on an exterior wall, a court or a skylight." : `Window area ${Math.round(g)} ft² is ${Math.round(ratio * 100)}% of the floor (NBC asks for at least 10%).`,
        roomId: r.id,
      });
    } else if (r.type === "bath") {
      push({ id: `vent:${r.id}`, group: "Light & air", label: r.name, status: g >= 4 ? "pass" : "warn", detail: g >= 4 ? `Ventilator ${Math.round(g)} ft².` : "No outside window: add an exhaust duct or ventilation shaft (NBC: ventilator ≥ 0.37 m²).", roomId: r.id });
    }
  }

  // Circulation: reachable rooms, and private rooms that are not passages.
  for (let f = 0; f < floors; f++) {
    const parts = partitionsOf(design, f);
    const floorRooms = design.rooms.filter((r) => r.floor === f && r.type !== "void" && r.type !== "parking");
    const byId = new Map(floorRooms.map((r) => [r.id, r]));
    const doorsOf = (id: string) => parts.filter((p) => (p.a === id || p.b === id) && (p.kind === "door" || p.kind === "open" || p.kind === "glass"));
    const start = f === 0 ? floorRooms.find((r) => r.type === "foyer" || r.type === "court") ?? floorRooms.find((r) => r.type === "living") : floorRooms.find((r) => r.type === "stair");
    // Rooms reached only by passing through a bedroom or bath.
    const seen = new Map<string, string[]>();
    if (start) {
      seen.set(start.id, []);
      const queue = [start.id];
      while (queue.length) {
        const id = queue.shift()!;
        const room = byId.get(id);
        const via = seen.get(id)!;
        for (const p of doorsOf(id)) {
          const other = p.a === id ? p.b : p.a;
          if (seen.has(other) || !byId.has(other)) continue;
          const through = room && !CIRCULATION.has(room.type) && room.id !== start.id ? [...via, room.name] : via;
          seen.set(other, through);
          queue.push(other);
        }
      }
    }
    for (const r of floorRooms) {
      if (r.type === "court") continue;
      const via = seen.get(r.id);
      const isEnsuite = r.type === "bath" && attachedOf(r, floorRooms) !== undefined;
      if (via === undefined) push({ id: `reach:${r.id}`, group: "Circulation", label: r.name, status: "fail", detail: "Not reachable through a door from the entrance or stair.", roomId: r.id });
      else if (via.length > 0 && !(isEnsuite && via.length === 1)) push({ id: `reach:${r.id}`, group: "Circulation", label: r.name, status: "warn", detail: `Reached only through ${via.join(", ")}. A passage or lobby would keep it private.`, roomId: r.id });
    }
    const passes = floorRooms.filter((r) => !items.some((i) => i.id === `reach:${r.id}`)).length;
    push({ id: `reach-floor:${f}`, group: "Circulation", label: f === 0 ? "Ground floor" : `Floor ${f}`, status: "pass", detail: `${passes} of ${floorRooms.length} spaces open directly off circulation.` });
  }

  // Structure: upper-floor walls should stand on walls below.
  if (floors > 1) {
    let total = 0;
    let carried = 0;
    const wallsOf = (f: number) => {
      const fp = design.footprint;
      const lines = partitionsOf(design, f).map((p) => ({ x0: p.x0, y0: p.y0, x1: p.x1, y1: p.y1 }));
      // The outer walls always stack.
      lines.push({ x0: fp.x, y0: fp.y, x1: fp.x + fp.w, y1: fp.y }, { x0: fp.x, y0: fp.y + fp.d, x1: fp.x + fp.w, y1: fp.y + fp.d }, { x0: fp.x, y0: fp.y, x1: fp.x, y1: fp.y + fp.d }, { x0: fp.x + fp.w, y0: fp.y, x1: fp.x + fp.w, y1: fp.y + fp.d });
      return lines;
    };
    for (let f = 1; f < floors; f++) {
      const below = wallsOf(f - 1);
      for (const w of partitionsOf(design, f)) {
        const horiz = Math.abs(w.y1 - w.y0) < 0.01;
        const len = Math.hypot(w.x1 - w.x0, w.y1 - w.y0);
        total += len;
        for (const b of below) {
          const bh = Math.abs(b.y1 - b.y0) < 0.01;
          if (bh !== horiz) continue;
          if (horiz ? Math.abs(b.y0 - w.y0) > 0.4 : Math.abs(b.x0 - w.x0) > 0.4) continue;
          const [a0, a1] = horiz ? [Math.min(w.x0, w.x1), Math.max(w.x0, w.x1)] : [Math.min(w.y0, w.y1), Math.max(w.y0, w.y1)];
          const [c0, c1] = horiz ? [Math.min(b.x0, b.x1), Math.max(b.x0, b.x1)] : [Math.min(b.y0, b.y1), Math.max(b.y0, b.y1)];
          carried += Math.max(0, Math.min(a1, c1) - Math.max(a0, c0));
        }
      }
    }
    const pct = total ? Math.min(100, Math.round((carried / total) * 100)) : 100;
    push({ id: "structure", group: "Structure", label: "Walls over walls", status: pct >= 70 ? "pass" : pct >= 45 ? "warn" : "fail", detail: `${pct}% of upper-floor wall length stands on a wall below; the rest needs beams. Aim for 70% or more.` });
  }

  // Stair.
  const stair = design.rooms.find((r) => r.type === "stair" && r.floor === 0);
  if (stair && floors > 1) {
    const st = stairOf(stair, design.floorHeight);
    const riser = st.riser * 12;
    const tread = st.run * 12;
    const widthOk = st.width >= 0.9 * M;
    push({ id: "stair-width", group: "Stair", label: "Flight width", status: widthOk ? "pass" : "fail", detail: `Dog-leg, two flights of ${st.perFlight} risers, ${ft(st.width)} clear (NBC residential ≥ 0.9 m / 2.95 ft).` });
    push({ id: "stair-steps", group: "Stair", label: "Riser and tread", status: riser <= 7.5 && tread >= 9.8 ? "pass" : "warn", detail: `${riser.toFixed(1)}″ risers, ${tread.toFixed(1)}″ treads (NBC: riser ≤ 190 mm / 7.5″, tread ≥ 250 mm / 9.8″).` });
  }

  const counts = { pass: 0, warn: 0, fail: 0 } as Record<CheckStatus, number>;
  for (const i of items) counts[i.status]++;
  const score = items.length ? Math.round(((counts.pass + counts.warn * 0.5) / items.length) * 100) : 100;
  return { items, score, counts };
}
