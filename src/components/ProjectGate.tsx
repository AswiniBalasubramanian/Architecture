"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadProject } from "@/lib/persist";
import type { Project } from "@/lib/types";
import { buttonClass, Logo } from "./ui/kit";
import { PixelLoader } from "./ui/PixelLoader";

/** The prerendered shell every /p/<id>/... URL is served from (see src/app/p/[id]/layout.tsx). */
const SHELL = "_";

/** The project id from the address bar; the route param is the shell's "_" when served from the cache. */
export function useProjectId() {
  const params = useParams<{ id: string }>();
  const fromParams = params.id && params.id !== SHELL ? params.id : "";
  const [id, setId] = React.useState(fromParams);
  React.useEffect(() => {
    setId(fromParams || decodeURIComponent(window.location.pathname.split("/")[2] ?? ""));
  }, [fromParams]);
  return id;
}

/** Loads a project from this browser, with loading and not-found states. An empty id waits. */
export function useProject(id: string) {
  const [state, setState] = React.useState<{ status: "loading" | "missing" | "ready"; project: Project | null }>({ status: "loading", project: null });
  React.useEffect(() => {
    if (!id) return;
    const p = loadProject(id);
    setState(p ? { status: "ready", project: p } : { status: "missing", project: null });
  }, [id]);
  return [state, (p: Project) => setState({ status: "ready", project: p })] as const;
}

export function ProjectSkeleton() {
  return <PixelLoader fullScreen label="Opening the project" />;
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
