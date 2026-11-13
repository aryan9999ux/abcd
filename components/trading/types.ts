/** Row shapes read from Supabase (RLS: a trader only ever sees their own rows). Money is rupees, qty is units. */

export interface PlanRow {
  key: string;
  name: string;
  evaluation_phases: number;
  phase1_target_pct: number | null;
  phase2_target_pct: number | null;
  max_daily_loss_pct: number;
  max_overall_loss_pct: number;
  min_trading_days: number;
  reward_split_pct: number;
}

export type AccountStatus = "active" | "passed" | "breached" | "closed";
export type AccountPhase = "phase_1" | "phase_2" | "funded";

export interface AccountRow {
  id: string;
  plan_key: string;
  account_size: number;
  phase: AccountPhase;
  status: AccountStatus;
  balance: number;
  day_start_equity: number;
  trading_days: number;
  breach_reason: string | null;
  created_at: string;
}

export interface PositionRow {
  id: string;
  account_id: string;
  instrument: string;
  segment: "EQ" | "FUT" | "CE" | "PE";
  side: "Buy" | "Sell";
  qty: number;
  avg_price: number;
  opened_at: string;
}

export interface OrderRow {
  id: string;
  account_id: string;
  instrument: string;
  segment: "EQ" | "FUT" | "CE" | "PE";
  underlying: string;
  strike: number | null;
  expiry: string | null;
  side: "Buy" | "Sell";
  order_type: "Market" | "Limit" | "Stop";
  qty: number;
  price: number | null;
  status: "pending" | "filled" | "cancelled" | "rejected";
  reject_reason: string | null;
  created_at: string;
  filled_at: string | null;
}

export interface TradeRow {
  id: string;
  account_id: string;
  order_id: string | null;
  instrument: string;
  side: "Buy" | "Sell";
  qty: number;
  price: number;
  realized_pnl: number;
  executed_at: string;
}

export interface SnapshotRow {
  id: number;
  account_id: string;
  equity: number;
  taken_at: string;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
}
