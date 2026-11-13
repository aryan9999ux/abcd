export interface Plan {
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

export interface PlanPrice {
  plan_key: string;
  account_size: number;
  price_inr: number;
}

export const PLAN_TAGLINES: Record<string, string> = {
  instant: "Funded from day one, no evaluation",
  one_step: "One evaluation phase",
  two_step: "Two phases, lowest fee",
};
