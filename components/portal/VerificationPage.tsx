"use client";
import { useEffect, useState } from "react";
import { usePortal } from "./PortalProvider";
import { STATES } from "./states";
import { Badge, PageHead } from "./ui";

type Kind = "pan" | "aadhaar" | "selfie";
const DOCS: [Kind, string, string][] = [
  ["pan", "PAN card photo", "A clear photo of the front of your PAN card."],
  ["aadhaar", "Aadhaar card photo", "A clear photo of the front of your Aadhaar card."],
  ["selfie", "Selfie with your Aadhaar", "Hold your Aadhaar next to your face. Your face and the card must both be clear."],
];

export default function VerificationPage() {
  const { kyc, kycVerified, refresh, user } = usePortal();
  const [f, setF] = useState({ fullName: "", pan: "", aadhaarNo: "", district: "", state: "", method: "upi" as "upi" | "bank", upiId: "", bankAccount: "", bankIfsc: "" });
  const [files, setFiles] = useState<Partial<Record<Kind, File>>>({});
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ t: string; err: boolean } | null>(null);
  const [edit, setEdit] = useState(false);

  useEffect(() => {
    if (kyc) setF({ fullName: kyc.full_name, pan: kyc.pan, aadhaarNo: kyc.aadhaar_no ?? "", district: kyc.district ?? "", state: kyc.state ?? "", method: kyc.payout_method, upiId: kyc.upi_id ?? "", bankAccount: kyc.bank_account ?? "", bankIfsc: kyc.bank_ifsc ?? "" });
  }, [kyc]);

  const state = kycVerified ? "verified" : kyc?.status ?? "none";
  const locked = state === "verified" || (state === "pending" && !edit);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const have = (k: Kind) => !!files[k] || !!(k === "pan" ? kyc?.pan_photo : k === "aadhaar" ? kyc?.aadhaar_photo : kyc?.selfie_photo);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.set(k, v));
    fd.set("consent", consent ? "true" : "false");
    (Object.keys(files) as Kind[]).forEach((k) => files[k] && fd.set(`${k}Photo`, files[k]!));
    try {
      const res = await fetch("/api/kyc", { method: "POST", body: fd });
      const j = await res.json().catch(() => null);
      if (j?.ok) { setMsg({ t: "Sent. We usually review within a day.", err: false }); setEdit(false); setFiles({}); refresh(); }
      else setMsg({ t: j?.error ?? "Could not send. Try again.", err: true });
    } catch { setMsg({ t: "Could not reach the server. Check your connection and try again.", err: true }); }
    setBusy(false);
  }

  return (
    <>
      <PageHead title="Verification" sub="We verify who you are once, so we can pay the right person. It takes about 5 minutes." />
      {state === "verified" && <div className="pt-banner ok"><div><b>You’re verified</b><p>You can request payouts as soon as an account is eligible.</p></div><Badge tone="ok">Verified</Badge></div>}
      {state === "pending" && <div className="pt-banner warn"><div><b>We’re reviewing your documents</b><p>This usually takes a day. We’ll mark you verified here.</p></div><Badge tone="warn">In review</Badge></div>}
      {state === "rejected" && <div className="pt-banner bad"><div><b>We couldn’t verify you</b><p>{kyc?.reviewer_note || "Please check your details and send them again."}</p></div><Badge tone="bad">Needs changes</Badge></div>}

      <form className="pt-stack" onSubmit={submit} style={{ gap: 16 }}>
        <section className="pt-card">
          <div className="pt-ch"><h2>Your details</h2>{state === "pending" && !edit && <button type="button" className="pt-link" onClick={() => setEdit(true)}>Edit</button>}</div>
          <div className="pt-form" style={{ maxWidth: 640 }}>
            <div className="pt-field"><label htmlFor="kn">Full name</label><input id="kn" className="pt-input" value={f.fullName} onChange={set("fullName")} disabled={locked} autoComplete="name" placeholder="As on your PAN card" /></div>
            <div className="pt-two">
              <div className="pt-field"><label htmlFor="kp">PAN number</label><input id="kp" className="pt-input" value={f.pan} onChange={(e) => setF((s) => ({ ...s, pan: e.target.value.toUpperCase() }))} disabled={locked} maxLength={10} placeholder="ABCDE1234F" autoCapitalize="characters" /></div>
              <div className="pt-field"><label htmlFor="ka">Aadhaar number</label><input id="ka" className="pt-input" inputMode="numeric" value={f.aadhaarNo} onChange={(e) => setF((s) => ({ ...s, aadhaarNo: e.target.value.replace(/\D/g, "") }))} disabled={locked} maxLength={12} placeholder="12 digits" /></div>
            </div>
            <div className="pt-two">
              <div className="pt-field"><label htmlFor="kd">District</label><input id="kd" className="pt-input" value={f.district} onChange={set("district")} disabled={locked} autoComplete="address-level2" /></div>
              <div className="pt-field"><label htmlFor="ks">State</label>
                <select id="ks" className="pt-input" value={f.state} onChange={set("state")} disabled={locked}><option value="">Choose state</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
            </div>
          </div>
        </section>

        <section className="pt-card">
          <div className="pt-ch"><h2>Documents</h2></div>
          <div className="pt-docs">
            {DOCS.map(([k, label, hint]) => (
              <label key={k} className={"pt-doc " + (have(k) ? "have" : "")}>
                <span className="pt-docic">{have(k) ? "✓" : "+"}</span>
                <span><b>{label}</b><small>{files[k] ? files[k]!.name : have(k) ? "Uploaded. Tap to replace." : hint}</small></span>
                <input type="file" accept="image/jpeg,image/png,image/webp" capture={k === "selfie" ? "user" : undefined} disabled={locked} onChange={(e) => { const file = e.target.files?.[0]; if (file) setFiles((s) => ({ ...s, [k]: file })); }} />
              </label>
            ))}
          </div>
          <small style={{ color: "var(--muted)", display: "block", marginTop: 12 }}>JPG, PNG or WebP, up to 5 MB each. Only our verification team can open your documents.</small>
        </section>

        <section className="pt-card">
          <div className="pt-ch"><h2>Where should we send your payouts?</h2></div>
          <div className="pt-form" style={{ maxWidth: 640 }}>
            <div className="pt-seg" role="group" aria-label="Payout method">
              <button type="button" aria-pressed={f.method === "upi"} onClick={() => !locked && setF((s) => ({ ...s, method: "upi" }))}>UPI</button>
              <button type="button" aria-pressed={f.method === "bank"} onClick={() => !locked && setF((s) => ({ ...s, method: "bank" }))}>Bank account</button>
            </div>
            {f.method === "upi" ? (
              <div className="pt-field"><label htmlFor="ku">UPI ID</label><input id="ku" className="pt-input" value={f.upiId} onChange={set("upiId")} disabled={locked} placeholder="name@bank" autoCapitalize="none" /><small>It must be in your own name. Payouts to other people’s accounts are not allowed.</small></div>
            ) : (
              <>
                <div className="pt-field"><label htmlFor="kb">Account number</label><input id="kb" className="pt-input" inputMode="numeric" value={f.bankAccount} onChange={set("bankAccount")} disabled={locked} /></div>
                <div className="pt-field"><label htmlFor="ki">IFSC</label><input id="ki" className="pt-input" value={f.bankIfsc} onChange={(e) => setF((s) => ({ ...s, bankIfsc: e.target.value.toUpperCase() }))} disabled={locked} placeholder="HDFC0001234" maxLength={11} /><small>The account must be in your own name.</small></div>
              </>
            )}
          </div>
        </section>

        {!locked && (
          <section className="pt-card">
            <label className="pt-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I confirm these details are mine, and I allow Apex Capital Funded to store my documents to verify my identity and pay me.</span></label>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginTop: 14 }}>
              <button className="pt-btn primary" disabled={busy}>{busy ? "Sending…" : state === "none" ? "Submit for verification" : "Send again"}</button>
              <small style={{ color: "var(--muted)" }}>Signed in as {user.email}</small>
            </div>
            {msg && <p className={"pt-msg " + (msg.err ? "err" : "ok")} role="status" style={{ marginTop: 12 }}>{msg.t}</p>}
          </section>
        )}
        {locked && msg && <p className={"pt-msg " + (msg.err ? "err" : "ok")} role="status">{msg.t}</p>}
      </form>
    </>
  );
}
