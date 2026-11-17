"use client";
import { useEffect, useState } from "react";
import { postJSON } from "@/components/trading/api";
import { usePortal } from "./PortalProvider";
import { Badge, PageHead } from "./ui";

export default function VerificationPage() {
  const { kyc, kycVerified, refresh, user } = usePortal();
  const [f, setF] = useState({ fullName: "", pan: "", method: "upi" as "upi" | "bank", upiId: "", bankAccount: "", bankIfsc: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err: boolean } | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    if (kyc) setF({ fullName: kyc.full_name, pan: kyc.pan, method: kyc.payout_method, upiId: kyc.upi_id ?? "", bankAccount: kyc.bank_account ?? "", bankIfsc: kyc.bank_ifsc ?? "" });
  }, [kyc]);

  const state = kycVerified ? "verified" : kyc?.status ?? "none";
  const locked = state === "verified" || (state === "pending" && !edit);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await postJSON("/api/kyc", { fullName: f.fullName, pan: f.pan, method: f.method, upiId: f.upiId, bankAccount: f.bankAccount, bankIfsc: f.bankIfsc });
    setBusy(false);
    if (res.ok) { setMsg({ t: "Sent. We usually review within a day.", err: false }); setEdit(false); refresh(); }
    else setMsg({ t: res.error, err: true });
  }

  return (
    <>
      <PageHead title="Verification" sub="We verify who you are once, so we can pay the right person. It takes about 2 minutes." />
      {state === "verified" && <div className="pt-banner ok"><div><b>You’re verified</b><p>You can request payouts as soon as an account is eligible.</p></div><Badge tone="ok">Verified</Badge></div>}
      {state === "pending" && <div className="pt-banner warn"><div><b>We’re reviewing your details</b><p>This usually takes a day. We’ll mark you verified here.</p></div><Badge tone="warn">In review</Badge></div>}
      {state === "rejected" && <div className="pt-banner bad"><div><b>We couldn’t verify you</b><p>{kyc?.reviewer_note || "Please check your details and send them again."}</p></div><Badge tone="bad">Needs changes</Badge></div>}

      <section className="pt-card">
        <div className="pt-ch"><h2>Your details</h2>{state === "pending" && !edit && <button className="pt-link" onClick={() => setEdit(true)}>Edit</button>}</div>
        <form className="pt-form" onSubmit={submit}>
          <div className="pt-field">
            <label htmlFor="kn">Full name</label>
            <input id="kn" className="pt-input" value={f.fullName} onChange={set("fullName")} disabled={locked} autoComplete="name" placeholder="As on your PAN card" />
          </div>
          <div className="pt-field">
            <label htmlFor="kp">PAN</label>
            <input id="kp" className="pt-input" value={f.pan} onChange={(e) => setF((s) => ({ ...s, pan: e.target.value.toUpperCase() }))} disabled={locked} maxLength={10} placeholder="ABCDE1234F" autoCapitalize="characters" />
          </div>
          <div className="pt-field">
            <span>Where should we send your payouts?</span>
            <div className="pt-seg" role="group" aria-label="Payout method">
              <button type="button" aria-pressed={f.method === "upi"} onClick={() => !locked && setF((s) => ({ ...s, method: "upi" }))}>UPI</button>
              <button type="button" aria-pressed={f.method === "bank"} onClick={() => !locked && setF((s) => ({ ...s, method: "bank" }))}>Bank account</button>
            </div>
          </div>
          {f.method === "upi" ? (
            <div className="pt-field"><label htmlFor="ku">UPI ID</label><input id="ku" className="pt-input" value={f.upiId} onChange={set("upiId")} disabled={locked} placeholder="name@bank" autoCapitalize="none" /><small>It must be in your own name. Payouts to other people’s accounts are not allowed.</small></div>
          ) : (
            <>
              <div className="pt-field"><label htmlFor="kb">Account number</label><input id="kb" className="pt-input" inputMode="numeric" value={f.bankAccount} onChange={set("bankAccount")} disabled={locked} /></div>
              <div className="pt-field"><label htmlFor="ki">IFSC</label><input id="ki" className="pt-input" value={f.bankIfsc} onChange={(e) => setF((s) => ({ ...s, bankIfsc: e.target.value.toUpperCase() }))} disabled={locked} placeholder="HDFC0001234" maxLength={11} /><small>The account must be in your own name.</small></div>
            </>
          )}
          {!locked && <button className="pt-btn primary" disabled={busy}>{busy ? "Sending…" : state === "none" ? "Submit for verification" : "Send again"}</button>}
          {msg && <p className={"pt-msg " + (msg.err ? "err" : "ok")} role="status">{msg.t}</p>}
          <small style={{ color: "var(--muted)" }}>Signed in as {user.email}. We only use these details to verify you and pay you.</small>
        </form>
      </section>
    </>
  );
}
