// Persistence. No backend is configured, so projects live in this browser's
// localStorage, and a buyer link carries the whole project compressed in the
// URL fragment (never sent to any server).

import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from "lz-string";
import type { Project, SharedProject } from "./types";

const KEY = "archform:projects:v1";

function readAll(): Record<string, Project> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    const all = raw ? (JSON.parse(raw) as Record<string, Project>) : {};
    // The studio was renamed; carry earlier projects across.
    for (const p of Object.values(all)) if (p.architect === "Studio Varkey & Rao") p.architect = "Studio Ash & Builders";
    return all;
  } catch {
    return {};
  }
}

function writeAll(all: Record<string, Project>) {
  window.localStorage.setItem(KEY, JSON.stringify(all));
}

export function listProjects(): Project[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Project | null {
  return readAll()[id] ?? null;
}

/** Returns false when storage is unavailable or full, so the UI can say so. */
export function saveProject(project: Project): boolean {
  try {
    const all = readAll();
    all[project.id] = project;
    writeAll(all);
    return true;
  } catch {
    return false;
  }
}

export function deleteProject(id: string) {
  const all = readAll();
  delete all[id];
  writeAll(all);
}

export const newId = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export function encodeShare(shared: SharedProject) {
  return compressToEncodedURIComponent(JSON.stringify(shared));
}

export function decodeShare(fragment: string): SharedProject | null {
  try {
    const json = decompressFromEncodedURIComponent(fragment.replace(/^#/, ""));
    if (!json) return null;
    const data = JSON.parse(json) as SharedProject;
    return data && data.v === 1 && data.design && data.brief ? data : null;
  } catch {
    return null;
  }
}
