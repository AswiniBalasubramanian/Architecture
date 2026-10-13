"use client";

import * as React from "react";
import clsx from "clsx";
import { ArrowsOutCardinal, CaretLeft, CaretRight, Pause, Play, X } from "@phosphor-icons/react";
import { fmtFt } from "@/components/plan/FloorPlan";
import type { SceneHandle, Tour } from "@/components/three/HouseScene";
import type { Design } from "@/lib/types";

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function chapterIndex(tour: Tour, t: number) {
  let k = 0;
  tour.chapters.forEach((c, i) => {
    if (c.t <= t + 0.05) k = i;
  });
  return k;
}

/**
 * The cinematic walkthrough player: letterbox, chapter caption, a scrubbable
 * timeline with chapter ticks, and transport controls. The camera itself is
 * driven inside the canvas; this only reads its clock.
 */
export function Walkthrough({ scene, design, tour, onExit, ended }: { scene: React.RefObject<SceneHandle | null>; design: Design; tour: Tour; onExit: () => void; ended: boolean }) {
  const [playing, setPlaying] = React.useState(true);
  const [chapter, setChapter] = React.useState(0);
  const [hint, setHint] = React.useState(true);
  const fill = React.useRef<HTMLSpanElement>(null);
  const time = React.useRef<HTMLSpanElement>(null);
  const bar = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (ended) setPlaying(false);
  }, [ended]);

  // Read the camera clock every frame; re-render only when the chapter changes.
  React.useEffect(() => {
    let frame = 0;
    let last = -1;
    const loop = () => {
      const t = scene.current?.tourTime() ?? 0;
      if (fill.current) fill.current.style.transform = `scaleX(${Math.min(1, t / tour.duration)})`;
      if (time.current) time.current.textContent = `${clock(t)} / ${clock(tour.duration)}`;
      const k = chapterIndex(tour, t);
      if (k !== last) {
        last = k;
        setChapter(k);
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [scene, tour]);

  React.useEffect(() => {
    const t = window.setTimeout(() => setHint(false), 6000);
    return () => window.clearTimeout(t);
  }, []);

  const play = (p: boolean) => {
    scene.current?.playTour(p);
    setPlaying(p);
  };
  const seek = (t: number) => scene.current?.seekTour(t);
  const jump = (k: number) => {
    const c = tour.chapters[Math.max(0, Math.min(tour.chapters.length - 1, k))];
    if (c) seek(c.t + 0.01);
  };

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === " ") {
        e.preventDefault();
        play(!playing);
      }
      if (e.key === "ArrowRight") jump(chapter + 1);
      if (e.key === "ArrowLeft") jump(scene.current && scene.current.tourTime() - (tour.chapters[chapter]?.t ?? 0) > 1.5 ? chapter : chapter - 1);
      if (e.key === "Escape") onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const scrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = bar.current?.getBoundingClientRect();
    if (!r) return;
    seek(((e.clientX - r.left) / r.width) * tour.duration);
  };

  const c = tour.chapters[chapter];
  const room = c?.roomId ? design.rooms.find((r) => r.id === c.roomId) : undefined;

  return (
    <>
      {/* Letterbox: a cinematic frame while the walkthrough plays. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[7vh] bg-gradient-to-b from-[#0f1112]/85 to-transparent af-fade" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[30vh] bg-gradient-to-t from-[#0f1112]/80 via-[#0f1112]/30 to-transparent af-fade" />

      {/* Chapter caption */}
      {c ? (
        <div key={chapter} className="af-caption pointer-events-none absolute bottom-[132px] left-5 right-5 md:bottom-[124px] md:left-10" aria-live="polite">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-white/60">
            {String(chapter + 1).padStart(2, "0")} / {String(tour.chapters.length).padStart(2, "0")} · {c.detail}
          </p>
          <h2 className="mt-1.5 font-display text-[34px] leading-none tracking-[-0.01em] text-white md:text-[52px]">{c.title}</h2>
          {room ? (
            <p className="tnum mt-2 font-mono text-[12px] text-white/70">
              {fmtFt(room.w)} × {fmtFt(room.d)} · {Math.round(room.w * room.d)} ft²
            </p>
          ) : null}
        </div>
      ) : null}

      {/* Look-around hint */}
      <div className={clsx("pointer-events-none absolute left-1/2 top-[12vh] flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-3.5 py-1.5 text-[12px] text-white/85 backdrop-blur transition-opacity duration-700", hint ? "opacity-100" : "opacity-0")}>
        <ArrowsOutCardinal size={14} /> Drag to look around 360° · scroll to zoom
      </div>

      {/* Transport */}
      <div className="absolute inset-x-3 bottom-3 md:inset-x-10 md:bottom-6">
        <div
          ref={bar}
          role="slider"
          aria-label="Walkthrough position"
          aria-valuemin={0}
          aria-valuemax={Math.round(tour.duration)}
          tabIndex={0}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            scrub(e);
          }}
          onPointerMove={(e) => e.buttons === 1 && scrub(e)}
          className="group relative h-6 cursor-pointer touch-none"
        >
          <span className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <span ref={fill} className="block h-full origin-left bg-white" style={{ transform: "scaleX(0)" }} />
          </span>
          {tour.chapters.map((ch, i) => (
            <button
              key={i}
              type="button"
              title={ch.title}
              aria-label={`Go to ${ch.title}`}
              onPointerDown={(e) => {
                e.stopPropagation();
                jump(i);
              }}
              className={clsx("absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border transition", i === chapter ? "scale-125 border-white bg-white" : "border-white/70 bg-[#0f1112]/80 hover:bg-white/60")}
              style={{ left: `${(ch.t / tour.duration) * 100}%` }}
            />
          ))}
        </div>
        <div className="mt-1 flex items-center gap-1 text-white">
          <button type="button" aria-label="Previous chapter" onClick={() => jump(chapter - 1)} className="flex size-10 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95">
            <CaretLeft size={18} />
          </button>
          <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => play(!playing)} className="flex size-11 items-center justify-center rounded-full bg-white text-[#141615] transition hover:bg-white/90 active:scale-95">
            {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
          </button>
          <button type="button" aria-label="Next chapter" onClick={() => jump(chapter + 1)} className="flex size-10 items-center justify-center rounded-full transition hover:bg-white/10 active:scale-95">
            <CaretRight size={18} />
          </button>
          <span ref={time} className="tnum ml-2 font-mono text-[12px] text-white/70">
            0:00
          </span>
          <div className="ml-auto hidden max-w-[50vw] gap-1 overflow-x-auto [scrollbar-width:none] md:flex">
            {tour.chapters.map((ch, i) => (
              <button key={i} type="button" onClick={() => jump(i)} className={clsx("shrink-0 rounded-full px-3 py-1.5 text-[12px] transition", i === chapter ? "bg-white/90 text-[#141615]" : "text-white/70 hover:bg-white/10 hover:text-white")}>
                {ch.title}
              </button>
            ))}
          </div>
          <button type="button" onClick={onExit} className="ml-2 flex h-10 items-center gap-1.5 rounded-full border border-white/25 px-4 text-[13px] transition hover:bg-white/10 active:scale-95">
            <X size={14} /> Exit
          </button>
        </div>
      </div>
    </>
  );
}
