import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import PlansSection from "@/components/site/PlansSection";
import CompareTable from "@/components/site/CompareTable";
import RewardCalc from "@/components/site/RewardCalc";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr } from "@/components/site/format";

export const revalidate = 60;

const FAQ: [string, string][] = [
  ["Is the account real money?", "No. Accounts use simulated capital on our own terminal. The fee you pay is a platform fee. Rewards are paid by Apex Capital Funded under the Terms."],
  ["Is Apex Capital Funded a broker?", "No. We do not execute orders on any exchange and we do not hold client securities. Check the Terms for the exact scope of the service."],
  ["Where do the prices come from?", "Every price in the terminal is a live NSE or BSE price: spot, futures and option premiums. Fills use those prices, and orders are only accepted while the market is open, Monday to Friday, 9:15 AM to 3:30 PM IST. Implied volatility and delta are calculated from the live premium."],
  ["What happens if I breach a limit?", "The account closes at the breach and you can start a new one. Limits are shown live on your dashboard and terminal."],
  ["Can I run more than one account?", "Yes. Buy as many accounts as you like from your dashboard and switch between them in the terminal."],
];

const EDGE: [string, string, string][] = [
  ["◎", "Live NSE and BSE prices", "Spot, futures and option premiums come straight from the exchange feed. Fills happen at those prices during market hours."],
  ["▤", "A published rulebook", "Every limit, payout gate and fee rule is on one page, generated from the same settings the engine enforces."],
  ["◧", "Risk meters on every screen", "Daily loss, drawdown floor, open positions and profitable days update live, so no rule ever surprises you."],
  ["✓", "A stop loss on every trade", "Orders without a stop loss are blocked. It keeps risk visible before you click, and keeps accounts alive longer."],
];

const TICKER = ["NIFTY 50", "BANK NIFTY", "SENSEX", "RELIANCE", "TCS", "HDFC BANK", "INFOSYS", "SBI", "OPTIONS CHAIN", "FUTURES", "INTRADAY 5×", "STOP LOSS ON EVERY TRADE"];

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
      <section className="hero">
        <div>
          <span className="pill gold">Simulated funded accounts · NSE &amp; BSE</span>
          <h1>Trade Nifty, Bank Nifty and stocks. <span className="hl">Keep {split}%</span> of your rewards.</h1>
          <p className="lead">
            Pick an account size, trade a professional F&amp;O terminal on live exchange prices, hit the target inside clear rules, and earn rewards on a funded account.
          </p>
          <div className="cta">
            <Link className="btn primary lg" href="/signup">{cheapest != null ? `Start from ${inr(cheapest)}` : "Get started"}</Link>
            <Link className="btn lg" href="/#plans">See plans</Link>
          </div>
          <p className="note">
            Accounts are simulated and run on our own terminal. We are not a broker and do not give investment advice. Most participants do not earn rewards. Read the Risk Disclosure before you buy.
          </p>
        </div>
        <HeroPreview />
      </section>

      <div className="facts">
        <div><b>₹1L – ₹10L</b><span>Simulated account sizes</span></div>
        <div><b>{split}%</b><span>Reward split</span></div>
        <div><b>Live</b><span>NSE / BSE prices</span></div>
        <div><b>3 plans</b><span>Instant, 1-Step, 2-Step</span></div>
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="run">{[...TICKER, ...TICKER].map((t, i) => <span key={i}>{t}</span>)}</div>
      </div>

      <section className="blk" id="how">
        <div className="head"><span className="eyebrow">How it works</span><h2>From sign-up to rewards in four steps</h2></div>
        <div className="steps">
          {[
            ["Choose your plan", "Instant, 1-Step or 2-Step, on a ₹1 lakh to ₹10 lakh simulated account."],
            ["Trade the terminal", "Watchlist, charts, option chain and orders on one screen, with your rules tracked live."],
            ["Hit the targets", "Reach the profit target while staying inside the daily and overall loss limits."],
            ["Receive rewards", `Earn ${split}% of the profit on a funded account, paid on the published schedule.`],
          ].map(([t, d]) => (
            <div className="glass step" key={t}><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="blk" id="plans">
        <div className="head">
          <span className="eyebrow">Plans</span>
          <h2>Choose your account size</h2>
          <p>One platform fee covers your simulated account and terminal access. Fees and rules shown are sample values until launch.</p>
        </div>
        <PlansSection plans={orderedPlans} prices={prices} />
      </section>

      <section className="blk">
        <div className="head"><span className="eyebrow">Compare</span><h2>Every plan at a glance</h2></div>
        <CompareTable plans={orderedPlans} prices={prices} />
      </section>

      <section className="blk" id="rewards">
        <div className="head"><span className="eyebrow">Rewards</span><h2>You keep the larger share</h2></div>
        <div className="split">
          <div className="glass reward">
            <span className="muted">Your share of simulated profit</span>
            <div className="big">{split}%</div>
            <p className="muted">Reward requests open on your dashboard once a funded account meets the payout checks. Timing and limits are set out in the Terms.</p>
          </div>
          <RewardCalc sizes={[...new Set(prices.map((p) => p.account_size))].sort((a, b) => a - b)} split={split} />
        </div>
      </section>

      <section className="blk">
        <div className="head"><span className="eyebrow">Why traders pick us</span><h2>Built to be checked, not just believed</h2></div>
        <div className="trust">
          {EDGE.map(([i, t, d]) => (
            <div className="glass" key={t}><span className="ic" aria-hidden="true">{i}</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="blk" id="faq">
        <div className="head"><span className="eyebrow">FAQ</span><h2>Straight answers</h2></div>
        <div className="glass" style={{ padding: "6px 24px" }}>
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <section className="blk" style={{ paddingTop: 0 }}>
        <div className="glass cta-band">
          <div><h2>Ready to trade?</h2><p className="muted" style={{ marginTop: 8 }}>Create your account in a minute. Read the rules first on the <Link href="/rules" style={{ color: "var(--blue)" }}>rules page</Link>.</p></div>
          <Link className="btn primary lg" href="/signup">Create account</Link>
        </div>
      </section>

      <Footer />
    </main>
  );
}
