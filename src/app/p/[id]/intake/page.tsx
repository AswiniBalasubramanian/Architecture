"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Check, ClipboardText, FilePdf, Microphone, PencilSimpleLine, Plus, Quotes, Sparkle, Stop, UploadSimple, WarningCircle, X } from "@phosphor-icons/react";
import { FloorPlan } from "@/components/plan/FloorPlan";
import { ProjectMissing, ProjectSkeleton, useProject, useProjectId } from "@/components/ProjectGate";
import { LazyHouseScene, webglAvailable } from "@/components/three/LazyScene";
import { Button, Eyebrow, Field, Logo, NumberInput, Segmented, Stepper, inputClass } from "@/components/ui/kit";
import { Select } from "@/components/ui/Select";
import { CURRENCIES, DIRECTIONS, EXTERIOR_TEMPLATES, FACINGS, HOUSE_TYPES, INTERIOR_TEMPLATES, REQUIREMENTS } from "@/lib/catalog";
import { generate, materialsFor } from "@/lib/generator";
import { applyExtraction, type IntakeResult, type IntakeSource, type Suggestion } from "@/lib/intake";
import { checkRules, describeRule, PLAN_SPOTS, ROOM_LABEL, RULE_ROOMS, WHERE_LABEL, ZONES, type LayoutRule, type Where } from "@/lib/layoutRules";
import { saveProject } from "@/lib/persist";
import { money, sqft, withDesign } from "@/lib/projects";
import type { Brief, Currency, Design, Facing, HouseType, Requirement } from "@/lib/types";

/* ------------------------------------------------------------ speech input */

interface SpeechResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechResultLike>;
}
interface Recognizer {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: SpeechEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognizerCtor = new () => Recognizer;

function speechCtor(): RecognizerCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const LANGS = [
  { value: "en-IN", label: "English (India)" },
  { value: "en-US", label: "English (US)" },
  { value: "en-GB", label: "English (UK)" },
  { value: "hi-IN", label: "Hindi" },
  { value: "ta-IN", label: "Tamil" },
];

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Live microphone recording, transcribed by the browser's speech service as the client talks. */
function Recorder({ onText, disabled }: { onText: (final: string) => void; disabled?: boolean }) {
  const [supported, setSupported] = React.useState(true);
  const [lang, setLang] = React.useState("en-IN");
  const [on, setOn] = React.useState(false);
  const [interim, setInterim] = React.useState("");
  const [seconds, setSeconds] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const rec = React.useRef<Recognizer | null>(null);
  const want = React.useRef(false);
  const stream = React.useRef<MediaStream | null>(null);
  const bars = React.useRef<HTMLDivElement | null>(null);
  const frame = React.useRef(0);

  React.useEffect(() => setSupported(Boolean(speechCtor())), []);
  React.useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [on]);

