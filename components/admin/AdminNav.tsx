"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS: [string, string][] = [["/admin/zerodha", "Zerodha"], ["/admin/rewards", "Rewards"], ["/admin/simulator", "Simulator and rules"]];

export default function AdminNav() {
  const path = usePathname();
  return (
    <div className="admintabs wrap">
      <nav aria-label="Admin">
        {TABS.map(([href, label]) => (<Link key={href} href={href} aria-current={path.startsWith(href) ? "page" : undefined}>{label}</Link>))}
      </nav>
    </div>
  );
}
