import { redirect } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { userClient } from "@/lib/supabase/server";
import CheckoutForm from "@/components/site/CheckoutForm";
import type { Plan, PlanPrice } from "@/components/site/types";

export const metadata = { title: "Checkout · Apex Capital Funded" };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ plan?: string; size?: string }> }) {
  const sp = await searchParams;
  const auth = await userClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) {
    const qs = new URLSearchParams();
    if (sp.plan) qs.set("plan", sp.plan);
    if (sp.size) qs.set("size", sp.size);
    redirect("/login?next=" + encodeURIComponent("/checkout" + (qs.size ? `?${qs}` : "")));
  }

  const db = publicClient();
  const [{ data: plansRaw }, { data: pricesRaw }] = await Promise.all([
    db.from("plans").select("*").order("evaluation_phases"),
    db.from("plan_prices").select("*").order("account_size"),
  ]);
  const plans = (plansRaw ?? []) as Plan[];
  const prices = ((pricesRaw ?? []) as PlanPrice[]).map((p) => ({ ...p, account_size: Number(p.account_size), price_inr: Number(p.price_inr) }));
  const size = Number(sp.size);

  return (
    <main className="wrap page view">
      <span className="eyebrow">Checkout</span>
      <h2 style={{ marginTop: 8 }}>Start your account</h2>
      <CheckoutForm plans={plans} prices={prices} initialPlan={sp.plan} initialSize={Number.isFinite(size) ? size : undefined} email={data.user.email} />
    </main>
  );
}
