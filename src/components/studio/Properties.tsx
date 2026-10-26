"use client";

import * as React from "react";
import clsx from "clsx";
import { ArrowClockwise, ArrowCounterClockwise, Armchair, Lightbulb, Trash, MoonStars, SunHorizon } from "@phosphor-icons/react";
import { Button, Eyebrow, Segmented, inputClass } from "@/components/ui/kit";
import { EXTERIOR_TEMPLATES, FURNITURE, INTERIOR_TEMPLATES, MATERIALS, ROOM_TEMPLATES, ROOM_TYPES, SLOTS, SWATCHES, floorName } from "@/lib/catalog";
import { fmtFt } from "@/components/plan/FloorPlan";
import { relative } from "@/lib/projects";
import { useStudio } from "@/lib/store";
import { roomDoors, roomWindows, setDoor, setWindow } from "@/lib/edit";
import { checkPlan, type CheckStatus } from "@/lib/planCheck";
import { checkVastu } from "@/lib/vastu";
import { checkRules, describeRule } from "@/lib/layoutRules";
import { FACINGS } from "@/lib/catalog";
import type { DoorChoice, FurnitureKind, MaterialChoice, MaterialId, MaterialSlot, RoofType } from "@/lib/types";

function Section({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function SwatchRow({ value, onChange, label }: { value: string; onChange: (c: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={label}>
      {SWATCHES.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value.toLowerCase() === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={clsx("size-5 rounded-full border transition hover:scale-110", value.toLowerCase() === c ? "border-ink ring-2 ring-ink/15 ring-offset-1 ring-offset-card" : "border-black/10")}
          style={{ background: c }}
        />
      ))}
      <label className="relative ml-1 inline-flex size-5 cursor-pointer items-center justify-center rounded-full border border-dashed border-line-strong text-[10px] text-muted" title="Custom colour">
        +
        <input type="color" className="absolute inset-0 cursor-pointer opacity-0" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: custom colour`} />
      </label>
    </div>
  );
}

function MaterialEditor({ slot, choice, onChange }: { slot: MaterialSlot; choice: MaterialChoice; onChange: (c: MaterialChoice) => void }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="rounded-xl border border-line bg-card">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-3 py-2.5 text-left">
        <span className="size-6 shrink-0 rounded-md border border-black/10" style={{ background: choice.color }} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] text-ink">{SLOTS[slot].label}</span>
          <span className="truncate text-[11px] text-muted">{MATERIALS[choice.material].label}</span>
        </span>
        <span className={clsx("text-[11px] text-faint transition", open && "rotate-180")}>▾</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 border-t border-line px-3 pb-3 pt-3">
          <div className="flex flex-wrap gap-1.5">
            {SLOTS[slot].materials.map((m: MaterialId) => (
              <button
                key={m}
                type="button"
                aria-pressed={choice.material === m}
                onClick={() => onChange({ material: m, color: choice.material === m ? choice.color : MATERIALS[m].color })}
                className={clsx("rounded-md border px-2 py-1 text-[12px] transition", choice.material === m ? "border-ink bg-ink text-paper" : "border-line text-ink-2 hover:border-line-strong")}
              >
                {MATERIALS[m].label}
              </button>
            ))}
          </div>
          <SwatchRow label={`${SLOTS[slot].label} colour`} value={choice.color} onChange={(color) => onChange({ ...choice, color })} />
        </div>
      ) : null}
    </div>
  );
}

function RoomPanel() {
  const design = useStudio((s) => s.design)!;
  const roomId = useStudio((s) => s.selection.roomId);
  const updateRoom = useStudio((s) => s.updateRoom);
  const refurnish = useStudio((s) => s.refurnishRoom);
  const addFurniture = useStudio((s) => s.addFurniture);
  const room = design.rooms.find((r) => r.id === roomId);
  const [name, setName] = React.useState(room?.name ?? "");
  React.useEffect(() => setName(room?.name ?? ""), [room?.id, room?.name]);
  if (!room) return null;
  const finish = room.finish ?? design.materials.floor;
  const kinds = (Object.keys(FURNITURE) as FurnitureKind[]).filter((k) => FURNITURE[k].rooms.includes(room.type));
  const inside = design.furniture.filter((f) => f.floor === room.floor && f.x > room.x && f.x < room.x + room.w && f.y > room.y && f.y < room.y + room.d);
  return (
    <>
      <Section title="Room" aside={<span className="font-mono text-[11px] text-faint">{floorName(room.floor)}</span>}>
        <input
          className={inputClass}
          value={name}
          aria-label="Room name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== room.name && updateRoom(room.id, { name: name.trim() })}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        />
        <dl className="tnum grid grid-cols-3 gap-2 font-mono text-[11px]">
          {[
            ["Width", fmtFt(room.w)],
            ["Depth", fmtFt(room.d)],
            ["Area", `${Math.round(room.w * room.d)} ft²`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-sand px-2 py-1.5">
              <dt className="text-faint">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12px] text-muted">{ROOM_TYPES[room.type].label}. Drag any interior wall in the plan to resize the rooms either side.</p>
      </Section>
      <OpeningsPanel roomId={room.id} />
      {room.type !== "void" && room.type !== "court" && room.type !== "stair" ? (
        <Section title="Room finish" aside={room.finish || room.wallColor ? <button type="button" className="text-[11px] text-muted underline-offset-2 hover:text-ink hover:underline" onClick={() => updateRoom(room.id, { finish: undefined, wallColor: undefined })}>Use scheme</button> : null}>
          <div className="grid grid-cols-1 gap-1.5">
            {ROOM_TEMPLATES.map((t) => {
              const on = room.finish?.material === t.finish.material && room.finish?.color === t.finish.color && room.wallColor === t.wall;
              return (
                <button key={t.id} type="button" aria-pressed={on} onClick={() => updateRoom(room.id, { finish: t.finish, wallColor: t.wall })} className={clsx("flex items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition", on ? "border-ink bg-card" : "border-transparent hover:bg-card")}>
                  <span className="flex">
                    <span className="size-5 rounded-l-md border border-black/10" style={{ background: t.finish.color }} />
                    <span className="size-5 rounded-r-md border border-l-0 border-black/10" style={{ background: t.wall }} />
                  </span>
                  <span className="text-[13px]">{t.label}</span>
                </button>
              );
            })}
          </div>
          <MaterialEditor slot="floor" choice={finish} onChange={(c) => updateRoom(room.id, { finish: c })} />
          <div className="flex flex-col gap-2">
            <span className="text-[12px] text-ink-2">Wall paint</span>
            <SwatchRow label="Wall paint" value={room.wallColor ?? design.materials.walls.color} onChange={(c) => updateRoom(room.id, { wallColor: c })} />
          </div>
        </Section>
      ) : null}
      {kinds.length ? (
        <Section title={`Furniture · ${inside.length}`} aside={<button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => refurnish(room.id)}>Re-furnish</button>}>
          <div className="flex flex-wrap gap-1.5">
            {kinds.map((k) => (
              <button key={k} type="button" onClick={() => addFurniture(k)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-card px-2 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink active:scale-[0.98]">
                <Armchair size={12} /> {FURNITURE[k].label}
              </button>
            ))}
          </div>
          <p className="text-[12px] text-muted">Drag pieces in the plan to move them.</p>
        </Section>
      ) : null}
    </>
  );
}

const SIDE_LABEL = { front: "Front (street)", back: "Back", left: "Left side", right: "Right side" } as const;
const DOOR_LABEL: Record<"door" | "open" | "wall" | "glass", string> = { door: "Door", open: "Open", wall: "Wall", glass: "Glazed" };

/** Windows on the room's outside walls and doors to each neighbour, editable. */
function OpeningsPanel({ roomId }: { roomId: string }) {
  const design = useStudio((s) => s.design)!;
  const commit = useStudio((s) => s.commit);
  const room = design.rooms.find((r) => r.id === roomId);
  if (!room || room.type === "void") return null;
  const windows = room.type === "parking" || room.type === "court" ? [] : roomWindows(design, room);
  const doors = roomDoors(design, room).filter((d) => d.kind !== "glass");
  const step = "flex size-7 items-center justify-center rounded-md border border-line bg-card text-[13px] text-ink-2 transition hover:border-line-strong disabled:opacity-40";
  return (
    <>
      {windows.length ? (
        <Section title="Windows" aside={<span className="font-mono text-[11px] text-faint">outside walls</span>}>
          <ul className="flex flex-col gap-2">
            {windows.map((w) => (
              <li key={w.side} className="flex items-center gap-2">
                <span className="flex-1 text-[13px] text-ink-2">{SIDE_LABEL[w.side]}</span>
                <button type="button" aria-label={`Narrower window, ${w.side}`} className={step} disabled={w.width <= 0} onClick={() => commit((d) => setWindow(d, room.id, w.side, w.width - 1 < 1.5 ? 0 : w.width - 1))}>
                  −
                </button>
                <span className="tnum w-14 text-center font-mono text-[12px] text-ink">{w.width > 0 ? fmtFt(w.width) : "none"}</span>
                <button type="button" aria-label={`Wider window, ${w.side}`} className={step} disabled={w.width >= w.max} onClick={() => commit((d) => setWindow(d, room.id, w.side, Math.min(w.max, Math.max(2, w.width + 1))))}>
                  +
                </button>
                {w.overridden ? (
                  <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => commit((d) => setWindow(d, room.id, w.side, null))}>
                    Reset
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      {doors.length ? (
        <Section title="Doors" aside={<span className="font-mono text-[11px] text-faint">to neighbours</span>}>
          <ul className="flex flex-col gap-2">
            {doors.map((d) => (
              <li key={d.other.id} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{d.other.name}</span>
                <div className="flex rounded-lg border border-line bg-card p-0.5">
                  {(["door", "open", "wall"] as const).map((k) => {
                    const on = d.kind === k;
                    return (
                      <button key={k} type="button" aria-pressed={on} onClick={() => commit((x) => setDoor(x, room.id, d.other.id, (k === "wall" ? "none" : k) as DoorChoice))} className={clsx("rounded-md px-2 py-1 text-[11px] transition", on ? "bg-ink text-paper" : "text-muted hover:text-ink")}>
                        {DOOR_LABEL[k]}
                      </button>
                    );
                  })}
                </div>
                {d.overridden ? (
                  <button type="button" className="text-[11px] text-muted hover:text-ink" onClick={() => commit((x) => setDoor(x, room.id, d.other.id, null))}>
                    Auto
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-muted">Doors start from planning rules: rooms open off circulation, en-suites only from their bedroom.</p>
        </Section>
      ) : null}
    </>
  );
}

const STATUS: Record<CheckStatus, { dot: string; label: string }> = {
  pass: { dot: "bg-moss", label: "Pass" },
  warn: { dot: "bg-[#c99a4f]", label: "Check" },
  fail: { dot: "bg-clay", label: "Fails" },
};

/** Plan check against NBC minimums and planning practice, plus Vastu and feng shui basics. */
function CheckPanel() {
  const design = useStudio((s) => s.design)!;
  const project = useStudio((s) => s.project)!;
  const select = useStudio((s) => s.select);
  const setFloor = useStudio((s) => s.setFloor);
  const brief = project.brief;
  const plan = React.useMemo(() => checkPlan(design, brief.floors), [design, brief.floors]);
  const vastu = React.useMemo(() => checkVastu(brief, design), [brief, design]);
  const ruleChecks = React.useMemo(() => checkRules(brief, design), [brief, design]);
  const [showPass, setShowPass] = React.useState(false);
  const groups = ["Room sizes", "Light & air", "Circulation", "Structure", "Stair"] as const;
  const go = (roomId?: string) => {
    const r = roomId && design.rooms.find((x) => x.id === roomId);
    if (!r) return;
    setFloor(r.floor);
    select({ roomId: r.id, furnitureId: null });
  };
  return (
    <>
      <Section title="Plan check" aside={<span className="font-mono text-[11px] text-faint">NBC 2016 · Part 3</span>}>
        <div className="flex items-end gap-4">
          <span className="tnum font-display text-[46px] leading-none text-ink">{plan.score}</span>
          <div className="flex gap-3 pb-1.5 font-mono text-[11px] text-muted">
            {(["pass", "warn", "fail"] as const).map((k) => (
              <span key={k} className="flex items-center gap-1.5">
                <i className={clsx("size-2 rounded-full", STATUS[k].dot)} /> {plan.counts[k]} {STATUS[k].label.toLowerCase()}
              </span>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-[12px] text-muted">
          <input type="checkbox" checked={showPass} onChange={(e) => setShowPass(e.target.checked)} /> Show passing items
        </label>
        {groups.map((g) => {
          const items = plan.items.filter((i) => i.group === g && (showPass || i.status !== "pass"));
          if (!items.length) return null;
          return (
            <div key={g} className="flex flex-col gap-1">
              <p className="pt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-faint">{g}</p>
              <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
                {items.map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => go(i.roomId)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-sand/60">
                      <i className={clsx("mt-1.5 size-2 shrink-0 rounded-full", STATUS[i.status].dot)} aria-label={STATUS[i.status].label} />
                      <span className="flex flex-col">
                        <span className="text-[13px] text-ink">{i.label}</span>
                        <span className="text-[12px] leading-snug text-muted">{i.detail}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        <p className="text-[11px] leading-relaxed text-faint">A design aid, not an approval: check local bye-laws, structure and services with your engineer.</p>
      </Section>
      {ruleChecks.length ? (
        <Section title="Layout rules" aside={<span className="tnum font-mono text-[11px] text-faint">{ruleChecks.filter((c) => c.score >= 1).length} of {ruleChecks.length} followed</span>}>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
            {ruleChecks.map((c, i) => (
              <li key={i}>
                <button type="button" onClick={() => go(c.room?.id)} className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition hover:bg-sand/60">
                  <i className={clsx("mt-1.5 size-2 shrink-0 rounded-full", c.score >= 1 ? "bg-moss" : c.score > 0 ? "bg-[#c99a4f]" : "bg-clay")} />
                  <span className="flex flex-col">
                    <span className="text-[13px] text-ink">
                      {describeRule(c.rule)} <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{c.rule.source}</span>
                    </span>
                    <span className="text-[12px] leading-snug text-muted">{c.score >= 1 ? `${c.room!.name} is there.` : c.room ? `${c.room.name} is ${c.score > 0 ? "next to" : "away from"} this spot. Drag walls or swap rooms to follow it.` : "The plan has no such room."}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="text-[11px] leading-relaxed text-faint">From the client conversation and concept sketch.</p>
        </Section>
      ) : null}
      <Section title="Vastu & feng shui" aside={<span className="font-mono text-[11px] text-faint">road faces {FACINGS[brief.facing ?? "east"].toLowerCase()}</span>}>
        <div className="flex items-end gap-3">
          <span className="tnum font-display text-[38px] leading-none text-ink">{vastu.score}</span>
          <span className="pb-1 text-[12px] text-muted">{brief.requirements.includes("vastu") ? "Vastu was asked for: layouts are chosen to suit it." : "Not asked for in the brief; shown for reference."}</span>
        </div>
        <ul className="flex flex-col divide-y divide-line rounded-xl border border-line bg-card">
          {vastu.items.map((i) => (
            <li key={i.id} className="flex items-start gap-2.5 px-3 py-2">
              <i className={clsx("mt-1.5 size-2 shrink-0 rounded-full", i.ok ? "bg-moss" : i.soft ? "bg-[#c99a4f]" : "bg-clay")} />
              <span className="flex flex-col">
                <span className="text-[13px] text-ink">
                  {i.label} <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{i.system}</span>
                </span>
                <span className="text-[12px] leading-snug text-muted">{i.detail}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] leading-relaxed text-faint">Common residential guidelines; traditions differ, so confirm with a Vastu consultant.</p>
      </Section>
    </>
  );
}

function FurniturePanel() {
  const design = useStudio((s) => s.design)!;
  const id = useStudio((s) => s.selection.furnitureId);
  const rotate = useStudio((s) => s.rotateFurniture);
  const remove = useStudio((s) => s.removeFurniture);
  const item = design.furniture.find((f) => f.id === id);
  if (!item) return null;
  const spec = FURNITURE[item.kind];
  return (
    <Section title="Selected piece">
      <div className="flex items-baseline justify-between">
        <span className="text-[15px] font-medium">{spec.label}</span>
        <span className="tnum font-mono text-[11px] text-muted">
          {fmtFt(spec.w)} × {fmtFt(spec.d)} · {item.rot}°
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button size="sm" onClick={() => rotate(item.id)}>
          <ArrowClockwise size={14} /> Rotate <span className="font-mono text-[10px] text-faint">R</span>
        </Button>
        <Button size="sm" onClick={() => remove(item.id)} className="text-clay">
          <Trash size={14} /> Remove <span className="font-mono text-[10px] text-faint">Del</span>
        </Button>
      </div>
    </Section>
  );
}

export function Properties() {
  const design = useStudio((s) => s.design)!;
  const project = useStudio((s) => s.project)!;
  const selection = useStudio((s) => s.selection);
  const setMaterial = useStudio((s) => s.setMaterial);
  const applyExterior = useStudio((s) => s.applyExterior);
  const applyInterior = useStudio((s) => s.applyInterior);
  const setLighting = useStudio((s) => s.setLighting);
  const restore = useStudio((s) => s.restoreVersion);
  const [tab, setTab] = React.useState<"exterior" | "interior" | "light" | "check">("exterior");
  const commit = useStudio((s) => s.commit);
  const hour = design.lighting.hour;
  const hh = Math.floor(hour);
  const mm = Math.round((hour - hh) * 60);
  const selected = selection.furnitureId || selection.roomId;

  return (
    <div className="flex flex-col">
      {selection.furnitureId ? <FurniturePanel /> : null}
      {selection.roomId ? <RoomPanel /> : null}
      {selected ? <div className="h-2 bg-sand" /> : null}
      <div className="sticky top-0 z-10 border-b border-line bg-paper/95 px-4 py-3 backdrop-blur">
        <Segmented
          label="Design panel"
          size="sm"
          value={tab}
          onChange={setTab}
          options={[
            { value: "exterior", label: "Exterior" },
            { value: "interior", label: "Interior" },
            { value: "light", label: "Light" },
            { value: "check", label: "Check" },
          ]}
        />
      </div>
      {tab === "check" ? <CheckPanel /> : null}
      {tab === "exterior" ? (
        <Section title="Roof">
          <Segmented
            label="Roof"
            size="sm"
            value={design.roof}
            onChange={(roof: RoofType) => commit((d) => ({ ...d, roof }))}
            options={[
              { value: "flat", label: "Flat" },
              { value: "gable", label: "Gable" },
              { value: "hip", label: "Hip" },
            ]}
          />
        </Section>
      ) : null}
      {tab === "exterior" || tab === "interior" ? (
        <>
          <Section title={tab === "exterior" ? "Exterior scheme" : "Interior scheme"}>
            <div className="flex flex-col gap-1">
              {(tab === "exterior" ? EXTERIOR_TEMPLATES : INTERIOR_TEMPLATES).map((t) => {
                const on = (tab === "exterior" ? design.exteriorTemplate : design.interiorTemplate) === t.id;
                return (
                  <button key={t.id} type="button" aria-pressed={on} onClick={() => (tab === "exterior" ? applyExterior(t.id) : applyInterior(t.id))} className={clsx("flex items-center gap-3 rounded-lg border px-2.5 py-2 text-left transition active:scale-[0.99]", on ? "border-ink bg-card shadow-[var(--shadow-lift)]" : "border-transparent hover:bg-card")}>
                    <span className="flex -space-x-1">
                      {Object.values(t.set).map((m, i) => (
                        <span key={i} className="size-4 rounded-full border-2 border-paper" style={{ background: m!.color }} />
                      ))}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13px]">{t.label}</span>
                      <span className="truncate text-[11px] text-muted">{t.blurb}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </Section>
          <Section title="Surfaces">
            <div className="flex flex-col gap-1.5">
              {(Object.keys(SLOTS) as MaterialSlot[])
                .filter((s) => SLOTS[s].group === (tab === "exterior" ? "Exterior" : "Interior"))
                .map((slot) => (
                  <MaterialEditor key={slot} slot={slot} choice={design.materials[slot]} onChange={(c) => setMaterial(slot, c)} />
                ))}
            </div>
          </Section>
        </>
      ) : (
        <>
          <Section title="Time of day" aside={<span className="tnum font-mono text-[12px] text-ink">{`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`}</span>}>
            <input type="range" className="af-range w-full" min={6} max={20} step={0.25} value={hour} onChange={(e) => useStudio.getState().preview((d) => ({ ...d, lighting: { ...d.lighting, hour: Number(e.target.value) } }))} onPointerDown={() => useStudio.getState().beginGesture()} onPointerUp={() => useStudio.getState().commit((d) => d)} onKeyUp={() => useStudio.getState().commit((d) => d)} aria-label="Time of day" />
            <div className="flex justify-between font-mono text-[10px] text-faint">
              <span>06:00</span>
              <span>13:00</span>
              <span>20:00</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { h: 9, label: "Morning", icon: SunHorizon },
                { h: 17.25, label: "Golden", icon: SunHorizon },
                { h: 19.5, label: "Evening", icon: MoonStars },
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <Button key={p.label} size="sm" onClick={() => setLighting({ hour: p.h })} className={clsx(Math.abs(hour - p.h) < 0.01 && "border-ink")}>
                    <Icon size={14} /> {p.label}
                  </Button>
                );
              })}
            </div>
          </Section>
          <Section title="Interior lights">
            <button type="button" role="switch" aria-checked={design.lighting.interior} onClick={() => setLighting({ interior: !design.lighting.interior })} className="flex items-center justify-between rounded-xl border border-line bg-card px-3 py-2.5 text-left">
              <span className="flex items-center gap-2 text-[13px]">
                <Lightbulb size={16} weight={design.lighting.interior ? "fill" : "regular"} className={design.lighting.interior ? "text-clay" : "text-muted"} /> Lights on
              </span>
              <span className={clsx("relative h-5 w-9 rounded-full transition", design.lighting.interior ? "bg-moss" : "bg-line-strong")}>
                <span className={clsx("absolute top-0.5 size-4 rounded-full bg-white shadow transition-all", design.lighting.interior ? "left-[18px]" : "left-0.5")} />
              </span>
            </button>
            <p className="text-[12px] text-muted">After dusk the house lights come on by themselves.</p>
          </Section>
        </>
      )}
      <Section title="Saved versions">
        {project.versions.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {project.versions.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-2">
                <span className="flex flex-col">
                  <span className="text-[12px] text-ink">{v.label}</span>
                  <span className="text-[11px] text-faint">{relative(v.at)}</span>
                </span>
                <button type="button" onClick={() => restore(v.id)} className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] text-ink-2 transition hover:bg-stone">
                  <ArrowCounterClockwise size={12} /> Restore
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted">Nothing saved yet. Each save keeps a version here, up to twelve, that you can restore.</p>
        )}
      </Section>
      <div className="px-4 py-4">
        <Eyebrow>Concept only</Eyebrow>
        <p className="mt-1 text-[12px] leading-relaxed text-muted">Dimensions are planning estimates from a template generator. Validate structure, services and local rules before construction.</p>
      </div>
    </div>
  );
}
