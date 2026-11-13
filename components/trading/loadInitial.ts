import { redirect } from "next/navigation";
import { userClient } from "@/lib/supabase/server";
import type { AccountRow, PlanRow } from "./types";

export interface TradingInitial {
  accounts: AccountRow[];
  plans: PlanRow[];
  selectedId: string | null;
}

/**
 * Server-side gate for the dashboard and terminal. Redirects to /login without a session,
 * then loads the trader's accounts (RLS limits this to their own) and the plan catalogue.
 */
export async function loadTradingInitial(path: "/dashboard" | "/terminal", accountParam?: string): Promise<TradingInitial> {
  const sb = await userClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(path)}`);

  const [acc, plans] = await Promise.all([
    sb.from("trading_accounts").select("*").order("created_at", { ascending: true }),
    sb.from("plans").select("*"),
  ]);

  const accounts = ((acc.data ?? []) as AccountRow[]).map((a) => ({
    ...a,
    account_size: Number(a.account_size),
    balance: Number(a.balance),
    day_start_equity: Number(a.day_start_equity),
  }));
  const planRows = ((plans.data ?? []) as PlanRow[]).map((p) => ({
    ...p,
    phase1_target_pct: p.phase1_target_pct == null ? null : Number(p.phase1_target_pct),
    phase2_target_pct: p.phase2_target_pct == null ? null : Number(p.phase2_target_pct),
    max_daily_loss_pct: Number(p.max_daily_loss_pct),
    max_overall_loss_pct: Number(p.max_overall_loss_pct),
    reward_split_pct: Number(p.reward_split_pct),
  }));

  const requested = accounts.find((a) => a.id === accountParam);
  const preferred = requested ?? [...accounts].reverse().find((a) => a.status === "active") ?? accounts[accounts.length - 1];
  return { accounts, plans: planRows, selectedId: preferred?.id ?? null };
}
