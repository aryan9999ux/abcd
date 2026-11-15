"use client";
import { useState } from "react";

export type RulesPlan = { key: string; name: string; version: string; tiles: [string, string][]; groups: { title: string; note: string; items: [string, string][] }[] };

/** One plan at a time: headline limits first, then the full rulebook in four groups. */
export default function RulesView({ plans }: { plans: RulesPlan[] }) {
  const [key, setKey] = useState(plans[0]?.key);
  const p = plans.find((x) => x.key === key) ?? plans[0];
  if (!p) return null;
  return (
    <>
      <div className="sizebar" role="tablist" aria-label="Plan" style={{ marginTop: 28 }}>
        {plans.map((x) => (
          <button key={x.key} role="tab" aria-selected={x.key === p.key} aria-pressed={x.key === p.key} onClick={() => setKey(x.key)}>{x.name}</button>
        ))}
      </div>
      <div key={p.key} className="rv-panel">
        <div className="rtiles">
          {p.tiles.map(([k, v]) => (<div key={k} className="glass"><span>{k}</span><b>{v}</b></div>))}
        </div>
        <div className="rgroups">
          {[[0, 1, 3], [2]].map((col, ci) => (
            <div key={ci} className="rcol">
              {col.map((gi) => p.groups[gi]).filter(Boolean).map((g) => (
                <section key={g.title} className="glass rgroup">
                  <h3>{g.title}</h3>
                  <p className="muted">{g.note}</p>
                  <dl>
                    {g.items.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
                  </dl>
                </section>
              ))}
            </div>
          ))}
        </div>
        <p className="muted rver">Rules version {p.version}. Changes are announced in advance and do not apply to accounts already running.</p>
      </div>
    </>
  );
}
