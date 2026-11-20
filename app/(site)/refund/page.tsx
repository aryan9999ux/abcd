import LegalDoc, { type LegalSection } from "@/components/site/LegalDoc";

export const metadata = { title: "Refund Policy", description: "When and how your fee is returned." };

const S: LegalSection[] = [
  { h: "What the fee is", p: [
    "The one-time fee you pay for a plan covers access to the account, the terminal, the data feed and the evaluation. It is inclusive of GST. It is not a deposit or margin and is never added to your account balance.",
  ] },
  { h: "No refunds", p: [
    "We do not refund the plan fee, on request or for any other reason, once you have paid for a plan. The service starts for you when we approve your payment and open your account, and the data feed and evaluation are used for you from then on. This includes accounts that are closed for a rule breach and accounts you stop using.",
    "The only exception is a duplicate payment, described below.",
  ] },
  { h: "Duplicate payment", p: [
    "If you paid twice for the same plan, we refund the extra payment to the bank account or UPI ID it came from, within 7 working days of confirming it. Write to support with the UTR numbers of both payments.",
  ] },
  { h: "Your fee comes back with your rewards", p: [
    "This is a feature of the plan and not a refund. The fee you paid is returned automatically as part of a reward: with the reward number shown on your plan's Rules page (for 1-Step and 2-Step plans, your 3rd approved reward). It is added on top of your share of the profit and is not reduced by the profit split. If the account is closed for a rule breach or blocked before that reward, the fee is not returned.",
  ] },
  { h: "Chargebacks and disputes", p: [
    "Please contact support before raising a chargeback or a bank dispute. A chargeback raised without first contacting us can lead to all your accounts being closed and rewards being cancelled.",
  ] },
  { h: "Free demo", p: [
    "The 3-day demo is free and has nothing to refund.",
  ] },
  { h: "How to ask", p: [
    "Use Help in your dashboard or write to support with the UTR of the payment and the email of your account. We reply within 2 working days.",
  ] },
];

export default function Page() {
  return <LegalDoc path="/refund" title="Refund Policy" summary="In short: the plan fee is not refunded, except if you paid twice for the same plan, in which case we return the extra payment within 7 working days. Separately, the fee comes back to you with a reward as shown on your plan's Rules page." sections={S} />;
}
