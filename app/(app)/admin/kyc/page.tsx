import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { KycActions } from "@/components/admin/KycActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Verification" };

export default async function Kyc() {
  try { await requireAdmin(); } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/kyc");
    return <main className="wrap" style={{ paddingBlock: 48 }}><div className="glass" style={{ padding: 28 }}>Admins only.</div></main>;
  }
  const { data } = await adminClient().from("kyc_submissions").select("*").order("submitted_at", { ascending: false }).limit(100);
  const rows = data ?? [];
  const sb = adminClient();
  const sign = async (path?: string | null) => (path ? (await sb.storage.from("kyc-docs").createSignedUrl(path, 900)).data?.signedUrl ?? null : null);
  const urls = new Map<string, (string | null)[]>();
  for (const r of rows) urls.set(r.user_id as string, await Promise.all([sign(r.pan_photo), sign(r.aadhaar_photo), sign(r.selfie_photo)]));
  return (
    <main className="wrap view" style={{ paddingBlock: 40 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", marginTop: 8 }}>Verification requests</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>Check the PAN, Aadhaar and selfie match the same person, and the payout account is in that name. Photo links expire in 15 minutes; refresh the page for new ones. Traders cannot request rewards until they are verified.</p>
      <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
        {rows.length === 0 && <div className="glass" style={{ padding: 22 }}>No requests yet.</div>}
        {rows.map((r) => (
          <div key={r.user_id} className="glass" style={{ padding: 20, display: "grid", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <b>{r.full_name}</b><span className="muted">{r.status}</span>
            </div>
            <div className="muted" style={{ fontSize: ".9rem" }}>
              PAN {r.pan} · {r.payout_method === "upi" ? `UPI ${r.upi_id}` : `Bank ${r.bank_account} · ${r.bank_ifsc}`} · {new Date(r.submitted_at).toLocaleString("en-IN")}
            </div>
            <div className="muted" style={{ fontSize: ".9rem" }}>Aadhaar {r.aadhaar_no} · {r.district}, {r.state}</div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {(["PAN", "Aadhaar", "Selfie"] as const).map((label, i) => { const u = urls.get(r.user_id as string)?.[i]; return u ? (
                <a key={label} href={u} target="_blank" rel="noreferrer" style={{ display: "grid", gap: 4, fontSize: ".8rem" }}><img src={u} alt={label} width={150} height={110} style={{ objectFit: "cover", borderRadius: 10, border: "1px solid var(--line)" }} />{label}</a>
              ) : null; })}
            </div>
            {r.status === "pending" && <KycActions userId={r.user_id} />}
            {r.reviewer_note && <div className="muted" style={{ fontSize: ".85rem" }}>Note: {r.reviewer_note}</div>}
          </div>
        ))}
      </div>
    </main>
  );
}
