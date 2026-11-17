import type { Metadata } from "next";
import AccountsPage from "@/components/portal/AccountsPage";

export const metadata: Metadata = { title: "Accounts · Edge Funded" };

export default function Page() {
  return <AccountsPage />;
}
