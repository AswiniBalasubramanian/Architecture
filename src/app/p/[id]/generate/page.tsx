"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowLeft, ArrowRight, Cube, PencilSimpleLine, Sun, Wrench } from "@phosphor-icons/react";
import { BuildFigure } from "@/components/build/BuildFigure";
import type { BuildScene } from "@/components/build/geometry";
import { FloorPlan } from "@/components/plan/FloorPlan";
import { ProjectMissing, ProjectSkeleton, useProject, useProjectId } from "@/components/ProjectGate";
import { LazyHouseScene, webglAvailable } from "@/components/three/LazyScene";
import { Button, Eyebrow, Logo, Segmented } from "@/components/ui/kit";
import { DIRECTIONS, HOUSE_TYPES, floorName } from "@/lib/catalog";
import { footprintOf, generate, statsOf, VARIANTS } from "@/lib/generator";
import { checkPlan } from "@/lib/planCheck";
import { saveProject } from "@/lib/persist";
import { money, sqft, withDesign } from "@/lib/projects";
import type { DirectionId, RoofType } from "@/lib/types";

type Mode = "build" | "plan" | "3d";
const PIPELINE = [
  { key: "SVG plan", icon: PencilSimpleLine },
  { key: "Structure", icon: Wrench },
  { key: "WebGL light", icon: Sun },
  { key: "3D model", icon: Cube },
] as const;

