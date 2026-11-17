import type { Metadata } from "next";
import PayoutsPage from "@/components/portal/PayoutsPage";

export const metadata: Metadata = { title: "Payouts · Apex Capital Funded" };

export default function Page() {
  return <PayoutsPage />;
}
