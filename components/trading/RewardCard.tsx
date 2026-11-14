"use client";
import { useState } from "react";
import { postJSON } from "./api";

/** Funded accounts only. The server checks every rule and says what is missing. */
export default function RewardCard({ accountId, onDone }: { accountId: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; err: boolean } | null>(null);
  async function request() {
    setBusy(true); setMsg(null);
    const res = await postJSON<{ payable: number; feeRefund: number }>("/api/rewards/request", { accountId });
    setBusy(false);
    if (res.ok) {
      setMsg({ text: "Reward request sent. Our team reviews it, and trading on this account pauses until it is decided.", err: false });
      onDone();
    } else setMsg({ text: res.error, err: true });
  }
  return (
    <div className="tr-glass tr-card" style={{ marginBottom: 12, display: "flex", gap: 16, alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <div>
        <div style={{ font: "400 1.4rem var(--f-display)" }}>Request a reward</div>
        <p className="tr-muted" style={{ fontSize: ".8rem" }}>Close all positions first. The checklist above shows what is still missing.</p>
      </div>
      <div><button className="tr-btn primary" onClick={request} disabled={busy}>{busy ? "Checking…" : "Request reward"}</button></div>
      {msg && <p className={"tr-msg" + (msg.err ? " err" : "")} role="status">{msg.text}</p>}
    </div>
  );
}
