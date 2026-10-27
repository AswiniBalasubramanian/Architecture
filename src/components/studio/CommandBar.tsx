"use client";

import * as React from "react";
import clsx from "clsx";
import { ArrowArcLeft, ArrowUp, CaretDown, CaretUp, Check, Sparkle, WarningCircle } from "@phosphor-icons/react";
import { applyOps, EXAMPLES, readCommand, type Op } from "@/lib/commands";
import { useStudio, type ViewMode } from "@/lib/store";
import type { Brief, Design } from "@/lib/types";

interface Turn {
  id: number;
  text: string;
  reply: string;
  done: string[];
  failed: string[];
  readBy: "claude" | "keywords";
  /** The design and brief before this turn, so the turn can be undone on its own. */
  before: { design: Design; brief: Brief } | null;
  undone?: boolean;
}

/** What Claude needs to know about the house to resolve "the kitchen" or "this room". */
function contextOf(design: Design, brief: Brief, selected: string | null) {
  const furnitureIn = (r: Design["rooms"][number]) =>
    design.furniture.filter((f) => f.floor === r.floor && f.x > r.x && f.x < r.x + r.w && f.y > r.y && f.y < r.y + r.d).map((f) => f.kind);
  return {
    brief: { name: brief.name, plot: `${brief.plotWidth} x ${brief.plotDepth} ft`, builtUp: brief.builtUp, floors: brief.floors, bedrooms: brief.bedrooms, bathrooms: brief.bathrooms, houseType: brief.houseType, facing: brief.facing ?? "east", requirements: brief.requirements, layoutRules: brief.layoutRules ?? [] },
    direction: design.direction,
    roof: design.roof,
    exteriorScheme: design.exteriorTemplate,
    interiorScheme: design.interiorTemplate,
    lighting: design.lighting,
    selectedRoom: selected,
    rooms: design.rooms.map((r) => ({ id: r.id, name: r.name, type: r.type, floor: r.floor, size: `${r.w} x ${r.d} ft`, furniture: furnitureIn(r) })),
  };
}

/**
 * The prompt bar under the canvas. Requests become operations on the design
 * (and the brief) applied as one undoable step; Claude reads them when it is
 * configured, otherwise the common phrasings are read by keyword.
 */
