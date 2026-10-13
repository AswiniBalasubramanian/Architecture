"use client";

// Interiors furnished the way a premium residence is styled: upholstered,
// rounded pieces on slim brass legs, fluted timber feature walls, marble and
// stone tops, framed art, woven rugs, potted palms, and gypsum ceilings with a
// warm cove line and recessed downlights.

import * as React from "react";
import * as THREE from "three";
import { RoundedBox } from "@react-three/drei";
import { FURNITURE } from "@/lib/catalog";
import type { Design, Furniture, Room } from "@/lib/types";
import { Block, FrameCtx, toWorld, type MaterialsSet } from "./HouseModel";
import { PottedPalm } from "./Palms";
import { surfaceMaterial } from "./textures";

/* ----------------------------------------------------------- textures */

const artCache = new Map<number, THREE.Texture>();
/** Quiet abstract canvases: warm ground, a few soft organic forms, a fine line. */
function artTexture(seed: number) {
  const key = seed % 4;
  const hit = artCache.get(key);
  if (hit || typeof document === "undefined") return hit ?? null;
  const c = document.createElement("canvas");
  c.width = 384;
  c.height = 256;
  const g = c.getContext("2d")!;
  const palettes = [
    ["#efe7da", "#c46f4b", "#7f8f6a", "#2f2d2a"],
    ["#ece6dc", "#d4a55a", "#5f6f66", "#b9603f"],
    ["#e9e3d8", "#8d6a4f", "#c9b79a", "#3a3a36"],
    ["#f1ece3", "#6e8a83", "#d9a07b", "#2b2c2b"],
  ][key]!;
  g.fillStyle = palettes[0]!;
  g.fillRect(0, 0, 384, 256);
  let s = key * 97 + 13;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 4; i++) {
    g.fillStyle = palettes[1 + (i % 3)]!;
    g.globalAlpha = 0.85;
    g.beginPath();
    const cx = 60 + r() * 260;
    const cy = 50 + r() * 150;
    const rad = 40 + r() * 70;
    g.ellipse(cx, cy, rad, rad * (0.6 + r() * 0.6), r() * 3, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = palettes[3]!;
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(30, 200);
  g.bezierCurveTo(120, 80, 240, 230, 350, 60);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  artCache.set(key, t);
  return t;
}

const rugCache = new Map<string, THREE.Texture>();
/** A flat-woven rug: tonal field, a border band and a fine weave. */
function rugTexture(color: string) {
  const hit = rugCache.get(color);
  if (hit || typeof document === "undefined") return hit ?? null;
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const g = c.getContext("2d")!;
  const base = new THREE.Color(color);
  const field = `#${base.clone().lerp(new THREE.Color("#f3eee6"), 0.55).getHexString()}`;
  const band = `#${base.clone().multiplyScalar(0.72).getHexString()}`;
  g.fillStyle = field;
  g.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 3) {
    g.fillStyle = y % 6 ? "rgba(0,0,0,0.035)" : "rgba(255,255,255,0.05)";
    g.fillRect(0, y, 512, 1.5);
  }
  g.strokeStyle = band;
  g.lineWidth = 22;
  g.strokeRect(34, 34, 444, 444);
  g.lineWidth = 3;
  g.strokeRect(62, 62, 388, 388);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  rugCache.set(color, t);
  return t;
}

/* ---------------------------------------------------------- materials */

