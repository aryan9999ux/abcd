import Link from "next/link";
import "@fontsource/instrument-serif/400.css";
import "./lux.css";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import Motion from "@/components/site/Motion";
import GoldCard from "@/components/lux/GoldCard";
import Scrub from "@/components/lux/Scrub";
import Tiers from "@/components/lux/Tiers";
import Countdown from "@/components/lux/Countdown";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr, sizeLabel } from "@/components/site/format";

export const revalidate = 60;

const FAQ: [string, string][] = [
  ["How fast can I start?", "Now. Sign up, pick a card and a size, and your account and terminal are ready in minutes. Orders go through whenever the market is open, Monday to Friday, 9:15 AM to 3:30 PM IST."],
  ["What exactly am I buying?", "An evaluation account on our own terminal, trading live exchange prices. The fee is a one-time platform fee, and rewards are paid by Apex Capital Funded under the Terms."],
  ["Where do the prices come from?", "Every price is a live NSE or BSE price: spot, futures and option premiums. Fills use those prices, and implied volatility and delta are worked out from the live premium."],
  ["When do I get paid?", "Reward requests open on your dashboard once a funded account meets the payout checks in the Terms. You keep the 80% side of the split."],
  ["What happens if I breach a limit?", "The account closes at the breach. Your risk ends at the fee, and you can start a fresh account whenever you want."],
  ["Is Apex Capital Funded a broker?", "No. We do not execute orders on any exchange and we do not hold client securities. The Terms set out the exact scope of the service."],
];
const TAPE = ["NIFTY 50", "BANK NIFTY", "SENSEX", "FINNIFTY", "RELIANCE", "HDFC BANK", "TCS", "INFOSYS", "ICICI BANK", "SBIN", "OPTION CHAIN", "FUTURES", "STOCKS AT 5X"];

