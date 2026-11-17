import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";
import type { AccountRow, PlanRow } from "@/components/trading/types";
import type { KycSubmission, PaymentRow, PortalInitial, RewardRow } from "./types";

/** Server-side gate for every portal page: needs a session, then loads what the portal shows. RLS limits all rows to the trader's own. */
export async function loadPortal(path: string): Promise<PortalInitial> {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);

  const [acc, plans, prices, rewards, kycS, sub, prof, pays] = await Promise.all([
    sb.from("trading_accounts").select("*").order("created_at", { ascending: true }),
    sb.from("plans").select("*"),
    sb.from("plan_prices").select("price_inr").order("price_inr", { ascending: true }).limit(1),
    sb.from("rewards").select("*").order("requested_at", { ascending: false }),
    sb.from("kyc_status").select("verified").maybeSingle(),
    sb.from("kyc_submissions").select("*").maybeSingle(),
    sb.from("profiles").select("full_name").maybeSingle(),
    sb.from("payment_requests").select("*").order("created_at", { ascending: false }),
  ]);
  const n = Number;
  return {
    payments: ((pays.data ?? []) as PaymentRow[]).map((x) => ({ ...x, account_size: n(x.account_size), amount_inr: n(x.amount_inr), gst_inr: n(x.gst_inr) })),
    user: { name: (prof.data?.full_name as string) || (user.email ?? "").split("@")[0], email: user.email ?? "" },
    accounts: ((acc.data ?? []) as AccountRow[]).map((a) => ({ ...a, account_size: n(a.account_size), balance: n(a.balance), day_start_equity: n(a.day_start_equity) })),
    plans: ((plans.data ?? []) as PlanRow[]).map((p) => ({
      ...p,
      phase1_target_pct: p.phase1_target_pct == null ? null : n(p.phase1_target_pct),
      phase2_target_pct: p.phase2_target_pct == null ? null : n(p.phase2_target_pct),
      max_daily_loss_pct: n(p.max_daily_loss_pct),
      max_overall_loss_pct: n(p.max_overall_loss_pct),
      reward_split_pct: n(p.reward_split_pct),
    })),
    fromPrice: prices.data?.[0] ? n(prices.data[0].price_inr) : null,
    rewards: ((rewards.data ?? []) as RewardRow[]).map((r) => ({ ...r, amount_inr: n(r.amount_inr), fee_refund_inr: r.fee_refund_inr == null ? null : n(r.fee_refund_inr) })),
    kycVerified: !!kycS.data?.verified,
    kyc: (sub.data as KycSubmission | null) ?? null,
  };
}
