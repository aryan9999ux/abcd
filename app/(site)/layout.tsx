import type { ReactNode } from "react";
import Header from "@/components/site/Header";
import Chat from "@/components/chat/Chat";

/** Marketing, auth and checkout pages share the site header. The trading workspace has its own. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (<><Header />{children}<Chat endpoint="/api/ai/sales" title="Riya from the team" hint="Usually replies in seconds" greeting="Hi! How can I help you?" /></>);
}