export default function GeneratePage() {
  const id = useProjectId();
  const router = useRouter();
  const [{ status, project }] = useProject(id);
  const [direction, setDirection] = React.useState<DirectionId>("open");
  const [mode, setMode] = React.useState<Mode>("build");
  const [auto, setAuto] = React.useState(true);
  const [pipeline, setPipeline] = React.useState(0);
  const [floor, setFloor] = React.useState(0);
  const [gl, setGl] = React.useState(true);
  const [continuing, setContinuing] = React.useState(false);

  React.useEffect(() => setGl(webglAvailable()), []);
  // Start on the saved direction once; later reloads of the project must not undo the user's pick.
  const initial = React.useRef(false);
  React.useEffect(() => {
    if (initial.current || !project) return;
    initial.current = true;
    if (project.design) setDirection(project.design.direction);
  }, [project]);
  // Per direction: which layout variant is showing (undefined = the best-scoring one).
  const [variants, setVariants] = React.useState<Partial<Record<DirectionId, number>>>({});
  const [roof, setRoof] = React.useState<RoofType | "auto">("auto");
  const brief0 = project?.brief;
  const briefNow = React.useMemo(() => (brief0 ? { ...brief0, roof } : null), [brief0, roof]);

  const designs = React.useMemo(() => {
    if (!briefNow) return null;
    return (Object.keys(DIRECTIONS) as DirectionId[]).map((d) => ({ id: d, design: generate(briefNow, d, variants[d]) }));
  }, [briefNow, variants]);

  if (status === "loading") return <ProjectSkeleton />;
  if (status === "missing" || !project || !designs) return <ProjectMissing />;

  const brief = briefNow!;
  const current = designs.find((d) => d.id === direction)!.design;
  const plan = checkPlan(current, brief.floors);
  const another = () => {
    setVariants((v) => ({ ...v, [direction]: ((current.variant ?? 0) + 1) % VARIANTS.length }));
    if (mode === "build") setMode("plan");
  };
  const fp = footprintOf(brief);
  const fpNotes = [...fp.notes];
  if (direction === "courtyard" && fp.w < 32) fpNotes.push(`At ${fp.w} ft wide, a central court leaves rooms under 10 ft across. Open Linear or Central Core will plan better here.`);

  const onStage = (index: number, scene: BuildScene) => {
    const p = PIPELINE.findIndex((x) => x.key === scene.stages[index]!.pipeline);
    setPipeline(Math.max(0, p));
  };
  const onDone = () => {
    if (!auto || !gl) return;
    window.setTimeout(() => {
      setMode((m) => (m === "build" ? "3d" : m));
      setPipeline(3);
    }, 700);
  };
  // Switching direction answers immediately in the current view; only the construction view replays.
  const pick = (d: DirectionId) => {
    setDirection(d);
    if (mode === "build") {
      setAuto(true);
      setPipeline(0);
    }
  };
  const choose = () => {
    setContinuing(true);
    const ok = saveProject(withDesign({ ...project, brief }, current));
    if (!ok) {
      setContinuing(false);
      return;
    }
    router.push(`/p/${project.id}/studio`);
  };

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex h-14 items-center justify-between border-b border-line px-4 md:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" aria-label="Home" className="text-ink">
            <Logo withWord={false} />
          </Link>
          <span className="h-5 w-px bg-line" />
          <span className="truncate text-[14px] font-medium">{brief.name}</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted sm:inline">Step 3 of 4 · Directions</span>
        </div>
        <Link href="/new" className="hidden items-center gap-1.5 text-[13px] text-muted transition hover:text-ink sm:inline-flex">
          <ArrowLeft size={14} /> New brief
        </Link>
      </header>

      <main className="grid flex-1 grid-cols-1 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Directions */}
        <aside className="flex flex-col border-b border-line lg:border-b-0 lg:border-r">
          <div className="flex flex-col gap-2 px-5 pb-4 pt-6">
            <Eyebrow>Three directions</Eyebrow>
            <h1 className="text-[22px] font-medium leading-tight tracking-[-0.02em]">Pick a starting point.</h1>
            <p className="text-[13px] leading-relaxed text-muted">
              {HOUSE_TYPES[brief.houseType].label} · {brief.floors} {brief.floors > 1 ? "floors" : "floor"} · {brief.bedrooms} bed · {brief.plotWidth} × {brief.plotDepth} ft
            </p>
          </div>
          <div role="radiogroup" aria-label="Design direction" className="flex flex-col border-t border-line">
            {designs.map(({ id: d, design }, i) => {
              const s = statsOf(design, brief.floors);
              const on = d === direction;
              return (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => pick(d)}
                  className={clsx("relative flex flex-col gap-2 border-b border-line px-5 py-4 text-left transition duration-200", on ? "bg-card" : "hover:bg-card/50")}
                >
                  {on ? <span className="absolute inset-y-0 left-0 w-[3px] bg-moss" /> : null}
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] font-medium">
                      <span className="mr-2 font-mono text-[11px] text-faint">{String.fromCharCode(65 + i)}</span>
                      {DIRECTIONS[d].label}
                    </span>
                    <span className="font-mono text-[11px] text-muted">{design.roof} roof</span>
                  </span>
                  <span className="text-[13px] leading-snug text-ink-2">{DIRECTIONS[d].blurb}</span>
                  <span className="tnum grid grid-cols-3 gap-2 pt-1 font-mono text-[11px] text-muted">
                    <span>{sqft(s.total)}</span>
                    <span>{s.rooms} spaces</span>
                    <span>{s.efficiency}% usable</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex flex-col gap-3 p-5">
            {fpNotes.map((n) => (
              <p key={n} className="rounded-lg bg-clay-soft/60 p-3 text-[12px] leading-relaxed text-ink-2">
                {n}
              </p>
            ))}
            <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink">
                  Layout {(current.variant ?? 0) + 1} of {VARIANTS.length}
                  <span className="ml-2 font-mono text-[11px] text-muted">plan check {plan.score}</span>
                </span>
                <button type="button" onClick={another} className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink active:scale-[0.98]">
                  Another layout
                </button>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[12px] text-muted">Roof</span>
                <Segmented
                  label="Roof"
                  size="sm"
                  value={roof}
                  onChange={(r: RoofType | "auto") => setRoof(r)}
                  options={[
                    { value: "auto", label: "Auto" },
                    { value: "flat", label: "Flat" },
                    { value: "gable", label: "Gable" },
                    { value: "hip", label: "Hip" },
                  ]}
                />
              </div>
            </div>
            <p className="text-[12px] leading-relaxed text-muted">
              Generated in your browser by a deterministic planning engine, not an AI service. Each direction starts from its best-scoring layout on the plan check{brief.requirements.includes("vastu") ? " and Vastu" : ""}. Treat it as a concept: structure, services and local rules need validation.
            </p>
            <Button variant="primary" size="lg" onClick={choose} disabled={continuing}>
              {continuing ? "Opening studio…" : `Continue with ${DIRECTIONS[direction].label}`}
              <ArrowRight size={16} weight="bold" />
            </Button>
            <p className="text-center text-[12px] text-faint">Budget {money(brief.budget, brief.currency)}</p>
          </div>
        </aside>

        {/* Stage */}
        <section className="flex min-w-0 flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-6">
            <ol className="flex items-center gap-1.5" aria-label="Pipeline">
              {PIPELINE.map((p, i) => {
                const Icon = p.icon;
                const state = i < pipeline ? "done" : i === pipeline ? "now" : "next";
                return (
                  <li key={p.key} className="flex items-center gap-1.5">
                    <span className={clsx("inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 font-mono text-[11px] transition duration-300", state === "now" ? "bg-ink text-paper" : state === "done" ? "bg-moss-soft text-moss-2" : "text-faint")}>
                      <Icon size={13} weight={state === "now" ? "fill" : "regular"} />
                      <span className="hidden sm:inline">{p.key}</span>
                    </span>
                    {i < PIPELINE.length - 1 ? <span className={clsx("h-px w-4 transition-colors", i < pipeline ? "bg-moss" : "bg-line")} /> : null}
                  </li>
                );
              })}
            </ol>
            <Segmented
              label="View"
              size="sm"
              value={mode}
              onChange={(m) => {
                setAuto(false);
                setMode(m);
                if (m === "3d") setPipeline(3);
              }}
              options={[
                { value: "build", label: "Construction" },
                { value: "plan", label: "Plan" },
                { value: "3d", label: "3D" },
              ]}
            />
          </div>
          <div className="relative min-h-[520px] flex-1 overflow-hidden">
            {mode === "build" ? (
              <div className="af-enter mx-auto flex h-full w-full max-w-[min(920px,calc((100dvh-220px)*1.3))] items-center p-4 md:p-6">
                <BuildFigure key={direction} brief={brief} design={current} onStage={onStage} onDone={onDone} fig={`Fig. ${String.fromCharCode(65 + designs.findIndex((d) => d.id === direction))} — ${DIRECTIONS[direction].label}`} className="w-full" />
              </div>
            ) : null}
            {mode === "plan" ? (
              <div className="af-enter af-grid flex h-full flex-col">
                <div className="flex items-center gap-2 px-6 pt-4">
                  {Array.from({ length: brief.floors }, (_, f) => (
                    <button key={f} type="button" onClick={() => setFloor(f)} className={clsx("rounded-md px-2.5 py-1 text-[12px] transition", floor === f ? "bg-ink text-paper" : "text-ink-2 hover:bg-stone")}>
                      {floorName(f)}
                    </button>
                  ))}
                </div>
                <div className="min-h-0 flex-1 p-4 md:p-8">
                  <FloorPlan design={current} floor={Math.min(floor, brief.floors - 1)} className="max-h-[70dvh]" />
                </div>
              </div>
            ) : null}
            {mode === "3d" ? (
              gl ? (
                <div className="af-enter absolute inset-0">
                  <LazyHouseScene brief={brief} design={current} intro className="h-full w-full" />
                  <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-card/90 px-3 py-1.5 font-mono text-[11px] text-ink-2 shadow-[var(--shadow-lift)]">Drag to orbit · scroll to zoom</p>
                </div>
              ) : (
                <div className="flex h-full flex-col items-start justify-center gap-3 p-10">
                  <p className="text-[16px] font-medium">3D needs WebGL, which this browser has turned off.</p>
                  <p className="max-w-[52ch] text-[14px] text-muted">The construction figure and the plan still work. Enable hardware acceleration to explore the model.</p>
                </div>
              )
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
