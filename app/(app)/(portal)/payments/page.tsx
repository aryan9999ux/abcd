import type { Metadata } from "next";
import PaymentsPage from "@/components/portal/PaymentsPage";

export const metadata: Metadata = { title: "Payments · Apex Capital Funded" };

export default function Page() {
  return <PaymentsPage />;
}
