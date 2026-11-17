import Link from "next/link";
import "./dashboard.css";
import { inr } from "./format";

/** Shown when a signed-in trader has no account yet: two clear ways in, and what they get. */
export default function NoAccounts({ what, fromPrice }: { what: string; fromPrice?: number | null }) {
  return (
    <div className="db-empty">
      <h1>{what === "terminal" ? "Open an account to start trading" : "Let’s get you trading"}</h1>
      <p>Pick the way you want to start. You can always do the other one later.</p>
      <div className="db-paths">
        <section className="db-path">
          <span className="db-tag">Free</span>
          <h2>Try a demo</h2>
          <p>Practice for 3 days on a ₹10L account with live NSE and BSE prices and the real rules of the plan you pick.</p>
          <ul>
            <li>No payment needed</li>
            <li>Same terminal as a real account</li>
            <li>One demo per person</li>
          </ul>
          <Link className="tr-btn lg" href="/demo">Start free demo</Link>
        </section>
        <section className="db-path hot">
          <span className="db-tag hi">Real account</span>
          <h2>Get funded</h2>
          <p>Trade up to ₹10L with our money and keep 80% of the profit. If a trade goes wrong, you only lose the fee.</p>
          <ul>
            <li>{fromPrice ? `Start from ${inr(fromPrice)}, one-time fee` : "One-time fee, no monthly charges"}</li>
            <li>Payouts every 14 days once you are funded</li>
            <li>Your fee comes back with your payout</li>
          </ul>
          <Link className="tr-btn primary lg" href="/checkout">Choose an account</Link>
        </section>
      </div>
      <ol className="db-steps">
        <li><b>Pick</b><span>a plan and a size</span></li>
        <li><b>Trade</b><span>inside your loss limits</span></li>
        <li><b>Get paid</b><span>you keep 80% of profit</span></li>
      </ol>
    </div>
  );
}
