"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "@phosphor-icons/react";
import { BuildFigure } from "@/components/build/BuildFigure";
import { FloorPlan } from "@/components/plan/FloorPlan";
import { Button } from "@/components/ui/kit";
import { defaultBrief, generate } from "@/lib/generator";
import { createSample } from "@/lib/projects";
import type { Brief } from "@/lib/types";

const HERO_BRIEF: Brief = { ...defaultBrief(), name: "Residence at Whitefield" };

/** Plays the construction once, rests on the finished model, then builds again. */
export function HeroFigure() {
  const design = React.useMemo(() => generate(HERO_BRIEF, "open"), []);
  const [run, setRun] = React.useState(0);
  return (
    <BuildFigure
      key={run}
      brief={HERO_BRIEF}
      design={design}
      fig="Fig. 1 — 40 × 60 ft plot, 2,400 sq ft"
      onDone={() => window.setTimeout(() => setRun((n) => n + 1), 5200)}
    />
  );
}

export function SamplePlan() {
  const design = React.useMemo(() => generate({ ...HERO_BRIEF, requirements: ["parking", "utility", "family", "garden"] }, "core"), []);
  const [floor, setFloor] = React.useState(0);
  const [room, setRoom] = React.useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <div className="af-grid relative aspect-[4/5] overflow-hidden rounded-2xl border border-line">
        <FloorPlan design={design} floor={floor} selectedRoom={room} onSelectRoom={setRoom} />
      </div>
      <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
        <span>Central Core · {floor === 0 ? "ground floor" : "first floor"}</span>
        <span className="flex gap-1">
          {[0, 1].map((f) => (
            <button key={f} type="button" onClick={() => setFloor(f)} className={`rounded-md px-2 py-1 transition ${floor === f ? "bg-ink text-paper" : "hover:bg-stone"}`}>
              {f === 0 ? "GF" : "FF"}
            </button>
          ))}
        </span>
      </div>
    </div>
  );
}

export function SampleButton({ className }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      size="lg"
      className={className}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        const p = createSample();
        router.push(`/p/${p.id}/studio`);
      }}
    >
      {busy ? "Opening…" : "Open a sample project"}
      <ArrowRight size={16} weight="bold" />
    </Button>
  );
}
