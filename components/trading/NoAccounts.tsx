import Link from "next/link";

/** Shown when a signed-in trader has not bought an account yet. */
export default function NoAccounts({ what }: { what: string }) {
  return (
    <div className="tr-glass tr-hero-empty">
      <span className="tr-eyebrow">No accounts yet</span>
      <h2>Buy an account to open the {what}</h2>
      <p className="tr-muted">Pick a plan and account size. Your account appears here as soon as the purchase completes.</p>
      <Link className="tr-btn primary lg" href="/checkout">Choose a plan</Link>
    </div>
  );
}
