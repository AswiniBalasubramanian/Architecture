"use client";

import * as React from "react";
import Link from "next/link";
import { loadProject } from "@/lib/persist";
import type { Project } from "@/lib/types";
import { buttonClass, Logo } from "./ui/kit";

/** Loads a project from this browser, with loading and not-found states. */
export function useProject(id: string) {
  const [state, setState] = React.useState<{ status: "loading" | "missing" | "ready"; project: Project | null }>({ status: "loading", project: null });
  React.useEffect(() => {
    const p = loadProject(id);
    setState(p ? { status: "ready", project: p } : { status: "missing", project: null });
  }, [id]);
  return [state, (p: Project) => setState({ status: "ready", project: p })] as const;
}

export function ProjectSkeleton() {
  return (
    <div className="flex min-h-[100dvh] flex-col" role="status" aria-label="Loading project">
      <div className="flex h-14 items-center border-b border-line px-4 md:px-8">
        <Logo />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-6 p-6 lg:grid-cols-[300px_1fr]">
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="af-skeleton h-16 rounded-xl" />
          ))}
        </div>
        <div className="af-skeleton min-h-[420px] rounded-2xl" />
      </div>
    </div>
  );
}

export function ProjectMissing() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-start justify-center gap-5 px-6 md:px-[12vw]">
      <Logo />
      <h1 className="max-w-[22ch] text-[32px] font-medium leading-tight tracking-[-0.02em]">This project isn&apos;t saved in this browser.</h1>
      <p className="max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
        Projects live in the browser they were created in. If it was made on another device, ask for its buyer link, or start a new one here.
      </p>
      <div className="flex gap-3">
        <Link href="/new" className={buttonClass("primary", "lg")}>
          Start a project
        </Link>
        <Link href="/projects" className={buttonClass("secondary", "lg")}>
          Your projects
        </Link>
      </div>
    </div>
  );
}
