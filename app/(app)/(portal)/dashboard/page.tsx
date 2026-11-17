import type { Metadata } from "next";
import OverviewPage from "@/components/portal/OverviewPage";

export const metadata: Metadata = { title: "Overview · Apex Capital Funded" };

export default function Page() {
  return <OverviewPage />;
}
