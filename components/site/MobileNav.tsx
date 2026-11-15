"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

type U = { email?: string; name?: string } | null;

/** Small-screen menu: one button in the bar, a full-height sheet below it. Also marks the header once the page scrolls. */
export default function MobileNav({ user }: { user: U }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    const hdr = document.querySelector("header.top");
    const onScroll = () => hdr?.classList.toggle("scrolled", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("navopen", open);
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const wide = () => window.innerWidth > 860 && setOpen(false);
    window.addEventListener("keydown", esc);
    window.addEventListener("resize", wide);
    return () => { window.removeEventListener("keydown", esc); window.removeEventListener("resize", wide); document.documentElement.classList.remove("navopen"); };
  }, [open]);

  return (
    <>
      <button className={`burger${open ? " on" : ""}`} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mnav" onClick={() => setOpen((o) => !o)}>
        <i /><i />
      </button>
      <div id="mnav" className={`mnav${open ? " open" : ""}`} hidden={!open && undefined} aria-hidden={!open}>
        <nav aria-label="Menu" onClick={(e) => { if ((e.target as HTMLElement).closest("a")) close(); }}>
          <Link href="/#plans">Plans</Link>
          <Link href="/#how">How it works</Link>
          <Link href="/#rewards">Rewards</Link>
          <Link href="/rules">Rules</Link>
          <Link href="/#faq">FAQ</Link>
          {user && <Link href="/dashboard">Dashboard</Link>}
          {user && <Link href="/terminal">Terminal</Link>}
        </nav>
        <div className="mact">
          {user ? (
            <form action="/auth/signout" method="post"><button className="btn lg" type="submit">Log out</button></form>
          ) : (
            <>
              <Link className="btn lg" href="/login" onClick={close}>Log in</Link>
              <Link className="btn primary lg" href="/signup" onClick={close}>Create account</Link>
            </>
          )}
        </div>
      </div>
    </>
  );
}
