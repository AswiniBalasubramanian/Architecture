import type { Metadata } from "next";
import { RequireRole } from "@/components/AuthGate";

// Private workspaces and shared design links stay out of search and AI indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Buyer links open for clients and for the architect previewing them. */
export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["client", "architect"]} hint="client">
      {children}
    </RequireRole>
  );
}
