import { ArrowRight } from "@phosphor-icons/react/dist/ssr";
import { HeroFigure, SampleButton, SamplePlan } from "@/components/landing/HeroFigure";
import { ButtonLink, Eyebrow, Logo, SiteHeader } from "@/components/ui/kit";
import type { Metadata } from "next";
import { EXTERIOR_TEMPLATES, INTERIOR_TEMPLATES } from "@/lib/catalog";
import { FAQ, SITE, TESTIMONIALS, structuredData } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: SITE.title },
  description: SITE.description,
  alternates: { canonical: "/about" },
};

const STEPS = [
  { verb: "Configure", note: "Plot, area, rooms, budget" },
  { verb: "Generate", note: "Three zoning directions" },
  { verb: "Customise", note: "Finishes, rooms, furniture" },
  { verb: "Visualise", note: "Plan, light, 3D" },
  { verb: "Share", note: "One read-only link" },
  { verb: "Explore", note: "Buyer walks the rooms" },
];

export default function Landing() {
  return (
    <div className="min-h-[100dvh]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()) }} />
      <SiteHeader right={<ButtonLink href="/new" variant="primary" size="sm" className="ml-2">New project</ButtonLink>} />

      {/* Hero: copy left, the live site model right. */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-4 pb-16 pt-10 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16 lg:pt-16">
        <div className="af-enter flex max-w-[560px] flex-col gap-7">
          <Eyebrow>Concept studio for residential architects</Eyebrow>
          <h1 className="font-display text-[44px] leading-[0.98] tracking-[-0.02em] text-ink md:text-[64px]">
            From a plot and a brief to a house your buyer can <em className="text-moss">walk through.</em>
          </h1>
          <p className="max-w-[52ch] text-[16px] leading-relaxed text-ink-2">
            Enter the plot, the area and the rooms. ARCHFORM lays out three zoning directions, lets you set every finish against a live 2D plan and 3D model, then hands your client a link they can explore room by room.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/new" variant="primary" size="lg">
              Start a project
              <ArrowRight size={16} weight="bold" />
            </ButtonLink>
            <SampleButton />
          </div>
          <dl className="grid max-w-[520px] grid-cols-3 border-t border-line pt-5">
            {[
              ["SVG", "Editable plan"],
              ["WebGL", "Light & finishes"],
              ["3D", "Buyer walkthrough"],
            ].map(([k, v]) => (
              <div key={k} className="flex flex-col gap-1 border-l border-line pl-4 first:border-l-0 first:pl-0">
                <dt className="font-mono text-[12px] text-ink">{k}</dt>
                <dd className="text-[13px] text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="af-enter [animation-delay:120ms]">
          <HeroFigure />
        </div>
      </section>

      {/* The workflow as a drawing title block. */}
      <section className="border-y border-line bg-card/60">
        <ol className="mx-auto grid max-w-[1400px] grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {STEPS.map((s, i) => (
            <li key={s.verb} className="flex flex-col gap-2 border-line px-4 py-6 md:px-8 [&:not(:first-child)]:border-l max-lg:[&:nth-child(n+3)]:border-t max-md:[&:nth-child(odd)]:border-l-0">
              <span className="tnum font-mono text-[11px] text-faint">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[15px] font-medium text-ink">{s.verb}</span>
              <span className="text-[13px] text-muted">{s.note}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* Zig-zag: plan */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 items-center gap-10 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] lg:gap-20">
        <div className="order-2 max-w-[440px] lg:order-1 lg:justify-self-end">
          <SamplePlan />
        </div>
        <div className="order-1 flex max-w-[520px] flex-col gap-5 lg:order-2">
          <Eyebrow>01 — The plan</Eyebrow>
          <h2 className="text-[30px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[38px]">A real plan, not a picture of one.</h2>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Walls are cut at their actual openings, doors swing, stairs stack between floors and every room carries its dimensions and area. Click a room here; in the studio you can also drag furniture, rename spaces and set per-room finishes.
          </p>
          <ul className="flex flex-col divide-y divide-line border-y border-line text-[14px]">
            {["Three zoning directions per brief", "Stair core aligned on every level", "Same rooms drive the plan and the 3D model"].map((t) => (
              <li key={t} className="flex items-center justify-between py-3 text-ink-2">
                {t}
                <span className="size-1.5 rounded-full bg-moss" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Zig-zag: finishes */}
      <section className="border-t border-line bg-sand/60">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-20">
          <div className="flex max-w-[460px] flex-col gap-5">
            <Eyebrow>02 — Finishes</Eyebrow>
            <h2 className="text-[30px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[38px]">Curated schemes, then every surface by hand.</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">
              Start from an exterior and an interior scheme, then change walls, roof, floors, cabinets and upholstery individually. Set the time of day to check how the facade reads at golden hour, or switch the interior lights on.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2">
            {[
              { title: "Exterior", items: EXTERIOR_TEMPLATES.slice(0, 4) },
              { title: "Interior", items: INTERIOR_TEMPLATES },
            ].map((group) => (
              <div key={group.title} className="flex flex-col">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{group.title}</p>
                <ul className="divide-y divide-line border-y border-line">
                  {group.items.map((t) => (
                    <li key={t.id} className="flex items-center gap-4 py-3">
                      <span className="flex -space-x-1.5">
                        {Object.values(t.set)
                          .slice(0, 4)
                          .map((m, i) => (
                            <span key={i} className="size-6 rounded-full border-2 border-sand" style={{ background: m!.color }} />
                          ))}
                      </span>
                      <span className="flex flex-col">
                        <span className="text-[14px] text-ink">{t.label}</span>
                        <span className="text-[12px] text-muted">{t.blurb}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonial: an architect's own words, quoted verbatim. */}
      <section aria-labelledby="voice-title" className="border-t border-line">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
          <div className="flex max-w-[420px] flex-col gap-4">
            <Eyebrow>From the field</Eyebrow>
            <h2 id="voice-title" className="text-[30px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[38px]">
              What architects said after trying it.
            </h2>
            <p className="text-[15px] leading-relaxed text-ink-2">From their written notes after first sessions with the studio.</p>
          </div>
          <div className="flex flex-col gap-14">
            {TESTIMONIALS.map((t, i) => (
              <figure key={t.name} className={i ? "flex flex-col gap-6 border-t border-line pt-10" : "flex flex-col gap-10"}>
                <blockquote className={i ? "font-display text-[26px] leading-[1.2] tracking-[-0.01em] text-ink md:text-[32px]" : "font-display text-[30px] leading-[1.18] tracking-[-0.01em] text-ink md:text-[40px]"}>
                  <span aria-hidden className="mr-1 text-moss">“</span>
                  {t.lead}
                  <span aria-hidden className="text-moss">”</span>
                </blockquote>
                {t.more.length ? (
                  <div className="grid grid-cols-1 gap-6 border-t border-line pt-6 md:grid-cols-2">
                    {t.more.map((q) => (
                      <blockquote key={q} className="text-[15px] leading-relaxed text-ink-2">
                        “{q}”
                      </blockquote>
                    ))}
                  </div>
                ) : null}
                <figcaption className="flex items-center gap-4">
                  <span aria-hidden className="flex size-11 items-center justify-center rounded-full bg-moss-soft font-mono text-[12px] tracking-[0.08em] text-moss-2">
                    {t.initials}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[15px] font-medium text-ink">{t.name}</span>
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{t.role} · Early feedback, October 2026</span>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* Questions people ask — written as plain answers for search and answer engines. */}
      <section id="faq" aria-labelledby="faq-title" className="border-t border-line bg-card/50">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1.3fr)] lg:gap-20">
          <div className="flex max-w-[420px] flex-col gap-4">
            <Eyebrow>Questions</Eyebrow>
            <h2 id="faq-title" className="text-[30px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[38px]">What architects ask first.</h2>
            <p className="text-[15px] leading-relaxed text-ink-2">Short answers about how ARCHFORM works, what it produces and where your data lives.</p>
          </div>
          <dl className="divide-y divide-line border-y border-line">
            {FAQ.map(({ q, a }) => (
              <div key={q} className="grid grid-cols-1 gap-2 py-5 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)] md:gap-8">
                <dt className="text-[15px] font-medium text-ink">{q}</dt>
                <dd className="text-[14px] leading-relaxed text-ink-2">{a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Buyer link + honesty */}
      <section className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-20 md:px-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-20">
        <div className="flex max-w-[560px] flex-col gap-5">
          <Eyebrow>03 — For the buyer</Eyebrow>
          <h2 className="text-[30px] font-medium leading-[1.1] tracking-[-0.02em] md:text-[38px]">Send a link, not a PDF.</h2>
          <p className="text-[15px] leading-relaxed text-ink-2">
            Publish a read-only viewer with a project cover, your attribution, a guided walkthrough of every room, floor-by-floor isolation and the finishes you chose. The link carries the whole project, so it opens on any device without an account.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/new" variant="primary" size="lg">
              Start a project
            </ButtonLink>
            <ButtonLink href="/projects" size="lg">
              Your projects
            </ButtonLink>
          </div>
        </div>
        <aside className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-6 shadow-[var(--shadow-lift)] md:p-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-clay">Read before you build</p>
          <p className="text-[18px] leading-snug text-ink">Concepts, not construction drawings.</p>
          <ul className="flex flex-col gap-3 text-[14px] leading-relaxed text-ink-2">
            <li>Layouts come from a deterministic template generator, not an AI service. The same brief always gives the same plan.</li>
            <li>Setbacks, spans and room sizes are planning assumptions. Structure, services and local bye-laws need an architect&apos;s and engineer&apos;s validation.</li>
            <li>Projects are saved in this browser. Shared links hold a copy of the design in the URL itself; nothing is uploaded.</li>
          </ul>
        </aside>
      </section>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-muted md:px-8">
          <Logo className="text-ink" />
          <span className="font-mono text-[11px] tracking-[0.08em]">Concept tool · Not for construction</span>
        </div>
      </footer>
    </div>
  );
}
