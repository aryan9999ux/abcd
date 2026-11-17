import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { PaymentSettingsForm } from "@/components/admin/PaymentSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payments" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function Payments() {
  try { await requireAdmin(); } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/payments");
    return <main className="wrap" style={{ paddingBlock: 48 }}><div className="glass" style={{ padding: 28 }}>Admins only.</div></main>;
  }
  const sb = adminClient();
  const [{ data: rows }, { data: ps }] = await Promise.all([
    sb.from("payment_requests").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("payment_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  const list = rows ?? [];
  const emails = new Map<string, string>();
  for (const id of [...new Set(list.map((r) => r.user_id as string))]) { const u = await sb.auth.admin.getUserById(id); emails.set(id, u.data.user?.email ?? id); }
  const qrUrl = ps?.qr_path ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/payment-qr/${ps.qr_path}` : null;
  const pending = list.filter((r) => r.status === "pending");
  const done = list.filter((r) => r.status !== "pending");
  const card = (r: (typeof list)[number]) => (
    <div key={r.id} className="glass" style={{ padding: 20, display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <b>{emails.get(r.user_id as string)}</b><span className="muted">{r.status}{r.receipt_no ? ` · ${r.receipt_no}` : ""}</span>
      </div>
      <div className="muted" style={{ fontSize: ".92rem" }}>
        {r.plan_key} · {inr(Number(r.account_size))} account · <b style={{ color: "var(--fg)" }}>{inr(Number(r.amount_inr))}</b> · UTR <b style={{ color: "var(--fg)", fontFamily: "var(--f-mono)" }}>{r.utr}</b> · {new Date(r.created_at as string).toLocaleString("en-IN")}
      </div>
      {r.status === "pending" && <PaymentActions paymentId={r.id as string} />}
      {r.reject_reason && <div className="muted" style={{ fontSize: ".85rem" }}>Reason: {r.reject_reason}</div>}
    </div>
  );
  return (
    <main className="wrap view" style={{ paddingBlock: 40 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", marginTop: 8 }}>Payments</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>Match the UTR and the amount in your bank before approving. Approving opens the trader’s account and issues the receipt. Requests stay here permanently.</p>
      <div style={{ marginTop: 24 }}><PaymentSettingsForm upiId={(ps?.upi_id as string) ?? ""} payee={(ps?.payee_name as string) ?? ""} qrUrl={qrUrl} /></div>
      <h2 style={{ fontSize: "1.2rem", marginTop: 32 }}>Waiting for approval ({pending.length})</h2>
      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>{pending.length === 0 ? <div className="glass" style={{ padding: 22 }}>Nothing waiting.</div> : pending.map(card)}</div>
      <h2 style={{ fontSize: "1.2rem", marginTop: 32 }}>History</h2>
      <div style={{ display: "grid", gap: 14, marginTop: 14 }}>{done.length === 0 ? <div className="glass" style={{ padding: 22 }}>No decisions yet.</div> : done.map(card)}</div>
    </main>
  );
}
