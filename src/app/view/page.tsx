"use client";

import * as React from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, ArrowsIn, ArrowsOut, CaretLeft, FilmSlate, Stack, X } from "@phosphor-icons/react";
import { BuildFigure } from "@/components/build/BuildFigure";
import { fmtFt } from "@/components/plan/FloorPlan";
import type { CameraPreset, SceneHandle, Tour } from "@/components/three/HouseScene";
import { Walkthrough } from "@/components/Walkthrough";
import { LazyHouseScene, webglAvailable } from "@/components/three/LazyScene";
import { Button, Eyebrow, IconButton, Logo, buttonClass } from "@/components/ui/kit";
import { HOUSE_TYPES, MATERIALS, SLOTS, floorName } from "@/lib/catalog";
import { statsOf } from "@/lib/generator";
import { decodeShare } from "@/lib/persist";
import { sqft } from "@/lib/projects";
import { rememberViewed } from "@/lib/session";
import type { MaterialSlot, Room, SharedProject } from "@/lib/types";

function Invalid() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-start justify-center gap-5 px-6 md:px-[12vw]">
      <Logo />
      <h1 className="max-w-[24ch] text-[30px] font-medium leading-tight tracking-[-0.02em]">This link doesn&apos;t contain a project we can open.</h1>
      <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-2">It may have been cut short when it was copied. Ask the architect to send the full link again; it is long, because the design travels inside it.</p>
      <Link href="/" className={buttonClass("secondary", "lg")}>
        About ARCHFORM
      </Link>
    </div>
  );
}