  const stopMeter = () => {
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  React.useEffect(() => () => {
    want.current = false;
    rec.current?.stop();
    stopMeter();
  }, []);

  const start = async () => {
    const Ctor = speechCtor();
    if (!Ctor) return;
    setError(null);
    // A level meter, so it is obvious the microphone is hearing the room.
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream.current).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const el = bars.current;
        if (el)
          Array.from(el.children).forEach((c, i) => {
            const v = data[(i * 2 + 2) % data.length]! / 255;
            (c as HTMLElement).style.transform = `scaleY(${0.12 + v * 0.88})`;
          });
        frame.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      setError("The microphone is blocked. Allow it in the browser's site settings and try again.");
      return;
    }
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]!;
        if (res.isFinal) onText(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => {
      if (e.error === "no-speech" || e.error === "aborted") return;
      setError(e.error === "not-allowed" ? "The microphone is blocked. Allow it in the browser's site settings and try again." : e.error === "network" ? "The browser's speech service could not be reached. Check the connection, or upload a transcript instead." : `Recording stopped (${e.error}).`);
      want.current = false;
    };
    // Browsers end recognition after a pause; keep listening until the architect stops.
    r.onend = () => {
      if (want.current) {
        try {
          r.start();
          return;
        } catch {
          /* falls through to stopped */
        }
      }
      setOn(false);
      setInterim("");
      stopMeter();
    };
    rec.current = r;
    want.current = true;
    setSeconds(0);
    r.start();
    setOn(true);
  };
  const stop = () => {
    want.current = false;
    rec.current?.stop();
  };

  if (!supported)
    return (
      <div className="flex items-start gap-3 rounded-xl border border-line bg-sand/60 p-4 text-[13px] leading-relaxed text-ink-2">
        <WarningCircle size={18} className="mt-0.5 shrink-0 text-clay" />
        <span>This browser can&apos;t transcribe speech. Use Chrome or Edge to record here, or upload a transcript from your meeting app.</span>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-card p-4">
        <button
          type="button"
          onClick={on ? stop : start}
          disabled={disabled}
          aria-pressed={on}
          className={clsx(
            "relative flex size-14 shrink-0 items-center justify-center rounded-full transition active:scale-[0.97] disabled:opacity-40",
            on ? "bg-clay text-white" : "bg-ink text-paper hover:bg-ink-2",
          )}
          aria-label={on ? "Stop recording" : "Start recording"}
        >
          {on ? <span className="absolute inset-0 animate-ping rounded-full bg-clay/40" /> : null}
          {on ? <Stop size={20} weight="fill" /> : <Microphone size={22} weight="fill" />}
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-[14px] font-medium">{on ? "Listening" : "Record the meeting"}</span>
          <span className="tnum font-mono text-[12px] text-muted">{on ? fmtTime(seconds) : "Transcribed live as you talk"}</span>
        </div>
        <div ref={bars} aria-hidden className={clsx("flex h-8 items-center gap-[3px] transition-opacity", on ? "opacity-100" : "opacity-25")}>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="h-full w-[3px] origin-center rounded-full bg-moss" style={{ transform: "scaleY(0.12)" }} />
          ))}
        </div>
        <Select label="Spoken language" size="sm" value={lang} disabled={on} onChange={setLang} options={LANGS} className="w-[160px]" />
      </div>
      {interim ? <p className="rounded-lg bg-sand/60 px-3 py-2 text-[13px] italic text-muted">{interim}</p> : null}
      {error ? (
        <p role="alert" className="text-[12px] text-clay">
          {error}
        </p>
      ) : null}
      <p className="text-[12px] leading-relaxed text-muted">Ask the client before you record. Audio goes to the browser&apos;s speech service for transcription and isn&apos;t stored; only the text is kept with the project.</p>
    </div>
  );
}

/* ------------------------------------------------------------- file input */

async function readFileText(file: File): Promise<string> {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let line = "";
      const lines: string[] = [];
      for (const item of content.items) {
        if (!("str" in item)) continue;
        line += item.str;
        if (item.hasEOL) {
          lines.push(line);
          line = "";
        }
      }
      if (line) lines.push(line);
      pages.push(lines.join("\n"));
    }
    return pages.join("\n\n");
  }
  const text = await file.text();
  // Subtitle files: drop cue numbers and timestamps.
  if (/\.(vtt|srt)$/i.test(file.name))
    return text
      .split("\n")
      .filter((l) => l.trim() && !/^\d+$/.test(l.trim()) && !/-->/.test(l) && !/^WEBVTT/.test(l))
      .join("\n");
  return text;
}

function Uploader({ onText }: { onText: (text: string, name: string) => void }) {
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      const text = (await readFileText(file)).trim();
      if (text.length < 20) setError("No text was found in that file. If it's a scanned PDF, export the transcript as text from your meeting app instead.");
      else onText(text, file.name);
    } catch {
      setError("That file couldn't be read. Try a PDF with selectable text, or a .txt, .vtt or .srt transcript.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          void take(e.dataTransfer.files[0]);
        }}
        className={clsx("flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition", over ? "border-moss bg-moss-soft/40" : "border-line-strong bg-card hover:bg-sand/40")}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-sand text-ink-2">{busy ? <span className="af-skeleton size-5 rounded-full" /> : <FilePdf size={22} />}</span>
        <span className="text-[14px] font-medium">{busy ? "Reading the file…" : "Drop a transcript, or choose a file"}</span>
        <span className="text-[12px] text-muted">PDF, TXT, VTT or SRT · from Zoom, Meet, Teams, Otter or your own notes</span>
      </button>
      <input ref={input} type="file" accept=".pdf,.txt,.md,.vtt,.srt,application/pdf,text/plain" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      {error ? (
        <p role="alert" className="text-[12px] text-clay">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ sketch input */

/** Longest side sent to Claude; larger images are scaled down first. */
const SKETCH_MAX = 1568;

async function sketchToJpeg(file: File): Promise<string> {
  let source: CanvasImageSource & { width: number; height: number };
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const page = await doc.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: SKETCH_MAX / Math.max(base.width, base.height) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    source = canvas;
  } else {
    source = await createImageBitmap(file);
  }
  const k = Math.min(1, SKETCH_MAX / Math.max(source.width, source.height));
  const out = document.createElement("canvas");
  out.width = Math.round(source.width * k);
  out.height = Math.round(source.height * k);
  const ctx = out.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, 0, 0, out.width, out.height);
  return out.toDataURL("image/jpeg", 0.85);
}

