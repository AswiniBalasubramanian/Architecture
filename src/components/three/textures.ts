"use client";

// Procedural, colour-driven textures. Each material is drawn twice from the
// same random sequence: once in colour and once as a height map, so mortar,
// grout, plank seams and tile courses line up exactly with their relief.
// Nothing is downloaded; any colour the architect picks re-renders the set.

import * as THREE from "three";
import { MATERIALS } from "@/lib/catalog";
import type { MaterialChoice, MaterialId } from "@/lib/types";

const SIZE = 512;

export type SurfaceId = MaterialId | "grass" | "asphalt" | "paving" | "gravel" | "soil";

/** Feet that one texture repeat covers. */
export const TILE: Record<SurfaceId, number> = {
  plaster: 7,
  brick: 3.4,
  stone: 5,
  concrete: 9,
  wood: 4,
  tile: 4,
  terracotta: 3,
  metal: 4,
  marble: 6,
  lacquer: 6,
  fabric: 2,
  glass: 8,
  grass: 10,
  asphalt: 14,
  paving: 6,
  gravel: 5,
  soil: 8,
};

/** How strongly the height map lifts the surface. */
const BUMP: Partial<Record<SurfaceId, number>> = {
  brick: 0.09,
  stone: 0.11,
  concrete: 0.03,
  wood: 0.025,
  tile: 0.03,
  terracotta: 0.12,
  metal: 0.05,
  plaster: 0.02,
  marble: 0.008,
  grass: 0.06,
  asphalt: 0.03,
  paving: 0.06,
  gravel: 0.07,
  fabric: 0.02,
  lacquer: 0.004,
  soil: 0.05,
};

function mix(hex: string, amount: number) {
  const c = new THREE.Color(hex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s * (amount < 0 ? 1.04 : 0.98)), Math.min(1, Math.max(0, hsl.l + amount)));
  return `#${c.getHexString()}`;
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A palette that answers in colour or in grey height. `surf(d)` is a surface
 * tone offset by d; `joint()` is a recessed joint; `ridge()` a raised edge.
 */
function palette(color: string, height: boolean) {
  const g = (v: number) => {
    const n = Math.round(Math.min(1, Math.max(0, v)) * 255);
    return `rgb(${n},${n},${n})`;
  };
  return {
    surf: (d = 0) => (height ? g(0.72 + d * 1.6) : mix(color, d)),
    joint: (colorDelta = -0.18) => (height ? g(0.12) : mix(color, colorDelta)),
    ridge: (colorDelta = 0.08) => (height ? g(0.95) : mix(color, colorDelta)),
  };
}

function noise(g: CanvasRenderingContext2D, r: () => number, count: number, size: number, alpha: number, fill: () => string) {
  for (let i = 0; i < count; i++) {
    g.globalAlpha = alpha * (0.4 + r() * 0.6);
    g.fillStyle = fill();
    const s = size * (0.4 + r());
    g.fillRect(r() * SIZE, r() * SIZE, s, s);
  }
  g.globalAlpha = 1;
}

