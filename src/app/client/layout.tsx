import type { Metadata } from "next";

export const metadata: Metadata = { title: "My projects", robots: { index: false, follow: false } };

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return children;
}
