"use client";
import "./trading.css";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { browserClient } from "@/lib/supabase/browser";

interface Props {
  active: "dashboard" | "terminal";
  accountId?: string | null;
  slot?: ReactNode;
  children: ReactNode;
}

/** Frame for the signed-in workspace: glass top bar, navigation, theme toggle, sign out. */
export default function Shell({ active, accountId, slot, children }: Props) {
  const router = useRouter();

  function toggleTheme() {
    const r = document.documentElement;
    const cur = r.dataset.theme || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
    const next = cur === "dark" ? "light" : "dark";
    r.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* storage can be blocked; the choice then lasts for this page view only */
    }
  }

  async function signOut() {
    await browserClient().auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="tr">
      <div className="tr-orbs" aria-hidden="true">
        <div className="tr-orb a" />
        <div className="tr-orb b" />
      </div>
      <div style={{ paddingInline: "max(16px, env(safe-area-inset-left, 0px))" }}>
        <header className="tr-head">
          <div className="tr-main" style={{ paddingBlock: 0 }}>
            <div className="tr-top tr-glass">
              <Link className="tr-brand" href="/">
                <svg viewBox="0 0 32 32" aria-hidden="true">
                  <path d="M16 2 28 9v14L16 30 4 23V9z" fill="none" stroke="var(--accent)" strokeWidth="2" />
                  <path d="M9 20 14 13l4 4 5-8" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Apex Capital Funded
              </Link>
              <nav className="tr-nav" aria-label="Workspace">
                <Link href="/dashboard" aria-current={active === "dashboard" ? "page" : undefined}>Dashboard</Link>
                <Link href={accountId ? `/terminal?account=${accountId}` : "/terminal"} aria-current={active === "terminal" ? "page" : undefined}>Terminal</Link>
                <Link href="/checkout">Buy new account</Link>
              </nav>
              {slot}
              <span className="tr-sp" />
              <button className="tr-iconbtn" onClick={toggleTheme} aria-label="Switch between light and dark theme" title="Theme">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                </svg>
              </button>
              <button className="tr-btn sm" onClick={signOut}>Sign out</button>
            </div>
          </div>
        </header>
        <main className="tr-main tr-view">{children}</main>
      </div>
    </div>
  );
}
