import type { Metadata } from "next";
import PayoutsPage from "@/components/portal/PayoutsPage";

export const metadata: Metadata = { title: "Payouts · Edge Funded" };

export default function Page() {
  return <PayoutsPage />;
}
