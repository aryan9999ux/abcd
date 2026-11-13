import Link from "next/link";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import PlansSection from "@/components/site/PlansSection";
import CompareTable from "@/components/site/CompareTable";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr } from "@/components/site/format";

export const revalidate = 60;

const FAQ: [string, string][] = [
  ["Is the account real money?", "No. Accounts use simulated capital on our own terminal. The fee you pay is a platform fee. Rewards are paid by Apex Capital Funded under the Terms."],
  ["Is Apex Capital Funded a broker?", "No. We do not execute orders on any exchange and we do not hold client securities. Check the Terms for the exact scope of the service."],
  ["Where do the prices come from?", "The terminal shows market prices from a data provider. Until a licensed feed is connected, the preview uses demo prices."],
  ["What happens if I breach a limit?", "The account closes at the breach and you can start a new one. Limits are shown live on your dashboard and terminal."],
  ["Can I run more than one account?", "Yes. Buy as many accounts as you like from your dashboard and switch between them in the terminal."],
];

const TRUST: [string, string][] = [
  ["Verified reward payouts", "Reward payment records with dates and amounts. No payout figure is shown until real payouts exist."],
  ["Company details", "Registered company name, CIN, GSTIN and registered address."],
  ["Published rulebook", "One page with every rule, limit and the payout schedule, versioned with dates."],
  ["Support and grievance contact", "Support email, response-time promise and a named grievance officer."],
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
      <section className="hero">
        <div>
          <span className="pill gold">Simulated funded accounts for Indian markets</span>
          <h1 style={{ marginTop: 18 }}>
            Trade a funded account. <span className="hl">Keep {split}%</span> of the rewards you earn.
          </h1>
          <p className="lead">
            Pick an account size, trade on a professional terminal with simulated capital, hit the targets and earn rewards under clear, published rules.
          </p>
          <div className="cta">
            <Link className="btn primary" href="/signup">{cheapest != null ? `Start from ${inr(cheapest)}` : "Get started"}</Link>
            <Link className="btn" href="/#plans">Compare plans</Link>
          </div>
          <p className="note">
            Accounts are simulated and run on our own trading terminal. Apex Capital Funded is not a broker and does not give investment advice. Most participants do not earn rewards. Read the Risk Disclosure before you buy.
          </p>
        </div>
        <HeroPreview />
      </section>

      <section className="blk" id="how">
        <div className="head"><span className="eyebrow">How it works</span><h2>From sign-up to rewards in four steps</h2></div>
        <div className="steps">
          {[
            ["Choose your plan", "Instant, 1-Step or 2-Step, from a ₹1 lakh to a ₹10 lakh simulated account."],
            ["Trade the terminal", "Orders, positions and risk meters on the same screen. Rules are tracked live on your dashboard."],
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
          <h2>One platform fee. No hidden charges.</h2>
          <p>The fee covers your simulated account and terminal access. Prices and rules shown here are sample values and will be finalised before launch.</p>
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
            <p className="muted">Reward requests open on your dashboard once your funded account meets the minimum trading days. Payout timing and limits are set out in the Terms.</p>
          </div>
          <div className="glass calc">
            <span className="eyebrow">Example</span>
            <div className="ln"><span className="muted">Funded account</span><b className="mono">₹1,00,000</b></div>
            <div className="ln"><span className="muted">Simulated profit</span><b className="mono up">₹10,000</b></div>
            <div className="ln"><span className="muted">Your {split}%</span><b className="mono">{inr(10000 * split / 100)}</b></div>
            <div className="ln"><span className="muted">Firm {100 - split}%</span><b className="mono">{inr(10000 * (100 - split) / 100)}</b></div>
            <p className="muted" style={{ fontSize: ".78rem" }}>Illustration only. It is not a forecast of what you will earn.</p>
          </div>
        </div>
      </section>

      <section className="blk">
        <div className="head">
          <span className="eyebrow">Trust</span>
          <h2>What you can check before you buy</h2>
          <p>These slots hold real, verifiable records. Fill each one in before launch.</p>
        </div>
        <div className="trust">
          {TRUST.map(([t, d]) => (
            <div className="glass" key={t}><span className="pill warn">To add</span><h3>{t}</h3><p>{d}</p></div>
          ))}
        </div>
      </section>

      <section className="blk" id="faq">
        <div className="head"><span className="eyebrow">FAQ</span><h2>Straight answers</h2></div>
        <div className="glass" style={{ padding: "8px 24px" }}>
          {FAQ.map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </section>

      <Footer />
    </main>
  );
}
