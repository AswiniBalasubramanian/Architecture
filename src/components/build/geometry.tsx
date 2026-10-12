// The construction figure: an architect's site model on a baseboard, with a
// small tower crane assembling the generated house in the order a real one is
// built. Every size comes from the brief and the generated design (feet → U).

import * as React from "react";
import {
  cylinder as kitCylinder,
  depthOf,
  extrude,
  fitProjection,
  insetPlan,
  iso,
  onTop,
  pathOf,
  planOutline,
  sideSeam,
  slabOf,
  topMatrix,
  topTicks,
  type Flat,
  type Plan,
  type Plane,
  type Point3,
  type Projection,
  type SolidPaths,
} from "@/components/iso/iso-kit";
import { Dots, FaceText, Line, Solid } from "@/components/iso/react/draw";
import type { Brief, Design, Room } from "@/lib/types";

export const U = 3; // world units per foot
export const VIEW_W = 720;
export const VIEW_H = 540;

export type PieceMode = "drop" | "rise" | "fade" | "draw";

export interface Piece {
  key: string;
  stage: number;
  at: number; // seconds into the build
  dur: number;
  mode: PieceMode;
  /** Height (world units) a dropped piece is carried from. */
  lift: number;
  /** Where the crane hook takes this piece (top centre, world). Null: no crane. */
  hook: Point3 | null;
  node: React.ReactNode;
}

export interface Stage {
  label: string;
  short: string;
  pipeline: "SVG plan" | "Structure" | "WebGL light" | "3D model";
  at: number;
  readout: string;
}

export interface CraneSpec {
  mast: Plane;
  top: number; // z of jib underside
  reach: number;
  back: React.ReactNode; // mast, ballast, cab, counter-jib side
}

export interface BuildScene {
  P: Projection;
  pieces: Piece[];
  stages: Stage[];
  crane: CraneSpec;
  duration: number;
  glassCount: number;
  label: string;
}

/* ---------------------------------------------------------------- helpers */

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

interface Ctx {
  P: Projection;
  Dp: number;
}

const R = (ctx: Ctx, room: Pick<Room, "x" | "y" | "w" | "d">): Plan => ({ x: room.x * U, y: (ctx.Dp - room.y - room.d) * U, w: room.w * U, d: room.d * U, r: 0 });

function view(P: Projection) {
  const a = ((P.azimuth ?? 45) * Math.PI) / 180;
  const e = ((P.elevation ?? 30) * Math.PI) / 180;
  return { V: [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)] as Point3, L: [-Math.sin(a), Math.cos(a)] as Plane };
}

/** A flat polygon in 3D, shaded by the kit's light. `inside` orients its normal outward. */
function facePaths(points: Point3[], inside: Point3, P: Projection) {
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1, z1] = points[i]!;
    const [x2, y2, z2] = points[(i + 1) % points.length]!;
    nx += (y1 - y2) * (z1 + z2);
    ny += (z1 - z2) * (x1 + x2);
    nz += (x1 - x2) * (y1 + y2);
  }
  const c = points.reduce((s, p) => [s[0] + p[0] / points.length, s[1] + p[1] / points.length, s[2] + p[2] / points.length] as Point3, [0, 0, 0] as Point3);
  if (nx * (c[0] - inside[0]) + ny * (c[1] - inside[1]) + nz * (c[2] - inside[2]) < 0) {
    nx = -nx;
    ny = -ny;
    nz = -nz;
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  nx /= len;
  ny /= len;
  nz /= len;
  const { V, L } = view(P);
  const visible = nx * V[0] + ny * V[1] + nz * V[2] > 1e-6;
  const h = Math.hypot(nx, ny) || 1;
  const lit = ((nx / h) * L[0] + (ny / h) * L[1] + 1) / 2;
  const shade = nz > 0.55 ? "top" : String(Math.min(3, Math.max(0, Math.floor(lit * 4))));
  return { d: pathOf(points.map((p) => iso(p, P)), true), visible, shade, depth: depthOf(c, P), normal: [nx, ny, nz] as Point3 };
}

function Face({ points, inside, P, tone = "hi" }: { points: Point3[]; inside: Point3; P: Projection; tone?: "hi" | "mid" | "lo" }) {
  const f = facePaths(points, inside, P);
  if (!f.visible) return null;
  return (
    <g className="iso-solid">
      <path className="iso-fill" d={f.d} />
      <path className={f.shade === "top" ? "iso-top" : "iso-shade"} data-shade={f.shade === "top" ? undefined : f.shade} d={f.d} />
      <path className="iso-line iso-edge" data-tone={tone} d={f.d} />
    </g>
  );
}

const quad = (P: Projection, pts: Point3[]) => pathOf(pts.map((p) => iso(p, P)), true);

/* ----------------------------------------------------------------- scene */

