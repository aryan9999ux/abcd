import "server-only";
import { userClient } from "@/lib/supabase/server";

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** The signed-in trader's own data as plain text for the assistant. RLS means only their rows come back. Null when signed out. */
export async function userFacts(): Promise<{ name: string; hasBought: boolean; text: string } | null> {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [acc, pay, rew, kyc, prof] = await Promise.all([
    sb.from("trading_accounts").select("plan_key,account_size,balance,phase,status,is_demo,breach_reason,created_at").order("created_at", { ascending: false }).limit(10),
    sb.from("payment_requests").select("plan_key,account_size,amount_inr,status,reject_reason,created_at").order("created_at", { ascending: false }).limit(6),
    sb.from("rewards").select("amount_inr,status,reject_reason,requested_at").order("requested_at", { ascending: false }).limit(6),
    sb.from("kyc_submissions").select("status,reject_reason").maybeSingle(),
    sb.from("profiles").select("full_name").maybeSingle(),
  ]);
  const name = ((prof.data?.full_name as string) || (user.email ?? "").split("@")[0]).split(" ")[0];
  const a = acc.data ?? [];
  const hasBought = a.some((x) => !x.is_demo) || (pay.data ?? []).some((p) => p.status === "approved");
  const lines = [
    `Name: ${name}`,
    `Accounts: ${a.length ? a.map((x) => `${x.plan_key}${x.is_demo ? " demo" : ""} ${inr(Number(x.account_size))}, balance ${inr(Number(x.balance))}, phase ${x.phase}, ${x.status}${x.breach_reason ? ` (${x.breach_reason})` : ""}`).join(" | ") : "none yet"}`,
    `Payments: ${(pay.data ?? []).length ? (pay.data ?? []).map((p) => `${p.plan_key} ${inr(Number(p.account_size))} fee ${inr(Number(p.amount_inr))} ${p.status}${p.reject_reason ? ` (${p.reject_reason})` : ""}`).join(" | ") : "none"}`,
    `Payouts: ${(rew.data ?? []).length ? (rew.data ?? []).map((r) => `${inr(Number(r.amount_inr))} ${r.status}${r.reject_reason ? ` (${r.reject_reason})` : ""}`).join(" | ") : "none"}`,
    `Verification (KYC): ${kyc.data ? `${kyc.data.status}${kyc.data.reject_reason ? ` (${kyc.data.reject_reason})` : ""}` : "not started"}`,
  ];
  return { name, hasBought, text: lines.join("\n") };
}
