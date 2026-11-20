"use client";
import { useEffect, useRef, useState } from "react";
import { usePortal } from "./PortalProvider";

interface M { role: "user" | "assistant"; text: string }

const IDEAS = [
  "How do I get my first payout?",
  "What are the trading rules on my account?",
  "Why was my account breached?",
  "How long does verification take?",
  "How does a Super order work?",
];

/** Full-page assistant for signed-in traders. Uses the same support endpoint as before. */
export default function HelpPage() {
  const { user } = usePortal();
  const first = (user.name || "there").split(" ")[0];
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, busy]);

  async function send(q: string) {
    const t = q.trim();
    if (!t || busy) return;
    const next = [...msgs, { role: "user" as const, text: t }];
    setMsgs(next); setText(""); setBusy(true);
    try {
      const r = await fetch("/api/ai/support", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const j = await r.json();
      setMsgs([...next, { role: "assistant", text: j.ok ? j.reply : j.error || "Something went wrong." }]);
    } catch { setMsgs([...next, { role: "assistant", text: "No connection. Please try again." }]); }
    setBusy(false);
  }

  return (
    <div className="hp">
      <div className="hp-scroll">
        {msgs.length === 0 ? (
          <div className="hp-hero">
            <span className="hp-av">R</span>
            <h1>Hi {first}, how can I help?</h1>
            <p>Ask about your accounts, rules, payouts, payments or verification. I can see your account details.</p>
            <div className="hp-ideas">{IDEAS.map((i) => <button key={i} onClick={() => send(i)}>{i}</button>)}</div>
          </div>
        ) : (
          <div className="hp-thread">
            {msgs.map((m, i) => <p key={i} className={m.role === "user" ? "me" : "bot"}>{m.text}</p>)}
            {busy && <p className="bot typing"><i /><i /><i /></p>}
            <div ref={end} />
          </div>
        )}
      </div>
      <form className="hp-in" onSubmit={(e) => { e.preventDefault(); send(text); }}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Type your question" maxLength={500} aria-label="Message" autoFocus />
        <button disabled={busy || !text.trim()}>Send</button>
      </form>
    </div>
  );
}
