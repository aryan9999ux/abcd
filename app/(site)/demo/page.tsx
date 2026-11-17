import { redirect } from "next/navigation";
import { publicClient } from "@/lib/supabase/public";
import { userClient } from "@/lib/supabase/server";
import DemoForm from "@/components/site/DemoForm";
import type { Plan } from "@/components/site/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Free demo · Edge Funded" };

export default async function DemoPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams;
  const auth = await userClient();
  const { data } = await auth.auth.getUser();
  if (!data.user) redirect("/signup?next=" + encodeURIComponent("/demo" + (sp.plan ? `?plan=${sp.plan}` : "")));
  const { data: demos } = await auth.from("trading_accounts").select("id,demo_expires_at,status").eq("is_demo", true).limit(1);
  const plans = (((await publicClient().from("plans").select("*").order("evaluation_phases")).data ?? []) as Plan[]);
  return (
    <main className="wrap cx view">
      <div className="cx-head">
        <h1>Try it free for 3 days</h1>
        <p>A ₹10L practice account on live NSE and BSE prices. Pick the plan you want to try and trade with its real rules.</p>
      </div>
      <DemoForm plans={plans} initialPlan={sp.plan} existing={demos?.[0] ?? null} />
    </main>
  );
}
