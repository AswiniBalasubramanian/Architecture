"use client";

// Coconut and areca palms: a ringed, tapering trunk that leans and bows, and
// a crown of arching fronds cut from an alpha leaflet texture.

import * as React from "react";
import * as THREE from "three";

let frondTex: THREE.Texture | null = null;
let trunkTex: THREE.Texture | null = null;

function frondTexture() {
  if (frondTex || typeof document === "undefined") return frondTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 512;
  const g = c.getContext("2d")!;
  g.clearRect(0, 0, 256, 512);
  // Leaflets angle out and forward from the midrib, longest mid-frond.
  for (let y = 6; y < 500; y += 7) {
    const v = y / 512;
    const len = 118 * Math.pow(Math.sin(Math.PI * Math.min(1, v * 1.05)), 0.6);
    for (const s of [-1, 1]) {
      const shade = 58 + Math.round(Math.random() * 40);
      g.strokeStyle = `rgb(${shade - 12},${shade + 52},${shade - 30})`;
      g.lineWidth = 3.4;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(128, y);
      g.quadraticCurveTo(128 + s * len * 0.5, y + 10, 128 + s * len, y + 34 + Math.random() * 8);
      g.stroke();
    }
  }
  g.strokeStyle = "#7d8a4a";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 512);
  g.stroke();
  frondTex = new THREE.CanvasTexture(c);
  frondTex.colorSpace = THREE.SRGBColorSpace;
  frondTex.anisotropy = 4;
  return frondTex;
}

function trunkTexture() {
  if (trunkTex || typeof document === "undefined") return trunkTex;
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 64;
  const g = c.getContext("2d")!;
  g.fillStyle = "#8a7a66";
  g.fillRect(0, 0, 256, 64);
  for (let x = 0; x < 256; x += 9) {
    g.fillStyle = `rgba(60,48,36,${0.35 + Math.random() * 0.25})`;
    g.fillRect(x, 0, 2.5, 64);
    g.fillStyle = "rgba(190,176,152,0.25)";
    g.fillRect(x + 3, 0, 3, 64);
  }
  trunkTex = new THREE.CanvasTexture(c);
  trunkTex.colorSpace = THREE.SRGBColorSpace;
  trunkTex.wrapS = trunkTex.wrapT = THREE.RepeatWrapping;
  return trunkTex;
}

/** One arching frond along +x: midrib rises then droops; a shallow V section. */
function frondGeometry(L: number, W: number) {
  const S = 14;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const x = L * s;
    const y = L * (0.32 * s - 0.62 * s * s);
    const hw = W * Math.pow(Math.sin(Math.PI * Math.min(1, s * 1.08)), 0.55) * 0.5 + 0.02;
    const droop = hw * 0.4;
    pos.push(x, y - droop, -hw, x, y, 0, x, y - droop, hw);
    uv.push(0, 1 - s, 0.5, 1 - s, 1, 1 - s);
    if (i < S) {
      const a = i * 3;
      const b = a + 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function trunkGeometry(h: number, lean: number, bow: number, r0: number, r1: number, seedAngle: number) {
  const pts = Array.from({ length: 7 }, (_, i) => {
    const t = i / 6;
    const off = lean * t + bow * Math.sin(Math.PI * t) * 0.5;
    return new THREE.Vector3(Math.cos(seedAngle) * off, h * t, Math.sin(seedAngle) * off);
  });
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubular = 24;
  const radial = 10;
  const g = new THREE.TubeGeometry(curve, tubular, 1, radial, false);
  const p = g.attributes.position as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const c = curve.getPointAt(t);
    const r = THREE.MathUtils.lerp(r0, r1, t) * (1 + 0.12 * Math.max(0, 1 - t * 8));
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      v.fromBufferAttribute(p, k).sub(c).multiplyScalar(r).add(c);
      p.setXYZ(k, v.x, v.y, v.z);
    }
  }
  g.computeVertexNormals();
  const tex = trunkTexture();
  if (tex) {
    const uvs = g.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uvs.count; i++) uvs.setX(i, uvs.getX(i) * h * 0.9);
  }
  return { g, top: curve.getPointAt(1) };
}

function rnd(seed: number) {
  let s = (seed * 9301 + 49297) % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}

