"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { SYMBOLS } from "@/components/trading/constants";
import { accountMetrics, type AccountMetrics } from "@/components/trading/metrics";
import type { PositionRow, SnapshotRow, TradeRow, AccountRow, PlanRow } from "@/components/trading/types";
import { useQuotes } from "@/components/trading/useQuotes";
import { useTraderData } from "@/components/trading/useTraderData";
import type { KycSubmission, PortalInitial, RewardRow } from "./types";

interface Ctx {
  user: PortalInitial["user"];
  accounts: AccountRow[];
  plans: PlanRow[];
  fromPrice: number | null;
  positions: PositionRow[];
  trades: TradeRow[];
  snapshots: SnapshotRow[];
  metrics: Record<string, AccountMetrics>;
  rewards: RewardRow[];
  kycVerified: boolean;
  kyc: KycSubmission | null;
  setSelected: (id: string | null) => void;
  refresh: () => void;
}

const C = createContext<Ctx | null>(null);
export const usePortal = () => {
  const c = useContext(C);
  if (!c) throw new Error("usePortal outside PortalProvider");
  return c;
};

/** One live copy of the trader's accounts, positions and rewards, shared by every portal page. */
export function PortalProvider({ initial, children }: { initial: PortalInitial; children: ReactNode }) {
  const [selected, setSelected] = useState<string | null>(null);
  const data = useTraderData(initial.accounts, selected);
  const [rewards, setRewards] = useState(initial.rewards);
  const [kyc, setKyc] = useState({ verified: initial.kycVerified, sub: initial.kyc });
  const instruments = useMemo(() => [...new Set(data.positions.filter((p) => !p.instrument.includes("|EQ|")).map((p) => p.instrument))].slice(0, 40), [data.positions]);
  const { quotes } = useQuotes(data.positions.length ? SYMBOLS : [], instruments);

  const metrics = useMemo(() => {
    const out: Record<string, AccountMetrics> = {};
    for (const a of data.accounts) out[a.id] = accountMetrics(a, initial.plans.find((p) => p.key === a.plan_key), data.positions.filter((p) => p.account_id === a.id), quotes);
    return out;
  }, [data.accounts, data.positions, quotes, initial.plans]);

  const refreshExtra = useCallback(async () => {
    const sb = browserClient();
    const [r, k, s] = await Promise.all([
      sb.from("rewards").select("*").order("requested_at", { ascending: false }),
      sb.from("kyc_status").select("verified").maybeSingle(),
      sb.from("kyc_submissions").select("*").maybeSingle(),
    ]);
    if (r.error || k.error || s.error) return;
    if (r.data) setRewards((r.data as RewardRow[]).map((x) => ({ ...x, amount_inr: Number(x.amount_inr) })));
    setKyc({ verified: !!k.data?.verified, sub: (s.data as KycSubmission | null) ?? null });
  }, []);
  useEffect(() => { void refreshExtra(); }, [refreshExtra]);

  const refetch = data.refetch;
  const refresh = useCallback(() => { refetch(); void refreshExtra(); }, [refetch, refreshExtra]);

  const value: Ctx = {
    user: initial.user, accounts: data.accounts, plans: initial.plans, fromPrice: initial.fromPrice,
    positions: data.positions, trades: data.trades, snapshots: data.snapshots, metrics,
    rewards, kycVerified: kyc.verified, kyc: kyc.sub, setSelected, refresh,
  };
  return <C.Provider value={value}>{children}</C.Provider>;
}
