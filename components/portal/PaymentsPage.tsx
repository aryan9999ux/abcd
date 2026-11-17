"use client";
import Link from "next/link";
import { inr } from "@/components/trading/format";
import { compact } from "./calc";
import { usePortal } from "./PortalProvider";
import { Badge, Icon, PageHead } from "./ui";

export default function PaymentsPage() {
  const { payments, plans } = usePortal();
  const name = (k: string) => plans.find((p) => p.key === k)?.name ?? k;
  const waiting = payments.filter((p) => p.status === "pending");
  return (
    <>
      <PageHead title="Payments" sub="Every payment you have sent, and where it stands." actions={<Link className="pt-btn primary" href="/checkout"><Icon n="plus" size={16} /> Buy account</Link>} />
      {waiting.length > 0 && (
        <div className="pt-banner warn"><div><b>{waiting.length === 1 ? "1 payment is waiting for approval" : `${waiting.length} payments are waiting for approval`}</b><p>Our team checks each payment against the bank and opens your account. This usually takes a few minutes. You don’t need to pay again.</p></div></div>
      )}
      <section className="pt-card flush">
        {payments.length === 0 ? (
          <p className="pt-empty">No payments yet. When you buy an account, it shows up here with its status and receipt.</p>
        ) : (
          <div className="pt-scroll"><table className="pt-tbl">
            <thead><tr><th>Date</th><th>Account</th><th>Amount</th><th>UTR</th><th>Status</th><th /></tr></thead>
            <tbody>{payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</td>
                <td>{compact(p.account_size)} · {name(p.plan_key)}</td>
                <td>{inr(p.amount_inr)}</td>
                <td style={{ fontFamily: "var(--f-mono)" }}>{p.utr}</td>
                <td>
                  <Badge tone={p.status === "approved" ? "ok" : p.status === "rejected" ? "bad" : "warn"}>{p.status === "pending" ? "Waiting for approval" : p.status === "approved" ? "Approved" : "Not approved"}</Badge>
                  {p.status === "rejected" && p.reject_reason && <div style={{ color: "var(--muted)", fontSize: ".8rem", marginTop: 4, whiteSpace: "normal", maxWidth: 260 }}>{p.reject_reason}</div>}
                </td>
                <td>{p.status === "approved" ? <Link className="pt-link" href={`/payments/${p.id}`}>Receipt</Link> : p.status === "rejected" ? <Link className="pt-link" href="/checkout">Try again</Link> : null}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}
