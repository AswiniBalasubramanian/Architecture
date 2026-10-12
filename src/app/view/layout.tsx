import { RequireRole } from "@/components/AuthGate";

/** Buyer links open for clients and for the architect previewing them. */
export default function ViewLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireRole allow={["client", "architect"]} hint="client">
      {children}
    </RequireRole>
  );
}
