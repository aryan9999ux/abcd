import { publicClient } from "@/lib/supabase/public";

export const revalidate = 60;

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

export default async function Home() {
  const db = publicClient();
  const [{ data: plans }, { data: prices }] = await Promise.all([
    db.from("plans").select("*").order("evaluation_phases"),
    db.from("plan_prices").select("*").order("account_size"),
  ]);

  return (
    <main className="wrap">
      <h1 style={{ fontSize: "2.6rem", margin: "0 0 12px" }}>Apex Capital Funded</h1>
      <p className="muted" style={{ maxWidth: 560 }}>
        Simulated funded accounts. Plans and prices below are read live from the database.
        Full site and terminal designs are in the prototype pages while they are ported.
      </p>
      <p>
        <a className="btn" href="/prototype/site.html">Site prototype</a>{" "}
        <a className="btn" href="/prototype/terminal.html">F&amp;O terminal prototype</a>
      </p>
      <div className="grid" style={{ marginTop: 28 }}>
        {(plans ?? []).map((p) => (
          <section className="glass" key={p.key}>
            <h2 style={{ marginTop: 0 }}>{p.name}</h2>
            <p className="muted">
              Target {p.phase1_target_pct ? p.phase1_target_pct + "%" : "none"} · daily loss {p.max_daily_loss_pct}% ·
              overall loss {p.max_overall_loss_pct}% · reward split {p.reward_split_pct}/{100 - p.reward_split_pct}
            </p>
            <ul className="mono" style={{ paddingLeft: 18 }}>
              {(prices ?? [])
                .filter((x) => x.plan_key === p.key)
                .map((x) => (
                  <li key={x.account_size}>
                    {inr(x.account_size)} account: {inr(x.price_inr)}
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 28 }}>
        Simulated trading accounts. Not a broker. Not investment advice. Most participants do not earn rewards.
      </p>
    </main>
  );
}
