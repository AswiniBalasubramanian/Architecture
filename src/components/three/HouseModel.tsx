"use client";

import * as React from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { FURNITURE } from "@/lib/catalog";
import { flightOf, openingsOf, partitionsOf, type Opening, type Side } from "@/lib/openings";
import type { Brief, Design, Furniture, MaterialChoice, Room } from "@/lib/types";
import { materialFor, surfaceMaterial, textureFor, TILE } from "./textures";
import { Facade } from "./Facade";

export const PLINTH = 2;
export const SLAB = 0.6;
const WALL = 0.75;
const PART = 0.4;

interface Frame {
  cx: number;
  cy: number;
}
export const FrameCtx = React.createContext<Frame>({ cx: 0, cy: 0 });

/** Plan (x, y, z-up) in feet → three.js position. */
export const toWorld = (f: Frame, x: number, y: number, z: number) => new THREE.Vector3(x - f.cx, z, f.cy - y);

export function Block({ x0, y0, x1, y1, z0, z1, mat, cast = true, receive = true, onClick, name }: { x0: number; y0: number; x1: number; y1: number; z0: number; z1: number; mat: THREE.Material | THREE.Material[]; cast?: boolean; receive?: boolean; onClick?: (e: ThreeEvent<MouseEvent>) => void; name?: string }) {
  const f = React.useContext(FrameCtx);
  const w = Math.abs(x1 - x0);
  const d = Math.abs(y1 - y0);
  const h = Math.abs(z1 - z0);
  if (w < 0.01 || d < 0.01 || h < 0.01) return null;
  return (
    <mesh name={name} position={[(x0 + x1) / 2 - f.cx, (z0 + z1) / 2, f.cy - (y0 + y1) / 2]} material={mat} castShadow={cast} receiveShadow={receive} onClick={onClick}>
      <boxGeometry args={[w, h, d]} />
    </mesh>
  );
}

export interface MaterialsSet {
  exterior: (w: number, h: number) => THREE.Material;
  accent: (w: number, h: number) => THREE.Material;
  roof: MaterialChoice;
  frames: THREE.Material;
  floor: (choice: MaterialChoice | undefined, w: number, d: number) => THREE.Material;
  walls: (color: string | undefined, w: number, h: number) => THREE.Material;
  cabinets: THREE.Material;
  fabric: THREE.Material;
  fabricSoft: THREE.Material;
  wood: THREE.Material;
  stone: THREE.Material;
  glass: THREE.Material;
  glow: THREE.Material;
  dark: THREE.Material;
  slab: THREE.Material;
  white: THREE.Material;
  leaf: THREE.Material;
  car: THREE.Material;
  highlight: THREE.Material;
  curtain: THREE.Material;
  metal: THREE.Material;
  lamp: THREE.Material;
  plate: THREE.Material;
  skirting: THREE.Material;
  tile: THREE.Material;
  rubber: THREE.Material;
  chrome: THREE.Material;
  linen: THREE.Material;
  ridge: THREE.Material;
  tank: THREE.Material;
  solar: THREE.Material;
  shade: THREE.Material;
  tail: THREE.Material;
}

