"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import { Icon } from "./ui";
import { Bell } from "./PortalBar";
import { usePortal } from "./PortalProvider";
import "./portal.css";

const NAV: [string, string, string][] = [
  ["/dashboard", "Overview", "overview"],
  ["/accounts", "Accounts", "accounts"],
  ["/reports", "Reports", "reports"],
  ["/funds", "Funds", "funds"],
  ["/strategies", "Strategies", "strategy"],
  ["/payouts", "Payouts", "payouts"],
  ["/payments", "Payments", "receipt"],
  ["/verification", "Verification", "verify"],
  ["/help", "Help", "help"],
];

const MORE: [string, string, string][] = [
  ["/funds", "Funds", "funds"],
  ["/strategies", "Strategies", "strategy"],
  ["/payouts", "Payouts", "payouts"],
  ["/payments", "Payments", "receipt"],
  ["/verification", "Verification", "verify"],
  ["/help", "Help", "help"],
];

export default function PortalShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { user, kycVerified, kyc } = usePortal();
  const [menu, setMenu] = useState(false);
  const [more, setMore] = useState(false);

  useEffect(() => {
    try { const t = localStorage.getItem("theme"); if (t === "dark" || t === "light") document.documentElement.dataset.theme = t; } catch { /* storage blocked */ }
  }, []);
  useEffect(() => { setMenu(false); setMore(false); }, [path]);

  const needsKyc = !kycVerified;
  const moreOn = more || MORE.some(([h]) => path.startsWith(h));
  const active = (href: string) => path === href || (href !== "/dashboard" && path.startsWith(href));
  const initial = (user.name || "A").trim().slice(0, 1).toUpperCase();

  function toggleTheme() {
    const r = document.documentElement;
    const next = (r.dataset.theme || "dark") === "dark" ? "light" : "dark";
    r.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* storage blocked */ }
  }
  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="pt">
      <aside className="pt-side">
        <Link className="pt-brand" href="/"><LogoMark size={30} id="ps" /><b><Wordmark /></b></Link>
        <nav aria-label="Portal">
          {NAV.map(([href, label, ic]) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}>
              <Icon n={ic} /><span>{label}</span>
              {href === "/verification" && needsKyc && <i className="pt-dot" title={kyc?.status === "pending" ? "Under review" : "Action needed"} />}
            </Link>
          ))}
          <Link href="/checkout"><Icon n="plus" /><span>Buy account</span></Link>
        </nav>
        <div className="pt-side-foot">
          <Link className="pt-go" href="/terminal"><Icon n="terminal" /> Open terminal</Link>
          <div className="pt-me">
            <span className="pt-av">{initial}</span>
            <span className="pt-who"><b>{user.name}</b><small>{user.email}</small></span>
            <Bell className="bell-side" />
          </div>
          <div className="pt-mini">
            <button onClick={toggleTheme}><Icon n="sun" size={16} /> Theme</button>
            <button onClick={signOut}><Icon n="out" size={16} /> Sign out</button>
          </div>
        </div>
      </aside>

      <div className="pt-col">
        <header className="pt-top">
          <Link className="pt-brand" href="/"><LogoMark size={30} id="pt" /><b><Wordmark /></b></Link>
          <span className="pt-sp" />
          <Bell className="bell-m" />
          <Link className="pt-helpbtn" href="/help" aria-label="Help"><Icon n="help" size={18} /></Link>
          <Link className="pt-buy" href="/checkout"><Icon n="plus" size={16} /> Buy account</Link>
          <button className="pt-av btn" onClick={() => setMenu((m) => !m)} aria-label="Account menu" aria-expanded={menu}>{initial}</button>
          {menu && (
            <div className="pt-pop" role="menu">
              <div className="pt-popwho"><b>{user.name}</b><small>{user.email}</small></div>
              <Link className="pt-poplink" href="/help"><Icon n="help" size={16} /> Help</Link>
              <Link className="pt-poplink" href="/payments"><Icon n="receipt" size={16} /> Payments</Link>
              <button onClick={toggleTheme}><Icon n="sun" size={16} /> Switch theme</button>
              <button onClick={signOut}><Icon n="out" size={16} /> Sign out</button>
            </div>
          )}
        </header>
        <main className="pt-page">{children}</main>
      </div>

      {more && <button className="pt-scrim" aria-label="Close menu" onClick={() => setMore(false)} />}
      {more && (
        <div className="pt-more" role="menu">
          {MORE.map(([href, label, ic]) => (
            <Link key={href} href={href} aria-current={active(href) ? "page" : undefined}><span className="pt-mi"><Icon n={ic} size={20} /></span><b>{label}</b>{href === "/verification" && needsKyc && <i className="pt-dot" />}</Link>
          ))}
        </div>
      )}
      <nav className="pt-tabs" aria-label="Portal">
        <Link href="/dashboard" aria-current={active("/dashboard") ? "page" : undefined}><Icon n="overview" /><span>Overview</span></Link>
        <Link href="/accounts" aria-current={active("/accounts") ? "page" : undefined}><Icon n="accounts" /><span>Accounts</span></Link>
        <Link className="mid" href="/terminal"><span className="pt-fab"><Icon n="terminal" size={24} /></span><span>Terminal</span></Link>
        <Link href="/reports" aria-current={active("/reports") ? "page" : undefined}><Icon n="reports" /><span>Reports</span></Link>
        <button type="button" className={moreOn ? "on" : ""} aria-expanded={more} onClick={() => setMore((m) => !m)}><Icon n="more" /><span>More</span>{needsKyc && <i className="pt-dot" />}</button>
      </nav>
    </div>
  );
}
