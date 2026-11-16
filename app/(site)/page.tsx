import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import CompareTable from "@/components/site/CompareTable";
import Motion from "@/components/site/Motion";
import { CountUp } from "@/components/site/Num";
import PlansSection from "@/components/site/PlansSection";
import RewardCalc from "@/components/site/RewardCalc";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr, sizeLabel } from "@/components/site/format";

export const revalidate = 60;

const ICONS = [
  <g key="a"><path d="M4 7h16M4 12h10M4 17h6" /></g>,
  <g key="b"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></g>,
  <g key="c"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></g>,
  <g key="d"><path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5S8 6.2 8 8s1.6 2.5 4 3 4 1.2 4 3-1.8 3-4 3-4-1-4.5-2.5" /></g>,
];

const FAQ: [string, string][] = [
  ["How fast can I start?", "Now. Sign up, pick a plan and size, and your account and terminal are ready in minutes. Orders go through whenever the market is open, Monday to Friday, 9:15 AM to 3:30 PM IST."],
  ["What exactly am I buying?", "An evaluation account on our own terminal, trading live exchange prices. The fee is a one-time platform fee, and rewards are paid by Apex Capital Funded under the Terms."],
  ["Where do the prices come from?", "Every price is a live NSE or BSE price: spot, futures and option premiums. Fills use those prices, and implied volatility and delta are worked out from the live premium."],
  ["When do I get paid?", "Reward requests open on your dashboard once a funded account meets the payout checks in the Terms. You keep the 80% side of the split."],
  ["What happens if I breach a limit?", "The account closes at the breach. Your risk ends at the fee, and you can start a fresh account whenever you want."],
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

  return (
    <main className="wrap view">
      <Motion />
      <div className="herobg" aria-hidden />
      <section className="hero hero-x">
        <a className="pill-link" href="#plans">Live for NIFTY, BANKNIFTY, SENSEX and NSE stocks <span aria-hidden>›</span></a>
        <h1>Trade big.{" "}<br />Risk small.</h1>
        <p className="lead">Up to {sizeLabel(Math.max(...prices.map((p) => p.account_size), 1000000))} in buying power on live NSE and BSE prices. Keep {split}% of every profit you make. Your downside stops at the fee.</p>
        <div className="cta">
          <Link className="btn primary lg" href="/signup">Claim my account</Link>
          <Link className="btn lg" href="/#terminal">See the terminal</Link>
        </div>
        <HeroPreview />
        <p className="note">Terms and Risk Disclosure apply. Rewards follow the payout checks in the Terms.</p>
      </section>

      <div className="facts" data-reveal style={{ gridTemplateColumns: "repeat(4, 1fr)" }}>
        <div><b><CountUp to={split} suffix="%" /></b><span>of profits are yours</span></div>
        <div><b>5x</b><span>buying power on stocks</span></div>
        <div><b>{cheapest != null ? inr(cheapest) : "—"}</b><span>is all it takes to start</span></div>
        <div><b>{sizeLabel(Math.max(...prices.map((p) => p.account_size), 1000000))}</b><span>top account size</span></div>
      </div>

      <section className="blk" id="edge">
        <div className="head" data-reveal>
          <h2>Same skill. Different league.</h2>
          <p>Most traders are not short of skill. They are short of size. That is the only thing we change.</p>
        </div>
        <div className="split">
          <div className="glass fit no" data-reveal>
            <h3>Going alone with your own ₹1L</h3>
            <ul><li>Months to save it, one bad week to lose it</li><li>Every loss comes out of your family&apos;s money</li><li>A 2% month pays for a dinner</li></ul>
          </div>
          <div className="glass fit yes" data-reveal style={{ "--d": "90ms" } as React.CSSProperties}>
            <h3>Funded here, up to {sizeLabel(Math.max(...prices.map((p) => p.account_size), 1000000))}</h3>
            <ul><li>Start tonight from {cheapest != null ? inr(cheapest) : "a one-time fee"}</li><li>Worst case, ever: the fee. Your savings never enter the game</li><li>The same 2% month puts {inr(((Math.max(...prices.map((p) => p.account_size), 1000000) * 2) / 100) * (split / 100))} in your pocket</li></ul>
          </div>
        </div>
      </section>

      <section className="blk" id="terminal">
        <div className="head" data-reveal>
          <h2>A terminal built to keep you funded</h2>
          <p>Live chart, full option chain and your limits on one screen, so you always know where you stand.</p>
        </div>
        <div className="bento">
          <article className="glass tile t-chain spot" data-reveal>
            <h3>The full F&amp;O desk</h3>
            <p>Every strike, live premiums, open interest, IV and delta, straight from the exchange feed tick by tick.</p>
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
            <p>Daily loss, drawdown and target move with every tick, so one red day cannot take you out of the game.</p>
            <div className="meters" aria-hidden>
              <div><span>Daily loss</span><i><b style={{ "--w": "34%" } as React.CSSProperties} /></i></div>
              <div><span>Drawdown</span><i><b style={{ "--w": "18%" } as React.CSSProperties} /></i></div>
              <div><span>Profit target</span><i className="g"><b style={{ "--w": "62%" } as React.CSSProperties} /></i></div>
            </div>
          </article>
          <article className="glass tile t-sl spot" data-reveal style={{ "--d": "160ms" } as React.CSSProperties}>
            <h3>Risk guard built in</h3>
            <p>Every trade is protected before it goes live, so you can trade with confidence.</p>
            <div className="ticket" aria-hidden><div><span>Quantity</span><b>1 lot</b></div><div className="hl"><span>Risk guard</span><b>On</b></div></div>
          </article>
          <article className="glass tile t-real spot" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
            <h3>Only real prices</h3>
            <p>Spot, futures and option premiums come straight from the exchange feed, so your fills match the market.</p>
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
        <div className="path" data-reveal>
          <div className="stage glass">
            <h3>Pass the evaluation</h3>
            <p>Hit the profit target inside the limits. One step or two, your choice of plan.</p>
            <ul><li>1-Step or 2-Step</li><li>Accounts from ₹1L to ₹10L</li></ul>
          </div>
          <div className="link" aria-hidden><i /></div>
          <div className="stage glass">
            <h3>Get funded</h3>
            <p>Same terminal, no target. Every closed profit builds toward your payout cycle.</p>
            <ul><li>Instant starts here</li><li>Stocks up to 5x</li></ul>
          </div>
          <div className="link" aria-hidden><i /></div>
          <div className="stage glass hot">
            <h3>Take your payout</h3>
            <p>You keep {split}% of the profit, and your fee comes back with rewards.</p>
            <ul><li>{split}% to you</li><li>Fee returned on later rewards</li></ul>
          </div>
        </div>
      </section>

      <section className="blk" id="plans">
        <div className="head" data-reveal>
          <span className="eyebrow">Plans</span>
          <h2>Your account is waiting</h2>
          <p>One fee. No subscription, no hidden cuts.</p>
        </div>
        <PlansSection plans={orderedPlans} prices={prices} />
        <div style={{ marginTop: 28 }} data-reveal><CompareTable plans={orderedPlans} prices={prices} /></div>
      </section>

      <section className="blk" id="rewards">
        <div className="head" data-reveal><span className="eyebrow">Rewards</span><h2>You keep the larger share</h2></div>
        <div className="split">
          <div className="glass reward spot" data-reveal>
            <svg className="curve" viewBox="0 0 400 140" preserveAspectRatio="none" aria-hidden>
              <defs><linearGradient id="cg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--accent)" stopOpacity=".28" /><stop offset="1" stopColor="var(--accent)" stopOpacity="0" /></linearGradient></defs>
              <path className="f" d="M0 120 40 104 80 112 130 82 170 90 220 56 260 66 310 30 360 38 400 12 V140 H0Z" />
              <path className="l" pathLength={1} d="M0 120 40 104 80 112 130 82 170 90 220 56 260 66 310 30 360 38 400 12" />
            </svg>
            <span className="muted">Your share of every profit</span>
            <div className="big"><CountUp to={split} suffix="%" /></div>
            <p className="muted">Reward requests open on your dashboard once a funded account meets the payout checks. Timing and limits are set out in the Terms.</p>
          </div>
          <RewardCalc sizes={[...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b)} split={split} />
        </div>
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
          <div><h2>The market opens at 9:15.</h2><p className="muted" style={{ marginTop: 8 }}>Have your account ready before it does. Rules are one page, in plain words: <Link href="/rules" style={{ color: "var(--blue)" }}>read them here</Link>.</p></div>
          <Link className="btn primary lg" href="/signup">Claim my account</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
