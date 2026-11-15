"use client";
import { PLAN_RULES } from "@/lib/rules";
import { drawdownFloor } from "@/lib/engine/pure";
import { inr } from "./format";
import type { AccountMetrics } from "./metrics";
import type { AccountRow } from "./types";

function Bar({ label, used, limit, text }: { label: string; used: number; limit: number; text: string }) {
  const p = limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0;
  return (
    <div className="m">
      <small><span>{label}</span><b className="tr-mono">{text}</b></small>
      <div className="tr-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(p)}>
        <i className={p > 80 ? "bad" : p > 55 ? "risk" : ""} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
}

function figures(account: AccountRow, m: AccountMetrics | null) {
  const r = account.rules ?? PLAN_RULES[account.plan_key];
  const size = account.account_size;
  const peak = Math.max(Number(account.peak_eod_balance ?? size), size);
  const floor = r ? drawdownFloor({ accountSize: size, drawdownPct: r.drawdownPct, drawdownType: r.drawdownType, peakEod: peak }) : size * 0.9;
  const dailyRoom = r ? (size * r.dailyLossPct) / 100 : size * 0.04;
  return { r, peak, floor, dailyRoom };
}

/** One slim row above the terminal: the money. */
export default function StatusStrip({ account, m }: { account: AccountRow; m: AccountMetrics | null; openCount?: number }) {
  const dayPl = m ? m.equity - account.day_start_equity : null;
  return (
    <div className="tr-strip">
      <div><small>Equity</small><div className="v">{m ? inr(m.equity) : "—"}</div></div>
      <div><small>Day P&amp;L</small><div className={"v " + (dayPl == null ? "" : dayPl >= 0 ? "tr-up" : "tr-down")}>{dayPl == null ? "—" : inr(dayPl)}</div></div>
      <div><small>Margin used</small><div className="v">{m ? inr(m.marginUsed) : "—"}</div></div>
      <div><small>Available</small><div className="v">{m ? inr(m.available) : "—"}</div></div>
    </div>
  );
}

/** The limits that can end the account, as live meters. */
export function RiskPanel({ account, m, openCount }: { account: AccountRow; m: AccountMetrics | null; openCount: number }) {
  const { r, peak, floor, dailyRoom } = figures(account, m);
  if (!m) return null;
  return (
    <div className="tr-glass tr-card tr-risk">
      <h3>Risk limits</h3>
      <Bar label="Daily loss" used={Math.max(0, account.day_start_equity - m.equity)} limit={dailyRoom} text={`${inr(Math.max(0, account.day_start_equity - m.equity))} / ${inr(dailyRoom)}`} />
      <Bar label="Drawdown" used={Math.max(0, peak - m.equity)} limit={Math.max(1, peak - floor)} text={`floor ${inr(floor)}`} />
      {r && <Bar label="Positions" used={openCount} limit={r.maxOpenPositions} text={`${openCount} / ${r.maxOpenPositions}`} />}
    </div>
  );
}
