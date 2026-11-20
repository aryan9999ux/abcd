"use client";
import { Spin, Splash } from "@/components/ui/Spin";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { safeNext } from "./format";
import { TERMS_VERSION } from "@/lib/legal";

export default function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [entering, setEntering] = useState(false);
  const [agree, setAgree] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const target = safeNext(next);
  const signup = mode === "signup";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (signup && !name.trim()) return setError("Enter your full name.");
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError("Enter a valid email address.");
    if (password.length < 8) return setError("Use a password of at least 8 characters.");
    if (signup && !agree) return setError("Please tick the box to accept the Terms and policies. It is required to create an account.");
    setBusy(true);
    const db = browserClient();
    try {
      if (signup) {
        const { data, error: err } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim(), terms_version: TERMS_VERSION, terms_accepted_at: new Date().toISOString() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
          },
        });
        if (err) return setError(err.message);
        if (data.user) {
          // proof of acceptance, kept on our server with the time, IP address, version and the exact words shown
          const body = JSON.stringify({ userId: data.user.id, email: email.trim() });
          const send = () => fetch("/api/consent", { method: "POST", headers: { "Content-Type": "application/json" }, body });
          try { const r = await send(); if (!r.ok) await send(); } catch { try { await send(); } catch { /* the sign-up metadata still carries the acceptance */ } }
        }
        if (data.session) {
          setEntering(true);
          router.push(target);
          router.refresh();
        } else {
          setNotice("Check your email for a confirmation link, then log in.");
        }
      } else {
        const { error: err } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (err) return setError(err.message);
        setEntering(true);
        router.push(target);
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const other = `${signup ? "/login" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <>
    {entering && <Splash text={signup ? "Setting up your account…" : "Signing you in…"} />}
    <form className="glass card narrow view" onSubmit={onSubmit} noValidate>
      <div>
        <span className="eyebrow">{signup ? "Create account" : "Welcome back"}</span>
        <h2 style={{ marginTop: 8, fontSize: "1.8rem" }}>{signup ? "Start trading" : "Log in"}</h2>
      </div>
      {signup && (
        <label className="f" htmlFor="auth-name">
          Full name
          <input id="auth-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="As on your ID" />
        </label>
      )}
      <label className="f" htmlFor="auth-email">
        Email
        <input id="auth-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
      </label>
      <label className="f" htmlFor="auth-password">
        Password
        <input id="auth-password" type="password" autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
      </label>
      {signup && (
        <label className="cx-chk auth-chk" htmlFor="auth-agree">
          <input id="auth-agree" type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>I have read and agree to the <Link href="/terms" target="_blank">Terms of Service</Link>, <Link href="/privacy" target="_blank">Privacy Policy</Link>, <Link href="/risk" target="_blank">Risk Disclosure</Link> and <Link href="/refund" target="_blank">Refund Policy</Link>. I am 18 or older and live in India.</span>
        </label>
      )}
      {error && <p className="msg err" role="alert">{error}</p>}
      {notice && <p className="msg" role="status">{notice}</p>}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? <><Spin />{signup ? "Creating account…" : "Logging in…"}</> : signup ? "Create account" : "Log in"}
      </button>
      <p className="muted" style={{ fontSize: ".84rem" }}>
        {signup ? "Already have an account? " : "New here? "}
        <Link href={other} style={{ color: "var(--accent)" }}>{signup ? "Log in" : "Create an account"}</Link>
      </p>
    </form>
    </>
  );
}
