import Link from "next/link";
import { userClient } from "@/lib/supabase/server";
import ThemeToggle from "./ThemeToggle";

function initials(name: string | undefined, email: string | undefined) {
  const src = (name && name.trim()) || email || "?";
  const parts = src.split(/[\s@.]+/).filter(Boolean);
  return parts.slice(0, 2).map((s) => s[0]).join("").toUpperCase();
}

export default async function Header() {
  let user: { email?: string; name?: string } | null = null;
  try {
    const db = await userClient();
    const { data } = await db.auth.getUser();
    if (data.user) user = { email: data.user.email, name: data.user.user_metadata?.full_name };
  } catch {
    user = null;
  }

  return (
    <header className="top">
      <div className="wrap">
        <div className="bar glass">
          <Link className="brand" href="/" aria-label="Apex Capital Funded home">
            <svg viewBox="0 0 32 32" aria-hidden="true">
              <path d="M16 2 28 9v14L16 30 4 23V9z" fill="none" stroke="var(--accent)" strokeWidth="2" />
              <path d="M9 20 14 13l4 4 5-8" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Apex Capital Funded
          </Link>
          <nav className="links" aria-label="Primary">
            <Link href="/#plans">Plans</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#rewards">Rewards</Link>
            <Link href="/rules">Rules</Link>
            <Link href="/#faq">FAQ</Link>
            {user && <Link href="/dashboard">Dashboard</Link>}
            {user && <Link href="/terminal">Terminal</Link>}
          </nav>
          <span className="sp" />
          <ThemeToggle />
          {user ? (
            <>
              <span className="avatar" title={user.email} aria-label={`Signed in as ${user.email}`}>
                {initials(user.name, user.email)}
              </span>
              <form action="/auth/signout" method="post">
                <button className="btn sm" type="submit">Log out</button>
              </form>
            </>
          ) : (
            <>
              <Link className="btn sm" href="/login">Log in</Link>
              <Link className="btn primary sm" href="/signup">Get funded</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
