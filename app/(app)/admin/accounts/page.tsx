import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { TerminateButton } from "@/components/admin/TerminateButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accounts" };
const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function Accounts() {
  try { await requireAdmin(); } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/accounts");
    return <main className="wrap" style={{ paddingBlock: 48 }}><div className="glass" style={{ padding: 28 }}>Admins only.</div></main>;
  }
  const sb = adminClient();
  const { data } = await sb.from("trading_accounts").select("id,user_id,plan_key,account_size,balance,phase,status,is_demo,breach_reason,created_at").order("created_at", { ascending: false }).limit(200);
  const rows = data ?? [];
  const emails = new Map<string, string>();
  for (const id of [...new Set(rows.map((r) => r.user_id as string))]) { const u = await sb.auth.admin.getUserById(id); emails.set(id, u.data.user?.email ?? id); }
  return (
    <main className="wrap view" style={{ paddingBlock: 40 }}>
      <span className="eyebrow">Admin</span>
      <h1 style={{ fontSize: "clamp(1.6rem,4vw,2.4rem)", marginTop: 8 }}>Accounts</h1>
      <p className="muted" style={{ marginTop: 8, maxWidth: 640 }}>Closing an account squares off its positions and shows the trader your reason.</p>
      <div style={{ display: "grid", gap: 12, marginTop: 24 }}>
        {rows.map((r) => (
          <div key={r.id} className="glass" style={{ padding: 16, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <b>{emails.get(r.user_id as string)}</b>
              <div className="muted" style={{ fontSize: ".88rem" }}>{r.plan_key} · {inr(Number(r.account_size))} · balance {inr(Number(r.balance))} · {r.phase}{r.is_demo ? " · demo" : ""} · {r.status}{r.breach_reason ? ` (${r.breach_reason})` : ""}</div>
            </div>
            {r.status === "active" && <TerminateButton accountId={r.id as string} />}
          </div>
        ))}
      </div>
    </main>
  );
}
