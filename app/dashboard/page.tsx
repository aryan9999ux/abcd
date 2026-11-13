import type { Metadata } from "next";
import DashboardClient from "@/components/trading/DashboardClient";
import { loadTradingInitial } from "@/components/trading/loadInitial";

export const metadata: Metadata = { title: "Dashboard · Apex Capital Funded" };
export const dynamic = "force-dynamic";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const init = await loadTradingInitial("/dashboard", account);
  return <DashboardClient initialAccounts={init.accounts} plans={init.plans} initialAccountId={init.selectedId} />;
}
