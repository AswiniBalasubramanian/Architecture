"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { ArrowArcLeft, ArrowArcRight, ArrowCounterClockwise, Check, Copy, Eye, FloppyDisk, Scissors, ShareNetwork, X, PersonSimpleWalk } from "@phosphor-icons/react";
import { FloorPlan } from "@/components/plan/FloorPlan";
import { ProjectMissing, ProjectSkeleton, useProject } from "@/components/ProjectGate";
import { Properties } from "@/components/studio/Properties";
import { UserMenu } from "@/components/AuthGate";
import type { CameraPreset, SceneHandle, Tour } from "@/components/three/HouseScene";
import { Walkthrough } from "@/components/Walkthrough";
import { LazyHouseScene, webglAvailable } from "@/components/three/LazyScene";
import { Button, IconButton, Kbd, Logo, Segmented } from "@/components/ui/kit";
import { DIRECTIONS, ROOM_TYPES, floorName } from "@/lib/catalog";
import { generate, statsOf } from "@/lib/generator";
import { saveProject } from "@/lib/persist";
import { relative, shareUrl, sqft, withDesign } from "@/lib/projects";
import { useStudio, type ViewMode } from "@/lib/store";
import { moveWall } from "@/lib/edit";
import type { Design } from "@/lib/types";

function ShareDialog({ onClose }: { onClose: () => void }) {
  const project = useStudio((s) => s.project)!;
  const design = useStudio((s) => s.design)!;
  const dirty = useStudio((s) => s.dirty);
  const save = useStudio((s) => s.save);
  const [copied, setCopied] = React.useState(false);
  const url = React.useMemo(() => shareUrl({ ...project, design }, window.location.origin), [project, design]);
  const ref = React.useRef<HTMLDialogElement>(null);
  React.useEffect(() => {
    ref.current?.showModal();
  }, []);
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };
  return (
    <dialog ref={ref} onClose={onClose} className="m-auto w-[min(560px,calc(100vw-32px))] rounded-2xl border border-line bg-card p-0 text-ink shadow-[var(--shadow-pop)] backdrop:bg-ink/25 backdrop:backdrop-blur-[2px]">
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
        <div>
          <h2 className="text-[18px] font-medium tracking-[-0.01em]">Share a buyer preview</h2>
          <p className="mt-1 text-[13px] text-muted">A read-only 3D viewer with your cover, rooms, finishes and a guided walkthrough.</p>
        </div>
        <IconButton label="Close" onClick={() => ref.current?.close()}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="flex flex-col gap-4 px-6 py-5">
        {dirty ? (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-clay-soft/60 px-3 py-2.5 text-[13px] text-ink-2">
            <span>You have unsaved changes. The link always shows what you see now; saving also keeps a version.</span>
            <Button size="sm" onClick={() => save("Before sharing")}>
              Save
            </Button>
          </div>
        ) : null}
        <div className="flex items-center gap-2">
          <input readOnly value={url ?? ""} aria-label="Buyer link" className="h-10 min-w-0 flex-1 rounded-[10px] border border-line bg-sand px-3 font-mono text-[12px] text-ink-2" onFocus={(e) => e.currentTarget.select()} />
          <Button variant="primary" onClick={copy}>
            {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <a href={url ?? "#"} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 self-start text-[13px] text-moss underline-offset-4 hover:underline">
          <Eye size={14} /> Open the buyer view
        </a>
        <p className="border-t border-line pt-4 text-[12px] leading-relaxed text-muted">
          Demo mode: there is no server here, so the link carries a compressed copy of this design in its URL fragment, which browsers never send to a server. Anyone with the link can view it. After further edits, copy a fresh link.
        </p>
      </div>
    </dialog>
  );
}

