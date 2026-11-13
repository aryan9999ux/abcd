"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { POLL_DATA_MS } from "./constants";
import type { AccountRow, OrderRow, PositionRow, SnapshotRow, TradeRow } from "./types";

export interface TraderData {
  accounts: AccountRow[];
  positions: PositionRow[];
  orders: OrderRow[];
  trades: TradeRow[];
  snapshots: SnapshotRow[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const n = (v: unknown) => Number(v);

const normAccount = (r: AccountRow): AccountRow => ({
  ...r,
  account_size: n(r.account_size),
  balance: n(r.balance),
  day_start_equity: n(r.day_start_equity),
});
const normPosition = (r: PositionRow): PositionRow => ({ ...r, qty: n(r.qty), avg_price: n(r.avg_price) });
const normOrder = (r: OrderRow): OrderRow => ({
  ...r,
  qty: n(r.qty),
  price: r.price == null ? null : n(r.price),
  strike: r.strike == null ? null : n(r.strike),
});
const normTrade = (r: TradeRow): TradeRow => ({ ...r, qty: n(r.qty), price: n(r.price), realized_pnl: n(r.realized_pnl) });
const normSnap = (r: SnapshotRow): SnapshotRow => ({ ...r, equity: n(r.equity) });

/**
 * Reads the signed-in trader's own rows (row level security limits every query to them).
 * Positions and pending orders cover all accounts; trades and the equity curve cover the selected account.
 * Refreshes on Realtime changes, on a slow poll as a fallback, and on demand through refetch().
 */
export function useTraderData(initialAccounts: AccountRow[], selectedId: string | null): TraderData {
  const [data, setData] = useState<Omit<TraderData, "refetch">>({
    accounts: initialAccounts,
    positions: [],
    orders: [],
    trades: [],
    snapshots: [],
    loading: true,
    error: null,
  });
  const sel = useRef(selectedId);
  sel.current = selectedId;
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    const sb = browserClient();
    const id = sel.current;
    const tradeQ = sb.from("trades").select("*").order("executed_at", { ascending: false }).limit(60);
    const snapQ = sb.from("equity_snapshots").select("id,account_id,equity,taken_at").order("taken_at", { ascending: false }).limit(300);
    const [acc, pos, ord, tr, sn] = await Promise.all([
      sb.from("trading_accounts").select("*").order("created_at", { ascending: true }),
      sb.from("positions").select("*"),
      sb.from("orders").select("*").order("created_at", { ascending: false }).limit(100),
      id ? tradeQ.eq("account_id", id) : tradeQ,
      id ? snapQ.eq("account_id", id) : snapQ.limit(0),
    ]);
    if (mine !== seq.current) return;
    const err = acc.error || pos.error || ord.error || tr.error || sn.error;
    setData((d) => ({
      accounts: acc.data ? (acc.data as AccountRow[]).map(normAccount) : d.accounts,
      positions: pos.data ? (pos.data as PositionRow[]).map(normPosition) : d.positions,
      orders: ord.data ? (ord.data as OrderRow[]).map(normOrder) : d.orders,
      trades: tr.data ? (tr.data as TradeRow[]).map(normTrade) : d.trades,
      snapshots: sn.data ? (sn.data as SnapshotRow[]).map(normSnap).reverse() : d.snapshots,
      loading: false,
      error: err ? "Could not refresh your account data. Retrying." : null,
    }));
  }, []);

  // refetch when the selected account changes
  useEffect(() => {
    load();
  }, [selectedId, load]);

  useEffect(() => {
    const sb = browserClient();
    let debounce: ReturnType<typeof setTimeout>;
    const kick = () => {
      clearTimeout(debounce);
      debounce = setTimeout(load, 250);
    };
    let ch = sb.channel("trader-data");
    for (const table of ["orders", "positions", "trading_accounts", "trades"]) {
      ch = ch.on("postgres_changes", { event: "*", schema: "public", table }, kick);
    }
    ch.subscribe();
    const poll = setInterval(() => {
      if (!document.hidden) load();
    }, POLL_DATA_MS);
    return () => {
      clearTimeout(debounce);
      clearInterval(poll);
      sb.removeChannel(ch);
    };
  }, [load]);

  return { ...data, refetch: load };
}
