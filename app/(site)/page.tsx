import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import CompareTable from "@/components/site/CompareTable";
import Motion from "@/components/site/Motion";
import { CountUp } from "@/components/site/Num";
import PlansSection from "@/components/site/PlansSection";
import SizePick from "@/components/site/SizePick";
import EdgeCalc from "@/components/site/EdgeCalc";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr, sizeLabel } from "@/components/site/format";

export const revalidate = 60;

const FAQ: [string, string][] = [
  ["How fast can I start?", "Now. Sign up, pick a plan and size, and your account and terminal are ready in minutes. Orders go through whenever the market is open — Monday to Friday, 9:15 AM to 3:30 PM IST."],
  ["What exactly am I buying?", "An evaluation account on our own terminal, running on simulated capital with live exchange prices. The fee is a one-time platform fee, and rewards are paid by Apex Capital Funded under the Terms."],
  ["Where do the prices come from?", "Every price is a live NSE or BSE price — spot, futures and option premiums. Fills use those prices, and implied volatility and delta are worked out from the live premium."],
  ["When do I get paid?", "Reward requests open on your dashboard once a funded account meets the payout checks in the Terms. You keep the 80% side of the split, and your fee comes back with rewards."],
  ["What happens if I breach a limit?", "The account closes at the breach. Your risk ends at the fee — you can start a fresh account whenever you want."],
  ["Is Apex Capital Funded a broker?", "No. We do not execute orders on any exchange and we do not hold client securities. The Terms set out the exact scope of the service."],
];