export default function StudioPage() {
  const { id } = useParams<{ id: string }>();
  const [{ status, project: loaded }] = useProject(id);
  const s = useStudio();
  const scene = React.useRef<SceneHandle>(null);
  const [sharing, setSharing] = React.useState(false);
  const [gl, setGl] = React.useState(true);
  const [toast, setToast] = React.useState<string | null>(null);
  const [tour, setTour] = React.useState<Tour | null>(null);
  // The design as it was when a wall drag began; each move is applied to it afresh.
  const wallBase = React.useRef<Design | null>(null);
  const [ended, setEnded] = React.useState(false);
  // The walkthrough's own day/night switch; null follows the design's lighting.
  const [tourNight, setTourNight] = React.useState<boolean | null>(null);

  React.useEffect(() => setGl(webglAvailable()), []);

  // Open the project in the store; a project without a design gets the generator's default.
  React.useEffect(() => {
    if (!loaded) return;
    if (!loaded.design) {
      const design = generate(loaded.brief, "open");
      const p = withDesign(loaded, design);
      saveProject(p);
      s.open(p);
    } else if (s.project?.id !== loaded.id) s.open(loaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const flash = (text: string) => {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2200);
  };

  // Keyboard shortcuts.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      const mod = e.metaKey || e.ctrlKey;
      const st = useStudio.getState();
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
      } else if (mod && e.key.toLowerCase() === "y") {
        e.preventDefault();
        st.redo();
      } else if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        flash(st.save() ? "Saved" : "Couldn't save: browser storage is full or blocked");
      } else if ((e.key === "Delete" || e.key === "Backspace") && st.selection.furnitureId) {
        e.preventDefault();
        st.removeFurniture(st.selection.furnitureId);
      } else if (e.key.toLowerCase() === "r" && st.selection.furnitureId) {
        st.rotateFurniture(st.selection.furnitureId);
      } else if (e.key === "Escape") {
        st.select({ roomId: null, furnitureId: null });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Warn before leaving with unsaved changes.
  React.useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (useStudio.getState().dirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", onBefore);
    return () => window.removeEventListener("beforeunload", onBefore);
  }, []);

  const design = s.design;
  const project = s.project;
  // Cinematic walkthrough: the camera path lives in the scene; this holds the player.
  const startTour = () => {
    s.select({ roomId: null, furnitureId: null });
    setEnded(false);
    setTour(scene.current?.startTour() ?? null);
  };
  const endTour = () => {
    setTourNight(null);
    scene.current?.stopTour();
    setTour(null);
  };

  if (status === "loading" || (status === "ready" && !design)) return <ProjectSkeleton />;
  if (status === "missing" || !project || !design) return <ProjectMissing />;

  const brief = project.brief;
  const stats = statsOf(design, brief.floors);
  const view = s.view;
  const showPlan = view === "plan" || view === "split";
  const show3d = view === "3d" || view === "split";
  const walking = tour !== null;

  const selectRoom = (rid: string | null) => {
    if (rid) {
      const r = design.rooms.find((x) => x.id === rid);
      if (r && r.floor !== s.floor) s.setFloor(r.floor);
    }
    s.select({ roomId: rid, furnitureId: null });
  };
  const selectFurniture = (fid: string | null) => {
    const f = fid ? design.furniture.find((x) => x.id === fid) : null;
    const room = f ? design.rooms.find((r) => r.floor === f.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d) : null;
    s.select({ furnitureId: fid, roomId: room?.id ?? s.selection.roomId });
  };

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden">
      {/* Toolbar */}
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-line bg-paper px-2 md:px-3">
        <Link href="/projects" aria-label="All projects" className="flex h-8 items-center rounded-lg px-2 text-ink transition hover:bg-stone">
          <Logo withWord={false} />
        </Link>
        <div className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-[13px] font-medium">{brief.name}</span>
          <span className="truncate font-mono text-[10px] text-muted">
            {DIRECTIONS[design.direction].label} · {sqft(stats.total)}
          </span>
        </div>
        <span className="mx-2 hidden h-6 w-px bg-line md:block" />
        <div className="hidden items-center gap-0.5 md:flex">
          <IconButton label="Undo (Ctrl+Z)" disabled={!s.past.length} onClick={s.undo}>
            <ArrowArcLeft size={16} />
          </IconButton>
          <IconButton label="Redo (Ctrl+Shift+Z)" disabled={!s.future.length} onClick={s.redo}>
            <ArrowArcRight size={16} />
          </IconButton>
          <IconButton
            label="Reset to generated concept"
            onClick={() => {
              if (window.confirm("Reset to the generated concept? You can undo this.")) s.reset();
            }}
          >
            <ArrowCounterClockwise size={16} />
          </IconButton>
        </div>
        <div className="mx-auto">
          <Segmented<ViewMode>
            label="Canvas"
            size="sm"
            value={view}
            onChange={s.setView}
            options={[
              { value: "plan", label: "Plan" },
              { value: "split", label: "Split" },
              { value: "3d", label: "3D" },
            ]}
          />
        </div>
        <span className="hidden font-mono text-[11px] text-muted lg:inline" aria-live="polite">
          {s.saveError ? <span className="text-clay">Not saved</span> : s.dirty ? "Unsaved changes" : s.savedAt ? `Saved ${relative(s.savedAt)}` : ""}
        </span>
        <Button size="sm" onClick={() => flash(s.save() ? "Saved" : "Couldn't save: browser storage is full or blocked")} disabled={!s.dirty}>
          <FloppyDisk size={14} />
          <span className="hidden sm:inline">Save</span>
        </Button>
        <Button size="sm" variant="primary" onClick={() => setSharing(true)}>
          <ShareNetwork size={14} />
          <span className="hidden sm:inline">Share</span>
        </Button>
        <span className="hidden md:inline-flex">
          <UserMenu />
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Rooms rail */}
        <nav aria-label="Floors and rooms" className="hidden w-[232px] shrink-0 flex-col overflow-y-auto border-r border-line lg:flex">
          {Array.from({ length: brief.floors }, (_, f) => {
            const rooms = design.rooms.filter((r) => r.floor === f);
            return (
              <div key={f} className="border-b border-line py-2">
                <button type="button" onClick={() => s.setFloor(f)} className={clsx("flex w-full items-center justify-between px-4 py-1.5 text-left", s.floor === f ? "text-ink" : "text-muted hover:text-ink")}>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em]">{floorName(f)}</span>
                  {s.floor === f ? <span className="size-1.5 rounded-full bg-moss" /> : null}
                </button>
                <ul>
                  {rooms.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => selectRoom(r.id)} aria-current={s.selection.roomId === r.id || undefined} className={clsx("flex w-full items-center gap-2.5 px-4 py-1.5 text-left text-[13px] transition", s.selection.roomId === r.id ? "bg-moss-soft text-moss-2" : "text-ink-2 hover:bg-stone/60")}>
                        <span className="size-2.5 shrink-0 rounded-[3px] border border-black/10" style={{ background: ROOM_TYPES[r.type].tint }} />
                        <span className="flex-1 truncate">{r.name}</span>
                        <span className="tnum font-mono text-[10px] text-faint">{Math.round(r.w * r.d)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
          <div className="mt-auto flex flex-col gap-1 p-4 font-mono text-[10px] text-faint">
            <span>
              <Kbd>Ctrl</Kbd> <Kbd>Z</Kbd> undo · <Kbd>R</Kbd> rotate
            </span>
            <span>
              <Kbd>Del</Kbd> remove · <Kbd>Esc</Kbd> deselect
            </span>
          </div>
        </nav>

        {/* Canvas */}
        <main className={clsx("relative grid min-h-[56dvh] min-w-0 flex-1", view === "split" ? "grid-rows-2 xl:grid-cols-2 xl:grid-rows-1" : "grid-cols-1")}>
          {showPlan ? (
            <section aria-label="Floor plan" className="af-grid relative min-h-0 overflow-hidden border-line xl:border-r">
              <div className="absolute left-3 top-3 z-10 flex items-center gap-1 rounded-xl border border-line bg-card/95 p-1 shadow-[var(--shadow-lift)] backdrop-blur lg:hidden">
                {Array.from({ length: brief.floors }, (_, f) => (
                  <button key={f} type="button" onClick={() => s.setFloor(f)} className={clsx("rounded-lg px-2 py-1 text-[12px]", s.floor === f ? "bg-ink text-paper" : "text-ink-2")}>
                    {f === 0 ? "GF" : `L${f}`}
                  </button>
                ))}
              </div>
              <p className="absolute left-4 top-3 z-10 hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted lg:block">{floorName(s.floor)} · plan</p>
              <div className="h-full p-3 md:p-6">
                <FloorPlan
                  design={design}
                  floor={s.floor}
                  selectedRoom={s.selection.roomId}
                  selectedFurniture={s.selection.furnitureId}
                  onSelectRoom={selectRoom}
                  onSelectFurniture={selectFurniture}
                  onDragStart={() => {
                    wallBase.current = useStudio.getState().design;
                    s.beginGesture();
                  }}
                  onMoveWall={(line, delta, done) => {
                    const base = wallBase.current ?? design;
                    const next = () => moveWall(base, line, delta);
                    if (done) {
                      s.commit(next);
                      wallBase.current = null;
                    } else s.preview(next);
                  }}
                  onMoveFurniture={(fid, x, y, done) => {
                    const move = (d: typeof design) => ({ ...d, furniture: d.furniture.map((f) => (f.id === fid ? { ...f, x, y } : f)) });
                    if (done) s.commit(move);
                    else s.preview(move);
                  }}
                />
              </div>
            </section>
          ) : null}
          {show3d ? (
            <section aria-label="3D model" className="relative min-h-0 overflow-hidden border-t border-line xl:border-t-0">
              {gl ? (
                <>
                  <LazyHouseScene
                    ref={scene}
                    brief={brief}
                    design={design}
                    maxFloor={walking ? brief.floors - 1 : s.cutaway ? s.floor : brief.floors - 1}
                    cutaway={walking ? false : s.cutaway}
                    selectedRoom={s.selection.roomId}
                    selectedFurniture={s.selection.furnitureId}
                    onSelectRoom={(rid) => (rid ? selectRoom(rid) : s.select({ roomId: null, furnitureId: null }))}
                    onSelectFurniture={(fid) => fid && selectFurniture(fid)}
                    className="absolute inset-0"
                    onTourEnd={() => setEnded(true)}
                    hour={tour && tourNight !== null ? (tourNight ? 19.8 : 10.5) : undefined}
                  />
                  <div className="absolute left-3 top-3 flex flex-wrap items-center gap-1 rounded-xl border border-line bg-card/95 p-1 shadow-[var(--shadow-lift)] backdrop-blur">
                    {(["aerial", "front", "side", "top"] as CameraPreset[]).map((p) => (
                      <button key={p} type="button" onClick={() => scene.current?.view(p)} className="rounded-lg px-2 py-1 text-[12px] capitalize text-ink-2 transition hover:bg-stone hover:text-ink">
                        {p}
                      </button>
                    ))}
                    <span className="mx-0.5 h-4 w-px bg-line" />
                    <IconButton label={s.cutaway ? `Cutaway: showing up to ${floorName(s.floor)}` : "Cutaway off: full house with roof"} active={s.cutaway} onClick={() => s.setCutaway(!s.cutaway)}>
                      <Scissors size={15} />
                    </IconButton>
                    <IconButton
                      label={walking ? "Stop walkthrough" : "Cinematic walkthrough"}
                      active={walking}
                      onClick={() => (walking ? endTour() : startTour())}
                    >
                      <PersonSimpleWalk size={15} />
                    </IconButton>
                  </div>
                  {walking && tour ? (
                    <Walkthrough scene={scene} design={design} tour={tour} ended={ended} onExit={endTour} night={tourNight ?? (design.lighting.hour < 6.2 || design.lighting.hour > 18.6)} onNight={setTourNight} />
                  ) : (
                    <p className="pointer-events-none absolute bottom-3 right-3 hidden rounded-full bg-card/90 px-3 py-1 font-mono text-[10px] text-muted md:block">Click a floor to select a room · drag to orbit</p>
                  )}
                </>
              ) : (
                <div className="flex h-full flex-col items-start justify-center gap-2 p-8">
                  <p className="text-[15px] font-medium">3D needs WebGL, which is turned off in this browser.</p>
                  <p className="text-[13px] text-muted">The plan and every property still work.</p>
                </div>
              )}
            </section>
          ) : null}
          {toast ? (
            <div role="status" className="af-enter pointer-events-none absolute left-1/2 top-4 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-[13px] text-paper shadow-[var(--shadow-pop)]">
              {toast}
            </div>
          ) : null}
        </main>

        {/* Properties */}
        <aside aria-label="Properties" className="max-h-[50dvh] w-full shrink-0 overflow-y-auto border-t border-line bg-paper lg:max-h-none lg:w-[320px] lg:border-l lg:border-t-0">
          <Properties />
          <div className="flex gap-2 border-t border-line p-4 md:hidden">
            <Button size="sm" disabled={!s.past.length} onClick={s.undo}>
              Undo
            </Button>
            <Button size="sm" disabled={!s.future.length} onClick={s.redo}>
              Redo
            </Button>
          </div>
        </aside>
      </div>
      {sharing ? <ShareDialog onClose={() => setSharing(false)} /> : null}
    </div>
  );
}
