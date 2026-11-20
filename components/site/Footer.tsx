import Link from "next/link";
import { LogoMark, Wordmark } from "@/components/brand/Logo";

export default function Footer() {
  return (
    <footer className="foot wrap">
      <div className="foot-brand">
        <Link className="brand" href="/" aria-label="Edge Funded home">
          <LogoMark size={34} id="ft" />
          <span className="brand-name"><Wordmark /></span>
        </Link>
        <strong>Trade with our money. Keep the profit.</strong>
        <span>Funded trading accounts for Indian markets, on live NSE and BSE prices.</span>
      </div>
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
      <p className="foot-copy">© Edge Funded. Made in India.</p>
    </footer>
  );
}
