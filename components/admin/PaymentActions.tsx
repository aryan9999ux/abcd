"use client";
import { useState } from "react";

export function PaymentActions({ paymentId }: { paymentId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  async function go(action: "approve" | "reject") {
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paymentId, action, reason }) });
    const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
    if (j.ok) location.reload(); else { setMsg(j.error || "Failed"); setBusy(false); }
  }
  return (
    <div style={{ display: "grid", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn primary" disabled={busy} onClick={() => go("approve")}>Approve and open account</button>
        <button className="btn" disabled={busy} onClick={() => setRejecting((r) => !r)}>Reject</button>
        {msg && <span className="muted" style={{ fontSize: ".85rem" }}>{msg}</span>}
      </div>
      {rejecting && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason the trader will see, e.g. Amount did not match" style={{ flex: "1 1 260px", padding: 10, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--fg)" }} />
          <button className="btn" disabled={busy || !reason.trim()} onClick={() => go("reject")}>Confirm reject</button>
        </div>
      )}
    </div>
  );
}
