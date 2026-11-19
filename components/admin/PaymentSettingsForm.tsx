"use client";
import { Spin } from "@/components/ui/Spin";
import { useState } from "react";

export function PaymentSettingsForm({ upiId, payee, qrUrl }: { upiId: string; payee: string; qrUrl: string | null }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/payment-settings", { method: "POST", body: new FormData(e.currentTarget) });
    const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
    if (j.ok) location.reload(); else { setMsg(j.error || "Failed"); setBusy(false); }
  }
  const inp = { padding: 10, borderRadius: 10, border: "1px solid var(--line)", background: "var(--bg2)", color: "var(--fg)", width: "100%" } as const;
  return (
    <form onSubmit={save} className="glass" style={{ padding: 20, display: "grid", gap: 12, maxWidth: 560 }}>
      <b>Where traders pay</b>
      {qrUrl && <img src={qrUrl} alt="Current QR" width={140} height={140} style={{ background: "#fff", borderRadius: 12, padding: 8 }} />}
      <label style={{ display: "grid", gap: 6 }}>UPI ID<input name="upiId" defaultValue={upiId} placeholder="name@bank" style={inp} /></label>
      <label style={{ display: "grid", gap: 6 }}>Name on the account<input name="payeeName" defaultValue={payee} style={inp} /></label>
      <label style={{ display: "grid", gap: 6 }}>QR image (replaces the current one)<input name="qr" type="file" accept="image/*" style={inp} /></label>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}><button className="btn primary" disabled={busy}>{busy ? <><Spin />Saving…</> : "Save"}</button>{msg && <span className="muted">{msg}</span>}</div>
    </form>
  );
}
