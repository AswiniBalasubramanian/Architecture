import { CURRENCIES } from "./catalog";
import { defaultBrief, generate } from "./generator";
import { encodeShare, newId, saveProject } from "./persist";
import type { Brief, Currency, Design, Project, SharedProject } from "./types";

export const DEFAULT_ARCHITECT = "Studio Ash & Builders";

function studioName() {
  if (typeof window === "undefined") return DEFAULT_ARCHITECT;
  try {
    const s = JSON.parse(window.localStorage.getItem("archform:session:v1") ?? "null") as { studio?: string } | null;
    return s?.studio || DEFAULT_ARCHITECT;
  } catch {
    return DEFAULT_ARCHITECT;
  }
}

export function createProject(brief: Brief, architect = studioName()): Project {
  const now = Date.now();
  return { id: newId(), createdAt: now, updatedAt: now, architect, brief, generated: null, design: null, versions: [] };
}

export function withDesign(project: Project, design: Design): Project {
  return { ...project, generated: design, design, updatedAt: Date.now() };
}

/** A complete sample, so the studio can be explored without filling the form. */
export function createSample(): Project {
  const brief = defaultBrief();
  const project = withDesign(createProject(brief), generate(brief, "open"));
  saveProject(project);
  return project;
}

export function shareUrl(project: Project, origin: string) {
  if (!project.design) return null;
  const shared: SharedProject = { v: 1, name: project.brief.name, architect: project.architect, brief: project.brief, design: project.design, sharedAt: Date.now() };
  return `${origin}/view#${encodeShare(shared)}`;
}

export function money(value: number, currency: Currency) {
  const c = CURRENCIES[currency];
  if (!Number.isFinite(value)) return "—";
  if (currency === "INR") {
    if (value >= 1e7) return `${c.symbol}${(value / 1e7).toFixed(2).replace(/\.?0+$/, "")} Cr`;
    if (value >= 1e5) return `${c.symbol}${(value / 1e5).toFixed(1).replace(/\.0$/, "")} L`;
  }
  return `${c.symbol}${Math.round(value).toLocaleString(c.locale)}`;
}

export const sqft = (n: number) => `${Math.round(n).toLocaleString("en-US")} sq ft`;

export function relative(ts: number) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}
