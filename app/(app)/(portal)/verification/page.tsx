import type { Metadata } from "next";
import VerificationPage from "@/components/portal/VerificationPage";

export const metadata: Metadata = { title: "Verification · Edge Funded" };

export default function Page() {
  return <VerificationPage />;
}
