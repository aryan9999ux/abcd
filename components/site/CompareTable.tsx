import type { Plan, PlanPrice } from "./types";
import { daysText, evaluationText, inr, sizeLabel, splitText, targetText } from "./format";

export default function CompareTable({ plans, prices }: { plans: Plan[]; prices: PlanPrice[] }) {
  if (!plans.length) return null;
  const startSize = Math.min(...prices.map((p) => p.account_size));
  const fee = (key: string) => prices.find((p) => p.plan_key === key && p.account_size === startSize)?.price_inr;
  const rows: [string, (p: Plan) => string, string?][] = [
    ["Evaluation", evaluationText],
    ["Profit target", targetText],
    ["Max daily loss", (p) => `${Number(p.max_daily_loss_pct)}%`],
    ["Max overall loss", (p) => `${Number(p.max_overall_loss_pct)}%`],
    ["Profitable days needed", daysText],
    ["Reward split", splitText, "up"],
    [`Starting fee, ${sizeLabel(startSize)} account`, (p) => (fee(p.key) != null ? inr(fee(p.key)!) : "-"), "mono"],
  ];
  return (
    <div className="scroll glass">
      <table>
        <thead>
          <tr>
            <th>Rule</th>
            {plans.map((p) => <th key={p.key}>{p.name}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, fn, cls]) => (
            <tr key={label}>
              <td>{label}</td>
              {plans.map((p) => <td key={p.key} className={cls}>{fn(p)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
