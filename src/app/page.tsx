import type { Metadata } from "next";
import Link from "next/link";
import { EntryRedirect } from "@/components/EntryRedirect";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  // The entry only routes people; crawlers are pointed at the public page.
  alternates: { canonical: "/about" },
};

/** Entry point: sign in first, then go to the home for your role. */
export default function Entry() {
  return (
    <>
      <EntryRedirect />
      <noscript>
        <main style={{ padding: 32, fontFamily: "sans-serif" }}>
          <h1>{SITE.name}</h1>
          <p>{SITE.description}</p>
          <p>
            <Link href="/about">About ARCHFORM</Link> · <Link href="/login">Sign in</Link>
          </p>
        </main>
      </noscript>
    </>
  );
}
