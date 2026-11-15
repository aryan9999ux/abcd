import AuthShell from "@/components/site/AuthShell";
import AuthForm from "@/components/site/AuthForm";

export const metadata = { title: "Log in · Apex Capital Funded" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <AuthShell signup={false}><AuthForm mode="login" next={next} /></AuthShell>
  );
}
