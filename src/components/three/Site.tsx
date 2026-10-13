"use client";

import * as React from "react";
import * as THREE from "three";
import { Environment, Lightformer, Sky, Stars } from "@react-three/drei";
import type { Brief, Design } from "@/lib/types";
import { toWorld } from "./HouseModel";
import { Spot, glowTexture } from "./Facade";
import { ArecaClump, Palm } from "./Palms";
import { materialFor, surfaceMaterial } from "./textures";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Frame = { cx: number; cy: number };

let foliage: THREE.Texture | null = null;
/** Dense small leaves in mixed greens, with dark gaps between them. */
function foliageTexture() {
  if (foliage || typeof document === "undefined") return foliage;
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3d5230";
  g.fillRect(0, 0, 256, 256);
  const r = rng(77);
  for (let i = 0; i < 2600; i++) {
    const l = 0.55 + r() * 0.55;
    g.fillStyle = `rgb(${Math.round(110 * l)},${Math.round(150 * l)},${Math.round(84 * l)})`;
    g.save();
    g.translate(r() * 256, r() * 256);
    g.rotate(r() * Math.PI * 2);
    g.beginPath();
    g.ellipse(0, 0, 4.5 + r() * 3, 1.8 + r() * 1.4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  foliage = new THREE.CanvasTexture(c);
  foliage.colorSpace = THREE.SRGBColorSpace;
  foliage.wrapS = foliage.wrapT = THREE.RepeatWrapping;
  foliage.repeat.set(2, 2);
  return foliage;
}

const clumps = new Map<number, THREE.BufferGeometry>();
/** A lumpy leaf mass: a sphere pushed in and out, so its outline is irregular. */
function clumpGeometry(seed: number) {
  const key = seed % 6;
  const hit = clumps.get(key);
  if (hit) return hit;
  const g = new THREE.IcosahedronGeometry(1, 3);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  const k = key * 1.7 + 0.3;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const n = Math.sin(v.x * 5.1 + k) * Math.sin(v.y * 4.3 - k) * Math.sin(v.z * 5.7 + k * 2);
    const m = 0.86 + n * 0.16 + Math.sin(v.x * 13 + v.z * 11 + k) * 0.04;
    p.setXYZ(i, v.x * m, v.y * m * 0.86, v.z * m);
  }
  g.computeVertexNormals();
  clumps.set(key, g);
  return g;
}

/** Many copies of one mesh, placed from a list of [x, y, z, scale, rotation] in plan feet. */
function Instances({ frame, geometry, material, items, cast = true }: { frame: Frame; geometry: THREE.BufferGeometry; material: THREE.Material; items: Array<[number, number, number, number, number, number?]>; cast?: boolean }) {
  const ref = React.useRef<THREE.InstancedMesh>(null);
  React.useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    items.forEach(([x, y, z, s, rot, sy], i) => {
      q.setFromEuler(new THREE.Euler(0, rot, 0));
      m.compose(toWorld(frame, x, y, z), q, new THREE.Vector3(s, sy ?? s, s));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items, frame]);
  return <instancedMesh ref={ref} args={[geometry, material, items.length]} castShadow={cast} receiveShadow />;
}

function Tree({ frame, x, y, s, seed, mats }: { frame: Frame; x: number; y: number; s: number; seed: number; mats: ReturnType<typeof useSiteMaterials> }) {
  const r = rng(seed);
  const p = toWorld(frame, x, y, 0);
  const blobs = Array.from({ length: 16 }, () => ({
    pos: [(r() - 0.5) * 6.5, 6.8 + r() * 4.6, (r() - 0.5) * 6.5] as [number, number, number],
    rad: 1.3 + r() * 1.4,
    m: r() < 0.33 ? mats.leafDark : r() < 0.5 ? mats.leafLight : mats.leaf,
  }));
  const branches = Array.from({ length: 3 }, (_, k) => ({ rot: (k / 3) * Math.PI * 2 + r(), tilt: 0.5 + r() * 0.3 }));
  return (
    <group position={p} scale={s} rotation={[0, r() * Math.PI * 2, 0]}>
      <mesh position={[0, 3, 0]} material={mats.trunk} castShadow>
        <cylinderGeometry args={[0.28, 0.5, 6, 10]} />
      </mesh>
      {branches.map((b, k) => (
        <mesh key={k} position={[Math.cos(b.rot) * 0.9, 6.4, Math.sin(b.rot) * 0.9]} rotation={[Math.sin(b.rot) * b.tilt, 0, -Math.cos(b.rot) * b.tilt]} material={mats.trunk} castShadow>
          <cylinderGeometry args={[0.1, 0.2, 2.6, 6]} />
        </mesh>
      ))}
      {blobs.map((b, k) => (
        <mesh key={k} position={b.pos} material={b.m} geometry={clumpGeometry(k + seed)} scale={b.rad} castShadow receiveShadow />
      ))}
    </group>
  );
}

function useSiteMaterials(design: Design, lit: boolean, name = "") {
  return React.useMemo(
    () => ({
      grass: surfaceMaterial("grass", "#8f9c74", 40, 40),
      lawn: surfaceMaterial("grass", "#7e9b55", 20, 20),
      timber: surfaceMaterial("wood", "#8a5a36", 2, 6, { roughness: 0.6 }),
      cladStone: surfaceMaterial("stone", "#9a8673", 4, 5),
      plaque: new THREE.MeshStandardMaterial({ map: plaqueTexture(name), roughness: 0.4 }),
      bollard: new THREE.MeshStandardMaterial({ color: "#2b2d2c", roughness: 0.5, metalness: 0.5 }),
      glow: new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: "#ffb877" }),
      pool: new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: new THREE.Color("#ffb070").multiplyScalar(0.55) }),
      ground: surfaceMaterial("grass", "#8a9d66", 300, 300),
      paving: surfaceMaterial("paving", "#cdc4b1", 10, 10),
      drive: surfaceMaterial("paving", "#bfb6a3", 8, 8),
      street: surfaceMaterial("asphalt", "#55595a", 120, 20),
      kerb: surfaceMaterial("concrete", "#d3cdc1", 40, 1),
      gravel: surfaceMaterial("gravel", "#bdb4a1", 6, 6),
      wall: materialFor(design.materials.exterior, 20, 4),
      coping: materialFor(design.materials.accent, 20, 1),
      trunk: new THREE.MeshStandardMaterial({ color: "#5d4c3b", roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ map: foliageTexture(), color: "#7f9a62", roughness: 0.9 }),
      leafDark: new THREE.MeshStandardMaterial({ map: foliageTexture(), color: "#5c7a4a", roughness: 0.9 }),
      leafLight: new THREE.MeshStandardMaterial({ map: foliageTexture(), color: "#a2b874", roughness: 0.9 }),
      shrub: new THREE.MeshStandardMaterial({ map: foliageTexture(), color: "#6d8c55", roughness: 0.95 }),
      flower: new THREE.MeshStandardMaterial({ color: "#c98a6b", roughness: 1, flatShading: true }),
      lane: new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.8 }),
      iron: new THREE.MeshStandardMaterial({ color: "#2b2e2c", roughness: 0.45, metalness: 0.7 }),
      lamp: lit ? new THREE.MeshStandardMaterial({ color: "#fff3dc", emissive: "#ffc77d", emissiveIntensity: 3.2 }) : new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.25, transparent: true, opacity: 0.9 }),
    }),
    [design.materials.exterior, design.materials.accent, lit, name],
  );
}

