"use client";
import { useState } from "react";

export function TerminateButton({ accountId }: { accountId: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  async function go() {
    const reason = window.prompt("Why is this account being closed? The trader will see this.");
    if (!reason?.trim()) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/admin/terminate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accountId, reason }) });
    const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
    if (j.ok) location.reload(); else { setMsg(j.error || "Failed"); setBusy(false); }
  }
  return <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}><button className="btn" disabled={busy} onClick={go}>Close account</button>{msg && <span className="muted">{msg}</span>}</span>;
}
