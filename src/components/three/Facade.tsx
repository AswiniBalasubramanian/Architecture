"use client";

// The street elevation, dressed the way contemporary Indian residences are
// rendered: a white projecting frame around the upper floors, glass-railed
// balconies with timber soffits and recessed downlights, a vertical timber
// screen, a stone-clad panel with wall washers, and planters. At night the
// downlights throw warm scallops down the walls.

import * as React from "react";
import * as THREE from "three";
import { openingsOf } from "@/lib/openings";
import type { Brief, Design } from "@/lib/types";
import { Block, FrameCtx, PLINTH, SLAB, toWorld, type MaterialsSet } from "./HouseModel";
import { surfaceMaterial } from "./textures";

let scallopTex: THREE.Texture | null = null;
let glowTex: THREE.Texture | null = null;

/** A warm cone of light on a wall, brightest just under the fitting. */
export function scallopTexture() {
  if (scallopTex || typeof document === "undefined") return scallopTex;
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 256;
  const g = c.getContext("2d")!;
  const img = g.createImageData(128, 256);
  for (let y = 0; y < 256; y++)
    for (let x = 0; x < 128; x++) {
      const v = y / 255;
      const u = (x - 63.5) / 64;
      // Parabolic spread with a soft hot spot near the top.
      const spread = 0.18 + v * 0.95;
      const edge = Math.max(0, 1 - Math.abs(u) / spread);
      const fall = Math.pow(1 - v, 1.6);
      const hot = Math.exp(-((v - 0.06) ** 2) / 0.004 - (u * u) / 0.01) * 0.6;
      const a = Math.min(1, Math.pow(edge, 1.4) * fall * 0.85 + hot);
      const i = (y * 128 + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 214;
      img.data[i + 2] = 160;
      img.data[i + 3] = Math.round(a * 255);
    }
  g.putImageData(img, 0, 0);
  scallopTex = new THREE.CanvasTexture(c);
  scallopTex.colorSpace = THREE.SRGBColorSpace;
  return scallopTex;
}

/** A round soft glow for lamp heads and pools of light. */
export function glowTexture() {
  if (glowTex || typeof document === "undefined") return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,226,180,1)");
  grad.addColorStop(0.18, "rgba(255,200,140,0.55)");
  grad.addColorStop(0.5, "rgba(255,170,100,0.14)");
  grad.addColorStop(1, "rgba(255,160,90,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

function useFacadeMaterials(night: boolean) {
  return React.useMemo(
    () => ({
      band: new THREE.MeshStandardMaterial({ color: "#f5f3ee", roughness: 0.55 }),
      soffit: surfaceMaterial("wood", "#9b6a42", 4, 4, { roughness: 0.62 }),
      slat: surfaceMaterial("wood", "#a8744a", 1, 8, { roughness: 0.6 }),
      backing: new THREE.MeshStandardMaterial({ color: "#3a3734", roughness: 0.8 }),
      stone: surfaceMaterial("stone", "#8f7c68", 6, 8, { roughness: 0.82 }),
      railGlass: new THREE.MeshPhysicalMaterial({ color: "#d9ecec", roughness: 0.04, metalness: 0, transmission: 0, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide }),
      steel: new THREE.MeshStandardMaterial({ color: "#c9ccc8", roughness: 0.22, metalness: 0.95 }),
      planter: new THREE.MeshStandardMaterial({ color: "#3b3c3a", roughness: 0.7 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#4f7a3a", roughness: 0.9, flatShading: true }),
      leafLight: new THREE.MeshStandardMaterial({ color: "#7aa24c", roughness: 0.9, flatShading: true }),
      downlight: night ? new THREE.MeshStandardMaterial({ color: "#fff4e0", emissive: "#ffd39a", emissiveIntensity: 6 }) : new THREE.MeshStandardMaterial({ color: "#e9e4da", roughness: 0.3, metalness: 0.4 }),
      scallop: new THREE.MeshBasicMaterial({ map: scallopTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#ffb877").multiplyScalar(1.6), toneMapped: true }),
    }),
    [night],
  );
}

type FM = ReturnType<typeof useFacadeMaterials>;

/** A spot light aimed at a world point (its target is kept in sync outside the scene graph). */
export function Spot({ position, target, ...rest }: { position: THREE.Vector3; target: [number, number, number] } & Omit<React.ComponentProps<"spotLight">, "position" | "target">) {
  const ref = React.useRef<THREE.SpotLight>(null);
  React.useLayoutEffect(() => {
    const l = ref.current;
    if (!l) return;
    l.target.position.set(...target);
    l.target.updateMatrixWorld();
  }, [target[0], target[1], target[2]]);
  return <spotLight ref={ref} position={position} {...rest} />;
}

/** Free stretches of a front wall between openings, within [a, b]. */
function freeSpans(ops: Array<{ a: number; b: number }>, a: number, b: number, margin = 0.45) {
  const out: Array<[number, number]> = [];
  let from = a;
  for (const o of [...ops].sort((p, q) => p.a - q.a)) {
    if (o.b + margin <= from) continue;
    if (o.a - margin > from) out.push([from, Math.min(b, o.a - margin)]);
    from = Math.max(from, o.b + margin);
    if (from >= b) break;
  }
  if (from < b) out.push([from, b]);
  return out.filter(([p, q]) => q - p > 0.2).sort((p, q) => q[1] - q[0] - (p[1] - p[0]));
}

function Bush({ x, y, z, s, fm, seed }: { x: number; y: number; z: number; s: number; fm: FM; seed: number }) {
  const f = React.useContext(FrameCtx);
  const blobs = React.useMemo(() => {
    let r = seed * 9301 + 49297;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
    return Array.from({ length: 5 }, () => [(rnd() - 0.5) * s * 0.9, (rnd() - 0.5) * s * 0.6, rnd() * s * 0.5, s * (0.45 + rnd() * 0.3), rnd() > 0.5] as const);
  }, [s, seed]);
  return (
    <>
      {blobs.map(([dx, dy, dz, r, light], i) => (
        <mesh key={i} position={toWorld(f, x + dx, y + dy, z + dz + r * 0.7)} material={light ? fm.leafLight : fm.leaf} castShadow>
          <icosahedronGeometry args={[r, 1]} />
        </mesh>
      ))}
    </>
  );
}

function Planter({ x, y, z, w, d, fm, seed }: { x: number; y: number; z: number; w: number; d: number; fm: FM; seed: number }) {
  return (
    <>
      <Block x0={x - w / 2} x1={x + w / 2} y0={y - d / 2} y1={y + d / 2} z0={z} z1={z + 1.4} mat={fm.planter} />
      <Bush x={x} y={y} z={z + 1.2} s={Math.min(w, d) * 0.9} fm={fm} seed={seed} />
    </>
  );
}

/** A recessed downlight in a soffit, with its scallop on the wall behind at night. */
function Downlight({ x, y, z, wallY, night, fm, wash = 6 }: { x: number; y: number; z: number; wallY?: number; night: boolean; fm: FM; wash?: number }) {
  const f = React.useContext(FrameCtx);
  const p = toWorld(f, x, y, z - 0.03);
  return (
    <>
      <mesh position={p} material={fm.downlight}>
        <cylinderGeometry args={[0.2, 0.2, 0.06, 16]} />
      </mesh>
      {night && wallY !== undefined ? (
        <mesh position={toWorld(f, x, wallY - 0.03, z - wash / 2 - 0.1)} material={fm.scallop} renderOrder={2}>
          <planeGeometry args={[wash * 0.55, wash]} />
        </mesh>
      ) : null}
    </>
  );
}

export function Facade({ brief, design, mats, night, maxFloor, cutaway }: { brief: Brief; design: Design; mats: MaterialsSet; night: boolean; maxFloor: number; cutaway: boolean }) {
  const fp = design.footprint;
  const f = React.useContext(FrameCtx);
  const fm = useFacadeMaterials(night);
  const FH = design.floorHeight;
  const floors = brief.floors;
  const level = (k: number) => PLINTH + k * FH;
  const roofZ = level(floors);
  const flat = design.roof === "flat";
  const topShown = !cutaway && maxFloor >= floors - 1;
  const parts: React.ReactNode[] = [];
  const add = (node: React.ReactNode) => parts.push(<React.Fragment key={parts.length}>{node}</React.Fragment>);

  // The projecting frame and balconies, over the right-hand part of the front.
  const D = 3.6;
  const xa = fp.x + Math.max(6, fp.w * 0.4);
  const xb = fp.x + fp.w - 1.4;
  const framed = floors > 1 && xb - xa > 7;
  if (framed) {
    for (let k = 1; k < floors && k <= maxFloor; k++) {
      const z = level(k);
      // Slab, timber soffit with downlights, glass rail, planters.
      add(<Block x0={xa} x1={xb} y0={fp.y - D} y1={fp.y} z0={z - SLAB} z1={z} mat={fm.band} />);
      add(<Block x0={xa + 0.12} x1={xb - 0.12} y0={fp.y - D + 0.12} y1={fp.y} z0={z - SLAB - 0.1} z1={z - SLAB} mat={fm.soffit} cast={false} />);
      const n = Math.max(2, Math.floor((xb - xa) / 4.2));
      for (let i = 0; i < n; i++) add(<Downlight x={xa + ((i + 0.5) * (xb - xa)) / n} y={fp.y - D * 0.42} z={z - SLAB - 0.1} wallY={fp.y} night={night} fm={fm} wash={Math.min(6.5, FH - 3)} />);
      add(<Block x0={xa + 0.1} x1={xb - 0.1} y0={fp.y - D + 0.2} y1={fp.y - D + 0.28} z0={z} z1={z + 3.4} mat={fm.railGlass} cast={false} />);
      add(<Block x0={xa + 0.05} x1={xb - 0.05} y0={fp.y - D + 0.16} y1={fp.y - D + 0.32} z0={z + 3.4} z1={z + 3.52} mat={fm.steel} />);
      add(<Block x0={xa + 0.05} x1={xb - 0.05} y0={fp.y - D + 0.14} y1={fp.y - D + 0.34} z0={z} z1={z + 0.18} mat={fm.steel} />);
      add(<Planter x={xa + 1} y={fp.y - D + 1.1} z={z} w={1.4} d={1.2} fm={fm} seed={k * 7 + 1} />);
      add(<Planter x={xb - 1} y={fp.y - D + 1.1} z={z} w={1.4} d={1.2} fm={fm} seed={k * 7 + 3} />);
      // A trailing hedge line along the slab edge, like a planted parapet.
      add(<Block x0={xa + 1.9} x1={xb - 1.9} y0={fp.y - D + 0.35} y1={fp.y - D + 0.9} z0={z} z1={z + 0.9} mat={fm.planter} />);
      for (let x = xa + 2.3; x < xb - 2.2; x += 1.6) add(<Bush x={x} y={fp.y - D + 0.62} z={z + 0.7} s={0.7} fm={fm} seed={Math.round(x * 13 + k)} />);
    }
    if (topShown) {
      // Fins either side, and a deep top band whose soffit is the top balcony's ceiling.
      const top = flat ? roofZ + 3.25 : roofZ - 0.2;
      const z0 = level(1) - SLAB - 0.6;
      add(<Block x0={xa - 1.1} x1={xa} y0={fp.y - D - 0.4} y1={fp.y + 0.2} z0={z0} z1={top} mat={fm.band} />);
      add(<Block x0={xb} x1={xb + 1.1} y0={fp.y - D - 0.4} y1={fp.y + 0.2} z0={z0} z1={top} mat={fm.band} />);
      const bandZ = roofZ - SLAB - 0.7;
      add(<Block x0={xa - 1.1} x1={xb + 1.1} y0={fp.y - D - 0.4} y1={fp.y} z0={bandZ} z1={top} mat={fm.band} />);
      add(<Block x0={xa + 0.1} x1={xb - 0.1} y0={fp.y - D - 0.3} y1={fp.y} z0={bandZ - 0.1} z1={bandZ} mat={fm.soffit} cast={false} />);
      const n = Math.max(2, Math.floor((xb - xa) / 4.2));
      for (let i = 0; i < n; i++) add(<Downlight x={xa + ((i + 0.5) * (xb - xa)) / n} y={fp.y - D * 0.45} z={bandZ - 0.1} wallY={fp.y} night={night} fm={fm} wash={Math.min(6.5, FH - 3)} />);
      // A shadow-gap reveal line along the band.
      add(<Block x0={xa - 1.12} x1={xb + 1.12} y0={fp.y - D - 0.42} y1={fp.y - D - 0.3} z0={bandZ + 0.9} z1={bandZ + 1.05} mat={fm.backing} cast={false} />);
    }
  }

  // Vertical timber screen on a solid stretch of each upper floor (or the ground floor of a bungalow).
  const screenFloors = floors > 1 ? Array.from({ length: floors - 1 }, (_, i) => i + 1) : [0];
  for (const k of screenFloors) {
    if (k > maxFloor) continue;
    const ops = openingsOf(design, k).filter((o) => o.side === "front");
    const span = freeSpans(ops, fp.x + 0.6, (framed ? xa - 1.3 : fp.x + fp.w - 0.6))[0];
    if (!span || span[1] - span[0] < 2.6) continue;
    const z0 = level(k) + 0.15;
    const z1 = level(k + 1) - SLAB - 0.15;
    add(<Block x0={span[0]} x1={span[1]} y0={fp.y - 0.12} y1={fp.y} z0={z0} z1={z1} mat={fm.backing} cast={false} />);
    for (let x = span[0] + 0.18; x < span[1] - 0.2; x += 0.42) add(<Block x0={x} x1={x + 0.24} y0={fp.y - 0.42} y1={fp.y - 0.12} z0={z0} z1={z1} mat={fm.slat} />);
    add(<Block x0={span[0] - 0.1} x1={span[1] + 0.1} y0={fp.y - 0.5} y1={fp.y} z0={z1} z1={z1 + 0.18} mat={fm.steel} />);
    if (night) add(<Downlight x={(span[0] + span[1]) / 2} y={fp.y - 0.3} z={z1} wallY={fp.y - 0.44} night={night} fm={fm} wash={z1 - z0} />);
  }

  // A stone-clad panel on the ground floor front, with two wall washers.
  {
    const ops = openingsOf(design, 0).filter((o) => o.side === "front");
    const span = freeSpans(ops, fp.x + 0.6, fp.x + fp.w - 0.6)[0];
    if (span && span[1] - span[0] > 3) {
      const z0 = PLINTH + 0.6;
      const z1 = level(1) - SLAB - 0.1;
      add(<Block x0={span[0]} x1={span[1]} y0={fp.y - 0.16} y1={fp.y} z0={z0} z1={z1} mat={fm.stone} />);
      const lights = span[1] - span[0] > 7 ? [0.25, 0.75] : [0.5];
      for (const t of lights) {
        const x = span[0] + (span[1] - span[0]) * t;
        add(<Block x0={x - 0.25} x1={x + 0.25} y0={fp.y - 0.55} y1={fp.y - 0.16} z0={z1 - 0.4} z1={z1 - 0.15} mat={mats.dark} />);
        if (night) add(<Downlight x={x} y={fp.y - 0.4} z={z1 - 0.4} wallY={fp.y - 0.18} night={night} fm={fm} wash={z1 - z0 - 0.4} />);
      }
    }
  }

  // Entrance canopy: downlights, and a pool of light on the steps at night.
  const door = openingsOf(design, 0).find((o) => o.kind === "door" && o.side === "front");
  if (door) {
    const c = (door.a + door.b) / 2;
    [-2, 2].forEach((dx) => add(<Downlight x={c + dx} y={fp.y - 2} z={PLINTH + 8.4} night={night} fm={fm} />));
    add(<Planter x={c - 4.6} y={fp.y - 2.6} z={0} w={1.6} d={1.6} fm={fm} seed={41} />);
    add(<Planter x={c + 4.6} y={fp.y - 2.6} z={0} w={1.6} d={1.6} fm={fm} seed={43} />);
    if (night) {
      const p = toWorld(f, c, fp.y - 2, PLINTH + 8.2);
      add(<Spot position={p} target={[p.x, 0, p.z]} angle={0.9} penumbra={0.8} intensity={60} distance={18} decay={1.5} color="#ffcf96" />);
    }
  }
  return <>{parts}</>;
}