export default async function Home() {
  const db = publicClient();
  const [{ data: plansRaw }, { data: pricesRaw }] = await Promise.all([
    db.from("plans").select("*").order("evaluation_phases", { ascending: false }),
    db.from("plan_prices").select("*").order("account_size"),
  ]);
  const plans = (plansRaw ?? []) as Plan[];
  const prices = ((pricesRaw ?? []) as PlanPrice[]).map((p) => ({ ...p, account_size: Number(p.account_size), price_inr: Number(p.price_inr) }));
  const split = plans[0] ? Number(plans[0].reward_split_pct) : 80;
  const cheapest = prices.length ? Math.min(...prices.map((p) => p.price_inr)) : null;
  const orderedPlans = [...plans].sort((a, b) => a.evaluation_phases - b.evaluation_phases);
  const sizes = [...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b);
  const minFee: Record<number, number | null> = {};
  for (const s of sizes) {
    const f = prices.filter((p) => p.account_size === s).map((p) => p.price_inr);
    minFee[s] = f.length ? Math.min(...f) : null;
  }
  const topSize = sizes[sizes.length - 1] ?? 1000000;

  return (
    <main className="wrap view">
      <Motion />
      <div className="herobg" aria-hidden />

      <section className="hero-y">
        <div className="hy-copy">
          <a className="pill-link" href="#plans">Live for NIFTY, BANKNIFTY, SENSEX &amp; NSE stocks <span aria-hidden>›</span></a>
          <h1>Trade big.<br />Risk small.</h1>
          <p className="lead">
            Up to {sizeLabel(topSize)} in buying power on live NSE and BSE prices. Keep {split}% of every profit you make. Your downside stops at the fee.
          </p>
          <SizePick sizes={sizes} fees={minFee} />
          <div className="cta">
            <Link className="btn primary lg" href="/signup">Claim my account</Link>
            <Link className="btn lg" href="/#terminal">See the terminal</Link>
          </div>
        </div>
        <div className="hy-vis">
          <HeroPreview />
        </div>
      </section>

      <div className="statband" data-reveal>
        <div><b><CountUp to={split} suffix="%" /></b><span>of profits are yours</span></div>
        <div><b>5x</b><span>buying power on stocks</span></div>
        <div><b>{cheapest != null ? inr(cheapest) : "—"}</b><span>is all it takes to start</span></div>
        <div><b>{sizeLabel(topSize)}</b><span>top account size</span></div>
      </div>

      <section className="blk" id="edge">
        <div className="head" data-reveal>
          <h2>Same skill. Different league.</h2>
          <p>Most traders are not short of skill. They are short of size. That is the only thing we change.</p>
        </div>
        <div className="duel" data-reveal>
          <div className="glass dside">
            <span className="dcap">Going alone</span>
            <h3>Grind your own ₹1L</h3>
            <ul>
              <li>Months to save it, one bad week to lose it</li>
              <li>Every loss comes out of your family&apos;s money</li>
              <li>A 2% month pays for a dinner</li>
            </ul>
          </div>
          <div className="vs" aria-hidden>vs</div>
          <div className="glass dside win">
            <span className="dcap gold">Funded here</span>
            <h3>Command up to {sizeLabel(topSize)}</h3>
            <ul>
              <li>Start tonight from {cheapest != null ? inr(cheapest) : "a one-time fee"}</li>
              <li>Worst case, ever: the fee. Your savings never enter the game</li>
              <li>The same 2% month puts {inr(((topSize * 2) / 100) * (split / 100))} in your pocket</li>
            </ul>
          </div>
        </div>
        <EdgeCalc size={topSize} fee={minFee[topSize] ?? null} split={split} />
      </section>

      <section className="blk" id="terminal">
        <div className="head" data-reveal>
          <h2>A terminal built to keep you funded</h2>
          <p>Live chart, full option chain and your limits on one screen — so you always know where you stand.</p>
        </div>
        <div className="bento">
          <article className="glass tile t-chain spot" data-reveal>
            <h3>The full F&amp;O desk</h3>
            <p>Every strike, live premiums, open interest, IV and delta — straight from the exchange feed, tick by tick.</p>
            <div className="mini-chain" aria-hidden>
              {[62, 48, 36, 25, 17, 11, 7].map((w, i) => (
                <div key={i} className={i === 3 ? "atm" : ""}>
                  <span style={{ width: `${w}%` }} className="ce" />
                  <em />
                  <span style={{ width: `${[7, 11, 17, 25, 36, 48, 62][i]}%` }} className="pe" />
                </div>
              ))}
            </div>
          </article>
          <article className="glass tile t-risk spot" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
            <h3>Limits that guard you</h3>
            <p>Daily loss, drawdown and target move with every tick. The risk guard caps each trade, so one red day can&apos;t take you out of the game.</p>
            <div className="meters" aria-hidden>
              <div><span>Daily loss</span><i><b style={{ "--w": "34%" } as React.CSSProperties} /></i></div>
              <div><span>Drawdown</span><i><b style={{ "--w": "18%" } as React.CSSProperties} /></i></div>
              <div><span>Profit target</span><i className="g"><b style={{ "--w": "62%" } as React.CSSProperties} /></i></div>
            </div>
          </article>
          <article className="glass tile t-multi spot" data-reveal style={{ "--d": "160ms" } as React.CSSProperties}>
            <h3>Stack accounts</h3>
            <p>Run several accounts at once and switch between them in one click.</p>
            <div className="stack" aria-hidden><i /><i /><i /></div>
          </article>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="head" data-reveal>
          <h2>Three steps to your first payout</h2>
          <p>Instant accounts skip straight to step two.</p>
        </div>
        <div className="steps3">
          {[
            ["01", "Pass the evaluation", "Hit the profit target inside the limits. One step or two — your choice of plan."],
            ["02", "Get funded", "Same terminal, no target. Every closed profit builds toward your payout cycle."],
            ["03", "Take your payout", `You keep ${split}% of the profit, and your fee comes back with rewards.`],
          ].map(([n, t, d], i) => (
            <div className={`glass st3 spot${i === 2 ? " gold" : ""}`} key={n} data-reveal style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
              <span className="n mono">{n}</span>
              <h3>{t}</h3>
              <p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="blk" id="plans">
        <div className="head" data-reveal>
          <span className="eyebrow">Plans</span>
          <h2>Your account is waiting</h2>
          <p>One fee. No subscription, no hidden cuts. Sample values until launch.</p>
        </div>
        <PlansSection plans={orderedPlans} prices={prices} />
        <div style={{ marginTop: 28 }} data-reveal><CompareTable plans={orderedPlans} prices={prices} /></div>
      </section>

      <section className="blk" id="faq">
        <div className="head"><span className="eyebrow">FAQ</span><h2>Straight answers</h2></div>
        <div className="glass" style={{ padding: "6px 24px" }} data-reveal>
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="glass cta-band" data-reveal>
          <div>
            <h2>The market opens at 9:15.</h2>
            <p className="muted" style={{ marginTop: 8 }}>Have your account ready before it does. Rules are one page, in plain words — <Link href="/rules" style={{ color: "var(--blue)" }}>read them here</Link>.</p>
          </div>
          <Link className="btn primary lg" href="/signup">Claim my account</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