function SketchInput({ sketch, onSketch }: { sketch: { dataUrl: string; name: string } | null; onSketch: (s: { dataUrl: string; name: string } | null) => void }) {
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const input = React.useRef<HTMLInputElement>(null);
  const take = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onSketch({ dataUrl: await sketchToJpeg(file), name: file.name });
    } catch {
      setError("That file couldn't be opened. Use a photo or scan (JPG, PNG) or a PDF of the plan.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-3">
      {sketch ? (
        <div className="relative overflow-hidden rounded-2xl border border-line bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={sketch.dataUrl} alt={`Concept sketch: ${sketch.name}`} className="max-h-[320px] w-full object-contain" />
          <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5">
            <span className="truncate text-[12px] text-muted">{sketch.name}</span>
            <button type="button" onClick={() => onSketch(null)} className="inline-flex items-center gap-1 text-[12px] text-muted transition hover:text-ink">
              <X size={12} /> Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void take(e.dataTransfer.files[0]);
          }}
          className={clsx("flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center transition", over ? "border-moss bg-moss-soft/40" : "border-line-strong bg-card hover:bg-sand/40")}
        >
          <span className="flex size-11 items-center justify-center rounded-full bg-sand text-ink-2">{busy ? <span className="af-skeleton size-5 rounded-full" /> : <PencilSimpleLine size={22} />}</span>
          <span className="text-[14px] font-medium">{busy ? "Preparing the sketch…" : "Drop a concept sketch or schematic plan"}</span>
          <span className="max-w-[40ch] text-[12px] text-muted">A phone photo of a hand sketch, a scan, or a PDF. Label the rooms and mark the road side for the best read.</span>
        </button>
      )}
      <input ref={input} type="file" accept="image/*,.pdf,application/pdf" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
      {error ? (
        <p role="alert" className="text-[12px] text-clay">
          {error}
        </p>
      ) : null}
      <p className="text-[12px] leading-relaxed text-muted">The sketch is read for where each room goes. The layouts then follow those positions where the plot and planning rules allow. You can add a conversation too.</p>
    </div>
  );
}

const MARK = (score: number) => (score >= 1 ? { dot: "bg-moss", label: "Followed" } : score > 0 ? { dot: "bg-[#c99a4f]", label: "Close" } : { dot: "bg-clay", label: "Not met" });

