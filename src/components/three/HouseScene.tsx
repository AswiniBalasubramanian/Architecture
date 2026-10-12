"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { Brief, Design, Room } from "@/lib/types";
import { HouseModel, PLINTH, toWorld } from "./HouseModel";
import { Lights, Site, sunAt } from "./Site";

export type CameraPreset = "iso" | "aerial" | "front" | "side" | "back" | "top";

export interface SceneHandle {
  view(preset: CameraPreset, animate?: boolean): void;
  focusRoom(room: Room, animate?: boolean): void;
}

interface Props {
  brief: Brief;
  design: Design;
  maxFloor?: number;
  cutaway?: boolean;
  selectedRoom?: string | null;
  selectedFurniture?: string | null;
  onSelectRoom?: (id: string | null) => void;
  onSelectFurniture?: (id: string | null) => void;
  /** Start at the isometric angle of the construction figure, then settle. */
  intro?: boolean;
  className?: string;
  onReady?: () => void;
  autoRotate?: boolean;
}

export { sunAt };

function bounds(brief: Brief, design: Design) {
  const fp = design.footprint;
  const height = PLINTH + brief.floors * design.floorHeight + 6;
  const R = Math.max(fp.w, fp.d, height) * 1;
  return { height, R };
}

function poseFor(preset: CameraPreset, brief: Brief, design: Design, aspect = 1.6): [THREE.Vector3, THREE.Vector3] {
  const { height, R } = bounds(brief, design);
  const target = new THREE.Vector3(0, height * 0.42, 0);
  // Narrow panes need the camera further back to keep the house in frame.
  const dist = (R * 2.5 + 20) * Math.max(1, Math.sqrt(1.3 / Math.max(0.3, aspect)));
  const dirs: Record<CameraPreset, [number, number, number]> = {
    // Matches the construction figure: azimuth 45°, elevation 30°, from the front-right.
    iso: [1, Math.tan(Math.PI / 6) * Math.SQRT2, 1],
    aerial: [0.95, 1.05, 1.35],
    front: [0.08, 0.32, 1],
    side: [1, 0.3, 0.12],
    back: [-0.7, 0.55, -1],
    top: [0.001, 1, 0.002],
  };
  const d = new THREE.Vector3(...dirs[preset]).normalize().multiplyScalar(preset === "top" ? dist * 1.15 : dist);
  return [target.clone().add(d), target];
}

const Controller = React.forwardRef<SceneHandle, { brief: Brief; design: Design; intro: boolean; autoRotate: boolean }>(function Controller({ brief, design, intro, autoRotate }, ref) {
  const controls = React.useRef<CameraControls>(null);
  const { invalidate, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const levelZ = (floor: number) => PLINTH + floor * design.floorHeight;

  React.useImperativeHandle(ref, () => ({
    view(preset, animate = true) {
      const c = controls.current;
      if (!c) return;
      const [p, t] = poseFor(preset, brief, design, aspect);
      c.minDistance = 4;
      void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, animate);
      invalidate();
    },
    focusRoom(room, animate = true) {
      const c = controls.current;
      if (!c) return;
      const fp = design.footprint;
      const f = { cx: fp.x + fp.w / 2, cy: fp.y + fp.d / 2 };
      const z = levelZ(room.floor);
      // Stand just inside the room's street-side corner, look across to the far corner.
      const eye = toWorld(f, room.x + Math.min(1.6, room.w * 0.2), room.y + Math.min(1.6, room.d * 0.2), z + 5.2);
      const look = toWorld(f, room.x + room.w * 0.85, room.y + room.d * 0.85, z + 3.6);
      c.minDistance = 0.1;
      void c.setLookAt(eye.x, eye.y, eye.z, look.x, look.y, look.z, animate);
      invalidate();
    },
  }));

  // Intro: from the isometric angle of the figure, ease into an aerial view.
  React.useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const [p, t] = poseFor(intro ? "iso" : "aerial", brief, design, aspect);
    void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
    if (!intro) return;
    const timer = window.setTimeout(() => {
      const [p2, t2] = poseFor("aerial", brief, design, aspect);
      c.smoothTime = 1.1;
      void c.setLookAt(p2.x, p2.y, p2.z, t2.x, t2.y, t2.z, true).then(() => {
        c.smoothTime = 0.35;
      });
    }, 650);
    return () => window.clearTimeout(timer);
    // Only on mount / when the plot changes size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, design.footprint.w, design.footprint.d, brief.floors]);

  React.useEffect(() => {
    const c = controls.current;
    if (!c || !autoRotate) return;
    let frame = 0;
    const spin = () => {
      c.azimuthAngle += 0.0016;
      frame = requestAnimationFrame(spin);
    };
    frame = requestAnimationFrame(spin);
    const stop = () => cancelAnimationFrame(frame);
    c.addEventListener("controlstart", stop);
    return () => {
      stop();
      c.removeEventListener("controlstart", stop);
    };
  }, [autoRotate]);

  return <CameraControls ref={controls} makeDefault maxPolarAngle={Math.PI / 2 - 0.04} minDistance={4} maxDistance={360} smoothTime={0.35} dollyToCursor />;
});

export const HouseScene = React.forwardRef<SceneHandle, Props>(function HouseScene(
  { brief, design, maxFloor, cutaway = false, selectedRoom, selectedFurniture, onSelectRoom, onSelectFurniture, intro = false, className, onReady, autoRotate = false },
  ref,
) {
  const hour = design.lighting.hour;
  const { night } = sunAt(hour);
  const lit = night || design.lighting.interior;
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: 34, near: 0.1, far: 2000, position: [80, 60, 80] }}
        gl={{ antialias: false, stencil: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          // Tone mapping happens in the effect chain below.
          gl.toneMapping = THREE.NoToneMapping;
          onReady?.();
        }}
        onPointerMissed={() => {
          onSelectRoom?.(null);
          onSelectFurniture?.(null);
        }}
      >
        <color attach="background" args={[night ? "#1c2026" : "#e9e5dc"]} />
        <fog attach="fog" args={[night ? "#1c2026" : "#e9e5dc", 220, 620]} />
        <Lights hour={hour} night={night} />
        <Site brief={brief} design={design} lit={lit} />
        <HouseModel
          brief={brief}
          design={design}
          maxFloor={maxFloor ?? brief.floors - 1}
          cutaway={cutaway}
          selectedRoom={selectedRoom}
          selectedFurniture={selectedFurniture}
          onSelectRoom={onSelectRoom}
          onSelectFurniture={onSelectFurniture}
          lit={lit}
        />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={3} distanceFalloff={1.2} intensity={night ? 2 : 3.2} quality="medium" halfRes />
          <Bloom luminanceThreshold={night ? 0.85 : 1.1} luminanceSmoothing={0.2} intensity={night ? 0.9 : 0.25} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          <SMAA />
        </EffectComposer>
        <Controller ref={ref} brief={brief} design={design} intro={intro} autoRotate={autoRotate} />
      </Canvas>
    </div>
  );
});
