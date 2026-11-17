import type { Metadata } from "next";
import AccountDetail from "@/components/portal/AccountDetail";

export const metadata: Metadata = { title: "Account · Edge Funded" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AccountDetail id={id} />;
}