export function buildScene(brief: Brief, design: Design): BuildScene {
  const Wp = brief.plotWidth;
  const Dp = brief.plotDepth;
  const fp = design.footprint;
  const floors = brief.floors;
  const FH = design.floorHeight * U;
  const PLINTH = 2 * U;
  const SLAB = 0.6 * U;
  const T = 0.75 * U; // wall
  const margin = 6 * U;
  const street = 8 * U;
  const BOARD_H = 1.8 * U;

  // World extents.
  const FPW: Plan = { x: fp.x * U, y: (Dp - fp.y - fp.d) * U, w: fp.w * U, d: fp.d * U, r: 0 };
  const X0 = FPW.x;
  const X1 = FPW.x + FPW.w;
  const Y0 = FPW.y;
  const Y1 = FPW.y + FPW.d;
  const levelZ = (f: number) => PLINTH + f * FH;
  const wallTop = (f: number) => levelZ(f) + FH - SLAB;
  const roofZ = levelZ(floors);
  const span = Math.min(FPW.w, FPW.d);
  const pitchRise = design.roof === "flat" ? 3 * U : Math.min(9 * U, span * 0.32);
  const roofPeak = roofZ + pitchRise;
  const craneTop = roofPeak + 7 * U;
  const BOARD: Plan = { x: -margin, y: -margin, w: Wp * U + margin * 2, d: Dp * U + margin + street + 4 * U, r: 2.4 * U };

  const points: Point3[] = [
    [BOARD.x, BOARD.y, -BOARD_H - 1.2 * U],
    [BOARD.x + BOARD.w, BOARD.y + BOARD.d, -BOARD_H - 1.2 * U],
    [BOARD.x + BOARD.w, BOARD.y, -BOARD_H],
    [BOARD.x, BOARD.y + BOARD.d, -BOARD_H],
    [BOARD.x + BOARD.w, BOARD.y + BOARD.d, 0],
    // The crane's apex, where the mast really stands.
    [Math.max(1.6 * U, X0 - 3 * U), Math.max(1.6 * U, Y0 - 4.5 * U), craneTop + 9 * U],
  ];
  const P = fitProjection(points, VIEW_W, VIEW_H, { pad: 26, headroom: 34 });
  const ctx: Ctx = { P, Dp };

  const pieces: Piece[] = [];
  let seq = 0;
  const add = (stage: number, at: number, mode: PieceMode, node: React.ReactNode, options: { dur?: number; lift?: number; hook?: Point3 | null } = {}) => {
    const key = `p${seq++}`;
    pieces.push({ key, stage, at, mode, dur: options.dur ?? (mode === "drop" ? 0.7 : mode === "draw" ? 0.9 : 0.5), lift: options.lift ?? 18 * U, hook: options.hook ?? null, node: <g key={key}>{node}</g> });
  };

  /* ---------------------------------------------------------- the board */
  const feet: Plane[] = [
    [BOARD.x + 5 * U, BOARD.y + 5 * U],
    [BOARD.x + BOARD.w - 5 * U, BOARD.y + 5 * U],
    [BOARD.x + 5 * U, BOARD.y + BOARD.d - 5 * U],
    [BOARD.x + BOARD.w - 5 * U, BOARD.y + BOARD.d - 5 * U],
  ];
  const screws: Plane[] = [
    [BOARD.x + 2.2 * U, BOARD.y + 2.2 * U],
    [BOARD.x + BOARD.w - 2.2 * U, BOARD.y + 2.2 * U],
    [BOARD.x + 2.2 * U, BOARD.y + BOARD.d - 2.2 * U],
    [BOARD.x + BOARD.w - 2.2 * U, BOARD.y + BOARD.d - 2.2 * U],
  ];
  const streetPlan: Plan = { x: BOARD.x + 1.4 * U, y: Dp * U + 1 * U, w: BOARD.w - 2.8 * U, d: street - 1 * U, r: 0.6 * U };
  const rulerPlan: Plan = { x: 0, y: streetPlan.y + streetPlan.d + 0.6 * U, w: Wp * U, d: 1.9 * U, r: 0.3 * U };
  const ticks = topTicks(0, Wp * U, 2 * U, 5, rulerPlan.y + 0.15 * U, 0.35, [0.7 * U, 1.3 * U], P, "x");
  const kerbZ = 0.25;
  const laneY = streetPlan.y + streetPlan.d / 2;

  // The plot wall: back + far side first, near side + front later.
  const pw = 0.5 * U;
  const PWH = 1.6 * U;
  const gate = (() => {
    const parking = design.rooms.find((r) => r.floor === 0 && r.type === "parking" && Math.abs(r.y - fp.y) < 0.01);
    const foyer = design.rooms.find((r) => r.floor === 0 && (r.type === "foyer" || r.type === "court") && Math.abs(r.y - fp.y) < 0.01);
    const host = parking ?? foyer;
    if (host) return [host.x * U, (host.x + host.w) * U] as const;
    return [fp.x * U + fp.w * U * 0.35, fp.x * U + fp.w * U * 0.6] as const;
  })();
  const plotWalls = {
    back: slabOf({ x: 0, y: 0, w: Wp * U, d: pw, r: 0 }, 0, PWH, P, 2, 0.3),
    left: slabOf({ x: 0, y: pw, w: pw, d: Dp * U - pw * 2, r: 0 }, 0, PWH, P, 2, 0.3),
    right: slabOf({ x: Wp * U - pw, y: pw, w: pw, d: Dp * U - pw * 2, r: 0 }, 0, PWH, P, 2, 0.3),
    frontL: slabOf({ x: 0, y: Dp * U - pw, w: gate[0] - 0.6 * U, d: pw, r: 0 }, 0, PWH, P, 2, 0.3),
    frontR: slabOf({ x: gate[1] + 0.6 * U, y: Dp * U - pw, w: Wp * U - gate[1] - 0.6 * U, d: pw, r: 0 }, 0, PWH, P, 2, 0.3),
  };
  const gatePiers = [gate[0] - 0.6 * U, gate[1] + 0.6 * U].map((x) => slabOf({ x: x - 0.7 * U, y: Dp * U - pw - 0.2 * U, w: 1.4 * U, d: pw + 0.4 * U, r: 0 }, 0, PWH + 0.9 * U, P, 2, 0.3));

  // Lawn dots in the rear garden: a grass texture that ends on the plot wall.
  const lawn: Flat[] = [];
  for (let x = 2 * U; x < Wp * U - 1.5 * U; x += 2.4 * U)
    for (let y = 2 * U; y < Y0 - 1 * U; y += 2.4 * U) lawn.push(iso([x + ((y / U) % 2) * 0.6 * U, y, 0.2], P));

  const driveway: Plan | null = (() => {
    const parking = design.rooms.find((r) => r.floor === 0 && r.type === "parking" && Math.abs(r.y - fp.y) < 0.01);
    if (!parking) return null;
    return { x: parking.x * U + 1 * U, y: Y1, w: parking.w * U - 2 * U, d: Dp * U - Y1 - pw, r: 0 };
  })();
  const path: Plan | null = (() => {
    if (driveway) return null;
    return { x: gate[0] + 0.4 * U, y: Y1, w: gate[1] - gate[0] - 0.8 * U, d: Dp * U - Y1 - pw, r: 0 };
  })();

  const boardArt = (
    <g key="board">
      {feet.map(([x, y], i) => (
        <g key={i}>
          <Solid paths={kitCylinder(x, y, 2.4 * U, -BOARD_H - 1.2 * U, 0.5 * U, P, 24)} tone="lo" />
          <Solid paths={kitCylinder(x, y, 1.7 * U, -BOARD_H - 0.7 * U, 0.7 * U, P, 24)} tone="lo" />
        </g>
      ))}
      <Solid paths={slabOf(BOARD, -BOARD_H, BOARD_H, P, 8, 0.9)} tone="mid" halo inner={<Line d={sideSeam(BOARD, -BOARD_H * 0.42, P)} tone="faint" />} />
      <Line d={planOutline(insetPlan(BOARD, 1.1 * U), 0, P)} tone="faint" />
      <Dots points={screws.map(([x, y]) => iso([x, y, 0], P))} size={0.9} tone="hi" />
      <Line d={screws.map(([x, y]) => onTop(Array.from({ length: 16 }, (_, i) => [x + Math.cos((i / 16) * Math.PI * 2) * 0.7 * U, y + Math.sin((i / 16) * Math.PI * 2) * 0.7 * U] as Plane), 0, P, true)).join("")} tone="lo" />
      {/* Street with its lane line, and a ruler strip in true feet. */}
      <Solid paths={slabOf(streetPlan, 0, kerbZ, P, 4)} tone="lo" flat />
      <Line d={onTop([[streetPlan.x, laneY], [streetPlan.x + streetPlan.w, laneY]], kerbZ, P)} tone="lo" dashed />
      <Solid paths={slabOf(rulerPlan, 0, 0.35, P, 3)} tone="lo" flat />
      <Line d={ticks.minor} tone="lo" />
      <Line d={ticks.major} tone="mid" />
      <Line d={onTop([[0, rulerPlan.y + 0.15 * U], [Wp * U, rulerPlan.y + 0.15 * U]], 0.35, P)} tone="mid" />
      {/* Label plate on the right margin, engraved with the project. */}
      <Solid paths={slabOf({ x: Wp * U + 1.4 * U, y: Dp * U * 0.52, w: 3.6 * U, d: Dp * U * 0.4, r: 0.4 * U }, 0, 0.4, P, 3)} tone="mid" />
      <FaceText transform={topMatrix([Wp * U + 2.4 * U, Dp * U * 0.55], 0.4, P, "y")} size={4.2} tone="mid">
        {brief.name.toUpperCase().slice(0, 28)}
      </FaceText>
      <Line d={[0, 1].map((row) => onTop([[Wp * U + 3.6 * U + row * 0.9 * U, Dp * U * 0.55], [Wp * U + 3.6 * U + row * 0.9 * U, Dp * U * (row ? 0.78 : 0.88)]], 0.4, P)).join("")} tone="faint" free />
      {/* North point. */}
      <Line d={onTop(Array.from({ length: 28 }, (_, i) => [Wp * U + 3.2 * U + Math.cos((i / 28) * Math.PI * 2) * 1.6 * U, -1 * U + Math.sin((i / 28) * Math.PI * 2) * 1.6 * U] as Plane), 0, P, true)} tone="lo" />
      <Line d={onTop([[Wp * U + 3.2 * U, -1 * U + 1.6 * U], [Wp * U + 3.2 * U, -1 * U - 1.6 * U]], 0, P)} tone="hi" />
      {/* Plot: boundary, rear lawn, the drive. */}
      <Dots points={lawn} size={0.55} tone="lo" />
      {driveway ? <Solid paths={slabOf(driveway, 0, 0.2, P, 2)} tone="lo" flat /> : null}
      {driveway ? <Line d={[0.3, 0.7].map((t) => onTop([[driveway.x + driveway.w * t, driveway.y], [driveway.x + driveway.w * t, driveway.y + driveway.d]], 0.2, P)).join("")} tone="faint" /> : null}
      {path ? <Solid paths={slabOf(path, 0, 0.2, P, 2)} tone="lo" flat /> : null}
      {path ? <Line d={Array.from({ length: Math.max(1, Math.floor(path.d / (1.6 * U))) }, (_, i) => onTop([[path.x, path.y + (i + 1) * 1.6 * U], [path.x + path.w, path.y + (i + 1) * 1.6 * U]], 0.2, P)).filter((_, i, all) => i < all.length - 1).join("")} tone="faint" /> : null}
    </g>
  );

  /* ------------------------------------------------------------ stage 0 */
  // Setting out: stakes at the footprint corners, string lines, the plan drawn on the ground.
  const stakeAt: Plane[] = [
    [X0 - 1.6 * U, Y0 - 1.6 * U],
    [X1 + 1.6 * U, Y0 - 1.6 * U],
    [X0 - 1.6 * U, Y1 + 1.6 * U],
    [X1 + 1.6 * U, Y1 + 1.6 * U],
  ];
  const stakeH = 2.6 * U;
  const stakes = stakeAt.map(([x, y]) => slabOf({ x: x - 0.3 * U, y: y - 0.3 * U, w: 0.6 * U, d: 0.6 * U, r: 0 }, 0, stakeH, P, 2));
  const string = (a: Plane, b: Plane) => pathOf([iso([a[0], a[1], stakeH - 0.5 * U], P), iso([b[0], b[1], stakeH - 0.5 * U], P)]);

  const stages: Stage[] = [];
  let t = 0.2;
  const perFloor = fp.w * fp.d;
  stages.push({ label: "Setting out the plan", short: "Plan", pipeline: "SVG plan", at: t, readout: `setting out · plot ${Wp} × ${Dp} ft` });

  [0, 1].forEach((i) => add(0, t + i * 0.12, "rise", <Solid paths={stakes[i]!} tone="mid" />, { dur: 0.4 }));
  const groundRooms = design.rooms.filter((r) => r.floor === 0);
  add(0, t + 0.3, "draw", <path className="af-plan-line" pathLength={1} d={planOutline(FPW, 0.25, P, 2)} />, { dur: 0.8 });
  groundRooms.forEach((room, i) => add(0, t + 0.5 + i * 0.07, "draw", <path className="af-plan-line" pathLength={1} d={planOutline(R(ctx, room), 0.25, P, 2)} />, { dur: 0.7 }));
  add(0, t + 0.4, "draw", <path className="iso-line" data-tone="mid" pathLength={1} d={string(stakeAt[0]!, stakeAt[1]!) + string(stakeAt[0]!, stakeAt[2]!)} />, { dur: 0.6 });

  /* ------------------------------------------------------------ stage 1 */
  t += 1.7;
  stages.push({ label: "Footings and plinth", short: "Foundation", pipeline: "Structure", at: t, readout: `foundation · ${fmt(perFloor)} sq ft plinth` });

  // Column grid along the perimeter, at most 14 ft apart.
  const along = (from: number, to: number) => {
    const n = Math.max(1, Math.ceil((to - from) / (14 * U)));
    return Array.from({ length: n + 1 }, (_, i) => from + ((to - from) * i) / n);
  };
  const cx0 = X0 + T / 2;
  const cx1 = X1 - T / 2;
  const cy0 = Y0 + T / 2;
  const cy1 = Y1 - T / 2;
  const colKeys = new Set<string>();
  const columns: Plane[] = [];
  const pushCol = (x: number, y: number) => {
    const k = `${x.toFixed(1)}:${y.toFixed(1)}`;
    if (!colKeys.has(k)) {
      colKeys.add(k);
      columns.push([x, y]);
    }
  };
  along(cx0, cx1).forEach((x) => {
    pushCol(x, cy0);
    pushCol(x, cy1);
  });
  along(cy0, cy1).forEach((y) => {
    pushCol(cx0, y);
    pushCol(cx1, y);
  });
  const byDepth = (a: Plane, b: Plane) => a[0] + a[1] - (b[0] + b[1]);
  columns.sort(byDepth);
  const COL = 1.15 * U;

  columns.forEach(([x, y], i) => add(1, t + i * 0.03, "rise", <Solid paths={slabOf({ x: x - 1.3 * U, y: y - 1.3 * U, w: 2.6 * U, d: 2.6 * U, r: 0 }, 0, 0.5 * U, P, 2)} tone="mid" />, { dur: 0.35 }));
  // The far stakes and string come down once the plinth goes in.
  const plinthPlan = insetPlan(FPW, -0.4 * U);
  add(
    1,
    t + 0.55,
    "rise",
    <Solid paths={slabOf(plinthPlan, 0, PLINTH, P, 2, 0.5)} tone="hi" inner={<Line d={sideSeam(plinthPlan, PLINTH * 0.5, P, 2)} tone="faint" />} />,
    { dur: 0.6 },
  );

  /* ------------------------------------------------------- floors, walls */
  t += 1.2;
  let glassCount = 0;
  const windowSpec = (room: Room, length: number) => {
    const L = length / U;
    switch (room.type) {
      case "living":
      case "family":
        return design.direction === "open" ? { w: Math.min(L - 2, 12), sill: 0.4, head: 8.2 } : { w: Math.min(L * 0.6, 9), sill: 1.5, head: 7.8 };
      case "dining":
        return { w: Math.min(L * 0.55, 7), sill: 1.5, head: 7.8 };
      case "bedroom":
      case "master":
        return { w: Math.min(L * 0.5, 6.5), sill: 2.5, head: 7.6 };
      case "kitchen":
      case "utility":
        return { w: Math.min(L * 0.5, 5), sill: 3.4, head: 7.4 };
      case "bath":
        return { w: Math.min(L * 0.5, 2.6), sill: 5.2, head: 7.4 };
      case "stair":
        return { w: 2.2, sill: 2, head: 8.6 };
      case "study":
      case "foyer":
      case "pooja":
        return { w: Math.min(L * 0.45, 4.5), sill: 2.4, head: 7.6 };
      default:
        return null;
    }
  };

  /** A recessed window on the street face (y = Y1) or the right face (x = X1). */
  const windowArt = (face: "front" | "right", a: number, b: number, z0: number, z1: number, key: string) => {
    glassCount++;
    const r = 0.35 * U;
    const p = (s: number, z: number, depth = 0): Point3 => (face === "front" ? [s, Y1 - depth, z] : [X1 - depth, s, z]);
    // The jamb seen inside the recess sits at the low end for both faces.
    const jamb = [p(a, z0, 0), p(a, z0, r), p(a, z1, r), p(a, z1, 0)];
    const sillReveal = [p(a, z0, 0), p(b, z0, 0), p(b, z0, r), p(a, z0, r)];
    const glass = [p(a, z0, r), p(b, z0, r), p(b, z1, r), p(a, z1, r)];
    const mid = (a + b) / 2;
    const wide = Math.abs(b - a) > 5 * U;
    const transom = z1 - (z1 - z0) * 0.22;
    const sill = face === "front" ? { x: a - 0.3 * U, y: Y1 - 0.1 * U, w: b - a + 0.6 * U, d: 0.45 * U, r: 0 } : { x: X1 - 0.1 * U, y: a - 0.3 * U, w: 0.45 * U, d: b - a + 0.6 * U, r: 0 };
    const sheen = face === "front" ? [p(a + (b - a) * 0.12, z1 - 0.4 * U, r), p(a + (b - a) * 0.3, z1 - 0.4 * U, r), p(a + (b - a) * 0.14, z0 + 0.6 * U, r), p(a + (b - a) * 0.04, z0 + 0.6 * U, r)] : null;
    return (
      <g key={key}>
        <path className="af-glass" d={quad(P, glass)} />
        {sheen ? <path className="af-glass-sheen" d={quad(P, sheen)} /> : null}
        <path className="iso-shade" data-shade="0" d={quad(P, jamb)} />
        <path className="iso-top" d={quad(P, sillReveal)} />
        <Line d={pathOf([iso(p(mid, z0, r), P), iso(p(mid, z1, r), P)]) + (wide ? pathOf([iso(p(a, transom, r), P), iso(p(b, transom, r), P)]) : "")} tone="mid" />
        <Line d={quad(P, [p(a, z0), p(b, z0), p(b, z1), p(a, z1)])} tone="hi" />
        <Solid paths={slabOf(sill, z0 - 0.3 * U, 0.3 * U, P, 2)} tone="hi" crease="none" />
      </g>
    );
  };

  const shutterArt = (a: number, b: number, z0: number, z1: number) => {
    const r = 0.25 * U;
    const p = (s: number, z: number, depth = 0): Point3 => [s, Y1 - depth, z];
    const slats: string[] = [];
    for (let z = z0 + 0.7 * U; z < z1 - 0.3 * U; z += 0.7 * U) slats.push(pathOf([iso(p(a, z, r), P), iso(p(b, z, r), P)]));
    return (
      <g>
        <path className="iso-shade" data-shade="2" d={quad(P, [p(a, z0, r), p(b, z0, r), p(b, z1, r), p(a, z1, r)])} />
        <path className="iso-shade" data-shade="0" d={quad(P, [p(a, z0, 0), p(a, z0, r), p(a, z1, r), p(a, z1, 0)])} />
        <Line d={slats.join("")} tone="lo" />
        <Line d={quad(P, [p(a, z0), p(b, z0), p(b, z1), p(a, z1)])} tone="hi" />
      </g>
    );
  };

  const doorArt = (a: number, b: number, z0: number) => {
    const r = 0.45 * U;
    const z1 = z0 + 7.5 * U;
    const p = (s: number, z: number, depth = 0): Point3 => [s, Y1 - depth, z];
    const handle = iso(p(b - 0.5 * U, z0 + 3.4 * U, r), P);
    return (
      <g>
        <path className="iso-shade" data-shade="0" d={quad(P, [p(a, z0, r), p(b, z0, r), p(b, z1, r), p(a, z1, r)])} />
        <path className="iso-shade" data-shade="1" d={quad(P, [p(a, z0, 0), p(a, z0, r), p(a, z1, r), p(a, z1, 0)])} />
        <Line d={pathOf([iso(p((a + b) / 2, z0, r), P), iso(p((a + b) / 2, z1, r), P)])} tone="mid" />
        <Line d={quad(P, [p(a, z0), p(b, z0), p(b, z1), p(a, z1)])} tone="hi" />
        <Dots points={[handle]} size={0.9} tone="hi" />
      </g>
    );
  };

  const wallPlans = {
    back: { x: X0, y: Y0, w: FPW.w, d: T, r: 0 },
    far: { x: X0, y: Y0 + T, w: T, d: FPW.d - 2 * T, r: 0 },
    right: { x: X1 - T, y: Y0 + T, w: T, d: FPW.d - 2 * T, r: 0 },
    front: { x: X0, y: Y1 - T, w: FPW.w, d: T, r: 0 },
  };

  for (let f = 0; f < floors; f++) {
    const z0 = levelZ(f);
    const z1 = wallTop(f);
    const h = z1 - z0;
    const rooms = design.rooms.filter((r) => r.floor === f);
    stages.push({
      label: f === 0 ? "Ground floor walls" : `${["First", "Second", "Third"][f - 1] ?? "Upper"} floor`,
      short: f === 0 ? "Ground" : `Level ${f}`,
      pipeline: "Structure",
      at: t,
      readout: `${f === 0 ? "ground floor" : `level ${f}`} · ${rooms.filter((r) => r.type !== "void").length} rooms · ${design.floorHeight} ft`,
    });

    // Plan on this level's floor, drawn before the walls rise around it.
    if (f > 0) rooms.forEach((room, i) => add(2, t + i * 0.05, "draw", <path className="af-plan-line" pathLength={1} d={planOutline(R(ctx, room), z0 + 0.05, P, 2)} />, { dur: 0.6 }));
    else rooms.forEach((room, i) => add(2, t + i * 0.04, "draw", <path className="af-plan-line" pathLength={1} d={planOutline(R(ctx, room), z0 + 0.05, P, 2)} />, { dur: 0.6 }));

    const tw = t + 0.35;
    // Back pair, then columns, then the windowed street and side walls.
    add(2, tw, "drop", <Solid paths={slabOf(wallPlans.back, z0, h, P, 2)} tone="hi" />, { hook: [X0 + FPW.w / 2, Y0 + T / 2, z1] });
    add(2, tw + 0.25, "drop", <Solid paths={slabOf(wallPlans.far, z0, h, P, 2)} tone="hi" />, { hook: [X0 + T / 2, Y0 + FPW.d / 2, z1] });
    columns.forEach(([x, y], i) => add(2, tw + 0.1 + i * 0.025, "rise", <Solid paths={slabOf({ x: x - COL / 2, y: y - COL / 2, w: COL, d: COL, r: 0 }, z0, h, P, 2)} tone="hi" />, { dur: 0.35 }));

    // Street face.
    const front = rooms.filter((r) => Math.abs(r.y - fp.y) < 0.01).sort((a, b) => a.x - b.x);
    const frontArt: React.ReactNode[] = [];
    front.forEach((room) => {
      const a = room.x * U + (room.x === fp.x ? T : 0);
      const b = (room.x + room.w) * U - (Math.abs(room.x + room.w - fp.x - fp.w) < 0.01 ? T : 0);
      const length = b - a;
      if (room.type === "parking" && f === 0) {
        frontArt.push(<g key={room.id}>{shutterArt(a + 0.8 * U, b - 0.8 * U, z0, z0 + 7.6 * U)}</g>);
        return;
      }
      if ((room.type === "foyer" || room.type === "court" || (room.type === "living" && !front.some((r) => r.type === "foyer" || r.type === "court"))) && f === 0) {
        const doorA = a + length * 0.5 - 1.8 * U;
        frontArt.push(<g key={room.id}>{doorArt(doorA, doorA + 3.6 * U, z0)}</g>);
        if (room.type === "living" && length > 14 * U) frontArt.push(windowArt("front", a + 1.2 * U, doorA - 1.4 * U, z0 + 1.5 * U, z0 + 7.8 * U, room.id + "w"));
        return;
      }
      if (room.type === "void") {
        frontArt.push(windowArt("front", a + 1 * U, b - 1 * U, z0 + 1 * U, z1 - 0.8 * U, room.id));
        return;
      }
      const spec = windowSpec(room, length);
      if (!spec || length < 4 * U) return;
      const w = Math.min(spec.w * U, length - 1.6 * U);
      const c = (a + b) / 2;
      frontArt.push(windowArt("front", c - w / 2, c + w / 2, z0 + spec.sill * U, z0 + Math.min(spec.head * U, h - 0.6 * U), room.id));
    });
    add(2, tw + 0.55, "drop", (
      <g>
        <Solid paths={slabOf(wallPlans.front, z0, h, P, 2)} tone="hi" />
        {frontArt}
      </g>
    ), { hook: [X0 + FPW.w / 2, Y1 - T / 2, z1] });

    // Right face.
    const right = rooms.filter((r) => Math.abs(r.x + r.w - fp.x - fp.w) < 0.01).sort((a, b) => b.y - a.y);
    const rightArt: React.ReactNode[] = [];
    right.forEach((room) => {
      const a = (Dp - room.y - room.d) * U + (Math.abs(room.y + room.d - fp.y - fp.d) < 0.01 ? T : 0);
      const b = (Dp - room.y) * U - (Math.abs(room.y - fp.y) < 0.01 ? T : 0);
      const length = b - a;
      if (room.type === "parking" || room.type === "court" || room.type === "void") return;
      const spec = windowSpec(room, length);
      if (!spec || length < 4 * U) return;
      const w = Math.min(spec.w * U, length - 1.6 * U);
      const c = (a + b) / 2;
      rightArt.push(windowArt("right", c - w / 2, c + w / 2, z0 + spec.sill * U, z0 + Math.min(spec.head * U, h - 0.6 * U), room.id + "r"));
    });
    add(2, tw + 0.8, "drop", (
      <g>
        <Solid paths={slabOf(wallPlans.right, z0, h, P, 2)} tone="hi" />
        {rightArt}
      </g>
    ), { hook: [X1 - T / 2, Y0 + FPW.d / 2, z1] });

    // Columns on the two visible faces stand proud of the wall as pilasters.
    const proud = columns.filter(([x, y]) => Math.abs(x - cx1) < 0.01 || Math.abs(y - cy1) < 0.01);
    proud.forEach(([x, y], i) => {
      const w = Math.abs(x - cx1) < 0.01 ? T + 0.5 * U : COL;
      const d = Math.abs(y - cy1) < 0.01 ? T + 0.5 * U : COL;
      const px = Math.abs(x - cx1) < 0.01 ? X1 - T : x - COL / 2;
      const py = Math.abs(y - cy1) < 0.01 ? Y1 - T : y - COL / 2;
      add(2, tw + 1.0 + i * 0.03, "rise", <Solid paths={slabOf({ x: px, y: py, w: w, d: d, r: 0 }, z0, h, P, 2)} tone="hi" />, { dur: 0.3 });
    });

    // The slab above, with its drip line; the entrance canopy rides on the first.
    const slabPlan = insetPlan(FPW, -0.5 * U);
    const sz = levelZ(f + 1) - SLAB;
    const top = f === floors - 1;
    add(2, tw + 1.25, "drop", (
      <g>
        <Solid paths={slabOf(slabPlan, sz, SLAB, P, 2, 0.6)} tone="hi" inner={<Line d={sideSeam(slabPlan, sz + SLAB * 0.35, P, 2)} tone="faint" />} />
        {!top ? null : null}
      </g>
    ), { hook: [X0 + FPW.w / 2, Y0 + FPW.d / 2, sz + SLAB] });

    if (f === 0) {
      const door = front.find((r) => r.type === "foyer" || r.type === "court" || r.type === "living");
      if (door) {
        const c = (door.x + door.w / 2) * U;
        const canopy: Plan = { x: c - 4 * U, y: Y1, w: 8 * U, d: 4 * U, r: 0 };
        add(2, tw + 1.45, "drop", <Solid paths={slabOf(canopy, z0 + 8.4 * U, 0.5 * U, P, 2, 0.4)} tone="hi" />, { hook: [c, Y1 + 2 * U, z0 + 8.9 * U], lift: 10 * U });
      }
    }
    t = tw + 1.75;
  }

  /* --------------------------------------------------------------- roof */
  stages.push({ label: design.roof === "flat" ? "Roof terrace and parapet" : `${design.roof === "hip" ? "Hipped" : "Gabled"} roof`, short: "Roof", pipeline: "Structure", at: t, readout: design.roof === "flat" ? `roof · parapet 3 ft · ${fmt(perFloor)} sq ft terrace` : `roof · ${design.roof} · rise ${Math.round(pitchRise / U)} ft` });
  const topRooms = design.rooms.filter((r) => r.floor === floors - 1);
  if (design.roof === "flat") {
    const PH = 3 * U;
    const pt = 0.5 * U;
    const edge = insetPlan(FPW, -0.5 * U);
    const ex0 = edge.x;
    const ex1 = edge.x + edge.w;
    const ey0 = edge.y;
    const ey1 = edge.y + edge.d;
    add(3, t, "drop", <Solid paths={slabOf({ x: ex0, y: ey0, w: edge.w, d: pt, r: 0 }, roofZ, PH, P, 2, 0.35)} tone="hi" />, { hook: [(ex0 + ex1) / 2, ey0, roofZ + PH] });
    add(3, t + 0.15, "drop", <Solid paths={slabOf({ x: ex0, y: ey0 + pt, w: pt, d: edge.d - pt * 2, r: 0 }, roofZ, PH, P, 2, 0.35)} tone="hi" />, { hook: [ex0, (ey0 + ey1) / 2, roofZ + PH] });
    // Stair headroom with its door, a water tank on top.
    const stair = topRooms.find((r) => r.type === "stair");
    if (stair) {
      const sp = R(ctx, stair);
      const mh = 8 * U;
      const tank = { x: sp.x + sp.w / 2, y: sp.y + sp.d / 2 };
      const doorA = sp.x + sp.w * 0.3;
      const doorB = sp.x + sp.w * 0.7;
      add(3, t + 0.35, "drop", (
        <g>
          <Solid paths={slabOf(sp, roofZ, mh, P, 2)} tone="hi" />
          <Solid paths={slabOf(insetPlan(sp, -0.4 * U), roofZ + mh, 0.5 * U, P, 2, 0.4)} tone="hi" />
          <path className="iso-shade" data-shade="0" d={quad(P, [[doorA, sp.y + sp.d, roofZ], [doorB, sp.y + sp.d, roofZ], [doorB, sp.y + sp.d, roofZ + 6.8 * U], [doorA, sp.y + sp.d, roofZ + 6.8 * U]])} />
          <Line d={quad(P, [[doorA, sp.y + sp.d, roofZ], [doorB, sp.y + sp.d, roofZ], [doorB, sp.y + sp.d, roofZ + 6.8 * U], [doorA, sp.y + sp.d, roofZ + 6.8 * U]])} tone="hi" />
          <Solid paths={kitCylinder(tank.x, tank.y, Math.min(sp.w, sp.d) * 0.3, roofZ + mh + 0.5 * U, 3.6 * U, P, 32, 0.4)} tone="hi" inner={<Line d={sideSeam({ x: tank.x - Math.min(sp.w, sp.d) * 0.3, y: tank.y - Math.min(sp.w, sp.d) * 0.3, w: Math.min(sp.w, sp.d) * 0.6, d: Math.min(sp.w, sp.d) * 0.6, r: Math.min(sp.w, sp.d) * 0.3 }, roofZ + mh + 2.2 * U, P, 12)} tone="faint" />} />
        </g>
      ), { hook: [tank.x, tank.y, roofZ + mh + 4 * U] });
    }
    // Solar array: three panels with their cell grid, on low frames.
    const free = topRooms.filter((r) => r.type === "bedroom" || r.type === "master" || r.type === "family").sort((a, b) => b.w * b.d - a.w * a.d)[0];
    if (free) {
      const fpn = insetPlan(R(ctx, free), 2 * U);
      const n = Math.max(1, Math.min(3, Math.floor(fpn.w / (5 * U))));
      const pw2 = Math.min(fpn.w / n - 0.8 * U, 6 * U);
      for (let i = 0; i < n; i++) {
        const px = fpn.x + i * (fpn.w / n) + 0.4 * U;
        const panel: Plan = { x: px, y: fpn.y, w: pw2, d: Math.min(fpn.d, 10 * U), r: 0 };
        const z = roofZ + 1 * U;
        const grid = [1, 2, 3].map((k) => onTop([[panel.x + (panel.w * k) / 4, panel.y], [panel.x + (panel.w * k) / 4, panel.y + panel.d]], z + 0.3 * U, P)).join("") + [1, 2, 3, 4, 5].map((k) => onTop([[panel.x, panel.y + (panel.d * k) / 6], [panel.x + panel.w, panel.y + (panel.d * k) / 6]], z + 0.3 * U, P)).join("");
        add(3, t + 0.55 + i * 0.15, "drop", (
          <g>
            <Solid paths={slabOf({ x: panel.x + 0.6 * U, y: panel.y + 0.6 * U, w: panel.w - 1.2 * U, d: panel.d - 1.2 * U, r: 0 }, roofZ, z - roofZ, P, 2)} tone="mid" />
            <Solid paths={slabOf(panel, z, 0.3 * U, P, 2)} tone="hi" lit />
            <Line d={grid} tone="lo" />
          </g>
        ), { hook: [panel.x + panel.w / 2, panel.y + panel.d / 2, z], lift: 12 * U });
      }
    }
    const voids = topRooms.filter((r) => r.type === "void");
    voids.forEach((room) => {
      const vp = insetPlan(R(ctx, room), 0.6 * U);
      add(3, t + 0.5, "fade", (
        <g>
          <path className="af-glass" d={planOutline(vp, roofZ + 0.1, P, 2)} />
          <Line d={planOutline(vp, roofZ + 0.1, P, 2) + onTop([[vp.x + vp.w / 2, vp.y], [vp.x + vp.w / 2, vp.y + vp.d]], roofZ + 0.1, P)} tone="mid" />
        </g>
      ));
    });
    add(3, t + 0.95, "drop", <Solid paths={slabOf({ x: ex1 - pt, y: ey0 + pt, w: pt, d: edge.d - pt * 2, r: 0 }, roofZ, PH, P, 2, 0.35)} tone="hi" />, { hook: [ex1, (ey0 + ey1) / 2, roofZ + PH] });
    add(3, t + 1.1, "drop", <Solid paths={slabOf({ x: ex0, y: ey1 - pt, w: edge.w, d: pt, r: 0 }, roofZ, PH, P, 2, 0.35)} tone="hi" />, { hook: [(ex0 + ex1) / 2, ey1, roofZ + PH] });
    t += 1.6;
  } else {
    const o = 1.6 * U;
    const ax0 = X0 - o;
    const ax1 = X1 + o;
    const ay0 = Y0 - o;
    const ay1 = Y1 + o;
    const zE = roofZ;
    const zR = roofPeak;
    const alongX = FPW.w >= FPW.d;
    const midX = (ax0 + ax1) / 2;
    const midY = (ay0 + ay1) / 2;
    const inside: Point3 = [midX, midY, zE];
    const faces: Point3[][] = [];
    if (design.roof === "gable") {
      if (alongX) {
        faces.push([[ax0, ay0, zE], [ax1, ay0, zE], [ax1, midY, zR], [ax0, midY, zR]]);
        faces.push([[ax0, midY, zR], [ax1, midY, zR], [ax1, ay1, zE], [ax0, ay1, zE]]);
      } else {
        faces.push([[ax0, ay0, zE], [midX, ay0, zR], [midX, ay1, zR], [ax0, ay1, zE]]);
        faces.push([[midX, ay0, zR], [ax1, ay0, zE], [ax1, ay1, zE], [midX, ay1, zR]]);
      }
    } else {
      const inset = Math.min(ax1 - ax0, ay1 - ay0) / 2;
      if (alongX) {
        const r0: Point3 = [ax0 + inset, midY, zR];
        const r1: Point3 = [ax1 - inset, midY, zR];
        faces.push([[ax0, ay0, zE], [ax1, ay0, zE], r1, r0]);
        faces.push([[ax0, ay1, zE], [ax1, ay1, zE], r1, r0]);
        faces.push([[ax0, ay0, zE], [ax0, ay1, zE], r0]);
        faces.push([[ax1, ay0, zE], [ax1, ay1, zE], r1]);
      } else {
        const r0: Point3 = [midX, ay0 + inset, zR];
        const r1: Point3 = [midX, ay1 - inset, zR];
        faces.push([[ax0, ay0, zE], [ax0, ay1, zE], r1, r0]);
        faces.push([[ax1, ay0, zE], [ax1, ay1, zE], r1, r0]);
        faces.push([[ax0, ay0, zE], [ax1, ay0, zE], r0]);
        faces.push([[ax0, ay1, zE], [ax1, ay1, zE], r1]);
      }
      // Fix winding for the hip trapezoids (built as two eaves + ridge in reverse).
      faces.forEach((poly, i) => {
        if (poly.length === 4) faces[i] = [poly[0]!, poly[1]!, poly[2]!, poly[3]!];
      });
    }
    // Gable end walls under the roof (only on the gable type).
    if (design.roof === "gable") {
      const ends: Point3[][] = alongX
        ? [
            [[X0, Y0, zE], [X0, Y1, zE], [X0, (Y0 + Y1) / 2, zR - o * 0.6]],
            [[X1, Y0, zE], [X1, Y1, zE], [X1, (Y0 + Y1) / 2, zR - o * 0.6]],
          ]
        : [
            [[X0, Y0, zE], [X1, Y0, zE], [(X0 + X1) / 2, Y0, zR - o * 0.6]],
            [[X0, Y1, zE], [X1, Y1, zE], [(X0 + X1) / 2, Y1, zR - o * 0.6]],
          ];
      ends.forEach((pts, i) => add(3, t + i * 0.15, "drop", <Face points={pts} inside={[(X0 + X1) / 2, (Y0 + Y1) / 2, zE]} P={P} />, { hook: [pts[2]![0], pts[2]![1], pts[2]![2]] }));
    }
    // Tile courses run parallel to the eave and stop on the face's edges.
    const courses = (poly: Point3[]) => {
      const eave = [poly[0]!, poly[1]!];
      const top = poly.length === 4 ? [poly[3]!, poly[2]!] : [poly[2]!, poly[2]!];
      const lines: string[] = [];
      const n = Math.max(3, Math.round(Math.hypot(top[0]![2] - eave[0]![2], 0) / (1.1 * U)));
      for (let k = 1; k < n; k++) {
        const s = k / n;
        const a: Point3 = [eave[0]![0] + (top[0]![0] - eave[0]![0]) * s, eave[0]![1] + (top[0]![1] - eave[0]![1]) * s, eave[0]![2] + (top[0]![2] - eave[0]![2]) * s];
        const b: Point3 = [eave[1]![0] + (top[1]![0] - eave[1]![0]) * s, eave[1]![1] + (top[1]![1] - eave[1]![1]) * s, eave[1]![2] + (top[1]![2] - eave[1]![2]) * s];
        lines.push(pathOf([iso(a, P), iso(b, P)]));
      }
      return lines.join("");
    };
    const ordered = faces.map((poly) => ({ poly, f: facePaths(poly, inside, P) })).sort((a, b) => a.f.depth - b.f.depth);
    ordered.forEach(({ poly, f }, i) => {
      const c = poly.reduce((s, p) => [s[0] + p[0] / poly.length, s[1] + p[1] / poly.length, s[2] + p[2] / poly.length] as Point3, [0, 0, 0] as Point3);
      add(3, t + 0.35 + i * 0.25, "drop", (
        <g>
          <Face points={poly} inside={inside} P={P} />
          {f.visible ? <Line d={courses(poly)} tone="lo" /> : null}
          {f.visible ? <Line d={pathOf([iso(poly[0]!, P), iso(poly[1]!, P)])} tone="hi" /> : null}
        </g>
      ), { hook: c });
    });
    t += 0.6 + ordered.length * 0.25;
  }

  /* --------------------------------------------- glazing, trees and light */
  stages.push({ label: "Glazing and evening light", short: "Light", pipeline: "WebGL light", at: t, readout: `glazing · ${glassCount} openings lit` });
  const tree = (x: number, y: number, s: number) => (
    <g>
      <Solid paths={kitCylinder(x, y, 0.35 * U * s, 0, 5 * U * s, P, 14)} tone="mid" />
      <Solid paths={kitCylinder(x, y, 2.6 * U * s, 4 * U * s, 1.6 * U * s, P, 28, 0.4)} tone="mid" />
      <Solid paths={kitCylinder(x, y, 2.1 * U * s, 5.6 * U * s, 1.5 * U * s, P, 28, 0.4)} tone="mid" />
      <Solid paths={kitCylinder(x, y, 1.4 * U * s, 7.1 * U * s, 1.3 * U * s, P, 24, 0.4)} tone="mid" />
    </g>
  );
  const trees: Array<[number, number, number]> = [
    [Math.max(2.6, fp.x * 0.5) * U, (Dp - fp.y - fp.d - Math.max(2.5, (brief.plotDepth - fp.y - fp.d) * 0.5)) * U, 1.15],
    [Math.min(Wp - 2.6, fp.x + fp.w + Math.max(1.5, (Wp - fp.x - fp.w) * 0.5)) * U, (Dp - fp.y - fp.d - Math.max(2.5, (brief.plotDepth - fp.y - fp.d) * 0.45)) * U, 0.9],
  ];
  const frontTree: [number, number, number] = [Math.max(2.4, fp.x * 0.5) * U, (Dp - Math.max(2.4, fp.y * 0.45)) * U, 0.85];
  trees.forEach(([x, y, s], i) => add(4, t + i * 0.15, "rise", tree(x, y, s), { dur: 0.6 }));
  add(4, t + 0.35, "rise", tree(frontTree[0], frontTree[1], frontTree[2]), { dur: 0.6 });
  t += 1.4;
  stages.push({ label: "Handing over to the 3D model", short: "3D", pipeline: "3D model", at: t, readout: `model · ${fmt(statsTotal(design, floors))} sq ft · ${floors} ${floors > 1 ? "floors" : "floor"}` });
  const duration = t + 1.2;

  /* ------------------------------------------------- painter's order */
  // Back-to-front sort is implicit in the build order above, with three
  // exceptions put right here: the plot wall's near legs, the front tree and
  // the far stakes. Those go to the end/start of the list respectively.
  const plotBack = (
    <g key="plot-back">
      <Solid paths={plotWalls.back} tone="mid" />
      <Solid paths={plotWalls.left} tone="mid" />
    </g>
  );
  const plotFront = (
    <g key="plot-front">
      <Solid paths={plotWalls.right} tone="mid" />
      {gate[0] - 0.6 * U > 0.5 * U ? <Solid paths={plotWalls.frontL} tone="mid" /> : null}
      {Wp * U - gate[1] - 0.6 * U > 0.5 * U ? <Solid paths={plotWalls.frontR} tone="mid" /> : null}
      {gatePiers.map((p, i) => (
        <Solid key={i} paths={p} tone="mid" />
      ))}
    </g>
  );
  // Near stakes are drawn last so they sit in front of the plinth they mark.
  const nearStakes = [2, 3].map((i) => ({ i }));

  const ordered: Piece[] = [];
  ordered.push({ key: "board", stage: -1, at: 0, dur: 0.01, mode: "fade", lift: 0, hook: null, node: boardArt });
  ordered.push({ key: "plotBack", stage: -1, at: 0, dur: 0.01, mode: "fade", lift: 0, hook: null, node: plotBack });
  // Rear trees stand behind the house.
  const treePieces = pieces.filter((p) => p.stage === 4);
  const rearTrees = treePieces.slice(0, 2);
  const frontTreePiece = treePieces[2];
  ordered.push(...rearTrees, ...pieces.filter((p) => p.stage !== 4));
  ordered.push({ key: "plotFront", stage: -1, at: 0, dur: 0.01, mode: "fade", lift: 0, hook: null, node: plotFront });
  nearStakes.forEach(({ i }) =>
    ordered.push({ key: `stake${i}`, stage: 0, at: 0.2 + i * 0.12, dur: 0.4, mode: "rise", lift: 0, hook: null, node: <g key={`stake${i}`}><Solid paths={stakes[i]!} tone="mid" /></g> }),
  );
  ordered.push({
    key: "strings-near",
    stage: 0,
    at: 0.75,
    dur: 0.6,
    mode: "draw",
    lift: 0,
    hook: null,
    node: <g key="strings-near"><path className="iso-line" data-tone="mid" pathLength={1} d={string(stakeAt[1]!, stakeAt[3]!) + string(stakeAt[2]!, stakeAt[3]!)} /></g>,
  });
  if (frontTreePiece) ordered.push(frontTreePiece);

  /* ------------------------------------------------------------- crane */
  const mast: Plane = [Math.max(1.6 * U, X0 - 3 * U), Math.max(1.6 * U, Y0 - 4.5 * U)];
  const reach = Math.max(...[[X1, Y1], [X0, Y1], [X1, Y0]].map(([x, y]) => Math.hypot(x! - mast[0], y! - mast[1]))) + 3 * U;
  const M = 1.1 * U; // half mast
  const mastPlan: Plan = { x: mast[0] - M, y: mast[1] - M, w: M * 2, d: M * 2, r: 0 };
  const lattice: string[] = [];
  const step = 2.2 * U;
  for (let z = 0.8 * U; z + step < craneTop - 1 * U; z += step) {
    const s = Math.round((z - 0.8 * U) / step) % 2 === 0;
    // +x face and +y face diagonals, ending on the rungs.
    lattice.push(pathOf([iso([mast[0] + M, mast[1] + (s ? -M : M) * 0.85, z], P), iso([mast[0] + M, mast[1] + (s ? M : -M) * 0.85, z + step], P)]));
    lattice.push(pathOf([iso([mast[0] + (s ? -M : M) * 0.85, mast[1] + M, z], P), iso([mast[0] + (s ? M : -M) * 0.85, mast[1] + M, z + step], P)]));
    lattice.push(pathOf([iso([mast[0] + M, mast[1] - M * 0.85, z + step], P), iso([mast[0] + M, mast[1] + M * 0.85, z + step], P)]));
    lattice.push(pathOf([iso([mast[0] - M * 0.85, mast[1] + M, z + step], P), iso([mast[0] + M * 0.85, mast[1] + M, z + step], P)]));
  }
  const craneBack = (
    <g key="crane-back">
      <Solid paths={slabOf({ x: mast[0] - 2.6 * U, y: mast[1] - 2.6 * U, w: 5.2 * U, d: 5.2 * U, r: 0 }, 0, 1.2 * U, P, 2, 0.4)} tone="mid" />
      <Solid paths={slabOf({ x: mast[0] - 2 * U, y: mast[1] - 2 * U, w: 4 * U, d: 4 * U, r: 0 }, 1.2 * U, 0.9 * U, P, 2, 0.4)} tone="mid" />
      <Solid paths={slabOf(mastPlan, 2.1 * U, craneTop - 2.1 * U - 1.4 * U, P, 2)} tone="mid" inner={<Line d={lattice.join("")} tone="lo" />} />
      <Solid paths={kitCylinder(mast[0], mast[1], M * 1.25, craneTop - 1.4 * U, 1.4 * U, P, 28, 0.3)} tone="mid" />
    </g>
  );

  return {
    P,
    pieces: ordered,
    stages,
    crane: { mast, top: craneTop, reach, back: craneBack },
    duration,
    glassCount,
    label: `An architect's site model of ${brief.name}: a ${floors}-storey ${design.roof}-roofed house on a ${brief.plotWidth} by ${brief.plotDepth} foot plot, assembled by a small tower crane from setting-out to roof.`,
  };
}

