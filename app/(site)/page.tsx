import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
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
      <section className="hero">
        <div>
          <span className="eyebrow">Simulated funded accounts</span>
          <h1>Trade India&apos;s markets with a funded account.</h1>
          <p className="lead">Pass the evaluation on live NSE and BSE prices, then keep {split}% of your rewards.</p>
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

      <div className="ticker" aria-hidden>
        <div className="run">
          {[0, 1].map((k) => (
            <div key={k} style={{ display: "flex", gap: 40 }}>
              {["NIFTY 50", "BANK NIFTY", "SENSEX", "FINNIFTY", "OPTION CHAIN", "STOP LOSS ON EVERY TRADE", "5X ON STOCKS", "LIVE NSE / BSE PRICES", "RELIANCE", "HDFC BANK", "TCS", "INFOSYS"].map((t) => <span key={t}>{t}</span>)}
            </div>
          ))}
        </div>
      </div>

      <div className="facts three" data-reveal>
        <div><b>₹1L – ₹10L</b><span>Simulated account sizes</span></div>
        <div><b><CountUp to={split} suffix="%" /></b><span>Reward split</span></div>
        <div><b>Live</b><span>NSE / BSE prices</span></div>
      </div>

      <section className="blk" id="how">
        <div className="head" data-reveal><span className="eyebrow">How it works</span><h2>Four steps to your first reward</h2></div>
        <div className="steps">
          {[
            ["Choose your plan", "Instant, 1-Step or 2-Step, on a ₹1 lakh to ₹10 lakh simulated account."],
            ["Trade the terminal", "Watchlist, charts, option chain and orders on one screen, with your rules tracked live."],
            ["Hit the targets", "Reach the profit target while staying inside the daily and overall loss limits."],
            ["Receive rewards", `Earn ${split}% of the profit on a funded account, paid on the published schedule.`],
          ].map(([t, d], i) => (
            <div className="glass step spot" key={t} data-reveal style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
              <span className="sic"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg></span>
              <span className="num">0{i + 1}</span>
              <h3>{t}</h3><p>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="blk" id="plans">
        <div className="head" data-reveal>
          <span className="eyebrow">Plans</span>
          <h2>Choose your account</h2>
          <p>One fee covers your simulated account and the terminal. Sample values until launch.</p>
        </div>
        <PlansSection plans={orderedPlans} prices={prices} />
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
