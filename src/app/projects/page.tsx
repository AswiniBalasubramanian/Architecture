"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Plus, Trash } from "@phosphor-icons/react";
import { FloorPlan } from "@/components/plan/FloorPlan";
import { ButtonLink, Eyebrow, IconButton, SiteHeader } from "@/components/ui/kit";
import { DIRECTIONS, HOUSE_TYPES } from "@/lib/catalog";
import { statsOf } from "@/lib/generator";
import { deleteProject, listProjects } from "@/lib/persist";
import { money, relative, sqft } from "@/lib/projects";
import type { Project } from "@/lib/types";
import { SampleButton } from "@/components/landing/HeroFigure";

export default function ProjectsPage() {
  const [projects, setProjects] = React.useState<Project[] | null>(null);
  React.useEffect(() => setProjects(listProjects()), []);

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader right={<ButtonLink href="/new" variant="primary" size="sm" className="ml-2"><Plus size={14} weight="bold" /> New project</ButtonLink>} />
      <main className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col gap-2">
            <Eyebrow>Saved in this browser</Eyebrow>
            <h1 className="text-[32px] font-medium tracking-[-0.025em]">Projects</h1>
          </div>
          {projects?.length ? <p className="font-mono text-[12px] text-muted">{projects.length} {projects.length === 1 ? "project" : "projects"}</p> : null}
        </div>

        {projects === null ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Loading projects">
            {[0, 1, 2].map((i) => (
              <div key={i} className="af-skeleton h-[320px] rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="grid grid-cols-1 items-center gap-10 border-y border-line py-16 md:grid-cols-[1fr_1fr]">
            <div className="flex max-w-[460px] flex-col gap-4">
              <h2 className="text-[24px] font-medium leading-tight tracking-[-0.02em]">No projects yet.</h2>
              <p className="text-[15px] leading-relaxed text-ink-2">Start from a plot and a brief, or open a ready-made sample: a two-storey contemporary home on a 40 × 60 ft plot.</p>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/new" variant="primary" size="lg">
                  Start a project <ArrowRight size={16} weight="bold" />
                </ButtonLink>
                <SampleButton />
              </div>
            </div>
            <div className="af-grid hidden aspect-[4/3] rounded-2xl border border-dashed border-line-strong md:flex md:items-center md:justify-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">Your first plan appears here</p>
            </div>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((p, i) => {
              const d = p.design;
              const s = d ? statsOf(d, p.brief.floors) : null;
              const href = d ? `/p/${p.id}/studio` : `/p/${p.id}/generate`;
              return (
                <li key={p.id} className="af-enter group relative" style={{ animationDelay: `${i * 60}ms` }}>
                  <Link href={href} className="block overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-lift)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]">
                    <div className="af-grid h-[200px] border-b border-line p-3">{d ? <FloorPlan design={d} floor={0} showFurniture={false} showLabels={false} /> : <div className="flex h-full items-center justify-center font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Brief only · choose a direction</div>}</div>
                    <div className="flex flex-col gap-1.5 px-5 py-4">
                      <div className="flex items-baseline justify-between gap-3">
                        <h2 className="truncate text-[15px] font-medium">{p.brief.name}</h2>
                        <span className="shrink-0 font-mono text-[11px] text-faint">{relative(p.updatedAt)}</span>
                      </div>
                      <p className="truncate text-[13px] text-muted">
                        {HOUSE_TYPES[p.brief.houseType].label} · {p.brief.location}
                      </p>
                      <p className="tnum mt-1 flex gap-3 font-mono text-[11px] text-ink-2">
                        <span>{s ? sqft(s.total) : `${p.brief.builtUp} sq ft brief`}</span>
                        <span>{p.brief.bedrooms} bed</span>
                        <span>{money(p.brief.budget, p.brief.currency)}</span>
                        {d ? <span className="text-muted">{DIRECTIONS[d.direction].label}</span> : null}
                      </p>
                    </div>
                  </Link>
                  <IconButton
                    label={`Delete ${p.brief.name}`}
                    className="absolute right-3 top-3 bg-card/90 opacity-0 shadow-[var(--shadow-lift)] transition group-hover:opacity-100 focus-visible:opacity-100"
                    onClick={() => {
                      if (!window.confirm(`Delete "${p.brief.name}" from this browser? This can't be undone.`)) return;
                      deleteProject(p.id);
                      setProjects(listProjects());
                    }}
                  >
                    <Trash size={14} />
                  </IconButton>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
