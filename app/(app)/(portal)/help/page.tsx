import type { Metadata } from "next";
import HelpPage from "@/components/portal/HelpPage";

export const metadata: Metadata = { title: "Help · Edge Funded" };

export default function Page() {
  return <HelpPage />;
}
