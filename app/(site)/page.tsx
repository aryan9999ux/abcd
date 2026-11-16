import Link from "next/link";
import "@fontsource-variable/plus-jakarta-sans/index.css";
import "./lux.css";
import { publicClient } from "@/lib/supabase/public";
import Footer from "@/components/site/Footer";
import HeroPreview from "@/components/site/HeroPreview";
import Motion from "@/components/site/Motion";
import GoldCard from "@/components/lux/GoldCard";
import Tiers from "@/components/lux/Tiers";
import Earn from "@/components/lux/Earn";
import StickyCta from "@/components/lux/StickyCta";
import Countdown from "@/components/lux/Countdown";
import type { Plan, PlanPrice } from "@/components/site/types";
import { inr, sizeLabel } from "@/components/site/format";

export const revalidate = 60;

const FAQ: [string, string][] = [
  ["How fast can I start?", "Right away. Sign up, pick an account and a size, and you can start trading in a few minutes. You can place trades when the market is open: Monday to Friday, 9:15 AM to 3:30 PM."],
  ["What exactly am I buying?", "A trading account on our own platform, with live NSE and BSE prices. You pay a one-time fee. Profit payouts are made by Apex Capital Funded as set out in the Terms."],
  ["Where do the prices come from?", "Every price is a live NSE or BSE price, for stocks, futures and options. Your trades are filled at those prices."],
  ["When do I get paid?", "Once your funded account meets the payout conditions in the Terms, you can ask for a payout from your dashboard. You keep 80% of the profit."],
  ["What happens if I breach a limit?", "That account is closed. You only lose the fee you paid, and you can start a new account any time."],
  ["Can I trade options and futures?", "Yes. You can trade stocks, futures and options on live NSE and BSE prices, including Nifty and Bank Nifty."],
  ["Do I get my fee back?", "Your fee is returned with your rewards once you are funded and get paid, as set out in the Terms."],
  ["Can I have more than one account?", "Yes. You can run several accounts and switch between them in one click from your dashboard."],
  ["Is Apex Capital Funded a broker?", "No. We do not place orders on any exchange and we do not hold your shares. The Terms explain exactly what we offer."],
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
          <h1><span>Trade with our money.</span> <span className="soft">Keep the profit.</span></h1>
          <p className="lead">
            Pick an account up to {sizeLabel(topSize)}, trade on live NSE and BSE prices, and keep {split}% of what you earn. If you lose, you only lose the small fee you paid.
          </p>
          <div className="lx-cta">
            <Link className="btn primary lg" href="/signup">Get my account</Link>
            <Link className="btn lg" href="/#plans">See the plans</Link>
          </div>
          <ul className="lx-trust">
            <li><b>{split}%</b> of profit is yours</li>
            <li>Start from <b>{inr(cheapest)}</b></li>
            <li><b>Live</b> NSE and BSE prices</li>
          </ul>
        </div>
        <div className="lx-fan" aria-hidden>
          <div className="c c1"><GoldCard tier="silver" size={sizeLabel(topSize / 2)} name="2-Step" num="2028" /></div>
          <div className="c c2"><GoldCard tier="night" size={sizeLabel(topSize)} name="Instant" num="2027" /></div>
          <div className="c c3"><GoldCard tier="violet" size={sizeLabel(topSize)} name="1-Step" num="2026" /></div>
        </div>
      </section>

      <div className="lx-tape" aria-hidden>
        <div className="run">
          {[0, 1].map((k) => (<div key={k}>{TAPE.map((t) => <span key={t}>{t}</span>)}</div>))}
        </div>
      </div>

      <section className="lx-prev" data-reveal><HeroPreview /></section>

      <section className="blk" id="why">
        <div className="lx-head" data-reveal><h2>Why traders pick us</h2><p>Three simple things. That is it.</p></div>
        <div className="lx-why" data-reveal>
          <div><b className="big">{inr(cheapest)}</b><h3>Is all you can lose</h3><p>Pay one small fee. If a trade goes wrong, your own savings are never touched.</p></div>
          <div><b className="big">{sizeLabel(topSize)}</b><h3>To trade with</h3><p>Trade an account many times bigger than the money you have saved.</p></div>
          <div><b className="big">{split}%</b><h3>Of profit is yours</h3><p>You keep most of what you make. We take only {100 - split}%.</p></div>
        </div>
      </section>

      <section className="blk" id="edge">
        <div className="lx-head" data-reveal>
          <h2>See what you could take home</h2>
          <p>Pick an account size and a monthly profit. Same skill, bigger account, bigger payout.</p>
        </div>
        <div data-reveal><Earn sizes={prices.length ? Array.from(new Set(prices.map((p) => p.account_size))).sort((x, y) => x - y) : [100000, 500000, 1000000]} split={split} ownCap={ownCap} /></div>
      </section>

      <section className="blk" id="plans">
        <div className="lx-head" data-reveal>
          <h2>Choose your account</h2>
          <p>One fee. No monthly charges, no hidden costs. Pick a size and the prices update.</p>
        </div>
        <Tiers plans={orderedPlans} prices={prices} />
      </section>

      <section className="blk" id="for">
        <div className="lx-head" data-reveal><h2>Made for traders like you</h2></div>
        <ul className="lx-for" data-reveal>
          <li>You trade Nifty or Bank Nifty and you know your setup works.</li>
          <li>Your capital is small, so your profits are small too.</li>
          <li>You do not want to risk your savings just to grow.</li>
          <li>You want a real chance to trade a {sizeLabel(topSize)} account.</li>
        </ul>
        <div className="lx-mid" data-reveal><Link className="btn primary lg" href="/signup">Get my account</Link><span className="muted">Start from {inr(cheapest)}</span></div>
      </section>

      <section className="blk" id="terminal">
        <div className="desk">
          <div className="lx-head left" data-reveal>
            <h2>A trading screen made for big accounts</h2>
            <p>Everything you need on one screen: live chart, option chain and your limits, side by side.</p>
            <ul className="lx-list">
              <li><b>Full futures and options</b><span>Every strike with live prices, open interest and more.</span></li>
              <li><b>Limits you can always see</b><span>Your daily and total loss limits update with every price move, so there are no surprises.</span></li>
              <li><b>More than one account</b><span>Run several accounts and switch between them in one click.</span></li>
            </ul>
          </div>
          <div className="deskvis" data-reveal aria-hidden>
            <div className="lx-chain">
              <div className="ch-h"><span>Calls</span><span>Strike</span><span>Puts</span></div>
              {[62, 48, 36, 25, 17, 11, 7].map((w, i) => (
                <div key={i} className={`ch-r${i === 3 ? " atm" : ""}`}>
                  <span className="ce"><i style={{ width: `${w}%` }} /></span>
                  <b>{24000 + (i - 3) * 100}</b>
                  <span className="pe"><i style={{ width: `${[7, 11, 17, 25, 36, 48, 62][i]}%` }} /></span>
                </div>
              ))}
              <small>Option chain preview. Layout illustration.</small>
            </div>
          </div>
        </div>
      </section>

      <section className="blk" id="compare">
        <div className="lx-head" data-reveal><h2>Your money or ours?</h2></div>
        <div className="lx-vs" data-reveal>
          <div className="vs-h"><span /><span>Trading alone</span><span className="hi">With us</span></div>
          <div className="vs-r"><span className="vs-k">Money at risk</span><span className="vs-a">Your own savings</span><span className="vs-b">Only the fee</span></div>
          <div className="vs-r"><span className="vs-k">Size you trade</span><span className="vs-a">What you saved</span><span className="vs-b">Up to {sizeLabel(topSize)}</span></div>
          <div className="vs-r"><span className="vs-k">Profit you keep</span><span className="vs-a">100% of a small profit</span><span className="vs-b">{split}% of a big profit</span></div>
          <div className="vs-r"><span className="vs-k">To get started</span><span className="vs-a">Your full capital</span><span className="vs-b">From {inr(cheapest)}</span></div>
        </div>
      </section>

      <section className="blk" id="how">
        <div className="lx-head" data-reveal>
          <h2>How you get paid</h2>
          <p>Instant accounts skip step 1 and start funded.</p>
        </div>
        <ol className="lx-road" data-reveal>
          <li><span className="n">1</span><h3>Pass the test</h3><p>Reach the profit target without crossing the loss limits. Choose a 1-step or 2-step test.</p></li>
          <li><span className="n">2</span><h3>Get funded</h3><p>Trade the same way, with no target. Your profits add up toward your payout.</p></li>
          <li className="hi"><span className="n">3</span><h3>Get paid</h3><p>You keep {split}% of the profit, and your fee is returned with your rewards.</p></li>
        </ol>
      </section>

      <section className="blk" id="faq">
        <div className="lx-head" data-reveal><h2>Questions people ask</h2></div>
        <div className="lx-faq" data-reveal>
          {FAQ.map(([q, a]) => (<details key={q}><summary>{q}</summary><p>{a}</p></details>))}
        </div>
      </section>

      <section className="lx-final" data-reveal>
        <span className="lx-pill"><Countdown /></span>
        <h2>The market opens at 9:15.<br />Be ready.</h2>
        <Link className="btn primary lg" href="/signup">Get my account</Link>
        <p className="muted">Read the rules in simple words on the <Link href="/rules">rules page</Link>. Our Terms and Risk Disclosure apply.</p>
      </section>

      <StickyCta label={`Get my account · from ${inr(cheapest)}`} />
      <Footer />
    </main>
  );
}
