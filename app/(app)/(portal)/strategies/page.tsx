import type { Metadata } from "next";
import StrategiesPage from "@/components/portal/StrategiesPage";

export const metadata: Metadata = { title: "Strategies · Edge Funded" };

export default function Page() {
  return <StrategiesPage />;
}
