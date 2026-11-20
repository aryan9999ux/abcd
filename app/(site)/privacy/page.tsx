import LegalDoc, { type LegalSection } from "@/components/site/LegalDoc";

export const metadata = { title: "Privacy Policy", description: "What data we collect, why, and your choices." };

const S: LegalSection[] = [
  { h: "What we collect", p: [
    "Account data: your name, email address, phone number and password (stored only as a secure hash).",
    "Payment data: the UTR and amount of your UPI payments and the plan you bought. We do not receive or store your card or bank login details.",
    "Verification data: PAN, Aadhaar details, photos of your documents, a selfie and your payout bank account or UPI ID, collected when you apply for a reward.",
    "Trading data: your orders, positions, trades and account activity in the terminal.",
    "Technical data: IP address, device and browser details and session information, used for security and to detect account sharing and other abuse.",
  ] },
  { h: "Why we use it", p: [
    "To run your account and the terminal, to open accounts after payment, to verify your identity and pay your rewards, to enforce the rules and prevent fraud and abuse, to answer your questions, and to meet our legal duties. We send you messages about your account and payments. Marketing messages, if any, can be turned off at any time.",
  ] },
  { h: "Who we share it with", p: [
    "We never sell your data. We share it only with providers who help us deliver the Services (hosting and database, market data, email and messaging, and an AI assistant that answers support questions using your account details) and with authorities where the law requires. Providers may process data only to serve us.",
    "The chat assistant on this website and in your dashboard sends your messages, and in your dashboard some of your account details, to an AI provider to produce a reply. Please do not type documents, passwords or card numbers into the chat.",
  ] },
  { h: "How we protect it", p: [
    "Documents are stored in private, access-controlled storage and are viewed only by authorised staff for verification. Data is encrypted in transit. No system is perfectly secure, so keep your password private and tell us at once if you suspect misuse.",
  ] },
  { h: "How long we keep it", p: [
    "We keep account and trading records for as long as your account exists and for the period the law requires afterwards. Verification documents are kept while needed to pay rewards and meet legal duties, then deleted or anonymised.",
  ] },
  { h: "Your choices", p: [
    "You can ask to see, correct, export or delete your data, and to withdraw consent, by writing to support. We will act on your request within 30 days, except where we must keep records by law or to deal with a rule breach or dispute. Deleting your data ends your access to the Services.",
  ] },
  { h: "Cookies", p: [
    "We use only the cookies needed to keep you signed in and remember settings such as light or dark theme. We do not use advertising cookies.",
  ] },
  { h: "Age and place", p: [
    "The Services are for people aged 18 and above who live in India, and your data is processed in line with Indian law, including the Digital Personal Data Protection Act, 2023.",
  ] },
  { h: "Changes", p: [
    "If we change this policy in a way that matters, we will say so on the website and by email before it applies.",
  ] },
];

export default function Page() {
  return <LegalDoc path="/privacy" title="Privacy Policy" summary="We collect your details only to run your account, verify you and pay you. We never sell your data, documents are stored privately, and you can ask us to export or delete your data at any time." sections={S} />;
}
