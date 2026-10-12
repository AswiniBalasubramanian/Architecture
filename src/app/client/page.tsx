"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, HouseLine } from "@phosphor-icons/react";
import { RequireRole } from "@/components/AuthGate";
import { Button, Eyebrow, Field, SiteHeader, inputClass } from "@/components/ui/kit";
import { decodeShare } from "@/lib/persist";
import { relative } from "@/lib/projects";
import { listViewed, useSession, type Viewed } from "@/lib/session";

function ClientHome() {
  const router = useRouter();
  const session = useSession();
  const [viewed, setViewed] = React.useState<Viewed[] | null>(null);
  const [link, setLink] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => setViewed(listViewed()), []);

  const open = (e: React.FormEvent) => {
    e.preventDefault();
    const v = link.trim();
    const hash = v.includes("#") ? v.slice(v.indexOf("#")) : `#${v}`;
    if (!v || !decodeShare(hash)) {
      setError("That link doesn't contain a project. Paste the full link your architect sent.");
      return;
    }
    router.push(`/view${hash}`);
  };

  return (
    <div className="min-h-[100dvh]">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] grid-cols-1 gap-12 px-4 py-10 md:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="af-enter flex max-w-[520px] flex-col gap-6">
          <Eyebrow>Client</Eyebrow>
          <h1 className="text-[32px] font-medium leading-[1.08] tracking-[-0.025em] md:text-[40px]">Welcome{session?.name ? `, ${session.name.split(" ")[0]}` : ""}.</h1>
          <p className="text-[15px] leading-relaxed text-ink-2">Open the house your architect shared with you. You can walk through every room, isolate floors and check the finishes. Nothing here can change the design.</p>
          <form onSubmit={open} noValidate className="flex flex-col gap-3">
            <Field label="Project link" htmlFor="link" error={error} hint="It starts with the site address and ends in a long code after #.">
              <input id="link" className={`${inputClass} font-mono text-[12px]`} placeholder="https://…/view#…" value={link} aria-invalid={Boolean(error) || undefined} onChange={(e) => (setLink(e.target.value), setError(null))} />
            </Field>
            <Button type="submit" variant="primary" size="lg" className="self-start">
              Open project <ArrowRight size={16} weight="bold" />
            </Button>
          </form>
        </div>
        <section aria-label="Recently opened" className="flex flex-col gap-4">
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Recently opened</p>
          {viewed === null ? (
            <div className="af-skeleton h-24 rounded-2xl" />
          ) : viewed.length === 0 ? (
            <div className="af-grid flex flex-col items-start gap-3 rounded-2xl border border-dashed border-line-strong p-8">
              <HouseLine size={22} className="text-muted" />
              <p className="text-[15px] text-ink">No projects opened yet.</p>
              <p className="max-w-[46ch] text-[13px] leading-relaxed text-muted">Projects you open from a link appear here, so you can come back to them in this browser.</p>
            </div>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {viewed.map((v) => (
                <li key={v.url}>
                  <Link href={v.url} className="group flex items-center justify-between gap-4 py-4 transition">
                    <span className="flex flex-col">
                      <span className="text-[15px] text-ink">{v.name}</span>
                      <span className="text-[12px] text-muted">
                        by {v.architect} · {relative(v.at)}
                      </span>
                    </span>
                    <ArrowRight size={16} className="text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default function ClientPage() {
  return (
    <RequireRole allow={["client"]}>
      <ClientHome />
    </RequireRole>
  );
}
