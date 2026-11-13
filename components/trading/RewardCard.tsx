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
    <div className="tr-glass tr-card" style={{ marginBottom: 14 }}>
      <h3>Request a reward</h3>
      <p className="tr-muted" style={{ fontSize: ".88rem" }}>
        Close all positions first. A reward needs the profit, profitable days and waiting period set in the rules, and a verified KYC.
      </p>
      <div><button className="tr-btn primary" onClick={request} disabled={busy}>{busy ? "Checking…" : "Request reward"}</button></div>
      {msg && <p className={"tr-msg" + (msg.err ? " err" : "")} role="status">{msg.text}</p>}
    </div>
  );
}