export function Palm({ position, height = 26, seed = 1, kind = "coconut" }: { position: THREE.Vector3; height?: number; seed?: number; kind?: "coconut" | "areca" }) {
  const mats = React.useMemo(() => {
    const t = trunkTexture();
    return {
      trunk: new THREE.MeshStandardMaterial({ map: t, color: kind === "areca" ? "#b5ad8e" : "#ffffff", roughness: 0.95 }),
      frond: new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.75, color: kind === "areca" ? "#c9e0a0" : "#ffffff" }),
      nut: new THREE.MeshStandardMaterial({ color: "#6f7a2e", roughness: 0.6 }),
    };
  }, [kind]);
  const parts = React.useMemo(() => {
    const r = rnd(seed);
    const a = r() * Math.PI * 2;
    const coco = kind === "coconut";
    const { g, top } = trunkGeometry(height, coco ? height * (0.08 + r() * 0.1) : height * 0.03, coco ? height * 0.06 : 0, coco ? 0.62 : 0.2, coco ? 0.42 : 0.16, a);
    const L = coco ? 9 + r() * 2 : 5;
    const frond = frondGeometry(L, coco ? 3.4 : 2.4);
    const n = coco ? 15 : 9;
    const fronds = Array.from({ length: n }, (_, i) => ({
      yaw: (i / n) * Math.PI * 2 + r() * 0.3,
      tilt: (i % 3 === 0 ? 0.55 : i % 3 === 1 ? 0.1 : -0.25) + (r() - 0.5) * 0.2,
      scale: 0.8 + r() * 0.35,
    }));
    return { g, top, frond, fronds, coco };
  }, [height, seed, kind]);
  return (
    <group position={position}>
      <mesh geometry={parts.g} material={mats.trunk} castShadow receiveShadow />
      <group position={parts.top}>
        {parts.fronds.map((f, i) => (
          <group key={i} rotation={[0, f.yaw, 0]}>
            <mesh geometry={parts.frond} material={mats.frond} rotation={[0, 0, f.tilt]} scale={f.scale} castShadow />
          </group>
        ))}
        {parts.coco
          ? [0, 1, 2, 3, 4].map((k) => (
              <mesh key={k} position={[Math.cos(k * 1.3) * 0.7, -0.7 - (k % 2) * 0.35, Math.sin(k * 1.3) * 0.7]} material={mats.nut} castShadow>
                <sphereGeometry args={[0.42, 10, 8]} />
              </mesh>
            ))
          : null}
      </group>
    </group>
  );
}

/** An indoor palm in a ceramic planter. */
export function PottedPalm({ pot }: { pot: THREE.Material }) {
  const frond = React.useMemo(() => frondGeometry(2.6, 1.3), []);
  const mat = React.useMemo(() => new THREE.MeshStandardMaterial({ map: frondTexture(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.7, color: "#d6e8b0" }), []);
  const stems = React.useMemo(() => {
    const r = rnd(11);
    return Array.from({ length: 9 }, (_, i) => ({ yaw: (i / 9) * Math.PI * 2 + r() * 0.4, tilt: 0.35 + r() * 0.6, h: 2.2 + r() * 1.6, s: 0.75 + r() * 0.4 }));
  }, []);
  return (
    <group>
      <mesh position={[0, 0.85, 0]} material={pot} castShadow receiveShadow>
        <cylinderGeometry args={[0.72, 0.55, 1.7, 28]} />
      </mesh>
      <mesh position={[0, 1.66, 0]}>
        <cylinderGeometry args={[0.66, 0.66, 0.04, 20]} />
        <meshStandardMaterial color="#3b2f25" roughness={1} />
      </mesh>
      {stems.map((st, i) => (
        <group key={i} position={[0, 1.6, 0]} rotation={[0, st.yaw, 0]}>
          <mesh position={[0.05, st.h / 2, 0]} castShadow>
            <cylinderGeometry args={[0.025, 0.035, st.h, 5]} />
            <meshStandardMaterial color="#6f7d3c" roughness={0.8} />
          </mesh>
          <mesh geometry={frond} material={mat} position={[0.05, st.h, 0]} rotation={[0, 0, st.tilt]} scale={st.s} castShadow />
        </group>
      ))}
    </group>
  );
}
