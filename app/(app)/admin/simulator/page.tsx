import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/engine/admin";
import { HttpError } from "@/lib/engine/http";
import { adminClient } from "@/lib/supabase/admin";
import { PLAN_RULES } from "@/lib/rules";
import { DEFAULT_ARCHETYPES } from "@/lib/sim";
import { SimulatorClient } from "@/components/admin/SimulatorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Simulator & rules" };

export default async function Page() {
  try { await requireAdmin(); } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/login?next=/admin/simulator");
    return <main className="wrap" style={{ paddingBlock: 48 }}><div className="glass" style={{ padding: 28 }}>Admins only.</div></main>;
  }
  const sb = adminClient();
  const [{ data: plans }, { data: prices }] = await Promise.all([
    sb.from("plans").select("key,name,rules"), sb.from("plan_prices").select("plan_key,account_size,price_inr"),
  ]);
  const list = (plans ?? []).map((p) => ({
    key: p.key as string, name: p.name as string, rules: p.rules ?? PLAN_RULES[p.key as string],
    prices: (prices ?? []).filter((x) => x.plan_key === p.key).map((x) => ({ size: Number(x.account_size), price: Number(x.price_inr) })),
  }));
  return <SimulatorClient plans={list} archetypes={DEFAULT_ARCHETYPES} />;
}
