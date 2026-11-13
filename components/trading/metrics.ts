import { parseInstrumentKey } from "@/lib/types";
import { marginRequired, priceInstrument } from "@/lib/market/pricing";
import type { AccountRow, PlanRow, PositionRow } from "./types";

export type Spots = Record<string, number>;

export const sideDir = (side: "Buy" | "Sell") => (side === "Buy" ? 1 : -1);

/** Live price of a stored position's instrument, or null while its underlying has no quote yet. */
export function livePrice(instrument: string, spots: Spots): number | null {
  const ref = parseInstrumentKey(instrument);
  const spot = spots[ref.underlying];
  return spot == null ? null : priceInstrument(ref, spot);
}

export function positionPnl(p: PositionRow, spots: Spots): number | null {
  const px = livePrice(p.instrument, spots);
  return px == null ? null : (px - p.avg_price) * p.qty * sideDir(p.side);
}

export interface AccountMetrics {
  unrealized: number;
  equity: number;
  pl: number;
  plPct: number;
  marginUsed: number;
  available: number;
  overallUsedPct: number;
  overallLimitPct: number;
  dailyUsedPct: number;
  dailyLimitPct: number;
  targetPct: number | null;
  rewardEstimate: number;
  pricesReady: boolean;
}

/** Everything the dashboard and terminal show about one account, computed from closed balance plus live open P&L. */
export function accountMetrics(
  account: AccountRow,
  plan: PlanRow | undefined,
  positions: PositionRow[],
  spots: Spots,
): AccountMetrics {
  let unrealized = 0;
  let marginUsed = 0;
  let pricesReady = true;
  for (const p of positions) {
    const ref = parseInstrumentKey(p.instrument);
    const spot = spots[ref.underlying];
    if (spot == null) {
      pricesReady = false;
      continue;
    }
    const px = priceInstrument(ref, spot);
    unrealized += (px - p.avg_price) * p.qty * sideDir(p.side);
    marginUsed += marginRequired(ref, p.side, p.qty, p.avg_price, spot);
  }
  const size = account.account_size;
  const equity = account.balance + unrealized;
  const pl = equity - size;
  const target =
    account.phase === "phase_1"
      ? plan?.phase1_target_pct ?? null
      : account.phase === "phase_2"
        ? plan?.phase2_target_pct ?? null
        : null;
  const split = plan?.reward_split_pct ?? 80;
  return {
    unrealized,
    equity,
    pl,
    plPct: (pl / size) * 100,
    marginUsed,
    available: Math.max(0, equity - marginUsed),
    overallUsedPct: Math.max(0, ((size - equity) / size) * 100),
    overallLimitPct: plan?.max_overall_loss_pct ?? 8,
    dailyUsedPct: Math.max(0, ((account.day_start_equity - equity) / size) * 100),
    dailyLimitPct: plan?.max_daily_loss_pct ?? 4,
    targetPct: target,
    rewardEstimate: account.phase === "funded" ? Math.max(0, pl) * (split / 100) : 0,
    pricesReady,
  };
}
