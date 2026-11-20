"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { inr } from "@/components/trading/format";
import { compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { Icon } from "./ui";

interface Note { id: string; tone: "ok" | "warn" | "bad" | "brand"; title: string; body: string; href: string; rank: number }

/** Alerts built from what is already on the trader's account: limits, payouts, identity check, payments. */
export function Bell({ className = "" }: { className?: string }) {
  const { accounts, metrics, rewards, payments, kycVerified, kyc } = usePortal();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>([]);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => { try { setSeen(JSON.parse(localStorage.getItem("seen-notes") || "[]")); } catch { /* storage blocked */ } }, []);
  useEffect(() => {
    if (!open) return;
    const off = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, [open]);

  const notes = useMemo<Note[]>(() => {
    const out: Note[] = [];
    for (const a of accounts) {
      const m = metrics[a.id], name = compact(a.account_size);
      if (a.status === "breached") out.push({ id: `br:${a.id}`, tone: "bad", rank: 0, title: `${name} account breached`, body: a.breach_reason || "A rule was broken, so trading on this account stopped.", href: `/accounts/${a.id}` });
      if (a.status === "passed") out.push({ id: `ps:${a.id}`, tone: "ok", rank: 2, title: `${name} account passed`, body: "You hit the target. Open the account to see what comes next.", href: `/accounts/${a.id}` });
      if (a.status === "active" && m) {
        const d = m.dailyLimitPct > 0 ? (m.dailyUsedPct / m.dailyLimitPct) * 100 : m.dailyUsedPct, o = m.overallLimitPct > 0 ? (m.overallUsedPct / m.overallLimitPct) * 100 : m.overallUsedPct;
        if (d >= 80) out.push({ id: `d:${a.id}:${new Date().toDateString()}`, tone: "bad", rank: 0, title: `Daily loss ${Math.round(d)}% used`, body: `${name} account. Trading stops at the daily limit.`, href: "/funds" });
        else if (d >= 60) out.push({ id: `d6:${a.id}:${new Date().toDateString()}`, tone: "warn", rank: 1, title: `Daily loss ${Math.round(d)}% used`, body: `${name} account. Trade smaller or stop for today.`, href: "/funds" });
        if (o >= 80) out.push({ id: `o:${a.id}`, tone: "bad", rank: 0, title: `Overall loss ${Math.round(o)}% used`, body: `${name} account is close to the overall limit.`, href: "/funds" });
      }
    }
    for (const r of rewards) {
      const t = r.status;
      out.push({ id: `rw:${r.id}:${t}`, tone: t === "paid" ? "ok" : t === "rejected" ? "bad" : t === "approved" ? "ok" : "warn", rank: 2,
        title: t === "paid" ? `Payout of ${inr(r.amount_inr)} paid` : t === "approved" ? `Payout of ${inr(r.amount_inr)} approved` : t === "rejected" ? "Payout request declined" : "Payout request in review",
        body: t === "paid" ? "It was sent to your payout method." : t === "rejected" ? "Open Payouts to see why." : t === "approved" ? "It will be paid shortly." : "We review it within a day.", href: "/payouts" });
    }
    for (const p of payments) {
      if (p.status === "pending") out.push({ id: `pm:${p.id}:p`, tone: "warn", rank: 2, title: "Payment waiting for approval", body: `${compact(p.account_size)} account. We check each payment by hand.`, href: "/payments" });
      if (p.status === "approved") out.push({ id: `pm:${p.id}:a`, tone: "ok", rank: 3, title: "Payment approved", body: `${compact(p.account_size)} account is ready.`, href: `/payments/${p.id}` });
      if (p.status === "rejected") out.push({ id: `pm:${p.id}:r`, tone: "bad", rank: 1, title: "Payment not approved", body: p.reject_reason || "Open Payments to try again.", href: "/payments" });
    }
    if (!kycVerified) out.push({ id: `kyc:${kyc?.status ?? "none"}`, tone: kyc?.status === "rejected" ? "bad" : "warn", rank: 1,
      title: kyc?.status === "pending" ? "Identity check under review" : kyc?.status === "rejected" ? "Identity check needs another try" : "Verify your identity",
      body: kyc?.status === "pending" ? "We will tell you once it is done." : "You need this before your first payout.", href: "/verification" });
    return out.sort((a, b) => a.rank - b.rank);
  }, [accounts, metrics, rewards, payments, kycVerified, kyc]);

  const unseen = notes.filter((n) => !seen.includes(n.id)).length;
  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) {
      const all = [...new Set([...seen, ...notes.map((n) => n.id)])].slice(-200);
      setSeen(all);
      try { localStorage.setItem("seen-notes", JSON.stringify(all)); } catch { /* storage blocked */ }
    }
  }

  return (
    <div className={`bell ${className}`} ref={box}>
      <button className="bell-b" onClick={toggle} aria-label={unseen ? `Notifications, ${unseen} new` : "Notifications"} aria-expanded={open}>
        <Icon n="bell" size={19} />{unseen > 0 && <i>{unseen > 9 ? "9+" : unseen}</i>}
      </button>
      {open && (
        <div className="bell-pop" role="dialog" aria-label="Notifications">
          <div className="bell-h"><b>Notifications</b><button onClick={toggle} aria-label="Close">✕</button></div>
          {notes.length === 0 ? <p className="bell-empty">You are all caught up.</p> : (
            <div className="bell-list">
              {notes.map((n) => (
                <Link key={n.id} href={n.href} className={`bell-n ${n.tone}`} onClick={() => setOpen(false)}>
                  <span className="bell-dot" />
                  <span><b>{n.title}</b><small>{n.body}</small></span>
                  {!seen.includes(n.id) && <em>New</em>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
