import type { Metadata } from "next";
import OverviewPage from "@/components/portal/OverviewPage";

export const metadata: Metadata = { title: "Overview · Edge Funded" };

export default function Page() {
  return <OverviewPage />;
}
