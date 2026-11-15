import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import DayStrip from "@/components/site/DayStrip";
import CompareTable from "@/components/site/CompareTable";
import Motion from "@/components/site/Motion";
import { CountUp } from "@/components/site/Num";
import PlansSection from "@/components/site/PlansSection";
import RewardCalc from "@/components/site/RewardCalc";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr } from "@/components/site/format";

export const revalidate = 60;

const ICONS = [
  <g key="a"><path d="M4 7h16M4 12h10M4 17h6" /></g>,
  <g key="b"><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></g>,
  <g key="c"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3.5" /></g>,
  <g key="d"><path d="M12 3v18M16.5 7.5C16 6 14.3 5 12 5S8 6.2 8 8s1.6 2.5 4 3 4 1.2 4 3-1.8 3-4 3-4-1-4.5-2.5" /></g>,
];

const FAQ: [string, string][] = [
  ["Is the account real money?", "No. Accounts use simulated capital on our own terminal. The fee you pay is a platform fee. Rewards are paid by Apex Capital Funded under the Terms."],
  ["Is Apex Capital Funded a broker?", "No. We do not execute orders on any exchange and we do not hold client securities. Check the Terms for the exact scope of the service."],
  ["Where do the prices come from?", "Every price in the terminal is a live NSE or BSE price: spot, futures and option premiums. Fills use those prices, and orders are only accepted while the market is open, Monday to Friday, 9:15 AM to 3:30 PM IST. Implied volatility and delta are calculated from the live premium."],
  ["What happens if I breach a limit?", "The account closes at the breach and you can start a new one. Limits are shown live on your dashboard and terminal."],
  ["Can I run more than one account?", "Yes. Buy as many accounts as you like from your dashboard and switch between them in the terminal."],
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
        <a className="pill-link" href="#plans">Instant, 1-Step and 2-Step accounts <span aria-hidden>›</span></a>
        <h1>Trade India&apos;s markets{" "}<br />with a funded account.</h1>
        <p className="lead">Pass the evaluation on live NSE and BSE prices, then keep {split}% of your rewards.</p>
        <div className="cta">
          <Link className="btn primary lg" href="/signup">{cheapest != null ? `Start from ${inr(cheapest)}` : "Get started"}</Link>
          <Link className="btn lg" href="/#terminal">See the terminal</Link>
        </div>
        <HeroPreview />
        <p className="note">
          Accounts are simulated and run on our own terminal. We are not a broker and do not give investment advice. Most participants do not earn rewards. Read the Risk Disclosure before you buy.
        </p>
      </section>

      <div className="facts three" data-reveal>
        <div><b>₹1L – ₹10L</b><span>Simulated account sizes</span></div>
        <div><b><CountUp to={split} suffix="%" /></b><span>Reward split</span></div>
        <div><b>Live</b><span>NSE / BSE prices</span></div>
      </div>

      <section className="blk" id="terminal">
        <div className="head" data-reveal>
          <h2>One screen for the whole trade</h2>
          <p>Watchlist, chart, option chain and order ticket sit together, and your limits are always in view.</p>
        </div>
        <div className="bento">
          <article className="glass tile t-chain spot" data-reveal>
            <h3>Real option chain</h3>
            <p>Every strike with live premiums, open interest, implied volatility and delta worked out from the premium.</p>
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
            <h3>Limits you can see</h3>
            <p>Daily loss, drawdown and profit target update with every tick, so a breach never comes as a surprise.</p>
            <div className="meters" aria-hidden>
              <div><span>Daily loss</span><i><b style={{ "--w": "34%" } as React.CSSProperties} /></i></div>
              <div><span>Drawdown</span><i><b style={{ "--w": "18%" } as React.CSSProperties} /></i></div>
              <div><span>Profit target</span><i className="g"><b style={{ "--w": "62%" } as React.CSSProperties} /></i></div>
            </div>
          </article>
          <article className="glass tile t-sl spot" data-reveal style={{ "--d": "160ms" } as React.CSSProperties}>
            <h3>Stop loss on every order</h3>
            <p>No stop loss, no order. It is the one rule that keeps accounts alive.</p>
            <div className="ticket" aria-hidden><div><span>Quantity</span><b>1 lot</b></div><div className="hl"><span>Stop loss</span><b>Required</b></div></div>
          </article>
          <article className="glass tile t-real spot" data-reveal style={{ "--d": "80ms" } as React.CSSProperties}>
            <h3>Only real prices</h3>
            <p>Spot, futures and option premiums come straight from the exchange feed. Nothing is simulated, so fills match the market.</p>
          </article>
          <article className="glass tile t-multi spot" data-reveal style={{ "--d": "160ms" } as React.CSSProperties}>
            <h3>Run several accounts</h3>
            <p>Buy as many accounts as you like and switch between them in the terminal.</p>
            <div className="stack" aria-hidden><i /><i /><i /></div>
          </article>
        </div>
      </section>

      <section className="blk" id="day">
        <div className="head" data-reveal>
          <h2>Your trading day, rule by rule</h2>
          <p>The same clock applies to every plan. Knowing it up front is most of the evaluation.</p>
        </div>
        <DayStrip minHold={60} cutoff="3:15 PM" />
      </section>

      <section className="blk" id="how">
        <div className="head" data-reveal>
          <h2>From evaluation to reward</h2>
          <p>Pick the path that suits you. Instant skips the evaluation and starts funded.</p>
        </div>
        <div className="path" data-reveal>
          <div className="stage glass">
            <h3>Evaluate</h3>
            <p>Reach the profit target without crossing the daily or overall loss limit, and close enough profitable days.</p>
            <ul><li>1-Step or 2-Step</li><li>Simulated ₹1L to ₹10L</li></ul>
          </div>
          <div className="link" aria-hidden><i /></div>
          <div className="stage glass">
            <h3>Get funded</h3>
            <p>Trade the same rules with no target. Your closed profit builds towards the next reward cycle.</p>
            <ul><li>Instant starts here</li><li>Stocks up to 5x</li></ul>
          </div>
          <div className="link" aria-hidden><i /></div>
          <div className="stage glass hot">
            <h3>Take your reward</h3>
            <p>Request a reward every cycle once the checks pass. You keep {split}% of closed profit.</p>
            <ul><li>{split}% to you</li><li>Fee returned on later rewards</li></ul>
          </div>
        </div>
      </section>

      <section className="blk" id="plans">
        <div className="head" data-reveal>
          <span className="eyebrow">Plans</span>
          <h2>Choose your account</h2>
          <p>One fee covers your simulated account and the terminal. Sample values until launch.</p>
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
            <span className="muted">Your share of simulated profit</span>
            <div className="big"><CountUp to={split} suffix="%" /></div>
            <p className="muted">Reward requests open on your dashboard once a funded account meets the payout checks. Timing and limits are set out in the Terms.</p>
          </div>
          <RewardCalc sizes={[...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b)} split={split} />
        </div>
      </section>

      <section className="blk" id="fit">
        <div className="head" data-reveal><h2>Is this for you?</h2><p>We would rather you know before you pay.</p></div>
        <div className="split">
          <div className="glass fit yes" data-reveal>
            <h3>A good fit if you</h3>
            <ul><li>trade Indian indices, stocks or options and use a stop loss anyway</li><li>want a fixed, known cost instead of risking your own capital</li><li>can work inside daily and overall loss limits</li></ul>
          </div>
          <div className="glass fit no" data-reveal style={{ "--d": "90ms" } as React.CSSProperties}>
            <h3>Not a fit if you</h3>
            <ul><li>expect a guaranteed reward. Most participants do not earn one</li><li>want to trade without a stop loss or hold through large swings</li><li>are looking for a broker or investment advice. We are neither</li></ul>
          </div>
        </div>
      </section>

      <section className="blk" id="faq">
        <div className="head"><span className="eyebrow">FAQ</span><h2>Before you buy</h2></div>
        <div className="glass" style={{ padding: "6px 24px" }} data-reveal>
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="glass cta-band" data-reveal>
          <div><h2>Ready to trade?</h2><p className="muted" style={{ marginTop: 8 }}>Create your account in a minute. Read the rules first on the <Link href="/rules" style={{ color: "var(--blue)" }}>rules page</Link>.</p></div>
          <Link className="btn primary lg" href="/signup">Create account</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