export function useInteriorMaterials(design: Design, lit: boolean) {
  const m = design.materials;
  return React.useMemo(() => {
    const fabric = new THREE.Color(m.furniture.color);
    return {
      boucle: surfaceMaterial("fabric", `#${fabric.clone().lerp(new THREE.Color("#f2ede4"), 0.45).getHexString()}`, 3, 3, { roughness: 1 }),
      upholstery: surfaceMaterial("fabric", m.furniture.color, 3, 3, { roughness: 1 }),
      duvet: new THREE.MeshStandardMaterial({ color: "#f6f3ee", roughness: 0.95 }),
      terracotta: surfaceMaterial("fabric", "#b5643f", 2, 2, { roughness: 1 }),
      sage: surfaceMaterial("fabric", "#8c9a7a", 2, 2, { roughness: 1 }),
      ochre: surfaceMaterial("fabric", "#c99a4f", 2, 2, { roughness: 1 }),
      brass: new THREE.MeshStandardMaterial({ color: "#b8925a", roughness: 0.3, metalness: 1 }),
      blackMetal: new THREE.MeshStandardMaterial({ color: "#1f2120", roughness: 0.4, metalness: 0.6 }),
      fluted: surfaceMaterial("wood", "#8e6240", 1, 9, { roughness: 0.55 }),
      walnut: surfaceMaterial("wood", "#6b4a33", 4, 4, { roughness: 0.5 }),
      oak: surfaceMaterial("wood", "#b48a5e", 4, 4, { roughness: 0.55 }),
      marble: new THREE.MeshPhysicalMaterial({ map: surfaceMaterial("marble", "#ece8e1", 3, 3).map, roughness: 0.18, clearcoat: 0.6, clearcoatRoughness: 0.15 }),
      screen: new THREE.MeshPhysicalMaterial({ color: "#0d0f10", roughness: 0.08, metalness: 0.2, clearcoat: 1 }),
      mirror: new THREE.MeshStandardMaterial({ color: "#d9dfe0", roughness: 0.04, metalness: 1 }),
      porcelain: new THREE.MeshPhysicalMaterial({ color: "#f7f6f2", roughness: 0.18, clearcoat: 0.8 }),
      ceiling: new THREE.MeshStandardMaterial({ color: "#f7f5f0", roughness: 0.85 }),
      cove: lit ? new THREE.MeshStandardMaterial({ color: "#fff2dc", emissive: "#ffcf8f", emissiveIntensity: 4.5 }) : new THREE.MeshStandardMaterial({ color: "#f2efe8", roughness: 0.6 }),
      can: lit ? new THREE.MeshStandardMaterial({ color: "#fff4e0", emissive: "#ffd6a0", emissiveIntensity: 5 }) : new THREE.MeshStandardMaterial({ color: "#dcd8cf", roughness: 0.35, metalness: 0.5 }),
      led: lit ? new THREE.MeshStandardMaterial({ color: "#fff1d8", emissive: "#ffc77a", emissiveIntensity: 3.5 }) : new THREE.MeshStandardMaterial({ color: "#2a2a28" }),
      frame: new THREE.MeshStandardMaterial({ color: "#2a2724", roughness: 0.5 }),
      art: [0, 1, 2, 3].map((k) => new THREE.MeshStandardMaterial({ map: artTexture(k), roughness: 0.85 })),
      rug: new THREE.MeshStandardMaterial({ map: rugTexture(m.furniture.color), roughness: 1 }),
      books: ["#7a3e2a", "#3f4d45", "#c9b89a", "#2f3133", "#a5713f", "#e7e1d6"].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 })),
      ceramic: new THREE.MeshStandardMaterial({ color: "#d9cfc0", roughness: 0.6 }),
    };
  }, [m.furniture, lit]);
}

type IM = ReturnType<typeof useInteriorMaterials>;

/* ----------------------------------------------------------- helpers */

interface BoxProps {
  x?: number;
  z?: number;
  w: number;
  d: number;
  y0: number;
  y1: number;
  m: THREE.Material;
  r?: number;
  rx?: number;
  ry?: number;
}

function Box({ x = 0, z = 0, w, d, y0, y1, m, rx = 0, ry = 0 }: BoxProps) {
  return (
    <mesh position={[x, (y0 + y1) / 2, z]} rotation={[rx, ry, 0]} material={m} castShadow receiveShadow>
      <boxGeometry args={[w, y1 - y0, d]} />
    </mesh>
  );
}

/** A soft, rounded block: upholstery, mattresses, cushions, stone tops. */
function Soft({ x = 0, z = 0, w, d, y0, y1, m, r = 0.15, rx = 0, ry = 0 }: BoxProps) {
  const h = y1 - y0;
  const rad = Math.max(0.01, Math.min(r, w / 2 - 0.005, h / 2 - 0.005, d / 2 - 0.005));
  return <RoundedBox args={[w, h, d]} radius={rad} smoothness={3} position={[x, (y0 + y1) / 2, z]} rotation={[rx, ry, 0]} material={m} castShadow receiveShadow />;
}

function Cyl({ x = 0, z = 0, r0, r1 = r0, y0, y1, m, seg = 24 }: { x?: number; z?: number; r0: number; r1?: number; y0: number; y1: number; m: THREE.Material; seg?: number }) {
  return (
    <mesh position={[x, (y0 + y1) / 2, z]} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[r1, r0, y1 - y0, seg]} />
    </mesh>
  );
}

/** Framed art on the wall behind a piece (z is the wall face, facing +z). */
function Art({ x = 0, z, w, h, y, im, seed }: { x?: number; z: number; w: number; h: number; y: number; im: IM; seed: number }) {
  return (
    <>
      <Box x={x} z={z + 0.04} w={w + 0.24} d={0.08} y0={y - 0.12} y1={y + h + 0.12} m={im.frame} />
      <mesh position={[x, y + h / 2, z + 0.085]} material={im.art[seed % 4]}>
        <planeGeometry args={[w, h]} />
      </mesh>
    </>
  );
}

