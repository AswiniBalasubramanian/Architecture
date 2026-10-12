"use client";

import * as React from "react";
import * as THREE from "three";
import { Environment, Lightformer, Sky } from "@react-three/drei";
import type { Brief, Design } from "@/lib/types";
import { toWorld } from "./HouseModel";
import { materialFor, surfaceMaterial } from "./textures";

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

type Frame = { cx: number; cy: number };

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
  const blobs = Array.from({ length: 7 }, () => ({
    pos: [(r() - 0.5) * 5, 7 + r() * 4, (r() - 0.5) * 5] as [number, number, number],
    rad: 1.8 + r() * 1.8,
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
        <mesh key={k} position={b.pos} material={b.m} castShadow receiveShadow>
          <icosahedronGeometry args={[b.rad, 1]} />
        </mesh>
      ))}
    </group>
  );
}

function useSiteMaterials(design: Design, lit: boolean) {
  return React.useMemo(
    () => ({
      grass: surfaceMaterial("grass", "#8f9c74", 40, 40),
      lawn: surfaceMaterial("grass", "#93a176", 20, 20),
      ground: surfaceMaterial("soil", "#cbc2ae", 300, 300),
      paving: surfaceMaterial("paving", "#cdc4b1", 10, 10),
      drive: surfaceMaterial("paving", "#bfb6a3", 8, 8),
      street: surfaceMaterial("asphalt", "#55595a", 120, 20),
      kerb: surfaceMaterial("concrete", "#d3cdc1", 40, 1),
      gravel: surfaceMaterial("gravel", "#bdb4a1", 6, 6),
      wall: materialFor(design.materials.exterior, 20, 4),
      coping: materialFor(design.materials.accent, 20, 1),
      trunk: new THREE.MeshStandardMaterial({ color: "#5d4c3b", roughness: 1 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#6f845c", roughness: 0.95, flatShading: true }),
      leafDark: new THREE.MeshStandardMaterial({ color: "#566c4a", roughness: 0.95, flatShading: true }),
      leafLight: new THREE.MeshStandardMaterial({ color: "#8a9b67", roughness: 0.95, flatShading: true }),
      shrub: new THREE.MeshStandardMaterial({ color: "#5f7650", roughness: 1, flatShading: true }),
      flower: new THREE.MeshStandardMaterial({ color: "#c98a6b", roughness: 1, flatShading: true }),
      lane: new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.8 }),
      iron: new THREE.MeshStandardMaterial({ color: "#2b2e2c", roughness: 0.45, metalness: 0.7 }),
      lamp: lit ? new THREE.MeshStandardMaterial({ color: "#fff3dc", emissive: "#ffc77d", emissiveIntensity: 3.2 }) : new THREE.MeshStandardMaterial({ color: "#efe9dd", roughness: 0.25, transparent: true, opacity: 0.9 }),
    }),
    [design.materials.exterior, design.materials.accent, lit],
  );
}

export function Site({ brief, design, lit }: { brief: Brief; design: Design; lit: boolean }) {
  const fp = design.footprint;
  const frame = React.useMemo(() => ({ cx: fp.x + fp.w / 2, cy: fp.y + fp.d / 2 }), [fp]);
  const W = brief.plotWidth;
  const D = brief.plotDepth;
  const mats = useSiteMaterials(design, lit);
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
  const geos = React.useMemo(() => ({ shrub: new THREE.IcosahedronGeometry(1, 1), bar: new THREE.BoxGeometry(0.08, 1, 0.08), flower: new THREE.IcosahedronGeometry(0.22, 0) }), []);
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
    for (let x = gate[0] - 0.6; x <= gate[1] + 0.6; x += 0.45) out.push([x, 0.25, 2, 1, 0, 3.6]);
    return out;
  }, [gate]);
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
          {box(`p${i}`, x - 0.9, x + 0.9, -0.4, 0.9, 0, 5, mats.wall)}
          {box(`pc${i}`, x - 1.05, x + 1.05, -0.55, 1.05, 5, 5.3, mats.coping)}
          {box(`pl${i}`, x - 0.35, x + 0.35, -0.1, 0.6, 5.3, 6.2, mats.lamp)}
          {box(`plc${i}`, x - 0.45, x + 0.45, -0.2, 0.7, 6.2, 6.4, mats.iron)}
        </React.Fragment>
      ))}
      {box("gateRail1", gate[0] - 0.1, gate[1] + 0.1, 0.18, 0.32, 0.6, 0.75, mats.iron)}
      {box("gateRail2", gate[0] - 0.1, gate[1] + 0.1, 0.18, 0.32, 3.6, 3.75, mats.iron)}
      <Instances frame={frame} geometry={geos.bar} material={mats.iron} items={bars} />
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
      {trees.map(([x, y, s, seed], i) => (
        <Tree key={i} frame={frame} x={x} y={y} s={s} seed={seed} mats={mats} />
      ))}
    </group>
  );
}

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
  const pos = sun.dir.clone().multiplyScalar(160);
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
  const intensity = night ? 0.12 : 0.7 + Math.max(0, sun.up) * 2.6;
  return (
    <>
      <hemisphereLight args={[night ? "#2c3850" : "#f2eee4", night ? "#121417" : "#9c9480", night ? 0.18 : 0.55]} />
      <directionalLight ref={ref} position={pos} intensity={intensity} color={night ? "#8ea3c7" : color} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.0003} shadow-normalBias={0.035} shadow-radius={4} />
      <Sky sunPosition={[sun.dir.x, Math.max(sun.up, night ? -0.08 : 0.02), sun.dir.z]} turbidity={night ? 2 : 5} rayleigh={night ? 0.3 : sun.golden ? 2.2 : 1.1} mieCoefficient={0.004} mieDirectionalG={0.82} distance={4500} />
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
