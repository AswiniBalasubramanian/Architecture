"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignOut } from "@phosphor-icons/react";
import { clearSession, homeFor, useSession, type Role } from "@/lib/session";
import { buttonClass, Logo } from "./ui/kit";
import { PixelLoader } from "./ui/PixelLoader";

/** Renders children only for a signed-in user with an allowed role; otherwise routes to sign-in. */
export function RequireRole({ allow, hint, children }: { allow: Role[]; hint?: Role; children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (session === null) {
      const next = window.location.pathname + window.location.search + window.location.hash;
      router.replace(`/login?role=${hint ?? allow[0]}&next=${encodeURIComponent(next)}`);
    }
  }, [session, router, allow, hint]);
  if (session === undefined || session === null) {
    return <PixelLoader fullScreen label={session === null ? "Taking you to sign in" : "Opening your studio"} />;
  }
  if (!allow.includes(session.role)) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-start justify-center gap-5 px-6 md:px-[12vw]">
        <Logo />
        <h1 className="max-w-[26ch] text-[30px] font-medium leading-tight tracking-[-0.02em]">This area is for {allow.join(" and ")}s.</h1>
        <p className="max-w-[54ch] text-[15px] leading-relaxed text-ink-2">
          You&apos;re signed in as a {session.role}. {session.role === "client" ? "Clients explore the projects architects share with them." : "Switch role to continue."}
        </p>
        <div className="flex gap-3">
          <Link href={homeFor(session.role)} className={buttonClass("primary", "lg")}>
            Go to my {session.role === "client" ? "projects" : "studio"}
          </Link>
          <button
            type="button"
            className={buttonClass("secondary", "lg")}
            onClick={() => {
              clearSession();
            }}
          >
            Sign in differently
          </button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}

export function RoleNav() {
  const session = useSession();
  if (!session) return null;
  return (
    <Link href={homeFor(session.role)} className="rounded-lg px-3 py-1.5 text-ink-2 transition hover:bg-stone hover:text-ink">
      {session.role === "architect" ? "Projects" : "My projects"}
    </Link>
  );
}

export function UserMenu() {
  const session = useSession();
  const router = useRouter();
  if (!session) {
    return (
      <Link href="/login" className="rounded-lg px-3 py-1.5 text-[14px] text-ink-2 transition hover:bg-stone hover:text-ink">
        Sign in
      </Link>
    );
  }
  const initials = session.name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span className="ml-1 flex items-center gap-2">
      <span className="flex items-center gap-2 rounded-full border border-line bg-card py-1 pl-1 pr-3" title={`${session.name} · ${session.role}`}>
        <span className={`flex size-6 items-center justify-center rounded-full font-mono text-[10px] ${session.role === "architect" ? "bg-ink text-paper" : "bg-moss text-paper"}`}>{initials || "?"}</span>
        <span className="hidden flex-col leading-none sm:flex">
          <span className="max-w-[140px] truncate text-[12px] text-ink">{session.name}</span>
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{session.role}</span>
        </span>
      </span>
      <button
        type="button"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          clearSession();
          router.push("/login");
        }}
        className="flex size-8 items-center justify-center rounded-lg text-muted transition hover:bg-stone hover:text-ink"
      >
        <SignOut size={16} />
      </button>
    </span>
  );
}
