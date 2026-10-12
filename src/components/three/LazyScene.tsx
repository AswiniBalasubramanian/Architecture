"use client";

import dynamic from "next/dynamic";

/** Three.js is ~600 kB; load it only where a 3D view is on screen. */
export const LazyHouseScene = dynamic(() => import("./HouseScene").then((m) => m.HouseScene), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3 af-grid" role="status" aria-live="polite">
      <div className="af-skeleton h-1 w-40 rounded-full" />
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Loading 3D model</p>
    </div>
  ),
});

export function webglAvailable() {
  if (typeof document === "undefined") return true;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
