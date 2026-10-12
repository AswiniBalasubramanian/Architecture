"use client";

// Demo sign-in. There is no auth backend configured, so a "session" is just
// the role and name this browser remembers. Nothing is verified or sent anywhere.

import * as React from "react";

export type Role = "architect" | "client";

export interface Session {
  role: Role;
  name: string;
  studio?: string;
  at: number;
}

const KEY = "archform:session:v1";
const EVENT = "archform:session";

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function setSession(session: Session) {
  window.localStorage.setItem(KEY, JSON.stringify(session));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession() {
  window.localStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export const homeFor = (role: Role) => (role === "architect" ? "/projects" : "/client");

let cached: { raw: string | null; value: Session | null } = { raw: null, value: null };
function snapshot() {
  const raw = typeof window === "undefined" ? null : window.localStorage.getItem(KEY);
  if (raw !== cached.raw) cached = { raw, value: raw ? (JSON.parse(raw) as Session) : null };
  return cached.value;
}

/** The current session; `undefined` until the browser has been read. */
export function useSession(): Session | null | undefined {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => setReady(true), []);
  const value = React.useSyncExternalStore(
    (changed) => {
      window.addEventListener(EVENT, changed);
      window.addEventListener("storage", changed);
      return () => {
        window.removeEventListener(EVENT, changed);
        window.removeEventListener("storage", changed);
      };
    },
    snapshot,
    () => null,
  );
  return ready ? value : undefined;
}

/* Shared projects a client has opened, so they can return to them. */
const VIEWED = "archform:viewed:v1";
export interface Viewed {
  name: string;
  architect: string;
  url: string;
  at: number;
}

export function listViewed(): Viewed[] {
  try {
    return JSON.parse(window.localStorage.getItem(VIEWED) ?? "[]") as Viewed[];
  } catch {
    return [];
  }
}

export function rememberViewed(item: Viewed) {
  try {
    const next = [item, ...listViewed().filter((v) => v.name !== item.name || v.architect !== item.architect)].slice(0, 12);
    window.localStorage.setItem(VIEWED, JSON.stringify(next));
  } catch {
    // Storage full or blocked: the link still works, it just isn't remembered.
  }
}