function Cover({ data, onEnter }: { data: SharedProject; onEnter: () => void }) {
  const s = statsOf(data.design, data.brief.floors);
  return (
    <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
      <div className="flex flex-col justify-between gap-10 px-6 py-8 md:px-12 md:py-12">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted">{data.architect}</span>
          <span className="font-mono text-[11px] text-faint">{new Date(data.sharedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
        </div>
        <div className="af-enter flex flex-col gap-6">
          <Eyebrow>{data.brief.location}</Eyebrow>
          <h1 className="font-display text-[48px] leading-[0.95] tracking-[-0.02em] md:text-[72px]">{data.name}</h1>
          <p className="max-w-[44ch] text-[16px] leading-relaxed text-ink-2">
            A {data.brief.floors > 1 ? `${data.brief.floors}-storey` : "single-storey"} {HOUSE_TYPES[data.brief.houseType].label.toLowerCase()} of {sqft(s.total)} on a {data.brief.plotWidth} × {data.brief.plotDepth} ft plot, with {s.bedrooms} bedrooms and {s.baths} baths.
          </p>
          <dl className="grid max-w-[480px] grid-cols-2 gap-y-4 border-t border-line pt-5 sm:grid-cols-4">
            {[
              ["Area", sqft(s.total)],
              ["Floors", String(data.brief.floors)],
              ["Bedrooms", String(s.bedrooms)],
              ["Baths", String(s.baths)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1">
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{k}</dt>
                <dd className="tnum text-[15px]">{v}</dd>
              </div>
            ))}
          </dl>
          <div>
            <Button variant="primary" size="lg" onClick={onEnter}>
              Explore the house <ArrowRight size={16} weight="bold" />
            </Button>
          </div>
        </div>
        <p className="max-w-[56ch] text-[12px] leading-relaxed text-faint">Concept visualisation prepared by {data.architect}. Layout, finishes and dimensions are indicative and subject to detailed design and approvals.</p>
      </div>
      <div className="af-grid flex items-center border-t border-line p-4 md:p-10 lg:border-l lg:border-t-0">
        <BuildFigure brief={data.brief} design={data.design} fig="Site model" compact className="af-enter w-full [animation-delay:150ms]" />
      </div>
    </div>
  );
}

function Explorer({ data, onExit }: { data: SharedProject; onExit: () => void }) {
  const { brief, design } = data;
  const scene = React.useRef<SceneHandle>(null);
  const root = React.useRef<HTMLDivElement>(null);
  const [floor, setFloor] = React.useState<number>(brief.floors - 1);
  const [isolate, setIsolate] = React.useState(false);
  const [roomId, setRoomId] = React.useState<string | null>(null);
  const [tour, setTour] = React.useState<Tour | null>(null);
  const [ended, setEnded] = React.useState(false);
  const [full, setFull] = React.useState(false);
  const [panel, setPanel] = React.useState<"rooms" | "finishes" | null>("rooms");
  const [gl, setGl] = React.useState(true);
  React.useEffect(() => setGl(webglAvailable()), []);
  const s = statsOf(design, brief.floors);
  const room = design.rooms.find((r) => r.id === roomId);

  const focus = (r: Room) => {
    setRoomId(r.id);
    setIsolate(false);
    scene.current?.focusRoom(r);
  };

  React.useEffect(() => {
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const startTour = () => {
    setRoomId(null);
    setIsolate(false);
    setEnded(false);
    setTour(scene.current?.startTour() ?? null);
  };
  const endTour = () => {
    scene.current?.stopTour();
    setTour(null);
    setEnded(false);
  };

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void root.current?.requestFullscreen?.().catch(() => undefined);
  };

  const walking = tour !== null;

  return (
    <div ref={root} className="relative h-[100dvh] w-full overflow-hidden bg-sand">
      {gl ? (
        <LazyHouseScene ref={scene} brief={brief} design={design} intro onTourEnd={() => setEnded(true)} maxFloor={isolate && !walking ? floor : brief.floors - 1} cutaway={isolate && !walking} selectedRoom={roomId} onSelectRoom={(id) => setRoomId(id)} className="absolute inset-0" />
      ) : (
        <div className="flex h-full items-center justify-center p-8 text-center text-[14px] text-muted">3D needs WebGL, which is turned off in this browser. Room details and finishes are listed on the left.</div>
      )}

      {/* Top bar */}
      <div className={clsx("pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-3 transition-opacity duration-500 md:p-4", walking && "opacity-0 [&_*]:!pointer-events-none")}>
        <div className="pointer-events-auto flex items-center gap-3 rounded-2xl border border-line bg-card/95 py-2 pl-3 pr-4 shadow-[var(--shadow-lift)] backdrop-blur">
          <IconButton label="Back to cover" onClick={onExit}>
            <CaretLeft size={16} />
          </IconButton>
          <div className="flex min-w-0 flex-col leading-tight">
            <span className="truncate text-[14px] font-medium">{data.name}</span>
            <span className="truncate text-[11px] text-muted">by {data.architect}</span>
          </div>
        </div>
        <div className="pointer-events-auto flex flex-wrap items-center justify-end gap-1 rounded-2xl border border-line bg-card/95 p-1 shadow-[var(--shadow-lift)] backdrop-blur">
          {(["aerial", "front", "side", "back"] as CameraPreset[]).map((p) => (
            <button key={p} type="button" onClick={() => scene.current?.view(p)} className="hidden rounded-lg px-2.5 py-1.5 text-[12px] capitalize text-ink-2 transition hover:bg-stone sm:block">
              {p}
            </button>
          ))}
          <span className="mx-0.5 hidden h-4 w-px bg-line sm:block" />
          <Button size="sm" variant="primary" onClick={startTour}>
            <FilmSlate size={14} weight="fill" />
            Walkthrough
          </Button>
          <IconButton label={full ? "Exit full screen" : "Full screen"} onClick={toggleFull}>
            {full ? <ArrowsIn size={16} /> : <ArrowsOut size={16} />}
          </IconButton>
        </div>
      </div>

      {/* Floors */}
      <div className={clsx("absolute right-3 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-2xl border border-line bg-card/95 p-1 shadow-[var(--shadow-lift)] backdrop-blur transition-opacity duration-500 md:right-4", walking && "pointer-events-none opacity-0")} role="group" aria-label="Floors">
        <span className="flex justify-center py-1 text-muted" title="Isolate a floor">
          <Stack size={15} />
        </span>
        {Array.from({ length: brief.floors }, (_, f) => brief.floors - 1 - f).map((f) => (
          <button key={f} type="button" aria-pressed={isolate && floor === f} onClick={() => (isolate && floor === f ? setIsolate(false) : (setFloor(f), setIsolate(true), setTour(null), scene.current?.view("aerial")))} className={clsx("rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition", isolate && floor === f ? "bg-ink text-paper" : "text-ink-2 hover:bg-stone")}>
            {f === 0 ? "GF" : `L${f}`}
          </button>
        ))}
        <button type="button" aria-pressed={!isolate} onClick={() => setIsolate(false)} className={clsx("rounded-lg px-2.5 py-1.5 font-mono text-[11px] transition", !isolate ? "bg-moss-soft text-moss-2" : "text-muted hover:bg-stone")}>
          All
        </button>
      </div>

      {/* Left panel: rooms and finishes */}
      {panel && !walking ? (
        <aside className="af-enter absolute bottom-3 left-3 top-[76px] flex w-[min(300px,calc(100vw-90px))] flex-col overflow-hidden rounded-2xl border border-line bg-card/95 shadow-[var(--shadow-lift)] backdrop-blur md:bottom-4 md:left-4">
          <div className="flex items-center justify-between border-b border-line p-1.5">
            <div className="flex">
              {(["rooms", "finishes"] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPanel(p)} className={clsx("rounded-lg px-3 py-1.5 text-[13px] capitalize transition", panel === p ? "bg-sand text-ink" : "text-muted hover:text-ink")}>
                  {p}
                </button>
              ))}
            </div>
            <IconButton label="Hide panel" onClick={() => setPanel(null)}>
              <X size={14} />
            </IconButton>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {panel === "rooms" ? (
              Array.from({ length: brief.floors }, (_, f) => (
                <div key={f} className="border-b border-line py-2 last:border-b-0">
                  <p className="px-4 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{floorName(f)}</p>
                  {design.rooms
                    .filter((r) => r.floor === f && r.type !== "void")
                    .map((r) => (
                      <button key={r.id} type="button" onClick={() => focus(r)} className={clsx("flex w-full items-center justify-between gap-2 px-4 py-1.5 text-left text-[13px] transition", roomId === r.id ? "bg-moss-soft text-moss-2" : "text-ink-2 hover:bg-sand")}>
                        <span className="truncate">{r.name}</span>
                        <span className="tnum shrink-0 font-mono text-[10px] text-faint">
                          {fmtFt(r.w)} × {fmtFt(r.d)}
                        </span>
                      </button>
                    ))}
                </div>
              ))
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {(Object.keys(SLOTS) as MaterialSlot[]).map((slot) => (
                  <li key={slot} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="size-7 shrink-0 rounded-lg border border-black/10" style={{ background: design.materials[slot].color }} />
                    <span className="flex flex-col">
                      <span className="text-[13px]">
                        {SLOTS[slot].group} {SLOTS[slot].label.toLowerCase()}
                      </span>
                      <span className="text-[11px] text-muted">{MATERIALS[design.materials[slot].material].label}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <dl className="tnum grid grid-cols-3 border-t border-line font-mono text-[11px]">
            {[
              ["Area", `${s.total.toLocaleString()} ft²`],
              ["Plot", `${brief.plotWidth}×${brief.plotDepth}`],
              ["Rooms", String(s.rooms)],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5 border-l border-line px-3 py-2 first:border-l-0">
                <dt className="text-faint">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </aside>
      ) : !walking ? (
        <button type="button" onClick={() => setPanel("rooms")} className={clsx(buttonClass("secondary", "sm"), "absolute bottom-4 left-4")}>
          Rooms &amp; finishes
        </button>
      ) : null}

      {/* Selected room card */}
      {room && !walking ? (
        <div className="af-enter absolute bottom-4 right-4 w-[min(300px,calc(100vw-32px))] rounded-2xl border border-line bg-card/95 p-4 shadow-[var(--shadow-pop)] backdrop-blur" aria-live="polite">
          <div className="flex items-start justify-between">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{floorName(room.floor)}</p>
              <p className="text-[16px] font-medium">{room.name}</p>
            </div>
            <IconButton label="Close room details" onClick={() => setRoomId(null)}>
              <X size={14} />
            </IconButton>
          </div>
          <dl className="tnum mt-3 grid grid-cols-3 gap-2 font-mono text-[11px]">
            {[
              ["Width", fmtFt(room.w)],
              ["Depth", fmtFt(room.d)],
              ["Area", `${Math.round(room.w * room.d)} ft²`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-sand px-2 py-1.5">
                <dt className="text-faint">{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
          {room.type !== "court" && room.type !== "stair" ? (
            <p className="mt-3 flex items-center gap-2 text-[12px] text-ink-2">
              <span className="size-3.5 rounded border border-black/10" style={{ background: (room.finish ?? design.materials.floor).color }} />
              {MATERIALS[(room.finish ?? design.materials.floor).material].label} floor
              <span className="ml-1 size-3.5 rounded border border-black/10" style={{ background: room.wallColor ?? design.materials.walls.color }} /> walls
            </p>
          ) : null}
          <Button size="sm" className="mt-3 w-full" onClick={() => scene.current?.focusRoom(room)}>
            Step inside
          </Button>
        </div>
      ) : null}

      {walking && tour ? <Walkthrough scene={scene} design={design} tour={tour} ended={ended} onExit={endTour} /> : null}
    </div>
  );
}

export default function ViewPage() {
  const [state, setState] = React.useState<{ status: "loading" | "invalid" | "ready"; data: SharedProject | null }>({ status: "loading", data: null });
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    const read = () => {
      const data = decodeShare(window.location.hash);
      setState(data ? { status: "ready", data } : { status: "invalid", data: null });
      if (data) rememberViewed({ name: data.name, architect: data.architect, url: window.location.pathname + window.location.hash, at: Date.now() });
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  React.useEffect(() => {
    if (state.data) document.title = `${state.data.name} · ${state.data.architect}`;
  }, [state.data]);
  if (state.status === "loading")
    return (
      <div className="grid min-h-[100dvh] grid-cols-1 gap-8 p-8 lg:grid-cols-2" role="status" aria-label="Opening project">
        <div className="flex flex-col justify-center gap-4">
          <div className="af-skeleton h-4 w-40 rounded" />
          <div className="af-skeleton h-16 w-3/4 rounded" />
          <div className="af-skeleton h-4 w-2/3 rounded" />
        </div>
        <div className="af-skeleton min-h-[360px] rounded-2xl" />
      </div>
    );
  if (state.status === "invalid" || !state.data) return <Invalid />;
  return entered ? <Explorer data={state.data} onExit={() => setEntered(false)} /> : <Cover data={state.data} onEnter={() => setEntered(true)} />;
}
