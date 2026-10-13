"use client";

import * as React from "react";
import * as THREE from "three";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CameraControls } from "@react-three/drei";
import { Bloom, BrightnessContrast, EffectComposer, HueSaturation, N8AO, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { ToneMappingMode } from "postprocessing";
import type { Brief, Design, Room } from "@/lib/types";
import { HouseModel, PLINTH, toWorld } from "./HouseModel";
import { Lights, NightSky, Site, sunAt } from "./Site";
import { buildTour, dirOf, poseOfCamera, type Tour } from "./tour";

export type CameraPreset = "iso" | "aerial" | "front" | "side" | "back" | "top";
export type { Tour, TourChapter } from "./tour";

export interface SceneHandle {
  view(preset: CameraPreset, animate?: boolean): void;
  focusRoom(room: Room, animate?: boolean): void;
  /** Build and start the cinematic walkthrough from the current camera. */
  startTour(): Tour | null;
  stopTour(): void;
  playTour(playing: boolean): void;
  seekTour(t: number): void;
  tourTime(): number;
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
  /** Called when the walkthrough reaches its last frame. */
  onTourEnd?: () => void;
  /** Override the time of day without touching the design (the walkthrough's day/night switch). */
  hour?: number;
}

export { sunAt };

const FOV = 34;

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

interface TourState {
  tour: Tour | null;
  t: number;
  playing: boolean;
  /** Look offset from dragging, eased back to the path while playing. */
  look: { yaw: number; pitch: number };
  idle: number;
  cur: { yaw: number; pitch: number; fov: number };
  snap: boolean;
}

const Controller = React.forwardRef<SceneHandle, { brief: Brief; design: Design; intro: boolean; autoRotate: boolean; onTouring: (on: boolean) => void; onTourEnd?: () => void }>(function Controller({ brief, design, intro, autoRotate, onTouring, onTourEnd }, ref) {
  const controls = React.useRef<CameraControls>(null);
  const { invalidate, size, gl } = useThree();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const aspect = size.width / Math.max(1, size.height);
  const levelZ = (floor: number) => PLINTH + floor * design.floorHeight;
  const tour = React.useRef<TourState>({ tour: null, t: 0, playing: false, look: { yaw: 0, pitch: 0 }, idle: 0, cur: { yaw: 0, pitch: 0, fov: FOV }, snap: true });
  const endRef = React.useRef(onTourEnd);
  endRef.current = onTourEnd;

  const release = () => {
    const c = controls.current;
    const s = tour.current;
    if (!s.tour) return;
    s.tour = null;
    s.playing = false;
    camera.fov = FOV;
    camera.updateProjectionMatrix();
    if (c) {
      c.enabled = true;
      const d = new THREE.Vector3();
      camera.getWorldDirection(d);
      const p = camera.position;
      // Hand the pose back to the orbit controls, looking at a point ahead.
      const reach = Math.max(8, p.y * 0.8);
      void c.setLookAt(p.x, p.y, p.z, p.x + d.x * reach, p.y + d.y * reach, p.z + d.z * reach, false);
    }
    onTouring(false);
    invalidate();
  };

  React.useImperativeHandle(ref, () => ({
    view(preset, animate = true) {
      const c = controls.current;
      if (!c) return;
      if (tour.current.tour) release();
      const [p, t] = poseFor(preset, brief, design, aspect);
      c.minDistance = 4;
      void c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, animate);
      invalidate();
    },
    focusRoom(room, animate = true) {
      const c = controls.current;
      if (!c) return;
      if (tour.current.tour) release();
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
    startTour() {
      const c = controls.current;
      if (!c) return null;
      c.stop?.();
      const start = poseOfCamera(camera);
      const built = buildTour(brief, design, start, aspect);
      const s = tour.current;
      Object.assign(s, { tour: built, t: 0, playing: true, look: { yaw: 0, pitch: 0 }, idle: 0, cur: { yaw: start.yaw, pitch: start.pitch, fov: start.fov }, snap: true });
      c.enabled = false;
      onTouring(true);
      return built;
    },
    stopTour: release,
    playTour(playing) {
      const s = tour.current;
      if (!s.tour) return;
      if (playing && s.t >= s.tour.duration) s.t = 0;
      s.playing = playing;
    },
    seekTour(t) {
      const s = tour.current;
      if (!s.tour) return;
      s.t = THREE.MathUtils.clamp(t, 0, s.tour.duration);
      s.snap = true;
      s.look = { yaw: 0, pitch: 0 };
    },
    tourTime: () => tour.current.t,
  }));

  // Drag to look around, in any direction, while the walkthrough plays or is paused.
  React.useEffect(() => {
    const el = gl.domElement;
    let drag: { x: number; y: number; id: number } | null = null;
    const down = (e: PointerEvent) => {
      if (!tour.current.tour) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      el.setPointerCapture?.(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      const s = tour.current;
      if (!drag || !s.tour || e.pointerId !== drag.id) return;
      const k = (camera.fov / 60) * 0.0055;
      s.look.yaw += (e.clientX - drag.x) * k;
      s.look.pitch = THREE.MathUtils.clamp(s.look.pitch + (e.clientY - drag.y) * k * 0.8, -1.1, 1.1);
      s.idle = 0;
      drag = { ...drag, x: e.clientX, y: e.clientY };
    };
    const up = () => {
      drag = null;
    };
    const wheel = (e: WheelEvent) => {
      const s = tour.current;
      if (!s.tour) return;
      e.preventDefault();
      s.cur.fov = THREE.MathUtils.clamp(s.cur.fov + e.deltaY * 0.02, 24, 90);
    };
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      el.removeEventListener("wheel", wheel);
    };
  }, [gl, camera]);

  // The walkthrough drives the camera after the orbit controls have updated.
  const pose = React.useMemo(() => ({ p: new THREE.Vector3(), yaw: 0, pitch: 0, fov: FOV }), []);
  const ahead = React.useMemo(() => new THREE.Vector3(), []);
  useFrame((_, delta) => {
    const s = tour.current;
    if (!s.tour) return;
    const dt = Math.min(delta, 0.1);
    if (s.playing) {
      s.t += dt;
      if (s.t >= s.tour.duration) {
        s.t = s.tour.duration;
        s.playing = false;
        endRef.current?.();
      }
    }
    s.tour.at(s.t, pose);
    // Smooth heading and lens a touch; snap after a seek.
    const k = s.snap ? 1 : 1 - Math.exp(-dt / 0.16);
    s.cur.yaw += (pose.yaw - s.cur.yaw) * k;
    s.cur.pitch += (pose.pitch - s.cur.pitch) * k;
    s.cur.fov += (pose.fov - s.cur.fov) * (s.snap ? 1 : 1 - Math.exp(-dt / 0.6));
    s.snap = false;
    // Let go of a drag and the view eases back onto the path.
    s.idle += dt;
    if (s.playing && s.idle > 1.6) {
      const e = Math.exp(-dt * 1.4);
      s.look.yaw *= e;
      s.look.pitch *= e;
    }
    camera.position.copy(pose.p);
    dirOf(s.cur.yaw + s.look.yaw, THREE.MathUtils.clamp(s.cur.pitch + s.look.pitch, -1.35, 1.35), ahead);
    camera.lookAt(ahead.add(pose.p));
    if (Math.abs(camera.fov - s.cur.fov) > 0.01) {
      camera.fov = s.cur.fov;
      camera.updateProjectionMatrix();
    }
  });

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
      if (!tour.current.tour) c.azimuthAngle += 0.0016;
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
  { brief, design, maxFloor, cutaway = false, selectedRoom, selectedFurniture, onSelectRoom, onSelectFurniture, intro = false, className, onReady, autoRotate = false, onTourEnd, hour: hourOverride },
  ref,
) {
  const hour = hourOverride ?? design.lighting.hour;
  const { night, golden } = sunAt(hour);
  const [touring, setTouring] = React.useState(false);
  // Interiors are shown lit during the walkthrough, as they would be photographed.
  const lit = night || design.lighting.interior || touring;
  const bg = night ? "#141a2a" : "#e9e5dc";
  return (
    <div className={className}>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        camera={{ fov: FOV, near: 0.1, far: 2400, position: [80, 60, 80] }}
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
        <color attach="background" args={[bg]} />
        <fog attach="fog" args={[night ? "#1f2536" : "#e9e5dc", night ? 170 : 220, night ? 680 : 620]} />
        <Lights hour={hour} night={night} />
        {night ? <NightSky /> : null}
        <Site brief={brief} design={design} lit={lit} night={night} />
        <HouseModel
          brief={brief}
          design={design}
          maxFloor={touring ? brief.floors - 1 : (maxFloor ?? brief.floors - 1)}
          cutaway={touring ? false : cutaway}
          selectedRoom={touring ? null : selectedRoom}
          selectedFurniture={selectedFurniture}
          onSelectRoom={onSelectRoom}
          onSelectFurniture={onSelectFurniture}
          lit={lit}
          night={night}
          entryOpen={touring}
        />
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <N8AO aoRadius={2.4} distanceFalloff={1} intensity={night ? 1.8 : 2.1} quality="medium" halfRes />
          <Bloom luminanceThreshold={night ? 0.7 : 1.05} luminanceSmoothing={0.25} intensity={night ? 1.25 : 0.3} radius={0.8} mipmapBlur />
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
          {/* A light grade toward a rendered-photo look: warmer, slightly richer. */}
          <HueSaturation saturation={night ? 0.06 : golden ? 0.12 : 0.1} hue={0} />
          <BrightnessContrast brightness={night ? 0 : 0.015} contrast={night ? 0.08 : 0.07} />
          <Vignette offset={0.32} darkness={night ? 0.62 : 0.38} eskil={false} />
          <SMAA />
        </EffectComposer>
        <Controller ref={ref} brief={brief} design={design} intro={intro} autoRotate={autoRotate} onTouring={setTouring} onTourEnd={onTourEnd} />
      </Canvas>
    </div>
  );
});
