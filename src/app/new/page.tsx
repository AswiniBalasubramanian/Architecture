"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Check } from "@phosphor-icons/react";
import { Button, Eyebrow, Field, NumberInput, SiteHeader, Stepper, inputClass } from "@/components/ui/kit";
import { CURRENCIES, FACINGS, HOUSE_TYPES, REQUIREMENTS } from "@/lib/catalog";
import { defaultAssumptions, defaultBrief, footprintOf } from "@/lib/generator";
import { saveProject } from "@/lib/persist";
import { getSession } from "@/lib/session";
import { createProject, DEFAULT_ARCHITECT, money, sqft } from "@/lib/projects";
import type { Brief, Currency, HouseType, Requirement } from "@/lib/types";

function validate(b: Brief) {
  const e: Partial<Record<keyof Brief | "assumptions" | "fit", string>> = {};
  if (!b.name.trim()) e.name = "Give the project a name.";
  if (!(b.plotWidth >= 18 && b.plotWidth <= 300)) e.plotWidth = "Between 18 and 300 ft.";
  if (!(b.plotDepth >= 24 && b.plotDepth <= 400)) e.plotDepth = "Between 24 and 400 ft.";
  if (!(b.builtUp >= 400 && b.builtUp <= 20000)) e.builtUp = "Between 400 and 20,000 sq ft.";
  if (!(b.budget > 0)) e.budget = "Enter a budget greater than zero.";
  const a = b.assumptions;
  if (![a.setbackFront, a.setbackRear, a.setbackSide].every((v) => v >= 0 && v < 60) || !(a.floorHeight >= 9 && a.floorHeight <= 14)) e.assumptions = "Setbacks 0–60 ft; floor height 9–14 ft.";
  if (!e.plotWidth && !e.plotDepth && !e.builtUp && !e.assumptions) {
    const bw = b.plotWidth - a.setbackSide * 2;
    const bd = b.plotDepth - a.setbackFront - a.setbackRear;
    if (bw < 16 || bd < 20) e.fit = "The setbacks leave too little room to build. Reduce them or enlarge the plot.";
    else if (b.builtUp / b.floors > bw * bd * 1.02) e.fit = `One floor needs ${Math.round(b.builtUp / b.floors).toLocaleString()} sq ft but the buildable zone is ${Math.round(bw * bd).toLocaleString()} sq ft. Add a floor or reduce the area; otherwise the footprint is capped.`;
  }
  return e;
}

function PlotDiagram({ brief }: { brief: Brief }) {
  const fp = footprintOf(brief);
  const W = brief.plotWidth;
  const D = brief.plotDepth;
  const pad = 14;
  const scale = Math.min((300 - pad * 2) / W, (300 - pad * 2) / D);
  const w = W * scale;
  const d = D * scale;
  const ox = (300 - w) / 2;
  const oy = (300 - d) / 2;
  const Y = (y: number) => oy + d - y * scale;
  const a = brief.assumptions;
  return (
    <svg viewBox="0 0 300 300" className="w-full" role="img" aria-label={`Plot ${W} by ${D} ft with a ${fp.w} by ${fp.d} ft footprint`}>
      <defs>
        <pattern id="plot-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0 0V5" stroke="#c9c1b3" strokeWidth="0.7" />
        </pattern>
      </defs>
      <rect x={ox} y={oy} width={w} height={d} fill="url(#plot-hatch)" stroke="#5a5c57" strokeWidth="1" />
      <rect x={ox + a.setbackSide * scale} y={Y(D - a.setbackRear)} width={(W - a.setbackSide * 2) * scale} height={(D - a.setbackFront - a.setbackRear) * scale} fill="#fbfaf7" stroke="#9a968c" strokeDasharray="3 3" strokeWidth="0.8" />
      <rect x={ox + fp.x * scale} y={Y(fp.y + fp.d)} width={fp.w * scale} height={fp.d * scale} fill="#e1e7dc" stroke="#3d4d40" strokeWidth="1.4" className="transition-all duration-500" />
      <text x={ox + w / 2} y={oy + d + 11} textAnchor="middle" fontSize="8" fill="#7a7972" fontFamily="var(--font-geist-mono)" letterSpacing="1">
        STREET · {W} FT
      </text>
      <text transform={`translate(${ox - 6} ${oy + d / 2}) rotate(-90)`} textAnchor="middle" fontSize="8" fill="#7a7972" fontFamily="var(--font-geist-mono)">
        {D} FT
      </text>
      <text x={ox + (fp.x + fp.w / 2) * scale} y={Y(fp.y + fp.d / 2) + 3} textAnchor="middle" fontSize="9" fill="#262826" fontFamily="var(--font-geist-mono)">
        {fp.w} × {fp.d}
      </text>
    </svg>
  );
}