/** Monocrystalline cells: a dark blue grid with silver busbars. */
function solarTexture() {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d");
  if (!g) return null;
  g.fillStyle = "#1c2633";
  g.fillRect(0, 0, 256, 512);
  for (let x = 0; x < 6; x++)
    for (let y = 0; y < 12; y++) {
      g.fillStyle = (x + y) % 2 ? "#1f2b3b" : "#223046";
      g.fillRect(x * 42 + 3, y * 42 + 4, 38, 38);
      g.fillStyle = "#8d97a3";
      g.globalAlpha = 0.55;
      g.fillRect(x * 42 + 3, y * 42 + 16, 38, 1);
      g.fillRect(x * 42 + 3, y * 42 + 30, 38, 1);
      g.globalAlpha = 1;
    }
  g.strokeStyle = "#c9ced3";
  g.lineWidth = 6;
  g.strokeRect(0, 0, 256, 512);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
let solarMap: THREE.Texture | null = null;

function useMaterials(design: Design, lit: boolean): MaterialsSet {
  const m = design.materials;
  return React.useMemo(() => {
    const glass = new THREE.MeshPhysicalMaterial({ color: "#a9bfc0", roughness: 0.06, metalness: 0.1, transparent: true, opacity: 0.34, envMapIntensity: 1, depthWrite: false });
    const glow = new THREE.MeshStandardMaterial({ color: "#f6dcae", emissive: "#f2b768", emissiveIntensity: 1.1, transparent: true, opacity: 0.88 });
    return {
      exterior: (w, h) => materialFor(m.exterior, w, h),
      accent: (w, h) => materialFor(m.accent, w, h),
      roof: m.roof,
      frames: new THREE.MeshStandardMaterial({ color: m.frames.color, roughness: m.frames.material === "metal" ? 0.4 : 0.7, metalness: m.frames.material === "metal" ? 0.5 : 0 }),
      floor: (choice, w, d) => materialFor(choice ?? m.floor, w, d),
      walls: (color, w, h) => materialFor({ material: m.walls.material, color: color ?? m.walls.color }, w, h),
      cabinets: materialFor(m.cabinets, 4, 4),
      fabric: materialFor(m.furniture, 4, 4),
      fabricSoft: new THREE.MeshStandardMaterial({ color: new THREE.Color(m.furniture.color).lerp(new THREE.Color("#ffffff"), 0.55), roughness: 1 }),
      wood: materialFor({ material: "wood", color: "#a77a4f" }, 4, 4),
      stone: materialFor({ material: "marble", color: "#e8e3da" }, 4, 4),
      glass: lit ? glow : glass,
      glow,
      dark: new THREE.MeshStandardMaterial({ color: "#2c2e2d", roughness: 0.5 }),
      slab: new THREE.MeshStandardMaterial({ color: "#e9e4da", roughness: 0.9 }),
      white: new THREE.MeshStandardMaterial({ color: "#f6f3ee", roughness: 0.5 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#6f8466", roughness: 0.95 }),
      car: new THREE.MeshPhysicalMaterial({ color: "#3a4441", roughness: 0.28, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.12 }),
      highlight: new THREE.MeshStandardMaterial({ color: "#4e6151", transparent: true, opacity: 0.28, depthWrite: false }),
      curtain: surfaceMaterial("fabric", new THREE.Color(m.furniture.color).lerp(new THREE.Color("#f4efe6"), 0.7).getHexString().replace(/^/, "#"), 2, 6, { transparent: true, opacity: 0.92, side: THREE.DoubleSide }),
      metal: new THREE.MeshStandardMaterial({ color: "#8d8f8b", roughness: 0.25, metalness: 0.9 }),
      lamp: lit ? new THREE.MeshStandardMaterial({ color: "#fff1d6", emissive: "#ffc679", emissiveIntensity: 3 }) : new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.3, transparent: true, opacity: 0.85 }),
      plate: new THREE.MeshStandardMaterial({ color: "#2f3230", roughness: 0.4, metalness: 0.4 }),
      skirting: surfaceMaterial("stone", "#9d9585", 20, 1),
      tile: surfaceMaterial("tile", "#e9e5dc", 6, 2),
      rubber: new THREE.MeshStandardMaterial({ color: "#1d1f1e", roughness: 0.9 }),
      chrome: new THREE.MeshStandardMaterial({ color: "#d8dad6", roughness: 0.15, metalness: 1 }),
      linen: surfaceMaterial("fabric", "#f3efe8", 4, 4),
      tail: new THREE.MeshStandardMaterial({ color: "#8a1c18", emissive: lit ? "#ff2a1a" : "#000000", emissiveIntensity: lit ? 1.4 : 0 }),
      ridge: materialFor({ material: m.roof.material === "terracotta" ? "terracotta" : m.roof.material, color: new THREE.Color(m.roof.color).multiplyScalar(0.82).getHexString().replace(/^/, "#") }, 2, 2),
      tank: new THREE.MeshStandardMaterial({ color: "#2d3230", roughness: 0.55 }),
      solar: new THREE.MeshPhysicalMaterial({ map: (solarMap ??= solarTexture()), roughness: 0.18, metalness: 0.35, clearcoat: 1, clearcoatRoughness: 0.05 }),
      shade: new THREE.MeshStandardMaterial({ color: "#efe8da", roughness: 0.6, side: THREE.DoubleSide, emissive: lit ? "#ffb35c" : "#000000", emissiveIntensity: lit ? 0.6 : 0 }),
    };
  }, [m.exterior, m.accent, m.roof, m.frames, m.floor, m.walls, m.cabinets, m.furniture, lit]);
}

/* ------------------------------------------------------------- walls */

function SideWall({ side, openings, z0, z1, design, mats, top, entryOpen = false }: { side: Side; openings: Opening[]; z0: number; z1: number; design: Design; mats: MaterialsSet; top: number; entryOpen?: boolean }) {
  const fp = design.footprint;
  const along = side === "front" || side === "back";
  // Wall extent along its axis, and its band across.
  const s0 = along ? fp.x : fp.y + WALL;
  const s1 = along ? fp.x + fp.w : fp.y + fp.d - WALL;
  const band = side === "front" ? [fp.y, fp.y + WALL] : side === "back" ? [fp.y + fp.d - WALL, fp.y + fp.d] : side === "left" ? [fp.x, fp.x + WALL] : [fp.x + fp.w - WALL, fp.x + fp.w];
  const h = z1 - z0;
  const length = s1 - s0;
  // Box faces: +x, -x, +y, -y, +z, -z. The face toward the rooms takes interior paint.
  const outer = mats.exterior(length, h);
  const inner = mats.walls(undefined, length, h);
  const innerFace = side === "front" ? 5 : side === "back" ? 4 : side === "left" ? 0 : 1;
  const mat = [0, 1, 2, 3, 4, 5].map((i) => (i === innerFace ? inner : outer));
  const pieces: React.ReactNode[] = [];
  const box = (a: number, b: number, za: number, zb: number, m: THREE.Material | THREE.Material[], key: string, inset = 0) => {
    const [c0, c1] = [band[0]! + inset, band[1]! - inset];
    pieces.push(along ? <Block key={key} x0={a} x1={b} y0={c0} y1={c1} z0={za} z1={zb} mat={m} /> : <Block key={key} x0={c0} x1={c1} y0={a} y1={b} z0={za} z1={zb} mat={m} />);
  };
  const ops = openings.filter((o) => o.side === side).map((o) => ({ ...o, a: Math.max(s0 + 0.3, o.a), b: Math.min(s1 - 0.3, o.b) })).filter((o) => o.b - o.a > 0.5).sort((a, b) => a.a - b.a);
  // Depth `d` is measured outward from the exterior face: >0 outside, <0 into the wall.
  const face = side === "front" ? band[0]! : side === "back" ? band[1]! : side === "left" ? band[0]! : band[1]!;
  const out = side === "front" || side === "left" ? -1 : 1;
  const at = (a: number, b: number, za: number, zb: number, d0: number, d1: number, m: THREE.Material | THREE.Material[], key: string) => {
    const c0 = face + out * d0;
    const c1 = face + out * d1;
    const [lo, hi] = c0 < c1 ? [c0, c1] : [c1, c0];
    pieces.push(along ? <Block key={key} x0={a} x1={b} y0={lo} y1={hi} z0={za} z1={zb} mat={m} /> : <Block key={key} x0={lo} x1={hi} y0={a} y1={b} z0={za} z1={zb} mat={m} />);
  };
  const roomOf = (id: string) => design.rooms.find((r) => r.id === id);
  let cursor = s0;
  const zTop = Math.min(z1, top);
  ops.forEach((o, i) => {
    box(cursor, o.a, z0, zTop, mat, `s${i}`);
    const sill = z0 + o.sill;
    const head = z0 + o.head;
    if (o.sill > 0.01) box(o.a, o.b, z0, Math.min(sill, zTop), mat, `b${i}`);
    if (head < zTop) box(o.a, o.b, head, zTop, mat, `h${i}`);
    const gTop = Math.min(head, zTop);
    const w = o.b - o.a;
    if (gTop > sill + 0.2) {
      if (o.kind === "window" || o.kind === "glazing") {
        // Outer frame, recessed 0.2 ft behind the face.
        const ft = 0.22;
        const f0 = -0.2;
        const f1 = -0.5;
        at(o.a, o.b, sill, sill + ft, f0, f1, mats.frames, `fa${i}`);
        if (head <= zTop) at(o.a, o.b, gTop - ft, gTop, f0, f1, mats.frames, `fb${i}`);
        at(o.a, o.a + ft, sill, gTop, f0, f1, mats.frames, `fc${i}`);
        at(o.b - ft, o.b, sill, gTop, f0, f1, mats.frames, `fd${i}`);
        // Divided panes: mullions every ≤ 3 ft, a transom on tall openings.
        const panes = Math.max(1, Math.round(w / 3));
        for (let k = 1; k < panes; k++) {
          const x = o.a + (w * k) / panes;
          at(x - 0.07, x + 0.07, sill + ft, gTop - ft, f0 - 0.04, f1 + 0.04, mats.frames, `fm${i}-${k}`);
        }
        const tall = gTop - sill > 5.2;
        if (tall) {
          const tz = gTop - (gTop - sill) * 0.22;
          at(o.a + ft, o.b - ft, tz - 0.07, tz + 0.07, f0 - 0.04, f1 + 0.04, mats.frames, `ft${i}`);
        }
        at(o.a + ft, o.b - ft, sill + ft, gTop - ft, -0.33, -0.37, mats.glass, `g${i}`);
        // Stone sill with a drip groove, wider than the opening.
        if (o.sill > 0.3) {
          at(o.a - 0.3, o.b + 0.3, sill - 0.24, sill, 0.38, -0.2, mats.stone, `ls${i}`);
          at(o.a - 0.26, o.b + 0.26, sill - 0.26, sill - 0.22, 0.3, 0.24, mats.dark, `ld${i}`);
        }
        // A concrete sunshade (chajja) over the wider windows.
        if (w >= 2.8 && head < zTop - 0.3) {
          at(o.a - 0.6, o.b + 0.6, head + 0.25, head + 0.5, 0, 1.7, mats.accent(w + 1.2, 1.7), `ch${i}`);
          at(o.a - 0.6, o.b + 0.6, head + 0.1, head + 0.25, 1.55, 1.7, mats.accent(w + 1.2, 1), `chd${i}`);
        }
        // Curtains inside living spaces: two panels drawn back to the jambs.
        const room = roomOf(o.roomId);
        if (room && ["living", "family", "bedroom", "master", "dining", "study"].includes(room.type) && gTop - sill > 2) {
          const cw = Math.min(1.4, w * 0.22);
          const cz0 = o.kind === "glazing" || o.sill < 1 ? z0 + 0.15 : sill - 0.4;
          at(o.a - 0.3, o.a - 0.3 + cw, cz0, Math.min(gTop + 0.4, zTop), -WALL - 0.12, -WALL - 0.3, mats.curtain, `cl${i}`);
          at(o.b + 0.3 - cw, o.b + 0.3, cz0, Math.min(gTop + 0.4, zTop), -WALL - 0.12, -WALL - 0.3, mats.curtain, `cr${i}`);
          if (gTop + 0.55 < zTop) at(o.a - 0.5, o.b + 0.5, gTop + 0.45, gTop + 0.55, -WALL - 0.1, -WALL - 0.2, mats.frames, `rod${i}`);
        }
      } else if (o.kind === "door") {
        // Frame, a panelled leaf, a pull handle.
        const ft = 0.3;
        at(o.a, o.a + ft, sill, gTop, 0.06, -0.55, mats.frames, `dj${i}`);
        at(o.b - ft, o.b, sill, gTop, 0.06, -0.55, mats.frames, `dk${i}`);
        at(o.a, o.b, gTop - ft, gTop, 0.06, -0.55, mats.frames, `dh${i}`);
        if (entryOpen) {
          // Swung open into the hall, hinged on the left jamb.
          at(o.a + ft, o.a + ft + 0.18, sill, gTop - ft, -0.5, -0.5 - (w - ft * 2), mats.accent(w, gTop - sill), `dl${i}`);
        } else at(o.a + ft, o.b - ft, sill, gTop - ft, -0.36, -0.52, mats.accent(w, gTop - sill), `dl${i}`);
        const pw = (w - ft * 2) / 2 - 0.35;
        if (!entryOpen) [0, 1].forEach((c) =>
          [0, 1, 2].forEach((r) => {
            const pa = o.a + ft + 0.25 + c * (pw + 0.2);
            const zb = sill + 0.6 + r * ((gTop - sill - 1.4) / 3);
            at(pa, pa + pw, zb, zb + (gTop - sill - 1.4) / 3 - 0.3, -0.3, -0.36, mats.accent(pw, 2), `dp${i}${c}${r}`);
          }),
        );
        if (!entryOpen) at(o.b - ft - 0.55, o.b - ft - 0.45, sill + 2.6, sill + 4.6, -0.12, -0.3, mats.metal, `dhd${i}`);
        // Wall lights either side, and a house number plate.
        [o.a - 0.8, o.b + 0.5].forEach((x, k) => {
          at(x, x + 0.3, sill + 6.2, sill + 7.1, 0, 0.32, mats.dark, `wl${i}${k}`);
          at(x + 0.04, x + 0.26, sill + 6.3, sill + 7, 0.32, 0.34, mats.lamp, `wlg${i}${k}`);
        });
        at(o.b + 0.4, o.b + 1.6, sill + 4.6, sill + 5.3, 0, 0.08, mats.plate, `num${i}`);
      }
    }
    // Car porch and court openings: an exposed beam over the bay.
    if (o.kind === "open") at(o.a - 0.4, o.b + 0.4, Math.min(gTop, zTop) - 0.1, Math.min(gTop, zTop) + 0.6, 0.12, -0.2, mats.accent(w, 1), `beam${i}`);
    cursor = o.b;
  });
  box(cursor, s1, z0, zTop, mat, "end");
  // Stone skirting at the foot of the ground-floor walls, broken at doors and bays.
  if (Math.abs(z0 - PLINTH) < 0.01) {
    let from = s0 - (along ? WALL * 0 : WALL);
    const gaps = ops.filter((o) => o.kind === "door" || o.kind === "open" || (o.kind === "glazing" && o.sill < 0.1));
    [...gaps, null].forEach((o, k) => {
      const to = o ? o.a : s1 + (along ? 0 : WALL);
      if (to - from > 0.2) at(from, to, z0, z0 + 0.6, 0.1, -0.05, mats.skirting, `sk${k}`);
      if (o) from = o.b;
    });
  }
  return <>{pieces}</>;
}

function Partitions({ design, floor, z0, z1, mats }: { design: Design; floor: number; z0: number; z1: number; mats: MaterialsSet }) {
  const parts = React.useMemo(() => partitionsOf(design, floor), [design, floor]);
  const rooms = design.rooms.filter((r) => r.floor === floor);
  const paintAt = (x: number, y: number) => {
    const r = rooms.find((room) => room.wallColor && x >= room.x - 0.3 && x <= room.x + room.w + 0.3 && y >= room.y - 0.3 && y <= room.y + room.d + 0.3);
    return mats.walls(r?.wallColor, 10, z1 - z0);
  };
  return (
    <>
      {parts.map((p, i) => {
        const len = Math.hypot(p.x1 - p.x0, p.y1 - p.y0);
        const horiz = Math.abs(p.y1 - p.y0) < 0.01;
        const wallMat = paintAt((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2);
        const segs: Array<[number, number, number, number, THREE.Material]> = [];
        if (p.door) {
          segs.push([0, p.door[0], z0, z1, p.glass ? mats.glass : wallMat]);
          segs.push([p.door[1], len, z0, z1, p.glass ? mats.glass : wallMat]);
          if (z1 > z0 + 7.2 && p.door[1] - p.door[0] < len - 0.1) segs.push([p.door[0], p.door[1], z0 + 7.2, z1, wallMat]);
        } else segs.push([0, len, z0, z1, p.glass ? mats.glass : wallMat]);
        return segs.map(([a, b, za, zb, m], k) =>
          b - a > 0.05 ? (
            horiz ? (
              <Block key={`${i}-${k}`} x0={p.x0 + a} x1={p.x0 + b} y0={p.y0 - PART / 2} y1={p.y0 + PART / 2} z0={za} z1={zb} mat={m} />
            ) : (
              <Block key={`${i}-${k}`} x0={p.x0 - PART / 2} x1={p.x0 + PART / 2} y0={p.y0 + a} y1={p.y0 + b} z0={za} z1={zb} mat={m} />
            )
          ) : null,
        );
      })}
    </>
  );
}

function Stair({ room, z0, rise, mats }: { room: Room; z0: number; rise: number; mats: MaterialsSet }) {
  const steps = Math.max(10, Math.round(rise / 0.6));
  const width = Math.min(room.w - 1.2, 3.6);
  const run = (room.d - 2.5) / steps;
  const x0 = room.x + 0.6;
  return (
    <>
      {Array.from({ length: steps }, (_, i) => (
        <Block key={i} x0={x0} x1={x0 + width} y0={room.y + 0.6 + i * run} y1={room.y + 0.6 + (i + 1) * run} z0={z0} z1={z0 + ((i + 1) * rise) / steps} mat={i % 2 ? mats.wood : mats.slab} />
      ))}
      <Block x0={x0 + width} x1={x0 + width + 0.12} y0={room.y + 0.6} y1={room.y + 0.6 + steps * run} z0={z0 + 2.8} z1={z0 + 3} mat={mats.frames} />
    </>
  );
}

/* --------------------------------------------------------- furniture */

function FurnitureMesh({ item, mats, selected, onSelect }: { item: Furniture; mats: MaterialsSet; selected: boolean; onSelect?: (id: string) => void }) {
  const f = React.useContext(FrameCtx);
  const spec = FURNITURE[item.kind];
  const w = spec.w;
  const d = spec.d;
  // Local frame: width along x, back toward -z.
  const B = ({ x, z, w: bw, d: bd, y0, y1, m }: { x: number; z: number; w: number; d: number; y0: number; y1: number; m: THREE.Material }) => (
    <mesh position={[x, (y0 + y1) / 2, z]} material={m} castShadow receiveShadow>
      <boxGeometry args={[bw, y1 - y0, bd]} />
    </mesh>
  );
  const parts: React.ReactNode[] = [];
  const push = (key: string, el: React.ReactElement) => parts.push(<React.Fragment key={key}>{el}</React.Fragment>);
  const back = -d / 2;
  switch (item.kind) {
    case "bed":
      push("base", <B x={0} z={0.2} w={w} d={d - 0.4} y0={0} y1={1.1} m={mats.wood} />);
      push("mat", <B x={0} z={0.25} w={w - 0.2} d={d - 0.6} y0={1.1} y1={1.8} m={mats.linen} />);
      [-1, 1].forEach((s) => {
        push(`nt${s}`, <B x={s * (w / 2 + 1)} z={back + 0.9} w={1.5} d={1.4} y0={0} y1={1.9} m={mats.cabinets} />);
        push(`lp${s}`, <B x={s * (w / 2 + 1)} z={back + 0.9} w={0.12} d={0.12} y0={1.9} y1={2.7} m={mats.metal} />);
        push(`ls${s}`, <B x={s * (w / 2 + 1)} z={back + 0.9} w={0.8} d={0.8} y0={2.7} y1={3.3} m={mats.shade} />);
      });
      push("throw", <B x={0} z={d / 2 - 1.3} w={w - 0.1} d={2} y0={1.5} y1={1.85} m={mats.fabric} />);
      push("head", <B x={0} z={back + 0.15} w={w + 0.3} d={0.3} y0={0} y1={3.4} m={mats.cabinets} />);
      push("p1", <B x={-w / 4} z={back + 0.9} w={w / 2 - 0.4} d={1} y0={1.8} y1={2.2} m={mats.fabricSoft} />);
      push("p2", <B x={w / 4} z={back + 0.9} w={w / 2 - 0.4} d={1} y0={1.8} y1={2.2} m={mats.fabricSoft} />);
      break;
    case "sofa":
    case "armchair":
      push("seat", <B x={0} z={0.2} w={w} d={d - 0.4} y0={0.3} y1={1.3} m={mats.fabric} />);
      {
        const n = item.kind === "sofa" ? 3 : 1;
        const cw = (w - 1.3) / n;
        for (let k = 0; k < n; k++) push(`cu${k}`, <B x={-w / 2 + 0.65 + cw * (k + 0.5)} z={0.35} w={cw - 0.08} d={d - 1.1} y0={1.3} y1={1.7} m={mats.fabric} />);
      }
      push("back", <B x={0} z={back + 0.35} w={w} d={0.7} y0={0.3} y1={2.6} m={mats.fabric} />);
      push("a1", <B x={-w / 2 + 0.3} z={0.1} w={0.6} d={d - 0.2} y0={0.3} y1={2} m={mats.fabric} />);
      push("a2", <B x={w / 2 - 0.3} z={0.1} w={0.6} d={d - 0.2} y0={0.3} y1={2} m={mats.fabric} />);
      push("plinth", <B x={0} z={0} w={w - 0.3} d={d - 0.3} y0={0} y1={0.3} m={mats.dark} />);
      break;
    case "coffee":
      push("top", <B x={0} z={0} w={w} d={d} y0={1.1} y1={1.3} m={mats.wood} />);
      push("leg", <B x={0} z={0} w={w - 0.6} d={d - 0.6} y0={0} y1={1.1} m={mats.cabinets} />);
      break;
    case "rug":
      push("rug", <B x={0} z={0} w={w} d={d} y0={0.01} y1={0.06} m={mats.fabricSoft} />);
      break;
    case "tv":
      push("unit", <B x={0} z={0} w={w} d={d} y0={0} y1={1.6} m={mats.cabinets} />);
      push("screen", <B x={0} z={back + 0.15} w={w * 0.75} d={0.12} y0={2.6} y1={5.2} m={mats.dark} />);
      break;
    case "dining": {
      push("top", <B x={0} z={0} w={w} d={d} y0={2.35} y1={2.5} m={mats.wood} />);
      push("base", <B x={0} z={0} w={w - 1.6} d={0.5} y0={0} y1={2.35} m={mats.wood} />);
      const n = Math.max(2, Math.floor(w / 2));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        push(`c${i}a`, <B x={x} z={-d / 2 - 0.7} w={1.4} d={1.3} y0={0} y1={1.5} m={mats.fabric} />);
        push(`c${i}b`, <B x={x} z={d / 2 + 0.7} w={1.4} d={1.3} y0={0} y1={1.5} m={mats.fabric} />);
      }
      break;
    }
    case "counter":
      push("base", <B x={0} z={0} w={w} d={d} y0={0} y1={2.8} m={mats.cabinets} />);
      push("top", <B x={0} z={0.05} w={w + 0.1} d={d + 0.1} y0={2.8} y1={3} m={mats.stone} />);
      push("wall", <B x={0} z={back + 0.6} w={w} d={1.2} y0={5} y1={7.2} m={mats.cabinets} />);
      push("hob", <B x={w / 5} z={0} w={1.8} d={1.3} y0={3} y1={3.04} m={mats.dark} />);
      push("splash", <B x={0} z={back + 0.04} w={w} d={0.08} y0={3} y1={5} m={mats.tile} />);
      push("sink", <B x={-w / 4} z={0.1} w={2} d={1.2} y0={2.86} y1={3.02} m={mats.chrome} />);
      push("tap", <B x={-w / 4} z={back + 0.35} w={0.12} d={0.12} y0={3} y1={4} m={mats.chrome} />);
      push("tap2", <B x={-w / 4} z={back + 0.6} w={0.1} d={0.6} y0={3.9} y1={4} m={mats.chrome} />);
      break;
    case "island":
      push("base", <B x={0} z={0} w={w} d={d} y0={0} y1={2.8} m={mats.cabinets} />);
      push("top", <B x={0} z={0} w={w + 0.3} d={d + 0.3} y0={2.8} y1={3} m={mats.stone} />);
      break;
    case "wardrobe":
      push("body", <B x={0} z={0} w={w} d={d} y0={0} y1={7} m={mats.cabinets} />);
      push("seam", <B x={0} z={d / 2} w={0.05} d={0.04} y0={0.3} y1={6.7} m={mats.dark} />);
      break;
    case "desk":
      push("top", <B x={0} z={0} w={w} d={d} y0={2.35} y1={2.5} m={mats.wood} />);
      push("l1", <B x={-w / 2 + 0.2} z={0} w={0.2} d={d - 0.2} y0={0} y1={2.35} m={mats.dark} />);
      push("l2", <B x={w / 2 - 0.2} z={0} w={0.2} d={d - 0.2} y0={0} y1={2.35} m={mats.dark} />);
      push("chair", <B x={0} z={d / 2 + 0.8} w={1.6} d={1.5} y0={0} y1={1.6} m={mats.fabric} />);
      break;
    case "shelf":
      push("body", <B x={0} z={0} w={w} d={d} y0={0} y1={6.5} m={mats.wood} />);
      [1.6, 3.2, 4.8].forEach((y, i) => push(`b${i}`, <B x={0} z={d / 2 - 0.05} w={w - 0.3} d={0.1} y0={y} y1={y + 0.1} m={mats.dark} />));
      break;
    case "car":
      push("body", <B x={0} z={0} w={w} d={d} y0={0.8} y1={2.8} m={mats.car} />);
      push("cabin", <B x={0} z={0.6} w={w - 0.6} d={d * 0.5} y0={2.8} y1={4.6} m={mats.glass} />);
      push("roof", <B x={0} z={0.6} w={w - 0.8} d={d * 0.42} y0={4.5} y1={4.7} m={mats.car} />);
      [-1, 1].forEach((s) => {
        push(`hl${s}`, <B x={s * (w / 2 - 0.9)} z={d / 2 - 0.05} w={1.1} d={0.12} y0={2} y1={2.45} m={mats.lamp} />);
        push(`tl${s}`, <B x={s * (w / 2 - 0.9)} z={-d / 2 + 0.05} w={1.1} d={0.12} y0={2.1} y1={2.5} m={mats.tail} />);
      });
      push("grille", <B x={0} z={d / 2 - 0.03} w={2.4} d={0.1} y0={1.3} y1={1.9} m={mats.dark} />);
      [-1, 1].forEach((sx) =>
        [-1, 1].forEach((sz) =>
          push(
            `w${sx}${sz}`,
            <group position={[sx * (w / 2 - 0.4), 0.95, sz * (d / 2 - 2.6)]} rotation={[0, 0, Math.PI / 2]}>
              <mesh material={mats.rubber} castShadow>
                <cylinderGeometry args={[0.95, 0.95, 0.75, 24]} />
              </mesh>
              <mesh position={[0, sx * 0.39, 0]} material={mats.chrome}>
                <cylinderGeometry args={[0.55, 0.55, 0.04, 20]} />
              </mesh>
            </group>,
          ),
        ),
      );
      break;
    case "vanity":
      push("body", <B x={0} z={0} w={w} d={d} y0={0} y1={2.7} m={mats.cabinets} />);
      push("top", <B x={0} z={0} w={w} d={d} y0={2.7} y1={2.85} m={mats.stone} />);
      push("mirror", <B x={0} z={back + 0.05} w={w - 0.4} d={0.08} y0={3.6} y1={6} m={mats.glass} />);
      break;
    case "wc":
      push("tank", <B x={0} z={back + 0.4} w={w} d={0.7} y0={0} y1={2.6} m={mats.white} />);
      push("bowl", <B x={0} z={0.3} w={w - 0.2} d={d - 0.8} y0={0} y1={1.4} m={mats.white} />);
      break;
    case "plant":
      push(
        "pot",
        <mesh position={[0, 0.8, 0]} material={mats.dark} castShadow>
          <cylinderGeometry args={[0.7, 0.55, 1.6, 18]} />
        </mesh>,
      );
      push(
        "leaf",
        <mesh position={[0, 2.8, 0]} material={mats.leaf} castShadow>
          <icosahedronGeometry args={[1.1, 1]} />
        </mesh>,
      );
      break;
    default:
      break;
  }
  return (
    <group
      position={[item.x - f.cx, 0, f.cy - item.y]}
      rotation={[0, (item.rot * Math.PI) / 180, 0]}
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        onSelect(item.id);
      }}
    >
      {parts}
      {selected ? (
        <mesh position={[0, spec.h / 2 + 0.05, 0]}>
          <boxGeometry args={[w + 0.3, spec.h + 0.1, d + 0.3]} />
          <meshBasicMaterial color="#4e6151" wireframe />
        </mesh>
      ) : null}
    </group>
  );
}

