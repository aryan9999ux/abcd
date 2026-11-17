import type { Metadata } from "next";
import ReceiptPage from "@/components/portal/ReceiptPage";

export const metadata: Metadata = { title: "Receipt · Apex Capital Funded" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptPage id={id} />;
}
