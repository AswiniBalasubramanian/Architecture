"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ArrowRight, Check, CompassTool, HouseLine } from "@phosphor-icons/react";
import { HeroFigure } from "@/components/landing/HeroFigure";
import { Button, Eyebrow, Field, Logo, inputClass } from "@/components/ui/kit";
import { decodeShare } from "@/lib/persist";
import { DEFAULT_ARCHITECT } from "@/lib/projects";
import { getSession, homeFor, setSession, type Role } from "@/lib/session";

const ROLES: Record<Role, { title: string; blurb: string; icon: typeof CompassTool; points: string[] }> = {
  architect: {
    title: "Architect",
    blurb: "Create projects, generate concepts, set finishes and share buyer previews.",
    icon: CompassTool,
    points: ["Project setup and three design directions", "Plan, 3D and finishes studio", "Shareable buyer links"],
  },
  client: {
    title: "Client",
    blurb: "Open a house your architect shared and walk through it room by room.",
    icon: HouseLine,
    points: ["Read-only 3D explorer", "Guided walkthrough", "Rooms, sizes and finishes"],
  },
};

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = React.useState<Role>("architect");
  const [name, setName] = React.useState("");
  const [studio, setStudio] = React.useState(DEFAULT_ARCHITECT);
  const [link, setLink] = React.useState("");
  const [next, setNext] = React.useState<string | null>(null);
  const [touched, setTouched] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const r = params.get("role");
    if (r === "client" || r === "architect") setRole(r);
    const n = params.get("next");
    if (n && n.startsWith("/")) setNext(n);
    const existing = getSession();
    if (existing) {
      setName(existing.name);
      if (existing.studio) setStudio(existing.studio);
      if (!r) setRole(existing.role);
    }
  }, []);

  const nameError = touched && !name.trim() ? "Enter your name." : null;
  const linkValue = link.trim();
  const linkHash = linkValue.includes("#") ? linkValue.slice(linkValue.indexOf("#")) : linkValue;
  const linkError = touched && role === "client" && linkValue && !decodeShare(linkHash) ? "That link doesn't contain a project. Paste the full link your architect sent." : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || linkError || (role === "client" && linkValue && !decodeShare(linkHash))) return;
    setBusy(true);
    setSession({ role, name: name.trim(), studio: role === "architect" ? studio.trim() || DEFAULT_ARCHITECT : undefined, at: Date.now() });
    // A `next` page meant for the other role would only bounce; send each role home instead.
    const nextOk = next && (role === "architect" ? !next.startsWith("/client") : next.startsWith("/view") || next.startsWith("/client"));
    if (role === "client" && linkValue) router.push(`/view${linkHash.startsWith("#") ? linkHash : `#${linkHash}`}`);
    else router.push(nextOk ? next! : homeFor(role));
  };

  return (
    <div className="grid min-h-[100dvh] grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      {/* Brand side */}
      <aside className="af-grid relative hidden flex-col justify-between gap-8 border-r border-line p-10 lg:flex">
        <Logo className="text-ink" />
        <div className="af-enter mx-auto w-full max-w-[640px]">
          <HeroFigure />
        </div>
        <div className="flex items-end justify-between gap-6">
          <p className="max-w-[40ch] font-display text-[26px] leading-[1.1] text-ink">A plot and a brief, built into a house your buyer can walk through.</p>
          <Link href="/about" className="shrink-0 font-mono text-[11px] uppercase tracking-[0.12em] text-muted underline-offset-4 hover:text-ink hover:underline">
            About ARCHFORM
          </Link>
        </div>
      </aside>

      {/* Sign-in */}
      <main className="flex flex-col justify-center px-5 py-10 md:px-14">
        <div className="mx-auto flex w-full max-w-[460px] flex-col gap-8">
          <div className="lg:hidden">
            <Logo />
          </div>
          <div className="af-enter flex flex-col gap-2">
            <Eyebrow>Sign in</Eyebrow>
            <h1 className="text-[30px] font-medium leading-[1.08] tracking-[-0.025em] md:text-[34px]">How are you using ARCHFORM?</h1>
          </div>

          <form onSubmit={submit} noValidate className="flex flex-col gap-6">
            <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {(Object.keys(ROLES) as Role[]).map((r) => {
                const on = role === r;
                const Icon = ROLES[r].icon;
                return (
                  <button
                    key={r}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    aria-label={`${ROLES[r].title}: ${ROLES[r].blurb}`}
                    onClick={() => setRole(r)}
                    className={clsx("relative flex flex-col gap-3 rounded-2xl border p-4 text-left transition duration-200 active:scale-[0.99]", on ? "border-ink bg-card shadow-[var(--shadow-lift)]" : "border-line hover:border-line-strong hover:bg-card/60")}
                  >
                    <span className="flex items-center justify-between">
                      <span className={clsx("flex size-9 items-center justify-center rounded-xl transition", on ? "bg-ink text-paper" : "bg-stone text-ink-2")}>
                        <Icon size={18} />
                      </span>
                      <span className={clsx("flex size-4 items-center justify-center rounded-full border transition", on ? "border-ink bg-ink text-paper" : "border-line-strong")}>{on ? <Check size={10} weight="bold" /> : null}</span>
                    </span>
                    <span className="text-[15px] font-medium">{ROLES[r].title}</span>
                    <span className="text-[12px] leading-snug text-muted">{ROLES[r].blurb}</span>
                  </button>
                );
              })}
            </div>

            <ul className="flex flex-col gap-1.5 border-y border-line py-3">
              {ROLES[role].points.map((p) => (
                <li key={p} className="flex items-center gap-2 text-[13px] text-ink-2">
                  <span className="size-1.5 rounded-full bg-moss" />
                  {p}
                </li>
              ))}
            </ul>

            <Field label="Your name" htmlFor="name" error={nameError}>
              <input id="name" autoComplete="name" className={inputClass} placeholder={role === "architect" ? "e.g. Aswini Balasubramanian" : "e.g. Meera Iyer"} value={name} aria-invalid={Boolean(nameError) || undefined} onChange={(e) => setName(e.target.value)} />
            </Field>
            {role === "architect" ? (
              <Field label="Studio" htmlFor="studio" hint="Shown as the attribution on buyer previews.">
                <input id="studio" autoComplete="organization" className={inputClass} value={studio} onChange={(e) => setStudio(e.target.value)} />
              </Field>
            ) : (
              <Field label="Project link (optional)" htmlFor="link" error={linkError} hint="Paste the link your architect shared to open it straight away.">
                <input id="link" className={clsx(inputClass, "font-mono text-[12px]")} placeholder="https://…/view#…" value={link} aria-invalid={Boolean(linkError) || undefined} onChange={(e) => setLink(e.target.value)} />
              </Field>
            )}

            <Button type="submit" variant="primary" size="lg" disabled={busy}>
              {busy ? "Signing in…" : `Continue as ${ROLES[role].title.toLowerCase()}`}
              <ArrowRight size={16} weight="bold" />
            </Button>
            <p className="text-[12px] leading-relaxed text-muted">
              Demo sign-in: no password, and nothing leaves this browser. It remembers your role and name only. Real accounts need an auth service (such as Supabase), which isn&apos;t connected yet.
            </p>
          </form>
        </div>
      </main>
    </div>
  );
}