export function CommandBar({ onToast }: { onToast?: (text: string) => void }) {
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [open, setOpen] = React.useState(true);
  const [focused, setFocused] = React.useState(false);
  const input = React.useRef<HTMLTextAreaElement>(null);
  const log = React.useRef<HTMLOListElement>(null);
  const next = React.useRef(1);
  const sent = React.useRef<string[]>([]);

  // "/" focuses the bar from anywhere outside a field.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || (e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  React.useEffect(() => {
    log.current?.lastElementChild?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  const runUi = (ops: Op[]) => {
    const st = useStudio.getState();
    for (const o of ops) {
      if (o.op === "undo") st.undo();
      else if (o.op === "redo") st.redo();
      else if (o.op === "save") onToast?.(st.save(o.value ?? undefined) ? "Saved" : "Couldn't save: browser storage is full or blocked");
      else if (o.op === "view") {
        if (o.value === "plan" || o.value === "3d" || o.value === "split") st.setView(o.value as ViewMode);
        if (o.flag !== null) {
          st.setCutaway(o.flag);
          if (o.flag === false && st.view === "plan") st.setView("split");
        }
      }
    }
  };

  const send = async (raw = text) => {
    const request = raw.trim();
    const st = useStudio.getState();
    if (!request || busy || !st.design || !st.project) return;
    setBusy(true);
    setText("");
    sent.current = [request, ...sent.current.filter((x) => x !== request)].slice(0, 20);
    const ctx = { design: st.design, brief: st.project.brief, selectedRoomId: st.selection.roomId };

    let ops: Op[] = [];
    let reply = "";
    let readBy: Turn["readBy"] = "keywords";
    let note = "";
    try {
      const res = await fetch("/api/studio", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: request, context: contextOf(ctx.design, ctx.brief, ctx.selectedRoomId) }) });
      const data = (await res.json()) as { fallback?: boolean; reason?: string; reply?: string; ops?: Op[]; error?: string };
      if (data.ops && !data.fallback) {
        ops = data.ops;
        reply = data.reply ?? "";
        readBy = "claude";
      } else if (data.reason === "busy") note = "Claude is busy; read by keyword instead.";
      else if (data.reason === "error") note = "Claude couldn't be reached; read by keyword instead.";
    } catch {
      note = "Offline; read by keyword.";
    }
    if (readBy === "keywords") ({ ops, reply } = readCommand(request, ctx));

    // Read the latest state: the request may have taken a moment.
    const now = useStudio.getState();
    const before = now.design && now.project ? { design: now.design, brief: now.project.brief } : null;
    const result = now.design && now.project ? applyOps({ design: now.design, brief: now.project.brief, selectedRoomId: now.selection.roomId }, ops) : null;
    let changed = false;
    if (result && before) {
      if (result.design !== before.design) {
        now.commit(() => result.design);
        changed = true;
      }
      if (result.brief !== before.brief) now.setBrief(result.brief);
      runUi(result.ui);
    }
    const done = [...(result?.done ?? []), ...(result?.regenerated ? ["Layout regenerated; finishes kept"] : [])];
    setTurns((t) => [
      ...t.slice(-30),
      {
        id: next.current++,
        text: request,
        reply: [reply || (done.length ? "Done." : result?.failed.length ? "" : "Nothing to change."), note].filter(Boolean).join(" "),
        done,
        failed: result?.failed ?? [],
        readBy,
        before: changed || result?.brief !== before?.brief ? before : null,
      },
    ]);
    setOpen(true);
    setBusy(false);
    input.current?.focus();
  };

  const undoTurn = (turn: Turn) => {
    if (!turn.before) return;
    const st = useStudio.getState();
    st.commit(() => turn.before!.design);
    st.setBrief(turn.before.brief);
    setTurns((t) => t.map((x) => (x.id === turn.id ? { ...x, undone: true } : x)));
  };

  const showExamples = focused && !text && !busy;
  return (
    <div className="relative z-20 shrink-0 border-t border-line bg-paper/95 px-3 pb-3 pt-2 backdrop-blur">
      {turns.length && open && !showExamples ? (
        <ol ref={log} aria-label="Command history" aria-live="polite" className="absolute bottom-full left-3 right-3 mb-2 flex max-h-[min(34vh,320px)] max-w-[560px] flex-col gap-2 overflow-y-auto rounded-2xl border border-line bg-paper/90 p-3 shadow-[var(--shadow-lift),0_18px_40px_-20px_#1d1f1e40] backdrop-blur-md">
          {turns.map((t) => (
            <li key={t.id} className="flex flex-col gap-1.5">
              <span className="self-end rounded-2xl rounded-br-md bg-ink px-3 py-1.5 text-[13px] text-paper">{t.text}</span>
              <div className="flex flex-col gap-1 self-start rounded-2xl rounded-bl-md border border-line bg-card px-3 py-2 text-[13px] text-ink-2 shadow-[var(--shadow-lift)]">
                {t.reply ? <span className="text-ink">{t.reply}</span> : null}
                {t.done.map((d) => (
                  <span key={d} className="flex items-start gap-1.5">
                    <Check size={12} weight="bold" className="mt-[3px] shrink-0 text-moss" /> {d}
                  </span>
                ))}
                {t.failed.map((d) => (
                  <span key={d} className="flex items-start gap-1.5 text-clay">
                    <WarningCircle size={12} className="mt-[3px] shrink-0" /> {d}
                  </span>
                ))}
                <span className="flex items-center gap-3 pt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-faint">
                  {t.readBy === "claude" ? "Claude" : "Keywords"}
                  {t.before && !t.undone ? (
                    <button type="button" onClick={() => undoTurn(t)} className="inline-flex items-center gap-1 normal-case tracking-normal text-muted transition hover:text-ink">
                      <ArrowArcLeft size={11} /> Undo this
                    </button>
                  ) : t.undone ? (
                    <span className="normal-case tracking-normal">Undone</span>
                  ) : null}
                </span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}

      {showExamples ? (
        <div className="absolute inset-x-3 bottom-full mb-2 flex flex-wrap gap-1.5">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              type="button"
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => void send(e)}
              className="rounded-full border border-line bg-card px-2.5 py-1 text-[12px] text-ink-2 transition hover:border-line-strong hover:text-ink active:scale-[0.98]"
            >
              {e}
            </button>
          ))}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className={clsx("flex items-end gap-2 rounded-2xl border bg-card p-1.5 pl-3 shadow-[var(--shadow-lift)] transition", focused ? "border-moss ring-4 ring-moss/10" : "border-line")}
      >
        <Sparkle size={16} weight="fill" className={clsx("mb-2 shrink-0", busy ? "animate-pulse text-moss" : "text-moss")} aria-hidden />
        <label htmlFor="command" className="sr-only">
          Ask ARCHFORM to change the house
        </label>
        <textarea
          ref={input}
          id="command"
          rows={1}
          value={text}
          disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            } else if (e.key === "ArrowUp" && !text && sent.current[0]) {
              e.preventDefault();
              setText(sent.current[0]);
            } else if (e.key === "Escape") input.current?.blur();
          }}
          placeholder={busy ? "Working on it…" : "Ask for a change: “gable roof”, “four bedrooms”, “kitchen in the south-east”, “add a sofa to the living room”…"}
          className="max-h-28 min-h-[34px] flex-1 resize-none bg-transparent py-[7px] text-[14px] leading-snug text-ink outline-none placeholder:text-faint disabled:opacity-60"
        />
        {turns.length ? (
          <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Hide history" : "Show history"} className="mb-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-stone hover:text-ink">
            {open ? <CaretDown size={14} /> : <CaretUp size={14} />}
          </button>
        ) : null}
        <button type="submit" disabled={busy || !text.trim()} aria-label="Send" className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-ink text-paper transition hover:bg-ink-2 active:scale-[0.96] disabled:opacity-30">
          {busy ? <span className="size-3 animate-spin rounded-full border-2 border-paper/40 border-t-paper" /> : <ArrowUp size={15} weight="bold" />}
        </button>
      </form>
      <p className="mt-1.5 hidden px-1 font-mono text-[10px] text-faint md:block">
        <span className="rounded border border-line px-1">/</span> to focus · Enter to send · every change is one undo step
      </p>
    </div>
  );
}
