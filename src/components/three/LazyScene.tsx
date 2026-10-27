"use client";

import dynamic from "next/dynamic";
import { PixelLoader } from "../ui/PixelLoader";

/** Three.js is ~600 kB; load it only where a 3D view is on screen. */
export const LazyHouseScene = dynamic(() => import("./HouseScene").then((m) => m.HouseScene), {
  ssr: false,
  loading: () => <PixelLoader label="Loading 3D model" className="af-grid" />,
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
