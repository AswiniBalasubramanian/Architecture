"use client";

import { create } from "zustand";
import { furnish, materialsFor, place } from "./generator";
import { EXTERIOR_TEMPLATES, INTERIOR_TEMPLATES } from "./catalog";
import { newId, saveProject } from "./persist";
import type { Design, Furniture, FurnitureKind, Lighting, MaterialChoice, MaterialSlot, Project, Room } from "./types";

export type ViewMode = "plan" | "3d" | "split";

interface Selection {
  roomId: string | null;
  furnitureId: string | null;
}

interface StudioState {
  project: Project | null;
  design: Design | null;
  past: Design[];
  future: Design[];
  dirty: boolean;
  savedAt: number | null;
  saveError: boolean;
  floor: number;
  view: ViewMode;
  cutaway: boolean;
  selection: Selection;

  open(project: Project): void;
  setFloor(floor: number): void;
  setView(view: ViewMode): void;
  setCutaway(on: boolean): void;
  select(selection: Partial<Selection>): void;

  /** Every design change goes through commit so it can be undone. */
  commit(change: (design: Design) => Design): void;
  /** For continuous gestures: change without history, then call commit-less endGesture. */
  preview(change: (design: Design) => Design): void;
  beginGesture(): void;

  setMaterial(slot: MaterialSlot, choice: MaterialChoice): void;
  applyExterior(id: string): void;
  applyInterior(id: string): void;
  updateRoom(id: string, patch: Partial<Room>): void;
  setLighting(patch: Partial<Lighting>): void;
  addFurniture(kind: FurnitureKind): void;
  removeFurniture(id: string): void;
  rotateFurniture(id: string): void;
  refurnishRoom(id: string): void;

  undo(): void;
  redo(): void;
  reset(): void;
  save(label?: string): boolean;
  restoreVersion(id: string): void;
}

const LIMIT = 80;

export const useStudio = create<StudioState>((set, get) => {
  let gestureStart: Design | null = null;

  const push = (next: Design) => {
    const { design, past } = get();
    if (!design) return;
    set({ design: next, past: [...past.slice(-LIMIT + 1), design], future: [], dirty: true });
  };

  return {
    project: null,
    design: null,
    past: [],
    future: [],
    dirty: false,
    savedAt: null,
    saveError: false,
    floor: 0,
    view: "split",
    cutaway: true,
    selection: { roomId: null, furnitureId: null },

    open(project) {
      set({ project, design: project.design, past: [], future: [], dirty: false, savedAt: project.updatedAt, floor: 0, selection: { roomId: null, furnitureId: null } });
    },
    setFloor(floor) {
      set({ floor, selection: { roomId: null, furnitureId: null } });
    },
    setView(view) {
      set({ view });
    },
    setCutaway(cutaway) {
      set({ cutaway });
    },
    select(selection) {
      set({ selection: { ...get().selection, ...selection } });
    },

    commit(change) {
      const { design } = get();
      if (!design) return;
      if (gestureStart) {
        // Close a gesture: one history entry from where it began.
        const start = gestureStart;
        gestureStart = null;
        const next = change(design);
        set({ design: next, past: [...get().past.slice(-LIMIT + 1), start], future: [], dirty: true });
        return;
      }
      push(change(design));
    },
    beginGesture() {
      gestureStart = get().design;
    },
    preview(change) {
      const { design } = get();
      if (design) set({ design: change(design), dirty: true });
    },

    setMaterial(slot, choice) {
      get().commit((d) => ({ ...d, materials: { ...d.materials, [slot]: choice } }));
    },
    applyExterior(id) {
      const t = EXTERIOR_TEMPLATES.find((x) => x.id === id);
      if (!t) return;
      get().commit((d) => ({ ...d, exteriorTemplate: id, materials: { ...d.materials, ...t.set } as Design["materials"] }));
    },
    applyInterior(id) {
      const t = INTERIOR_TEMPLATES.find((x) => x.id === id);
      if (!t) return;
      get().commit((d) => ({
        ...d,
        interiorTemplate: id,
        materials: { ...d.materials, ...t.set } as Design["materials"],
        // An interior scheme resets per-room overrides so the scheme reads.
        rooms: d.rooms.map(({ finish: _f, wallColor: _w, ...room }) => room),
      }));
    },
    updateRoom(id, patch) {
      get().commit((d) => ({ ...d, rooms: d.rooms.map((room) => (room.id === id ? { ...room, ...patch } : room)) }));
    },
    setLighting(patch) {
      get().commit((d) => ({ ...d, lighting: { ...d.lighting, ...patch } }));
    },
    addFurniture(kind) {
      const { design, selection, floor } = get();
      if (!design) return;
      const room = design.rooms.find((r) => r.id === selection.roomId);
      const target = room ?? design.rooms.find((r) => r.floor === floor && r.type !== "stair" && r.type !== "void");
      if (!target) return;
      const item = place(kind, target, "center") ?? place(kind, target, "left") ?? { id: newId(), kind, floor: target.floor, x: target.x + target.w / 2, y: target.y + target.d / 2, rot: 0 };
      get().commit((d) => ({ ...d, furniture: [...d.furniture, item] }));
      set({ selection: { roomId: target.id, furnitureId: item.id } });
    },
    removeFurniture(id) {
      get().commit((d) => ({ ...d, furniture: d.furniture.filter((f) => f.id !== id) }));
      set({ selection: { ...get().selection, furnitureId: null } });
    },
    rotateFurniture(id) {
      get().commit((d) => ({ ...d, furniture: d.furniture.map((f) => (f.id === id ? { ...f, rot: (f.rot + 90) % 360 } : f)) }));
    },
    refurnishRoom(id) {
      const { design } = get();
      const room = design?.rooms.find((r) => r.id === id);
      if (!room) return;
      const inside = (f: Furniture) => f.floor === room.floor && f.x > room.x && f.x < room.x + room.w && f.y > room.y && f.y < room.y + room.d;
      get().commit((d) => ({ ...d, furniture: [...d.furniture.filter((f) => !inside(f)), ...furnish(room)] }));
    },

    undo() {
      const { past, design, future } = get();
      if (!past.length || !design) return;
      set({ design: past[past.length - 1]!, past: past.slice(0, -1), future: [design, ...future], dirty: true });
    },
    redo() {
      const { past, design, future } = get();
      if (!future.length || !design) return;
      set({ design: future[0]!, past: [...past, design], future: future.slice(1), dirty: true });
    },
    reset() {
      const { project } = get();
      if (!project?.generated) return;
      push(project.generated);
    },
    save(label) {
      const { project, design } = get();
      if (!project || !design) return false;
      const now = Date.now();
      const version = { id: newId(), at: now, label: label ?? `Saved ${new Date(now).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`, design };
      const next: Project = { ...project, design, updatedAt: now, versions: [version, ...project.versions].slice(0, 12) };
      const ok = saveProject(next);
      set(ok ? { project: next, dirty: false, savedAt: now, saveError: false } : { saveError: true });
      return ok;
    },
    restoreVersion(id) {
      const version = get().project?.versions.find((v) => v.id === id);
      if (version) push(version.design);
    },
  };
});

export { materialsFor };
