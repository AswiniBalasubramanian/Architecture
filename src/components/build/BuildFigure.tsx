"use client";

import * as React from "react";
import { pathOf, translateAlong } from "@/components/iso/iso-kit";
import { Line, Solid } from "@/components/iso/react/draw";
import { asksForStillness, useInView } from "@/components/iso/react/live";
import type { Brief, Design } from "@/lib/types";
import { buildScene, cranePaths, U, VIEW_H, VIEW_W, type BuildScene, type CranePose } from "./geometry";

interface Props {
  brief: Brief;
  design: Design;
  /** Autoplay from the start; false shows the finished model. */
  autoplay?: boolean;
  /** Called when the build reaches a new stage. */
  onStage?: (index: number, scene: BuildScene) => void;
  onDone?: () => void;
  /** Speed multiplier. */
  speed?: number;
  className?: string;
  fig?: string;
  compact?: boolean;
  /** Freeze at this many seconds (for previews and tests). */
  at?: number;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

export function BuildFigure({ brief, design, autoplay = true, onStage, onDone, speed = 1, className, fig = "Fig. 1", compact = false, at }: Props) {
  // Keyed on content, so a parent that rebuilds equal objects doesn't restart the build.
  const signature = JSON.stringify([brief, design.rooms, design.roof, design.footprint, design.floorHeight, design.direction]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = React.useMemo(() => buildScene(brief, design), [signature]);
  const stageRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const pieceRefs = React.useRef<Array<SVGGElement | null>>([]);
  const craneFront = React.useRef<SVGGElement>(null);
  const craneBackRef = React.useRef<SVGGElement>(null);
  const readout = React.useRef<HTMLSpanElement>(null);
  const progress = React.useRef<HTMLSpanElement>(null);
  const visible = useInView(stageRef);
  const [stageIndex, setStageIndex] = React.useState(autoplay ? 0 : scene.stages.length - 1);
  const [paused, setPaused] = React.useState(!autoplay);

  const state = React.useRef({
    clock: autoplay ? 0 : scene.duration,
    playing: autoplay,
    pose: { angle: Math.PI / 4, radius: scene.crane.reach * 0.6, hookZ: scene.crane.top - 6 * U } as CranePose,
    stage: -1,
    done: !autoplay,
    last: new Map<number, string>(),
  });

  const onStageRef = React.useRef(onStage);
  const onDoneRef = React.useRef(onDone);
  onStageRef.current = onStage;
  onDoneRef.current = onDone;

  // Crane: rebuild the slewing parts each frame from the pose.
  const drawCrane = React.useCallback(
    (pose: CranePose, alpha: number) => {
      const g = craneFront.current;
      if (!g) return;
      const c = cranePaths(scene.crane, pose, scene.P);
      const set = (sel: string, d: string) => g.querySelectorAll<SVGPathElement>(sel).forEach((el) => el.setAttribute("d", d));
      const solid = (name: string, paths: ReturnType<typeof cranePaths>["jib"]) => {
        set(`[data-c="${name}"] .iso-fill`, paths.fill);
        set(`[data-c="${name}"] .iso-top`, paths.top);
        set(`[data-c="${name}"] .iso-crease`, paths.crease);
        set(`[data-c="${name}"] .iso-edge`, paths.outline);
        paths.shades.forEach((d, i) => set(`[data-c="${name}"] [data-shade="${i}"]`, d));
      };
      solid("counter", c.counter);
      solid("w0", c.weights[0]!);
      solid("w1", c.weights[1]!);
      solid("apex", c.apex);
      solid("cab", c.cab);
      solid("jib", c.jib);
      solid("trolley", c.trolley);
      solid("block", c.block);
      set('[data-c="web"]', c.web);
      set('[data-c="ties"]', c.ties);
      set('[data-c="line"]', c.line);
      const pin = g.querySelector<SVGCircleElement>('[data-c="pin"]');
      pin?.setAttribute("cx", c.hookPin[0].toFixed(1));
      pin?.setAttribute("cy", c.hookPin[1].toFixed(1));
      const op = alpha.toFixed(3);
      g.style.opacity = op;
      if (craneBackRef.current) craneBackRef.current.style.opacity = op;
    },
    [scene],
  );

  const render = React.useCallback(
    (dt: number, calm: boolean) => {
      const s = state.current;
      const clock = s.clock;
      // Pieces.
      scene.pieces.forEach((piece, index) => {
        const el = pieceRefs.current[index];
        if (!el) return;
        const t = clamp01((clock - piece.at) / piece.dur);
        const e = calm ? (clock >= piece.at ? 1 : 0) : easeOut(t);
        let key: string;
        if (clock < piece.at) key = "h";
        else if (t >= 1 || calm) key = "p";
        else key = `m${e.toFixed(3)}`;
        if (s.last.get(index) === key) return;
        s.last.set(index, key);
        if (key === "h") {
          el.style.opacity = "0";
          el.removeAttribute("transform");
          return;
        }
        el.style.opacity = piece.mode === "fade" || piece.mode === "rise" ? String(e) : String(Math.min(1, t * 5 + (key === "p" ? 1 : 0)));
        if (piece.mode === "drop") el.setAttribute("transform", key === "p" ? "" : translateAlong(scene.P, [0, 0, piece.lift * (1 - e)]));
        else if (piece.mode === "rise") el.setAttribute("transform", key === "p" ? "" : translateAlong(scene.P, [0, 0, 2.4 * U * (1 - e)]));
        else if (piece.mode === "draw") el.style.setProperty("--draw", String(1 - e));
      });

      // Which stage are we in?
      let stage = 0;
      scene.stages.forEach((st, i) => {
        if (clock >= st.at) stage = i;
      });
      if (stage !== s.stage) {
        s.stage = stage;
        setStageIndex(stage);
        if (readout.current) readout.current.textContent = scene.stages[stage]!.readout;
        svgRef.current?.toggleAttribute("data-glow", scene.stages[stage]!.pipeline === "WebGL light" || scene.stages[stage]!.pipeline === "3D model");
        onStageRef.current?.(stage, scene);
      }
      if (progress.current) progress.current.style.transform = `scaleX(${clamp01(clock / scene.duration).toFixed(4)})`;

      // Crane: aim at the piece it is carrying (or about to).
      const carrying = scene.pieces.filter((p) => p.hook && clock >= p.at - 0.55 && clock <= p.at + p.dur * 0.8).pop();
      const pose = s.pose;
      if (carrying && carrying.hook) {
        const [hx, hy, hz] = carrying.hook;
        const [mx, my] = scene.crane.mast;
        const angle = Math.atan2(hy - my, hx - mx);
        const radius = Math.hypot(hx - mx, hy - my);
        const t = clamp01((clock - carrying.at) / carrying.dur);
        const lifted = clock < carrying.at ? carrying.lift : carrying.lift * (1 - easeOut(t));
        const hookZ = Math.min(scene.crane.top - 3 * U, hz + lifted + 0.2 * U);
        const k = calm ? 1 : 1 - Math.exp(-dt / 0.16);
        pose.angle += (angle - pose.angle) * k;
        pose.radius += (radius - pose.radius) * k;
        pose.hookZ = clock >= carrying.at ? hookZ : pose.hookZ + (hookZ - pose.hookZ) * k;
      } else if (!calm) {
        const k = 1 - Math.exp(-dt / 0.5);
        pose.hookZ += (scene.crane.top - 5 * U - pose.hookZ) * k;
      }
      const last = scene.stages[scene.stages.length - 1]!;
      const craneAlpha = 1 - clamp01((clock - last.at) / 0.8);
      drawCrane(pose, craneAlpha);
    },
    [scene, drawCrane],
  );

  // Loop.
  React.useEffect(() => {
    if (!visible) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
      last = now;
      const s = state.current;
      const calm = asksForStillness();
      if (s.playing) {
        s.clock = calm ? scene.duration : Math.min(scene.duration, s.clock + dt * speed);
        if (s.clock >= scene.duration && !s.done) {
          s.done = true;
          s.playing = false;
          setPaused(true);
          onDoneRef.current?.();
        }
      }
      render(dt, calm);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [visible, render, scene, speed]);

  // A new scene (another direction) starts again from the first stage.
  React.useEffect(() => {
    const s = state.current;
    s.clock = at ?? (autoplay ? 0 : scene.duration);
    s.playing = at === undefined && autoplay;
    s.done = !s.playing;
    s.stage = -1;
    s.last.clear();
    setPaused(!s.playing);
    // Draw at once: rAF doesn't run in hidden tabs, and the first frame shouldn't wait.
    for (let i = 0; i < (at === undefined ? 1 : 90); i++) render(1 / 30, false);
  }, [scene, autoplay, at, render]);

  // Scrubbing.
  const scrubTo = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const s = state.current;
    s.clock = clamp01((clientX - rect.left) / rect.width) * scene.duration;
    s.playing = false;
    setPaused(true);
    render(1 / 30, false);
  };
  const drag = React.useRef(false);
  const toggle = () => {
    const s = state.current;
    if (s.clock >= scene.duration) {
      s.clock = 0;
      s.done = false;
      s.last.clear();
    }
    s.playing = !s.playing;
    setPaused(!s.playing);
  };
  const stepStage = (delta: number) => {
    const s = state.current;
    const next = Math.min(scene.stages.length - 1, Math.max(0, s.stage + delta));
    s.clock = delta > 0 && next === scene.stages.length - 1 ? scene.duration : scene.stages[next]!.at + 0.9;
    s.playing = false;
    setPaused(true);
  };

  const stage = scene.stages[stageIndex] ?? scene.stages[0]!;
  const crane0 = cranePaths(scene.crane, state.current.pose, scene.P);

  const backPieces = scene.pieces.slice(0, 2);
  const restPieces = scene.pieces.slice(2);

  return (
    <figure className={`iso af-iso iso-figure ${className ?? ""}`} data-theme="light">
      <div className="iso-plate relative overflow-hidden">
        <div className="iso-plate-corners" aria-hidden="true">
          <span className="iso-plate-corner" data-corner="fig">
            {fig}
          </span>
          <span className="iso-plate-corner" data-corner="title">
            {stage.label}
          </span>
          <span className="iso-plate-corner" data-corner="hint">
            {compact ? "drag to scrub" : "drag to scrub · ← → stages · space"}
          </span>
          <span className="iso-plate-corner" data-corner="readout" data-readout="" ref={readout}>
            {stage.readout}
          </span>
        </div>
        <div
          ref={stageRef}
          className="iso-stage outline-none"
          tabIndex={0}
          role="slider"
          aria-label="Construction sequence. Drag or use the arrow keys to move through the stages; space plays or pauses."
          aria-valuemin={1}
          aria-valuemax={scene.stages.length}
          aria-valuenow={stageIndex + 1}
          aria-valuetext={`Stage ${stageIndex + 1} of ${scene.stages.length}: ${stage.label}`}
          style={{ touchAction: "pan-y", cursor: "ew-resize" }}
          onPointerDown={(event) => {
            drag.current = true;
            (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
            scrubTo(event.clientX);
          }}
          onPointerMove={(event) => drag.current && scrubTo(event.clientX)}
          onPointerUp={() => (drag.current = false)}
          onPointerCancel={() => (drag.current = false)}
          onKeyDown={(event) => {
            if (event.key === "ArrowRight") stepStage(1);
            else if (event.key === "ArrowLeft") stepStage(-1);
            else if (event.key === " " || event.key === "Enter") toggle();
            else if (event.key === "Home") stepStage(-99);
            else if (event.key === "End") stepStage(99);
            else return;
            event.preventDefault();
          }}
        >
          <svg ref={svgRef} className="iso-svg af-build" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={scene.label} focusable="false">
            {backPieces.map((piece, index) => (
              <g key={piece.key} ref={(el) => void (pieceRefs.current[index] = el)} className={piece.mode === "draw" ? "af-draw" : undefined}>
                {piece.node}
              </g>
            ))}
            <g ref={craneBackRef}>{scene.crane.back}</g>
            {restPieces.map((piece, i) => {
              const index = i + 2;
              return (
                <g key={piece.key} ref={(el) => void (pieceRefs.current[index] = el)} className={piece.mode === "draw" ? "af-draw" : undefined} style={{ opacity: autoplay ? 0 : 1 }}>
                  {piece.node}
                </g>
              );
            })}
            <g ref={craneFront}>
              <g data-c="counter">
                <Solid paths={crane0.counter} tone="mid" />
              </g>
              <g data-c="w0">
                <Solid paths={crane0.weights[0]!} tone="mid" />
              </g>
              <g data-c="w1">
                <Solid paths={crane0.weights[1]!} tone="mid" />
              </g>
              <g data-c="cab">
                <Solid paths={crane0.cab} tone="mid" />
              </g>
              <g data-c="apex">
                <Solid paths={crane0.apex} tone="mid" />
              </g>
              <path data-c="ties" className="iso-line" data-tone="mid" d={crane0.ties} />
              <g data-c="jib">
                <Solid paths={crane0.jib} tone="mid" inner={null} />
              </g>
              <path data-c="web" className="iso-line" data-tone="lo" d={crane0.web} />
              <g data-c="trolley">
                <Solid paths={crane0.trolley} tone="hi" lit />
              </g>
              <path data-c="line" className="iso-line" data-tone="hi" d={crane0.line} />
              <g data-c="block">
                <Solid paths={crane0.block} tone="hi" lit />
              </g>
              <circle data-c="pin" className="iso-wire-end" r={1.1} cx={crane0.hookPin[0]} cy={crane0.hookPin[1]} />
            </g>
            {/* A faint world-space ground line ties the card to the board. */}
            <Line d={pathOf([[0, VIEW_H - 0.5], [VIEW_W, VIEW_H - 0.5]])} tone="faint" free />
          </svg>
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] bg-[var(--anatomy-faint)]">
          <span ref={progress} className="block h-full origin-left bg-[var(--anatomy-lit)]" style={{ transform: `scaleX(${autoplay ? 0 : 1})` }} />
        </div>
      </div>
      {compact ? null : (
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 px-1 font-mono text-[11px] uppercase tracking-[0.08em] text-muted">
          <button type="button" onClick={toggle} className="rounded-md border border-line bg-card px-2 py-1 text-ink-2 transition active:translate-y-[1px] hover:border-line-strong">
            {paused ? (state.current.clock >= scene.duration ? "Replay" : "Play") : "Pause"}
          </button>
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {scene.stages.map((st, i) => (
              <li key={st.label}>
                <button
                  type="button"
                  onClick={() => {
                    state.current.clock = i === scene.stages.length - 1 ? scene.duration : st.at + 0.9;
                    state.current.playing = false;
                    setPaused(true);
                  }}
                  className={i === stageIndex ? "text-ink" : i < stageIndex ? "text-ink-2" : "text-faint hover:text-muted"}
                >
                  <span className="mr-1 tnum">{String(i + 1).padStart(2, "0")}</span>
                  {st.short}
                </button>
              </li>
            ))}
          </ol>
          <span className="ml-auto normal-case tracking-normal text-faint">{stage.pipeline}</span>
        </figcaption>
      )}
    </figure>
  );
}
