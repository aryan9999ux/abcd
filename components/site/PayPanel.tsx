"use client";
import { Spin } from "@/components/ui/Spin";
import Link from "next/link";
import { useState } from "react";
import { inr } from "./format";

export interface PaySettings { upiId: string | null; payee: string | null; qrUrl: string | null }

/** Manual UPI payment: scan the QR, pay, then send the 12-digit UTR. An admin checks the bank and approves. */
export default function PayPanel({ pay, amount, planKey, size, label, onClose }: { pay: PaySettings; amount: number; planKey: string; size: number; label: string; onClose: () => void }) {
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  async function copy(t: string, k: string) {
    try { await navigator.clipboard.writeText(t); setCopied(k); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try {
      const res = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planKey, accountSize: size, utr: utr.trim(), acceptedTerms: true }) });
      const j = await res.json().catch(() => null);
      if (!j?.ok) setErr(j?.error ?? "Could not send your payment. Try again.");
      else setDone(true);
    } catch { setErr("Could not reach the server. Check your connection and try again."); }
    finally { setBusy(false); }
  }

  return (
    <div className="pay-wrap" role="dialog" aria-modal="true" aria-label="Pay by UPI">
      <div className="pay">
        <button className="pay-x" onClick={onClose} aria-label="Close">×</button>
        {done ? (
          <div className="pay-done">
            <span className="pay-tick" aria-hidden="true">✓</span>
            <h2>Payment submitted</h2>
            <p>We got your UTR. Our team checks the payment and opens your account, usually within a few minutes. You can see the status any time under Payments.</p>
            <Link className="btn primary" href="/payments">View my payments</Link>
          </div>
        ) : (
          <>
            <h2>Pay {inr(amount)} by UPI</h2>
            <p className="pay-sub">{label}</p>
            <div className="pay-grid">
              <div className="pay-qrcol">
                <div className="pay-qr">
                  {pay.qrUrl ? <img src={pay.qrUrl} alt="UPI QR code" width={220} height={220} /> : <div className="pay-noqr">QR is not set up yet. Please try again shortly.</div>}
                  {pay.qrUrl && <><i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" /><span className="scan" aria-hidden="true" /></>}
                </div>
                {pay.upiId && (
                  <button type="button" className="pay-upi" onClick={() => copy(pay.upiId!, "upi")}>
                    <span>UPI ID</span><b>{pay.upiId}</b><em>{copied === "upi" ? "Copied" : "Copy"}</em>
                  </button>
                )}
                {pay.payee && <p className="pay-payee">Paying to {pay.payee}</p>}
              </div>
              <form onSubmit={submit} className="pay-form">
                <ol>
                  <li>Open any UPI app and scan the QR.</li>
                  <li>Pay exactly <b>{inr(amount)}</b>.</li>
                  <li>Copy the 12-digit <b>UTR</b> from the payment screen and paste it here.</li>
                </ol>
                <label htmlFor="utr">UTR / reference number</label>
                <input id="utr" inputMode="numeric" autoComplete="off" maxLength={12} value={utr} onChange={(e) => setUtr(e.target.value.replace(/\D/g, ""))} placeholder="12 digits" />
                {err && <p className="cx-err" role="alert">{err}</p>}
                <button className="btn primary" disabled={busy || utr.length !== 12 || !pay.qrUrl}>{busy ? <><Spin />Sending…</> : "I have paid"}</button>
                <small>Your account opens after our team confirms the payment. This usually takes a few minutes.</small>
              </form>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
