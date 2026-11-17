"use client";
import Link from "next/link";
import { inr, phaseLabel, statusLabel } from "@/components/trading/format";
import type { AccountRow, PlanRow } from "@/components/trading/types";
import type { AccountMetrics } from "@/components/trading/metrics";
import { accountView, compact } from "./calc";
import { Badge, Bar } from "./ui";

const tone = (s: string) => (s === "active" ? "ok" : s === "passed" ? "brand" : s === "breached" ? "bad" : "n");

/** One account, told as a journey: where it is, how close the target is, how much loss room is left. */
export default function AccountCard({ a, plan, m }: { a: AccountRow; plan?: PlanRow; m: AccountMetrics | null }) {
  const v = accountView(a, m);
  const tgt = v.targetAmt ? Math.max(0, (v.profit / v.targetAmt) * 100) : 0;
  const daysLeft = a.is_demo && a.demo_expires_at ? Math.max(0, Math.ceil((new Date(a.demo_expires_at).getTime() - Date.now()) / 86_400_000)) : null;
  return (
    <article className="pt-acct">
      <div className="pt-ah">
        <div>
          <h3>{compact(v.size)} · {plan?.name ?? a.plan_key}</h3>
          <div className="tags">
            {a.is_demo && <Badge tone="warn">Demo{daysLeft != null ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}</Badge>}
            <Badge tone={tone(a.status)}>{a.status === "active" ? phaseLabel(a.phase) : statusLabel(a.status)}</Badge>
          </div>
        </div>
        <div className="pt-eq">
          <b>{inr(v.equity)}</b>
          <small className={v.pl >= 0 ? "up" : "down"}>{v.pl >= 0 ? "+" : ""}{inr(v.pl)}</small>
        </div>
      </div>

      <div className="pt-stage" aria-label="Journey">
        {v.stages.map((s, i) => (
          <span key={s} style={{ display: "contents" }}>
            {i > 0 && <i />}
            <span className={i < v.stage ? "past" : i === v.stage ? "on" : ""}>{i < v.stage ? "✓ " : ""}{s}</span>
          </span>
        ))}
      </div>

      {v.targetAmt != null && (
        <div className="pt-prog">
          <div className="row"><span>Profit target ({v.targetPct}%)</span><b>{inr(Math.max(0, v.profit))} of {inr(v.targetAmt)}</b></div>
          <Bar value={tgt} tone="brand" label="Profit target" />
        </div>
      )}
      {a.phase === "funded" && (
        <div className="pt-prog"><div className="row"><span>Profit this cycle</span><b>{inr(Math.max(0, v.profit))}</b></div></div>
      )}
      <div className="pt-limits">
        <div className="pt-prog"><div className="row"><span>Today’s loss limit</span><b>{inr(v.dailyUsed)} of {inr(v.dailyLimit)}</b></div><Bar value={(v.dailyUsed / v.dailyLimit) * 100} tone="risk" label="Daily loss" /></div>
        <div className="pt-prog"><div className="row"><span>Total loss limit</span><b>{inr(v.ddUsed)} of {inr(v.ddLimit)}</b></div><Bar value={(v.ddUsed / v.ddLimit) * 100} tone="risk" label="Total loss" /></div>
      </div>
      {(a.status === "breached" || (a.status === "closed" && a.breach_reason)) && (
        <p className="pt-why"><b>{a.breach_reason?.replace(/^Closed by admin:\s*/, "Closed by our team: ")}</b> <Link href={`/accounts/${a.id}`}>See why</Link> · <span lang="hi">कारण देखें</span></p>
      )}
      <div className="pt-af">
        {a.status === "active" && <Link className="pt-btn primary sm" href={`/terminal?account=${a.id}`}>Trade</Link>}
        <Link className="pt-btn sm" href={`/accounts/${a.id}`}>Details</Link>
      </div>
    </article>
  );
}
