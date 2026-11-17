import type { Metadata } from "next";
import AccountsPage from "@/components/portal/AccountsPage";

export const metadata: Metadata = { title: "Accounts · Apex Capital Funded" };

export default function Page() {
  return <AccountsPage />;
}
