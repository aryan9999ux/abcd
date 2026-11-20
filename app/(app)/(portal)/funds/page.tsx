import type { Metadata } from "next";
import FundsPage from "@/components/portal/FundsPage";

export const metadata: Metadata = { title: "Funds · Edge Funded" };

export default function Page() {
  return <FundsPage />;
}
