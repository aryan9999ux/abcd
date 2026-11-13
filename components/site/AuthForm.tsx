"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { browserClient } from "@/lib/supabase/browser";
import { safeNext } from "./format";

export default function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
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
    setBusy(true);
    const db = browserClient();
    try {
      if (signup) {
        const { data, error: err } = await db.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(target)}`,
          },
        });
        if (err) return setError(err.message);
        if (data.session) {
          router.push(target);
          router.refresh();
        } else {
          setNotice("Check your email for a confirmation link, then log in.");
        }
      } else {
        const { error: err } = await db.auth.signInWithPassword({ email: email.trim(), password });
        if (err) return setError(err.message);
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
      {error && <p className="msg err" role="alert">{error}</p>}
      {notice && <p className="msg" role="status">{notice}</p>}
      <button className="btn primary" type="submit" disabled={busy}>
        {busy ? "Please wait" : signup ? "Create account" : "Log in"}
      </button>
      <p className="muted" style={{ fontSize: ".84rem" }}>
        {signup ? "Already have an account? " : "New here? "}
        <Link href={other} style={{ color: "var(--accent)" }}>{signup ? "Log in" : "Create an account"}</Link>
      </p>
      {signup && (
        <p className="muted" style={{ fontSize: ".76rem" }}>
          Accounts are simulated. Apex Capital Funded is not a broker and does not give investment advice.
        </p>
      )}
    </form>
  );
}
