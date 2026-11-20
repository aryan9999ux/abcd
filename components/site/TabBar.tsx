"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const I = {
  home: <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z" />,
  plans: <><rect x="4" y="5" width="16" height="14" rx="3" /><path d="M4 10h16" /></>,
  rules: <><path d="M7 4h8l3 3v13H7z" /><path d="M10 11h5M10 15h5" /></>,
  login: <><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></>,
  dash: <><rect x="4" y="4" width="7" height="7" rx="2" /><rect x="13" y="4" width="7" height="5" rx="2" /><rect x="4" y="13" width="7" height="7" rx="2" /><rect x="13" y="11" width="7" height="9" rx="2" /></>,
  term: <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" />,
  plus: <path d="M12 5v14M5 12h14" />,
  spark: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M17.7 6.3l-2.4 2.4M8.7 15.3l-2.4 2.4" />,
};
type Item = { href: string; label: string; icon: keyof typeof I; match: (p: string) => boolean; cta?: boolean };

/** iOS-style floating tab bar. Shown on phones only. */
export default function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = usePathname() || "/";
  const items: Item[] = signedIn
    ? [
        { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
        { href: "/dashboard", label: "Dashboard", icon: "dash", match: (p) => p.startsWith("/dashboard") },
        { href: "/terminal", label: "Terminal", icon: "term", match: (p) => p.startsWith("/terminal") },
        { href: "/checkout", label: "New", icon: "plus", match: (p) => p.startsWith("/checkout") },
      ]
    : [
        { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
        { href: "/#plans", label: "Plans", icon: "plans", match: () => false },
        { href: "/signup", label: "Start", icon: "spark", match: (p) => p.startsWith("/signup"), cta: true },
        { href: "/rules", label: "Rules", icon: "rules", match: (p) => p.startsWith("/rules") },
        { href: "/login", label: "Log in", icon: "login", match: (p) => p.startsWith("/login") },
      ];
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map((it) => {
        const on = it.match(path);
        return (
          <Link key={it.label} href={it.href} aria-current={on ? "page" : undefined} className={it.cta ? "tb-cta" : undefined}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{I[it.icon]}</svg>
            <span>{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
