"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { homeFor, useSession } from "@/lib/session";

/** Entry point: sign in first, then go to the home for your role. */
export default function Entry() {
  const session = useSession();
  const router = useRouter();
  React.useEffect(() => {
    if (session === undefined) return;
    router.replace(session ? homeFor(session.role) : "/login");
  }, [session, router]);
  return (
    <div className="flex min-h-[100dvh] items-center justify-center" role="status" aria-label="Opening ARCHFORM">
      <div className="af-skeleton h-1 w-32 rounded-full" />
    </div>
  );
}