function Legs({ w, d, h, m, inset = 0.25, r = 0.05 }: { w: number; d: number; h: number; m: THREE.Material; inset?: number; r?: number }) {
  return (
    <>
      {[-1, 1].flatMap((sx) => [-1, 1].map((sz) => <Cyl key={`${sx}${sz}`} x={sx * (w / 2 - inset)} z={sz * (d / 2 - inset)} r0={r} r1={r * 0.8} y0={0} y1={h} m={m} seg={10} />))}
    </>
  );
}

function Books({ x, z, w, y, im, seed }: { x: number; z: number; w: number; y: number; im: IM; seed: number }) {
  let s = seed * 31 + 7;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const out: React.ReactNode[] = [];
  let cx = x - w / 2;
  let i = 0;
  while (cx < x + w / 2 - 0.2) {
    const bw = 0.12 + r() * 0.14;
    const bh = 0.75 + r() * 0.45;
    out.push(<Box key={i} x={cx + bw / 2} z={z} w={bw} d={0.7} y0={y} y1={y + bh} m={im.books[Math.floor(r() * im.books.length)]!} />);
    cx += bw + 0.015;
    i++;
    if (r() < 0.12) cx += 0.5;
  }
  return <>{out}</>;
}

/* ---------------------------------------------------------- furniture */

