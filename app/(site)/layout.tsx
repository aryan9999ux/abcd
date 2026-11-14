import type { ReactNode } from "react";
import Header from "@/components/site/Header";

/** Marketing, auth and checkout pages share the site header. The trading workspace has its own. */
export default function SiteLayout({ children }: { children: ReactNode }) {
  return (<><Header />{children}</>);
}
