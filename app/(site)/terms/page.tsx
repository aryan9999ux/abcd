import LegalDoc, { type LegalSection } from "@/components/site/LegalDoc";

export const metadata = { title: "Terms of Service", description: "The agreement between you and Edge Funded." };

const S: LegalSection[] = [
  { h: "Who we are and what this document is", p: [
    "These Terms of Service (\"Terms\") are an agreement between you (\"you\", \"the Trader\") and Edge Funded (\"we\", \"us\"), which runs this website, the trading terminal and the evaluation and funded-account programs offered through them (together, \"the Services\").",
    "By creating an account, buying a plan, starting a demo or using the terminal, you confirm that you have read and accepted these Terms, the Rules page, the Risk Disclosure, the Refund Policy and the Privacy Policy. If you do not accept them, do not use the Services.",
    "The Rules page shows the exact limits for each plan and is part of these Terms. If the Rules page and this document differ on a trading limit, the Rules page for your plan applies. For everything else, these Terms apply.",
  ] },
  { h: "What the Services are", p: [
    "Every account we offer, at every stage including the funded stage, is a simulated trading account. Balances, positions, profits and losses exist only inside our terminal. No order placed in the terminal is sent to any exchange, broker or liquidity provider, and no real securities, derivatives or commodities are bought or sold for you.",
    "Edge Funded is not a stock broker, sub-broker, investment adviser, portfolio manager or research analyst, and is not registered with SEBI in any capacity. We do not accept deposits, manage client money or give investment advice. The Services are a skill-evaluation and education product.",
    "Rewards (payouts) are performance rewards paid from Edge Funded's own funds under these Terms. They are not a share of real trading profit, because no real trading takes place.",
    "Prices in the terminal come from third-party market data and may be delayed, differ from exchange prices or contain errors. Fills are simulated and may differ from what a real broker would give you. Simulated results do not predict real-market results.",
  ] },
  { h: "Eligibility", p: [
    "You must be at least 18 years old, able to enter a binding contract, and a resident of India.",
    "You must register in your own real name with accurate contact details and keep them current. One person may hold only one identity with us. Using another person's name, or a business name, to get around a rule is prohibited.",
    "You may hold several active accounts under your own identity, up to 20 at a time. Each account is independent and rules are applied to each account separately.",
    "We may refuse, suspend or close any account where we believe these Terms have been or will be broken, or where the law requires it.",
  ] },
  { h: "Fees, payment and activation", p: [
    "Plans are sold for a one-time fee shown at checkout in Indian Rupees, inclusive of GST. The fee pays for access to the account, the terminal, the data feed and the evaluation. It is not a deposit or margin and is never added to the account balance.",
    "You pay by UPI to the QR code shown at checkout and submit the UTR (transaction reference) of your payment. We check the payment against our bank records and then open your account and issue a receipt. This normally happens within a few hours on working days, and can take longer outside working hours. The account is not active until we approve the payment.",
    "Payment must come from a bank account or UPI ID in your own name. Payments from third parties may be rejected and the account may be closed. If a payment cannot be matched or is rejected, we show you the reason and you may submit it again with the correct details.",
    "Promotional prices apply only during the period shown on the website and only to purchases completed in that period.",
  ] },
  { h: "Free demo accounts", p: [
    "Each person may have one free demo account. A demo runs for 3 days on the same rules as the plan you choose. Demo accounts do not earn rewards, and a demo ends automatically when its time is over.",
  ] },
  { h: "Evaluation and funded stages", p: [
    "The 2-Step plan has two evaluation phases with their own profit targets, then a funded account. The 1-Step plan has one evaluation phase, then a funded account. The Instant plan is funded from the first trade. The targets and limits for each plan are on the Rules page.",
    "A phase is passed when the profit target is reached on closed trades, the required number of profitable days is met and no rule was broken. When a phase is passed, the account moves to the next stage with its balance reset to the starting balance.",
    "A funded account has no profit target and continues while its rules are followed. It is not a job, partnership or agency. You trade at your own discretion and are not an employee or agent of Edge Funded.",
  ] },
  { h: "Trading rules", p: [
    "Every account is limited by the rules on the Rules page and enforced automatically by the terminal: a daily loss limit measured on equity (closed plus open profit and loss), a maximum drawdown (static or trailing as shown for the plan), a limit on risk per trade, a limit on risk in one idea (one underlying, one direction, one day), a maximum number of open positions, a minimum holding time, and a cutoff time after which no new positions can be opened.",
    "Stop loss: you should place a stop loss on every trade. If you place a trade without one, the terminal gives you one clear warning. A second trade without a stop loss ends the account. Removing the stop loss from an open position counts as trading without one.",
    "Touching the daily loss limit or the maximum drawdown closes all positions and ends the account. Opening more positions than the plan allows also ends the account.",
    "A stop loss or target set on a position closes it at the live price when that price is reached. In a fast market the fill price can be worse than your level. Closing a position by hand is allowed after the minimum holding time; stop losses work at any time.",
  ] },
  { h: "Prohibited practices", p: [
    "The following are prohibited on every account. If we find any of them, the account is closed, rewards not yet paid are cancelled and no further reward can be requested from that account. Where the practice is deliberate or repeated, all your accounts are closed and you are barred from the Services.",
    "Copy trading and signal following: mirroring or synchronising trades from another person, account, group or service. Automated trading: using bots, scripts, auto-clickers or any software that places, changes or closes orders without a human action for each order. Account sharing: letting anyone else use your account, or using someone else's. We compare IP addresses, devices and sessions across accounts.",
    "Group or cross-account hedging: taking opposite positions across two or more accounts so that one of them is sure to profit, including coordinated trading with others. Hedging against a real-money account: using a simulated account to offset or insure real positions.",
    "Exploiting errors: taking advantage of wrong, delayed or frozen prices, incorrect fills or margins, outages or any malfunction. Trades resulting from such an event may be voided whether or not you knew about the error. Latency or feed arbitrage is treated the same way.",
    "Gambling-style trading: martingale or grid strategies, increasing size after a loss to recover it, stacking positions in one direction to get around the risk limits, using most of the available margin on one idea, repeatedly buying far out-of-the-money options in one direction on expiry day, or tick scalping and more than 10 orders in a minute.",
    "Any other behaviour that, in our reasonable judgement, is designed to profit from the rules, the platform or the simulation rather than from trading skill. When we act under this clause we will explain the finding in writing.",
  ] },
  { h: "Rewards (payouts)", p: [
    "A reward can be requested only from a funded account, only when every condition for your plan is met in the current cycle, and only when all positions are closed. The conditions are on the Rules page: the reward cycle length (14 days), the number of profitable days in the cycle, the minimum closed profit as a percentage of the starting balance, and the minimum reward amount.",
    "While a reward request is under review, trading on that account is paused until we decide it. We review the trades in the cycle for rule compliance and prohibited practices, and we check your KYC and payout details. Review normally takes up to 3 working days and can be extended if we ask you for more information.",
    "If we find a rule breach or a prohibited practice at any point in the account's history, the request is rejected, other unpaid rewards from that account are cancelled and the account is closed. Rewards already paid are not taken back, except where they were obtained by fraud.",
    "You receive the share of the approved profit shown on the Rules page (currently 80%). The purchase fee is returned with the reward number shown on the Rules page for your plan, and is added on top of your share. Rewards are paid to a bank account or UPI ID in your own name, on working days, after KYC is verified.",
    "After a reward is approved, the account balance resets to the starting balance and drawdown room resets with it.",
    "Rewards are performance rewards. We deduct tax at source where Indian law requires it and will give you a certificate. You are responsible for declaring and paying any tax due on money you receive. We may ask for your PAN and a declaration before releasing funds.",
  ] },
  { h: "Identity verification (KYC)", p: [
    "Before your first reward you must complete KYC: your PAN, your Aadhaar details, a photo of each document, a selfie and the bank account or UPI ID where you want to be paid, all in your own name. We may repeat KYC at any time. Rewards are held until KYC is complete and matches. Giving false documents is fraud and leads to a permanent ban.",
  ] },
  { h: "Closures, blocks and appeals", p: [
    "Hard breach: touching the daily loss limit or the maximum drawdown, trading without a stop loss after the warning, opening too many positions, or a prohibited practice. The account ends, open positions are closed at the terminal's price and the account cannot be reopened. You may buy a new plan.",
    "Block: an account found to be involved in a prohibited practice is blocked. It cannot trade or request a reward. Where other accounts or identities are involved, they are blocked too.",
    "Appeal: you may appeal a closure or block within 7 days by writing to support with your account and your reasons. We review the trade log and reply in writing within 7 working days. We will share the trades or data behind the decision, except where that would reveal how we detect abuse. Our decision after appeal is final.",
  ] },
  { h: "Platform, data and availability", p: [
    "The terminal is provided \"as is\". We aim for high availability but do not promise that the terminal, the data feed or the website will be uninterrupted or error-free. Market data is available only while we have a valid connection to our data provider.",
    "If an outage, data error or malfunction affects your account, we may void the affected trades, restore the account to its earlier state, extend a deadline or offer a replacement account. We are not liable for lost or expected profit caused by an outage, delay or error.",
    "You are responsible for your internet connection, your device and your password. Tell us immediately if you think someone has used your account without permission.",
  ] },
  { h: "Intellectual property and acceptable use", p: [
    "The website, terminal, brand, design, text, code and data presentation belong to Edge Funded or its licensors. You may not copy, scrape, reverse-engineer, resell or build on any part of the Services. You may share screenshots of your own results if you do not present them as real-money trading.",
    "You may not use the Services for anything unlawful, to harass others, to post misleading claims about us, or to interfere with the platform or other traders.",
  ] },
  { h: "Privacy", p: [
    "We handle your personal data as described in the Privacy Policy. We do not sell it.",
  ] },
  { h: "Disclaimers and limits of liability", p: [
    "Trading, even simulated trading, involves risk. We do not promise that you will pass an evaluation, receive a reward or reach any result. Most traders do not pass an evaluation. Past results do not predict future results.",
    "To the fullest extent the law allows, Edge Funded and its directors, employees and partners are not liable for indirect or consequential loss, lost profit (real or simulated) or loss of data or opportunity arising from the Services. Our total liability for any claim is limited to the fee you paid for the account concerned in the 12 months before the claim. Nothing here limits liability for fraud or for anything the law does not allow to be limited.",
    "You agree to cover us against loss, claims and costs (including reasonable legal fees) that arise from your breach of these Terms, your misuse of the Services or your breaking any law.",
  ] },
  { h: "Changes to these Terms and the Rules", p: [
    "We may update these Terms and the Rules. A change that makes a rule stricter is announced on the website and by email at least 14 days before it takes effect, and never applies to an evaluation phase or reward cycle that was already running when it was announced. Clarifications, corrections and changes in your favour may take effect immediately. Continuing to use the Services after a change takes effect means you accept it.",
  ] },
  { h: "Ending your access", p: [
    "You may stop using the Services at any time; fees already paid are not refunded except as the Refund Policy says. We may suspend or end your access immediately for a breach of these Terms, suspected fraud, a chargeback raised without contacting us first, abusive behaviour, or where the law requires it.",
  ] },
  { h: "Governing law and disputes", p: [
    "These Terms are governed by the laws of India. Before starting any formal proceeding you agree to raise the matter with our support team and allow 30 days to resolve it. Any dispute that is not resolved is subject to the courts of India that have jurisdiction.",
  ] },
  { h: "General", p: [
    "If any part of these Terms is found unenforceable, the rest still applies. Not enforcing a right is not giving it up. You may not transfer your account or your rights to anyone else. These Terms, the Rules, the Risk Disclosure, the Refund Policy and the Privacy Policy are the whole agreement between you and us about the Services. If these Terms are translated, the English version applies.",
  ] },
];

export default function Page() {
  return <LegalDoc path="/terms" title="Terms of Service" summary="In short: accounts are simulated and Edge Funded is not a broker. You pay a one-time fee, follow the rules on your plan's Rules page, and if you qualify you receive performance rewards of 80% of the approved profit after review. Break a rule and the account ends; use a prohibited practice and pending rewards are cancelled." sections={S} />;
}