export function PremiumFurniture({ item, mats, im, selected, onSelect, wall: behind = null }: { item: Furniture; mats: MaterialsSet; im: IM; selected: boolean; onSelect?: (id: string) => void; wall?: "exterior" | "partition" | null }) {
  const f = React.useContext(FrameCtx);
  const spec = FURNITURE[item.kind];
  const w = spec.w;
  const d = spec.d;
  const back = -d / 2;
  const solid = behind !== null;
  // The wall face behind a piece placed against it. Pieces against an outer
  // wall are eased forward off its 0.75 ft thickness.
  const wall = back - 0.2;
  const shift = behind === "exterior" ? 0.55 : 0;
  const seed = Math.abs(Math.round(item.x * 7 + item.y * 13));
  const parts: React.ReactNode[] = [];
  const push = (el: React.ReactElement) => parts.push(<React.Fragment key={parts.length}>{el}</React.Fragment>);

  switch (item.kind) {
    case "bed": {
      // Fluted timber wall behind an upholstered channel headboard.
      const pw = w + 4.6;
      if (solid) {
        push(<Box z={wall + 0.06} w={pw} d={0.1} y0={0} y1={8.4} m={im.walnut} />);
        for (let x = -pw / 2 + 0.16; x < pw / 2 - 0.1; x += 0.3) push(<Box x={x} z={wall + 0.16} w={0.18} d={0.1} y0={0} y1={8.4} m={im.fluted} />);
        push(<Box z={wall + 0.24} w={pw} d={0.06} y0={8.3} y1={8.4} m={im.led} />);
      }
      for (let k = 0; k < 5; k++) push(<Soft x={-w / 2 - 0.1 + (k + 0.5) * ((w + 0.2) / 5)} z={back + 0.35} w={(w + 0.2) / 5 - 0.04} d={0.42} y0={1.0} y1={4.2} m={im.boucle} r={0.18} />);
      push(<Soft z={0.25} w={w} d={d - 0.5} y0={0.3} y1={1.15} m={im.boucle} r={0.18} />);
      push(<Box z={0.25} w={w - 0.5} d={d - 1} y0={0} y1={0.3} m={im.blackMetal} />);
      push(<Soft z={0.35} w={w - 0.2} d={d - 0.9} y0={1.1} y1={1.8} m={mats.linen} r={0.22} />);
      push(<Soft z={d / 2 - d * 0.32 - 0.1} w={w + 0.05} d={d * 0.64} y0={1.55} y1={1.98} m={im.duvet} r={0.16} />);
      push(<Soft z={d / 2 - d * 0.62} w={w} d={0.5} y0={1.85} y1={2.06} m={im.duvet} r={0.1} />);
      push(<Soft z={d / 2 - 1.15} w={w + 0.15} d={1.5} y0={1.92} y1={2.04} m={seed % 2 ? im.terracotta : im.sage} r={0.05} />);
      [-1, 1].forEach((s) => {
        push(<Soft x={s * (w / 4)} z={back + 0.95} w={w / 2 - 0.35} d={0.5} y0={1.8} y1={2.95} m={im.duvet} r={0.22} rx={-0.25} />);
        push(<Soft x={s * (w / 4 - 0.3)} z={back + 1.4} w={1.3} d={0.4} y0={1.85} y1={2.65} m={s < 0 ? im.ochre : im.sage} r={0.16} rx={-0.2} />);
        // Floating bedside with a drawer line, brass pull and a lamp.
        const nx = s * (w / 2 + 1.15);
        push(<Soft x={nx} z={back + 0.85} w={1.8} d={1.35} y0={0.8} y1={1.95} m={im.walnut} r={0.06} />);
        push(<Box x={nx} z={back + 1.53} w={1.6} d={0.02} y0={1.35} y1={1.38} m={im.frame} />);
        push(<Box x={nx} z={back + 1.56} w={0.5} d={0.05} y0={1.55} y1={1.6} m={im.brass} />);
        push(<Cyl x={nx} z={back + 0.75} r0={0.22} r1={0.1} y0={1.95} y1={2.85} m={im.ceramic} />);
        push(<Cyl x={nx} z={back + 0.75} r0={0.48} r1={0.36} y0={2.8} y1={3.5} m={mats.shade} />);
      });
      push(<Box z={1.3} w={w + 3.4} d={d + 1.6} y0={0.005} y1={0.03} m={im.rug} />);
      break;
    }
    case "sofa":
    case "armchair": {
      const sofa = item.kind === "sofa";
      const n = sofa ? 3 : 1;
      const cw = (w - 1.2) / n;
      push(<Soft z={0.15} w={w} d={d - 0.3} y0={0.35} y1={1.3} m={im.upholstery} r={0.2} />);
      for (let k = 0; k < n; k++) {
        const x = -w / 2 + 0.6 + cw * (k + 0.5);
        push(<Soft x={x} z={0.35} w={cw - 0.06} d={d - 1.05} y0={1.22} y1={1.72} m={im.upholstery} r={0.18} />);
        push(<Soft x={x} z={back + 0.6} w={cw - 0.06} d={0.75} y0={1.55} y1={2.85} m={im.upholstery} r={0.25} rx={-0.12} />);
      }
      push(<Soft z={back + 0.28} w={w} d={0.56} y0={0.35} y1={2.45} m={im.upholstery} r={0.2} />);
      [-1, 1].forEach((s) => push(<Soft x={s * (w / 2 - 0.3)} z={0.1} w={0.6} d={d - 0.2} y0={0.35} y1={2.05} m={im.upholstery} r={0.22} />));
      push(<Legs w={w} d={d - 0.2} h={0.35} m={im.brass} inset={0.4} r={0.06} />);
      if (sofa) {
        push(<Soft x={-w / 2 + 1.25} z={back + 1.1} w={1.35} d={0.42} y0={1.65} y1={2.95} m={im.terracotta} r={0.18} rx={-0.22} ry={0.25} />);
        push(<Soft x={w / 2 - 1.25} z={back + 1.1} w={1.35} d={0.42} y0={1.65} y1={2.95} m={im.sage} r={0.18} rx={-0.22} ry={-0.25} />);
        if (solid) push(<Art z={wall} w={Math.min(5.5, w * 0.72)} h={2.6} y={4.3} im={im} seed={seed} />);
        // A side table and an arc floor lamp.
        push(<Cyl x={w / 2 + 1} z={back + 0.9} r0={0.65} y0={1.75} y1={1.85} m={im.marble} />);
        push(<Cyl x={w / 2 + 1} z={back + 0.9} r0={0.22} r1={0.08} y0={0} y1={1.75} m={im.brass} />);
        push(<Cyl x={-w / 2 - 0.9} z={back + 0.6} r0={0.35} y0={0} y1={0.08} m={im.blackMetal} />);
        push(<Cyl x={-w / 2 - 0.9} z={back + 0.6} r0={0.04} y0={0} y1={5.8} m={im.brass} />);
        push(<Cyl x={-w / 2 - 0.9} z={back + 0.6} r0={0.55} r1={0.3} y0={5.3} y1={6} m={mats.shade} />);
      }
      break;
    }
    case "coffee":
      push(<Cyl x={-0.55} r0={1.05} y0={1.12} y1={1.28} m={im.marble} seg={40} />);
      push(<Cyl x={-0.55} r0={0.55} r1={0.4} y0={0} y1={1.12} m={im.brass} seg={24} />);
      push(<Cyl x={0.95} z={0.2} r0={0.7} y0={0.85} y1={0.98} m={im.walnut} seg={32} />);
      push(<Cyl x={0.95} z={0.2} r0={0.35} y0={0} y1={0.85} m={im.blackMetal} seg={16} />);
      push(<Box x={-0.75} z={0.1} w={0.9} d={0.65} y0={1.28} y1={1.42} m={im.books[0]!} />);
      push(<Box x={-0.75} z={0.1} w={0.8} d={0.58} y0={1.42} y1={1.52} m={im.books[5]!} />);
      push(<Cyl x={-0.2} z={-0.25} r0={0.25} r1={0.32} y0={1.28} y1={1.48} m={im.ceramic} />);
      break;
    case "rug":
      push(<Box w={w} d={d} y0={0.005} y1={0.035} m={im.rug} />);
      break;
    case "tv": {
      // Full-height fluted media wall, floating console with an LED reveal.
      const pw = Math.min(w + 3, 10);
      if (solid) {
        push(<Box z={wall + 0.06} w={pw} d={0.1} y0={0} y1={8.6} m={im.walnut} />);
        for (let x = -pw / 2 + 0.16; x < pw / 2 - 0.1; x += 0.3) push(<Box x={x} z={wall + 0.16} w={0.18} d={0.1} y0={0} y1={8.6} m={im.fluted} />);
      }
      const sz = solid ? wall + 0.3 : -0.2;
      if (!solid) push(<Box z={sz} w={0.5} d={0.3} y0={1.75} y1={3.0} m={im.blackMetal} />);
      push(<Box z={-0.05} w={w} d={d - 0.1} y0={0.75} y1={1.75} m={mats.cabinets} />);
      push(<Box z={-0.05} w={w - 0.2} d={d - 0.3} y0={0.7} y1={0.75} m={im.led} />);
      [-1, 0, 1].forEach((k) => push(<Box x={(k * w) / 3.2} z={d / 2 - 0.13} w={0.03} d={0.02} y0={0.82} y1={1.68} m={im.frame} />));
      push(<Box z={sz} w={w * 0.78 + 0.1} d={0.12} y0={2.95} y1={5.75} m={im.blackMetal} />);
      push(<Box z={sz + 0.07} w={w * 0.78} d={0.02} y0={3} y1={5.7} m={im.screen} />);
      push(<Cyl x={-w / 2 + 0.6} r0={0.28} r1={0.16} y0={1.75} y1={2.9} m={im.ceramic} />);
      push(<Books x={w / 2 - 0.9} z={0} w={1.2} y={1.75} im={im} seed={seed} />);
      break;
    }
    case "dining": {
      push(<Soft w={w} d={d} y0={2.32} y1={2.5} m={im.marble} r={0.06} />);
      [-1, 1].forEach((s) => {
        push(<Cyl x={s * (w / 3.2)} r0={0.42} r1={0.3} y0={0} y1={2.32} m={im.walnut} seg={20} />);
        push(<Cyl x={s * (w / 3.2)} r0={0.75} y0={0} y1={0.08} m={im.walnut} seg={24} />);
      });
      const n = Math.max(2, Math.floor(w / 2));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        [-1, 1].forEach((s) => {
          const z = s * (d / 2 + 0.75);
          push(<Soft x={x} z={z} w={1.45} d={1.4} y0={1.42} y1={1.68} m={im.boucle} r={0.1} />);
          push(<Soft x={x} z={z + s * 0.62} w={1.45} d={0.22} y0={1.6} y1={3.05} m={im.boucle} r={0.1} rx={s * 0.08} />);
          [-1, 1].forEach((lx) => [-1, 1].forEach((lz) => push(<Cyl x={x + lx * 0.58} z={z + lz * 0.55} r0={0.04} y0={0} y1={1.42} m={im.blackMetal} seg={8} />)));
        });
      }
      push(<Cyl r0={0.32} r1={0.22} y0={2.5} y1={3.4} m={im.ceramic} />);
      push(<Cyl x={1.2} r0={0.55} r1={0.4} y0={2.5} y1={2.72} m={im.walnut} />);
      break;
    }
    case "counter": {
      push(<Box w={w - 0.2} d={d - 0.2} y0={0} y1={0.35} m={im.blackMetal} />);
      push(<Box w={w} d={d} y0={0.35} y1={2.8} m={mats.cabinets} />);
      for (let x = -w / 2 + 2; x < w / 2 - 0.2; x += 2) push(<Box x={x} z={d / 2 + 0.005} w={0.03} d={0.02} y0={0.4} y1={2.75} m={im.frame} />);
      push(<Box z={d / 2 + 0.005} w={w - 0.1} d={0.02} y0={2.05} y1={2.08} m={im.frame} />);
      for (let x = -w / 2 + 1; x < w / 2; x += 2) push(<Box x={x} z={d / 2 + 0.06} w={0.9} d={0.06} y0={2.2} y1={2.26} m={im.brass} />);
      push(<Soft z={0.05} w={w + 0.1} d={d + 0.1} y0={2.8} y1={2.96} m={im.marble} r={0.03} />);
      push(<Box z={back + 0.04} w={w} d={0.08} y0={2.96} y1={5.1} m={im.marble} />);
      // Uppers either side of a chimney hood over the hob.
      const hob = w / 5;
      push(<Box x={hob} z={0.05} w={2} d={1.4} y0={2.96} y1={2.99} m={im.screen} />);
      [-0.45, 0.45].forEach((dx) => [-0.3, 0.3].forEach((dz) => push(<Cyl x={hob + dx} z={0.05 + dz} r0={0.2} y0={2.99} y1={3.02} m={im.blackMetal} seg={16} />)));
      push(<Box x={hob} z={back + 0.85} w={2.6} d={1.6} y0={6.1} y1={6.5} m={im.blackMetal} />);
      push(<Box x={hob} z={back + 0.5} w={1.1} d={0.9} y0={6.5} y1={9.2} m={im.blackMetal} />);
      const uppers: Array<[number, number]> = [
        [-w / 2, hob - 1.4],
        [hob + 1.4, w / 2],
      ];
      uppers.forEach(([a, b]) => {
        if (b - a < 0.8) return;
        push(<Box x={(a + b) / 2} z={back + 0.65} w={b - a} d={1.2} y0={5.3} y1={7.7} m={mats.cabinets} />);
        push(<Box x={(a + b) / 2} z={back + 1.2} w={b - a - 0.1} d={0.05} y0={5.25} y1={5.3} m={im.led} />);
        for (let x = a + 1.5; x < b - 0.2; x += 1.5) push(<Box x={x} z={back + 1.26} w={0.03} d={0.02} y0={5.35} y1={7.65} m={im.frame} />);
      });
      // Undermount sink with an arched tap.
      push(<Box x={-w / 4} z={0.1} w={2} d={1.2} y0={2.9} y1={2.97} m={im.screen} />);
      push(<Cyl x={-w / 4} z={back + 0.35} r0={0.07} y0={2.96} y1={4.2} m={im.brass} seg={12} />);
      push(<Box x={-w / 4} z={back + 0.65} w={0.1} d={0.62} y0={4.1} y1={4.2} m={im.brass} />);
      push(<Cyl x={-w / 4 - 1.4} z={back + 0.45} r0={0.35} r1={0.3} y0={2.96} y1={3.3} m={im.walnut} />);
      push(<PottedHerb x={w / 2 - 0.7} z={back + 0.5} y={2.96} im={im} />);
      break;
    }
    case "island": {
      push(<Box w={w} d={d} y0={0.3} y1={2.8} m={im.walnut} />);
      for (let x = -w / 2 + 0.25; x < w / 2; x += 0.3) push(<Box x={x} z={d / 2 + 0.03} w={0.16} d={0.06} y0={0.35} y1={2.75} m={im.fluted} />);
      push(<Soft w={w + 0.6} d={d + 0.3} y0={2.8} y1={2.96} m={im.marble} r={0.03} />);
      [-1, 1].forEach((s) => push(<Box x={s * (w / 2 + 0.22)} w={0.16} d={d + 0.3} y0={0} y1={2.8} m={im.marble} />));
      [-1.6, 0, 1.6].forEach((x) => {
        push(<Cyl x={x} z={d / 2 + 1.15} r0={0.6} y0={2.3} y1={2.48} m={im.boucle} seg={24} />);
        push(<Cyl x={x} z={d / 2 + 1.15} r0={0.06} y0={0} y1={2.3} m={im.brass} seg={10} />);
        push(<Cyl x={x} z={d / 2 + 1.15} r0={0.42} y0={0} y1={0.06} m={im.brass} seg={20} />);
      });
      push(<Cyl x={0.8} r0={0.55} r1={0.35} y0={2.96} y1={3.2} m={im.ceramic} />);
      break;
    }
    case "wardrobe": {
      push(<Box w={w} d={d} y0={0} y1={8.2} m={mats.cabinets} />);
      push(<Box z={d / 2 + 0.005} w={w - 0.05} d={0.02} y0={6.9} y1={6.93} m={im.frame} />);
      const doors = Math.max(2, Math.round(w / 2));
      for (let k = 1; k < doors; k++) push(<Box x={-w / 2 + (k * w) / doors} z={d / 2 + 0.005} w={0.03} d={0.02} y0={0.1} y1={8.1} m={im.frame} />);
      for (let k = 0; k < doors; k++) {
        const x = -w / 2 + (k + (k % 2 ? 0.12 : 0.88)) * (w / doors);
        push(<Box x={x} z={d / 2 + 0.06} w={0.06} d={0.08} y0={3} y1={5.2} m={im.brass} />);
      }
      break;
    }
    case "desk":
      push(<Soft w={w} d={d} y0={2.36} y1={2.5} m={im.oak} r={0.04} />);
      [-1, 1].forEach((s) => {
        push(<Box x={s * (w / 2 - 0.25)} z={-d / 2 + 0.25} w={0.08} d={0.08} y0={0} y1={2.36} m={im.brass} />);
        push(<Box x={s * (w / 2 - 0.25)} z={d / 2 - 0.25} w={0.08} d={0.08} y0={0} y1={2.36} m={im.brass} />);
      });
      push(<Box z={back + 0.5} w={1.9} d={0.08} y0={3.1} y1={4.25} m={im.screen} />);
      push(<Box z={back + 0.6} w={0.1} d={0.1} y0={2.5} y1={3.1} m={im.blackMetal} />);
      push(<Cyl x={w / 2 - 0.5} z={back + 0.45} r0={0.04} y0={2.5} y1={3.8} m={im.brass} seg={8} />);
      push(<Cyl x={w / 2 - 0.5} z={back + 0.45} r0={0.35} r1={0.12} y0={3.6} y1={4.0} m={im.blackMetal} />);
      push(<Soft z={d / 2 + 0.85} w={1.7} d={1.6} y0={1.45} y1={1.75} m={im.upholstery} r={0.15} />);
      push(<Soft z={d / 2 + 1.55} w={1.7} d={0.3} y0={1.7} y1={3.3} m={im.upholstery} r={0.14} />);
      push(<Cyl z={d / 2 + 0.85} r0={0.05} y0={0.2} y1={1.45} m={im.blackMetal} seg={10} />);
      push(<Cyl z={d / 2 + 0.85} r0={0.75} y0={0.12} y1={0.2} m={im.blackMetal} seg={5} />);
      if (solid) push(<Art z={wall} w={2.6} h={1.8} y={4.6} im={im} seed={seed + 1} />);
      break;
    case "shelf":
      push(<Box z={back + 0.05} w={w} d={0.1} y0={0} y1={7.4} m={im.walnut} />);
      [-1, 1].forEach((s) => push(<Box x={s * (w / 2 - 0.05)} w={0.1} d={d} y0={0} y1={7.4} m={im.walnut} />));
      [0.1, 1.9, 3.6, 5.3, 7.1].forEach((y, i) => {
        push(<Box w={w} d={d} y0={y} y1={y + 0.1} m={im.walnut} />);
        if (i < 4) push(<Books x={i % 2 ? -0.4 : 0.3} z={0.1} w={w - 1.4} y={y + 0.1} im={im} seed={seed + i} />);
      });
      push(<Cyl x={w / 2 - 0.55} r0={0.22} r1={0.15} y0={3.7} y1={4.5} m={im.ceramic} />);
      push(<Box x={-w / 2 + 0.6} y0={2.0} y1={2.1} w={0.7} d={0.6} m={im.brass} />);
      break;
    case "vanity":
      push(<Soft z={0} w={w} d={d} y0={0.9} y1={2.6} m={im.walnut} r={0.05} />);
      push(<Soft w={w + 0.05} d={d + 0.05} y0={2.6} y1={2.75} m={im.marble} r={0.03} />);
      push(<Cyl r0={0.5} r1={0.62} y0={2.75} y1={3.25} m={im.porcelain} seg={32} />);
      push(<Cyl z={back + 0.25} r0={0.05} y0={2.75} y1={3.9} m={im.brass} seg={10} />);
      push(<Box z={back + 0.45} w={0.08} d={0.45} y0={3.8} y1={3.88} m={im.brass} />);
      push(<Box z={wall + 0.04} w={w - 0.1} d={0.05} y0={3.95} y1={6.55} m={im.led} />);
      push(<Box z={wall + 0.1} w={w - 0.4} d={0.05} y0={4.1} y1={6.4} m={im.mirror} />);
      break;
    case "wc":
      push(<Box z={back + 0.2} w={w + 0.6} d={0.4} y0={0} y1={3.6} m={mats.tile} />);
      push(<Soft z={0.25} w={w - 0.15} d={d - 0.7} y0={0.95} y1={1.45} m={im.porcelain} r={0.24} />);
      push(<Box z={back + 0.42} w={0.7} d={0.04} y0={2.9} y1={3.2} m={im.brass} />);
      break;
    case "plant":
      push(<PottedPalm pot={im.ceramic} />);
      break;
    default:
      return null;
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
      <group position={[0, 0, shift]}>{parts}</group>
      {selected ? (
        <mesh position={[0, spec.h / 2 + 0.05, 0]}>
          <boxGeometry args={[w + 0.3, spec.h + 0.1, d + 0.3]} />
          <meshBasicMaterial color="#4e6151" wireframe />
        </mesh>
      ) : null}
    </group>
  );
}

