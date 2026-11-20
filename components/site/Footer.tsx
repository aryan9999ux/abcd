import Link from "next/link";

export default function Footer() {
  return (
    <footer className="foot wrap">
      <div className="links">
        <Link href="/terms">Terms of Service</Link>
        <Link href="/privacy">Privacy Policy</Link>
        <Link href="/risk">Risk Disclosure</Link>
        <Link href="/refund">Refund Policy</Link>
      </div>
      <p>
        Evaluation and funded accounts use simulated capital. Edge Funded is not a broker, exchange or investment adviser and does not
        accept deposits or invest customer money. Rewards are paid from Edge Funded&apos;s own funds. No returns are guaranteed and most
        traders do not pass an evaluation. Available to residents of India aged 18 and above.
      </p>
      <p>© Edge Funded</p>
    </footer>
  );
}
