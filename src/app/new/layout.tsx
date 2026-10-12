import { RequireRole } from "@/components/AuthGate";

export default function ArchitectLayout({ children }: { children: React.ReactNode }) {
  return <RequireRole allow={["architect"]}>{children}</RequireRole>;
}
