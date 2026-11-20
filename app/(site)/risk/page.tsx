import LegalDoc, { type LegalSection } from "@/components/site/LegalDoc";

export const metadata = { title: "Risk Disclosure", description: "What you should know before you buy an account." };

const S: LegalSection[] = [
  { h: "Simulated capital", p: [
    "Evaluation and funded accounts use simulated capital. Edge Funded is not a broker, exchange member or investment adviser, does not accept deposits and does not invest customer money. Orders placed in the terminal are not sent to any exchange.",
    "Rewards are paid from Edge Funded's own funds under the Terms of Service. They are not a share of real market profit.",
  ] },
  { h: "No guarantee of results", p: [
    "No return is guaranteed. Most traders do not pass an evaluation and most do not receive rewards. The examples on this website show how the numbers work and are not a promise or a forecast.",
  ] },
  { h: "Trading is risky", p: [
    "Trading futures and options can lose money fast. Leverage, short options and holding through news can lead to large losses, and the same habits would cause real losses with real money. Do not trade with money you cannot afford to lose, and do not treat the fee as an investment.",
    "Your performance on a simulated account does not predict how you would perform with real money, where fills, costs and emotions differ.",
  ] },
  { h: "Prices and fills", p: [
    "Terminal prices come from third-party market data and may be delayed or wrong. Fills are simulated. A stop loss or target closes your position at the live price when it is reached, which in a fast market can be worse than your level.",
  ] },
  { h: "Strict rules end accounts", p: [
    "The loss limits, risk limits and other rules are enforced automatically and without exception. Touching a limit ends the account, and the fee is not refunded. It comes back only as part of a reward, as shown on the Rules page.",
  ] },
  { h: "Who can use it", p: [
    "The Services are for residents of India aged 18 and above. Nothing on this website is investment advice.",
  ] },
];

export default function Page() {
  return <LegalDoc path="/risk" title="Risk Disclosure" summary="Read this before you buy. Accounts use simulated capital, no result is guaranteed and most traders do not pass an evaluation." sections={S} />;
}