function statsTotal(design: Design, floors: number) {
  const open = design.rooms.filter((r) => r.type === "court" || r.type === "void").reduce((s, r) => s + r.w * r.d, 0);
  return design.footprint.w * design.footprint.d * floors - open;
}

/* ---------------------------------------- the crane's moving parts */

export interface CranePose {
  angle: number; // radians, 0 = +x
  radius: number; // trolley distance from mast
  hookZ: number; // z of hook block bottom
}

export function cranePaths(spec: CraneSpec, pose: CranePose, P: Projection) {
  const [mx, my] = spec.mast;
  const z = spec.top;
  const ca = Math.cos(pose.angle);
  const sa = Math.sin(pose.angle);
  const rot = (u: number, v: number): Plane => [mx + u * ca - v * sa, my + u * sa + v * ca];
  const box = (u0: number, u1: number, v0: number, v1: number, z0: number, h: number) => extrude([rot(u0, v0), rot(u1, v0), rot(u1, v1), rot(u0, v1)], z0, h, P);
  const jibH = 1.5 * U;
  const jib = box(-1 * U, spec.reach, -0.7 * U, 0.7 * U, z, jibH);
  const counter = box(-spec.reach * 0.32, -1 * U, -0.75 * U, 0.75 * U, z, jibH * 0.8);
  const weights = [0, 1].map((k) => box(-spec.reach * 0.32 + k * 2.4 * U, -spec.reach * 0.32 + k * 2.4 * U + 2.1 * U, -1.1 * U, 1.1 * U, z - 2.4 * U, 2.6 * U));
  const apex = box(-0.6 * U, 0.6 * U, -0.6 * U, 0.6 * U, z + jibH, 6 * U);
  const cab = box(0.6 * U, 3.2 * U, 1 * U, 3.4 * U, z - 2.8 * U, 2.6 * U);
  const tieTop: Point3 = [mx, my, z + jibH + 6 * U];
  const tip = rot(spec.reach - 1 * U, 0);
  const tail = rot(-spec.reach * 0.3, 0);
  const ties = pathOf([iso([tip[0], tip[1], z + jibH], P), iso(tieTop, P), iso([tail[0], tail[1], z + jibH * 0.8], P)]);
  // Zig-zag web along the jib's visible side.
  const web: string[] = [];
  const side = Math.cos(pose.angle - Math.PI / 4) >= 0 ? 0.7 * U : -0.7 * U;
  const n = Math.max(4, Math.floor(spec.reach / (2.4 * U)));
  for (let i = 0; i < n; i++) {
    const u0 = 0.8 * U + ((spec.reach - 1.6 * U) * i) / n;
    const u1 = 0.8 * U + ((spec.reach - 1.6 * U) * (i + 1)) / n;
    const a = rot(u0, side);
    const b = rot(u1, side);
    web.push(pathOf([iso([a[0], a[1], i % 2 ? z + jibH : z], P), iso([b[0], b[1], i % 2 ? z : z + jibH], P)]));
  }
  const r = Math.min(spec.reach - 2 * U, Math.max(3 * U, pose.radius));
  const trolleyAt = rot(r, 0);
  const trolley = box(r - 1 * U, r + 1 * U, -0.95 * U, 0.95 * U, z - 0.9 * U, 0.9 * U);
  const hookTop = Math.min(z - 0.9 * U, pose.hookZ + 1.6 * U);
  const block = extrude(
    [
      [trolleyAt[0] - 0.7 * U, trolleyAt[1] - 0.7 * U],
      [trolleyAt[0] + 0.7 * U, trolleyAt[1] - 0.7 * U],
      [trolleyAt[0] + 0.7 * U, trolleyAt[1] + 0.7 * U],
      [trolleyAt[0] - 0.7 * U, trolleyAt[1] + 0.7 * U],
    ],
    hookTop - 1.6 * U,
    1.6 * U,
    P,
  );
  const line = pathOf([iso([trolleyAt[0], trolleyAt[1], z - 0.9 * U], P), iso([trolleyAt[0], trolleyAt[1], hookTop], P)]);
  const hookPin = iso([trolleyAt[0], trolleyAt[1], hookTop - 1.6 * U], P);
  return { jib, counter, weights, apex, cab, ties, web: web.join(""), trolley, block, line, hookPin };
}

export type CranePathSet = ReturnType<typeof cranePaths>;
export type { SolidPaths };