export default async function Home() {
  const db = publicClient();
  const [{ data: plansRaw }, { data: pricesRaw }] = await Promise.all([
    db.from("plans").select("*").order("evaluation_phases", { ascending: false }),
    db.from("plan_prices").select("*").order("account_size"),
  ]);
  const plans = (plansRaw ?? []) as Plan[];
  const prices = ((pricesRaw ?? []) as PlanPrice[]).map((p) => ({ ...p, account_size: Number(p.account_size), price_inr: Number(p.price_inr) }));
  const split = plans[0] ? Number(plans[0].reward_split_pct) : 80;
  const cheapest = prices.length ? Math.min(...prices.map((p) => p.price_inr)) : 1999;
  const topSize = prices.length ? Math.max(...prices.map((p) => p.account_size)) : 1000000;
  const orderedPlans = [...plans].sort((a, b) => a.evaluation_phases - b.evaluation_phases);
  const ownCap = 100000;
  const alone = ownCap * 0.02;
  const funded = topSize * 0.02 * (split / 100);
  const mult = Math.max(1, Math.round(funded / alone));

  return (
    <main className="lux wrap view">
      <Motion />

      <section className="lx-hero">
        <div className="lx-copy">
          <span className="lx-pill"><Countdown /></span>
          <h1>Their capital.<br />Your profit.</h1>
          <p className="lead">
            Trade up to {sizeLabel(topSize)} on live NSE and BSE prices and keep {split}% of every profit. If a trade goes wrong, you lose the fee. Nothing more.
          </p>
          <div className="lx-cta">
            <Link className="btn primary lg" href="/signup">Claim my account</Link>
            <Link className="btn lg" href="/#plans">See the cards</Link>
          </div>
          <ul className="lx-trust">
            <li><b>{split}%</b> of profit is yours</li>
            <li><b>{inr(cheapest)}</b> to start</li>
            <li><b>Live</b> NSE and BSE prices</li>
          </ul>
        </div>
        <div className="lx-fan" aria-hidden>
          <div className="c c1"><GoldCard tier="titanium" size={sizeLabel(topSize / 2)} name="2-Step" num="2028" /></div>
          <div className="c c2"><GoldCard tier="black" size={sizeLabel(topSize)} name="Instant" num="2027" /></div>
          <div className="c c3"><GoldCard tier="gold" size={sizeLabel(topSize)} name="1-Step" num="2026" /></div>
        </div>
      </section>

      <div className="lx-tape" aria-hidden>
        <div className="run">
          {[0, 1].map((k) => (<div key={k}>{TAPE.map((t) => <span key={t}>{t}</span>)}</div>))}
        </div>
      </div>

      <Scrub fee={inr(cheapest)} top={sizeLabel(topSize)} split={split} />

      <section className="blk" id="edge">
        <div className="lx-head" data-reveal>
          <h2>Same trade. {mult}× the payout.</h2>
          <p>A 2% month on your own {sizeLabel(ownCap)} pays {inr(alone)}. The same 2% on a {sizeLabel(topSize)} account pays {inr(funded)} to you. The skill never changed. The size did.</p>
        </div>
        <div className="lx-bars" data-reveal>
          <div className="row">
            <span>Your own {sizeLabel(ownCap)}</span>
            <div className="bar"><i style={{ "--w": `${100 / mult}%` } as React.CSSProperties} /></div>
            <b>{inr(alone)}</b>
          </div>
          <div className="row win">
            <span>{sizeLabel(topSize)} funded</span>
            <div className="bar"><i style={{ "--w": "100%" } as React.CSSProperties} /></div>
            <b>{inr(funded)}</b>
          </div>
          <p className="muted">Example arithmetic for a 2% month at your {split}% share. It is not a promise of profit.</p>
        </div>
      </section>

      <section className="blk" id="terminal">
        <div className="desk">
          <div className="lx-head left" data-reveal>
            <h2>A desk built for serious size</h2>
            <p>One screen for the whole trade. Live chart, the full option chain and your limits side by side, so you always know where you stand.</p>
            <ul className="lx-list">
              <li><b>The full F&amp;O desk</b><span>Every strike with live premiums, open interest, IV and delta.</span></li>
              <li><b>Limits that guard you</b><span>Daily loss and drawdown move with every tick. One red day cannot end your run.</span></li>
              <li><b>Stack accounts</b><span>Run several accounts and switch in one click.</span></li>
            </ul>
          </div>
          <div className="deskvis" data-reveal><HeroPreview /></div>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="lx-head" data-reveal>
          <h2>Your road to the first payout</h2>
          <p>Instant cards skip straight to step two.</p>
        </div>
        <ol className="lx-road" data-reveal>
          <li><span className="n">1</span><h3>Pass the evaluation</h3><p>Hit the profit target inside the limits. One step or two, your choice of card.</p></li>
          <li><span className="n">2</span><h3>Get funded</h3><p>Same terminal, no target. Every closed profit builds toward your payout cycle.</p></li>
          <li className="gold"><span className="n">3</span><h3>Take your payout</h3><p>You keep {split}% of the profit, and your fee comes back with rewards.</p></li>
        </ol>
      </section>

      <section className="blk" id="plans">
        <div className="lx-head" data-reveal>
          <h2>Pick your card</h2>
          <p>One fee. No subscription, no hidden cuts. Choose a size and every card updates.</p>
        </div>
        <Tiers plans={orderedPlans} prices={prices} />
      </section>

      <section className="blk" id="faq">
        <div className="lx-head" data-reveal><h2>Straight answers</h2></div>
        <div className="lx-faq" data-reveal>
          {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
      </section>

      <section className="lx-final" data-reveal>
        <span className="lx-pill"><Countdown /></span>
        <h2>The market opens at 9:15.<br />Have your card ready.</h2>
        <Link className="btn primary lg" href="/signup">Claim my account</Link>
        <p className="muted">Rules in plain words on the <Link href="/rules">rules page</Link>. Terms and Risk Disclosure apply.</p>
      </section>

      <Footer />
    </main>
  );
}
