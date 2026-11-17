import type { ReactNode } from "react";
import PortalShell from "@/components/portal/PortalShell";
import { PortalProvider } from "@/components/portal/PortalProvider";
import { loadPortal } from "@/components/portal/load";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const initial = await loadPortal("/dashboard");
  return (
    <PortalProvider initial={initial}>
      <PortalShell>{children}</PortalShell>
    </PortalProvider>
  );
}