export function Site({ brief, design, lit, night = false }: { brief: Brief; design: Design; lit: boolean; night?: boolean }) {
  const fp = design.footprint;
  const frame = React.useMemo(() => ({ cx: fp.x + fp.w / 2, cy: fp.y + fp.d / 2 }), [fp]);
  const W = brief.plotWidth;
  const D = brief.plotDepth;
  const mats = useSiteMaterials(design, lit, brief.name);
  const parking = design.rooms.find((r) => r.floor === 0 && r.type === "parking" && Math.abs(r.y - fp.y) < 0.01);
  const door = design.rooms.find((r) => r.floor === 0 && (r.type === "foyer" || r.type === "court" || r.type === "living") && Math.abs(r.y - fp.y) < 0.01);
  const gate: [number, number] = parking ? [parking.x + 1, parking.x + parking.w - 1] : door ? [door.x + door.w / 2 - 3, door.x + door.w / 2 + 3] : [fp.x + fp.w / 2 - 3, fp.x + fp.w / 2 + 3];
  const W3 = (x: number, y: number, z: number) => toWorld(frame, x, y, z);
  const box = (key: string, x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, m: THREE.Material, cast = true) => (
    <mesh key={key} position={W3((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)} material={m} castShadow={cast} receiveShadow>
      <boxGeometry args={[Math.abs(x1 - x0), Math.abs(z1 - z0), Math.abs(y1 - y0)]} />
    </mesh>
  );
  const center = W3(W / 2, D / 2, 0);

  // Shrubs: a hedge inside the side and rear walls, and clumps by the house.
  const geos = React.useMemo(() => ({ shrub: clumpGeometry(99), bar: new THREE.BoxGeometry(gate[1] - gate[0] + 1.1, 0.3, 0.14), flower: new THREE.IcosahedronGeometry(0.22, 0), plane: new THREE.PlaneGeometry(1, 1) }), [gate[0], gate[1]]);
  const shrubs = React.useMemo(() => {
    const r = rng(W * 31 + D);
    const out: Array<[number, number, number, number, number, number?]> = [];
    for (let y = 2; y < D - 2; y += 2.3) {
      if (y > fp.y - 1 && y < fp.y + fp.d + 1 && r() < 0.5) continue;
      out.push([1.6, y, 0.9, 1.1 + r() * 0.6, r() * 6, 0.9 + r() * 0.5]);
      out.push([W - 1.6, y, 0.9, 1.1 + r() * 0.6, r() * 6, 0.9 + r() * 0.5]);
    }
    for (let x = 3; x < W - 3; x += 2.4) out.push([x, D - 1.6, 0.9, 1.2 + r() * 0.6, r() * 6, 1 + r() * 0.5]);
    // Front garden clumps, clear of the drive.
    for (let x = 2.5; x < W - 2.5; x += 3.1) if (x < gate[0] - 1.5 || x > gate[1] + 1.5) out.push([x, Math.max(1.8, fp.y * 0.35), 0.7, 0.8 + r() * 0.5, r() * 6, 0.8 + r() * 0.4]);
    return out;
  }, [W, D, fp.y, fp.d, gate]);
  const flowers = React.useMemo(() => {
    const r = rng(W + D * 7);
    return shrubs.filter(() => r() < 0.35).map(([x, y, , s]) => [x + (r() - 0.5) * s, y + (r() - 0.5) * s, 1.4 + s * 0.6, 1, r() * 6] as [number, number, number, number, number]);
  }, [shrubs, W, D]);
  // Gate: two leaves of vertical bars between the piers.
  const bars = React.useMemo(() => {
    const out: Array<[number, number, number, number, number, number?]> = [];
    for (let z = 0.75; z < 4.9; z += 0.42) out.push([(gate[0] + gate[1]) / 2, 0.25, z, 1, 0, 1]);
    return out;
  }, [gate]);
  // Palms in the front garden and the back, areca clumps along the front wall.
  const palms: Array<[number, number, number, number]> = [
    [Math.max(2.5, fp.x * 0.45), Math.max(3, fp.y * 0.5), 24, 5],
    [Math.min(W - 2.5, W - (W - fp.x - fp.w) * 0.45), Math.max(3, fp.y * 0.6), 28, 9],
    [Math.max(3, fp.x * 0.5), fp.y + fp.d + Math.max(3, (D - fp.y - fp.d) * 0.5), 30, 3],
    [-8, D * 0.55, 34, 21],
    [W + 9, D * 0.25, 30, 27],
    [W * 0.7, D + 12, 36, 33],
  ];
  const arecas: Array<[number, number, number]> = [
    [Math.max(2, gate[0] - 4.5), 1.6, 2],
    [Math.min(W - 2, gate[1] + 4.5), 1.6, 4],
    [1.8, D - 2, 6],
    [W - 1.8, D - 2, 8],
  ];
  const bollards = React.useMemo(() => {
    const out: Array<[number, number]> = [];
    const len = fp.y - 1;
    for (let y = 2.5; y < len; y += 6) out.push([gate[0] - 0.9, y], [gate[1] + 0.9, y]);
    return out;
  }, [fp.y, gate]);
  const glowSprite = React.useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#ffc58a", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), []);
  // Street lamps along the far kerb.
  const lamps = [-30, 20, 70].map((x) => x + (W % 10));
  const trees: Array<[number, number, number, number]> = [
    [Math.max(3, fp.x * 0.5), fp.y + fp.d + Math.max(3, (D - fp.y - fp.d) * 0.5), 1.15, 3],
    [Math.min(W - 3, fp.x + fp.w + Math.max(2, (W - fp.x - fp.w) * 0.5)), fp.y + fp.d + Math.max(3, (D - fp.y - fp.d) * 0.4), 0.95, 7],
    [Math.max(3, fp.x * 0.45), Math.max(3, fp.y * 0.45), 0.85, 11],
    [-10, D * 0.3, 1.4, 13],
    [W + 11, D * 0.65, 1.3, 17],
    [W * 0.3, D + 15, 1.5, 19],
    [-14, -30, 1.3, 23],
    [W + 18, -32, 1.2, 29],
  ];

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, -0.03, center.z]} material={mats.ground} receiveShadow>
        <planeGeometry args={[W + 300, D + 300]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[center.x, 0, center.z]} material={mats.lawn} receiveShadow>
        <planeGeometry args={[W, D]} />
      </mesh>
      {/* Neighbouring verges either side of the plot. */}
      {box("vergeL", -60, 0, 0, D + 40, -0.03, 0.02, mats.grass, false)}
      {box("vergeR", W, W + 60, 0, D + 40, -0.03, 0.02, mats.grass, false)}
      {/* Street: asphalt, kerbs both sides, a footpath and lane markings. */}
      {box("street", -140, W + 140, -24, -6, -0.03, 0.04, mats.street, false)}
      {box("kerbN", -140, W + 140, -6, -5.4, -0.03, 0.42, mats.kerb, false)}
      {box("path", -140, W + 140, -5.4, 0, 0, 0.36, mats.paving, false)}
      {box("kerbS", -140, W + 140, -24.6, -24, -0.03, 0.42, mats.kerb, false)}
      {Array.from({ length: 16 }, (_, i) => box(`lane${i}`, -130 + i * 22, -123 + i * 22, -15.3, -14.7, 0.04, 0.07, mats.lane, false))}
      {/* Drive from the gate to the house, gravel apron around it. */}
      {box("drive", gate[0], gate[1], 0, fp.y - 0.4, 0, 0.14, mats.drive, false)}
      {box("crossover", gate[0] - 1, gate[1] + 1, -5.4, 0, 0, 0.38, mats.drive, false)}
      {box("apron", fp.x - 2, fp.x + fp.w + 2, fp.y - 0.4, fp.y + fp.d + 2, 0, 0.1, mats.gravel, false)}
      {/* Compound wall with coping. */}
      {(
        [
          ["wb", 0, W, D - 0.5, D],
          ["wl", 0, 0.5, 0, D],
          ["wr", W - 0.5, W, 0, D],
          ...(gate[0] - 1 > 0.5 ? [["wf1", 0, gate[0] - 1, 0, 0.5]] : []),
          ...(W - gate[1] - 1 > 0.5 ? [["wf2", gate[1] + 1, W, 0, 0.5]] : []),
        ] as Array<[string, number, number, number, number]>
      ).map(([k, x0, x1, y0, y1]) => (
        <React.Fragment key={k}>
          {box(k, x0, x1, y0, y1, 0, k.startsWith("wf") ? 3.2 : 4.6, mats.wall)}
          {box(`${k}c`, x0 - 0.08, x1 + 0.08, y0 - 0.08, y1 + 0.08, k.startsWith("wf") ? 3.2 : 4.6, (k.startsWith("wf") ? 3.2 : 4.6) + 0.25, mats.coping)}
        </React.Fragment>
      ))}
      {/* Gate piers with caps and lanterns, and the gate itself. */}
      {[gate[0] - 1, gate[1] + 1].map((x, i) => (
        <React.Fragment key={`pier${i}`}>
          {box(`p${i}`, x - 0.9, x + 0.9, -0.4, 0.9, 0, 5, mats.cladStone)}
          {box(`pc${i}`, x - 1.05, x + 1.05, -0.55, 1.05, 5, 5.3, mats.coping)}
          {box(`pl${i}`, x - 0.35, x + 0.35, -0.1, 0.6, 5.3, 6.2, mats.lamp)}
          {box(`plc${i}`, x - 0.45, x + 0.45, -0.2, 0.7, 6.2, 6.4, mats.iron)}
        </React.Fragment>
      ))}
      {box("gateRail1", gate[0] - 0.1, gate[1] + 0.1, 0.12, 0.38, 0.5, 0.62, mats.iron)}
      {box("gateRail2", gate[0] - 0.1, gate[1] + 0.1, 0.12, 0.38, 4.9, 5.02, mats.iron)}
      {box("gateStileL", gate[0] - 0.62, gate[0] - 0.5, 0.12, 0.38, 0.5, 5.02, mats.iron)}
      {box("gateStileR", gate[1] + 0.5, gate[1] + 0.62, 0.12, 0.38, 0.5, 5.02, mats.iron)}
      {box("gateStileM", (gate[0] + gate[1]) / 2 - 0.05, (gate[0] + gate[1]) / 2 + 0.05, 0.1, 0.4, 0.5, 5.02, mats.iron)}
      <Instances frame={frame} geometry={geos.bar} material={mats.timber} items={bars} />
      {/* Name plate on the left pier. */}
      <mesh position={W3(gate[0] - 1, -0.44, 3.2)} material={mats.plaque}>
        <boxGeometry args={[1.6, 0.9, 0.06]} />
      </mesh>
      <Instances frame={frame} geometry={geos.shrub} material={mats.shrub} items={shrubs} />
      <Instances frame={frame} geometry={geos.flower} material={mats.flower} items={flowers} cast={false} />
      {lamps.map((x, i) => (
        <group key={`sl${i}`}>
          {box(`slp${i}`, x - 0.18, x + 0.18, -4.2, -3.84, 0, 16, mats.iron)}
          {box(`sla${i}`, x - 0.12, x + 0.12, -9, -4, 15.6, 15.85, mats.iron)}
          {box(`slh${i}`, x - 0.5, x + 0.5, -9.8, -8.2, 15.2, 15.6, mats.iron)}
          {box(`sll${i}`, x - 0.4, x + 0.4, -9.7, -8.3, 15.1, 15.2, mats.lamp)}
          {lit ? <pointLight position={W3(x, -9, 14.6)} intensity={60} distance={40} decay={1.6} color="#ffcb84" /> : null}
        </group>
      ))}
      {trees.map(([x, y, s, seed], i) =>
        i === 2 || i === 0 ? null : <Tree key={i} frame={frame} x={x} y={y} s={s} seed={seed} mats={mats} />,
      )}
      {palms.map(([x, y, h, seed], i) => (
        <Palm key={`palm${i}`} position={W3(x, y, 0)} height={h} seed={seed} />
      ))}
      {arecas.map(([x, y, seed], i) => (
        <ArecaClump key={`areca${i}`} position={W3(x, y, 0)} seed={seed} height={11} />
      ))}
      {night ? (
        <>
          {/* Bollards along the drive, each with a pool of light. */}
          {bollards.map(([x, y], i) => (
            <group key={`bo${i}`}>
              {box(`bop${i}`, x - 0.18, x + 0.18, y - 0.18, y + 0.18, 0, 2.2, mats.bollard)}
              {box(`bol${i}`, x - 0.2, x + 0.2, y - 0.2, y + 0.2, 1.8, 2, mats.lamp, false)}
              <mesh position={W3(x, y, 0.2)} rotation={[-Math.PI / 2, 0, 0]} scale={7} geometry={geos.plane} material={mats.pool} />
            </group>
          ))}
          {/* Pier lanterns and street lamps: a glow and a real light each. */}
          {[gate[0] - 1, gate[1] + 1].map((x, i) => (
            <group key={`pg${i}`}>
              <sprite position={W3(x, 0.25, 5.8)} scale={3.2} material={glowSprite} />
              <pointLight position={W3(x, -1.4, 5.8)} intensity={10} distance={14} decay={1.6} color="#ffc786" />
            </group>
          ))}
          {lamps.map((x, i) => (
            <group key={`slg${i}`}>
              <sprite position={W3(x, -9, 14.9)} scale={6} material={glowSprite} />
              <mesh position={W3(x, -9, 0.1)} rotation={[-Math.PI / 2, 0, 0]} scale={34} geometry={geos.plane} material={mats.pool} />
            </group>
          ))}
          {/* Uplights into the front palms. */}
          {palms.slice(0, 2).map(([x, y], i) => {
            const p = W3(x, y - 1.5, 0.4);
            return <Spot key={`up${i}`} position={p} target={[p.x, 30, p.z - 1.5]} angle={0.42} penumbra={0.7} intensity={140} distance={40} decay={1.4} color="#ffd9a8" />;
          })}
        </>
      ) : null}
    </group>
  );
}

