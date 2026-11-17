"use client";
import Link from "next/link";
import { inr } from "@/components/trading/format";
import { compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { PageHead } from "./ui";

export default function ReceiptPage({ id }: { id: string }) {
  const { payments, plans, user } = usePortal();
  const p = payments.find((x) => x.id === id);
  if (!p || p.status !== "approved") return <><PageHead title="Receipt not available" sub="A receipt is issued once a payment is approved." /><Link className="pt-btn" href="/payments">Back to payments</Link></>;
  const base = p.amount_inr - p.gst_inr;
  return (
    <>
      <Link className="pt-link no-print" href="/payments">‹ All payments</Link>
      <section className="pt-card pt-receipt">
        <div className="pt-rhead"><div><b>Apex Capital Funded</b><small>Payment receipt</small></div><span className="pt-badge ok">Paid</span></div>
        <div className="pt-dl">
          <div><span>Receipt no.</span><b>{p.receipt_no}</b></div>
          <div><span>Date</span><b>{new Date(p.decided_at ?? p.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</b></div>
          <div><span>Billed to</span><b>{user.name}</b></div>
          <div><span>Email</span><b>{user.email}</b></div>
          <div><span>Item</span><b>{plans.find((x) => x.key === p.plan_key)?.name ?? p.plan_key}, {compact(p.account_size)}</b></div>
          <div><span>UTR</span><b style={{ fontFamily: "var(--f-mono)" }}>{p.utr}</b></div>
          <div><span>Amount</span><b>{inr(base)}</b></div>
          <div><span>GST (18%)</span><b>{inr(p.gst_inr)}</b></div>
          <div><span>Total paid</span><b>{inr(p.amount_inr)}</b></div>
        </div>
        <button className="pt-btn no-print" onClick={() => window.print()}>Print or save as PDF</button>
      </section>
    </>
  );
}
