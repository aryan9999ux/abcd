"use client";
import { useState } from "react";

async function post(url: string, body: unknown) {
  const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({ ok: false, error: "Bad response" }));
  if (!j.ok) throw new Error(j.error || "Failed");
}

export function RewardActions({ rewardId, status, userId, kyc }: { rewardId: string; status: string; userId: string; kyc: boolean }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const go = async (fn: () => Promise<void>) => {
    setBusy(true); setMsg("");
    try { await fn(); location.reload(); } catch (e) { setMsg(e instanceof Error ? e.message : "Failed"); setBusy(false); }
  };
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <button className="btn" disabled={busy} onClick={() => go(() => post("/api/admin/kyc", { userId, verified: !kyc }))}>{kyc ? "Unverify KYC" : "Verify KYC"}</button>
      {status === "requested" && <>
        <button className="btn primary" disabled={busy} onClick={() => go(() => post("/api/admin/rewards", { rewardId, action: "approve" }))}>Approve</button>
        <button className="btn" disabled={busy} onClick={() => go(() => post("/api/admin/rewards", { rewardId, action: "reject" }))}>Reject</button>
      </>}
      {status === "approved" && (
        <button className="btn primary" disabled={busy} onClick={() => { const ref = prompt("Bank transfer reference"); if (ref) void go(() => post("/api/admin/rewards", { rewardId, action: "paid", payoutRef: ref })); }}>Mark paid</button>
      )}
      {msg && <span className="muted" style={{ fontSize: ".85rem" }}>{msg}</span>}
    </div>
  );
}
