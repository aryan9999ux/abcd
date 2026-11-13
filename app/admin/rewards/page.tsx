import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { RewardActions } from "@/components/admin/RewardActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Rewards" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function Rewards() {
  try { await requireAdmin(); } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/rewards");
    return <main className="wrap" style={{ paddingBlock: 48 }}><div className="glass" style={{ padding: 28 }}>Admins only.</div></main>;
  }
  const sb = adminClient();
  const { data: rows } = await sb.from("rewards").select("*").order("requested_at", { ascending: false }).limit(100);
  const rewards = rows ?? [];
  const accIds = [...new Set(rewards.map((r) => r.account_id))];
  const userIds = [...new Set(rewards.map((r) => r.user_id))];
  const [{ data: accs }, { data: kycs }] = await Promise.all([
    accIds.length ? sb.from("trading_accounts").select("id,plan_key,account_size,payouts_count").in("id", accIds) : { data: [] },
    userIds.length ? sb.from("kyc_status").select("user_id,verified").in("user_id", userIds) : { data: [] },
  ]);
  const emails = new Map<string, string>();
  for (const id of userIds) { const u = await sb.auth.admin.getUserById(id); emails.set(id, u.data.user?.email ?? id); }

  return (
    <main className="wrap view" style={{ paddingBlock: 40 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", marginTop: 8 }}>Reward requests</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>Check the trades, the rules and the person's bank name before approving. Approving starts the account's next cycle at the starting balance.</p>
      <div style={{ display: "grid", gap: 14, marginTop: 24 }}>
        {rewards.length === 0 && <div className="glass" style={{ padding: 22 }}>No requests yet.</div>}
        {rewards.map((r) => {
          const a = accs?.find((x) => x.id === r.account_id);
          const kyc = !!kycs?.find((k) => k.user_id === r.user_id)?.verified;
          return (
            <div key={r.id} className="glass" style={{ padding: 20, display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{emails.get(r.user_id)}</strong>
                <span className="pill">{r.status}</span>
              </div>
              <div className="muted" style={{ fontSize: ".9rem" }}>
                {a ? `${a.plan_key} · ${inr(Number(a.account_size))} account · payout #${Number(a.payouts_count) + 1}` : "account"} · requested {new Date(r.requested_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
              </div>
              <div>
                Closed profit {inr(Number(r.gross_profit_inr ?? 0))} · {Number(r.split_pct)}% share
                {Number(r.fee_refund_inr) > 0 ? ` + fee refund ${inr(Number(r.fee_refund_inr))}` : ""} · <strong>pay {inr(Number(r.amount_inr))}</strong>
                {" "}· KYC {kyc ? "verified" : "not verified"}
              </div>
              <RewardActions rewardId={r.id} status={r.status} userId={r.user_id} kyc={kyc} />
            </div>
          );
        })}
      </div>
    </main>
  );
}
