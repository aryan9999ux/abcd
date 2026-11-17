"use client";
import { useState } from "react";

export function KycActions({ userId }: { userId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go(verified: boolean) {
    const note = verified ? undefined : window.prompt("Reason (shown to the trader)") ?? "";
    if (!verified && !note) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, verified, note }) });
    const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
    if (j.ok) location.reload(); else { setMsg(j.error || "Failed"); setBusy(false); }
  }
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn primary" disabled={busy} onClick={() => go(true)}>Verify</button>
      <button className="btn" disabled={busy} onClick={() => go(false)}>Reject</button>
      {msg && <span className="muted" style={{ fontSize: ".85rem" }}>{msg}</span>}
    </div>
  );
}
