import type { Metadata } from "next";
import ReportsPage from "@/components/portal/ReportsPage";

export const metadata: Metadata = { title: "Reports · Edge Funded" };

export default function Page() {
  return <ReportsPage />;
}