/** Placement rules, checked against the chosen house; editable. */
function RulesPanel({ brief, design, onChange }: { brief: Brief; design: Design | null; onChange: (rules: LayoutRule[]) => void }) {
  const rules = brief.layoutRules ?? [];
  const checks = design ? checkRules(brief, design) : [];
  const [room, setRoom] = React.useState<LayoutRule["room"]>("kitchen");
  const [where, setWhere] = React.useState<Where>("SE");
  const [floor, setFloor] = React.useState<string>("any");
  const met = checks.filter((c) => c.score >= 1).length;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-[14px] font-medium">Layout rules</span>
        {rules.length ? <span className="tnum font-mono text-[11px] text-muted">{met} of {rules.length} followed by the selected house</span> : null}
      </div>
      {rules.length ? (
        <ul className="flex flex-col divide-y divide-line">
          {rules.map((r, i) => {
            const c = checks[i];
            const m = MARK(c?.score ?? 0);
            return (
              <li key={`${r.room}-${r.where}-${i}`} className="flex items-start gap-3 py-2.5">
                <i className={clsx("mt-1.5 size-2 shrink-0 rounded-full", m.dot)} aria-label={m.label} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[13px] text-ink">
                    {describeRule(r)} <span className="ml-1 font-mono text-[10px] uppercase tracking-[0.1em] text-faint">{r.source}</span>
                  </span>
                  {r.quote ? <span className="line-clamp-2 text-[12px] italic leading-snug text-muted">&ldquo;{r.quote}&rdquo;</span> : null}
                  {c && c.score < 1 ? <span className="text-[12px] leading-snug text-muted">{c.room ? `${c.room.name} landed ${c.score > 0 ? "next to" : "away from"} this spot; the plot or the planning rules kept it there.` : "This plan has no such room yet."}</span> : null}
                </span>
                <button type="button" aria-label={`Remove rule: ${describeRule(r)}`} onClick={() => onChange(rules.filter((_, j) => j !== i))} className="text-muted transition hover:text-ink">
                  <X size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted">No placements were stated. Add one here, or upload a sketch, and the layouts will follow it where they can.</p>
      )}
      <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
        <Select label="Room" size="sm" className="w-[150px]" value={room} onChange={setRoom} options={RULE_ROOMS.map((r) => ({ value: r, label: ROOM_LABEL[r] }))} />
        <Select<Where>
          label="Position"
          size="sm"
          className="w-[170px]"
          value={where}
          onChange={setWhere}
          options={[...ZONES.map((z) => ({ value: z as Where, label: WHERE_LABEL[z], group: "Compass" })), ...PLAN_SPOTS.map((s) => ({ value: s as Where, label: WHERE_LABEL[s], group: "From the road" }))]}
        />
        <Select
          label="Floor"
          size="sm"
          className="w-[130px]"
          value={floor}
          onChange={setFloor}
          options={[{ value: "any", label: "Any floor" }, ...Array.from({ length: brief.floors }, (_, i) => ({ value: String(i), label: i === 0 ? "Ground floor" : i === 1 ? "First floor" : "Second floor" }))]}
        />
        <Button type="button" size="sm" onClick={() => onChange([...rules, { room, where, floor: floor === "any" ? null : Number(floor), source: "architect" }])}>
          <Plus size={12} weight="bold" /> Add rule
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- results */

const FIELD_LABEL: Record<string, string> = {
  plot: "Plot",
  builtUp: "Built-up area",
  floors: "Floors",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  budget: "Budget",
  facing: "Road faces",
  houseType: "House type",
  roof: "Roof",
};

function designFor(brief: Brief, s: Suggestion): { brief: Brief; design: Design } {
  const b: Brief = { ...brief, houseType: s.houseType };
  const d = generate(b, s.direction);
  return { brief: b, design: { ...d, exteriorTemplate: s.exterior, interiorTemplate: s.interior, materials: materialsFor(s.exterior, s.interior) } };
}

function Swatches({ s }: { s: Suggestion }) {
  const m = materialsFor(s.exterior, s.interior);
  return (
    <span className="flex -space-x-1">
      {(["exterior", "accent", "roof", "frames", "floor"] as const).map((k) => (
        <span key={k} title={k} className="size-4 rounded-full border border-card shadow-[0_0_0_1px_var(--color-line)]" style={{ background: m[k]?.color }} />
      ))}
    </span>
  );
}

/* ------------------------------------------------------------------- page */

export default function IntakePage() {
  const id = useProjectId();
  const router = useRouter();
  const [{ status, project }] = useProject(id);
  const [tab, setTab] = React.useState<IntakeSource | "sketch">("recording");
  const [sketch, setSketch] = React.useState<{ dataUrl: string; name: string } | null>(null);
  const [transcript, setTranscript] = React.useState("");
  const [source, setSource] = React.useState<IntakeSource>("recording");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [reading, setReading] = React.useState(false);
  const [readError, setReadError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<IntakeResult | null>(null);
  const [brief, setBrief] = React.useState<Brief | null>(null);
  const [pick, setPick] = React.useState(0);
  const [gl, setGl] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => setGl(webglAvailable()), []);
  // Pick up a conversation captured earlier for this project.
  const loaded = React.useRef(false);
  React.useEffect(() => {
    if (loaded.current || !project) return;
    loaded.current = true;
    if (project.intake) {
      setTranscript(project.intake.transcript);
      setSource(project.intake.source);
      setTab(project.intake.source);
      if (project.intake.sketch) setSketch(project.intake.sketch);
      if (project.intake.result) {
        setResult(project.intake.result);
        setBrief(applyExtraction(project.brief, project.intake.result.extraction));
      }
    }
  }, [project]);

  const suggestions = result?.extraction.suggestions ?? [];
  const briefLater = React.useDeferredValue(brief);
  const built = React.useMemo(() => (briefLater ? suggestions.map((s) => designFor(briefLater, s)) : []), [briefLater, suggestions]);
  const chosen = built[pick] ?? null;

  if (status === "loading") return <ProjectSkeleton />;
  if (status === "missing" || !project) return <ProjectMissing />;

  const words = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;
  const append = (text: string) => setTranscript((t) => (t.trim() ? `${t.trimEnd()}\n${text}` : text));

  const read = async () => {
    setReading(true);
    setReadError(null);
    try {
      const res = await fetch("/api/intake", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ transcript, image: sketch ? { data: sketch.dataUrl.split(",")[1], media_type: "image/jpeg" } : undefined }) });
      const data = (await res.json()) as IntakeResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "The brief couldn't be read.");
      setResult(data);
      setBrief(applyExtraction(project.brief, data.extraction));
      setPick(0);
      saveProject({ ...project, intake: { transcript, source, readBy: data.readBy, at: Date.now(), result: data, sketch: sketch ?? undefined }, updatedAt: Date.now() });
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (e) {
      setReadError(e instanceof Error ? e.message : "The brief couldn't be read.");
    } finally {
      setReading(false);
    }
  };

  const set = <K extends keyof Brief>(k: K, v: Brief[K]) => setBrief((b) => (b ? { ...b, [k]: v } : b));
  const toggleReq = (r: Requirement) => setBrief((b) => (b ? { ...b, requirements: b.requirements.includes(r) ? b.requirements.filter((x) => x !== r) : [...b.requirements, r] } : b));

  const intake = { transcript, source, readBy: result?.readBy ?? ("local" as const), at: Date.now(), result: result ?? undefined, sketch: sketch ?? undefined };
  const openStudio = () => {
    if (!chosen) return;
    setSaving(true);
    if (!saveProject({ ...withDesign({ ...project, brief: chosen.brief }, chosen.design), intake })) {
      setSaving(false);
      return;
    }
    router.push(`/p/${project.id}/studio`);
  };
  const compare = () => {
    if (!brief) return;
    saveProject({ ...project, brief, intake, updatedAt: Date.now() });
    router.push(`/p/${project.id}/generate`);
  };

  const x = result?.extraction;
  const evidenceFor = (field: string) => x?.evidence.find((e) => e.field === field || (field === "plot" && (e.field === "plotWidth" || e.field === "plotDepth")))?.quote;
  const heard = (field: string) => Boolean(evidenceFor(field));

  return (
    <div className="flex min-h-[100dvh] flex-col">
      <header className="flex h-14 items-center justify-between gap-3 border-b border-line px-4 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" aria-label="Home" className="text-ink">
            <Logo withWord={false} />
          </Link>
          <span className="h-5 w-px bg-line" />
          <span className="truncate text-[14px] font-medium">{project.brief.name}</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.12em] text-muted sm:inline">Step 2 of 4 · Client conversation</span>
        </div>
        <Link href={`/p/${project.id}/generate`} className="inline-flex shrink-0 items-center gap-1.5 text-[13px] text-muted transition hover:text-ink">
          Skip to directions <ArrowRight size={14} />
        </Link>
      </header>

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 grid-cols-1 gap-10 px-4 pb-24 pt-8 md:px-8 lg:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
        {/* Capture */}
        <section className="flex flex-col gap-6 lg:sticky lg:top-6 lg:self-start">
          <div className="af-enter flex flex-col gap-3">
            <Eyebrow>Client conversation</Eyebrow>
            <h1 className="text-[30px] font-medium leading-[1.08] tracking-[-0.025em] md:text-[36px]">Listen first. The brief fills itself in.</h1>
            <p className="text-[14px] leading-relaxed text-ink-2">Record the meeting or upload its transcript. ARCHFORM reads the plot, rooms, budget and how the family lives, then suggests three houses to start from.</p>
          </div>

          <Segmented
            label="How to capture the conversation"
            value={tab}
            onChange={(v: IntakeSource | "sketch") => setTab(v)}
            options={[
              { value: "recording", label: <><Microphone size={14} /> Record</> },
              { value: "upload", label: <><UploadSimple size={14} /> Upload</> },
              { value: "paste", label: <><ClipboardText size={14} /> Paste</> },
              { value: "sketch", label: <><PencilSimpleLine size={14} /> Sketch{sketch ? " ·1" : ""}</> },
            ]}
          />

          {tab === "recording" ? (
            <Recorder
              disabled={reading}
              onText={(t) => {
                setSource("recording");
                append(t);
              }}
            />
          ) : null}
          {tab === "sketch" ? <SketchInput sketch={sketch} onSketch={setSketch} /> : null}
          {tab === "upload" ? (
            <Uploader
              onText={(t, name) => {
                setSource("upload");
                setFileName(name);
                setTranscript(t);
              }}
            />
          ) : null}

          <Field label="Transcript" htmlFor="transcript" hint={<span className="tnum">{fileName && source === "upload" ? `${fileName} · ` : ""}{words.toLocaleString()} words · edit anything misheard</span>}>
            <textarea
              id="transcript"
              rows={tab === "paste" ? 14 : 9}
              className={clsx(inputClass, "h-auto resize-y py-2.5 leading-relaxed")}
              placeholder={tab === "paste" ? "Paste the conversation or your meeting notes here." : "The conversation appears here."}
              value={transcript}
              onChange={(e) => {
                if (tab === "paste") setSource("paste");
                setTranscript(e.target.value);
              }}
            />
          </Field>

          <div className="flex flex-col gap-2">
            <Button type="button" variant="primary" size="lg" onClick={read} disabled={reading || (words < 5 && !sketch)}>
              {reading ? (
                <>
                  <span className="af-skeleton size-4 rounded-full" /> Reading the conversation…
                </>
              ) : (
                <>
                  <Sparkle size={16} weight="fill" /> Read the brief from this conversation
                </>
              )}
            </Button>
            {readError ? (
              <p role="alert" className="text-[12px] text-clay">
                {readError}
              </p>
            ) : null}
          </div>
        </section>

        {/* Results */}
        <section ref={resultsRef} className="flex min-w-0 flex-col gap-8 scroll-mt-6">
          {!result || !brief || !x ? (
            <div className="af-grid flex min-h-[420px] flex-col items-start justify-end gap-3 rounded-2xl border border-line p-6">
              {reading ? (
                <div className="flex w-full flex-col gap-3" role="status" aria-label="Reading the conversation">
                  {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="af-skeleton h-12 rounded-xl" />
                  ))}
                </div>
              ) : (
                <>
                  <Quotes size={28} className="text-faint" />
                  <p className="max-w-[46ch] text-[15px] leading-relaxed text-ink-2">
                    &ldquo;We&apos;re thinking G+1 on a 30 by 40 east-facing plot, three bedrooms, a pooja room, and my parents need a room downstairs. Budget is around 80 lakhs.&rdquo;
                  </p>
                  <p className="text-[13px] text-muted">That&apos;s enough to start. The brief, open questions and three suggested houses appear here.</p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Heard */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-[20px] font-medium tracking-[-0.015em]">What the client asked for</h2>
                  <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">{result.readBy === "claude" ? "Read by Claude" : "Read on this device"}</span>
                </div>
                {result.note ? <p className="rounded-lg border border-line bg-sand/60 px-3 py-2 text-[12px] leading-relaxed text-ink-2">{result.note}</p> : null}

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 rounded-2xl border border-line bg-card p-5 sm:grid-cols-2">
                  {[
                    {
                      key: "plot",
                      node: (
                        <div className="grid grid-cols-2 gap-2">
                          <NumberInput value={brief.plotWidth} onChange={(v) => set("plotWidth", v)} suffix="ft" />
                          <NumberInput value={brief.plotDepth} onChange={(v) => set("plotDepth", v)} suffix="ft" />
                        </div>
                      ),
                    },
                    { key: "builtUp", node: <NumberInput value={brief.builtUp} onChange={(v) => set("builtUp", v)} step={50} suffix="sq ft" /> },
                    { key: "floors", node: <Stepper label="floors" value={brief.floors} min={1} max={3} onChange={(v) => set("floors", v)} /> },
                    { key: "bedrooms", node: <Stepper label="bedrooms" value={brief.bedrooms} min={1} max={6} onChange={(v) => set("bedrooms", v)} /> },
                    { key: "bathrooms", node: <Stepper label="bathrooms" value={brief.bathrooms} min={1} max={6} onChange={(v) => set("bathrooms", v)} /> },
                    {
                      key: "budget",
                      node: (
                        <div className="grid grid-cols-[1fr_92px] gap-2">
                          <NumberInput value={brief.budget} onChange={(v) => set("budget", v)} step={50000} />
                          <Select label="Currency" value={brief.currency} onChange={(v) => set("currency", v)} options={(Object.keys(CURRENCIES) as Currency[]).map((c) => ({ value: c, label: c }))} />
                        </div>
                      ),
                    },
                    {
                      key: "facing",
                      node: (
                        <Select label="Road faces" value={brief.facing ?? "east"} onChange={(v) => set("facing", v)} options={(Object.keys(FACINGS) as Facing[]).map((f) => ({ value: f, label: FACINGS[f] }))} />
                      ),
                    },
                    {
                      key: "houseType",
                      node: (
                        <Select label="House type" value={brief.houseType} onChange={(v) => set("houseType", v)} options={(Object.keys(HOUSE_TYPES) as HouseType[]).map((t) => ({ value: t, label: HOUSE_TYPES[t].label }))} />
                      ),
                    },
                  ].map(({ key, node }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <span className="flex items-center gap-2 text-[13px] font-medium text-ink">
                        {FIELD_LABEL[key]}
                        {heard(key) ? <span className="inline-flex items-center gap-1 rounded-full bg-moss-soft px-1.5 py-0.5 text-[10px] font-normal text-moss-2"><Check size={9} weight="bold" /> heard</span> : <span className="text-[10px] font-normal text-faint">not said · from the brief</span>}
                      </span>
                      {node}
                      {evidenceFor(key) ? <span className="line-clamp-2 text-[12px] italic leading-snug text-muted">&ldquo;{evidenceFor(key)}&rdquo;</span> : null}
                    </div>
                  ))}
                  <p className="tnum text-[12px] text-muted sm:col-span-2">
                    {sqft(brief.plotWidth * brief.plotDepth)} plot · {money(brief.budget, brief.currency)}
                    {brief.builtUp > 0 ? ` · ${money(brief.budget / brief.builtUp, brief.currency)} per sq ft` : ""}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-[13px] font-medium">Requirements</span>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(REQUIREMENTS) as Requirement[]).map((r) => {
                      const on = brief.requirements.includes(r);
                      return (
                        <button key={r} type="button" aria-pressed={on} onClick={() => toggleReq(r)} className={clsx("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12px] transition active:scale-[0.98]", on ? "border-moss bg-moss-soft text-moss-2" : "border-line text-ink-2 hover:border-line-strong")}>
                          {on ? <Check size={11} weight="bold" /> : <span className="size-2.5 rounded-full border border-line-strong" />}
                          {REQUIREMENTS[r]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <Field label="How they live" htmlFor="notes" hint="Read from the conversation; kept with the project.">
                  <textarea id="notes" rows={3} className={clsx(inputClass, "h-auto py-2.5")} value={brief.notes} onChange={(e) => set("notes", e.target.value)} />
                </Field>

                {x.openQuestions.length ? (
                  <div className="flex flex-col gap-2 rounded-2xl border border-line p-5">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Ask at the next meeting</span>
                    <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-[14px] leading-relaxed text-ink-2">
                      {x.openQuestions.map((q) => (
                        <li key={q}>{q}</li>
                      ))}
                    </ol>
                  </div>
                ) : null}

                {x.sketchSummary ? (
                  <div className="flex gap-4 rounded-2xl border border-line p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {sketch ? <img src={sketch.dataUrl} alt="" className="h-20 w-20 shrink-0 rounded-lg border border-line object-cover" /> : null}
                    <span className="flex flex-col gap-1">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">From the sketch</span>
                      <span className="text-[13px] leading-relaxed text-ink-2">{x.sketchSummary}</span>
                    </span>
                  </div>
                ) : null}

                <RulesPanel brief={brief} design={chosen?.design ?? null} onChange={(rules) => set("layoutRules", rules)} />
              </div>

              {/* Suggested houses */}
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[20px] font-medium tracking-[-0.015em]">Three houses to start from</h2>
                  <p className="text-[13px] text-muted">Pick one to open in the studio. Everything stays editable.</p>
                </div>

                <div className="relative h-[380px] overflow-hidden rounded-2xl border border-line bg-sand">
                  {chosen && gl ? (
                    <LazyHouseScene key={pick} brief={chosen.brief} design={chosen.design} autoRotate intro className="h-full w-full" />
                  ) : chosen ? (
                    <div className="flex h-full items-center justify-center p-6">
                      <FloorPlan design={chosen.design} floor={0} className="max-h-full" />
                    </div>
                  ) : null}
                  {chosen ? (
                    <p className="pointer-events-none absolute bottom-4 left-4 rounded-full bg-card/90 px-3 py-1.5 font-mono text-[11px] text-ink-2 shadow-[var(--shadow-lift)]">
                      {suggestions[pick]!.title} · {DIRECTIONS[suggestions[pick]!.direction].label}
                    </p>
                  ) : null}
                </div>

                <div role="radiogroup" aria-label="Suggested houses" className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  {suggestions.map((s, i) => {
                    const on = i === pick;
                    const d = built[i];
                    if (!d) return null;
                    const rc = checkRules(d.brief, d.design);
                    const metCount = rc.filter((c) => c.score >= 1).length;
                    return (
                      <button
                        key={`${s.direction}-${s.exterior}-${i}`}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setPick(i)}
                        className={clsx("flex flex-col overflow-hidden rounded-2xl border text-left transition duration-200 active:scale-[0.99]", on ? "border-ink bg-card shadow-[var(--shadow-lift)]" : "border-line hover:border-line-strong hover:bg-card/60")}
                      >
                        <div className="af-grid flex h-36 items-center justify-center border-b border-line p-3">
                          <FloorPlan design={d.design} floor={0} showFurniture={false} showLabels={false} className="max-h-full" />
                        </div>
                        <div className="flex flex-1 flex-col gap-2 p-4">
                          <span className="flex items-center justify-between gap-2">
                            <span className="text-[14px] font-medium leading-snug">{s.title}</span>
                            <span className={clsx("flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-ink bg-ink text-paper" : "border-line-strong")}>{on ? <Check size={10} weight="bold" /> : null}</span>
                          </span>
                          <span className="text-[12px] leading-snug text-muted">{s.why}</span>
                          {rc.length ? <span className={clsx("tnum self-start rounded-full px-2 py-0.5 text-[11px]", metCount === rc.length ? "bg-moss-soft text-moss-2" : "bg-sand text-ink-2")}>Follows {metCount} of {rc.length} layout rules</span> : null}
                          <span className="mt-auto flex items-center justify-between gap-2 pt-2">
                            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-faint">
                              {DIRECTIONS[s.direction].label} · {EXTERIOR_TEMPLATES.find((t) => t.id === s.exterior)?.label} · {INTERIOR_TEMPLATES.find((t) => t.id === s.interior)?.label}
                            </span>
                            <Swatches s={s} />
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button type="button" variant="primary" size="lg" className="sm:flex-1" onClick={openStudio} disabled={!chosen || saving}>
                    {saving ? "Opening the studio…" : "Open this house in the studio"} <ArrowRight size={16} weight="bold" />
                  </Button>
                  <Button type="button" size="lg" onClick={compare}>
                    Compare all directions
                  </Button>
                </div>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