function draw(material: SurfaceId, color: string, g: CanvasRenderingContext2D, height: boolean) {
  const r = rng(material.length * 7919 + 17);
  const p = palette(color, height);
  g.fillStyle = p.surf(0);
  g.fillRect(0, 0, SIZE, SIZE);
  const line = (x0: number, y0: number, x1: number, y1: number, w: number, style: string, alpha = 1) => {
    g.globalAlpha = alpha;
    g.strokeStyle = style;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
    g.globalAlpha = 1;
  };

  switch (material) {
    case "plaster":
    case "lacquer": {
      // Trowel clouds, then fine sand.
      for (let i = 0; i < 70; i++) {
        const x = r() * SIZE;
        const y = r() * SIZE;
        const rad = 30 + r() * 90;
        const grad = g.createRadialGradient(x, y, 0, x, y, rad);
        grad.addColorStop(0, p.surf((r() - 0.5) * (material === "plaster" ? 0.07 : 0.03)));
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.globalAlpha = 0.5;
        g.fillStyle = grad;
        g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
      }
      g.globalAlpha = 1;
      noise(g, r, material === "plaster" ? 9000 : 2500, 1.3, 0.35, () => p.surf((r() - 0.5) * 0.12));
      break;
    }
    case "concrete": {
      // Board-formed: horizontal boards with grain, tie holes, pour lines.
      const boards = 8;
      const bh = SIZE / boards;
      for (let b = 0; b < boards; b++) {
        g.fillStyle = p.surf((r() - 0.5) * 0.06);
        g.fillRect(0, b * bh, SIZE, bh);
        for (let k = 0; k < 10; k++) {
          const y = b * bh + r() * bh;
          g.globalAlpha = 0.18;
          g.strokeStyle = p.surf(-0.06);
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(0, y);
          g.bezierCurveTo(SIZE * 0.3, y + (r() - 0.5) * 5, SIZE * 0.7, y + (r() - 0.5) * 5, SIZE, y);
          g.stroke();
        }
        g.globalAlpha = 1;
        line(0, b * bh + 0.5, SIZE, b * bh + 0.5, 1.6, p.joint(-0.1), 0.6);
      }
      noise(g, r, 9000, 1.6, 0.4, () => p.surf((r() - 0.5) * 0.16));
      g.fillStyle = p.joint(-0.25);
      for (let y = bh; y < SIZE; y += bh * 2) for (let x = SIZE / 8; x < SIZE; x += SIZE / 4) g.beginPath(), g.arc(x, y, 3.2, 0, Math.PI * 2), g.fill();
      break;
    }
    case "brick": {
      const rows = 14;
      const h = SIZE / rows;
      const bw = SIZE / 4;
      g.fillStyle = height ? p.joint() : mix(color, 0.24); // mortar
      g.fillRect(0, 0, SIZE, SIZE);
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let x = -bw; x < SIZE + bw; x += bw) {
          const d = (r() - 0.5) * 0.14;
          g.fillStyle = p.surf(d);
          g.fillRect(x + off + 2, row * h + 2, bw - 4, h - 4);
          // Fired-face mottling.
          for (let k = 0; k < 6; k++) {
            g.globalAlpha = 0.25;
            g.fillStyle = p.surf(d + (r() - 0.6) * 0.12);
            g.fillRect(x + off + 2 + r() * (bw - 14), row * h + 2 + r() * (h - 8), 4 + r() * 10, 2 + r() * 4);
          }
          g.globalAlpha = 1;
        }
      }
      noise(g, r, 5000, 1.2, 0.3, () => p.surf((r() - 0.5) * 0.18));
      break;
    }
    case "terracotta": {
      // Clay roof tiles: overlapping courses with a shadowed lower lip.
      const rows = 8;
      const h = SIZE / rows;
      const tw = SIZE / 6;
      for (let row = 0; row < rows; row++) {
        const off = row % 2 ? tw / 2 : 0;
        for (let x = -tw; x < SIZE + tw; x += tw) {
          const d = (r() - 0.5) * 0.12;
          const grad = g.createLinearGradient(0, row * h, 0, row * h + h);
          grad.addColorStop(0, p.surf(d - 0.05));
          grad.addColorStop(0.75, p.surf(d + 0.04));
          grad.addColorStop(1, p.ridge(d + 0.08));
          g.fillStyle = grad;
          g.beginPath();
          g.roundRect(x + off + 1.5, row * h, tw - 3, h - 1, [0, 0, tw / 2.4, tw / 2.4]);
          g.fill();
        }
        line(0, row * h + h - 0.5, SIZE, row * h + h - 0.5, 2.4, p.joint(-0.32), 0.7);
      }
      noise(g, r, 4000, 1.2, 0.25, () => p.surf((r() - 0.5) * 0.16));
      break;
    }
    case "stone": {
      // Random ashlar: coursed rows of varying length with deep joints.
      g.fillStyle = height ? p.joint() : mix(color, -0.22);
      g.fillRect(0, 0, SIZE, SIZE);
      const rows = 6;
      let y = 0;
      for (let row = 0; row < rows; row++) {
        const rh = SIZE / rows;
        let x = -r() * 60;
        while (x < SIZE) {
          const w = 50 + r() * 90;
          const d = (r() - 0.5) * 0.2;
          g.fillStyle = p.surf(d);
          g.beginPath();
          g.roundRect(x + 3, y + 3, w - 6, rh - 6, 5);
          g.fill();
          for (let k = 0; k < 14; k++) {
            g.globalAlpha = 0.3;
            g.fillStyle = p.surf(d + (r() - 0.5) * 0.2);
            g.beginPath();
            g.arc(x + 6 + r() * (w - 12), y + 6 + r() * (rh - 12), 2 + r() * 7, 0, Math.PI * 2);
            g.fill();
          }
          g.globalAlpha = 1;
          x += w;
        }
        y += rh;
      }
      noise(g, r, 6000, 1.3, 0.35, () => p.surf((r() - 0.5) * 0.2));
      break;
    }
    case "wood": {
      const planks = 7;
      const ph = SIZE / planks;
      for (let k = 0; k < planks; k++) {
        const d = (r() - 0.5) * 0.12;
        g.fillStyle = p.surf(d);
        g.fillRect(0, k * ph, SIZE, ph);
        // Grain, with a knot now and then.
        for (let n = 0; n < 16; n++) {
          const yy = k * ph + r() * ph;
          g.globalAlpha = 0.18 + r() * 0.2;
          g.strokeStyle = p.surf(d - 0.09);
          g.lineWidth = 0.6 + r() * 1.2;
          g.beginPath();
          g.moveTo(0, yy);
          for (let x = 0; x <= SIZE; x += 32) g.lineTo(x, yy + Math.sin(x / 60 + n) * 1.6 + (r() - 0.5) * 1.2);
          g.stroke();
        }
        g.globalAlpha = 1;
        if (r() < 0.45) {
          const kx = r() * SIZE;
          const ky = k * ph + ph * (0.3 + r() * 0.4);
          for (let ring = 6; ring > 0; ring--) {
            g.strokeStyle = p.surf(d - 0.04 - ring * 0.015);
            g.globalAlpha = 0.35;
            g.beginPath();
            g.ellipse(kx, ky, ring * 3.2, ring * 1.3, 0, 0, Math.PI * 2);
            g.stroke();
          }
          g.globalAlpha = 1;
        }
        line(0, k * ph + 0.5, SIZE, k * ph + 0.5, 1.8, p.joint(-0.2), 0.75);
        const jx = (k % 3) * 0.31 * SIZE + SIZE * 0.18;
        line(jx, k * ph, jx, (k + 1) * ph, 1.8, p.joint(-0.2), 0.75);
      }
      break;
    }
    case "tile":
    case "marble": {
      const n = material === "tile" ? 4 : 2;
      const s = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = p.surf((r() - 0.5) * (material === "tile" ? 0.05 : 0.025));
          g.fillRect(i * s, j * s, s, s);
        }
      if (material === "marble") {
        for (let k = 0; k < 14; k++) {
          g.globalAlpha = 0.1 + r() * 0.22;
          g.strokeStyle = height ? p.surf(-0.02) : mix(color, -0.28);
          g.lineWidth = 0.6 + r() * 2;
          g.beginPath();
          let x = r() * SIZE;
          let y = 0;
          g.moveTo(x, y);
          while (y < SIZE) {
            x += (r() - 0.5) * 40;
            y += 10 + r() * 24;
            g.lineTo(x, y);
          }
          g.stroke();
        }
        g.globalAlpha = 1;
      } else noise(g, r, 2600, 1.2, 0.2, () => p.surf((r() - 0.5) * 0.1));
      for (let k = 0; k <= n; k++) {
        line(k * s, 0, k * s, SIZE, material === "tile" ? 3 : 1.4, p.joint(material === "tile" ? -0.16 : -0.06), 0.9);
        line(0, k * s, SIZE, k * s, material === "tile" ? 3 : 1.4, p.joint(material === "tile" ? -0.16 : -0.06), 0.9);
      }
      break;
    }
    case "metal": {
      // Standing seams with a slight sheen between them.
      const seams = 8;
      const sw = SIZE / seams;
      for (let k = 0; k < seams; k++) {
        const grad = g.createLinearGradient(k * sw, 0, (k + 1) * sw, 0);
        grad.addColorStop(0, p.surf(-0.03));
        grad.addColorStop(0.5, p.surf(0.03));
        grad.addColorStop(1, p.surf(-0.03));
        g.fillStyle = grad;
        g.fillRect(k * sw, 0, sw, SIZE);
        line(k * sw + 1, 0, k * sw + 1, SIZE, 3, p.ridge(0.14), 0.9);
        line(k * sw + 4, 0, k * sw + 4, SIZE, 1.5, p.joint(-0.14), 0.6);
      }
      noise(g, r, 1500, 1, 0.12, () => p.surf((r() - 0.5) * 0.08));
      break;
    }
    case "fabric": {
      for (let k = 0; k < SIZE; k += 3) {
        line(k, 0, k, SIZE, 1, p.surf(-0.06), 0.35);
        line(0, k + 1, SIZE, k + 1, 1, p.surf(0.04), 0.3);
      }
      noise(g, r, 3000, 1, 0.2, () => p.surf((r() - 0.5) * 0.12));
      break;
    }
    case "grass": {
      noise(g, r, 26000, 2.4, 0.55, () => p.surf((r() - 0.45) * 0.22));
      for (let i = 0; i < 9000; i++) {
        const x = r() * SIZE;
        const y = r() * SIZE;
        g.globalAlpha = 0.5;
        g.strokeStyle = p.surf((r() - 0.3) * 0.2);
        g.lineWidth = 0.8;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    }
    case "asphalt":
    case "gravel":
    case "soil":
      noise(g, r, material === "gravel" ? 14000 : 22000, material === "gravel" ? 3.4 : 1.6, 0.6, () => p.surf((r() - 0.5) * (material === "asphalt" ? 0.18 : 0.3)));
      break;
    case "paving": {
      const n = 4;
      const s = SIZE / n;
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          const off = j % 2 ? s / 2 : 0;
          g.fillStyle = p.surf((r() - 0.5) * 0.08);
          g.fillRect(i * s + off + 2, j * s + 2, s - 4, s - 4);
          if (off) {
            g.fillStyle = p.surf((r() - 0.5) * 0.08);
            g.fillRect(off - s + 2 + i * s, j * s + 2, s - 4, s - 4);
          }
        }
      for (let j = 0; j <= n; j++) line(0, j * s, SIZE, j * s, 3, p.joint(-0.2), 0.9);
      for (let j = 0; j < n; j++) for (let i = 0; i <= n; i++) line(i * s + (j % 2 ? s / 2 : 0), j * s, i * s + (j % 2 ? s / 2 : 0), (j + 1) * s, 3, p.joint(-0.2), 0.9);
      noise(g, r, 5000, 1.4, 0.3, () => p.surf((r() - 0.5) * 0.14));
      break;
    }
    default:
      break;
  }
}

