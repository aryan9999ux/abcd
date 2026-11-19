"use client";
import Link from "next/link";
import { inr } from "@/components/trading/format";
import type { AccountRow } from "@/components/trading/types";
import { rulesOf } from "./calc";

interface Copy { why: string; rule: string; whyHi: string; ruleHi: string }

/** Explains a closed account in plain English and Hindi: what happened, which rule, with the real numbers. */
function copyFor(a: AccountRow): Copy {
  const r = rulesOf(a);
  const size = a.account_size;
  const reason = a.breach_reason ?? "";
  const dd = (size * r.drawdownPct) / 100, day = (size * r.dailyLossPct) / 100;
  if (reason.startsWith("Maximum drawdown")) return {
    why: `Your account value fell to the maximum total loss limit of ${r.drawdownPct}% (${inr(dd)}).`,
    rule: `Every account has a total loss limit${r.drawdownType === "trailing" ? " that moves up as your profit grows" : ""}. Open positions count. When the limit is reached, the account closes and open trades are squared off so no larger loss can happen.`,
    whyHi: `आपके अकाउंट की वैल्यू कुल लॉस लिमिट ${r.drawdownPct}% (${inr(dd)}) तक पहुँच गई।`,
    ruleHi: `हर अकाउंट की एक कुल लॉस लिमिट होती है${r.drawdownType === "trailing" ? " जो आपके प्रॉफिट के साथ ऊपर बढ़ती है" : ""}। खुले ट्रेड भी गिने जाते हैं। लिमिट पूरी होते ही अकाउंट बंद हो जाता है और खुले ट्रेड बंद कर दिए जाते हैं, ताकि इससे बड़ा नुकसान न हो।`,
  };
  if (reason.startsWith("Daily loss")) return {
    why: `You lost the maximum allowed in one day: ${r.dailyLossPct}% (${inr(day)}).`,
    rule: "Each account has a daily loss limit, measured from the start of the trading day. Open positions count. When it is reached, the account closes and open trades are squared off.",
    whyHi: `आपने एक दिन में अधिकतम अनुमत नुकसान ${r.dailyLossPct}% (${inr(day)}) कर लिया।`,
    ruleHi: "हर अकाउंट की एक दैनिक लॉस लिमिट होती है, जो दिन की शुरुआत से गिनी जाती है। खुले ट्रेड भी गिने जाते हैं। लिमिट पूरी होते ही अकाउंट बंद हो जाता है और खुले ट्रेड बंद कर दिए जाते हैं।",
  };
  if (reason.startsWith("More than")) return {
    why: `You opened more than ${r.maxOpenPositions} positions at the same time.`,
    rule: `This plan allows ${r.maxOpenPositions} open positions at once. Opening one more closes the account, to stop over-trading.`,
    whyHi: `आपने एक साथ ${r.maxOpenPositions} से ज़्यादा पोज़िशन खोलीं।`,
    ruleHi: `इस प्लान में एक समय पर ${r.maxOpenPositions} खुली पोज़िशन की अनुमति है। एक और खोलने पर अकाउंट बंद हो जाता है, ताकि ओवर-ट्रेडिंग न हो।`,
  };
  if (reason.startsWith("Traded without a stop loss")) return {
    why: "You placed a second trade without a stop loss, after already getting a warning.",
    rule: "Every trade should have a stop loss. The first trade without one gives a clear warning and goes through. A second trade without a stop loss closes the account, and open positions are squared off.",
    whyHi: "चेतावनी मिलने के बाद आपने दूसरा ट्रेड बिना स्टॉप लॉस के लगाया।",
    ruleHi: "हर ट्रेड में स्टॉप लॉस लगाना चाहिए। बिना स्टॉप लॉस का पहला ट्रेड चेतावनी के साथ हो जाता है। दूसरा ट्रेड बिना स्टॉप लॉस के लगाने पर अकाउंट बंद हो जाता है और खुली पोज़िशन बंद कर दी जाती हैं।",
  };
  if (reason.startsWith("Demo ended")) return {
    why: "Your 3-day demo has ended.", rule: "A demo lasts 3 days. It uses the same rules as the real plan but has no payouts.",
    whyHi: "आपका 3 दिन का डेमो खत्म हो गया है।", ruleHi: "डेमो 3 दिन चलता है। इसमें असली प्लान जैसे ही नियम होते हैं, लेकिन पेआउट नहीं मिलता।",
  };
  const adminText = reason.replace(/^Closed by admin:\s*/, "");
  return {
    why: `Our team closed this account. Reason: ${adminText || "not given"}.`, rule: "If you think this is a mistake, contact support with your account details and we will review it.",
    whyHi: `हमारी टीम ने यह अकाउंट बंद किया है। कारण: ${adminText || "नहीं बताया गया"}।`, ruleHi: "अगर आपको लगता है कि यह गलती से हुआ है, तो अपने अकाउंट की जानकारी के साथ सपोर्ट से संपर्क करें, हम इसकी जाँच करेंगे।",
  };
}

export default function ClosureNotice({ a }: { a: AccountRow }) {
  const c = copyFor(a);
  const demo = (a.breach_reason ?? "").startsWith("Demo");
  return (
    <section className="pt-closure">
      <div className="pt-cl-head"><b>{demo ? "Demo ended" : "This account is closed"}</b><small>{demo ? "डेमो खत्म हुआ" : "यह अकाउंट बंद हो गया है"}</small></div>
      <div className="pt-cl-cols">
        <div><h3>What happened</h3><p><b>{c.why}</b></p><p>{c.rule}</p></div>
        <div lang="hi"><h3>क्या हुआ</h3><p><b>{c.whyHi}</b></p><p>{c.ruleHi}</p></div>
      </div>
      <div className="pt-cl-foot">
        <p>{demo ? "Ready to trade for real? Pick a plan." : "Your trades and results are still here to review. You can start again with a new account."}<br /><small>{demo ? "असली अकाउंट के लिए प्लान चुनें।" : "आपके ट्रेड और नतीजे यहाँ देख सकते हैं। नया अकाउंट लेकर दोबारा शुरू करें।"}</small></p>
        <Link className="pt-btn primary" href="/checkout">{demo ? "Choose a plan" : "Buy a new account"}</Link>
      </div>
    </section>
  );
}
