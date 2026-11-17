import { redirect } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { userClient } from "@/lib/supabase/server";
import CheckoutForm from "@/components/site/CheckoutForm";
import type { Plan, PlanPrice } from "@/components/site/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Choose your account · Apex Capital Funded" };

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
  const { count: demos } = await auth.from("trading_accounts").select("id", { count: "exact", head: true }).eq("is_demo", true);

  return (
    <main className="wrap cx view">
      <div className="cx-head">
        <h1>Choose your account</h1>
        <p>Pick a plan and a size. You see exactly what you get before you pay.</p>
      </div>
      <CheckoutForm
        plans={plans} prices={prices} initialPlan={sp.plan} initialSize={Number.isFinite(size) ? size : undefined}
        email={data.user.email} demoAvailable={(demos ?? 0) === 0}
        testMode={process.env.PAYMENTS_MODE === "dev" || process.env.NODE_ENV !== "production"}
      />
    </main>
  );
}
