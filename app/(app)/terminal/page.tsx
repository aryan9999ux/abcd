import type { Metadata } from "next";
import TerminalClient from "@/components/trading/TerminalClient";
import { loadTradingInitial } from "@/components/trading/loadInitial";

export const metadata: Metadata = { title: "Terminal · Apex Capital Funded" };
export const dynamic = "force-dynamic";

export default async function TerminalPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { account } = await searchParams;
  const init = await loadTradingInitial("/terminal", account);
  return <TerminalClient initialAccounts={init.accounts} plans={init.plans} initialAccountId={init.selectedId} />;
}