function PottedHerb({ x, z, y, im }: { x: number; z: number; y: number; im: IM }) {
  return (
    <>
      <Cyl x={x} z={z} r0={0.22} r1={0.28} y0={y} y1={y + 0.45} m={im.ceramic} />
      <mesh position={[x, y + 0.75, z]} castShadow>
        <icosahedronGeometry args={[0.38, 1]} />
        <meshStandardMaterial color="#5f7e45" roughness={0.9} />
      </mesh>
    </>
  );
}


/* ------------------------------------------------------------ ceilings */

const CEILED = new Set(["living", "dining", "bedroom", "master", "family", "study", "foyer", "kitchen"]);

/**
 * A gypsum false ceiling: a perimeter drop with a warm cove line along its
 * inner edge and recessed downlights, leaving the centre raised.
 */
export function RoomCeiling({ room, top, im }: { room: Room; top: number; im: IM }) {
  if (!CEILED.has(room.type) || room.w < 6 || room.d < 6) return null;
  const bw = Math.min(2.2, Math.min(room.w, room.d) * 0.2);
  const x0 = room.x + 0.2;
  const x1 = room.x + room.w - 0.2;
  const y0 = room.y + 0.2;
  const y1 = room.y + room.d - 0.2;
  const z0 = top - 0.75;
  const z1 = top - 0.05;
  const bands: Array<[number, number, number, number]> = [
    [x0, x1, y0, y0 + bw],
    [x0, x1, y1 - bw, y1],
    [x0, x0 + bw, y0 + bw, y1 - bw],
    [x1 - bw, x1, y0 + bw, y1 - bw],
  ];
  // Cove: a lit strip just inside the drop's inner edge, tucked up toward the raised centre.
  const cz0 = z0 + 0.12;
  const cz1 = z0 + 0.2;
  const coves: Array<[number, number, number, number]> = [
    [x0 + bw, x1 - bw, y0 + bw, y0 + bw + 0.06],
    [x0 + bw, x1 - bw, y1 - bw - 0.06, y1 - bw],
    [x0 + bw, x0 + bw + 0.06, y0 + bw, y1 - bw],
    [x1 - bw - 0.06, x1 - bw, y0 + bw, y1 - bw],
  ];
  const cans: Array<[number, number]> = [];
  const step = 4;
  const along = (a: number, b: number, fixed: number, horiz: boolean) => {
    const n = Math.max(1, Math.round((b - a) / step));
    for (let k = 0; k < n; k++) {
      const t = a + ((k + 0.5) * (b - a)) / n;
      cans.push(horiz ? [t, fixed] : [fixed, t]);
    }
  };
  along(x0 + bw, x1 - bw, y0 + bw / 2, true);
  along(x0 + bw, x1 - bw, y1 - bw / 2, true);
  return (
    <>
      {bands.map(([a, b, c, d2], i) => (
        <Block key={`b${i}`} x0={a} x1={b} y0={c} y1={d2} z0={z0} z1={z1} mat={im.ceiling} cast={false} />
      ))}
      {coves.map(([a, b, c, d2], i) => (
        <Block key={`c${i}`} x0={a} x1={b} y0={c} y1={d2} z0={cz0} z1={cz1} mat={im.cove} cast={false} receive={false} />
      ))}
      {cans.map(([x, y], i) => (
        <Can key={`d${i}`} x={x} y={y} z={z0} im={im} />
      ))}
    </>
  );
}

function Can({ x, y, z, im }: { x: number; y: number; z: number; im: IM }) {
  const f = React.useContext(FrameCtx);
  return (
    <mesh position={toWorld(f, x, y, z - 0.01)} material={im.can}>
      <cylinderGeometry args={[0.18, 0.18, 0.04, 16]} />
    </mesh>
  );
}
