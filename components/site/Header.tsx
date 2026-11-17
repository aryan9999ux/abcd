import Link from "next/link";
import { userClient } from "@/lib/supabase/server";
import { LogoMark, Wordmark } from "@/components/brand/Logo";
import ThemeToggle from "./ThemeToggle";
import MobileNav from "./MobileNav";
import TabBar from "./TabBar";

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
    <>
    <header className="top">
      <div className="wrap">
        <div className="bar">
          <Link className="brand" href="/" aria-label="Edge Funded home">
            <LogoMark size={30} id="hd" />
            <span className="brand-name"><Wordmark /></span>
          </Link>
          <nav className="links" aria-label="Primary">
            <Link href="/#plans">Plans</Link>
            <Link href="/#how">How it works</Link>
            <Link href="/#edge">Earnings</Link>
            <Link href="/rules">Rules</Link>
            <Link href="/#faq">FAQ</Link>
            {user && <Link href="/dashboard">Dashboard</Link>}
            {user && <Link href="/terminal">Terminal</Link>}
          </nav>
          <span className="sp" />
          <ThemeToggle />
          <div className="acts">
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
              <Link className="btn primary sm" href="/signup">Start now</Link>
            </>
          )}
          </div>
          <MobileNav />
        </div>
      </div>
    </header>
    <TabBar signedIn={!!user} />
    </>
  );
}
