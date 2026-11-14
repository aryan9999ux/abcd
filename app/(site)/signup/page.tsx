import AuthForm from "@/components/site/AuthForm";

export const metadata = { title: "Create account · Apex Capital Funded" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <main className="wrap page">
      <AuthForm mode="signup" next={next} />
    </main>
  );
}