interface TextureSet {
  map: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
}

const cache = new Map<string, TextureSet>();

function canvasTexture(material: SurfaceId, color: string, height: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const g = canvas.getContext("2d");
  if (!g) return null;
  draw(material, color, g, height);
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (!height) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function texturesFor(material: SurfaceId, color: string): TextureSet | null {
  if (typeof document === "undefined" || material === "glass") return null;
  const key = `${material}:${color}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const map = canvasTexture(material, color, false);
  const bump = canvasTexture(material, color, true);
  if (!map || !bump) return null;
  const set = { map, bump };
  cache.set(key, set);
  return set;
}

/** The colour map alone (for custom geometry with its own UVs). */
export function textureFor(choice: MaterialChoice) {
  return texturesFor(choice.material, choice.color)?.map ?? null;
}

const materialCache = new Map<string, THREE.MeshStandardMaterial>();

/**
 * A standard material with colour and relief, repeating once per TILE feet
 * over a face of `width × height` feet.
 */
export function surfaceMaterial(material: SurfaceId, color: string, width = 1, height = 1, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial {
  const tile = TILE[material];
  const rx = Math.max(0.25, Math.round((width / tile) * 4) / 4);
  const ry = Math.max(0.25, Math.round((height / tile) * 4) / 4);
  const key = `${material}:${color}:${rx}:${ry}:${JSON.stringify(extra)}`;
  const hit = materialCache.get(key);
  if (hit) return hit;
  const spec = material in MATERIALS ? MATERIALS[material as MaterialId] : { roughness: 0.95, metalness: 0 };
  const set = texturesFor(material, color);
  let map: THREE.Texture | null = null;
  let bump: THREE.Texture | null = null;
  if (set) {
    map = set.map.clone();
    map.repeat.set(rx, ry);
    map.needsUpdate = true;
    bump = set.bump.clone();
    bump.repeat.set(rx, ry);
    bump.needsUpdate = true;
  }
  const mat = new THREE.MeshStandardMaterial({
    color: map ? "#ffffff" : color,
    map,
    bumpMap: bump,
    bumpScale: BUMP[material] ?? 0.02,
    roughness: spec.roughness,
    metalness: spec.metalness,
    ...extra,
  });
  materialCache.set(key, mat);
  return mat;
}

export function materialFor(choice: MaterialChoice, width = 1, height = 1) {
  return surfaceMaterial(choice.material, choice.color, width, height);
}