/** A white residence name plate with the project name in dark serif italics. */
function plaqueTexture(name: string) {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 288;
  const g = c.getContext("2d")!;
  g.fillStyle = "#f4f1ea";
  g.fillRect(0, 0, 512, 288);
  g.strokeStyle = "#b7a98f";
  g.lineWidth = 6;
  g.strokeRect(14, 14, 484, 260);
  g.fillStyle = "#2f2b26";
  g.textAlign = "center";
  const words = (name || "Residence").replace(/\b(house|villa|home)\b/gi, "").trim() || "The";
  g.font = "italic 64px Georgia, 'Times New Roman', serif";
  g.fillText(words.length > 16 ? words.slice(0, 16) : words, 256, 136);
  g.font = "italic 46px Georgia, 'Times New Roman', serif";
  g.fillText("Residence", 256, 210);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Night: a deep gradient dome, stars and a moon with a soft halo. */
export function NightSky() {
  const dome = React.useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {},
        vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader:
          "varying vec3 vP; void main(){ float h = clamp(vP.y, -0.2, 1.0); vec3 top = vec3(0.012,0.022,0.06); vec3 mid = vec3(0.035,0.06,0.13); vec3 hor = vec3(0.12,0.13,0.2); vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h)); c = mix(c, top, smoothstep(0.18, 0.75, h)); gl_FragColor = vec4(c, 1.0); }",
      }),
    [],
  );
  const halo = React.useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: "#9fb6e0", transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }), []);
  const moon = React.useMemo(() => new THREE.MeshBasicMaterial({ color: "#f3eedc", fog: false }), []);
  const m = MOON.clone().multiplyScalar(900);
  return (
    <>
      <mesh material={dome} renderOrder={-10}>
        <sphereGeometry args={[1500, 32, 16]} />
      </mesh>
      <Stars radius={1100} depth={200} count={3500} factor={14} saturation={0} fade speed={0.4} />
      <mesh position={m} material={moon}>
        <sphereGeometry args={[18, 32, 16]} />
      </mesh>
      <sprite position={m} scale={150} material={halo} />
    </>
  );
}

