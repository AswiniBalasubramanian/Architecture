import type { Metadata } from "next";
import { RequireRole } from "@/components/AuthGate";

// Private workspaces and shared design links stay out of search and AI indexes.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ArchitectLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={["architect"]}>{children}</RequireRole>;
}