/* --------------------------------------------------------------- roof */

function faceGeometry(faces: THREE.Vector3[][], tile: number) {
  const pos: number[] = [];
  const uv: number[] = [];
  for (const face of faces) {
    const p0 = face[0]!;
    const e1 = face[1]!.clone().sub(p0).normalize();
    const n = face[1]!.clone().sub(p0).cross(face[2]!.clone().sub(p0)).normalize();
    const e2 = n.clone().cross(e1).normalize();
    for (let i = 1; i < face.length - 1; i++) {
      for (const p of [p0, face[i]!, face[i + 1]!]) {
        pos.push(p.x, p.y, p.z);
        const rel = p.clone().sub(p0);
        uv.push(rel.dot(e1) / tile, rel.dot(e2) / tile);
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

function PitchedRoof({ design, z, mats }: { design: Design; z: number; mats: MaterialsSet }) {
  const f = React.useContext(FrameCtx);
  const fp = design.footprint;
  const o = 1.6;
  const geo = React.useMemo(() => {
    const x0 = fp.x - o;
    const x1 = fp.x + fp.w + o;
    const y0 = fp.y - o;
    const y1 = fp.y + fp.d + o;
    const span = Math.min(fp.w, fp.d);
    const rise = Math.min(9, span * 0.32);
    const V = (x: number, y: number, h: number) => toWorld(f, x, y, h);
    const zr = z + rise;
    const mx = (x0 + x1) / 2;
    const my = (y0 + y1) / 2;
    const alongX = fp.w >= fp.d;
    const faces: THREE.Vector3[][] = [];
    const ends: THREE.Vector3[][] = [];
    if (design.roof === "gable") {
      if (alongX) {
        faces.push([V(x0, y0, z), V(x1, y0, z), V(x1, my, zr), V(x0, my, zr)]);
        faces.push([V(x1, y1, z), V(x0, y1, z), V(x0, my, zr), V(x1, my, zr)]);
        ends.push([V(fp.x, fp.y, z), V(fp.x, fp.y + fp.d, z), V(fp.x, my, zr - o * 0.6)]);
        ends.push([V(fp.x + fp.w, fp.y + fp.d, z), V(fp.x + fp.w, fp.y, z), V(fp.x + fp.w, my, zr - o * 0.6)]);
      } else {
        faces.push([V(x0, y1, z), V(x0, y0, z), V(mx, y0, zr), V(mx, y1, zr)]);
        faces.push([V(x1, y0, z), V(x1, y1, z), V(mx, y1, zr), V(mx, y0, zr)]);
        ends.push([V(fp.x + fp.w, fp.y, z), V(fp.x, fp.y, z), V(mx, fp.y, zr - o * 0.6)]);
        ends.push([V(fp.x, fp.y + fp.d, z), V(fp.x + fp.w, fp.y + fp.d, z), V(mx, fp.y + fp.d, zr - o * 0.6)]);
      }
    } else {
      const inset = Math.min(x1 - x0, y1 - y0) / 2;
      if (alongX) {
        const r0 = V(x0 + inset, my, zr);
        const r1 = V(x1 - inset, my, zr);
        faces.push([V(x0, y0, z), V(x1, y0, z), r1, r0]);
        faces.push([V(x1, y1, z), V(x0, y1, z), r0, r1]);
        faces.push([V(x0, y1, z), V(x0, y0, z), r0]);
        faces.push([V(x1, y0, z), V(x1, y1, z), r1]);
      } else {
        const r0 = V(mx, y0 + inset, zr);
        const r1 = V(mx, y1 - inset, zr);
        faces.push([V(x0, y1, z), V(x0, y0, z), r0, r1]);
        faces.push([V(x1, y0, z), V(x1, y1, z), r1, r0]);
        faces.push([V(x0, y0, z), V(x1, y0, z), r0]);
        faces.push([V(x1, y1, z), V(x0, y1, z), r1]);
      }
    }
    return { faces: faceGeometry(faces, TILE[design.materials.roof.material]), ends: ends.length ? faceGeometry(ends, 6) : null };
  }, [f, fp, z, design.roof, design.materials.roof.material]);
  const roofMat = React.useMemo(() => {
    const t = textureFor(design.materials.roof);
    return new THREE.MeshStandardMaterial({ map: t, color: t ? "#ffffff" : design.materials.roof.color, roughness: 0.75, metalness: design.materials.roof.material === "metal" ? 0.5 : 0, side: THREE.DoubleSide });
  }, [design.materials.roof]);
  const endMat = React.useMemo(() => {
    const t = textureFor(design.materials.exterior);
    return new THREE.MeshStandardMaterial({ map: t, color: t ? "#ffffff" : design.materials.exterior.color, roughness: 0.9, side: THREE.DoubleSide });
  }, [design.materials.exterior]);
  return (
    <>
      <mesh geometry={geo.faces} material={roofMat} castShadow receiveShadow />
      {geo.ends ? <mesh geometry={geo.ends} material={endMat} castShadow receiveShadow /> : null}
    </>
  );
}

/* ------------------------------------------------------------ details */

/** A straight member between two plan points (x, y, z in feet), e.g. a handrail or hip cap. */
function Beam({ a, b, w = 0.15, h = 0.15, mat }: { a: [number, number, number]; b: [number, number, number]; w?: number; h?: number; mat: THREE.Material }) {
  const f = React.useContext(FrameCtx);
  const ref = React.useRef<THREE.Mesh>(null);
  const A = toWorld(f, ...a);
  const B = toWorld(f, ...b);
  const len = A.distanceTo(B);
  const mid = A.clone().add(B).multiplyScalar(0.5);
  React.useLayoutEffect(() => {
    ref.current?.lookAt(B);
  });
  return (
    <mesh ref={ref} position={mid} material={mat} castShadow receiveShadow>
      <boxGeometry args={[w, h, len]} />
    </mesh>
  );
}

function Cylinder({ x, y, z0, z1, r, mat, segments = 14 }: { x: number; y: number; z0: number; z1: number; r: number; mat: THREE.Material; segments?: number }) {
  const f = React.useContext(FrameCtx);
  return (
    <mesh position={toWorld(f, x, y, (z0 + z1) / 2)} material={mat} castShadow receiveShadow>
      <cylinderGeometry args={[r, r, z1 - z0, segments]} />
    </mesh>
  );
}

function Entrance({ design, mats }: { design: Design; mats: MaterialsSet }) {
  const fp = design.footprint;
  const ops = openingsOf(design, 0).filter((o) => o.side === "front" && (o.kind === "door" || o.kind === "open"));
  return (
    <>
      {ops.map((o, i) => {
        if (o.kind === "door") {
          const steps = 3;
          const rise = PLINTH / steps;
          const w = o.b - o.a + 3;
          const c = (o.a + o.b) / 2;
          return (
            <React.Fragment key={i}>
              {Array.from({ length: steps }, (_, k) => (
                <Block key={k} x0={c - w / 2 - (steps - k) * 0.3} x1={c + w / 2 + (steps - k) * 0.3} y0={fp.y - 0.4 - (steps - k) * 1.1} y1={fp.y - 0.4} z0={k * rise} z1={(k + 1) * rise} mat={mats.stone} />
              ))}
              {/* Cheek walls and a planter either side. */}
              {[-1, 1].map((s) => (
                <Block key={`cw${s}`} x0={s < 0 ? c - w / 2 - 1.3 : c + w / 2 + 0.9} x1={s < 0 ? c - w / 2 - 0.9 : c + w / 2 + 1.3} y0={fp.y - 0.4 - steps * 1.1} y1={fp.y - 0.4} z0={0} z1={PLINTH + 0.6} mat={mats.skirting} />
              ))}
            </React.Fragment>
          );
        }
        // A ramp up to the porch floor for the car.
        const len = 6;
        const slope = Math.atan2(PLINTH, len);
        const w = o.b - o.a;
        return <Ramp key={i} x={(o.a + o.b) / 2} y={fp.y - 0.4 - len / 2} w={w} len={len} slope={slope} mat={mats.skirting} />;
      })}
    </>
  );
}

function Ramp({ x, y, w, len, slope, mat }: { x: number; y: number; w: number; len: number; slope: number; mat: THREE.Material }) {
  const f = React.useContext(FrameCtx);
  const p = toWorld(f, x, y, PLINTH / 2 - 0.15);
  const hyp = Math.hypot(len, PLINTH);
  return (
    <mesh position={p} rotation={[slope, 0, 0]} material={mat} receiveShadow castShadow>
      <boxGeometry args={[w, 0.3, hyp]} />
    </mesh>
  );
}

function Rainwater({ design, roofZ, mats }: { design: Design; roofZ: number; mats: MaterialsSet }) {
  const fp = design.footprint;
  const pitched = design.roof !== "flat";
  const top = pitched ? roofZ - 0.2 : roofZ + 0.4;
  const off = pitched ? 1.25 : 0.35;
  const corners: Array<[number, number]> = [
    [fp.x - off, fp.y - (pitched ? 0.6 : off)],
    [fp.x + fp.w + off, fp.y - (pitched ? 0.6 : off)],
    [fp.x - off, fp.y + fp.d + (pitched ? 0.6 : off)],
    [fp.x + fp.w + off, fp.y + fp.d + (pitched ? 0.6 : off)],
  ];
  return (
    <>
      {corners.map(([x, y], i) => (
        <React.Fragment key={i}>
          <Cylinder x={x} y={y} z0={0.3} z1={top} r={0.17} mat={mats.frames} />
          <Block x0={x - 0.35} x1={x + 0.35} y0={y - 0.35} y1={y + 0.35} z0={0} z1={0.3} mat={mats.skirting} />
          {Array.from({ length: Math.max(1, Math.floor((top - 1) / 6)) }, (_, k) => (
            <Block key={k} x0={x - 0.24} x1={x + 0.24} y0={y - 0.24} y1={y + 0.24} z0={2 + k * 6} z1={2.15 + k * 6} mat={mats.metal} />
          ))}
        </React.Fragment>
      ))}
    </>
  );
}

function EaveDetails({ design, z, mats }: { design: Design; z: number; mats: MaterialsSet }) {
  const fp = design.footprint;
  const o = 1.6;
  const x0 = fp.x - o;
  const x1 = fp.x + fp.w + o;
  const y0 = fp.y - o;
  const y1 = fp.y + fp.d + o;
  const span = Math.min(fp.w, fp.d);
  const rise = Math.min(9, span * 0.32);
  const zr = z + rise;
  const mx = (x0 + x1) / 2;
  const my = (y0 + y1) / 2;
  const alongX = fp.w >= fp.d;
  const fasciaMat = mats.frames;
  const soffit = mats.white;
  const edges: Array<[number, number, number, number]> = [
    [x0, x1, y0, y0],
    [x0, x1, y1, y1],
    [x0, x0, y0, y1],
    [x1, x1, y0, y1],
  ];
  const inset = Math.min(x1 - x0, y1 - y0) / 2;
  const ridge: [[number, number, number], [number, number, number]] = alongX
    ? [[design.roof === "hip" ? x0 + inset : x0, my, zr + 0.1], [design.roof === "hip" ? x1 - inset : x1, my, zr + 0.1]]
    : [[mx, design.roof === "hip" ? y0 + inset : y0, zr + 0.1], [mx, design.roof === "hip" ? y1 - inset : y1, zr + 0.1]];
  const hips: Array<[[number, number, number], [number, number, number]]> =
    design.roof === "hip"
      ? [
          [[x0, y0, z + 0.1], ridge[0]],
          [[x0, y1, z + 0.1], ridge[0]],
          [[x1, y0, z + 0.1], ridge[1]],
          [[x1, y1, z + 0.1], ridge[1]],
        ].map(([a, b]) => {
          // Pair each eave corner with the nearer ridge end.
          const A = a as [number, number, number];
          const d0 = Math.hypot(A[0] - ridge[0][0], A[1] - ridge[0][1]);
          const d1 = Math.hypot(A[0] - ridge[1][0], A[1] - ridge[1][1]);
          return [A, d0 < d1 ? ridge[0] : ridge[1]] as [[number, number, number], [number, number, number]];
        })
      : [];
  return (
    <>
      {edges.map(([ax, bx, ay, by], i) => {
        const gableEnd = design.roof === "gable" && (alongX ? ax === bx : ay === by);
        if (gableEnd) return null;
        const horiz = ay === by;
        return (
          <React.Fragment key={i}>
            {/* Fascia board, soffit lining and a gutter along each eave. */}
            {horiz ? <Block x0={ax} x1={bx} y0={ay - 0.08} y1={ay + 0.08} z0={z - 0.55} z1={z + 0.1} mat={fasciaMat} /> : <Block x0={ax - 0.08} x1={ax + 0.08} y0={ay} y1={by} z0={z - 0.55} z1={z + 0.1} mat={fasciaMat} />}
            {horiz ? <Block x0={ax} x1={bx} y0={Math.min(ay, ay === y0 ? fp.y : fp.y + fp.d)} y1={Math.max(ay, ay === y0 ? fp.y : fp.y + fp.d)} z0={z - 0.6} z1={z - 0.5} mat={soffit} /> : <Block x0={Math.min(ax, ax === x0 ? fp.x : fp.x + fp.w)} x1={Math.max(ax, ax === x0 ? fp.x : fp.x + fp.w)} y0={ay} y1={by} z0={z - 0.6} z1={z - 0.5} mat={soffit} />}
            {horiz ? (
              <Block x0={ax} x1={bx} y0={ay === y0 ? ay - 0.45 : ay + 0.08} y1={ay === y0 ? ay - 0.08 : ay + 0.45} z0={z - 0.45} z1={z - 0.1} mat={mats.metal} />
            ) : (
              <Block x0={ax === x0 ? ax - 0.45 : ax + 0.08} x1={ax === x0 ? ax - 0.08 : ax + 0.45} y0={ay} y1={by} z0={z - 0.45} z1={z - 0.1} mat={mats.metal} />
            )}
          </React.Fragment>
        );
      })}
      <Beam a={ridge[0]} b={ridge[1]} w={0.55} h={0.35} mat={mats.ridge} />
      {hips.map(([a, b], i) => (
        <Beam key={i} a={a} b={b} w={0.45} h={0.3} mat={mats.ridge} />
      ))}
    </>
  );
}

function RoofTerrace({ design, z, mats, rooms }: { design: Design; z: number; mats: MaterialsSet; rooms: Room[] }) {
  const stair = rooms.find((r) => r.type === "stair");
  const free = rooms.filter((r) => ["bedroom", "master", "family", "study"].includes(r.type)).sort((a, b) => b.w * b.d - a.w * a.d)[0];
  return (
    <>
      {stair ? (
        <>
          {/* Water tank on the stair headroom, with its ribs and lid. */}
          <Cylinder x={stair.x + stair.w / 2} y={stair.y + stair.d / 2} z0={z + 8.5} z1={z + 12.5} r={Math.min(stair.w, stair.d) * 0.3} mat={mats.tank} segments={28} />
          {[9.5, 10.5, 11.5].map((h) => (
            <Cylinder key={h} x={stair.x + stair.w / 2} y={stair.y + stair.d / 2} z0={z + h} z1={z + h + 0.12} r={Math.min(stair.w, stair.d) * 0.3 + 0.05} mat={mats.tank} segments={28} />
          ))}
          <Cylinder x={stair.x + stair.w / 2} y={stair.y + stair.d / 2} z0={z + 12.5} z1={z + 12.8} r={Math.min(stair.w, stair.d) * 0.14} mat={mats.dark} segments={20} />
          {/* Door onto the terrace. */}
          <Block x0={stair.x + stair.w * 0.3} x1={stair.x + stair.w * 0.7} y0={stair.y - 0.08} y1={stair.y} z0={z} z1={z + 6.8} mat={mats.accent(3, 7)} />
        </>
      ) : null}
      {free
        ? (() => {
            const n = Math.max(1, Math.min(3, Math.floor((free.w - 3) / 5)));
            const pw = Math.min((free.w - 3) / n - 0.6, 5.5);
            const pd = Math.min(free.d - 4, 10);
            return Array.from({ length: n }, (_, k) => {
              const x = free.x + 1.5 + k * (pw + 0.6);
              const y = free.y + 2;
              const tilt = 0.24;
              return (
                <group key={k}>
                  <Block x0={x + 0.3} x1={x + 0.5} y0={y + 0.3} y1={y + 0.5} z0={z} z1={z + 1} mat={mats.metal} />
                  <Block x0={x + pw - 0.5} x1={x + pw - 0.3} y0={y + 0.3} y1={y + 0.5} z0={z} z1={z + 1} mat={mats.metal} />
                  <Block x0={x + 0.3} x1={x + 0.5} y0={y + pd - 0.5} y1={y + pd - 0.3} z0={z} z1={z + 1 + pd * tilt} mat={mats.metal} />
                  <Block x0={x + pw - 0.5} x1={x + pw - 0.3} y0={y + pd - 0.5} y1={y + pd - 0.3} z0={z} z1={z + 1 + pd * tilt} mat={mats.metal} />
                  <SolarPanel x={x} y={y} w={pw} d={pd} z={z + 1.1} tilt={Math.atan(tilt)} mats={mats} />
                </group>
              );
            });
          })()
        : null}
    </>
  );
}

function SolarPanel({ x, y, w, d, z, tilt, mats }: { x: number; y: number; w: number; d: number; z: number; tilt: number; mats: MaterialsSet }) {
  const f = React.useContext(FrameCtx);
  const len = d / Math.cos(tilt);
  const p = toWorld(f, x + w / 2, y + d / 2, z + (d * Math.tan(tilt)) / 2);
  return (
    <mesh position={p} rotation={[tilt, 0, 0]} material={mats.solar} castShadow receiveShadow>
      <boxGeometry args={[w, 0.12, len]} />
    </mesh>
  );
}

function Balustrade({ room, z0, rise, mats }: { room: Room; z0: number; rise: number; mats: MaterialsSet }) {
  const width = Math.min(room.w - 1.2, 3.6);
  const x = room.x + 0.6 + width + 0.06;
  const y0 = room.y + 0.6;
  const y1 = room.y + room.d - 1.9;
  const posts = 7;
  return (
    <>
      {Array.from({ length: posts + 1 }, (_, k) => {
        const t = k / posts;
        const y = y0 + (y1 - y0) * t;
        const base = z0 + rise * t;
        return <Block key={k} x0={x - 0.05} x1={x + 0.05} y0={y - 0.05} y1={y + 0.05} z0={base} z1={base + 3} mat={mats.metal} />;
      })}
      <Beam a={[x, y0, z0 + 3.05]} b={[x, y1, z0 + rise + 3.05]} w={0.12} h={0.16} mat={mats.wood} />
    </>
  );
}

/** A room's slab or floor, with the stairwell over the flight left open. */
function piecesOf(r: Room, well: boolean, rise: number): Array<[number, number, number, number]> {
  if (!well) return [[r.x, r.x + r.w, r.y, r.y + r.d]];
  const fl = flightOf(r, rise);
  return [
    [r.x, fl.x0, r.y, r.y + r.d],
    [fl.x1, r.x + r.w, r.y, r.y + r.d],
    [fl.x0, fl.x1, r.y, fl.y0],
    [fl.x0, fl.x1, fl.y1, r.y + r.d],
  ];
}

/** Glass guard with a timber handrail along the open sides of a stairwell. */
function WellGuard({ room, z0, rise, mats }: { room: Room; z0: number; rise: number; mats: MaterialsSet }) {
  const fl = flightOf(room, rise);
  return (
    <>
      <Block x0={fl.x1 - 0.03} x1={fl.x1 + 0.03} y0={fl.y0} y1={fl.y1} z0={z0} z1={z0 + 3.2} mat={mats.glass} cast={false} />
      <Block x0={fl.x0} x1={fl.x1} y0={fl.y0 - 0.03} y1={fl.y0 + 0.03} z0={z0} z1={z0 + 3.2} mat={mats.glass} cast={false} />
      <Block x0={fl.x1 - 0.09} x1={fl.x1 + 0.09} y0={fl.y0 - 0.09} y1={fl.y1} z0={z0 + 3.2} z1={z0 + 3.38} mat={mats.wood} />
      <Block x0={fl.x0} x1={fl.x1} y0={fl.y0 - 0.09} y1={fl.y0 + 0.09} z0={z0 + 3.2} z1={z0 + 3.38} mat={mats.wood} />
      <Block x0={fl.x1 - 0.06} x1={fl.x1 + 0.06} y0={fl.y0} y1={fl.y1} z0={z0} z1={z0 + 0.12} mat={mats.metal} />
    </>
  );
}

function Pendants({ rooms, z, lit, mats }: { rooms: Room[]; z: number; lit: boolean; mats: MaterialsSet }) {
  const f = React.useContext(FrameCtx);
  return (
    <>
      {rooms
        .filter((r) => ["living", "dining", "bedroom", "master", "family", "kitchen", "study", "foyer"].includes(r.type))
        .map((r) => {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.d / 2;
          const drop = r.type === "dining" ? 2.6 : 1.6;
          return (
            <group key={r.id}>
              <Cylinder x={cx} y={cy} z0={z - drop} z1={z} r={0.02} mat={mats.dark} segments={6} />
              <mesh position={toWorld(f, cx, cy, z - drop - 0.35)} material={mats.shade}>
                <coneGeometry args={[r.type === "dining" ? 0.9 : 0.6, 0.7, 24, 1, true]} />
              </mesh>
              <mesh position={toWorld(f, cx, cy, z - drop - 0.55)} material={lit ? mats.lamp : mats.white}>
                <sphereGeometry args={[0.16, 12, 8]} />
              </mesh>
            </group>
          );
        })}
    </>
  );
}

/* -------------------------------------------------------------- house */

export interface HouseModelProps {
  brief: Brief;
  design: Design;
  /** Highest floor to show; floors above are hidden. */
  maxFloor: number;
  /** Section cut: hide the roof and cut the top visible floor's walls. */
  cutaway: boolean;
  selectedRoom?: string | null;
  selectedFurniture?: string | null;
  onSelectRoom?: (id: string | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  lit: boolean;
  /** Night: exterior lighting, soffit downlights and wall washes switch on. */
  night?: boolean;
  /** Front door stands open (during the walkthrough). */
  entryOpen?: boolean;
}

export function HouseModel({ brief, design, maxFloor, cutaway, selectedRoom, selectedFurniture, onSelectRoom, onSelectFurniture, lit, night = false, entryOpen = false }: HouseModelProps) {
  const fp = design.footprint;
  const frame = React.useMemo(() => ({ cx: fp.x + fp.w / 2, cy: fp.y + fp.d / 2 }), [fp]);
  const mats = useMaterials(design, lit);
  const FH = design.floorHeight;
  const floors = brief.floors;
  const level = (f: number) => PLINTH + f * FH;
  const showRoof = !cutaway && maxFloor >= floors - 1;
  const selectRoom = (id: string) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelectRoom?.(id);
  };

  const floorsShown = Array.from({ length: Math.min(floors, maxFloor + 1) }, (_, f) => f);
  const roofZ = level(floors);
  const topRooms = design.rooms.filter((r) => r.floor === floors - 1);
  // A stair room above another stair room has a stairwell cut through its slab.
  const wellBelow = (r: Room, f: number) => f > 0 && r.type === "stair" && design.rooms.some((b) => b.floor === f - 1 && b.type === "stair" && Math.abs(b.x - r.x) < 0.01 && Math.abs(b.y - r.y) < 0.01);

  return (
    <FrameCtx.Provider value={frame}>
      <group>
        {/* Plinth with an accent band. */}
        <Block x0={fp.x - 0.4} x1={fp.x + fp.w + 0.4} y0={fp.y - 0.4} y1={fp.y + fp.d + 0.4} z0={0} z1={PLINTH} mat={mats.accent(fp.w, PLINTH)} />
        {floorsShown.map((f) => {
          const z0 = level(f);
          const isTop = f === floorsShown.length - 1;
          const wallTop = z0 + FH - SLAB;
          const cutAt = cutaway && isTop ? z0 + 4.5 : wallTop;
          const rooms = design.rooms.filter((r) => r.floor === f);
          const openings = openingsOf(design, f);
          return (
            <group key={f}>
              {/* Slab under this floor (the plinth serves the ground). */}
              {f > 0
                ? rooms
                    .filter((r) => r.type !== "void")
                    .flatMap((r) => piecesOf(r, wellBelow(r, f), FH).map(([x0, x1, y0, y1], k) => <Block key={`slab${r.id}${k}`} x0={x0} x1={x1} y0={y0} y1={y1} z0={z0 - SLAB} z1={z0} mat={mats.slab} />))
                : null}
              {f > 0 ? (
                <>
                  {/* Slab edge band, outside the walls. */}
                  <Block x0={fp.x - 0.5} x1={fp.x + fp.w + 0.5} y0={fp.y - 0.5} y1={fp.y} z0={z0 - SLAB} z1={z0} mat={mats.accent(fp.w, 1)} />
                  <Block x0={fp.x - 0.5} x1={fp.x + fp.w + 0.5} y0={fp.y + fp.d} y1={fp.y + fp.d + 0.5} z0={z0 - SLAB} z1={z0} mat={mats.accent(fp.w, 1)} />
                  <Block x0={fp.x - 0.5} x1={fp.x} y0={fp.y} y1={fp.y + fp.d} z0={z0 - SLAB} z1={z0} mat={mats.accent(fp.d, 1)} />
                  <Block x0={fp.x + fp.w} x1={fp.x + fp.w + 0.5} y0={fp.y} y1={fp.y + fp.d} z0={z0 - SLAB} z1={z0} mat={mats.accent(fp.d, 1)} />
                </>
              ) : null}
              {/* Finishes, clickable to select the room. */}
              {rooms.map((r) => {
                if (r.type === "void") return null;
                const m = r.type === "court" ? materialFor({ material: "stone", color: "#c9c0ae" }, r.w, r.d) : r.type === "parking" ? materialFor({ material: "concrete", color: "#b3b0a8" }, r.w, r.d) : mats.floor(r.finish, r.w, r.d);
                const well = wellBelow(r, f);
                return (
                  <React.Fragment key={`fin${r.id}`}>
                    {piecesOf(r, well, FH).map(([x0, x1, y0, y1], k) => (
                      <Block key={k} x0={Math.max(x0, r.x + 0.05)} x1={Math.min(x1, r.x + r.w - 0.05)} y0={Math.max(y0, r.y + 0.05)} y1={Math.min(y1, r.y + r.d - 0.05)} z0={z0} z1={z0 + 0.06} mat={m} cast={false} onClick={selectRoom(r.id)} name={`room:${r.id}`} />
                    ))}
                    {well ? <WellGuard room={r} z0={z0} rise={FH} mats={mats} /> : null}
                    {selectedRoom === r.id ? <Block x0={r.x + 0.1} x1={r.x + r.w - 0.1} y0={r.y + 0.1} y1={r.y + r.d - 0.1} z0={z0 + 0.06} z1={z0 + 0.1} mat={mats.highlight} cast={false} receive={false} /> : null}
                  </React.Fragment>
                );
              })}
              {/* Room wall paint shows on a thin lining inside each room's exterior walls. */}
              {(["front", "back", "left", "right"] as Side[]).map((side) => (
                <SideWall key={side} side={side} openings={openings} z0={z0} z1={wallTop} top={cutAt} design={design} mats={mats} entryOpen={entryOpen && f === 0} />
              ))}
              <Partitions design={design} floor={f} z0={z0} z1={Math.min(cutAt, wallTop)} mats={mats} />
              {rooms
                .filter((r) => r.type === "stair" && f < floors - 1)
                .map((r) => (
                  <React.Fragment key={r.id}>
                    <Stair room={r} z0={z0} rise={FH} mats={mats} />
                    <Balustrade room={r} z0={z0} rise={FH} mats={mats} />
                  </React.Fragment>
                ))}
              {/* Pendant lights hang from the ceiling, except on a floor cut open in section. */}
              {cutAt >= wallTop ? <Pendants rooms={rooms} z={wallTop} lit={lit} mats={mats} /> : null}
              {/* Ceiling of the top visible floor when not cut. */}
              <group position={[0, z0, 0]}>
                {design.furniture
                  .filter((item) => item.floor === f)
                  .map((item) => (
                    <FurnitureMesh key={item.id} item={item} mats={mats} selected={selectedFurniture === item.id} onSelect={onSelectFurniture ? (id) => onSelectFurniture(id) : undefined} />
                  ))}
              </group>
            </group>
          );
        })}
        {showRoof ? (
          <>
            {topRooms
              .filter((r) => r.type !== "void")
              .map((r) => (
                <Block key={`roof${r.id}`} x0={r.x} x1={r.x + r.w} y0={r.y} y1={r.y + r.d} z0={roofZ - SLAB} z1={roofZ} mat={design.roof === "flat" ? materialFor(design.materials.roof, r.w, r.d) : mats.slab} />
              ))}
            {design.roof === "flat" ? (
              <>
                {[
                  [fp.x - 0.5, fp.x + fp.w + 0.5, fp.y - 0.5, fp.y],
                  [fp.x - 0.5, fp.x + fp.w + 0.5, fp.y + fp.d, fp.y + fp.d + 0.5],
                  [fp.x - 0.5, fp.x, fp.y, fp.y + fp.d],
                  [fp.x + fp.w, fp.x + fp.w + 0.5, fp.y, fp.y + fp.d],
                ].map(([x0, x1, y0, y1], i) => (
                  <React.Fragment key={i}>
                    <Block x0={x0!} x1={x1!} y0={y0!} y1={y1!} z0={roofZ - SLAB} z1={roofZ + 3} mat={mats.exterior(fp.w, 3)} />
                    <Block x0={x0! - 0.1} x1={x1! + 0.1} y0={y0! - 0.1} y1={y1! + 0.1} z0={roofZ + 3} z1={roofZ + 3.25} mat={mats.accent(fp.w, 1)} />
                  </React.Fragment>
                ))}
                {topRooms
                  .filter((r) => r.type === "stair")
                  .map((r) => (
                    <React.Fragment key={`m${r.id}`}>
                      <Block x0={r.x} x1={r.x + r.w} y0={r.y} y1={r.y + r.d} z0={roofZ} z1={roofZ + 8} mat={mats.exterior(r.w, 8)} />
                      <Block x0={r.x - 0.4} x1={r.x + r.w + 0.4} y0={r.y - 0.4} y1={r.y + r.d + 0.4} z0={roofZ + 8} z1={roofZ + 8.5} mat={mats.accent(r.w, 1)} />
                    </React.Fragment>
                  ))}
              </>
            ) : (
              <>
                <PitchedRoof design={design} z={roofZ} mats={mats} />
                <EaveDetails design={design} z={roofZ} mats={mats} />
              </>
            )}
            {design.roof === "flat" ? <RoofTerrace design={design} z={roofZ} mats={mats} rooms={topRooms} /> : null}
            <Rainwater design={design} roofZ={roofZ} mats={mats} />
          </>
        ) : null}
        <Entrance design={design} mats={mats} />
        {/* Entrance canopy. */}
        {(() => {
          const ops = openingsOf(design, 0).filter((o) => o.kind === "door" && o.side === "front");
          return ops.map((o, i) => (
            <Block key={`can${i}`} x0={(o.a + o.b) / 2 - 4} x1={(o.a + o.b) / 2 + 4} y0={fp.y - 4} y1={fp.y} z0={PLINTH + 8.4} z1={PLINTH + 8.9} mat={mats.accent(8, 4)} />
          ));
        })()}
        {/* Interior lights at night: one warm point per large room on visible floors. */}
        {lit
          ? design.rooms
              .filter((r) => r.floor <= maxFloor && r.w * r.d > 70 && r.type !== "court" && r.type !== "parking" && r.type !== "void" && r.type !== "stair")
              .sort((a, b) => b.w * b.d - a.w * a.d)
              .slice(0, 6)
              .map((r) => {
                const p = toWorld(frame, r.x + r.w / 2, r.y + r.d / 2, level(r.floor) + FH - 2.2);
                return <pointLight key={`l${r.id}`} position={p} intensity={night ? 22 : 14} distance={Math.max(r.w, r.d) * 1.7 + 6} decay={1.5} color={r.type === "bath" || r.type === "kitchen" ? "#ffe2b8" : "#ffc98a"} />;
              })
          : null}
        <Facade brief={brief} design={design} mats={mats} night={night} maxFloor={maxFloor} cutaway={cutaway} />
      </group>
    </FrameCtx.Provider>
  );
}