const MOON = new THREE.Vector3(-0.55, 0.62, -0.56).normalize();

/** Sun direction from hour of day: rises east (+x), sets west, passes over the street side. */
export function sunAt(hour: number) {
  const t = ((hour - 6) / 12) * Math.PI;
  const up = Math.sin(t);
  const dir = new THREE.Vector3(Math.cos(t), Math.max(-0.2, up) * 1.1, 0.55).normalize();
  const night = hour < 6.2 || hour > 18.6;
  const golden = !night && (hour < 8 || hour > 16.8);
  return { dir, up, night, golden };
}

export function Lights({ hour, night }: { hour: number; night: boolean }) {
  const sun = sunAt(hour);
  const pos = (night ? MOON : sun.dir).clone().multiplyScalar(160);
  const ref = React.useRef<THREE.DirectionalLight>(null);
  React.useEffect(() => {
    const light = ref.current;
    if (!light) return;
    const cam = light.shadow.camera as THREE.OrthographicCamera;
    cam.left = -85;
    cam.right = 85;
    cam.top = 85;
    cam.bottom = -85;
    cam.near = 1;
    cam.far = 420;
    cam.updateProjectionMatrix();
  }, []);
  const color = sun.golden ? "#ffcf9a" : "#fff4e2";
  const intensity = night ? 0.42 : 0.7 + Math.max(0, sun.up) * 2.6;
  return (
    <>
      <hemisphereLight args={[night ? "#3a4b70" : "#f2eee4", night ? "#14171c" : "#9c9480", night ? 0.32 : 0.55]} />
      <directionalLight ref={ref} position={pos} intensity={intensity} color={night ? "#a9bde0" : color} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.0006} shadow-normalBias={0.09} shadow-radius={4} />
      {night ? null : <Sky sunPosition={[sun.dir.x, Math.max(sun.up, night ? -0.08 : 0.02), sun.dir.z]} turbidity={night ? 2 : 5} rayleigh={night ? 0.3 : sun.golden ? 2.2 : 1.1} mieCoefficient={0.004} mieDirectionalG={0.82} distance={4500} />}
      {/* Studio reflections built from light panels, so nothing is downloaded. */}
      <Environment resolution={256} frames={1} environmentIntensity={night ? 0.15 : 0.6}>
        <Lightformer form="rect" intensity={night ? 0.2 : 2} color={night ? "#4a5a78" : "#fff8ec"} position={[0, 40, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[120, 120, 1]} />
        <Lightformer form="rect" intensity={night ? 0.1 : 1.1} color="#e9efe9" position={[-60, 18, 30]} rotation={[0, Math.PI / 2.5, 0]} scale={[60, 24, 1]} />
        <Lightformer form="rect" intensity={night ? 0.1 : 0.9} color="#f5e3cc" position={[60, 14, -20]} rotation={[0, -Math.PI / 2.2, 0]} scale={[60, 20, 1]} />
        <Lightformer form="ring" intensity={night ? 0 : 3} color={sun.golden ? "#ffcf9a" : "#fff6e6"} position={pos.clone().normalize().multiplyScalar(80)} scale={14} />
      </Environment>
    </>
  );
}