export default function NewProject() {
  const router = useRouter();
  const [brief, setBrief] = React.useState<Brief>(() => ({ ...defaultBrief(), name: "" }));
  const [architect, setArchitect] = React.useState(DEFAULT_ARCHITECT);
  React.useEffect(() => {
    const s = getSession();
    if (s?.studio) setArchitect(s.studio);
  }, []);
  const [assumptionsTouched, setAssumptionsTouched] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [storageError, setStorageError] = React.useState(false);

  const set = <K extends keyof Brief>(key: K, value: Brief[K]) =>
    setBrief((b) => {
      const next = { ...b, [key]: value };
      // Setbacks follow the plot until the architect edits them.
      if ((key === "plotWidth" || key === "plotDepth") && !assumptionsTouched && Number.isFinite(next.plotWidth) && Number.isFinite(next.plotDepth)) next.assumptions = { ...defaultAssumptions(next.plotWidth, next.plotDepth), floorHeight: b.assumptions.floorHeight };
      if (key === "houseType") next.floors = HOUSE_TYPES[value as HouseType].floors;
      return next;
    });
  const setA = (key: keyof Brief["assumptions"], value: number) => {
    setAssumptionsTouched(true);
    setBrief((b) => ({ ...b, assumptions: { ...b.assumptions, [key]: value } }));
  };
  const toggleReq = (r: Requirement) => set("requirements", brief.requirements.includes(r) ? brief.requirements.filter((x) => x !== r) : [...brief.requirements, r]);

  const errors = validate(brief);
  const shown = (k: keyof typeof errors) => (submitted ? errors[k] : undefined);
  const blocking = Object.keys(errors).filter((k) => k !== "fit");
  const fp = Number.isFinite(brief.plotWidth) && Number.isFinite(brief.plotDepth) && !errors.assumptions && !errors.plotWidth && !errors.plotDepth ? footprintOf(brief) : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (blocking.length) {
      document.querySelector<HTMLElement>("[aria-invalid=true], [role=alert]")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    const project = createProject({ ...brief, name: brief.name.trim() }, architect.trim() || DEFAULT_ARCHITECT);
    if (!saveProject(project)) {
      setSaving(false);
      setStorageError(true);
      return;
    }
    router.push(`/p/${project.id}/generate`);
  };

  const section = "grid grid-cols-1 gap-x-6 gap-y-5 border-t border-line pt-8 md:grid-cols-[200px_minmax(0,1fr)]";

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <form onSubmit={submit} noValidate className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 pb-24 pt-10 md:px-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-10">
          <div className="af-enter flex max-w-[640px] flex-col gap-3">
            <Eyebrow>New project · Step 1 of 3</Eyebrow>
            <h1 className="text-[32px] font-medium leading-[1.08] tracking-[-0.025em] md:text-[40px]">Describe the site and the brief.</h1>
            <p className="text-[15px] leading-relaxed text-ink-2">Everything here stays editable. The next step lays out three design directions from these numbers.</p>
          </div>

          <fieldset className={section}>
            <legend className="sr-only">Project</legend>
            <div>
              <p className="text-[14px] font-medium">Project</p>
              <p className="mt-1 text-[13px] text-muted">Shown on the buyer&apos;s cover.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Project name" htmlFor="name" error={shown("name")}>
                <input id="name" className={inputClass} placeholder="e.g. Residence at Koramangala" value={brief.name} aria-invalid={Boolean(shown("name")) || undefined} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Location" htmlFor="location" hint="City and region">
                <input id="location" className={inputClass} value={brief.location} onChange={(e) => set("location", e.target.value)} />
              </Field>
              <Field label="Architect" htmlFor="architect" hint="Attribution in the buyer viewer" className="sm:col-span-2">
                <input id="architect" className={inputClass} value={architect} onChange={(e) => setArchitect(e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className="sr-only">Site</legend>
            <div>
              <p className="text-[14px] font-medium">Site</p>
              <p className="mt-1 text-[13px] text-muted">Frontage faces the street.</p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Plot frontage" htmlFor="pw" error={shown("plotWidth")}>
                <NumberInput id="pw" value={brief.plotWidth} onChange={(v) => set("plotWidth", v)} suffix="ft" invalid={Boolean(shown("plotWidth"))} />
              </Field>
              <Field label="Plot depth" htmlFor="pd" error={shown("plotDepth")}>
                <NumberInput id="pd" value={brief.plotDepth} onChange={(v) => set("plotDepth", v)} suffix="ft" invalid={Boolean(shown("plotDepth"))} />
              </Field>
              <Field label="Built-up area" htmlFor="bu" error={shown("builtUp")} hint="All floors together">
                <NumberInput id="bu" value={brief.builtUp} onChange={(v) => set("builtUp", v)} step={50} suffix="sq ft" invalid={Boolean(shown("builtUp"))} />
              </Field>
              <div className="flex flex-col gap-2 sm:col-span-3">
                <span className="text-[13px] font-medium text-ink">Road faces</span>
                <div role="radiogroup" aria-label="Road faces" className="flex flex-wrap gap-1.5">
                  {(Object.keys(FACINGS) as Array<keyof typeof FACINGS>).map((k) => {
                    const on = (brief.facing ?? "east") === k;
                    return (
                      <button key={k} type="button" role="radio" aria-checked={on} onClick={() => setBrief((b) => ({ ...b, facing: k }))} className={on ? "rounded-lg border border-ink bg-ink px-3 py-1.5 text-[13px] text-paper" : "rounded-lg border border-line bg-card px-3 py-1.5 text-[13px] text-ink-2 transition hover:border-line-strong"}>
                        {FACINGS[k]}
                      </button>
                    );
                  })}
                </div>
                <span className="text-[12px] text-muted">The compass direction of the street frontage. Used for Vastu placement and the sun.</span>
              </div>
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className="sr-only">House type</legend>
            <div>
              <p className="text-[14px] font-medium">House type</p>
              <p className="mt-1 text-[13px] text-muted">Sets the roof and default floors.</p>
            </div>
            <div role="radiogroup" aria-label="House type" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(Object.keys(HOUSE_TYPES) as HouseType[]).map((t) => {
                const on = brief.houseType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("houseType", t)}
                    aria-label={`${HOUSE_TYPES[t].label}: ${HOUSE_TYPES[t].blurb}`}
                    className={clsx(
                      "group flex items-start justify-between gap-3 rounded-xl border p-4 text-left transition duration-200 active:scale-[0.99]",
                      on ? "border-ink bg-card shadow-[var(--shadow-lift)]" : "border-line hover:border-line-strong hover:bg-card/60",
                    )}
                  >
                    <span className="flex flex-col gap-1">
                      <span className="text-[14px] font-medium">{HOUSE_TYPES[t].label}</span>
                      <span className="text-[12px] leading-snug text-muted">{HOUSE_TYPES[t].blurb}</span>
                    </span>
                    <span className={clsx("mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition", on ? "border-ink bg-ink text-paper" : "border-line-strong")}>{on ? <Check size={10} weight="bold" /> : null}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className="sr-only">Programme</legend>
            <div>
              <p className="text-[14px] font-medium">Programme</p>
              <p className="mt-1 text-[13px] text-muted">Rooms the plan must hold.</p>
            </div>
            <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
              <Field label="Floors" htmlFor="fl">
                <Stepper id="fl" label="floors" value={brief.floors} min={1} max={3} onChange={(v) => set("floors", v)} />
              </Field>
              <Field label="Bedrooms" htmlFor="bd">
                <Stepper id="bd" label="bedrooms" value={brief.bedrooms} min={1} max={6} onChange={(v) => set("bedrooms", v)} />
              </Field>
              <Field label="Bathrooms" htmlFor="ba">
                <Stepper id="ba" label="bathrooms" value={brief.bathrooms} min={1} max={6} onChange={(v) => set("bathrooms", v)} />
              </Field>
              <Field label="Currency" htmlFor="cur">
                <select id="cur" className={inputClass} value={brief.currency} onChange={(e) => set("currency", e.target.value as Currency)}>
                  {(Object.keys(CURRENCIES) as Currency[]).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </Field>
              <Field label="Budget" htmlFor="budget" error={shown("budget")} hint={Number.isFinite(brief.budget) && brief.budget > 0 ? money(brief.budget, brief.currency) : undefined} className="col-span-2">
                <NumberInput id="budget" value={brief.budget} onChange={(v) => set("budget", v)} step={50000} suffix={brief.currency} invalid={Boolean(shown("budget"))} />
              </Field>
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className="sr-only">Requirements</legend>
            <div>
              <p className="text-[14px] font-medium">Requirements</p>
              <p className="mt-1 text-[13px] text-muted">Placed by the generator where they fit.</p>
            </div>
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap gap-2">
                {(Object.keys(REQUIREMENTS) as Requirement[]).map((r) => {
                  const on = brief.requirements.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleReq(r)}
                      className={clsx("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] transition active:scale-[0.98]", on ? "border-moss bg-moss-soft text-moss-2" : "border-line text-ink-2 hover:border-line-strong")}
                    >
                      {on ? <Check size={12} weight="bold" /> : <span className="size-3 rounded-full border border-line-strong" />}
                      {REQUIREMENTS[r]}
                    </button>
                  );
                })}
              </div>
              <Field label="Notes for the design" htmlFor="notes" hint="Kept with the project for your reference.">
                <textarea id="notes" rows={3} className={clsx(inputClass, "h-auto py-2.5")} placeholder="e.g. Elderly parents on the ground floor, east-facing pooja, rooftop garden later." value={brief.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </div>
          </fieldset>

          <fieldset className={section}>
            <legend className="sr-only">Assumptions</legend>
            <div>
              <p className="text-[14px] font-medium">Assumptions</p>
              <p className="mt-1 text-[13px] text-muted">{assumptionsTouched ? "Edited by you." : "Derived from the plot; edit to match local rules."}</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                <Field label="Front setback" htmlFor="sf">
                  <NumberInput id="sf" value={brief.assumptions.setbackFront} onChange={(v) => setA("setbackFront", v)} step={0.5} suffix="ft" />
                </Field>
                <Field label="Rear setback" htmlFor="sr">
                  <NumberInput id="sr" value={brief.assumptions.setbackRear} onChange={(v) => setA("setbackRear", v)} step={0.5} suffix="ft" />
                </Field>
                <Field label="Side setbacks" htmlFor="ss">
                  <NumberInput id="ss" value={brief.assumptions.setbackSide} onChange={(v) => setA("setbackSide", v)} step={0.5} suffix="ft" />
                </Field>
                <Field label="Floor to floor" htmlFor="fh">
                  <NumberInput id="fh" value={brief.assumptions.floorHeight} onChange={(v) => setA("floorHeight", v)} step={0.5} suffix="ft" />
                </Field>
              </div>
              {shown("assumptions") ? (
                <p role="alert" className="text-[12px] text-clay">
                  {errors.assumptions}
                </p>
              ) : null}
            </div>
          </fieldset>
        </div>

        {/* Title block */}
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-[var(--shadow-lift)]">
            <div className="af-grid border-b border-line p-5">{fp ? <PlotDiagram brief={brief} /> : <div className="af-skeleton aspect-square rounded-lg" aria-label="Waiting for valid plot dimensions" />}</div>
            <dl className="divide-y divide-line text-[13px]">
              {[
                ["Project", brief.name.trim() || "Untitled"],
                ["Type", `${HOUSE_TYPES[brief.houseType].label} · ${brief.floors} ${brief.floors > 1 ? "floors" : "floor"}`],
                ["Programme", `${brief.bedrooms} bed · ${brief.bathrooms} bath`],
                ["Plot", Number.isFinite(brief.plotWidth * brief.plotDepth) ? `${brief.plotWidth} × ${brief.plotDepth} ft · ${sqft(brief.plotWidth * brief.plotDepth)}` : "—"],
                ["Footprint", fp ? `${fp.w} × ${fp.d} ft · ${sqft(fp.w * fp.d)}` : "—"],
                ["Coverage", fp ? `${Math.round(((fp.w * fp.d) / (brief.plotWidth * brief.plotDepth)) * 100)}% of plot` : "—"],
                ["Budget / sq ft", brief.builtUp > 0 && brief.budget > 0 ? money(brief.budget / brief.builtUp, brief.currency) : "—"],
              ].map(([k, v]) => (
                <div key={k} className="grid grid-cols-[110px_1fr] gap-3 px-5 py-2.5">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">{k}</dt>
                  <dd className="tnum truncate text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            {errors.fit ? <p className="border-t border-line bg-clay-soft/50 px-5 py-3 text-[12px] leading-relaxed text-ink-2">{errors.fit}</p> : null}
            {storageError ? (
              <p role="alert" className="border-t border-line px-5 py-3 text-[12px] text-clay">
                This browser blocked local storage, so the project can&apos;t be saved. Allow site data and try again.
              </p>
            ) : null}
            <div className="border-t border-line p-4">
              <Button type="submit" variant="primary" size="lg" className="w-full" disabled={saving}>
                {saving ? "Saving brief…" : "Generate design directions"}
                <ArrowRight size={16} weight="bold" />
              </Button>
              {submitted && blocking.length ? <p className="mt-2 text-center text-[12px] text-clay">Fix the highlighted fields to continue.</p> : null}
            </div>
          </div>
        </aside>
      </form>
    </div>
  );
}
